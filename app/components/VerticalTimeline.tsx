'use client';

import { Booking } from '../types';
import { PROPERTY_GROUPS, ALL_UNITS, getChannelStyle, getDayType } from '../config';

interface VerticalTimelineProps {
    timelineDates: string[];
    todayStr: string;
    selectedDate: string | null;
    bookings: Booking[];
    bookingMemos: { [bookingId: number]: string };
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
    bookingMemos,
    ROW_HEIGHT,
    displayDaysCount,
    onDateClick,
    onBookingClick,
}: VerticalTimelineProps) {
    return (
        <div className="grid-table-container">
            <div className="min-w-max">
                {/* 1단: 숙소 그룹 헤더 (색상 및 시각적 병합 적용) */}
                <div
                    className="grid-row-header-1 divide-x divide-gray-300"
                    style={{ gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))` }}
                >
                    <div className="cell-corner">숙소명</div>
                    {PROPERTY_GROUPS.map((group) => (
                        <div
                            key={group.name}
                            className={`p-2 flex items-center justify-center font-extrabold text-xs md:text-sm shadow-sm ${group.themeClass}`}
                            style={{ gridColumn: `span ${group.units.length}` }}
                        >
                            {group.name}
                        </div>
                    ))}
                </div>

                {/* 2단: 세부 호실 헤더 */}
                <div
                    className="grid-row-header-2 divide-x divide-gray-300"
                    style={{ gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))` }}
                >
                    <div className="p-2 flex items-center justify-center bg-gray-200 text-gray-600 text-xs">
                        날짜 / 호실
                    </div>
                    {ALL_UNITS.map((col) => (
                        <div key={col.key} className="p-2 flex flex-col justify-center min-h-[45px]">
                            {col.subName && (
                                <span className="text-[10px] text-gray-400 font-normal">{col.subName}</span>
                            )}
                            <span className="text-xs md:text-sm text-gray-900 font-bold">{col.displayName}</span>
                        </div>
                    ))}
                </div>

                {/* Y축 타임라인 레이어 */}
                <div className="relative w-full">
                    {/* 1. 배경 날짜 셀 */}
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
                                    className={`p-2 flex flex-col items-center justify-center font-bold text-xs transition-colors ${isSelected
                                            ? 'bg-amber-500 text-white font-extrabold'
                                            : isToday
                                                ? 'bg-blue-600 text-white'
                                                : dayColorClass
                                        }`}
                                >
                                    <div>
                                        {month}/{dayNum}
                                    </div>
                                    <div className="text-[10px] opacity-90 flex items-center gap-1">
                                        <span>({dayOfWeek})</span>
                                        {dayInfo.label && <span className="text-[9px] font-extrabold truncate">[{dayInfo.label}]</span>}
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

                    {/* 2. 예약 박스 레이어 */}
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
                                        const hasMemo = Boolean(bookingMemos[b.id]);

                                        return (
                                            <div
                                                key={b.id}
                                                onClick={(e) => onBookingClick(e, b)}
                                                className={`absolute left-1 right-1 rounded-lg shadow-md p-1.5 flex flex-col justify-between font-bold text-xs pointer-events-auto transition-all duration-200 hover:brightness-105 hover:z-30 cursor-pointer border border-black/10 ${isBookingDimmed ? 'booking-card-dimmed' : 'opacity-100'
                                                    } ${hasMemo ? 'animate-pulse-memo' : ''}`}
                                                style={{
                                                    top: `${topPos}px`,
                                                    height: `${barHeight}px`,
                                                    backgroundColor: ch.bg,
                                                    color: ch.text,
                                                }}
                                                title={`${ch.name} | ${guestName} (${b.arrival} 체크인 ~ ${b.departure} 체크아웃, ${nightsCount}박)`}
                                            >
                                                <div className="flex flex-col gap-0.5 leading-tight">
                                                    <div className="text-[11px] font-extrabold truncate">
                                                        📥 {guestName}
                                                    </div>
                                                    <div className="text-[9px] opacity-85 font-medium truncate">
                                                        {ch.name}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-[11px] font-extrabold mt-auto pt-0.5">
                                                    <div>
                                                        {hasMemo && (
                                                            <span className="text-[9px] font-extrabold text-amber-900 bg-amber-300/90 px-1 py-0.5 rounded shadow-sm">
                                                                특이사항🔥
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span>{nightsCount}박</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    {/* 3. 격자선 레이어 */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
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