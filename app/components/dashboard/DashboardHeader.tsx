'use client';

import React from 'react';
import Link from 'next/link';
import type { Booking } from '../../types';

export interface DashboardHeaderProps {
    userRole?: string | null;
    todayCheckIns: Booking[];
    todayCheckOuts: Booking[];
    tomorrowCheckIns: Booking[];
    tomorrowCheckOuts: Booking[];
    viewMode: 'vertical' | 'horizontal';
    loading: boolean;
    onOpenDailyModal: (type: 'today' | 'tomorrow') => void;
    onToggleViewMode: (mode: 'vertical' | 'horizontal') => void;
    onReload: () => Promise<void> | void;
}

export default function DashboardHeader({
    userRole,
    todayCheckIns = [],
    todayCheckOuts = [],
    tomorrowCheckIns = [],
    tomorrowCheckOuts = [],
    viewMode = 'vertical',
    loading = false,
    onOpenDailyModal,
    onToggleViewMode,
    onReload,
}: DashboardHeaderProps) {
    // 🔍 디버깅용: 헤더가 실제로 전달받은 userRole 출력
    console.log('🏠 [DashboardHeader] 현재 헤더가 인식한 userRole:', userRole);

    const handleLogout = async () => {
        if (!confirm('로그아웃 하시겠습니까?')) return;
        await fetch('/api/auth', { method: 'DELETE' });
        window.location.href = '/login';
    };

    return (
        <header className="bg-white border-b border-gray-200 px-3 py-2 md:px-6 md:py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">

            {/* 1. 좌측: 로고 & 권한별 네비게이션 */}
            <div className="flex items-center gap-2.5 md:gap-4 flex-wrap">
                <Link href="/" className="flex items-center gap-1.5 text-gray-900 font-black text-sm md:text-base tracking-tight shrink-0">
                    <span>🏨</span>
                    <span>숙소 예약 현황</span>
                </Link>

                <nav className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs font-black">
                    {/* 공통: 대시보드 */}
                    <Link
                        href="/"
                        className="px-2.5 py-1 rounded-md bg-white text-blue-600 shadow-2xs flex items-center gap-1"
                    >
                        <span>📊</span> 대시보드
                    </Link>

                    {/* 👑 최고관리자(admin)만 청소 배정 보임 */}
                    {userRole === 'admin' && (
                        <Link
                            href="/cleaning"
                            className="px-2.5 py-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 transition flex items-center gap-1"
                        >
                            <span>🧹</span> 청소 배정
                        </Link>
                    )}

                    {/* 🔑 최고관리자 & 매니저 공통 숙소/비번 관리 */}
                    {(userRole === 'admin' || userRole === 'manager') && (
                        <Link
                            href="/properties"
                            className="px-2.5 py-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 transition flex items-center gap-1"
                        >
                            <span>🔑</span> 숙소/비번
                        </Link>
                    )}
                </nav>
            </div>

            {/* 2. 우측: 줄바꿈 정돈된 오늘/내일 버튼 & 세로가로 뷰 & 새로고침 & 태그 뱃지 & 로그아웃 */}
            <div className="flex items-center gap-2 flex-wrap">

                {/* 📋 오늘 현황 버튼 */}
                <button
                    type="button"
                    onClick={() => onOpenDailyModal('today')}
                    className="px-3 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 rounded-xl transition flex flex-col items-start cursor-pointer shadow-2xs text-left"
                >
                    <span className="text-[10px] font-black text-blue-600">📋 오늘 현황</span>
                    <div className="text-xs font-black flex items-center gap-1.5 mt-0.5">
                        <span className="text-blue-700">입실 <strong>{todayCheckIns.length}</strong></span>
                        <span className="text-gray-300">/</span>
                        <span className="text-orange-600">퇴실 <strong>{todayCheckOuts.length}</strong></span>
                    </div>
                </button>

                {/* 📋 내일 현황 버튼 */}
                <button
                    type="button"
                    onClick={() => onOpenDailyModal('tomorrow')}
                    className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-xl transition flex flex-col items-start cursor-pointer shadow-2xs text-left"
                >
                    <span className="text-[10px] font-black text-indigo-600">📋 내일 현황</span>
                    <div className="text-xs font-black flex items-center gap-1.5 mt-0.5">
                        <span className="text-indigo-700">입실 <strong>{tomorrowCheckIns.length}</strong></span>
                        <span className="text-gray-300">/</span>
                        <span className="text-orange-600">퇴실 <strong>{tomorrowCheckOuts.length}</strong></span>
                    </div>
                </button>

                {/* 세로/가로 뷰 모드 토글 */}
                <button
                    type="button"
                    onClick={() => onToggleViewMode(viewMode === 'vertical' ? 'horizontal' : 'vertical')}
                    className="hidden md:flex items-center gap-1 px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
                    title="타임라인 보기 방식 변경"
                >
                    <span>{viewMode === 'vertical' ? '📑 세로뷰' : '📊 가로뷰'}</span>
                </button>

                {/* 🔄 최신 예약 새로고침 */}
                <button
                    type="button"
                    onClick={onReload}
                    disabled={loading}
                    className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition border border-gray-300 flex items-center gap-1 cursor-pointer"
                    title="최신 예약 불러오기"
                >
                    <span className={loading ? 'animate-spin' : ''}>🔄</span>
                    <span className="hidden sm:inline">새로고침</span>
                </button>

                {/* 🏷️ 권한 뱃지 (userRole 상태에 따라 명확히 표시) */}
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 inline-block shadow-2xs">
                    {userRole === 'admin'
                        ? '👑 최고관리자'
                        : userRole === 'manager'
                            ? '👔 매니저'
                            : userRole
                                ? `🧹 ${userRole}`
                                : '⏳ 권한 확인 중...'}
                </span>

                {/* 로그아웃 버튼 */}
                <button
                    type="button"
                    onClick={handleLogout}
                    className="text-xs font-bold text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition cursor-pointer"
                >
                    로그아웃
                </button>
            </div>

        </header>
    );
}