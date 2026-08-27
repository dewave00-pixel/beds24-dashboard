'use client';

import React from 'react';
import { Booking } from '../../types';
import { getChannelStyle } from '../../config';
import { getUnitsForRoomId } from '../../utils/bookingUtils';

interface UnallocatedBookingBarProps {
    booking: Booking;
    topPos: number;
    barHeight: number;
    isDimmed?: boolean;
    onClick: (e: React.MouseEvent, booking: Booking) => void;
}

export default function UnallocatedBookingBar({
    booking,
    topPos,
    barHeight,
    isDimmed = false,
    onClick,
}: UnallocatedBookingBarProps) {
    const ch = getChannelStyle(booking.apiSourceId);
    const candidateUnits = getUnitsForRoomId(booking.roomId);
    const roomSubName = candidateUnits[0]?.subName || '';

    const guestName = (booking.firstName || booking.lastName)
        ? `${booking.firstName || ''} ${booking.lastName || ''}`.trim()
        : `예약 #${booking.id}`;

    // 박수 계산
    const arr = new Date(booking.arrival);
    const dep = new Date(booking.departure);
    const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24))) || 1;

    return (
        <div
            onClick={(e) => onClick(e, booking)}
            style={{
                top: `${topPos}px`,
                height: `${barHeight}px`,
            }}
            title={`[호실 미배정] ${roomSubName ? `(${roomSubName}) ` : ''}${guestName} (${booking.arrival} ~ ${booking.departure}, ${nights}박) - 클릭하여 호실 배정`}
            className={`absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed border-amber-500 bg-amber-500/25 hover:bg-amber-500/40 hover:border-amber-600 transition-all cursor-pointer pointer-events-auto z-15 flex flex-col justify-between p-1 overflow-hidden shadow-xs select-none group ${
                isDimmed ? 'opacity-30' : 'opacity-95 hover:opacity-100'
            }`}
        >
            {/* 상단 라벨: 룸타입 + 채널 */}
            <div className="flex items-center justify-between gap-0.5 min-w-0">
                <span className="text-[9px] font-black text-amber-950 bg-amber-300 px-1 py-0.2 rounded shadow-2xs shrink-0 animate-pulse flex items-center gap-0.5">
                    <span>⚠️</span>
                    {roomSubName ? <span>{roomSubName}</span> : <span>대기</span>}
                </span>

                <span
                    className="text-[8px] font-black px-1 rounded truncate shadow-2xs"
                    style={{ backgroundColor: ch.bg, color: ch.text }}
                >
                    {ch.name}
                </span>
            </div>

            {/* 게스트 정보 */}
            <div className="flex flex-col min-w-0 my-auto text-center">
                <span className="text-[11px] font-black text-slate-950 truncate leading-tight group-hover:underline">
                    {guestName}
                </span>
                <span className="text-[9px] font-extrabold text-amber-950 truncate">
                    {nights}박 ({booking.numAdult || 1}명)
                </span>
            </div>

            {/* 하단 퀵 액션 배지 */}
            <div className="flex items-center justify-center">
                <span className="text-[8.5px] font-black text-blue-900 bg-white/90 group-hover:bg-white px-1 py-0.2 rounded border border-amber-400 shadow-2xs group-hover:scale-105 transition">
                    배정 ➔
                </span>
            </div>
        </div>
    );
}
