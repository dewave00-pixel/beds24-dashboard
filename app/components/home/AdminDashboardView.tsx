'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Booking, InventoryIssueItem } from '../../types';
import { ALL_UNITS } from '../../config';
import { useRealtimeBookings } from '../../hooks/useRealtimeBookings';
import { useOtaAdCosts } from '../../hooks/useOtaAdCosts';
import { addDaysToDateStr, getKSTTodayStr } from '../../utils/dateUtils';
import {
    getBookedUnitDateSet,
    getUnitsByRoomIdMap,
    getVacantUnitInventoryStatus,
    isRevenueBooking,
    isValidBooking,
} from '../../utils/bookingUtils';
import { getCleaningHistoryDates, getUnitCleaningStatus } from '../../utils/cleaningStatus';
import {
    calculateOverallSummary,
    calculateLeadTimeAndStayStats,
    calculatePropertyStats,
    formatLocalDate,
} from '../../utils/analyticsCalculations';
import {
    calculateAdSpendBreakdown,
    calculateRevenueAfterAdSpend,
} from '../../utils/adCostCalculations';
import AppSidebar from '../layout/AppSidebar';
import DailyPickupReportSection from '../analytics/DailyPickupReportSection';
import InventoryIssuesModal from '../modals/InventoryIssuesModal';
import AdminDashboardSkeleton from './AdminDashboardSkeleton';
import TodayPlatformBookingsCard from './TodayPlatformBookingsCard';
import TodaySpecialsCard, { BookingNotesMap, GuestArrivalDetailSummary } from './TodaySpecialsCard';

