'use client';

import { Booking } from '../../types';
import { PROPERTY_GROUPS, VERTICAL_GRID_COLUMNS, getDayType } from '../../config';
import TimelineHeader from './TimelineHeader';
import BookingBar from './BookingBar';

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

                {/* 1. 상단 틀고정 헤더 모듈 */}
                <TimelineHeader />

                {/* 2. 타임라인 본문 레이어 */}
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
                                    gridTemplateColumns: VERTICAL_GRID_COLUMNS,
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

                                {PROPERTY_GROUPS.map((group, idx) => (
                                    <div key={`row-${dStr}-${group.name}`} className="contents">
                                        {group.units.map((col) => (
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
                                        {idx < PROPERTY_GROUPS.length - 1 && (
                                            <div className="property-divider-pillar" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        );
                    })}

                    {/* 오버레이 예약 박스 레이어 */}
                    <div
                        className="absolute top-0 left-0 w-full h-full pointer-events-none grid z-10"
                        style={{ gridTemplateColumns: VERTICAL_GRID_COLUMNS }}
                    >
                        <div />

                        {PROPERTY_GROUPS.map((group, idx) => (
                            <div key={`overlay-group-${group.name}`} className="contents">
                                {group.units.map((col) => {
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

                                                const isBookingInSelectedDate =
                                                    selectedDate !== null &&
                                                    selectedDate >= b.arrival &&
                                                    selectedDate <= lastNightStr;
                                                const isBookingDimmed = selectedDate !== null && !isBookingInSelectedDate;

                                                return (
                                                    <BookingBar
                                                        key={b.id}
                                                        booking={b}
                                                        topPos={topPos}
                                                        barHeight={barHeight}
                                                        nightsCount={nightsCount}
                                                        isDimmed={isBookingDimmed}
                                                        noteData={bookingNotes[b.id]}
                                                        onClick={onBookingClick}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                                {idx < PROPERTY_GROUPS.length - 1 && <div />}
                            </div>
                        ))}
                    </div>

                    {/* 격자선 레이어 */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                        {timelineDates.map((dStr) => (
                            <div
                                key={`grid-line-${dStr}`}
                                className="grid divide-x divide-gray-300/60 border-b border-gray-300/60"
                                style={{
                                    gridTemplateColumns: VERTICAL_GRID_COLUMNS,
                                    height: `${ROW_HEIGHT}px`,
                                }}
                            >
                                <div />
                                {PROPERTY_GROUPS.map((group, idx) => (
                                    <div key={`grid-group-${dStr}-${group.name}`} className="contents">
                                        {group.units.map((col) => (
                                            <div key={`grid-cell-${dStr}-${col.key}`} className="h-full" />
                                        ))}
                                        {idx < PROPERTY_GROUPS.length - 1 && <div />}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                </div>

            </div>
        </div>
    );
}