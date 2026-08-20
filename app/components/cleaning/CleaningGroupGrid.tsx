'use client';

import { useState } from 'react';
import { PROPERTY_GROUPS } from '../../config';
import { Booking, CleaningAssignment, UnitConfig } from '../../types';
import CleaningRoomCard from './CleaningRoomCard';
import { getUnitCleaningStatus } from '../../utils/cleaningStatus';

interface CleaningGroupGridProps {
    dateStr: string;
    bookings: Booking[];
    bookingNotes: { [bookingId: number]: { note: string; tags: string[] } };
    assignments: { [unitKey: string]: CleaningAssignment };
    staffList?: string[];
    selectedStaffForMobile?: string;
    onAssign?: (unitKey: string, staffName: string) => void;
    onUnassign?: (unitKey: string) => void;
    onToggleComplete?: (unitKey: string) => void;
    staffIdFilter?: string | null; // 특정 스태프 ID만 필터링 (개인 보드용)
    isStaffView?: boolean;         // 스태프 전용 뷰 여부 (완료 체크 버튼 활성화)
}

export default function CleaningGroupGrid({
    dateStr,
    bookings,
    bookingNotes,
    assignments,
    staffList = [],
    selectedStaffForMobile,
    onAssign,
    onUnassign,
    onToggleComplete,
    staffIdFilter,
    isStaffView = false,
}: CleaningGroupGridProps) {
    // 'targetOnly' (청소 대상만 보기) vs 'all' (전체 호실 보기)
    const [viewFilter, setViewFilter] = useState<'targetOnly' | 'all'>('targetOnly');

    // 전체/개인 숙소 호실들의 청소 상태 통계 계산
    let totalUrgentCheckinCount = 0;
    let totalStandbyCheckoutCount = 0;
    let totalAssignedCount = 0;
    let totalCompletedCount = 0;

    // 각 숙소 그룹별 데이터 사전 가공
    const groupsWithStatus = PROPERTY_GROUPS.map((group) => {
        const unitsWithStatus = group.units.map((unit) => {
            const statusInfo = getUnitCleaningStatus(unit, dateStr, bookings);
            const assignment = assignments[unit.key];
            const isAssigned = !!assignment;
            const isCompleted = !!assignment?.isCompleted;

            return {
                unit,
                statusInfo,
                isAssigned,
                isCompleted,
                assignment,
            };
        });

        // 스태프 전용 필터 적용
        const filteredUnits = staffIdFilter
            ? unitsWithStatus.filter((u) => u.assignment?.staffId === staffIdFilter)
            : unitsWithStatus;

        // 통계 집계 (스태프 뷰일 때는 내 배정 호실만 집계, 관리자 뷰일 때는 전체 집계)
        filteredUnits.forEach((u) => {
            if (u.statusInfo.statusCode === 'URGENT_CHECKIN') totalUrgentCheckinCount++;
            if (u.statusInfo.statusCode === 'STANDBY_CHECKOUT_ONLY') totalStandbyCheckoutCount++;
            if (u.isAssigned) totalAssignedCount++;
            if (u.isCompleted) totalCompletedCount++;
        });

        const targetUnits = filteredUnits.filter((u) => u.statusInfo.needsCleaning);
        const assignedTargetCount = targetUnits.filter((u) => u.isAssigned).length;
        const completedTargetCount = targetUnits.filter((u) => u.isCompleted).length;

        return {
            ...group,
            unitsWithStatus: filteredUnits,
            targetUnits,
            hasTargetUnits: targetUnits.length > 0,
            assignedTargetCount,
            completedTargetCount,
        };
    });

    const totalCleaningTargetCount = totalUrgentCheckinCount + totalStandbyCheckoutCount;

    return (
        <div className="flex flex-col gap-4">
            {/* 1. 상단 현황 요약 및 필터 토글 바 */}
            <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                {/* 통계 배지들 */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="text-xs font-black text-gray-800 mr-1">
                        📊 {dateStr} 현황:
                    </span>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black">
                        <span>🚨 당일 입실 (우선):</span>
                        <span className="text-rose-900 font-black">{totalUrgentCheckinCount}곳</span>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black">
                        <span>⏳ 여유 청소:</span>
                        <span className="text-amber-900 font-black">{totalStandbyCheckoutCount}곳</span>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-black">
                        <span>👤 배정 완료:</span>
                        <span className="text-blue-900 font-black">{totalAssignedCount} / {totalCleaningTargetCount}곳</span>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black">
                        <span>✅ 청소 완료:</span>
                        <span className="text-emerald-900 font-black">{totalCompletedCount} / {totalCleaningTargetCount}곳</span>
                    </div>
                </div>

                {/* 보기 모드 필터 버튼 (스태프 뷰가 아닐 때만 제공) */}
                {!staffIdFilter && (
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs font-bold shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewFilter('targetOnly')}
                            className={`px-3 py-1 rounded-md transition font-black ${viewFilter === 'targetOnly'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            🧹 청소 대상만 ({totalCleaningTargetCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewFilter('all')}
                            className={`px-3 py-1 rounded-md transition font-black ${viewFilter === 'all'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            🏢 전체 호실 보기
                        </button>
                    </div>
                )}
            </div>

            {/* 2. 숙소 그룹(건물)별 그리드 목록: 모바일 1열 / PC 슬림 자동채움 (3~4개+ 나열) */}
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                {groupsWithStatus.map((group) => {
                    const displayUnits = viewFilter === 'targetOnly' ? group.targetUnits : group.unitsWithStatus;

                    // 해당 숙소에 보여줄 호실이 없으면 생략
                    if (displayUnits.length === 0) {
                        return null;
                    }

                    return (
                        <div
                            key={group.name}
                            className="bg-white rounded-xl border border-gray-200 shadow-2xs p-2.5 sm:p-3 flex flex-col gap-2 transition hover:border-gray-300 h-fit"
                        >
                            {/* 숙소 그룹 헤더 */}
                            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-sm shrink-0">🏢</span>
                                    <h3 className="font-black text-xs sm:text-sm text-gray-900 leading-tight truncate">
                                        {group.name}
                                    </h3>
                                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                                        {group.units.length}실
                                    </span>
                                </div>

                                <div className="flex items-center gap-1 text-[11px] font-black shrink-0">
                                    {group.targetUnits.length > 0 ? (
                                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                            {group.completedTargetCount > 0 && `✅ ${group.completedTargetCount}/`}청소 {group.targetUnits.length}곳
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200">
                                            청소 없음
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 호실 리스트 (슬림한 건물 폭에 맞게 깔끔한 1열 정렬) */}
                            <div className="flex flex-col gap-2">
                                {displayUnits.map(({ unit }) => (
                                    <div
                                        key={unit.key}
                                        onClick={() => {
                                            if (selectedStaffForMobile && onAssign) {
                                                onAssign(unit.key, selectedStaffForMobile);
                                            }
                                        }}
                                        className={selectedStaffForMobile && onAssign ? 'cursor-pointer' : ''}
                                    >
                                        <CleaningRoomCard
                                            unit={unit}
                                            dateStr={dateStr}
                                            assignment={assignments[unit.key]}
                                            staffList={staffList}
                                            bookings={bookings}
                                            bookingNotes={bookingNotes}
                                            onAssign={onAssign ? (staff) => onAssign(unit.key, staff) : undefined}
                                            onUnassign={onUnassign ? () => onUnassign(unit.key) : undefined}
                                            onToggleComplete={onToggleComplete ? () => onToggleComplete(unit.key) : undefined}
                                            readonly={!onAssign && !isStaffView}
                                            isStaffView={isStaffView}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 청소 대상만 보기 모드에서 전체가 0곳일 때 */}
            {viewFilter === 'targetOnly' && totalCleaningTargetCount === 0 && (
                <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300 text-gray-400 font-bold text-xs">
                    🎉 {dateStr}에는 청소 예정인 호실이 없습니다!
                </div>
            )}
        </div>
    );
}
