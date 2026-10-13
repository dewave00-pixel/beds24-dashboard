'use client';

import React, { useMemo } from 'react';
import { Booking } from '../../types';
import { ALL_UNITS, getChannelStyle } from '../../config';
import { getUnitForBooking, calculateNetPayout, isValidBooking } from '../../utils/bookingUtils';
import { formatLocalDate } from '../../utils/analyticsCalculations';

interface DailyPickupReportSectionProps {
    bookings: Booking[];
    startDate: string; // 마스터바 시작일 (YYYY-MM-DD)
    endDate: string;   // 마스터바 종료일 (YYYY-MM-DD)
    selectedProperty?: string;
    selectedUnitKey?: string;
    currentOccupancyRate?: number; // 상단 KPI 표준 가동률 (동기화용)
    onSelectBooking?: (booking: Booking) => void;
}

export default function DailyPickupReportSection({
    bookings,
    startDate,
    endDate,
    selectedProperty = 'all',
    selectedUnitKey = 'all',
    currentOccupancyRate,
    onSelectBooking,
}: DailyPickupReportSectionProps) {
    // 📅 어제 날짜 (신규 예약 집계 기준일)
    const yesterdayStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return formatLocalDate(d);
    }, []);

    const yesterdayLabel = useMemo(() => {
        const [y, m, d] = yesterdayStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[dateObj.getDay()];
        return `${m}월 ${d}일(${dayName})`;
    }, [yesterdayStr]);

    // 🏢 마스터바 필터가 적용된 활성 유닛 목록
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

    // 🗓️ 마스터 기간 내 날짜 목록 [YYYY-MM-DD, ...]
    const periodDates = useMemo(() => {
        if (!startDate || !endDate) return [];
        const dates: string[] = [];
        const cur = new Date(startDate);
        const end = new Date(endDate);

        while (cur <= end) {
            dates.push(formatLocalDate(cur));
            cur.setDate(cur.getDate() + 1);
        }
        return dates;
    }, [startDate, endDate]);

    const periodDays = periodDates.length; // 마스터 기간 일수
    const totalCapacityNights = activeUnits.length * periodDays; // 해당 기간 총 공급 가능 객실 박수

    // 🎯 마스터바 필터에 부합하는 모든 유효 예약
    const matchingValidBookings = useMemo(() => {
        return bookings.filter((b) => {
            if (!isValidBooking(b)) return false;
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
    }, [bookings, selectedProperty, selectedUnitKey]);

    // 🧮 1. 마스터 기간의 현재 총 투숙 박수 및 현재 가동률 계산
    const currentPeriodOccupancy = useMemo(() => {
        let occupiedNights = 0;

        matchingValidBookings.forEach((b) => {
            // b.arrival ~ b.departure 사이 투숙일 중 periodDates와 겹치는 일수
            const cur = new Date(b.arrival);
            const dep = new Date(b.departure);
            while (cur < dep) {
                const dateStr = formatLocalDate(cur);
                if (dateStr >= startDate && dateStr <= endDate) {
                    occupiedNights++;
                }
                cur.setDate(cur.getDate() + 1);
            }
        });

        const rate = totalCapacityNights > 0 ? (occupiedNights / totalCapacityNights) * 100 : 0;
        return { occupiedNights, rate };
    }, [matchingValidBookings, periodDates, startDate, endDate, totalCapacityNights]);

    // 🧮 2. '어제(yesterdayStr)' 유입된 신규 예약 중 마스터 기간과 겹치는 예약 및 지표 집계
    const yesterdayPickupData = useMemo(() => {
        // 어제 결제/체결된 예약들
        const yesterdayBookings = matchingValidBookings.filter((b) => {
            if (!b.bookingTime) return false;
            return b.bookingTime.slice(0, 10) === yesterdayStr;
        });

        let pickupNightsInPeriod = 0;
        let pickupRevenueInPeriod = 0;
        const periodDatePickupCount: Record<string, number> = {};

        const relevantBookings = yesterdayBookings
            .map((b) => {
                const arr = new Date(b.arrival);
                const dep = new Date(b.departure);
                const totalStayNights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
                const netPayout = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);

                // 마스터 기간과 겹치는 박수 계산
                let overlapNights = 0;
                const overlappingDates: string[] = [];
                const cur = new Date(b.arrival);
                while (cur < dep) {
                    const dateStr = formatLocalDate(cur);
                    if (dateStr >= startDate && dateStr <= endDate) {
                        overlapNights++;
                        overlappingDates.push(dateStr);
                        periodDatePickupCount[dateStr] = (periodDatePickupCount[dateStr] || 0) + 1;
                    }
                    cur.setDate(cur.getDate() + 1);
                }

                // 이 예약이 마스터 기간에 미치는 비율 매출
                const proportionalRev = totalStayNights > 0 ? (netPayout / totalStayNights) * overlapNights : 0;

                if (overlapNights > 0) {
                    pickupNightsInPeriod += overlapNights;
                    pickupRevenueInPeriod += proportionalRev;
                }

                return {
                    booking: b,
                    matchedUnit: getUnitForBooking(b),
                    totalStayNights,
                    overlapNights,
                    overlappingDates,
                    netPayout,
                    proportionalRev,
                    chStyle: getChannelStyle(b.apiSourceId),
                };
            })
            .filter((item) => item.overlapNights > 0);

        // 정렬: 마스터 기간 기여 박수 및 매출 내림차순
        relevantBookings.sort((a, b) => b.overlapNights - a.overlapNights || b.proportionalRev - a.proportionalRev);

        // 어제 유입으로 인한 마스터 기간 가동률 상승폭 (%p)
        const pickupOccPpt = totalCapacityNights > 0 ? (pickupNightsInPeriod / totalCapacityNights) * 100 : 0;
        const currentRate = currentOccupancyRate !== undefined ? currentOccupancyRate : currentPeriodOccupancy.rate;
        const prevRate = Math.max(0, Math.round((currentRate - pickupOccPpt) * 10) / 10);
        const adr = pickupNightsInPeriod > 0 ? pickupRevenueInPeriod / pickupNightsInPeriod : 0;

        return {
            bookingsCount: relevantBookings.length,
            pickupNightsInPeriod,
            pickupRevenueInPeriod,
            pickupOccPpt,
            prevRate,
            currentRate,
            adr,
            relevantBookings,
            periodDatePickupCount,
        };
    }, [matchingValidBookings, yesterdayStr, startDate, endDate, totalCapacityNights, currentPeriodOccupancy, currentOccupancyRate]);

    // 🧮 3. 최근 7일간(D-7 ~ D-1) 일일 가동률 유입 페이스 (7-Day Pace)
    const recent7DaysPace = useMemo(() => {
        const paceList: {
            dateStr: string;
            label: string;
            pickupNights: number;
            pickupOccPpt: number;
            rev: number;
            isYesterday: boolean;
        }[] = [];

        const today = new Date();
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

        for (let i = 7; i >= 1; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = formatLocalDate(d);
            const isYesterday = dateStr === yesterdayStr;
            const label = `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`;

            // 해당 일자에 접수된 예약들 중 마스터 기간과 겹치는 박수
            let dayNights = 0;
            let dayRev = 0;

            matchingValidBookings.forEach((b) => {
                if (!b.bookingTime || b.bookingTime.slice(0, 10) !== dateStr) return;

                const arr = new Date(b.arrival);
                const dep = new Date(b.departure);
                const totalNights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
                const netPayout = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);

                let overlap = 0;
                const cur = new Date(b.arrival);
                while (cur < dep) {
                    const s = formatLocalDate(cur);
                    if (s >= startDate && s <= endDate) {
                        overlap++;
                    }
                    cur.setDate(cur.getDate() + 1);
                }

                if (overlap > 0) {
                    dayNights += overlap;
                    dayRev += totalNights > 0 ? (netPayout / totalNights) * overlap : 0;
                }
            });

            const occPpt = totalCapacityNights > 0 ? (dayNights / totalCapacityNights) * 100 : 0;

            paceList.push({
                dateStr,
                label,
                pickupNights: dayNights,
                pickupOccPpt: occPpt,
                rev: dayRev,
                isYesterday,
            });
        }

        return paceList;
    }, [matchingValidBookings, yesterdayStr, startDate, endDate, totalCapacityNights]);

    // 🧮 4. 어제 유입으로 가동률이 상승한 마스터 기간 내 일자별 기여도 순위 (Top 6)
    const topContributedDates = useMemo(() => {
        const counts = yesterdayPickupData.periodDatePickupCount;
        const entries = Object.entries(counts).map(([dateStr, count]) => {
            const occPpt = activeUnits.length > 0 ? (count / activeUnits.length) * 100 : 0;
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const dayName = dayNames[dateObj.getDay()];
            const isWeekend = dayName === '금' || dayName === '토';

            return {
                dateStr,
                label: `${m}/${d} (${dayName})`,
                count,
                occPpt,
                isWeekend,
            };
        });

        // 날짜순 정렬
        entries.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
        return entries;
    }, [yesterdayPickupData.periodDatePickupCount, activeUnits.length]);

    // 최고 페이스 값 (미니 바 차트 스케일링용)
    const maxPaceOccPpt = useMemo(() => {
        const max = Math.max(...recent7DaysPace.map((p) => p.pickupOccPpt), 1);
        return max;
    }, [recent7DaysPace]);

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
            {/* 상단 헤더 & 마스터바 연동 안내 바 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white text-lg shadow-sm">
                        ⚡
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                일일 예약 유입 & 가동률 증분 (Daily Pick-up)
                            </h3>
                            <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                                어제({yesterdayLabel}) 유입 기준
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            상단 마스터바 기간(
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {startDate} ~ {endDate}
                            </span>
                            , 총 {periodDays}일 · {totalCapacityNights}공급박) 대비 어제 체결된 예약의 순증 기여도입니다.
                        </p>
                    </div>
                </div>

                {/* 지점/호실 컨텍스트 뱃지 */}
                <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200/60 dark:border-slate-700/60">
                        🏢 {selectedProperty === 'all' ? '전체 지점' : selectedProperty} · {activeUnits.length}개 객실
                    </span>
                </div>
            </div>

            {/* 4대 핵심 KPI 카드: 전날 대비 가동률 상승폭 중심 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. 가동률 상승폭 */}
                <div className="bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-blue-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400 font-bold mb-1">
                        <span>📈 기간 가동률 상승폭</span>
                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                            +변동치
                        </span>
                    </div>
                    <div className="my-1">
                        <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight flex items-baseline gap-1">
                            {yesterdayPickupData.pickupOccPpt > 0 ? (
                                <>
                                    <span>+{yesterdayPickupData.pickupOccPpt.toFixed(1)}</span>
                                    <span className="text-base font-bold">%p</span>
                                </>
                            ) : (
                                <span className="text-lg text-slate-400">0.0%p (변동없음)</span>
                            )}
                        </div>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-indigo-100/60 dark:border-indigo-900/40">
                        <span>기존: {yesterdayPickupData.prevRate.toFixed(1)}%</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                            → 현재 {yesterdayPickupData.currentRate.toFixed(1)}%
                        </span>
                    </div>
                </div>

                {/* 2. 어제 유입 신규 매출 */}
                <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-bold mb-1">
                        <span>💰 어제 발생 신규 매출</span>
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                            순정산
                        </span>
                    </div>
                    <div className="my-1">
                        <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight flex items-baseline gap-0.5">
                            <span>+₩</span>
                            <span>{Math.round(yesterdayPickupData.pickupRevenueInPeriod).toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-emerald-100/60 dark:border-emerald-900/40">
                        해당 기간 투숙 기여 순매출
                    </div>
                </div>

                {/* 3. 어제 판매된 박수 & 예약 건수 */}
                <div className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50 dark:from-amber-950/30 dark:via-slate-900 dark:to-orange-950/20 border border-amber-100 dark:border-amber-900/50 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-bold mb-1">
                        <span>🛏️ 신규 판매 박수</span>
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/80 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                            어제 체결
                        </span>
                    </div>
                    <div className="my-1">
                        <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight flex items-baseline gap-1">
                            <span>+{yesterdayPickupData.pickupNightsInPeriod}</span>
                            <span className="text-base font-bold">박</span>
                        </div>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-amber-100/60 dark:border-amber-900/40">
                        <span>신규 예약 건수</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                            {yesterdayPickupData.bookingsCount}건 체결
                        </span>
                    </div>
                </div>

                {/* 4. 체결 평균 객단가 (ADR) */}
                <div className="bg-gradient-to-br from-purple-50/80 via-white to-fuchsia-50/50 dark:from-purple-950/30 dark:via-slate-900 dark:to-fuchsia-950/20 border border-purple-100 dark:border-purple-900/50 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-purple-700 dark:text-purple-400 font-bold mb-1">
                        <span>🏷️ 신규 체결 ADR (객단가)</span>
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-900/80 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                            1박 평균
                        </span>
                    </div>
                    <div className="my-1">
                        <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 font-mono tracking-tight flex items-baseline gap-0.5">
                            <span>₩</span>
                            <span>{Math.round(yesterdayPickupData.adr).toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-purple-100/60 dark:border-purple-900/40">
                        어제 판매된 박수 기준 평균
                    </div>
                </div>
            </div>

            {/* 중단 2단 그리드: [📅 일자별 가동률 기여도] & [📊 최근 7일간 일일 가동률 유입 추세(Pace)] */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1) 마스터 기간 내 일자별 가동률 기여도 (어제 유입으로 차오른 날짜들) */}
                <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                    📅 어제 예약으로 차오른 투숙일
                                </span>
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                    (총 {topContributedDates.length}개 날짜 기여)
                                </span>
                            </div>
                        </div>

                        {topContributedDates.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                                어제 해당 기간({startDate} ~ {endDate})으로 유입된 신규 예약이 없습니다.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {topContributedDates.map((item) => (
                                    <div
                                        key={item.dateStr}
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg p-2.5 shadow-xs"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span
                                                className={`text-xs font-bold ${
                                                    item.isWeekend
                                                        ? 'text-rose-600 dark:text-rose-400'
                                                        : 'text-slate-800 dark:text-slate-200'
                                                }`}
                                            >
                                                {item.label}
                                            </span>
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 font-bold">
                                                +{item.count}박
                                            </span>
                                        </div>
                                        <div className="mt-1 text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                                            +{item.occPpt.toFixed(1)}%p
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        💡 어제 하루 동안 팔린 방들이 해당 기간 중 어느 날짜의 가동률을 끌어올렸는지 보여줍니다.
                    </div>
                </div>

                {/* 2) 최근 7일간 일일 가동률 유입 페이스 (7-Day Pace) */}
                <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                    📊 최근 7일간 일일 가동률 유입 페이스 (Pace)
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                최근 7일 유입 속도
                            </span>
                        </div>

                        {/* 미니 수직 바 차트 */}
                        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 h-28 items-end pt-3 pb-1 px-1">
                            {recent7DaysPace.map((p) => {
                                const heightPercent = Math.max(8, Math.min(100, (p.pickupOccPpt / maxPaceOccPpt) * 100));
                                return (
                                    <div key={p.dateStr} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                                        <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                            {p.pickupOccPpt > 0 ? `+${p.pickupOccPpt.toFixed(1)}%` : '0%'}
                                        </span>
                                        <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-t-md h-20 flex items-end overflow-hidden">
                                            <div
                                                style={{ height: `${heightPercent}%` }}
                                                className={`w-full rounded-t-md transition-all duration-300 ${
                                                    p.isYesterday
                                                        ? 'bg-gradient-to-t from-indigo-600 to-rose-500 shadow-sm'
                                                        : 'bg-indigo-400/80 dark:bg-indigo-500/60 group-hover:bg-indigo-500'
                                                }`}
                                            />
                                        </div>
                                        <span
                                            className={`text-[10px] truncate ${
                                                p.isYesterday
                                                    ? 'font-black text-rose-600 dark:text-rose-400'
                                                    : 'text-slate-500 dark:text-slate-400'
                                            }`}
                                        >
                                            {p.isYesterday ? '어제' : p.label.slice(0, 5)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        💡 지난 7일 동안 매일매일 이 마스터 기간 방이 하루에 몇 %p씩 차올랐는지 속도를 확인합니다.
                    </div>
                </div>
            </div>

            {/* 하단: 어제 유입된 예약 상세 목록 */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>📋 어제 체결된 신규 예약 상세</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                            총 {yesterdayPickupData.relevantBookings.length}건
                        </span>
                    </h4>
                </div>

                {yesterdayPickupData.relevantBookings.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                        어제 접수된 예약 중 선택 기간({startDate} ~ {endDate})에 투숙하는 예약이 없습니다.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/80">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="py-2.5 px-3">채널</th>
                                    <th className="py-2.5 px-3">객실 / 고객</th>
                                    <th className="py-2.5 px-3">투숙 일정</th>
                                    <th className="py-2.5 px-3 text-center">선택기간 기여</th>
                                    <th className="py-2.5 px-3 text-right">해당기간 순정산액</th>
                                    <th className="py-2.5 px-3 text-right">체결 ADR</th>
                                    <th className="py-2.5 px-3 text-center">상세</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {yesterdayPickupData.relevantBookings.map((item) => {
                                    const b = item.booking;
                                    const unit = item.matchedUnit;
                                    const adr = item.overlapNights > 0 ? item.proportionalRev / item.overlapNights : 0;

                                    const guestFullName = [b.lastName, b.firstName].filter(Boolean).join(' ') || '고객명 미기재';

                                    return (
                                        <tr
                                            key={b.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            {/* 채널 */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <span
                                                    className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                                                    style={{
                                                        backgroundColor: item.chStyle.bg,
                                                        color: item.chStyle.text,
                                                    }}
                                                >
                                                    {item.chStyle.name}
                                                </span>
                                            </td>

                                            {/* 객실 / 고객 */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <div className="font-bold text-slate-800 dark:text-slate-200">
                                                    {unit?.displayName || `방 #${b.roomId}`}
                                                </div>
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    {guestFullName} (#{b.id})
                                                </div>
                                            </td>

                                            {/* 투숙 일정 */}
                                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                                                <div className="text-slate-700 dark:text-slate-300">
                                                    {b.arrival} → {b.departure}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    전체 {item.totalStayNights}박
                                                </div>
                                            </td>

                                            {/* 선택기간 기여 박수 */}
                                            <td className="py-2.5 px-3 whitespace-nowrap text-center font-mono">
                                                <span className="inline-block px-2 py-0.5 rounded font-black text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/40">
                                                    +{item.overlapNights}박
                                                </span>
                                            </td>

                                            {/* 해당기간 순정산액 */}
                                            <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                ₩{Math.round(item.proportionalRev).toLocaleString()}
                                            </td>

                                            {/* 체결 ADR */}
                                            <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono text-slate-700 dark:text-slate-300">
                                                ₩{Math.round(adr).toLocaleString()}
                                            </td>

                                            {/* 상세 보기 버튼 */}
                                            <td className="py-2.5 px-3 whitespace-nowrap text-center">
                                                {onSelectBooking ? (
                                                    <button
                                                        onClick={() => onSelectBooking(b)}
                                                        className="px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded transition-colors"
                                                    >
                                                        보기
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-600">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
