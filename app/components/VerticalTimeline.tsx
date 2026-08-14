'use client';

import { Booking } from '../types';
import { PROPERTY_GROUPS, ALL_UNITS, getChannelStyle, getDayType, parseBookingTag } from '../config';

interface BookingNoteData {
    note: string;
    tags: string[];
}

interface VerticalTimelineProps {
    timelineDates: string[];
    todayStr: string;
    selectedDate: string | null;
    bookings: Booking[];
    bookingNotes: { [bookingId: number]: BookingNoteData };
    ROW_HEIGHT: number;
    displayDaysCount: number;
    onDateClick: (dateStr: string) => void;
    onBookingClick: (e: React.MouseEvent, booking: Booking) => void;
}

export default function VerticalTimeline({
    timelineDates,
    todayStr,
    selectedDate,
    bookings,
    bookingNotes,
    ROW_HEIGHT,
    displayDaysCount,
    onDateClick,
    onBookingClick,
}: VerticalTimelineProps) {
    return (
        <div className="grid-table-container">
            <div className="min-w-max">

                {/* 상단 1단+2단 헤더 통합 고정 묶음 */}
                <div className="sticky-header-group border-b-2 border-gray-400 shadow-sm">

                    {/* 1단: 숙소 그룹명 (PC/모바일 무조건 블랙 볼드체 강제 적용) */}
                    <div
                        className="grid divide-x divide-gray-300 bg-white"
                        style={{
                            gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))`,
                            height: '36px',
                        }}
                    >
                        <div className="sticky-corner bg-gray-200 text-gray-950 flex items-center justify-center font-black text-xs border-r border-gray-300">
                            숙소명
                        </div>
                        {PROPERTY_GROUPS.map((group) => (
                            <div
                                key={group.name}
                                className={`p-2 flex items-center justify-center font-black text-xs md:text-sm tracking-wide shadow-sm border-r border-gray-300 text-gray-950 ${group.themeClass}`}
                                style={{
                                    gridColumn: `span ${group.units.length}`,
                                    color: '#000000',
                                    fontWeight: 900,
                                }}
                            >
                                🏢 {group.name}
                            </div>
                        ))}
                    </div>

                    {/* 2단: 세부 호실명 */}
                    <div
                        className="grid divide-x divide-gray-300 bg-gray-50 border-t border-gray-200"
                        style={{
                            gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))`,
                            height: '42px',
                        }}
                    >
                        <div className="sticky-corner bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-black border-r border-gray-300">
                            날짜 / 호실
                        </div>
                        {ALL_UNITS.map((col) => (
                            <div
                                key={col.key}
                                className="p-1.5 flex flex-col justify-center text-center bg-gray-50"
                            >
                                {col.subName && (
                                    <span className="text-[10px] text-gray-500 font-bold">{col.subName}</span>
                                )}
                                <span className="text-xs md:text-sm text-gray-950 font-black">{col.displayName}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 타임라인 본문 레이어 */}
                <div className="relative w-full">
                    {/* 배경 날짜 셀 및 좌측 날짜 틀 고정 */}
                    {timelineDates.map((dStr) => {
                        const dObj = new Date(dStr);
                        const month = dObj.getMonth() + 1;
                        const dayNum = dObj.getDate();
                        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dObj.getDay()];
                        const isToday = dStr === todayStr;
                        const isSelected = selectedDate === dStr;
                        const isOtherSelected = selectedDate !== null && !isSelected;

                        const dayInfo = getDayType(dStr);
                        let dayColorClass = 'bg-gray-50 text-gray-700';
                        if (dayInfo.type === 'saturday') dayColorClass = 'day-saturday';
                        if (dayInfo.type === 'sunday' || dayInfo.type === 'holiday') dayColorClass = 'day-sunday-holiday';

                        return (
                            <div
                                key={dStr}
                                onClick={() => onDateClick(dStr)}
                                className={`grid divide-x divide-gray-300 border-b border-gray-300 transition-all duration-200 cursor-pointer ${isSelected
                                        ? 'row-selected'
                                        : isOtherSelected
                                            ? 'row-dimmed'
                                            : 'bg-white hover:bg-gray-50/80'
                                    }`}
                                style={{
                                    gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))`,
                                    height: `${ROW_HEIGHT}px`,
                                }}
                            >
                                <div
                                    className={`sticky-left p-2 flex flex-col items-center justify-center font-black text-xs transition-colors border-r border-gray-300 ${isSelected
                                            ? 'bg-amber-500 text-white font-black'
                                            : isToday
                                                ? 'bg-blue-600 text-white font-black'
                                                : dayColorClass
                                        }`}
                                >
                                    <div>
                                        {month}/{dayNum}
                                    </div>
                                    <div className="text-[10px] opacity-90 flex items-center gap-1 font-extrabold">
                                        <span>({dayOfWeek})</span>
                                        {dayInfo.label && <span className="text-[9px] font-black truncate">[{dayInfo.label}]</span>}
                                    </div>
                                </div>

                                {ALL_UNITS.map((col) => (
                                    <div
                                        key={`${dStr}-${col.key}`}
                                        className={`h-full ${isToday && !isSelected
                                                ? 'bg-blue-50/30'
                                                : dayInfo.type === 'saturday'
                                                    ? 'bg-blue-50/10'
                                                    : dayInfo.type === 'sunday' || dayInfo.type === 'holiday'
                                                        ? 'bg-red-50/10'
                                                        : ''
                                            }`}
                                    />
                                ))}
                            </div>
                        );
                    })}

                    {/* 오버레이 예약 박스 레이어 */}
                    <div
                        className="absolute top-0 left-0 w-full h-full pointer-events-none grid z-10"
                        style={{ gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))` }}
                    >
                        <div />

                        {ALL_UNITS.map((col) => {
                            const unitBookings = bookings.filter((b) => {
                                const isRoomMatch = Number(b.roomId) === col.roomId;
                                const isUnitMatch = col.unitId ? Number(b.unitId) === col.unitId : true;
                                return isRoomMatch && isUnitMatch;
                            });

                            return (
                                <div key={`overlay-${col.key}`} className="relative w-full h-full">
                                    {unitBookings.map((b) => {
                                        const startIndex = timelineDates.indexOf(b.arrival);
                                        const depDateObj = new Date(b.departure);
                                        depDateObj.setDate(depDateObj.getDate() - 1);
                                        const lastNightStr = depDateObj.toISOString().split('T')[0];
                                        const lastNightIndex = timelineDates.indexOf(lastNightStr);

                                        if (startIndex === -1 && lastNightIndex === -1) return null;

                                        const startRow = startIndex === -1 ? 0 : startIndex;
                                        const endRow = lastNightIndex === -1 ? displayDaysCount - 1 : lastNightIndex;
                                        const nightsCount = Math.max(1, endRow - startRow + 1);

                                        const topPos = startRow * ROW_HEIGHT + 3;
                                        const barHeight = nightsCount * ROW_HEIGHT - 6;

                                        const ch = getChannelStyle(b.apiSourceId);
                                        const guestName =
                                            b.firstName || b.lastName
                                                ? `${b.firstName || ''} ${b.lastName || ''}`.trim()
                                                : `예약 #${b.id}`;

                                        const isBookingInSelectedDate =
                                            selectedDate !== null &&
                                            selectedDate >= b.arrival &&
                                            selectedDate <= lastNightStr;
                                        const isBookingDimmed = selectedDate !== null && !isBookingInSelectedDate;

                                        const noteData = bookingNotes[b.id];
                                        const hasMemo = Boolean(noteData && noteData.note);
                                        const activeTags = noteData ? noteData.tags || [] : [];

                                        // 얼리체크인 태그 분리
                                        const earlyTagKey = activeTags.find((t) => t.startsWith('early_'));
                                        const earlyTagInfo = earlyTagKey ? parseBookingTag(earlyTagKey) : null;
                                        const bottomTags = activeTags.filter((t) => !t.startsWith('early_'));

                                        const isOneNight = nightsCount === 1;

                                        return (
                                            <div
                                                key={b.id}
                                                onClick={(e) => onBookingClick(e, b)}
                                                className={`absolute left-1 right-1 rounded-lg shadow-md flex flex-col justify-between font-bold pointer-events-auto transition-all duration-200 hover:brightness-105 hover:z-30 cursor-pointer border border-black/15 overflow-hidden ${isOneNight ? 'p-1' : 'p-1.5'
                                                    } ${isBookingDimmed ? 'booking-card-dimmed' : 'opacity-100'} ${hasMemo ? 'animate-pulse-memo' : ''
                                                    }`}
                                                style={{
                                                    top: `${topPos}px`,
                                                    height: `${barHeight}px`,
                                                    backgroundColor: ch.bg,
                                                    color: ch.text,
                                                }}
                                                title={`${ch.name} | ${guestName} (${b.arrival} ~ ${b.departure}, ${nightsCount}박)`}
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

                                                    {!isOneNight && (
                                                        <span className="shrink-0 text-[9.5px] md:text-[10.5px] font-black ml-1">
                                                            {nightsCount}박
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    {/* 격자선 레이어 */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                        {timelineDates.map((dStr) => (
                            <div
                                key={`grid-line-${dStr}`}
                                className="grid divide-x divide-gray-300/60 border-b border-gray-300/60"
                                style={{
                                    gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))`,
                                    height: `${ROW_HEIGHT}px`,
                                }}
                            >
                                <div />
                                {ALL_UNITS.map((col) => (
                                    <div key={`grid-cell-${dStr}-${col.key}`} className="h-full" />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}