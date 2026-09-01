'use client';

import { useState } from 'react';
import { Booking } from '../../types';
import { ALL_UNITS, getChannelStyle, parseBookingTag } from '../../config';
import { getUnitForBooking } from '../../utils/bookingUtils';

interface BookingNoteData {
    note: string;
    tags: string[];
}

interface DailyBookingCardProps {
    booking: Booking;
    type: 'checkIn' | 'checkOut';
    bookingNotes: Record<string | number, BookingNoteData>;
    propertiesInfo?: Record<string, { doorPassword: string; maxGuests: number; repairNotes: string }>;
    onSelectBooking: (booking: Booking) => void;
}

export default function DailyBookingCard({
    booking,
    type,
    bookingNotes,
    propertiesInfo,
    onSelectBooking,
}: DailyBookingCardProps) {
    const [copied, setCopied] = useState(false);
    const ch = getChannelStyle(booking.apiSourceId);
    const guestName =
        booking.firstName || booking.lastName
            ? `${booking.firstName || ''} ${booking.lastName || ''}`.trim()
            : `예약 #${booking.id}`;

    // 1. 호실 안전 매칭 (unitId가 없는 경우도 roomId 기반으로 정확 매칭)
    const unitInfo = getUnitForBooking(booking);
    const unitKey = unitInfo?.unitKey || unitInfo?.key;
    const doorPassword = unitKey && propertiesInfo ? propertiesInfo[unitKey]?.doorPassword : null;

    const handleCopyPassword = (e: React.MouseEvent) => {
        e.stopPropagation(); // 🚫 예약 상세 모달 열림 방지 (비밀번호만 복사)
        if (!doorPassword) return;
        navigator.clipboard.writeText(doorPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const propertyName = unitInfo?.propName || '기타 숙소';
    const unitDisplayName = unitInfo?.displayName
        ? (unitInfo.subName ? `${unitInfo.displayName} (${unitInfo.subName})` : unitInfo.displayName)
        : `Room ${booking.roomId}`;

    // 2. 박수(Nights) 안전 계산 (체크아웃 - 체크인)
    const arrivalDate = new Date(booking.arrival);
    const departureDate = new Date(booking.departure);
    const diffTime = departureDate.getTime() - arrivalDate.getTime();
    const calculatedNights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24))) || 1;

    const noteData = bookingNotes[booking.id] || bookingNotes[Number(booking.id)] || bookingNotes[String(booking.id)];
    const hasMemo = Boolean(noteData && noteData.note);
    const activeTags = noteData ? noteData.tags || [] : [];

    return (
        <div
            onClick={() => onSelectBooking(booking)}
            className="p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col gap-2"
        >
            {/* 1줄: 숙소명/호실명 + 도어락 비밀번호 뱃지 + 채널 뱃지 */}
            <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-900 text-white shrink-0">
                        {propertyName}
                    </span>
                    <span className="font-black text-xs md:text-sm text-gray-900 truncate">
                        🏠 {unitDisplayName}
                    </span>

                    {/* 🔑 도어락 비밀번호 뱃지 (원클릭 복사, 상세모달 방지) */}
                    {doorPassword && (
                        <button
                            type="button"
                            onClick={handleCopyPassword}
                            title="클릭 시 비밀번호 복사"
                            className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-black transition flex items-center gap-1 cursor-pointer shrink-0 border ${
                                copied
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                                    : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-300'
                            }`}
                        >
                            <span>🔑 {copied ? '복사됨!' : doorPassword}</span>
                            {copied ? (
                                <span className="text-[10px]">✅</span>
                            ) : (
                                <span className="text-[9px] text-slate-400">📋</span>
                            )}
                        </button>
                    )}
                </div>

                <span
                    className="text-[10px] font-black px-2 py-0.5 rounded shrink-0 shadow-sm"
                    style={{ backgroundColor: ch.bg, color: ch.text }}
                >
                    {ch.name}
                </span>
            </div>

            {/* 2줄: 예약자명 + 박수 및 일정 */}
            <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-1.5">
                <div className="font-extrabold text-gray-900 flex items-center gap-1 truncate">
                    <span>{type === 'checkIn' ? '📥' : '📤'}</span>
                    <span className="truncate">{guestName}</span>
                    <span className="text-[11px] text-gray-400 font-bold">({booking.numAdult || 1}명)</span>
                </div>

                <span className="text-[11px] text-gray-600 font-black shrink-0">
                    {booking.arrival.slice(5)} ~ {booking.departure.slice(5)} ({calculatedNights}박)
                </span>
            </div>

            {/* 3줄: 4대 태그 뱃지 */}
            {activeTags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                    {activeTags.map((tagKey) => {
                        const tagInfo = parseBookingTag(tagKey);
                        if (!tagInfo) return null;
                        return (
                            <span
                                key={tagKey}
                                className="text-[9px] font-black px-1.5 py-0.5 rounded bg-black/80 text-white shadow-sm"
                            >
                                {tagInfo.icon} {tagInfo.label}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* 4줄: 메모 노란 박스 (있을 경우만) */}
            {hasMemo && (
                <div className="p-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 font-bold flex items-start gap-1">
                    <span className="shrink-0">🔥</span>
                    <span className="truncate">{noteData?.note}</span>
                </div>
            )}
        </div>
    );
}