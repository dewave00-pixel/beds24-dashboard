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
    unallocatedCount?: number;
    viewMode: 'vertical' | 'horizontal';
    loading: boolean;
    isSyncing?: boolean;
    isRealtimeConnected?: boolean;
    onOpenMobileMenu?: () => void;
    onOpenDailyModal: (type: 'today' | 'tomorrow') => void;
    onOpenUnallocatedModal?: () => void;
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
    unallocatedCount = 0,
    viewMode = 'vertical',
    loading = false,
    isSyncing = false,
    isRealtimeConnected = false,
    onOpenMobileMenu,
    onOpenDailyModal,
    onOpenUnallocatedModal,
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
        <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-3 py-2 md:px-5 md:py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0 transition-colors duration-200">

            {/* 1. 좌측: 모바일 햄버거 버튼 + 페이지 제목 */}
            <div className="flex items-center gap-2 md:gap-3">
                {/* 📱 모바일 사이드바 열기 햄버거 버튼 */}
                <button
                    type="button"
                    onClick={onOpenMobileMenu}
                    title="메뉴 열기"
                    className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-base font-black transition cursor-pointer border border-gray-200 dark:border-slate-700"
                >
                    ☰
                </button>

                <div className="flex items-center gap-1.5 text-gray-900 dark:text-slate-100 font-black text-sm md:text-base tracking-tight">
                    <span>🏨</span>
                    <span>예약 타임라인 대시보드</span>
                    {isRealtimeConnected && (
                        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 ml-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            실시간
                        </span>
                    )}
                </div>
            </div>

            {/* 2. 우측: 오늘/내일 현황 버튼 & 세로/가로 뷰 전환 & 새로고침 */}
            <div className="flex items-center gap-2 flex-wrap">

                {/* 📋 오늘 현황 버튼 */}
                <button
                    type="button"
                    onClick={() => onOpenDailyModal('today')}
                    className="px-2.5 py-1 md:px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 rounded-xl transition flex flex-col items-start cursor-pointer shadow-2xs text-left"
                >
                    <span className="text-[10px] font-black tracking-tight text-blue-600 dark:text-blue-400">오늘 현황</span>
                    <span className="text-xs font-black flex items-center gap-1">
                        <span>체크인 {todayCheckIns.length}</span>
                        <span className="text-blue-300 dark:text-blue-700">|</span>
                        <span>체크아웃 {todayCheckOuts.length}</span>
                    </span>
                </button>

                {/* 📋 내일 현황 버튼 */}
                <button
                    type="button"
                    onClick={() => onOpenDailyModal('tomorrow')}
                    className="px-2.5 py-1 md:px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl transition flex flex-col items-start cursor-pointer shadow-2xs text-left"
                >
                    <span className="text-[10px] font-black tracking-tight text-slate-500 dark:text-slate-400">내일 현황</span>
                    <span className="text-xs font-black flex items-center gap-1">
                        <span>체크인 {tomorrowCheckIns.length}</span>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span>체크아웃 {tomorrowCheckOuts.length}</span>
                    </span>
                </button>

                {/* ⚠️ 미배정 예약 알림 버튼 (미배정이 1건 이상일 때만 표시) */}
                {unallocatedCount > 0 && (
                    <button
                        type="button"
                        onClick={onOpenUnallocatedModal}
                        title="호실 미배정 예약 목록 열기"
                        className="px-2.5 py-1 md:px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border-2 border-amber-400 dark:border-amber-500 text-amber-950 dark:text-amber-200 rounded-xl transition flex flex-col items-start cursor-pointer shadow-sm animate-pulse text-left"
                    >
                        <span className="text-[10px] font-black tracking-tight text-amber-700 dark:text-amber-400 flex items-center gap-0.5">
                            <span>⚠️</span> 호실 미배정
                        </span>
                        <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                            {unallocatedCount}건 배정 필요
                        </span>
                    </button>
                )}

                {/* 🔄 세로/가로 뷰 전환 토글 버튼 */}
                <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={() => onToggleViewMode('vertical')}
                        title="세로 달력 뷰 (시간이 아래로 흐름)"
                        className={`px-2 md:px-2.5 py-1 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            viewMode === 'vertical'
                                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-2xs'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
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
                                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-2xs'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
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
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                            : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 border-gray-300 dark:border-slate-700'
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