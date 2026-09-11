'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import '../dashboard.css';
import { Booking } from '../types';
import { useAuth } from '../hooks/useAuth';
import AppSidebar from '../components/layout/AppSidebar';
import KpiSummaryCards from '../components/analytics/KpiSummaryCards';
import PropertyRevenueTable from '../components/analytics/PropertyRevenueTable';
import RoomRevenueTable from '../components/analytics/RoomRevenueTable';
import ChannelRevenueSection from '../components/analytics/ChannelRevenueSection';
import CountryRevenueSection from '../components/analytics/CountryRevenueSection';
import TrendComparisonCards from '../components/analytics/TrendComparisonCards';
import PeriodicBarChart from '../components/analytics/PeriodicBarChart';
import { useRealtimeBookings } from '../hooks/useRealtimeBookings';
import {
    TimeFilterRange,
    calculateOverallSummary,
    calculatePropertyStats,
    calculateRoomStats,
    getDateRangeByFilter,
} from '../utils/analyticsCalculations';
import {
    calculateTrendComparison,
    getWeeklyTimeSeries,
    getMonthlyTimeSeries,
} from '../utils/trendCalculations';

const FILTER_TABS: { key: TimeFilterRange; label: string }[] = [
    { key: 'last7', label: '최근 7일' },
    { key: 'last30', label: '최근 30일' },
    { key: 'thisMonth', label: '이번 달' },
    { key: 'next30', label: '향후 30일(OTB)' },
    { key: 'all', label: '전체 기간' },
];

export type AnalyticsViewTab = 'properties' | 'rooms' | 'channels' | 'countries';

