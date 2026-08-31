'use client';

import { useState } from 'react';
import { UnitConfig, Booking, CleaningAssignment } from '../../types';
import { parseBookingTag } from '../../config';
import { getUnitCleaningStatus } from '../../utils/cleaningStatus';

interface CleaningRoomCardProps {
    unit: UnitConfig;
    dateStr: string;
    assignment?: CleaningAssignment;
    staffList: string[];
    bookings: Booking[];
    bookingNotes: { [bookingId: number]: { note: string; tags: string[] } };
    onAssign?: (staff: string) => void;
    onUnassign?: () => void;
    onToggleComplete?: () => void;
    readonly?: boolean;
    isStaffView?: boolean;
}

export default function CleaningRoomCard({
    unit,
    dateStr,
    assignment,
    staffList,
    bookings,
    bookingNotes,
    onAssign,
    onUnassign,
    onToggleComplete,
    readonly = false,
    isStaffView = false,
}: CleaningRoomCardProps) {
    const [isDragOver, setIsDragOver] = useState(false);

    // 공통 유틸리티로 호실 청소 상태 판별
    const statusInfo = getUnitCleaningStatus(unit, dateStr, bookings);
    const { checkoutBooking, checkinBooking, stayBooking, statusCode } = statusInfo;

    const noteData = checkinBooking
        ? bookingNotes[checkinBooking.id]
        : checkoutBooking
            ? bookingNotes[checkoutBooking.id]
            : stayBooking
                ? bookingNotes[stayBooking.id]
                : null;

    const activeTags = noteData?.tags || [];

    const handleDrop = (e: React.DragEvent) => {
        if (readonly) return;
        e.preventDefault();
        setIsDragOver(false);
        const staffName = e.dataTransfer.getData('text/plain');
        if (staffName && onAssign) onAssign(staffName);
    };

    const isCompleted = !!assignment?.isCompleted;

    return (
        <div
            onDragOver={(e) => {
                if (readonly) return;
                e.preventDefault();
                setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`p-2 sm:p-2.5 rounded-lg border transition-all flex flex-col justify-between gap-1.5 relative ${isDragOver
                ? 'bg-blue-100/90 border-blue-500 ring-2 ring-blue-400 scale-[1.02] shadow-md'
                : isCompleted
                    ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200 shadow-2xs'
                    : assignment
                        ? 'bg-white border-blue-300 ring-1 ring-blue-200 shadow-2xs'
                        : `${statusInfo.cardBg} ${statusInfo.cardBorder}`
                }`}
        >
            {/* 1. 상단: 호실명 + 청소 상태 뱃지 + 배정/완료 정보 */}
            <div className="flex items-start justify-between gap-1">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-black text-xs sm:text-sm text-gray-900 leading-none truncate">
                            🏠 {unit.displayName}
                        </span>
                        {unit.subName && (
                            <span className="text-[9.5px] font-bold text-gray-500">
                                ({unit.subName})
                            </span>
                        )}
                    </div>
                    {/* 상태 라벨 배지 */}
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isCompleted ? 'bg-emerald-600 text-white' : statusInfo.badgeBg} leading-none`}>
                            {isCompleted ? '✅ 청소 완료' : statusInfo.label}
                        </span>
                    </div>
                </div>

                {/* 배정 상태 표시 또는 모바일 배정 드롭다운 */}
                <div className="shrink-0">
                    {assignment ? (
                        <div className="flex items-center gap-1">
                            {isCompleted ? (
                                <div className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1 shadow-2xs">
                                    <span>✅ {assignment.staffName}</span>
                                    <span className="text-[8.5px] text-emerald-100 bg-emerald-700/60 px-1 rounded">
                                        {assignment.completedAt || '완료'}
                                    </span>
                                </div>
                            ) : (
                                <div className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-600 text-white flex items-center gap-1 shadow-2xs">
                                    <span>👤 {assignment.staffName}</span>
                                    <span className="text-[8.5px] text-blue-100 bg-blue-700/60 px-1 rounded">
                                        {assignment.assignedAt}
                                    </span>
                                </div>
                            )}
                            {!readonly && onUnassign && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUnassign();
                                    }}
                                    className="w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 font-black text-[11px] transition"
                                    title="배정 취소"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ) : (
                        !readonly && onAssign && (
                            <select
                                aria-label={`${unit.displayName} 청소 담당자 선택`}
                                value=""
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    if (e.target.value) onAssign(e.target.value);
                                }}
                                className="text-[10px] font-black px-1.5 py-0.5 bg-white/90 border border-gray-300 hover:border-blue-400 rounded text-gray-700 cursor-pointer shadow-2xs focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="">배정 선택 ▾</option>
                                {staffList.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        )
                    )}
                </div>
            </div>

            {/* 2. 입/퇴실/투숙 상세 정보 박스 */}
            {(checkoutBooking || checkinBooking || stayBooking) && (
                <div className="text-[10px] flex flex-col gap-0.5 bg-white/80 p-1.5 rounded-md border border-gray-200/70 font-bold leading-tight">
                    {checkoutBooking && (
                        <div className="text-amber-800 flex items-center justify-between">
                            <span className="flex items-center gap-0.5">
                                <span className="text-amber-600">📤</span> 체크아웃
                            </span>
                            <span className="text-[9.5px] text-gray-600 truncate max-w-[110px]">
                                {checkoutBooking.firstName || checkoutBooking.lastName || '게스트'}
                            </span>
                        </div>
                    )}
                    {checkinBooking && (
                        <div className="text-rose-700 flex items-center justify-between">
                            <span className="flex items-center gap-0.5">
                                <span className="text-rose-600">📥</span> 체크인
                            </span>
                            <span className="text-[9.5px] text-gray-600 truncate max-w-[110px]">
                                {checkinBooking.firstName || checkinBooking.lastName || '게스트'}
                            </span>
                        </div>
                    )}
                    {!checkoutBooking && !checkinBooking && stayBooking && (
                        <div className="text-slate-600 flex items-center justify-between">
                            <span className="flex items-center gap-0.5">
                                <span>🛏️</span> 투숙
                            </span>
                            <span className="text-[9.5px] text-gray-500 truncate max-w-[110px]">
                                {stayBooking.firstName || stayBooking.lastName || '게스트'}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* 3. 특이사항 태그 & 메모 */}
            {(activeTags.length > 0 || noteData?.note) && (
                <div className="flex flex-col gap-0.5 pt-0.5 border-t border-gray-200/50">
                    {activeTags.length > 0 && (
                        <div className="flex flex-wrap gap-0.5">
                            {activeTags.map((tagKey) => {
                                const tagInfo = parseBookingTag(tagKey);
                                if (!tagInfo) return null;
                                return (
                                    <span key={tagKey} className="text-[8.5px] font-black px-1 py-0.2 rounded bg-rose-600 text-white">
                                        {tagInfo.icon} {tagInfo.label}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                    {noteData?.note && (
                        <div className="text-[9.5px] text-amber-950 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300/70 font-bold truncate">
                            🔥 {noteData.note}
                        </div>
                    )}
                </div>
            )}

            {/* 4. 스태프 화면용 청소 완료 원터치 체크 버튼 */}
            {isStaffView && onToggleComplete && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleComplete();
                    }}
                    className={`w-full py-1.5 px-2 rounded-md font-black text-xs transition flex items-center justify-center gap-1 cursor-pointer ${isCompleted
                        ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                        }`}
                >
                    {isCompleted ? (
                        <>
                            <span>✅</span>
                            <span>청소 완료됨 ({assignment?.completedAt || '완료'})</span>
                        </>
                    ) : (
                        <>
                            <span>🧹</span>
                            <span>청소 완료 체크</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
}