import { Booking, UnitConfig } from '../types';
import { ALL_UNITS } from '../config';

/**
 * 🛡️ 유효한 활성 예약인지 검증 (취소, 삭제, 단순 숙소 문의 필터링)
 */
export function isValidBooking(booking?: Booking | null): boolean {
    if (!booking) return false;
    const status = (booking.status || '').toLowerCase().trim();
    if (status === 'cancelled' || status === 'deleted' || status === 'inquiry') {
        return false;
    }
    return true;
}

/**
 * 🏠 예약 정보를 기반으로 일치하는 호실(UnitConfig) 안전 매칭
 * - 1차: roomId와 unitId가 모두 일치하는 호실
 * - 2차: unitId가 없는 경우 roomId가 일치하는 첫 번째 호실로 fallback 매칭
 */
export function getUnitForBooking(booking?: Booking | null): UnitConfig | undefined {
    if (!booking || !booking.roomId) return undefined;

    const bRoomId = Number(booking.roomId);
    const bUnitId = booking.unitId !== undefined && booking.unitId !== null && Number(booking.unitId) > 0
        ? Number(booking.unitId)
        : null;

    // 1차 시도: roomId와 unitId 완벽 일치
    if (bUnitId !== null) {
        const exactMatch = ALL_UNITS.find((u) => u.roomId === bRoomId && u.unitId === bUnitId);
        if (exactMatch) return exactMatch;
    }

    // 2차 시도: unitId가 없거나 매칭되지 않은 경우 roomId만으로 매칭 (단일 유닛 호실 또는 미지정 예약 대응)
    const roomMatches = ALL_UNITS.filter((u) => u.roomId === bRoomId);
    if (roomMatches.length === 1) {
        return roomMatches[0];
    } else if (roomMatches.length > 1) {
        return roomMatches[0];
    }

    return undefined;
}