const PROPERTY_BADGE_MAP: Record<string, { label: string; badgeClass: string }> = {
    WAVE: { label: '웨이브 (WAVE)', badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300' },
    YEONNAM: { label: '연남 (YEONNAM)', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
    Green: { label: '그린 (Green)', badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
    Horang: { label: '호랑 (Horang)', badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' },
};

type QuickPeriod = 'this_month' | 'last_month' | 'last_30_days';

function getKstMonthRange(offsetMonths: number): { start: string; end: string } {
    const todayStr = getKSTTodayStr();
    const [y, m] = todayStr.split('-').map(Number);
    const first = new Date(y, m - 1 + offsetMonths, 1);
    const last = new Date(y, m + offsetMonths, 0);
    return {
        start: formatLocalDate(first),
        end: formatLocalDate(last),
    };
}

function getKstLast30DaysRange(): { start: string; end: string } {
    const todayStr = getKSTTodayStr();
    const [y, m, d] = todayStr.split('-').map(Number);
    const startObj = new Date(y, m - 1, d - 29);
    return {
        start: formatLocalDate(startObj),
        end: todayStr,
    };
}

export default function AdminDashboardView() {
    const router = useRouter();
    const todayStr = useMemo(() => getKSTTodayStr(), []);
    const initialRange = useMemo(() => getKstMonthRange(0), []);

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [bookingNotes, setBookingNotes] = useState<BookingNotesMap>({});
    const [arrivalDetailsMap, setArrivalDetailsMap] = useState<Record<number, GuestArrivalDetailSummary>>({});
    const [todayAssignments, setTodayAssignments] = useState<Record<string, unknown>>({});
    const [todayCleaningHistory, setTodayCleaningHistory] = useState<
        Record<string, Record<string, { isCompleted?: boolean; staffName?: string; completedAt?: string }>>
    >({});
    const [inventoryMap, setInventoryMap] = useState<Record<string, { numAvail: number; price: number }>>({});
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [isCleaningLoading, setIsCleaningLoading] = useState<boolean>(true);
    const [isInventoryLoading, setIsInventoryLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('this_month');
    const [startDate, setStartDate] = useState<string>(initialRange.start);
    const [endDate, setEndDate] = useState<string>(initialRange.end);

    const adCosts = useOtaAdCosts(startDate, endDate);
    const isFetchingRef = useRef<boolean>(false);

    const fetchDashboardData = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoading(true);
        setIsCleaningLoading(true);
        setIsInventoryLoading(true);
        setError(null);

        try {
            const [resRes, notesRes, checkinRes, calendarRes] = await Promise.all([
                fetch('/api/reservations?scope=home', { cache: 'no-store' }),
                fetch('/api/notes', { cache: 'no-store' }),
                fetch(`/api/checkin/logs?arrivalDate=${todayStr}`, { cache: 'no-store' }),
                fetch(`/api/beds24/calendar?startDate=${todayStr}&days=30`, { cache: 'no-store' }),
            ]);

            const [resData, notesData, checkinData, calendarData] = await Promise.all([
                resRes.json(),
                notesRes.json(),
                checkinRes.json().catch(() => ({ success: false })),
                calendarRes.json().catch(() => ({ success: false })),
            ]);

            let loadedBookings: Booking[] = [];
            if (resData.success && Array.isArray(resData.data)) {
                loadedBookings = resData.data;
                setBookings(loadedBookings);
            } else {
                setError(resData.error || '예약 데이터를 불러오지 못했습니다.');
            }

            if (notesData.success && notesData.data) {
                setBookingNotes(notesData.data);
            }

            if (checkinData.success && Array.isArray(checkinData.todayArrivalsList)) {
                const map: Record<number, GuestArrivalDetailSummary> = {};
                for (const item of checkinData.todayArrivalsList) {
                    if (item?.bookingId && item.arrivalDetails) {
                        map[Number(item.bookingId)] = item.arrivalDetails;
                    }
                }
                setArrivalDetailsMap(map);
            }

            if (calendarData.success && calendarData.data) {
                setInventoryMap(calendarData.data);
            }
            setIsInventoryLoading(false);

            // 예약 데이터를 바탕으로 오늘 청소 미배정 계산용 이력/배정 조회
            const activeList = loadedBookings.filter((b) => isValidBooking(b));
            const historyDates = getCleaningHistoryDates(ALL_UNITS, todayStr, activeList);
            const assignUrl = historyDates.length > 0
                ? `/api/assignments?targetDate=${todayStr}&historyDates=${encodeURIComponent(historyDates.join(','))}`
                : `/api/assignments?targetDate=${todayStr}`;
            const assignRes = await fetch(assignUrl, { cache: 'no-store' });
            const assignData = await assignRes.json().catch(() => ({ success: false }));
            if (assignData.success) {
                setTodayAssignments(assignData.data || {});
                setTodayCleaningHistory(assignData.history || {});
            }
            setIsCleaningLoading(false);
        } catch (err) {
            console.error('대시보드 데이터 로딩 실패:', err);
            setError('대시보드 데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
            setIsCleaningLoading(false);
            setIsInventoryLoading(false);
            isFetchingRef.current = false;
        }
    }, [todayStr]);

    useEffect(() => {
        const timer = setTimeout(() => {
            void fetchDashboardData();
        }, 0);
        return () => clearTimeout(timer);
    }, [fetchDashboardData]);

    const { isConnected: isRealtimeConnected } = useRealtimeBookings({
        enabled: true,
        onBookingChange: () => {
            fetchDashboardData();
        },
    });

    const handleSelectQuickPeriod = (period: QuickPeriod) => {
        setQuickPeriod(period);
        if (period === 'this_month') {
            const r = getKstMonthRange(0);
            setStartDate(r.start);
            setEndDate(r.end);
        } else if (period === 'last_month') {
            const r = getKstMonthRange(-1);
            setStartDate(r.start);
            setEndDate(r.end);
        } else {
            const r = getKstLast30DaysRange();
            setStartDate(r.start);
            setEndDate(r.end);
        }
    };

    // 매출/통계용 유효 예약(무료 취소 제외, 위약금 취소 포함)
    const revenueBookings = useMemo(() => bookings.filter((b) => isRevenueBooking(b)), [bookings]);

    const overallSummary = useMemo(
        () => calculateOverallSummary(revenueBookings, 'custom', startDate, endDate, 'stay', 'all', 'all'),
        [revenueBookings, startDate, endDate]
    );

    const adSpendBreakdown = useMemo(
        () => calculateAdSpendBreakdown(adCosts.charges, startDate, endDate),
        [adCosts.charges, startDate, endDate]
    );

    const netRevenueAfterAd = useMemo(
        () => calculateRevenueAfterAdSpend(overallSummary.totalRevenue, adSpendBreakdown.settlementDeductedSpend),
        [overallSummary.totalRevenue, adSpendBreakdown.settlementDeductedSpend]
    );

    const totalAvailableNights = ALL_UNITS.length * overallSummary.periodDays;
    const revPar = Math.round((overallSummary.adr * overallSummary.occupancyRate) / 100);

    // 건물별 매출 통계
    const propertyStats = useMemo(
        () => calculatePropertyStats(revenueBookings, 'custom', startDate, endDate, 'stay'),
        [revenueBookings, startDate, endDate]
    );

    // 활성 예약만 추출 (청소 미배정 & 재고 점검용)
    const activeBookings = useMemo(() => bookings.filter((b) => isValidBooking(b)), [bookings]);

    const unassignedCleaningCount = useMemo(() => {
        if (loading || isCleaningLoading || bookings.length === 0) return 0;
        return ALL_UNITS.filter((unit) => {
            const status = getUnitCleaningStatus(unit, todayStr, activeBookings, todayCleaningHistory);
            return status.needsCleaning && !todayAssignments[unit.key];
        }).length;
    }, [loading, isCleaningLoading, bookings.length, activeBookings, todayStr, todayCleaningHistory, todayAssignments]);

    const bookedUnitDateSet = useMemo(() => getBookedUnitDateSet(activeBookings, ALL_UNITS), [activeBookings]);
    const unitsByRoomId = useMemo(() => getUnitsByRoomIdMap(ALL_UNITS), []);

    const inventoryIssues = useMemo<InventoryIssueItem[]>(() => {
        if (loading || isInventoryLoading || bookings.length === 0 || !inventoryMap || Object.keys(inventoryMap).length === 0) return [];
        const list: InventoryIssueItem[] = [];
        for (let i = 0; i < 30; i++) {
            const dStr = addDaysToDateStr(todayStr, i);
            for (const unit of ALL_UNITS) {
                if (bookedUnitDateSet.has(`${unit.key}_${dStr}`)) continue;
                const inv = inventoryMap[`${unit.roomId}_${dStr}`];
                if (!inv) continue;
                const status = getVacantUnitInventoryStatus(unit, dStr, bookedUnitDateSet, unitsByRoomId, inv);
                if (status.isOverbooked || status.isClosed) {
                    list.push({
                        id: `${unit.key}_${dStr}`,
                        dateStr: dStr,
                        unitKey: unit.key,
                        propName: unit.propName || '',
                        displayName: unit.displayName,
                        subName: unit.subName,
                        roomId: unit.roomId,
                        unitId: unit.unitId,
                        themeClass: unit.themeClass || '',
                        numAvail: inv.numAvail,
                        price: inv.price,
                        issueType: status.isOverbooked ? 'overbooked' : (inv.numAvail === 0 ? 'zero_inventory' : 'reduced_inventory'),
                        vacantIndex: status.vacantIndex,
                        vacantCount: status.vacantCount,
                        totalUnits: status.totalUnits,
                    });
                }
            }
        }
        return list;
    }, [loading, isInventoryLoading, bookings.length, inventoryMap, todayStr, bookedUnitDateSet, unitsByRoomId]);

    const leadTimeStats = useMemo(
        () => calculateLeadTimeAndStayStats(revenueBookings, 'custom', startDate, endDate, 'all', 'all'),
        [revenueBookings, startDate, endDate]
    );

    const lastMinuteShare = leadTimeStats.leadDistribution[0]?.sharePct || 0;

    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-slate-950 transition-colors duration-200">
            <AppSidebar
                isMobileOpen={isMobileSidebarOpen}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col min-w-0">
                {/* 1. 상단 헤더 */}
                <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-3 py-2.5 md:px-5 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setIsMobileSidebarOpen(true)}
                            title="메뉴 열기"
                            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-base font-bold transition cursor-pointer border border-gray-200 dark:border-slate-700"
                        >
                            ☰
                        </button>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm md:text-base font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
                                    숙소 운영 대시보드
                                </h1>
                                {isRealtimeConnected && (
                                    <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        실시간
                                    </span>
                                )}
                            </div>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium hidden sm:inline">
                                매출 · 당일 유입 · 리드타임 · 오늘 입퇴실 특이사항 종합 현황
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-2">
                        <Link
                            href="/schedule"
                            className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-xl border border-blue-200 dark:border-blue-800 transition flex items-center gap-1"
                        >
                            <span>📅</span>
                            <span>스케줄 달력</span>
                        </Link>
                        <Link
                            href="/analytics"
                            className="hidden sm:flex px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition items-center gap-1"
                        >
                            <span>📈</span>
                            <span>상세 통계</span>
                        </Link>
                        <button
                            type="button"
                            onClick={fetchDashboardData}
                            disabled={loading}
                            className="px-2.5 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-gray-200 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                            <span className={loading ? 'animate-spin' : ''}>↻</span>
                            <span className="hidden sm:inline">새로고침</span>
                        </button>
                    </div>
                </header>

                {/* 상단 슬림 로딩 프로그레스 바 */}
                {(loading || isCleaningLoading || isInventoryLoading) && (
                    <div className="w-full h-1 bg-blue-100 dark:bg-slate-800 overflow-hidden shrink-0" role="progressbar" aria-label="데이터 불러오는 중">
                        <div className="h-full w-1/2 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 animate-pulse rounded-r-full" />
                    </div>
                )}

                <main className="p-3 md:p-5 flex-1 flex flex-col gap-4 max-w-[1600px] w-full mx-auto">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold">
                            🚨 {error}
                        </div>
                    )}

                    {loading && bookings.length === 0 ? (
                        <AdminDashboardSkeleton />
                    ) : (
                        <>

                    {/* 2. 기간 필터 바 */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {(
                                [
                                    { key: 'this_month', label: '이번 달' },
                                    { key: 'last_month', label: '지난 달' },
                                    { key: 'last_30_days', label: '최근 30일' },
                                ] as { key: QuickPeriod; label: string }[]
                            ).map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => handleSelectQuickPeriod(item.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer border ${
                                        quickPeriod === item.key
                                            ? 'bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900 border-gray-900 dark:border-slate-100'
                                            : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-slate-300">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 font-mono text-xs"
                            />
                            <span>~</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 font-mono text-xs"
                            />
                        </div>
                    </div>

                    {/* 3. 핵심 KPI 4대 카드 (총매출 · 가동률 · ADR · 리드타임) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* 총매출 */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                                    총매출 (정산 예정액)
                                </span>
                                <span className="text-base">💰</span>
                            </div>
                            <div className="text-xl md:text-2xl font-black text-gray-900 dark:text-slate-100 font-mono">
                                {loading ? '...' : `${overallSummary.totalRevenue.toLocaleString()}원`}
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-slate-400">
                                <span>광고비 차감 후</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                                    {netRevenueAfterAd.toLocaleString()}원
                                </span>
                            </div>
                        </div>

                        {/* 가동률 */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                                    기간 가동률
                                </span>
                                <span className="text-base">🏨</span>
                            </div>
                            <div className="text-xl md:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                                {loading ? '...' : `${overallSummary.occupancyRate}%`}
                            </div>
                            <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 font-mono">
                                판매 {overallSummary.totalNights}박 / 전체 {totalAvailableNights}박
                            </div>
                        </div>

                        {/* ADR */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                                    평균 객실 단가 (ADR)
                                </span>
                                <span className="text-base">🏷️</span>
                            </div>
                            <div className="text-xl md:text-2xl font-black text-gray-900 dark:text-slate-100 font-mono">
                                {loading ? '...' : `${overallSummary.adr.toLocaleString()}원`}
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-slate-400 font-mono">
                                <span>RevPAR</span>
                                <span>{revPar.toLocaleString()}원</span>
                            </div>
                        </div>

                        {/* 리드타임 */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                                    평균 리드타임 / 투숙
                                </span>
                                <span className="text-base">⏱️</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl md:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                    {loading ? '...' : `${leadTimeStats.avgLeadDays}일 전`}
                                </span>
                                <span className="text-xs font-bold text-gray-500 dark:text-slate-400 font-mono">
                                    (평균 {leadTimeStats.avgStayNights}박)
                                </span>
                            </div>
                            <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                                중앙값 {leadTimeStats.medianLeadDays}일 · 당일/직전 {lastMinuteShare}%
                            </div>
                        </div>
                    </div>

                    {/* 3-1. 건물별 매출 요약 */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-base">🏢</span>
                                <h3 className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                                    건물별 매출 현황 ({startDate} ~ {endDate})
                                </h3>
                            </div>
                            <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                                체크아웃 정산 기준
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {propertyStats.map((prop) => {
                                const badge = PROPERTY_BADGE_MAP[prop.propName] || {
                                    label: prop.propName,
                                    badgeClass: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200',
                                };
                                return (
                                    <div
                                        key={prop.propName}
                                        className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 flex flex-col gap-1.5"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${badge.badgeClass}`}>
                                                {badge.label}
                                            </span>
                                            <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 font-mono">
                                                비중 {prop.revenueShare}%
                                            </span>
                                        </div>
                                        <div className="text-lg font-black text-gray-900 dark:text-slate-100 font-mono">
                                            {loading ? '...' : `${prop.totalRevenue.toLocaleString()}원`}
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-slate-400 font-mono">
                                            <span>가동률 {prop.occupancyRate}%</span>
                                            <span>ADR {prop.adr.toLocaleString()}원</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 4. 메인 2열: 플랫폼별 당일 예약 현황 + 오늘 체크인/체크아웃 특이사항(취소 포함) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <TodayPlatformBookingsCard todayStr={todayStr} bookings={revenueBookings} />
                        <TodaySpecialsCard
                            todayStr={todayStr}
                            bookings={bookings}
                            bookingNotes={bookingNotes}
                            arrivalDetailsMap={arrivalDetailsMap}
                            unassignedCleaningCount={unassignedCleaningCount}
                            isCleaningLoading={loading || isCleaningLoading}
                            inventoryIssueCount={inventoryIssues.length}
                            isInventoryLoading={loading || isInventoryLoading}
                            hasOverbooking={inventoryIssues.some((i) => i.issueType === 'overbooked')}
                            onOpenInventoryModal={() => setIsInventoryModalOpen(true)}
                        />
                    </div>

                    {/* 5. 리드타임 분포 요약 바 */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-base">⏳</span>
                                <h3 className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                                    예약 리드타임 분포 ({startDate} ~ {endDate})
                                </h3>
                            </div>
                            <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                                분석 모수 {leadTimeStats.totalBookings}건 · 평균 투숙 {leadTimeStats.avgStayNights}박
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                            {leadTimeStats.leadDistribution.map((bucket) => (
                                <div
                                    key={bucket.label}
                                    className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 flex flex-col gap-1"
                                >
                                    <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                                        {bucket.label}
                                    </span>
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-base font-black text-gray-900 dark:text-slate-100 font-mono">
                                            {bucket.count}건
                                        </span>
                                        <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                                            {bucket.sharePct}%
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full"
                                            style={{ width: `${bucket.sharePct}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 6. 일일 예약 유입 (Pick-up) 및 취소 하락 차트 (하단 세부 표 제외) */}
                    <DailyPickupReportSection
                        bookings={revenueBookings}
                        allBookingsWithCancelled={bookings}
                        startDate={startDate}
                        endDate={endDate}
                        currentOccupancyRate={overallSummary.occupancyRate}
                        hideDetailTable={true}
                    />
                        </>
                    )}
                </main>
            </div>

            <InventoryIssuesModal
                isOpen={isInventoryModalOpen}
                issues={inventoryIssues}
                onClose={() => setIsInventoryModalOpen(false)}
                onSelectDate={() => {
                    setIsInventoryModalOpen(false);
                    router.push('/schedule');
                }}
            />
        </div>
    );
}
