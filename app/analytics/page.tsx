'use client';

import React, { useState } from 'react';
import '../dashboard.css';
import AppSidebar from '../components/layout/AppSidebar';

export default function AnalyticsPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* 🧭 크롬 스타일 접이식 사이드바 */}
            <AppSidebar
                isMobileOpen={isMobileSidebarOpen}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />

            {/* 메인 본문 컨텐츠 */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="bg-white border-b border-gray-200 px-3 py-2 md:px-5 md:py-2.5 flex items-center justify-between shadow-xs shrink-0">
                    <div className="flex items-center gap-2.5">
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
                                <h1 className="text-sm md:text-base font-black text-gray-900 leading-tight">
                                    매출 및 수익 운영 관리
                                </h1>
                                <span className="text-[10.5px] text-gray-500 font-bold hidden sm:inline">
                                    건물별, 객실별, 플랫폼별 실시간 매출 분석
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="p-3 md:p-5 flex-1 flex flex-col gap-4 max-w-7xl w-full mx-auto">
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 text-gray-400 font-bold text-sm">
                        📊 매출 분석 시스템을 단계별로 구성 중입니다...
                    </div>
                </div>
            </div>
        </div>
    );
}
