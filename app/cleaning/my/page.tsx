'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { useCleaningBoard, DEFAULT_STAFF_MAP } from '../../hooks/useCleaningBoard';
import { ALL_UNITS } from '../../config';
import CleaningGroupGrid from '../../components/cleaning/CleaningGroupGrid';
import AppSidebar from '../../components/layout/AppSidebar';
import '../../dashboard.css';

export default function MyCleaningPage() {
    const auth = useAuth();
    const c = useCleaningBoard();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

    // 현재 스태프 슬롯 이름 (예: manager -> '소영매니저님')
    const currentSlotName = auth.role === 'manager' || auth.role === 'staff_1'
        ? (c.staffMap['manager'] || DEFAULT_STAFF_MAP['manager'] || '소영매니저님')
        : (auth.role ? (c.staffMap[auth.role] || DEFAULT_STAFF_MAP[auth.role]) : null);

    // 내게 배정된 호실 목록 (슬롯 ID 및 슬롯 이름 이중 매칭 + 매니저 staff_1 호환)
    const myAssignedUnits = auth.role
        ? ALL_UNITS.filter(unit => {
            const assignment = c.assignments[unit.key];
            if (!assignment) return false;

            if (auth.role === 'manager' || auth.role === 'staff_1') {
                const isManagerIdMatch = assignment.staffId === 'manager' || assignment.staffId === 'staff_1';
                const isNameMatch = currentSlotName ? assignment.staffName === currentSlotName : false;
                return isManagerIdMatch || isNameMatch;
            }

            const isIdMatch = assignment.staffId === auth.role;
            const isNameMatch = currentSlotName ? assignment.staffName === currentSlotName : false;
            return isIdMatch || isNameMatch;
        })
        : [];

    const myCompletedCount = myAssignedUnits.filter(unit => {
        return c.assignments[unit.key]?.isCompleted;
    }).length;

    // 날짜 변경 함수
    const handleShiftDate = (offsetDays: number) => {
        const d = new Date(c.selectedDate || c.todayStr);
        d.setDate(d.getDate() + offsetDays);
        c.setSelectedDate(d.toISOString().split('T')[0]);
    };

    const handleSetToday = () => {
        c.setSelectedDate(c.todayStr);
    };

    const handleLogout = async () => {
        if (!confirm('로그아웃 하시겠습니까?')) return;
        await fetch('/api/auth', { method: 'DELETE' });
        window.location.href = '/login';
    };

    if (auth.loading || c.loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-sm font-bold text-gray-500 flex items-center gap-2">
                    <span className="animate-spin text-lg">⏳</span>
                    <span>청소 배정 데이터를 불러오는 중입니다...</span>
                </div>
            </div>
        );
    }

    // 매니저, 최고관리자, 또는 스태프 계정만 접근 허용
    if (!auth.canViewMyCleaning && !auth.isAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center font-bold text-red-500 flex flex-col gap-3">
                    <p>청소 담당자 권한으로 로그인해야 접근할 수 있습니다.</p>
                    <button onClick={() => window.location.href = '/'} className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer">대시보드로 돌아가기</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* 🧭 크롬 스타일 접이식 사이드바 */}
            <AppSidebar
                isMobileOpen={isMobileSidebarOpen}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />

            {/* 우측 메인 영역 */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* 1. 상단 헤더 */}
                <header className="bg-white border-b border-gray-200 px-3 py-2 md:px-5 md:py-2.5 flex items-center justify-between shadow-xs shrink-0">
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
                            <span className="text-xl">🧹</span>
                            <div>
                                <h1 className="text-sm md:text-base font-black text-gray-900 leading-tight flex items-center gap-1.5 flex-wrap">
                                    <span>나의 청소 배정 목록</span>
                                    {currentSlotName && (
                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                            {currentSlotName}
                                        </span>
                                    )}
                                </h1>
                                <span className="text-[10.5px] text-gray-500 font-bold hidden sm:inline">
                                    {c.selectedDate} 기준 (배정 {myAssignedUnits.length}곳 / 완료 {myCompletedCount}곳)
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="p-2 md:p-3 flex-1 flex flex-col gap-3">
                <div className="bg-white p-2.5 px-3 rounded-xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => handleShiftDate(-1)}
                            className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black transition cursor-pointer"
                        >
                            ◀ 이전날
                        </button>
                        <button
                            type="button"
                            onClick={handleSetToday}
                            className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${c.selectedDate === c.todayStr
                                ? 'bg-slate-900 text-white shadow-2xs'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                        >
                            오늘 ({c.todayStr})
                        </button>
                        <button
                            type="button"
                            onClick={() => handleShiftDate(1)}
                            className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black transition cursor-pointer"
                        >
                            다음날 ▶
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500">기준 날짜:</span>
                        <input
                            type="date"
                            value={c.selectedDate}
                            onChange={(e) => {
                                if (e.target.value) c.setSelectedDate(e.target.value);
                            }}
                            className="px-2.5 py-1 text-xs font-black bg-gray-50 border border-gray-300 rounded-lg text-gray-800 cursor-pointer focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* 3. 내 배정 목록 (건물별 그룹 그리드 + 청소 완료 토글) */}
                {myAssignedUnits.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 font-bold text-xs bg-white rounded-xl border border-dashed border-gray-300">
                        {c.selectedDate}에는 배정된 청소가 없습니다. 편안한 하루 되세요! 😊
                    </div>
                ) : (
                    <CleaningGroupGrid
                        dateStr={c.selectedDate}
                        bookings={c.bookings}
                        bookingNotes={c.bookingNotes}
                        assignments={c.assignments}
                        staffList={c.staffList}
                        staffMap={c.staffMap}
                        onToggleComplete={(unitKey) => c.toggleComplete(unitKey)}
                        staffIdFilter={auth.role}
                        isStaffView={true}
                    />
                )}
                </div>
            </div>
        </div>
    );
}
