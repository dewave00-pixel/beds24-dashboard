'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import { ALL_UNITS, getChannelStyle } from '../../config';
import { getUnitForBooking, calculateNetPayout, isValidBooking } from '../../utils/bookingUtils';

interface DailyPickupReportSectionProps {
    bookings: Booking[];
    selectedProperty?: string;
    selectedUnitKey?: string;
    onSelectBooking?: (booking: Booking) => void;
}

export default function DailyPickupReportSection({
    bookings,
    selectedProperty = 'all',
    selectedUnitKey = 'all',
    onSelectBooking,
}: DailyPickupReportSectionProps) {
    // 📅 기준 일자 (기본값: 어제 YYYY-MM-DD)
    const yesterdayStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }, []);

    const todayStr = useMemo(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }, []);

    const [targetDateStr, setTargetDateStr] = useState<string>(yesterdayStr);

    // 날짜 이동 헬퍼
    const handleShiftDate = (days: number) => {
        const [y, m, d] = targetDateStr.split('-').map(Number);
        const current = new Date(y, m - 1, d);
        current.setDate(current.getDate() + days);
        const ny = current.getFullYear();
        const nm = String(current.getMonth() + 1).padStart(2, '0');
        const nd = String(current.getDate()).padStart(2, '0');
        setTargetDateStr(`${ny}-${nm}-${nd}`);
    };

    // 요일 표시
    const targetDateLabel = useMemo(() => {
        const [y, m, d] = targetDateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[dateObj.getDay()];
        const isWeekend = dayName === '금' || dayName === '토';
        return {
            formatted: `${y}년 ${m}월 ${d}일 (${dayName})`,
            dayName,
            isWeekend,
            isToday: targetDateStr === todayStr,
            isYesterday: targetDateStr === yesterdayStr,
        };
    }, [targetDateStr, todayStr, yesterdayStr]);

    // 활성 유닛 목록
    const activeUnits = useMemo(() => {
        let list = ALL_UNITS;
        if (selectedProperty && selectedProperty !== 'all') {
            list = list.filter((u) => u.propName === selectedProperty);
        }
        if (selectedUnitKey && selectedUnitKey !== 'all') {
            list = list.filter((u) => u.key === selectedUnitKey || u.unitKey === selectedUnitKey);
        }
        return list;
    }, [selectedProperty, selectedUnitKey]);

    // 🎯 기준 일자에 신규 생성(결제)된 예약 목록 필터링
    const targetDayNewBookings = useMemo(() => {
        const validBookings = bookings.filter(isValidBooking);

        return validBookings.filter((b) => {
            if (!b.bookingTime) return false;
            const bDate = b.bookingTime.slice(0, 10);
            if (bDate !== targetDateStr) return false;

            // 지점/호실 필터링
            const matchedUnit = getUnitForBooking(b);
            if (!matchedUnit) return false;

            if (selectedProperty && selectedProperty !== 'all' && matchedUnit.propName !== selectedProperty) {
                return false;
            }
            if (selectedUnitKey && selectedUnitKey !== 'all' && matchedUnit.key !== selectedUnitKey && matchedUnit.unitKey !== selectedUnitKey) {
                return false;
            }

            return true;
        });
    }, [bookings, targetDateStr, selectedProperty, selectedUnitKey]);

    // 📊 기준 일자 성과 지표 집계
    const stats = useMemo(() => {
        let totalRev = 0;
        let totalNights = 0;

        const bookingDetails = targetDayNewBookings.map((b) => {
            const matchedUnit = getUnitForBooking(b);
            const arr = new Date(b.arrival);
            const dep = new Date(b.departure);
            const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
            const netPayout = calculateNetPayout(Number(b.price) || 0, b.apiSourceId);
            const chStyle = getChannelStyle(b.apiSourceId);

            totalRev += netPayout;
            totalNights += nights;

            // 예약 체결 시각 (HH:mm) 추출
            let timeStr = '';
            if (b.bookingTime && b.bookingTime.length >= 16) {
                timeStr = b.bookingTime.slice(11, 16);
            }

            return {
                booking: b,
                guestName: `${b.firstName || ''} ${b.lastName || ''}`.trim() || '고객',
                unitName: matchedUnit ? matchedUnit.displayName + (matchedUnit.subName ? ` (${matchedUnit.subName})` : '') : '미배정',
                propName: matchedUnit?.propName || '',
                arrival: b.arrival,
                departure: b.departure,
                nights,
                price: netPayout,
                channelName: chStyle.name,
                channelBg: chStyle.bg,
                channelText: chStyle.text,
                timeStr,
            };
        });

        const count = targetDayNewBookings.length;
        const adr = totalNights > 0 ? Math.round(totalRev / totalNights) : 0;

        // 월간(30일) 공급 박수 대비 하루 가동률 기여도 (%p)
        const totalUnitsCount = Math.max(1, activeUnits.length);
        const monthlyCapacity = totalUnitsCount * 30; // 30일 기준
        const occContribution = monthlyCapacity > 0 ? Math.round((totalNights / monthlyCapacity) * 1000) / 10 : 0;

        return {
            count,
            totalRev,
            totalNights,
            adr,
            occContribution,
            bookingDetails,
        };
    }, [targetDayNewBookings, activeUnits]);

    // 📈 최근 7일간 일일 판매 추세 데이터 (Velocity)
    const recent7DaysTrend = useMemo(() => {
        const trendList: Array<{
            dateStr: string;
            shortLabel: string;
            dayOfWeek: string;
            count: number;
            nights: number;
            revenue: number;
            isTarget: boolean;
        }> = [];

        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const [y, m, d] = targetDateStr.split('-').map(Number);
        const baseDate = new Date(y, m - 1, d);

        for (let i = 6; i >= 0; i--) {
            const dt = new Date(baseDate);
            dt.setDate(dt.getDate() - i);
            const dtStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            const dayOfWeek = dayNames[dt.getDay()];

            // 해당 날짜에 생성된 예약들
            const dayBookings = bookings.filter((b) => {
                if (!isValidBooking(b) || !b.bookingTime) return false;
                if (b.bookingTime.slice(0, 10) !== dtStr) return false;

                const matchedUnit = getUnitForBooking(b);
                if (!matchedUnit) return false;
                if (selectedProperty && selectedProperty !== 'all' && matchedUnit.propName !== selectedProperty) return false;
                if (selectedUnitKey && selectedUnitKey !== 'all' && matchedUnit.key !== selectedUnitKey && matchedUnit.unitKey !== selectedUnitKey) return false;

                return true;
            });

            let dayRev = 0;
            let dayNights = 0;
            dayBookings.forEach((b) => {
                const arr = new Date(b.arrival);
                const dep = new Date(b.departure);
                const n = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
                dayNights += n;
                dayRev += calculateNetPayout(Number(b.price) || 0, b.apiSourceId);
            });

            trendList.push({
                dateStr: dtStr,
                shortLabel: `${dt.getMonth() + 1}/${dt.getDate()}`,
                dayOfWeek,
                count: dayBookings.length,
                nights: dayNights,
                revenue: dayRev,
                isTarget: dtStr === targetDateStr,
            });
        }

        return trendList;
    }, [bookings, targetDateStr, selectedProperty, selectedUnitKey]);

    const maxTrendNights = useMemo(() => {
        const max = Math.max(...recent7DaysTrend.map((t) => t.nights), 1);
        return max;
    }, [recent7DaysTrend]);

    return (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-3.5 md:p-5 shadow-xs flex flex-col gap-4">
            {/* 1. 상단 타이틀 & 기준일 선택 툴바 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-black shrink-0">
                        ⚡
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm md:text-base font-black text-gray-900 dark:text-slate-100">
                                일일 예약 유입 & 가동률 증분 리포트 (Daily Pick-up)
                            </h2>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                신규 유입
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                            지정된 하루 동안 새로 체결된 예약으로 인해 늘어난 매출, 박수, 가동률 상승 기여도를 집계합니다.
                        </p>
                    </div>
                </div>

                {/* 기준 일자 스텝퍼 & 퀵 프리셋 버튼들 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* 퀵 프리셋 */}
                    <button
                        type="button"
                        onClick={() => setTargetDateStr(yesterdayStr)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer border ${
                            targetDateStr === yesterdayStr
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-black'
                                : 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100'
                        }`}
                    >
                        어제 (기본)
                    </button>
                    <button
                        type="button"
                        onClick={() => setTargetDateStr(todayStr)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer border ${
                            targetDateStr === todayStr
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-black'
                                : 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100'
                        }`}
                    >
                        오늘
                    </button>

                    {/* 날짜 스텝퍼 */}
                    <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800/80 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => handleShiftDate(-1)}
                            title="이전 날짜"
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 font-black text-xs transition cursor-pointer"
                        >
                            ◀
                        </button>
                        <input
                            type="date"
                            value={targetDateStr}
                            onChange={(e) => e.target.value && setTargetDateStr(e.target.value)}
                            className="bg-transparent font-mono font-bold text-xs text-gray-900 dark:text-slate-100 px-1.5 py-0.5 focus:outline-none cursor-pointer"
                        />
                        <button
                            type="button"
                            onClick={() => handleShiftDate(1)}
                            title="다음 날짜"
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 font-black text-xs transition cursor-pointer"
                        >
                            ▶
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. 하루 동안 증가한 핵심 성과 지표 4종 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {/* 1) 신규 발생 매출 */}
                <div className="bg-linear-to-br from-blue-50/70 to-indigo-50/40 dark:from-slate-800/60 dark:to-slate-850/60 p-3.5 rounded-2xl border border-blue-100 dark:border-slate-700/80 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-600 dark:text-slate-400">하루 신규 매출</span>
                        <span className="text-xs">💰</span>
                    </div>
                    <div className="mt-2">
                        <span className="font-mono font-black text-lg md:text-xl text-blue-700 dark:text-blue-300">
                            +{stats.totalRev.toLocaleString()}원
                        </span>
                        <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                            순정산액 기준 (수수료 제외)
                        </div>
                    </div>
                </div>

                {/* 2) 신규 판매 박수 */}
                <div className="bg-linear-to-br from-emerald-50/70 to-teal-50/40 dark:from-slate-800/60 dark:to-slate-850/60 p-3.5 rounded-2xl border border-emerald-100 dark:border-slate-700/80 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-600 dark:text-slate-400">하루 판매 박수</span>
                        <span className="text-xs">🛏️</span>
                    </div>
                    <div className="mt-2">
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono font-black text-lg md:text-xl text-emerald-700 dark:text-emerald-300">
                                +{stats.totalNights}박
                            </span>
                            <span className="text-xs font-bold text-gray-500">
                                ({stats.count}건 체결)
                            </span>
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                            신규 객실 판매
                        </div>
                    </div>
                </div>

                {/* 3) 가동률 상승 기여도 */}
                <div className="bg-linear-to-br from-purple-50/70 to-violet-50/40 dark:from-slate-800/60 dark:to-slate-850/60 p-3.5 rounded-2xl border border-purple-100 dark:border-slate-700/80 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-600 dark:text-slate-400">가동률 상승 기여도</span>
                        <span className="text-xs">📈</span>
                    </div>
                    <div className="mt-2">
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono font-black text-lg md:text-xl text-purple-700 dark:text-purple-300">
                                +{stats.occContribution}%p
                            </span>
                            <span className="text-[10.5px] text-gray-400">상승</span>
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                            총 공급량 대비 확보율
                        </div>
                    </div>
                </div>

                {/* 4) 평균 체결 단가 (ADR) */}
                <div className="bg-linear-to-br from-amber-50/70 to-orange-50/40 dark:from-slate-800/60 dark:to-slate-850/60 p-3.5 rounded-2xl border border-amber-100 dark:border-slate-700/80 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-600 dark:text-slate-400">체결 평균 단가(ADR)</span>
                        <span className="text-xs">💵</span>
                    </div>
                    <div className="mt-2">
                        <span className="font-mono font-black text-lg md:text-xl text-amber-800 dark:text-amber-300">
                            {stats.adr > 0 ? `${stats.adr.toLocaleString()}원` : '-'}
                        </span>
                        <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                            1박 평균 객단가
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. 중단: 최근 7일간 일일 판매 추세 미니 차트 & 체결된 신규 예약 리스트 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                {/* 좌측 (5열): 최근 7일간 일일 판매 추세 (Velocity) */}
                <div className="lg:col-span-5 bg-gray-50/70 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-slate-800 p-3.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-slate-700/60">
                            <span className="font-black text-xs text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                                <span>📊</span>
                                <span>최근 7일간 일일 판매 추세 (박수)</span>
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                                최근 7일 누적
                            </span>
                        </div>

                        {/* 막대 차트 */}
                        <div className="mt-3 flex items-end justify-between gap-1 h-[130px] px-1">
                            {recent7DaysTrend.map((t) => {
                                const heightPercent = maxTrendNights > 0 ? (t.nights / maxTrendNights) * 100 : 0;
                                const isWeekend = t.dayOfWeek === '금' || t.dayOfWeek === '토';

                                return (
                                    <div
                                        key={t.dateStr}
                                        onClick={() => setTargetDateStr(t.dateStr)}
                                        className={`flex-1 flex flex-col items-center gap-1 h-full justify-end cursor-pointer group transition p-1 rounded-lg ${
                                            t.isTarget
                                                ? 'bg-blue-100/70 dark:bg-blue-950/60 ring-2 ring-blue-500'
                                                : 'hover:bg-gray-200/50 dark:hover:bg-slate-700/40'
                                        }`}
                                    >
                                        <span className={`font-mono text-[10px] font-black ${
                                            t.isTarget ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-slate-400'
                                        }`}>
                                            {t.nights}박
                                        </span>
                                        <div className="w-full bg-gray-200 dark:bg-slate-700/60 rounded-t-md h-full max-h-[85px] flex items-end p-0.5">
                                            <div
                                                className={`w-full rounded-t-sm transition-all duration-300 ${
                                                    t.isTarget
                                                        ? 'bg-blue-600 dark:bg-blue-500'
                                                        : t.nights > 0
                                                        ? 'bg-indigo-400 dark:bg-indigo-500 group-hover:bg-indigo-500'
                                                        : 'bg-gray-300 dark:bg-slate-600'
                                                }`}
                                                style={{ height: `${Math.max(6, heightPercent)}%` }}
                                            />
                                        </div>
                                        <div className="text-center">
                                            <div className="font-mono text-[9.5px] text-gray-500 dark:text-slate-400 leading-tight">
                                                {t.shortLabel}
                                            </div>
                                            <div className={`text-[9px] font-bold ${
                                                isWeekend ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400 dark:text-slate-500'
                                            }`}>
                                                ({t.dayOfWeek})
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-200/60 dark:border-slate-700/60 text-[10.5px] text-gray-400 flex items-center justify-between">
                        <span>💡 날짜 막대를 클릭하면 해당 일자의 상세 리포트로 전환됩니다</span>
                    </div>
                </div>

                {/* 우측 (7열): 해당 일자에 체결된 신규 예약 목록 */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-3.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                            <div className="flex items-center gap-1.5 font-black text-xs text-gray-900 dark:text-slate-100">
                                <span>📋</span>
                                <span>{targetDateLabel.formatted} 체결된 신규 예약 목록</span>
                                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                    총 {stats.count}건
                                </span>
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">
                                합계 {stats.totalNights}박 / ₩{stats.totalRev.toLocaleString()}원
                            </span>
                        </div>

                        {/* 리스트 본문 */}
                        <div className="mt-2.5 flex flex-col gap-1.5 max-h-[175px] overflow-y-auto pr-1">
                            {stats.bookingDetails.length === 0 ? (
                                <div className="py-8 text-center text-xs font-bold text-gray-400 dark:text-slate-500 flex flex-col items-center gap-1">
                                    <span className="text-xl">📭</span>
                                    <span>해당 일자에 새로 접수된 예약이 없습니다.</span>
                                </div>
                            ) : (
                                stats.bookingDetails.map((item, idx) => (
                                    <div
                                        key={item.booking.id || idx}
                                        onClick={() => onSelectBooking && onSelectBooking(item.booking)}
                                        className="p-2 rounded-xl bg-gray-50/80 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2 hover:border-blue-400 dark:hover:border-blue-500 transition cursor-pointer"
                                    >
                                        {/* 좌측: 플랫폼 뱃지 + 게스트 + 호실 */}
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="text-[9.5px] font-black px-1.5 py-0.5 rounded shadow-2xs shrink-0"
                                                style={{
                                                    backgroundColor: item.channelBg || '#2563eb',
                                                    color: item.channelText || '#ffffff',
                                                }}
                                            >
                                                {item.channelName}
                                            </span>
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span className="font-black text-xs text-gray-900 dark:text-slate-100 truncate">
                                                        {item.guestName}
                                                    </span>
                                                    <span className="text-[10.5px] text-gray-500 dark:text-slate-400 font-bold truncate">
                                                        · {item.unitName}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                                    투숙: {item.arrival.slice(5)} ~ {item.departure.slice(5)} ({item.nights}박)
                                                    {item.timeStr && <span className="ml-1 text-gray-400">({item.timeStr} 결제)</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 우측: 정산 금액 */}
                                        <div className="text-right shrink-0">
                                            <span className="font-mono font-black text-xs text-gray-900 dark:text-slate-100">
                                                ₩{item.price.toLocaleString()}원
                                            </span>
                                            <div className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-bold">
                                                {item.nights}박 확정
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-800/80 text-[10.5px] text-gray-400 flex items-center justify-between">
                        <span>💡 예약을 클릭하면 해당 예약의 상세 카드 팝업을 확인할 수 있습니다</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
