import { Booking, UnitConfig } from '../types';
import { isValidBooking } from './bookingUtils';

export type CleaningStatusCode =
    | 'URGENT_CHECKIN'          // 오늘 체크인 있음 (당일 턴어라운드 - 오늘 퇴실+입실 동시 발생)
    | 'READY_CHECKIN'           // 입실 준비완료 (공실 텀 이후 입실 - 직전 퇴실일 청소완료 DB 검증됨)
    | 'UNCONFIRMED_CHECKIN'     // 직전 청소 미확인 (공실 텀 입실이나 직전 퇴실일 청소완료 기록 없음 - 확인 및 청소 필수)
    | 'STANDBY_CHECKOUT_ONLY'    // 당일 체크아웃만 있음 (당일 입실 없음 - 여유 청소)
    | 'STAY_OVER'                // 연박 투숙 중
    | 'VACANT';                  // 공실 (예약 없음)

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
    prevDepartureDate?: string;
    prevCleaningStaff?: string;
    prevCompletedAt?: string;
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
 * 특정 날짜 기준 호실의 청소 상태 및 우선순위 분석 (직전 체크아웃 DB 이력 반영)
 */
export function getUnitCleaningStatus(
    unit: UnitConfig,
    dateStr: string,
    bookings: Booking[],
    cleaningHistoryMap?: Record<string, Record<string, { isCompleted?: boolean; staffName?: string; completedAt?: string }>>
): CleaningStatusInfo {
    const unitBookings = bookings.filter((b) => isValidBooking(b) && isBookingForUnit(b, unit));

    const checkoutBooking = unitBookings.find((b) => b.departure === dateStr);
    const checkinBooking = unitBookings.find((b) => b.arrival === dateStr);
    const stayBooking = unitBookings.find((b) => b.arrival < dateStr && b.departure > dateStr);

    // 1. 당일 체크인이 있는 경우
    if (checkinBooking) {
        // Case A: 당일 체크아웃도 같이 있는 경우 (당일 턴어라운드 / 교대) -> 무조건 최우선 당일 즉시 청소!
        if (checkoutBooking) {
            return {
                statusCode: 'URGENT_CHECKIN',
                label: '오늘 체크인 (당일 교대)',
                subLabel: '체크아웃 + 체크인',
                badgeBg: 'bg-rose-500 text-white',
                cardBg: 'bg-rose-50/80 dark:bg-rose-950/30',
                cardBorder: 'border-rose-400 dark:border-rose-800 ring-2 ring-rose-300/60 dark:ring-rose-900/60 shadow-sm',
                needsCleaning: true,
                checkoutBooking,
                checkinBooking,
            };
        }

        // Case B: 오늘 체크아웃은 없고 이전에 비어있던 방 (공실 텀 이후 입실)
        // 해당 호실의 직전 퇴실일(prevDeparture) 탐색
        const pastBookings = unitBookings
            .filter((b) => b.departure < dateStr)
            .sort((a, b) => b.departure.localeCompare(a.departure));
        const prevCheckoutBooking = pastBookings[0];
        const prevDepartureDate = prevCheckoutBooking?.departure;

        // 직전 퇴실일의 DB 청소 완료 이력 확인
        const prevCleaning = prevDepartureDate ? cleaningHistoryMap?.[prevDepartureDate]?.[unit.key] : undefined;
        const isPrevCompleted = !!prevCleaning?.isCompleted;

        if (prevDepartureDate && isPrevCompleted) {
            // 직전 청소 완료가 DB로 확인된 경우 -> 준비 완료 (에메랄드, 청소 대상 제외)
            const staffPart = prevCleaning.staffName ? `${prevCleaning.staffName} 완료` : '청소 완료';
            const timePart = prevCleaning.completedAt ? `(${prevCleaning.completedAt})` : '';
            return {
                statusCode: 'READY_CHECKIN',
                label: '입실 준비완료 (검증됨)',
                subLabel: `${prevDepartureDate} ${staffPart} ${timePart}`.trim(),
                badgeBg: 'bg-emerald-600 text-white',
                cardBg: 'bg-emerald-50/70 dark:bg-emerald-950/30',
                cardBorder: 'border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-200 dark:ring-emerald-900/50 shadow-2xs',
                needsCleaning: false,
                checkinBooking,
                prevDepartureDate,
                prevCleaningStaff: prevCleaning.staffName,
                prevCompletedAt: prevCleaning.completedAt,
            };
        }

        // 직전 청소 완료 기록이 없거나 미완료인 경우 -> 확인 필요 경고 (청소 대상 포함)
        return {
            statusCode: 'UNCONFIRMED_CHECKIN',
            label: prevDepartureDate ? `직전 청소 미확인 (${prevDepartureDate} 퇴실)` : '청소 이력 미확인',
            subLabel: '체크인 전 상태확인 및 청소 필수',
            badgeBg: 'bg-amber-600 text-white',
            cardBg: 'bg-amber-50/80 dark:bg-amber-950/30',
            cardBorder: 'border-amber-400 dark:border-amber-700 ring-2 ring-amber-300/60 dark:ring-amber-900/50 shadow-xs',
            needsCleaning: true,
            checkinBooking,
            prevDepartureDate,
        };
    }

    // 2. 당일 체크아웃만 있고 당일 체크인이 없는 경우 -> 여유 청소 대상
    if (checkoutBooking) {
        return {
            statusCode: 'STANDBY_CHECKOUT_ONLY',
            label: '오늘 체크아웃 (체크인 없음)',
            subLabel: '여유 청소 가능',
            badgeBg: 'bg-amber-500 text-white',
            cardBg: 'bg-amber-50/60 dark:bg-amber-950/30',
            cardBorder: 'border-amber-300 dark:border-amber-800 ring-1 ring-amber-200 dark:ring-amber-900/50',
            needsCleaning: true,
            checkoutBooking,
        };
    }

    // 3. 연박 투숙 중인 경우
    if (stayBooking) {
        return {
            statusCode: 'STAY_OVER',
            label: '연박 투숙 중',
            subLabel: `${stayBooking.arrival} ~ ${stayBooking.departure}`,
            badgeBg: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
            cardBg: 'bg-slate-50/40 dark:bg-slate-900/40',
            cardBorder: 'border-gray-200 dark:border-slate-800 opacity-80',
            needsCleaning: false,
            stayBooking,
        };
    }

    // 4. 공실
    return {
        statusCode: 'VACANT',
        label: '공실 (예약 없음)',
        subLabel: '빈 방',
        badgeBg: 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500',
        cardBg: 'bg-gray-50/30 dark:bg-slate-900/20',
        cardBorder: 'border-dashed border-gray-200 dark:border-slate-800 opacity-60',
        needsCleaning: false,
    };
}
