'use client';

import { useState } from 'react';
import Link from 'next/link';
import '../dashboard.css';
import { useCleaningBoard } from '../hooks/useCleaningBoard';
import CleaningStaffPool from '../components/cleaning/CleaningStaffPool';
import CleaningRoomCard from '../components/cleaning/CleaningRoomCard';
import CleaningBatchSender from '../components/cleaning/CleaningBatchSender';

export default function CleaningPage() {
    const c = useCleaningBoard();
    const [selectedStaffForMobile, setSelectedStaffForMobile] = useState<string>('');

    const handleMobileAssign = (unitKey: string) => {
        if (selectedStaffForMobile) {
            c.assignStaff(unitKey, selectedStaffForMobile);
        }
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
                                    {c.selectedDate} 기준 청소 대상 호실 관리
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

                {/* 2. 상단 담당자 풀 (드래그 출발지) */}
                <CleaningStaffPool
                    staffList={c.staffList}
                    staffMap={c.staffMap}
                    updateStaffMap={c.updateStaffMap}
                    selectedStaffForMobile={selectedStaffForMobile}
                    onSelectStaffForMobile={setSelectedStaffForMobile}
                />

                {/* 3. 청소 대상 호실 보드 (그리드) */}
                <div className="dashboard-panel p-3 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                        <span className="font-black text-xs md:text-sm text-gray-800">
                            🏠 오늘 청소 대상 호실 ({c.cleaningTargetUnits.length}곳)
                        </span>
                        <div className="flex items-center gap-1 text-xs font-black text-gray-600">
                            <span>배정 완료:</span>
                            <span className="text-blue-600 font-black">{Object.keys(c.assignments).length}곳</span>
                        </div>
                    </div>

                    {c.loading ? (
                        <div className="text-center py-12 text-gray-400 font-bold text-xs">
                            예약 데이터를 분석하는 중입니다...
                        </div>
                    ) : c.cleaningTargetUnits.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 font-bold text-xs bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            선택한 날짜에 청소 예정인 호실이 없습니다.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                            {c.cleaningTargetUnits.map((unit) => (
                                <div key={unit.key} onClick={() => handleMobileAssign(unit.key)}>
                                    <CleaningRoomCard
                                        unit={unit}
                                        dateStr={c.selectedDate}
                                        assignment={c.assignments[unit.key]}
                                        staffList={c.staffList}
                                        bookings={c.bookings}
                                        bookingNotes={c.bookingNotes}
                                        onAssign={(staff) => c.assignStaff(unit.key, staff)}
                                        onUnassign={() => c.unassignStaff(unit.key)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 4. 하단 일괄 카톡 공유 단일 툴바 */}
                <CleaningBatchSender
                    dateStr={c.selectedDate}
                    assignments={c.assignments}
                />

            </div>
        </div>
    );
}