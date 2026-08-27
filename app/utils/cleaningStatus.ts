import { Booking, UnitConfig } from '../types';
import { isValidBooking } from './bookingUtils';

export type CleaningStatusCode =
    | 'URGENT_CHECKIN'          // 🚨 당일 체크인 있음 (즉시 청소 필요 - 턴어라운드 또는 신규 입실)
    | 'STANDBY_CHECKOUT_ONLY'    // ⏳ 당일 체크아웃만 있음 (당일 입실 없음 - 여유 청소)
    | 'STAY_OVER'                // 🛏️ 연박 투숙 중
    | 'VACANT';                  // ⚪ 공실 (예약 없음)

export interface CleaningStatusInfo {
    statusCode: CleaningStatusCode;
    label: string;
    subLabel: string;
    badgeBg: string;
    cardBg: string;
    cardBorder: string;
    needsCleaning: boolean;
    checkoutBooking?: Booking;
    checkinBooking?: Booking;
    stayBooking?: Booking;
}

/**
 * 예약과 호실(Unit)의 roomId 및 unitId 일치 여부 확인
 */
export function isBookingForUnit(booking: Booking, unit: UnitConfig): boolean {
    const isRoomMatch = Number(booking.roomId) === Number(unit.roomId);
    const isUnitMatch = unit.unitId ? Number(booking.unitId) === Number(unit.unitId) : true;
    return isRoomMatch && isUnitMatch;
}

/**
 * 특정 날짜 기준 호실의 청소 상태 및 우선순위 분석
 */
export function getUnitCleaningStatus(
    unit: UnitConfig,
    dateStr: string,
    bookings: Booking[]
): CleaningStatusInfo {
    const unitBookings = bookings.filter((b) => isValidBooking(b) && isBookingForUnit(b, unit));

    const checkoutBooking = unitBookings.find((b) => b.departure === dateStr);
    const checkinBooking = unitBookings.find((b) => b.arrival === dateStr);
    const stayBooking = unitBookings.find((b) => b.arrival < dateStr && b.departure > dateStr);

    // 1. 당일 체크인이 있는 경우 -> 무조건 최우선 즉시 청소 대상!
    if (checkinBooking) {
        const isTurnaround = !!checkoutBooking;
        return {
            statusCode: 'URGENT_CHECKIN',
            label: isTurnaround ? '🚨 오늘 입실 (당일 교대)' : '🚨 오늘 입실 예정',
            subLabel: isTurnaround ? '체크아웃 + 체크인' : '신규 체크인',
            badgeBg: 'bg-rose-500 text-white',
            cardBg: 'bg-rose-50/80',
            cardBorder: 'border-rose-400 ring-2 ring-rose-300/60 shadow-sm',
            needsCleaning: true,
            checkoutBooking,
            checkinBooking,
        };
    }

    // 2. 당일 체크아웃만 있고 당일 체크인이 없는 경우 -> 여유 청소 대상
    if (checkoutBooking) {
        return {
            statusCode: 'STANDBY_CHECKOUT_ONLY',
            label: '⏳ 오늘 퇴실 (당일 입실 없음)',
            subLabel: '여유 청소 가능',
            badgeBg: 'bg-amber-500 text-white',
            cardBg: 'bg-amber-50/60',
            cardBorder: 'border-amber-300 ring-1 ring-amber-200',
            needsCleaning: true,
            checkoutBooking,
        };
    }

    // 3. 연박 투숙 중인 경우
    if (stayBooking) {
        return {
            statusCode: 'STAY_OVER',
            label: '🛏️ 연박 투숙 중',
            subLabel: `${stayBooking.arrival} ~ ${stayBooking.departure}`,
            badgeBg: 'bg-slate-200 text-slate-700',
            cardBg: 'bg-slate-50/40',
            cardBorder: 'border-gray-200 opacity-80',
            needsCleaning: false,
            stayBooking,
        };
    }

    // 4. 공실
    return {
        statusCode: 'VACANT',
        label: '⚪ 공실 (예약 없음)',
        subLabel: '빈 방',
        badgeBg: 'bg-gray-100 text-gray-400',
        cardBg: 'bg-gray-50/30',
        cardBorder: 'border-dashed border-gray-200 opacity-60',
        needsCleaning: false,
    };
}
