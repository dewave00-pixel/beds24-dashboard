'use client';

import { useState } from 'react';
import { UnitConfig } from '../../types';
import { parseBookingTag } from '../../config';
import { Booking, CleaningAssignment } from '../../types';


interface CleaningRoomCardProps {
    unit: UnitConfig;
    dateStr: string;
    assignment?: CleaningAssignment;
    staffList: string[];
    bookings: Booking[];
    bookingNotes: { [bookingId: number]: { note: string; tags: string[] } };
    onAssign?: (staff: string) => void;
    onUnassign?: () => void;
    readonly?: boolean;
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
    readonly = false,
}: CleaningRoomCardProps) {
    const [isDragOver, setIsDragOver] = useState(false);

    const checkoutBooking = bookings.find(
        (b) => b.roomId === unit.roomId && b.departure === dateStr
    );
    const checkinBooking = bookings.find(
        (b) => b.roomId === unit.roomId && b.arrival === dateStr
    );

    const noteData = checkinBooking
        ? bookingNotes[checkinBooking.id]
        : checkoutBooking
            ? bookingNotes[checkoutBooking.id]
            : null;

    const activeTags = noteData?.tags || [];

    const handleDrop = (e: React.DragEvent) => {
        if (readonly) return;
        e.preventDefault();
        setIsDragOver(false);
        const staffName = e.dataTransfer.getData('text/plain');
        if (staffName && onAssign) onAssign(staffName);
    };

    return (
        <div
            onDragOver={(e) => {
                if (readonly) return;
                e.preventDefault();
                setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`p-3 rounded-xl border transition flex flex-col gap-2 ${isDragOver
                ? 'bg-blue-50 border-blue-500 scale-[1.02]'
                : assignment
                    ? 'bg-white border-blue-200 shadow-sm'
                    : 'bg-white border-gray-200'
                }`}
        >
            {/* 1줄: 숙소/호실명 + 배정 담당자 & 타임스탬프 뱃지 */}
            <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-900 text-white">
                        {unit.propName || '숙소'}
                    </span>
                    <span className="font-black text-xs md:text-sm text-gray-900">
                        🏠 {unit.displayName}
                    </span>
                </div>

                {assignment ? (
                    <div className="flex items-center gap-1">
                        <div className="text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-1 shadow-2xs">
                            <span>👤 {assignment.staffName}</span>
                            <span className="text-[10px] text-blue-600 font-bold bg-white/70 px-1 rounded-sm">
                                🕒 {assignment.assignedAt}
                            </span>
                        </div>
                        {!readonly && onUnassign && (
                            <button
                                type="button"
                                onClick={onUnassign}
                                className="text-[11px] text-gray-400 hover:text-red-500 font-bold px-1"
                                title="배정 취소"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                ) : (
                    !readonly && onAssign && (
                        <select
                            aria-label="청소 담당자 선택"
                            value=""
                            onChange={(e) => onAssign(e.target.value)}
                            className="text-[11px] font-black px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 cursor-pointer md:hidden"
                        >
                            <option value="">배정 선택 ▾</option>
                            {staffList.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    )
                )}
            </div>

            {/* 2줄: 입/퇴실 상태 */}
            <div className="text-[11px] flex flex-col gap-0.5 text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100 font-bold">
                {checkoutBooking && (
                    <div className="text-orange-700 flex items-center justify-between">
                        <span>📤 오늘 퇴실 (11:00)</span>
                        <span className="text-[10px] text-gray-500">{checkoutBooking.firstName || '게스트'}</span>
                    </div>
                )}
                {checkinBooking && (
                    <div className="text-blue-700 flex items-center justify-between">
                        <span>📥 오늘 입실 (15:00)</span>
                        <span className="text-[10px] text-gray-500">{checkinBooking.firstName || '게스트'}</span>
                    </div>
                )}
            </div>

            {/* 3줄: 4대 특이사항 태그 */}
            {activeTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {activeTags.map((tagKey) => {
                        const tagInfo = parseBookingTag(tagKey);
                        if (!tagInfo) return null;
                        return (
                            <span key={tagKey} className="text-[9px] font-black px-1.5 py-0.5 rounded bg-black/80 text-white">
                                {tagInfo.icon} {tagInfo.label}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* 4줄: 특이사항 메모 */}
            {noteData?.note && (
                <div className="text-[10.5px] text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-200 font-bold truncate">
                    🔥 {noteData.note}
                </div>
            )}
        </div>
    );
}