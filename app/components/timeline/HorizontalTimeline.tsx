'use client';

import { Booking } from '../../types';
import { PROPERTY_GROUPS, ALL_UNITS, getChannelStyle, getDayType, parseBookingTag } from '../../config';

interface BookingNoteData {
    note: string;
    tags: string[];
}

interface HorizontalTimelineProps {
    timelineDates: string[];
    todayStr: string;
    selectedDate: string | null;
    bookings: Booking[];
    bookingNotes: { [bookingId: number]: BookingNoteData };
    COL_WIDTH: number;
    ROW_HEIGHT: number;
    onDateClick: (dateStr: string) => void;
    onBookingClick: (e: React.MouseEvent, booking: Booking) => void;
}

export default function HorizontalTimeline({
    timelineDates,
    todayStr,
    selectedDate,
    bookings,
    bookingNotes,
    COL_WIDTH,
    ROW_HEIGHT,
    onDateClick,
    onBookingClick,
}: HorizontalTimelineProps) {
    return (
        <div className="grid-table-container">
            <div className="min-w-max">

                {/* 상단 날짜 헤더 */}
                <div
                    className="grid divide-x divide-gray-300 border-b-2 border-gray-300 bg-gray-100 font-bold text-xs"
                    style={{ gridTemplateColumns: `200px repeat(${timelineDates.length}, ${COL_WIDTH}px)` }}
                >
                    <div className="sticky-corner-1 p-2 flex items-center justify-center bg-gray-200 text-gray-700 font-extrabold border-r border-gray-300">
                        숙소 / 날짜 ➔
                    </div>
                    {timelineDates.map((dStr) => {
                        const dObj = new Date(dStr);
                        const month = dObj.getMonth() + 1;
                        const dayNum = dObj.getDate();
                        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dObj.getDay()];
                        const isToday = dStr === todayStr;
                        const isSelected = selectedDate === dStr;

                        const dayInfo = getDayType(dStr);
                        let dayColorClass = 'hover:bg-gray-200 text-gray-800 bg-gray-100';
                        if (dayInfo.type === 'saturday') dayColorClass = 'day-saturday';
                        if (dayInfo.type === 'sunday' || dayInfo.type === 'holiday') dayColorClass = 'day-sunday-holiday';

                        return (
                            <div
                                key={`h-header-${dStr}`}
                                onClick={() => onDateClick(dStr)}
                                className={`sticky-top-1 p-1.5 flex flex-col items-center justify-center cursor-pointer transition ${isSelected
                                    ? 'bg-amber-500 text-white font-extrabold'
                                    : isToday
                                        ? 'bg-blue-600 text-white font-extrabold'
                                        : dayColorClass
                                    }`}
                            >
                                <div>
                                    {month}/{dayNum}
                                </div>
                                <div className="text-[10px] opacity-90 flex items-center gap-0.5">
                                    <span>({dayOfWeek})</span>
                                    {dayInfo.label && <span className="text-[8px] truncate">[{dayInfo.label}]</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Y축 & 타임라인 본문 */}
                <div className="relative w-full">
                    {PROPERTY_GROUPS.map((group) => {
                        return (
                            <div key={`group-block-${group.name}`} className="border-b-[5px] border-slate-400">
                                {group.units.map((unit, uIdx) => {
                                    const isFirstInGroup = uIdx === 0;

                                    return (
                                        <div
                                            key={`h-row-${unit.key}`}
                                            className="grid divide-x divide-gray-300 border-b border-gray-200 bg-white"
                                            style={{
                                                gridTemplateColumns: `200px repeat(${timelineDates.length}, ${COL_WIDTH}px)`,
                                                height: `${ROW_HEIGHT}px`,
                                            }}
                                        >
                                            <div className="sticky-left flex h-full border-r border-gray-300 bg-gray-50 z-20">
                                                <div
                                                    className={`w-24 shrink-0 flex items-center justify-center font-extrabold text-xs text-center p-1 border-r border-gray-300 ${group.themeClass
                                                        } ${isFirstInGroup ? 'opacity-100' : 'opacity-90'}`}
                                                >
                                                    {isFirstInGroup ? group.name : ''}
                                                </div>

                                                <div className="grow flex items-center justify-center px-1 font-bold text-xs text-gray-800 bg-white">
                                                    {unit.displayName}
                                                </div>
                                            </div>

                                            {timelineDates.map((dStr) => {
                                                const isToday = dStr === todayStr;
                                                const isSelected = selectedDate === dStr;
                                                const dayInfo = getDayType(dStr);

                                                return (
                                                    <div
                                                        key={`h-cell-${unit.key}-${dStr}`}
                                                        onClick={() => onDateClick(dStr)}
                                                        className={`h-full cursor-pointer ${isSelected
                                                            ? 'bg-amber-100/60'
                                                            : isToday
                                                                ? 'bg-blue-50/40'
                                                                : dayInfo.type === 'saturday'
                                                                    ? 'bg-blue-50/20'
                                                                    : dayInfo.type === 'sunday' || dayInfo.type === 'holiday'
                                                                        ? 'bg-red-50/20'
                                                                        : 'hover:bg-gray-50'
                                                            }`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {/* 오버레이 예약 박스 레이어 */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                        {ALL_UNITS.map((unit, globalUnitIdx) => {
                            const unitBookings = bookings.filter((b) => {
                                const isRoomMatch = Number(b.roomId) === unit.roomId;
                                const isUnitMatch = unit.unitId ? Number(b.unitId) === unit.unitId : true;
                                return isRoomMatch && isUnitMatch;
                            });

                            const topPos = globalUnitIdx * ROW_HEIGHT + 3;
                            const barHeight = ROW_HEIGHT - 6;

                            return unitBookings.map((b) => {
                                const startIndex = timelineDates.indexOf(b.arrival);
                                const depDateObj = new Date(b.departure);
                                depDateObj.setDate(depDateObj.getDate() - 1);
                                const lastNightStr = depDateObj.toISOString().split('T')[0];
                                const lastNightIndex = timelineDates.indexOf(lastNightStr);

                                if (startIndex === -1 && lastNightIndex === -1) return null;

                                const startCol = startIndex === -1 ? 0 : startIndex;
                                const endCol = lastNightIndex === -1 ? timelineDates.length - 1 : lastNightIndex;
                                const nightsCount = Math.max(1, endCol - startCol + 1);

                                const leftPos = 200 + startCol * COL_WIDTH + 3;
                                const barWidth = nightsCount * COL_WIDTH - 6;

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

                                const earlyTagKey = activeTags.find((t) => t.startsWith('early_'));
                                const earlyTagInfo = earlyTagKey ? parseBookingTag(earlyTagKey) : null;
                                const bottomTags = activeTags.filter((t) => !t.startsWith('early_'));

                                return (
                                    <div
                                        key={`h-booking-${b.id}`}
                                        onClick={(e) => onBookingClick(e, b)}
                                        className={`absolute rounded-md shadow px-1.5 py-1 flex items-center justify-between font-bold text-xs pointer-events-auto transition-all duration-200 hover:brightness-105 hover:z-30 cursor-pointer border border-black/15 overflow-hidden ${isBookingDimmed ? 'booking-card-dimmed' : 'opacity-100'
                                            } ${hasMemo ? 'animate-pulse-memo' : ''}`}
                                        style={{
                                            top: `${topPos}px`,
                                            left: `${leftPos}px`,
                                            width: `${barWidth}px`,
                                            height: `${barHeight}px`,
                                            backgroundColor: ch.bg,
                                            color: ch.text,
                                        }}
                                        title={`${ch.name} | ${guestName} (${b.arrival} ~ ${b.departure}, ${nightsCount}박)`}
                                    >
                                        {/* 좌측: 이름 + 사이트 + [얼리 뱃지] */}
                                        <div className="flex items-center gap-1 truncate shrink">
                                            <span className="text-[10px] md:text-[11px] font-black truncate">
                                                📥 {guestName}
                                            </span>
                                            <span className="text-[8.5px] opacity-85 font-bold truncate">
                                                ({ch.name})
                                            </span>
                                            {earlyTagInfo && (
                                                <span className="text-[7.5px] font-black px-1 py-0.2 rounded bg-black/50 text-white flex items-center gap-0.5 shadow shrink-0 border border-white/30">
                                                    {earlyTagInfo.icon} {earlyTagInfo.label}
                                                </span>
                                            )}
                                        </div>

                                        {/* 우측: 2줄 자동 줄바꿈 뱃지 + 박수 */}
                                        <div className="flex items-center gap-0.5 shrink-0 ml-1">
                                            <div className="flex flex-wrap items-center gap-0.5 max-w-[120px]">
                                                {hasMemo && (
                                                    <span className="text-[7.5px] font-black text-white bg-red-600 px-1 py-0.2 rounded shadow border border-white/50">
                                                        🔥메모
                                                    </span>
                                                )}

                                                {bottomTags.map((tagKey) => {
                                                    const tagInfo = parseBookingTag(tagKey);
                                                    if (!tagInfo) return null;
                                                    return (
                                                        <span
                                                            key={tagKey}
                                                            className="text-[7px] font-extrabold px-1 py-0.2 rounded bg-black/50 text-white flex items-center gap-0.5 shadow border border-white/30"
                                                        >
                                                            {tagInfo.icon}{tagInfo.label}
                                                        </span>
                                                    );
                                                })}
                                            </div>

                                            <span className="text-[9.5px] md:text-[10.5px] font-black ml-0.5">{nightsCount}박</span>
                                        </div>
                                    </div>
                                );
                            });
                        })}
                    </div>

                </div>
            </div>
        </div>
    );
}