export default function AnalyticsPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [timeFilter, setTimeFilter] = useState<TimeFilterRange>('last7');
    const [activeTab, setActiveTab] = useState<AnalyticsViewTab>('properties');

    // 🔒 권한 체크: 오직 최고관리자(admin)만 접근 가능
    const router = useRouter();
    const { isAdmin, loading: authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.replace('/');
        }
    }, [authLoading, isAdmin, router]);

    // 직접 날짜 선택을 위한 상태
    const initialRange = getDateRangeByFilter('last7');
    const [customStartDate, setCustomStartDate] = useState<string>(initialRange.start);
    const [customEndDate, setCustomEndDate] = useState<string>(initialRange.end);

    const isFetchingRef = useRef<boolean>(false);

    const fetchReservations = async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoading(true);
        try {
            const res = await fetch('/api/reservations?scope=analytics', { cache: 'no-store' });
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setBookings(data.data);
            }
        } catch (e) {
            console.error('예약 데이터 불러오기 실패:', e);
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    };

    useEffect(() => {
        fetchReservations();
    }, []);

    // 간편 탭 변경 핸들러
    const handleSelectPresetTab = (key: TimeFilterRange) => {
        setTimeFilter(key);
        const range = getDateRangeByFilter(key, undefined, undefined, bookings);
        setCustomStartDate(range.start);
        setCustomEndDate(range.end);
    };

    // 직접 시작일 변경
    const handleChangeStartDate = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCustomStartDate(val);
        setTimeFilter('custom');
    };

    // 직접 종료일 변경
    const handleChangeEndDate = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCustomEndDate(val);
        setTimeFilter('custom');
    };

    // 🧮 실시간 전체 요약 계산 (실제 투숙일 기준)
    const summary = useMemo(() => {
        return calculateOverallSummary(bookings, timeFilter, customStartDate, customEndDate, 'stay');
    }, [bookings, timeFilter, customStartDate, customEndDate]);

    // 🏢 실시간 숙소(건물)별 성과 계산 (실제 투숙일 기준)
    const propertyStats = useMemo(() => {
        return calculatePropertyStats(bookings, timeFilter, customStartDate, customEndDate, 'stay');
    }, [bookings, timeFilter, customStartDate, customEndDate]);

    // 🚪 실시간 객실(호실)별 성과 계산 (실제 투숙일 기준)
    const roomStats = useMemo(() => {
        return calculateRoomStats(bookings, timeFilter, customStartDate, customEndDate, 'stay');
    }, [bookings, timeFilter, customStartDate, customEndDate]);

    const activeRange = useMemo(() => {
        return getDateRangeByFilter(timeFilter, customStartDate, customEndDate, bookings);
    }, [timeFilter, customStartDate, customEndDate, bookings]);

    // ⚡ 실적 추이 비교 계산 (선택 기간 vs 직전 동기간 vs 전전 동기간 동적 연동)
    const trendComparison = useMemo(() => {
        return calculateTrendComparison(bookings, activeRange.start, activeRange.end);
    }, [bookings, activeRange.start, activeRange.end]);

    // 주간(최근 12주/3달) 시계열 버킷 계산
    const weeklyTimeSeries = useMemo(() => {
        return getWeeklyTimeSeries(bookings, 12);
    }, [bookings]);

    // 월간(최근 12개월/1년) 시계열 버킷 계산
    const monthlyTimeSeries = useMemo(() => {
        return getMonthlyTimeSeries(bookings, 12);
    }, [bookings]);

    // ⚡ 실시간 웹소켓 구독 (새 예약 발생 시 통계 데이터 즉각 갱신)
    const { isConnected: isRealtimeConnected } = useRealtimeBookings({
        enabled: true,
        onBookingChange: () => {
            fetchReservations();
        },
    });

    // 🔒 권한 검증 미통과 시 렌더링 차단
    if (!authLoading && !isAdmin) {
        return null;
    }

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* 🧭 크롬 스타일 접이식 사이드바 */}
            <AppSidebar
                isMobileOpen={isMobileSidebarOpen}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />

            {/* 메인 본문 컨텐츠 */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* 1. 상단 헤더 */}
                <header className="bg-white border-b border-gray-200 px-3 py-2 md:px-5 md:py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">
                    <div className="flex items-center gap-2.5">
                        {/* 📱 모바일 햄버거 버튼 */}
                        <button
                            type="button"
                            onClick={() => setIsMobileSidebarOpen(true)}
                            title="메뉴 열기"
                            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-base font-black transition cursor-pointer border border-gray-200"
                        >
                            ☰
                        </button>

                        <div className="flex items-center gap-2">
                            <span className="text-xl">📈</span>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <h1 className="text-sm md:text-base font-black text-gray-900 leading-tight">
                                        매출 및 수익 운영 관리
                                    </h1>
                                    {isRealtimeConnected && (
                                        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            실시간
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10.5px] text-gray-500 font-bold hidden sm:inline">
                                    실시간 수익 지표, 건물별/객실별/플랫폼별 성과 대시보드
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 실시간 새로고침 버튼 */}
                    <button
                        type="button"
                        onClick={fetchReservations}
                        disabled={loading}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs rounded-xl border border-gray-200 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                        <span className={loading ? 'animate-spin' : ''}>🔄</span>
                        <span className="hidden sm:inline">새로고침</span>
                    </button>
                </header>

                {/* 2. 메인 대시보드 본문 패널 */}
                <div className="p-2.5 md:p-4 flex-1 flex flex-col gap-3.5 max-w-7xl w-full mx-auto">
                    {/* 기간 선택 툴바 (프리셋 탭 + 직접 날짜 달력 선택) */}
                    <div className="bg-white p-2.5 px-3 md:px-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                        {/* 간편 프리셋 탭 */}
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200/80 overflow-x-auto max-w-full">
                            {FILTER_TABS.map((tab) => {
                                const isSelected = timeFilter === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => handleSelectPresetTab(tab.key)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                                            isSelected
                                                ? 'bg-white text-blue-700 shadow-2xs'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                        }`}
                                    >
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* 직접 날짜 선택 (달력 Input) */}
                        <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 p-1.5 px-2.5 rounded-xl border border-gray-200 text-xs font-bold">
                            <span className="text-gray-600 font-black">
                                조회 기간:
                            </span>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={handleChangeStartDate}
                                className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-black text-gray-800 cursor-pointer focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
                            />
                            <span className="text-gray-400 font-black">~</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={handleChangeEndDate}
                                className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-black text-gray-800 cursor-pointer focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
                            />
                            <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                {activeRange.days}일간
                            </span>
                        </div>
                    </div>

                    {/* 로딩 표시 */}
                    {loading && (
                        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-400 font-bold text-xs">
                            <span className="animate-spin inline-block mr-2">⏳</span>
                            실시간 예약 및 매출 데이터를 분석하고 있습니다...
                        </div>
                    )}

                    {!loading && (
                        <>
                            {/* 3. 전체 4대 핵심 KPI 요약 카드 (실제 투숙일 기준) */}
                            <KpiSummaryCards summary={summary} />

                            {/* 4. 추이 비교 위젯 */}
                            <TrendComparisonCards data={trendComparison} loading={loading} />

                            {/* 5. 매주 / 매월 비교 막대 그래프 (12주 / 12개월) */}
                            <PeriodicBarChart
                                weeklyData={weeklyTimeSeries}
                                monthlyData={monthlyTimeSeries}
                                loading={loading}
                            />

                            {/* 6. 3대 분석 기준 전환 탭 */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-xs flex flex-col gap-3">
                                <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200 self-start">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('properties')}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                                            activeTab === 'properties'
                                                ? 'bg-white text-blue-700 shadow-2xs'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <span>🏢</span>
                                        <span>건물별 매출</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('rooms')}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                                            activeTab === 'rooms'
                                                ? 'bg-white text-blue-700 shadow-2xs'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <span>🚪</span>
                                        <span>객실별 매출</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('channels')}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                                            activeTab === 'channels'
                                                ? 'bg-white text-blue-700 shadow-2xs'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <span>🍩</span>
                                        <span>플랫폼별 매출</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('countries')}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                                            activeTab === 'countries'
                                                ? 'bg-white text-purple-700 shadow-2xs'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <span>🌍</span>
                                        <span>국적별 비중</span>
                                    </button>
                                </div>

                                {/* 탭별 컨텐츠 자리 */}
                                {activeTab === 'properties' && (
                                    <PropertyRevenueTable propertyStats={propertyStats} />
                                )}

                                {activeTab === 'rooms' && (
                                    <RoomRevenueTable roomStats={roomStats} />
                                )}

                                {activeTab === 'channels' && (
                                    <ChannelRevenueSection
                                        bookings={bookings}
                                        timeFilter={timeFilter}
                                        customStartDate={customStartDate}
                                        customEndDate={customEndDate}
                                    />
                                )}

                                {activeTab === 'countries' && (
                                    <CountryRevenueSection
                                        bookings={bookings}
                                        timeFilter={timeFilter}
                                        customStartDate={customStartDate}
                                        customEndDate={customEndDate}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
