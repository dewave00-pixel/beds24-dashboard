'use client';

import { Booking } from '../../types';
import { ALL_UNITS, getChannelStyle, parseBookingTag } from '../../config';

interface BookingNoteData {
    note: string;
    tags: string[];
}

interface DailyBookingCardProps {
    booking: Booking;
    type: 'checkIn' | 'checkOut';
    bookingNotes: { [bookingId: number]: BookingNoteData };
    onSelectBooking: (booking: Booking) => void;
}

export default function DailyBookingCard({
    booking,
    type,
    bookingNotes,
    onSelectBooking,
}: DailyBookingCardProps) {
    const ch = getChannelStyle(booking.apiSourceId);
    const guestName =
        booking.firstName || booking.lastName
            ? `${booking.firstName || ''} ${booking.lastName || ''}`.trim()
            : `예약 #${booking.id}`;

    // 1. propName 정확한 필드 매칭
    const unitInfo = ALL_UNITS.find((u) => {
        const isRoomMatch = u.roomId === Number(booking.roomId);
        const isUnitMatch = u.unitId ? u.unitId === Number(booking.unitId) : true;
        return isRoomMatch && isUnitMatch;
    });

    const propertyName = unitInfo?.propName || '기타 숙소';
    const unitDisplayName = unitInfo?.displayName || `Room ${booking.roomId}`;

    // 2. 박수(Nights) 안전 계산 (체크아웃 - 체크인)
    const arrivalDate = new Date(booking.arrival);
    const departureDate = new Date(booking.departure);
    const diffTime = departureDate.getTime() - arrivalDate.getTime();
    const calculatedNights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24))) || 1;

    const noteData = bookingNotes[booking.id];
    const hasMemo = Boolean(noteData && noteData.note);
    const activeTags = noteData ? noteData.tags || [] : [];

    return (
        <div
            onClick={() => onSelectBooking(booking)}
            className="p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col gap-2"
        >
            {/* 1줄: 숙소명/호실명 + 채널 뱃지 */}
            <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-900 text-white shrink-0">
                        {propertyName}
                    </span>
                    <span className="font-black text-xs md:text-sm text-gray-900 truncate">
                        🏠 {unitDisplayName}
                    </span>
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