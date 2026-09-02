'use client';

import React from 'react';
import { Booking } from '../../types';
import { PROPERTY_GROUPS, ALL_UNITS, getChannelStyle, getDayType, parseBookingTag } from '../../config';
import { isValidBooking, isUnallocatedBooking } from '../../utils/bookingUtils';

interface BookingNoteData {
    note: string;
    tags: string[];
}

interface HorizontalTimelineProps {
    timelineDates: string[];
    todayStr: string;
    selectedDate: string | null;
    bookings: Booking[];
    bookingNotes: Record<string | number, BookingNoteData>;
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
                            <div key={`group-block-${group.name}`} className="border-b-8 border-slate-300">
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
                            // 1. 일반 확정 배정된 예약 목록
                            const unitBookings = bookings.filter((b) => {
                                if (!isValidBooking(b) || isUnallocatedBooking(b)) return false;
                                const isRoomMatch = Number(b.roomId) === unit.roomId;
                                const isUnitMatch = unit.unitId ? Number(b.unitId) === unit.unitId : true;
                                return isRoomMatch && isUnitMatch;
                            });

                            // 2. 해당 룸 타입의 미배정 예약 목록
                            const unallocatedForUnit = bookings.filter((b) => {
                                if (!isValidBooking(b) || !isUnallocatedBooking(b)) return false;
                                return Number(b.roomId) === unit.roomId;
                            });

                            const topPos = globalUnitIdx * ROW_HEIGHT + 3;
                            const barHeight = ROW_HEIGHT - 6;

                            return (
                                <React.Fragment key={`h-unit-layer-${unit.key}`}>
                                    {/* 1. 일반 확정 예약 */}
                                    {unitBookings.map((b) => {
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

                                        const noteData = bookingNotes[b.id] || bookingNotes[Number(b.id)] || bookingNotes[String(b.id)];
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
                                                        {guestName}
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

                                                {/* 우측: 메모 뱃지 + 태그 + 박수 */}
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
                                    })}

                                    {/* 2. ⚠️ 미배정 점선 반투명 바 */}
                                    {unallocatedForUnit.map((b) => {
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

                                        const guestName =
                                            b.firstName || b.lastName
                                                ? `${b.firstName || ''} ${b.lastName || ''}`.trim()
                                                : `예약 #${b.id}`;

                                        const isBookingInSelectedDate =
                                            selectedDate !== null &&
                                            selectedDate >= b.arrival &&
                                            selectedDate <= lastNightStr;
                                        const isBookingDimmed = selectedDate !== null && !isBookingInSelectedDate;

                                        return (
                                            <div
                                                key={`h-unalloc-${unit.key}-${b.id}`}
                                                onClick={(e) => onBookingClick(e, b)}
                                                className={`absolute rounded-md border-2 border-dashed border-amber-500 bg-amber-500/25 hover:bg-amber-500/40 hover:border-amber-600 px-2 py-1 flex items-center justify-between font-black text-xs pointer-events-auto transition-all cursor-pointer z-15 overflow-hidden select-none group ${isBookingDimmed ? 'opacity-30' : 'opacity-90 hover:opacity-100'
                                                    }`}
                                                style={{
                                                    top: `${topPos}px`,
                                                    left: `${leftPos}px`,
                                                    width: `${barWidth}px`,
                                                    height: `${barHeight}px`,
                                                }}
                                                title={`[호실 미배정] ${guestName} (${b.arrival} ~ ${b.departure}) - 클릭하여 배정`}
                                            >
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="text-[10px] font-black text-amber-950 bg-amber-300 px-1 py-0.2 rounded shrink-0 animate-pulse">
                                                        ⚠️ 미배정
                                                    </span>
                                                    <span className="truncate text-slate-900 font-black">{guestName}</span>
                                                    <span className="text-[10px] text-amber-900 font-bold shrink-0">({nightsCount}박)</span>
                                                </div>

                                                <span className="text-[9px] font-black text-blue-900 bg-white/80 group-hover:bg-white px-1.5 py-0.5 rounded border border-amber-400 shrink-0">
                                                    배정 ➔
                                                </span>
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </div>

                </div>
            </div>
        </div>
    );
}