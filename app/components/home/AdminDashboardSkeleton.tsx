'use client';

import React from 'react';

export default function AdminDashboardSkeleton() {
    return (
        <div className="flex flex-col gap-4 animate-pulse" aria-busy="true" aria-label="대시보드 데이터 로딩 중">
            {/* 기간 필터 스켈레톤 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-1.5">
                    <div className="h-7 w-16 rounded-lg bg-gray-200 dark:bg-slate-800" />
                    <div className="h-7 w-16 rounded-lg bg-gray-200 dark:bg-slate-800" />
                    <div className="h-7 w-20 rounded-lg bg-gray-200 dark:bg-slate-800" />
                </div>
                <div className="h-7 w-52 rounded-lg bg-gray-200 dark:bg-slate-800" />
            </div>

            {/* 4대 KPI 카드 스켈레톤 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-2.5"
                    >
                        <div className="flex items-center justify-between">
                            <div className="h-3.5 w-24 rounded bg-gray-200 dark:bg-slate-800" />
                            <div className="h-5 w-5 rounded-full bg-gray-200 dark:bg-slate-800" />
                        </div>
                        <div className="h-7 w-36 rounded bg-gray-200 dark:bg-slate-800" />
                        <div className="h-3 w-28 rounded bg-gray-100 dark:bg-slate-800/70" />
                    </div>
                ))}
            </div>

            {/* 건물별 매출 4카드 스켈레톤 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="h-4 w-48 rounded bg-gray-200 dark:bg-slate-800" />
                    <div className="h-3 w-24 rounded bg-gray-100 dark:bg-slate-800/70" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 flex flex-col gap-2"
                        >
                            <div className="flex items-center justify-between">
                                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-slate-700" />
                                <div className="h-3 w-12 rounded bg-gray-200 dark:bg-slate-700" />
                            </div>
                            <div className="h-6 w-28 rounded bg-gray-200 dark:bg-slate-700" />
                            <div className="h-3 w-36 rounded bg-gray-100 dark:bg-slate-700/60" />
                        </div>
                    ))}
                </div>
            </div>

            {/* 메인 2열 스켈레톤 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[0, 1].map((col) => (
                    <div
                        key={col}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3.5"
                    >
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
                            <div className="flex flex-col gap-1.5">
                                <div className="h-4 w-44 rounded bg-gray-200 dark:bg-slate-800" />
                                <div className="h-3 w-60 rounded bg-gray-100 dark:bg-slate-800/70" />
                            </div>
                            <div className="h-6 w-20 rounded-lg bg-gray-200 dark:bg-slate-800" />
                        </div>
                        <div className="flex flex-col gap-2.5">
                            {[0, 1, 2, 3].map((row) => (
                                <div
                                    key={row}
                                    className="h-14 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 p-3 flex flex-col justify-between"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="h-3.5 w-32 rounded bg-gray-200 dark:bg-slate-700" />
                                        <div className="h-3.5 w-20 rounded bg-gray-200 dark:bg-slate-700" />
                                    </div>
                                    <div className="h-2 w-full rounded bg-gray-200 dark:bg-slate-700" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* 리드타임 분포 스켈레톤 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3">
                <div className="h-4 w-52 rounded bg-gray-200 dark:bg-slate-800" />
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 flex flex-col gap-2"
                        >
                            <div className="h-3 w-16 rounded bg-gray-200 dark:bg-slate-700" />
                            <div className="h-5 w-20 rounded bg-gray-200 dark:bg-slate-700" />
                            <div className="h-1.5 w-full rounded bg-gray-200 dark:bg-slate-700" />
                        </div>
                    ))}
                </div>
            </div>

            {/* 일일 가동률 유입 차트 스켈레톤 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3">
                <div className="h-4 w-56 rounded bg-gray-200 dark:bg-slate-800" />
                <div className="h-36 rounded-xl bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800" />
            </div>
        </div>
    );
}
