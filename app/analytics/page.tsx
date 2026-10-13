'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import '../dashboard.css';
import { Booking } from '../types';
import { useAuth } from '../hooks/useAuth';
import AppSidebar from '../components/layout/AppSidebar';
import { useRealtimeBookings } from '../hooks/useRealtimeBookings';

// 통합 분석 대시보드 컴포넌트 임포트
import PricingRoomsTab from '../components/analytics/PricingRoomsTab';

export default function AnalyticsPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // 🔒 권한 체크: 최고관리자(admin) 전용
    const router = useRouter();
    const { isAdmin, loading: authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.replace('/');
        }
    }, [authLoading, isAdmin, router]);

    const isFetchingRef = useRef<boolean>(false);

    // 예약 데이터 조회
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

    // 실시간 예약 웹소켓 구독
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
        <div className="flex min-h-screen bg-gray-100 dark:bg-slate-950">
            {/* 접이식 사이드바 */}
            <AppSidebar
                isMobileOpen={isMobileSidebarOpen}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />

            {/* 메인 본문 컨텐츠 */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* 1. 상단 헤더 */}
                <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-3 py-2 md:px-5 md:py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">
                    <div className="flex items-center gap-2.5">
                        {/* 모바일 햄버거 버튼 */}
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
                                <h1 className="text-sm md:text-base font-bold text-gray-900 dark:text-slate-100 leading-tight">
                                    매출 및 수익 운영 관리
                                </h1>
                                {isRealtimeConnected && (
                                    <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        실시간
                                    </span>
                                )}
                            </div>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium hidden sm:inline">
                                숙박 성과 및 채널별 예약 유입 분석
                            </span>
                        </div>
                    </div>

                    {/* 새로고침 버튼 */}
                    <button
                        type="button"
                        onClick={fetchReservations}
                        disabled={loading}
                        className="px-2.5 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-gray-200 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                        <span className={loading ? 'animate-spin' : ''}>↻</span>
                        <span className="hidden sm:inline">새로고침</span>
                    </button>
                </header>

                {/* 2. 대시보드 본문 */}
                <div className="p-2.5 md:p-4 flex-1 flex flex-col gap-3 max-w-7xl w-full mx-auto">
                    {/* 로딩 표시 */}
                    {loading && (
                        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-gray-200 dark:border-slate-800 text-center text-gray-400 dark:text-slate-500 font-bold text-xs">
                            실시간 예약 및 매출 데이터를 불러오고 있습니다...
                        </div>
                    )}

                    {/* 통합 분석 대시보드 (매출, 비교, 채널 점유율, 광고 분석, 공실 레이더, 국적 분석, 성과표) */}
                    {!loading && (
                        <div className="w-full transition-all duration-200">
                            <PricingRoomsTab bookings={bookings} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
