'use client';

import React, { useState, useMemo } from 'react';
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
    // 📅 오늘 및 어제 날짜 (기준일 퀵 옵션용)
    const { todayStr, yesterdayStr } = useMemo(() => {
        const now = new Date();
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return {
            todayStr: formatLocalDate(now),
            yesterdayStr: formatLocalDate(y),
        };
    }, []);

    // 🎯 기준 시점 (As-of Date) 상태 (기본값: 분석 대상 기간의 시작일, 예: 9월 조회 시 9/1)
    const [asOfDateStr, setAsOfDateStr] = useState<string>(startDate || todayStr);

    // 상단 마스터바 startDate가 변경될 때 기준 시점이 마스터 기간 이전/이후로 크게 벗어나면 시작일로 자동 갱신
    React.useEffect(() => {
        if (startDate) {
            setAsOfDateStr(startDate);
        }
    }, [startDate]);

    // 기준일 헬퍼 라벨
    const asOfDateLabel = useMemo(() => {
        if (!asOfDateStr) return '';
        const [y, m, d] = asOfDateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[dateObj.getDay()];
        return `${y}년 ${m}월 ${d}일(${dayName})`;
    }, [asOfDateStr]);

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

    const activeUnitKeySet = useMemo(() => new Set(activeUnits.map((u) => u.key)), [activeUnits]);

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

    const periodDays = periodDates.length;
    const totalCapacityNights = activeUnits.length * periodDays;

    // 🎯 필터에 부합하는 모든 유효 예약
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

    // 🧮 1. [기준 시점(asOfDate) 이전 사전 확보(OTB)] vs [기준 시점 이후 추가 유입(Pickup)] 분리 집계
    const paceSummary = useMemo(() => {
        // 예약 체결일(bookingTime 기준, 없으면 arrival 기준)
        const getBookingDate = (b: Booking) => (b.bookingTime ? b.bookingTime.slice(0, 10) : b.arrival);

        // 사전 확보 예약 (bookingDate <= asOfDateStr)
        const preBookings: { booking: Booking; overlapNights: number; netPayout: number; proportionalRev: number }[] = [];
        // 사후 유입 예약 (bookingDate > asOfDateStr)
        const postBookings: { booking: Booking; overlapNights: number; netPayout: number; proportionalRev: number }[] = [];

        matchingValidBookings.forEach((b) => {
            const arr = new Date(b.arrival);
            const dep = new Date(b.departure);
            const totalStayNights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
            const netPayout = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);

            let overlapNights = 0;
            const cur = new Date(b.arrival);
            while (cur < dep) {
                const dateStr = formatLocalDate(cur);
                if (dateStr >= startDate && dateStr <= endDate) {
                    overlapNights++;
                }
                cur.setDate(cur.getDate() + 1);
            }

            if (overlapNights > 0) {
                const proportionalRev = totalStayNights > 0 ? (netPayout / totalStayNights) * overlapNights : 0;
                const bDate = getBookingDate(b);
                const item = { booking: b, overlapNights, netPayout, proportionalRev };

                if (bDate <= asOfDateStr) {
                    preBookings.push(item);
                } else {
                    postBookings.push(item);
                }
            }
        });

        // 1) 사전 확보(OTB) 가동률 (물리적 객실 중복 방지 Set 적용)
        let preStayNights = 0;
        let preRevenue = 0;
        preBookings.forEach((item) => {
            preStayNights += item.overlapNights;
            preRevenue += item.proportionalRev;
        });

        // 2) 사후 유입(Pickup) 가동률
        let postPickupNights = 0;
        let postRevenue = 0;
        postBookings.forEach((item) => {
            postPickupNights += item.overlapNights;
            postRevenue += item.proportionalRev;
        });

        const totalStayNights = preStayNights + postPickupNights;
        const totalRevenue = preRevenue + postRevenue;

        // 가동률 산출
        const preOccRate = totalCapacityNights > 0 ? (preStayNights / totalCapacityNights) * 100 : 0;
        const postOccPpt = totalCapacityNights > 0 ? (postPickupNights / totalCapacityNights) * 100 : 0;
        const finalOccRate = currentOccupancyRate !== undefined ? currentOccupancyRate : (totalCapacityNights > 0 ? (totalStayNights / totalCapacityNights) * 100 : 0);

        // 사전/사후 ADR
        const preAdr = preStayNights > 0 ? preRevenue / preStayNights : 0;
        const postAdr = postPickupNights > 0 ? postRevenue / postPickupNights : 0;

        return {
            preBookings,
            postBookings,
            preStayNights,
            preRevenue,
            preOccRate,
            preAdr,
            postPickupNights,
            postRevenue,
            postOccPpt,
            postAdr,
            totalStayNights,
            totalRevenue,
            finalOccRate,
        };
    }, [matchingValidBookings, asOfDateStr, startDate, endDate, totalCapacityNights, currentOccupancyRate]);

    // 🧮 2. 기준일 이후 일별 누적 유입 곡선 데이터 (Pace Progression)
    const paceTimeline = useMemo(() => {
        // 기준일 다음날부터 추적 시작
        const nextDay = new Date(asOfDateStr);
        nextDay.setDate(nextDay.getDate() + 1);

        // 추적 종료일: 마스터 기간 종료일과 오늘 중 더 늦은 날 (단, 최대 endDate + 15일까지)
        const timelineEndDate = new Date(Math.max(new Date(endDate).getTime(), new Date(todayStr).getTime()));

        const items: {
            dateStr: string;
            label: string;
            dayNights: number;
            dayOccPpt: number;
            dayRev: number;
            cumulativeOccRate: number;
            cumulativeNights: number;
            dayBookingsCount: number;
        }[] = [];

        // 시작 베이스: 기준일 시점의 사전 확보 가동률
        let runningOccRate = paceSummary.preOccRate;
        let runningNights = paceSummary.preStayNights;

        const cur = new Date(nextDay);
        // 과도한 루프 방지 (최대 60일)
        let loopCount = 0;

        while (cur <= timelineEndDate && loopCount < 60) {
            loopCount++;
            const dateStr = formatLocalDate(cur);
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const dayName = dayNames[dateObj.getDay()];

            let dayNights = 0;
            let dayRev = 0;
            let dayCount = 0;

            matchingValidBookings.forEach((b) => {
                const bDate = b.bookingTime ? b.bookingTime.slice(0, 10) : b.arrival;
                if (bDate !== dateStr) return;

                const arr = new Date(b.arrival);
                const dep = new Date(b.departure);
                const totalStayNights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
                const netPayout = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);

                let overlap = 0;
                const cDate = new Date(b.arrival);
                while (cDate < dep) {
                    const s = formatLocalDate(cDate);
                    if (s >= startDate && s <= endDate) {
                        overlap++;
                    }
                    cDate.setDate(cDate.getDate() + 1);
                }

                if (overlap > 0) {
                    dayNights += overlap;
                    dayRev += totalStayNights > 0 ? (netPayout / totalStayNights) * overlap : 0;
                    dayCount++;
                }
            });

            const dayOccPpt = totalCapacityNights > 0 ? (dayNights / totalCapacityNights) * 100 : 0;
            runningOccRate += dayOccPpt;
            runningNights += dayNights;

            // 유입이 있거나 주요 날짜인 경우 기록
            items.push({
                dateStr,
                label: `${m}/${d} (${dayName})`,
                dayNights,
                dayOccPpt,
                dayRev,
                cumulativeOccRate: Math.min(100, runningOccRate),
                cumulativeNights: runningNights,
                dayBookingsCount: dayCount,
            });

            cur.setDate(cur.getDate() + 1);
        }

        return items;
    }, [asOfDateStr, endDate, todayStr, paceSummary.preOccRate, paceSummary.preStayNights, matchingValidBookings, startDate, totalCapacityNights]);

    // 기준일 퀵 프리셋 핸들러
    const handleSetPreset = (type: 'start' | 'd7' | 'd30' | 'yesterday' | 'today') => {
        if (type === 'start') {
            setAsOfDateStr(startDate);
        } else if (type === 'd7') {
            const d = new Date(startDate);
            d.setDate(d.getDate() - 7);
            setAsOfDateStr(formatLocalDate(d));
        } else if (type === 'd30') {
            const d = new Date(startDate);
            d.setDate(d.getDate() - 30);
            setAsOfDateStr(formatLocalDate(d));
        } else if (type === 'yesterday') {
            setAsOfDateStr(yesterdayStr);
        } else if (type === 'today') {
            setAsOfDateStr(todayStr);
        }
    };

    // 하단 상세 목록 탭 모드: 'post' (기준일 이후 추가 유입) | 'pre' (기준일 이전 사전 확보)
    const [detailListTab, setDetailListTab] = useState<'post' | 'pre'>('post');

    // 최고 1일 유입 %p (바 차트 스케일링용)
    const maxDayOccPpt = useMemo(() => {
        const max = Math.max(...paceTimeline.map((p) => p.dayOccPpt), 1);
        return max;
    }, [paceTimeline]);

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
            {/* 1. 상단 헤더 & 기준 시점(As-of Date) 설정 툴바 */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-amber-500 flex items-center justify-center text-white text-lg shadow-sm shrink-0 mt-0.5">
                        📈
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                가동률 유입 페이스 & 사전 확보율 분석 (On-The-Books)
                            </h3>
                            <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 font-mono">
                                기준일: {asOfDateStr}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            선택 기간(
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {startDate} ~ {endDate}
                            </span>
                            , 총 {periodDays}일 · {totalCapacityNights}공급박)에 대해,{' '}
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                지정한 기준일({asOfDateLabel})
                            </span>
                            에 방이 얼마나 차있었고 그 이후 어떻게 추가로 차올랐는지 추적합니다.
                        </p>
                    </div>
                </div>

                {/* 지점/호실 태그 */}
                <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200/60 dark:border-slate-700/60">
                        🏢 {selectedProperty === 'all' ? '전체 지점' : selectedProperty} · {activeUnits.length}개 객실
                    </span>
                </div>
            </div>

            {/* 2. 🎯 기준 시점(As-of Date) 빠른 선택 컨트롤 바 */}
            <div className="bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 flex items-center gap-1.5">
                        <span>🎯 기준 시점 선택:</span>
                    </span>
                    <input
                        type="date"
                        value={asOfDateStr}
                        onChange={(e) => e.target.value && setAsOfDateStr(e.target.value)}
                        className="px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />
                </div>

                {/* 빠른 프리셋 버튼 모음 */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mr-1 hidden sm:inline">
                        원클릭 이동:
                    </span>
                    <button
                        onClick={() => handleSetPreset('start')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all shadow-2xs ${
                            asOfDateStr === startDate
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                        🚀 기간 시작일 ({startDate.slice(5)})
                    </button>
                    <button
                        onClick={() => handleSetPreset('d7')}
                        className="px-2.5 py-1 rounded-lg font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-2xs"
                    >
                        D-7일 전
                    </button>
                    <button
                        onClick={() => handleSetPreset('d30')}
                        className="px-2.5 py-1 rounded-lg font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-2xs"
                    >
                        D-30일 전
                    </button>
                    <button
                        onClick={() => handleSetPreset('yesterday')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all shadow-2xs ${
                            asOfDateStr === yesterdayStr
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                        어제
                    </button>
                    <button
                        onClick={() => handleSetPreset('today')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all shadow-2xs ${
                            asOfDateStr === todayStr
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                        오늘
                    </button>
                </div>
            </div>

            {/* 3. 3대 핵심 OTB & 유입 성과 카드 (시점 전/후 비교) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {/* 1) 기준일 시점 사전 확보 가동률 (OTB) */}
                <div className="bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/50 dark:from-blue-950/40 dark:via-slate-900 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-900/60 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-400 font-black mb-1">
                            <span className="flex items-center gap-1.5">
                                <span>📌 {asOfDateStr.slice(5)} 기준 사전 확보율 (OTB)</span>
                            </span>
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">
                                선확보
                            </span>
                        </div>
                        <div className="my-2">
                            <div className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight flex items-baseline gap-1">
                                <span>{paceSummary.preOccRate.toFixed(1)}</span>
                                <span className="text-lg font-bold">%</span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-blue-100 dark:border-blue-900/50 font-mono">
                        <div className="flex items-center justify-between">
                            <span>사전 판매 박수</span>
                            <span className="font-bold text-slate-900 dark:text-slate-200">
                                {paceSummary.preStayNights}박 / 총 {totalCapacityNights}박
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>사전 확보 매출</span>
                            <span className="font-bold text-slate-900 dark:text-slate-200">
                                ₩{Math.round(paceSummary.preRevenue).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2) 기준일 이후 추가 유입 (Pickup) */}
                <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/30 border border-emerald-200/80 dark:border-emerald-900/60 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-black mb-1">
                            <span className="flex items-center gap-1.5">
                                <span>📈 {asOfDateStr.slice(5)} 이후 추가 유입 가동률</span>
                            </span>
                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                                픽업 성과
                            </span>
                        </div>
                        <div className="my-2">
                            <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight flex items-baseline gap-1">
                                {paceSummary.postOccPpt > 0 ? (
                                    <>
                                        <span>+{paceSummary.postOccPpt.toFixed(1)}</span>
                                        <span className="text-lg font-bold">%p</span>
                                    </>
                                ) : (
                                    <span className="text-xl text-slate-400">0.0%p</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-emerald-100 dark:border-emerald-900/50 font-mono">
                        <div className="flex items-center justify-between">
                            <span>추가 유입 박수</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                +{paceSummary.postPickupNights}박 ({paceSummary.postBookings.length}건 체결)
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>추가 발생 매출</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                +₩{Math.round(paceSummary.postRevenue).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3) 최종 달성 가동률 (Final / Current) */}
                <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-slate-800/70 dark:via-slate-900 dark:to-indigo-950/20 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-black mb-1">
                            <span className="flex items-center gap-1.5">
                                <span>🏁 최종/현재 도달 가동률</span>
                            </span>
                            <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                                완주 결과
                            </span>
                        </div>
                        <div className="my-2">
                            <div className="text-3xl sm:text-4xl font-black text-indigo-700 dark:text-indigo-400 font-mono tracking-tight flex items-baseline gap-1">
                                <span>{paceSummary.finalOccRate.toFixed(1)}</span>
                                <span className="text-lg font-bold">%</span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 font-mono">
                        <div className="flex items-center justify-between">
                            <span>총 판매 박수</span>
                            <span className="font-bold text-slate-900 dark:text-slate-200">
                                {paceSummary.totalStayNights}박 (판매율 {paceSummary.finalOccRate.toFixed(1)}%)
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>총 순정산 매출</span>
                            <span className="font-bold text-slate-900 dark:text-slate-200">
                                ₩{Math.round(paceSummary.totalRevenue).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. 📊 기준일 이후 일별 누적 유입 추이 차트 (Pace Timeline Curve) */}
            <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>📊 일자별 가동률 유입 & 누적 증가 추이</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 font-mono font-bold">
                                {asOfDateStr.slice(5)} 이전 {paceSummary.preOccRate.toFixed(1)}% ➔ 최종 {paceSummary.finalOccRate.toFixed(1)}%
                            </span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            기준일({asOfDateStr}) 이후 매일매일 신규 예약이 들어올 때마다 가동률이 몇 %p씩 차올랐는지 보여줍니다.
                        </p>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 self-start sm:self-center">
                        <span className="flex items-center gap-1.5 font-medium">
                            <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block" />
                            일일 신규 유입 (+%p)
                        </span>
                        <span className="flex items-center gap-1.5 font-medium">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                            누적 가동률 (%)
                        </span>
                    </div>
                </div>

                {paceTimeline.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        기준일({asOfDateStr}) 이후 해당 기간으로 들어온 추가 예약이 없습니다.
                    </div>
                ) : (
                    <div className="overflow-x-auto pb-2">
                        <div className="min-w-[650px] space-y-3">
                            {/* 타임라인 바 차트 뷰 */}
                            <div className="grid gap-1.5 h-36 items-end pt-4 pb-1 px-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
                                style={{ gridTemplateColumns: `repeat(${paceTimeline.length}, minmax(0, 1fr))` }}
                            >
                                {paceTimeline.map((item) => {
                                    const heightPercent = Math.max(6, Math.min(100, (item.dayOccPpt / maxDayOccPpt) * 100));
                                    const isHotDay = item.dayOccPpt > 0;

                                    return (
                                        <div
                                            key={item.dateStr}
                                            className="flex flex-col items-center gap-1 h-full justify-end group relative"
                                            title={`${item.dateStr}: +${item.dayOccPpt.toFixed(1)}%p 유입 (+${item.dayNights}박 / ₩${Math.round(item.dayRev).toLocaleString()}) ➔ 누적 ${item.cumulativeOccRate.toFixed(1)}%`}
                                        >
                                            {/* 호버 시 툴팁 */}
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute -top-12 z-20 bg-slate-900 text-white text-[10px] font-mono rounded px-2 py-1 shadow-lg whitespace-nowrap">
                                                +{item.dayOccPpt.toFixed(1)}%p (+{item.dayNights}박)
                                                <div className="text-emerald-300 font-bold">
                                                    누적 {item.cumulativeOccRate.toFixed(1)}%
                                                </div>
                                            </div>

                                            {/* 바 상단: 증가폭 */}
                                            <span className={`text-[10px] font-mono font-bold leading-none ${isHotDay ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                                {item.dayOccPpt > 0 ? `+${item.dayOccPpt.toFixed(1)}` : '·'}
                                            </span>

                                            {/* 막대 */}
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-sm h-20 flex items-end overflow-hidden">
                                                <div
                                                    style={{ height: `${heightPercent}%` }}
                                                    className={`w-full rounded-t-sm transition-all duration-300 ${
                                                        isHotDay
                                                            ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 dark:from-indigo-500 dark:to-indigo-300 group-hover:from-rose-500 group-hover:to-amber-400'
                                                            : 'bg-slate-200 dark:bg-slate-700/40'
                                                    }`}
                                                />
                                            </div>

                                            {/* 누적 가동률 뱃지 */}
                                            <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 leading-none">
                                                {item.cumulativeOccRate.toFixed(0)}%
                                            </span>

                                            {/* 날짜 라벨 */}
                                            <span className="text-[9.5px] truncate text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                                                {item.label.slice(0, 5)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="text-[11px] text-slate-400 dark:text-slate-500 px-1 flex items-center justify-between">
                                <span>💡 막대 위: 해당 날짜의 일일 유입 증가폭(+%p) | 막대 아래 초록 뱃지: 당시 누적 가동률(%)</span>
                                <span>마우스를 올리면 상세 박수와 매출이 표시됩니다</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 5. 📋 세부 예약 목록 (사후 유입 건 vs 사전 확보 건 토글) */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setDetailListTab('post')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                detailListTab === 'post'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                        >
                            📈 기준일({asOfDateStr.slice(5)}) 이후 추가 유입된 예약 ({paceSummary.postBookings.length}건)
                        </button>
                        <button
                            onClick={() => setDetailListTab('pre')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                detailListTab === 'pre'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                        >
                            📌 기준일({asOfDateStr.slice(5)}) 이전 사전 확보 예약 ({paceSummary.preBookings.length}건)
                        </button>
                    </div>

                    <span className="text-xs text-slate-400 font-mono">
                        총 {detailListTab === 'post' ? paceSummary.postPickupNights : paceSummary.preStayNights}박 투숙 기여
                    </span>
                </div>

                {/* 테이블 렌더링 */}
                {((detailListTab === 'post' ? paceSummary.postBookings : paceSummary.preBookings).length === 0) ? (
                    <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                        해당 분류의 예약 내역이 없습니다.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/80">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="py-2.5 px-3">체결 일시</th>
                                    <th className="py-2.5 px-3">채널</th>
                                    <th className="py-2.5 px-3">객실 / 고객</th>
                                    <th className="py-2.5 px-3">투숙 일정</th>
                                    <th className="py-2.5 px-3 text-center">선택기간 기여</th>
                                    <th className="py-2.5 px-3 text-right">기여 순정산액</th>
                                    <th className="py-2.5 px-3 text-right">체결 ADR</th>
                                    <th className="py-2.5 px-3 text-center">상세</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(detailListTab === 'post' ? paceSummary.postBookings : paceSummary.preBookings).map((item) => {
                                    const b = item.booking;
                                    const unit = getUnitForBooking(b);
                                    const chStyle = getChannelStyle(b.apiSourceId);
                                    const adr = item.overlapNights > 0 ? item.proportionalRev / item.overlapNights : 0;
                                    const guestFullName = [b.lastName, b.firstName].filter(Boolean).join(' ') || '고객명 미기재';

                                    return (
                                        <tr
                                            key={b.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            {/* 체결 일시 */}
                                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                                {b.bookingTime ? b.bookingTime.slice(0, 16) : b.arrival}
                                            </td>

                                            {/* 채널 */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <span
                                                    className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                                                    style={{ backgroundColor: chStyle.bg, color: chStyle.text }}
                                                >
                                                    {chStyle.name}
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
