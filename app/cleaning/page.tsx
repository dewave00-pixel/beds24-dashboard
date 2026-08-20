'use client';

import { useState } from 'react';
import Link from 'next/link';
import '../dashboard.css';
import { useCleaningBoard } from '../hooks/useCleaningBoard';
import CleaningStaffPool from '../components/cleaning/CleaningStaffPool';
import CleaningGroupGrid from '../components/cleaning/CleaningGroupGrid';
import CleaningBatchSender from '../components/cleaning/CleaningBatchSender';

export default function CleaningPage() {
    const c = useCleaningBoard();
    const [selectedStaffForMobile, setSelectedStaffForMobile] = useState<string>('');

    // 날짜 변경 함수 (offset: -1 이면 어제, +1 이면 내일)
    const handleShiftDate = (offsetDays: number) => {
        const d = new Date(c.selectedDate || c.todayStr);
        d.setDate(d.getDate() + offsetDays);
        c.setSelectedDate(d.toISOString().split('T')[0]);
    };

    const handleSetToday = () => {
        c.setSelectedDate(c.todayStr);
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-wrapper flex flex-col gap-3">

                {/* 1. 상단 헤더 & 네비게이션 */}
                <div className="dashboard-header-card py-2.5 px-3 md:px-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🧹</span>
                            <div>
                                <h1 className="text-sm md:text-base font-black text-gray-900 leading-tight">
                                    청소 배정 & 카톡 발송 보드
                                </h1>
                                <span className="text-[10.5px] text-gray-500 font-bold">
                                    숙소별 그리드 및 당일 입실/퇴실 우선순위 관리
                                </span>
                            </div>
                        </div>

                        {/* 네비게이션 탭 */}
                        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-300">
                            <Link
                                href="/"
                                className="px-2.5 py-1 rounded-md text-xs font-black text-gray-600 hover:text-gray-900 transition flex items-center gap-1"
                            >
                                <span>📊</span> 대시보드
                            </Link>
                            <div className="px-2.5 py-1 rounded-md text-xs font-black bg-white text-blue-600 shadow-sm flex items-center gap-1">
                                <span>🧹</span> 청소 관리
                            </div>
                            <Link
                                href="/properties"
                                className="px-2.5 py-1 rounded-md text-xs font-black text-gray-600 hover:text-gray-900 transition flex items-center gap-1"
                            >
                                <span>🔑</span> 숙소/비번
                            </Link>
                        </div>
                    </div>
                </div>

                {/* 2. 날짜 선택 툴바 */}
                <div className="bg-white p-2.5 px-3 rounded-xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => handleShiftDate(-1)}
                            className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black transition"
                        >
                            ◀ 이전날
                        </button>
                        <button
                            type="button"
                            onClick={handleSetToday}
                            className={`px-3 py-1 rounded-lg text-xs font-black transition ${c.selectedDate === c.todayStr
                                ? 'bg-slate-900 text-white shadow-2xs'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                        >
                            오늘 ({c.todayStr})
                        </button>
                        <button
                            type="button"
                            onClick={() => handleShiftDate(1)}
                            className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black transition"
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

                {/* 3. 상단 담당자 풀 (드래그 출발지 & 모바일 터치 선택) */}
                <CleaningStaffPool
                    staffList={c.staffList}
                    staffMap={c.staffMap}
                    updateStaffMap={c.updateStaffMap}
                    selectedStaffForMobile={selectedStaffForMobile}
                    onSelectStaffForMobile={setSelectedStaffForMobile}
                />

                {/* 4. 숙소 그룹별 청소 보드 (그리드) */}
                {c.loading ? (
                    <div className="bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-400 font-bold text-xs">
                        예약 데이터를 분석하는 중입니다...
                    </div>
                ) : (
                    <CleaningGroupGrid
                        dateStr={c.selectedDate}
                        bookings={c.bookings}
                        bookingNotes={c.bookingNotes}
                        assignments={c.assignments}
                        staffList={c.staffList}
                        selectedStaffForMobile={selectedStaffForMobile}
                        onAssign={(unitKey, staffName) => c.assignStaff(unitKey, staffName)}
                        onUnassign={(unitKey) => c.unassignStaff(unitKey)}
                        onToggleComplete={(unitKey) => c.toggleComplete(unitKey)}
                    />
                )}

                {/* 5. 하단 일괄 카톡 공유 툴바 */}
                <CleaningBatchSender
                    dateStr={c.selectedDate}
                    assignments={c.assignments}
                    bookings={c.bookings}
                    bookingNotes={c.bookingNotes}
                />

            </div>
        </div>
    );
}