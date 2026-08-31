'use client';

import { useState } from 'react';
import { Booking } from '../../types';
import { PROPERTY_GROUPS, VERTICAL_GRID_COLUMNS, getDayType } from '../../config';
import { isValidBooking, isUnallocatedBooking } from '../../utils/bookingUtils';
import TimelineHeader from './TimelineHeader';
import BookingBar from './BookingBar';
import UnallocatedBookingBar from './UnallocatedBookingBar';
import OverlappingSelectionModal from '../modals/OverlappingSelectionModal';

interface BookingNoteData {
    note: string;
    tags: string[];
}

interface VerticalTimelineProps {
    timelineDates: string[];
    todayStr: string;
    selectedDate: string | null;
    bookings: Booking[];
    bookingNotes: Record<string | number, BookingNoteData>;
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
    const [overlapModalData, setOverlapModalData] = useState<{ dateStr: string; bookings: Booking[] } | null>(null);

    const handleItemClick = (e: React.MouseEvent, clickedBooking: Booking, colRoomId: number, colUnitId?: number) => {
        e.stopPropagation();

        // 클릭된 예약과 해당 호실에서 날짜가 겹치는 모든 예약(확정 + 미배정) 찾기
        const overlapping = bookings.filter((b) => {
            if (!isValidBooking(b)) return false;
            const isRoom = Number(b.roomId) === colRoomId;
            if (!isRoom) return false;

            // 날짜 겹침 판별 (arrival1 < departure2 && departure1 > arrival2)
            const isDateOverlap = clickedBooking.arrival < b.departure && clickedBooking.departure > b.arrival;
            if (!isDateOverlap) return false;

            // 해당 호실에 배정된 예약이거나, 미배정 예약인 경우
            const isTargetUnit = colUnitId ? Number(b.unitId) === colUnitId || isUnallocatedBooking(b) : true;
            return isTargetUnit;
        });

        if (overlapping.length > 1) {
            // 2개 이상 겹치면 중첩 선택 모달 오픈!
            setOverlapModalData({
                dateStr: `${clickedBooking.arrival} ~ ${clickedBooking.departure}`,
                bookings: overlapping,
            });
        } else {
            // 겹치지 않는 단독 예약은 바로 상세 팝업 오픈
            onBookingClick(e, clickedBooking);
        }
    };

    return (
        <div className="grid-table-container">
            <div className="min-w-max">
                {/* 2단 고정 헤더 */}
                <TimelineHeader />

                {/* 타임라인 메인 바디 영역 */}
                <div className="relative w-full">
                    {/* 날짜 행 목록 */}
                    {timelineDates.map((dStr) => {
                        const isToday = dStr === todayStr;
                        const isSelected = selectedDate === dStr;
                        const isOtherSelected = selectedDate !== null && !isSelected;
                        const dayInfo = getDayType(dStr);

                        const dateObj = new Date(dStr);
                        const month = dateObj.getMonth() + 1;
                        const dayNum = dateObj.getDate();
                        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];

                        let cellStyleClass = 'bg-white text-gray-950 font-bold';
                        if (isSelected) {
                            cellStyleClass = '!bg-amber-500 !text-white font-black shadow-inner';
                        } else if (isToday) {
                            cellStyleClass = '!bg-blue-600 !text-white font-black shadow-inner';
                        } else if (dayInfo.type === 'sunday' || dayInfo.type === 'holiday') {
                            cellStyleClass = '!bg-red-50 !text-red-700 font-black';
                        } else if (dayInfo.type === 'saturday') {
                            cellStyleClass = '!bg-blue-50 !text-blue-700 font-black';
                        }

                        return (
                            <div
                                key={`row-${dStr}`}
                                onClick={() => onDateClick(dStr)}
                                style={{ height: `${ROW_HEIGHT}px`, gridTemplateColumns: VERTICAL_GRID_COLUMNS }}
                                className={`grid divide-x divide-gray-300 border-b border-gray-300 transition-all duration-150 cursor-pointer ${isSelected
                                    ? 'bg-amber-50/80 font-black'
                                    : isOtherSelected
                                        ? 'bg-gray-50/40 hover:bg-gray-100/60'
                                        : 'bg-white hover:bg-gray-50/80'
                                    }`}
                            >
                                {/* 📌 좌측 날짜 2중 틀고정 열 */}
                                <div
                                    className={`sticky-left p-2 flex flex-col items-center justify-center text-xs transition-colors border-r border-gray-300 select-none shadow-xs ${cellStyleClass}`}
                                >
                                    <div>{month}/{dayNum}</div>
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
                                                className={`h-full ${isSelected
                                                    ? 'bg-amber-100/30'
                                                    : isToday
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
                                    // 1. 일반 확정 배정된 예약 목록
                                    const unitBookings = bookings.filter((b) => {
                                        if (!isValidBooking(b) || isUnallocatedBooking(b)) return false;
                                        const isRoomMatch = Number(b.roomId) === col.roomId;
                                        const isUnitMatch = col.unitId ? Number(b.unitId) === col.unitId : true;
                                        return isRoomMatch && isUnitMatch;
                                    });

                                    // 2. 해당 룸 타입의 미배정 예약 목록
                                    const unallocatedForCol = bookings.filter((b) => {
                                        if (!isValidBooking(b) || !isUnallocatedBooking(b)) return false;
                                        return Number(b.roomId) === col.roomId;
                                    });

                                    return (
                                        <div key={`overlay-${col.key}`} className="relative w-full h-full">
                                            {/* 1. 일반 확정 예약 바 */}
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
                                                        noteData={bookingNotes[b.id] || bookingNotes[Number(b.id)] || bookingNotes[String(b.id)]}
                                                        onClick={(e, booking) => handleItemClick(e, booking, col.roomId, col.unitId)}
                                                    />
                                                );
                                            })}

                                            {/* 2. ⚠️ 미배정 예약 점선 반투명 바 (동일 룸타입 컬럼에 오버레이 표시) */}
                                            {unallocatedForCol.map((b) => {
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
                                                    <UnallocatedBookingBar
                                                        key={`unalloc-${col.key}-${b.id}`}
                                                        booking={b}
                                                        topPos={topPos}
                                                        barHeight={barHeight}
                                                        isDimmed={isBookingDimmed}
                                                        onClick={(e, booking) => handleItemClick(e, booking, col.roomId, col.unitId)}
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

            {/* 겹쳐진 예약 선택 모달 */}
            {overlapModalData && (
                <OverlappingSelectionModal
                    dateStr={overlapModalData.dateStr}
                    bookings={overlapModalData.bookings}
                    onSelect={(selectedBooking) => {
                        onBookingClick(undefined as any, selectedBooking);
                        setOverlapModalData(null);
                    }}
                    onClose={() => setOverlapModalData(null)}
                />
            )}
        </div>
    );
}