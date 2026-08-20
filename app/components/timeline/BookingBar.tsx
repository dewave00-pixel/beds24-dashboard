'use client';

import { Booking } from '../../types';
import { getChannelStyle, parseBookingTag } from '../../config';

interface BookingNoteData {
    note: string;
    tags: string[];
}

interface BookingBarProps {
    booking: Booking;
    topPos: number;
    barHeight: number;
    nightsCount: number;
    isDimmed: boolean;
    noteData?: BookingNoteData;
    onClick: (e: React.MouseEvent, booking: Booking) => void;
}

export default function BookingBar({
    booking,
    topPos,
    barHeight,
    nightsCount,
    isDimmed,
    noteData,
    onClick,
}: BookingBarProps) {
    const ch = getChannelStyle(booking.apiSourceId);
    const guestName =
        booking.firstName || booking.lastName
            ? `${booking.firstName || ''} ${booking.lastName || ''}`.trim()
            : `예약 #${booking.id}`;

    const hasMemo = Boolean(noteData && noteData.note);
    const activeTags = noteData ? noteData.tags || [] : [];

    // 얼리체크인 태그 상단 분리
    const earlyTagKey = activeTags.find((t) => t.startsWith('early_'));
    const earlyTagInfo = earlyTagKey ? parseBookingTag(earlyTagKey) : null;
    const bottomTags = activeTags.filter((t) => !t.startsWith('early_'));

    const isOneNight = nightsCount === 1;

    // 실제 전체 예약 박수 계산 (장기 투숙 등 전체 일정 기준)
    const actualNights = Math.max(
        1,
        Math.round(
            (new Date(booking.departure).getTime() - new Date(booking.arrival).getTime()) /
                (1000 * 60 * 60 * 24)
        )
    );

    return (
        <div
            onClick={(e) => onClick(e, booking)}
            className={`absolute left-1 right-1 rounded-lg shadow-md flex flex-col justify-between font-bold pointer-events-auto transition-all duration-200 hover:brightness-105 hover:z-30 cursor-pointer border border-black/15 overflow-hidden ${isOneNight ? 'p-1' : 'p-1.5'
                } ${isDimmed ? 'booking-card-dimmed' : 'opacity-100'} ${hasMemo ? 'animate-pulse-memo' : ''
                }`}
            style={{
                top: `${topPos}px`,
                height: `${barHeight}px`,
                backgroundColor: ch.bg,
                color: ch.text,
            }}
            title={`${ch.name} | ${guestName} (${booking.arrival} ~ ${booking.departure}, 총 ${actualNights}박)`}
        >
            {/* 📌 상단 영역: 게스트명 + 채널/얼리/박수 */}
            <div className="flex flex-col leading-none overflow-hidden gap-0.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] md:text-[11px] font-black truncate">
                        📥 {guestName}
                    </span>
                    {isOneNight && (
                        <span className="text-[8.5px] font-black opacity-90 shrink-0 ml-1">
                            1박
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 truncate">
                    <span className="text-[8px] md:text-[8.5px] opacity-90 font-black truncate">
                        {ch.name}
                    </span>
                    {earlyTagInfo && (
                        <span className="text-[7.5px] md:text-[8px] font-black px-1 py-0.2 rounded bg-black/50 text-white shrink-0 border border-white/30">
                            {earlyTagInfo.icon} {earlyTagInfo.label}
                        </span>
                    )}
                </div>
            </div>

            {/* 📌 하단 영역: 4개 뱃지가 2줄로 자동 줄바꿈(flex-wrap) */}
            <div className="flex items-center justify-between text-[10px] font-black leading-none mt-auto pt-0.5 border-t border-black/10">
                <div className="flex flex-wrap items-center gap-0.5 overflow-hidden w-full">
                    {hasMemo && (
                        <span className="text-[7.5px] md:text-[8px] font-black text-white bg-red-600 px-1 py-0.2 rounded shrink-0 shadow-sm border border-white/50">
                            🔥메모
                        </span>
                    )}

                    {bottomTags.map((tagKey) => {
                        const tagInfo = parseBookingTag(tagKey);
                        if (!tagInfo) return null;
                        return (
                            <span
                                key={tagKey}
                                className="text-[7px] md:text-[7.5px] font-extrabold px-1 py-0.2 rounded bg-black/50 text-white shrink-0 shadow border border-white/30"
                            >
                                {tagInfo.icon}{tagInfo.label}
                            </span>
                        );
                    })}
                </div>

                {actualNights > 1 && (
                    <span className="shrink-0 text-[9.5px] md:text-[10.5px] font-black ml-1">
                        {actualNights}박
                    </span>
                )}
            </div>
        </div>
    );
}