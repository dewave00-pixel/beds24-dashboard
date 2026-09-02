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

/**
 * ⚠️ 미배정(Unallocated) 예약 여부 검증
 * - 취소/삭제/문의가 아니면서 유효한 예약
 * - roomId는 존재하지만 unitId가 0, null, undefined이거나 미배정인 경우
 */
export function isUnallocatedBooking(booking?: Booking | null): boolean {
    if (!booking || !isValidBooking(booking)) return false;
    const bUnitId = booking.unitId !== undefined && booking.unitId !== null ? Number(booking.unitId) : 0;
    return bUnitId === 0;
}

/**
 * 🏢 특정 roomId에 속한 배정 가능 호실(UnitConfig) 목록 조회
 */
export function getUnitsForRoomId(roomId?: number | string | null): UnitConfig[] {
    if (!roomId) return [];
    const rId = Number(roomId);
    return ALL_UNITS.filter((u) => u.roomId === rId);
}

/**
 * 🚨 호실 배정 시 날짜 중복(더블 부킹) 충돌 검사
 * - 두 예약 A, B가 겹치는 조건: A.arrival < B.departure && A.departure > B.arrival
 * - 대상 호실(roomId, unitId)이 같으면서 ID가 다른 예약 중 겹치는 예약 목록 반환
 */
export function findConflictingBookings(
    targetBooking: Booking,
    targetRoomId: number,
    targetUnitId: number,
    allBookings: Booking[]
): Booking[] {
    const bId = Number(targetBooking.id);
    const arrival = targetBooking.arrival;
    const departure = targetBooking.departure;

    if (!arrival || !departure) return [];

    return allBookings.filter((b) => {
        // 자기 자신이거나 취소/문의인 건 제외
        if (Number(b.id) === bId || !isValidBooking(b)) return false;

        // 호실 매칭
        const bRoomId = Number(b.roomId);
        const bUnitId = Number(b.unitId) || 0;
        if (bRoomId !== targetRoomId || bUnitId !== targetUnitId) return false;

        // 날짜 겹침 판별 (체크인 당일과 체크아웃 당일이 같은 것은 정상 턴어라운드이므로 겹치지 않음)
        // 겹침 공식: arrival1 < departure2 && departure1 > arrival2
        const isOverlap = arrival < b.departure && departure > b.arrival;
        return isOverlap;
    });
}

/**
 * 🕒 얼리체크인 태그에서 시간(분 단위) 추출
 * - 오후 1시: 780분 (13:00)
 * - 오후 2시: 840분 (14:00)
 * - 오후 3시: 900분 (15:00)
 * - 오후 4시: 960분 (16:00)
 * - 얼리체크인 없음: 9999분 (맨 뒤 정렬)
 */
export function getEarlyCheckinMinutes(tags?: string[] | null): number {
    if (!tags || tags.length === 0) return 9999;
    const earlyTag = tags.find((t) => t.startsWith('early_') || t === 'early');
    if (!earlyTag) return 9999;

    if (earlyTag.includes('오후 1시')) return 13 * 60;
    if (earlyTag.includes('오후 2시')) return 14 * 60;
    if (earlyTag.includes('오후 3시')) return 15 * 60;
    if (earlyTag.includes('오후 4시')) return 16 * 60;
    if (earlyTag.includes('오전')) {
        const m = earlyTag.match(/오전\s*(\d+)시/);
        if (m) return parseInt(m[1], 10) * 60;
    }
    if (earlyTag.includes('오후')) {
        const m = earlyTag.match(/오후\s*(\d+)시/);
        if (m) {
            let h = parseInt(m[1], 10);
            if (h < 12) h += 12;
            return h * 60;
        }
    }
    const timeMatch = earlyTag.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
        return parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
    }
    return 14 * 60; // 시간 미기재 시 기본 14시 취급
}

/**
 * 📥 체크인 예약 목록을 '얼리체크인 빠른 시간 순서'로 우선 정렬
 * 1순위: 얼리체크인 시간 빠른 순 (13시 -> 14시 -> 15시 -> 16시)
 * 2순위: 얼리체크인 없는 일반 예약
 */
export function sortBookingsByEarlyCheckin(
    bookings: Booking[],
    bookingNotes: Record<string | number, { tags?: string[] }>
): Booking[] {
    return [...bookings].sort((a, b) => {
        const aNotes = bookingNotes[a.id] || bookingNotes[Number(a.id)] || bookingNotes[String(a.id)];
        const bNotes = bookingNotes[b.id] || bookingNotes[Number(b.id)] || bookingNotes[String(b.id)];

        const aMinutes = getEarlyCheckinMinutes(aNotes?.tags);
        const bMinutes = getEarlyCheckinMinutes(bNotes?.tags);

        if (aMinutes !== bMinutes) {
            return aMinutes - bMinutes; // 빠른 시간 순
        }

        return Number(a.id) - Number(b.id);
    });
}

