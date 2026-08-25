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
    isSyncing?: boolean;
    onOpenMobileMenu?: () => void;
    onOpenDailyModal: (type: 'today' | 'tomorrow') => void;
    onToggleViewMode: (mode: 'vertical' | 'horizontal') => void;
    onReload: () => Promise<void> | void;
    onSyncWithBeds24?: () => Promise<void> | void;
}

export default function DashboardHeader({
    userRole,
    todayCheckIns = [],
    todayCheckOuts = [],
    tomorrowCheckIns = [],
    tomorrowCheckOuts = [],
    viewMode = 'vertical',
    loading = false,
    isSyncing = false,
    onOpenMobileMenu,
    onOpenDailyModal,
    onToggleViewMode,
    onReload,
    onSyncWithBeds24,
}: DashboardHeaderProps) {
    const handleSyncClick = () => {
        if (onSyncWithBeds24) {
            onSyncWithBeds24();
        } else {
            onReload();
        }
    };

    const isBusy = loading || isSyncing;

    return (
        <header className="bg-white border-b border-gray-200 px-3 py-2 md:px-5 md:py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">

            {/* 1. 좌측: 모바일 햄버거 버튼 + 페이지 제목 */}
            <div className="flex items-center gap-2 md:gap-3">
                {/* 📱 모바일 사이드바 열기 햄버거 버튼 */}
                <button
                    type="button"
                    onClick={onOpenMobileMenu}
                    title="메뉴 열기"
                    className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-base font-black transition cursor-pointer border border-gray-200"
                >
                    ☰
                </button>

                <div className="flex items-center gap-1.5 text-gray-900 font-black text-sm md:text-base tracking-tight">
                    <span>🏨</span>
                    <span>예약 타임라인 대시보드</span>
                </div>
            </div>

            {/* 2. 우측: 오늘/내일 현황 버튼 & 세로/가로 뷰 전환 & 새로고침 */}
            <div className="flex items-center gap-2 flex-wrap">

                {/* 📋 오늘 현황 버튼 */}
                <button
                    type="button"
                    onClick={() => onOpenDailyModal('today')}
                    className="px-2.5 py-1 md:px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 rounded-xl transition flex flex-col items-start cursor-pointer shadow-2xs text-left"
                >
                    <span className="text-[10px] font-black tracking-tight text-blue-600">오늘 현황</span>
                    <span className="text-xs font-black flex items-center gap-1">
                        <span>입실 {todayCheckIns.length}</span>
                        <span className="text-blue-300">|</span>
                        <span>퇴실 {todayCheckOuts.length}</span>
                    </span>
                </button>

                {/* 📋 내일 현황 버튼 */}
                <button
                    type="button"
                    onClick={() => onOpenDailyModal('tomorrow')}
                    className="px-2.5 py-1 md:px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl transition flex flex-col items-start cursor-pointer shadow-2xs text-left"
                >
                    <span className="text-[10px] font-black tracking-tight text-slate-500">내일 현황</span>
                    <span className="text-xs font-black flex items-center gap-1">
                        <span>입실 {tomorrowCheckIns.length}</span>
                        <span className="text-slate-300">|</span>
                        <span>퇴실 {tomorrowCheckOuts.length}</span>
                    </span>
                </button>

                {/* 🔄 세로/가로 뷰 전환 토글 버튼 */}
                <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200">
                    <button
                        type="button"
                        onClick={() => onToggleViewMode('vertical')}
                        title="세로 달력 뷰 (시간이 아래로 흐름)"
                        className={`px-2 md:px-2.5 py-1 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            viewMode === 'vertical'
                                ? 'bg-white text-blue-600 shadow-2xs'
                                : 'text-gray-500 hover:text-gray-900'
                        }`}
                    >
                        <span>⬇️</span> <span className="hidden sm:inline">세로 뷰</span><span className="sm:hidden">세로</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onToggleViewMode('horizontal')}
                        title="가로 달력 뷰 (시간이 오른쪽으로 흐름)"
                        className={`px-2 md:px-2.5 py-1 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            viewMode === 'horizontal'
                                ? 'bg-white text-blue-600 shadow-2xs'
                                : 'text-gray-500 hover:text-gray-900'
                        }`}
                    >
                        <span>➡️</span> <span className="hidden sm:inline">가로 뷰</span><span className="sm:hidden">가로</span>
                    </button>
                </div>

                {/* 🔄 Beds24 실시간 강제 동기화 버튼 */}
                <button
                    type="button"
                    onClick={handleSyncClick}
                    disabled={isBusy}
                    className={`px-2.5 py-1.5 font-black text-xs rounded-xl border transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-2xs ${
                        isSyncing
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300'
                    }`}
                    title="Beds24 본사 최신 예약 실시간 동기화 & 정합성 일치화"
                >
                    <span className={isBusy ? 'animate-spin inline-block' : ''}>🔄</span>
                    <span className="hidden sm:inline">
                        {isSyncing ? 'Beds24 동기화 중...' : (loading ? '조회 중...' : '실시간 동기화')}
                    </span>
                    <span className="sm:hidden">
                        {isSyncing ? '동기화 중' : '동기화'}
                    </span>
                </button>
            </div>
        </header>
    );
}