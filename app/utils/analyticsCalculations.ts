// 🧮 매출 & 가동률 계산 전담 엔진 모듈

import { Booking } from '../types';
import { ALL_UNITS, getChannelStyle } from '../config';
import { getGuestCountryInfo } from './countryHelper';
import { calculateNetPayout, getUnitForBooking, getBookingDateKST } from './bookingUtils';

export type TimeFilterRange = 'last7' | 'last30' | 'thisMonth' | 'next30' | 'all' | 'custom';
export type DateFilterMode = 'booked' | 'stay'; // 🛒 예약 접수일 기준 (Beds24 공식) vs 🛏️ 체크아웃/정산 기준

export interface OverallSummary {
    totalRevenue: number;     // 총 매출액 (Gross - 체크아웃 기준)
    netRevenue: number;       // 순매출 추정액 (수수료 20% 제외)
    occupancyRate: number;    // 평균 가동률 (%) (실제 투숙 박수 기준)
    adr: number;              // 1박 평균 객실 단가 (체크아웃 매출 / 박수)
    totalBookings: number;    // 체크아웃 완료 예약 총 건수
    totalNights: number;      // 실제 판매된 총 투숙 박수
    startDateStr: string;     // 시작일
    endDateStr: string;       // 종료일
    periodDays: number;       // 기간 일수
    dateMode: DateFilterMode; // 집계 기준 모드
}

/**
 * 로컬 타임존(KST 등)을 안전하게 유지하며 YYYY-MM-DD 문자열로 변환하는 유틸
 * (toISOString() 사용 시 발생하는 UTC 9시간 시차 왜곡 방지)
 */
export function formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * 선택된 기간 옵션에 따라 시작일과 종료일(YYYY-MM-DD) 및 기간 일수 계산
 */
export function getDateRangeByFilter(
    filter: TimeFilterRange,
    customStart?: string,
    customEnd?: string,
    bookings?: Booking[]
): { start: string; end: string; days: number } {
    const today = new Date();
    const todayStr = formatLocalDate(today);

    if (filter === 'custom' && customStart && customEnd) {
        const s = new Date(customStart);
        const e = new Date(customEnd);
        const diffMs = e.getTime() - s.getTime();
        const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
        return { start: customStart, end: customEnd, days };
    }

    if (filter === 'last7') {
        const past = new Date(today);
        past.setDate(today.getDate() - 6);
        return { start: formatLocalDate(past), end: todayStr, days: 7 };
    }

    if (filter === 'last30') {
        const past = new Date(today);
        past.setDate(today.getDate() - 29);
        return { start: formatLocalDate(past), end: todayStr, days: 30 };
    }

    if (filter === 'thisMonth') {
        const y = today.getFullYear();
        const m = today.getMonth();
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);
        return {
            start: formatLocalDate(firstDay),
            end: formatLocalDate(lastDay),
            days: lastDay.getDate(),
        };
    }

    if (filter === 'next30') {
        const future = new Date(today);
        future.setDate(today.getDate() + 30);
        return { start: todayStr, end: formatLocalDate(future), days: 31 };
    }

    // 'all' (전체 기간: 첫 예약 arrival ~ 마지막 예약 departure)
    if (filter === 'all') {
        if (bookings && bookings.length > 0) {
            const valid = bookings.filter(isValidBooking);
            if (valid.length > 0) {
                let minArrival = valid[0].arrival;
                let maxDeparture = valid[0].departure;
                for (let i = 1; i < valid.length; i++) {
                    const b = valid[i];
                    if (b.arrival < minArrival) minArrival = b.arrival;
                    if (b.departure > maxDeparture) maxDeparture = b.departure;
                }
                const s = new Date(minArrival);
                const e = new Date(maxDeparture);
                const diffMs = e.getTime() - s.getTime();
                const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
                return {
                    start: minArrival,
                    end: maxDeparture,
                    days,
                };
            }
        }

        // bookings가 아직 로드되지 않은 초기 상태 폴백 (과거 2년 ~ 미래 1년)
        const pastAll = new Date(today);
        pastAll.setDate(today.getDate() - 730);
        const futureAll = new Date(today);
        futureAll.setDate(today.getDate() + 365);
        const diffMs = futureAll.getTime() - pastAll.getTime();
        return {
            start: formatLocalDate(pastAll),
            end: formatLocalDate(futureAll),
            days: Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1,
        };
    }

    return {
        start: todayStr,
        end: todayStr,
        days: 1,
    };
}

/**
 * 헬퍼: 유효 예약 여부 검사
 */
function isValidBooking(b: Booking): boolean {
    if (!b.arrival || !b.departure) return false;
    if (b.status === 'cancelled' || b.status === 'deleted' || b.status === 'inquiry') return false;
    return true;
}

/**
 * 헬퍼: 특정 날짜 문자열(YYYY-MM-DD)을 'days' 만큼 더한 날짜 문자열 반환
 */
function addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return formatLocalDate(date);
}

/**
 * 1. 전체 요약 지표 계산
 * - 💰 매출: 선택 기간 내 [체크아웃]한 예약 기준 (플랫폼 정산서와 100% 일치)
 * - 📈 가동률: 선택 기간 내 [실제 숙소에 머문 투숙 박수] 기준 (운영 현황 일치)
 */
export function calculateOverallSummary(
    bookings: Booking[],
    filter: TimeFilterRange,
    customStart?: string,
    customEnd?: string,
    mode: DateFilterMode = 'stay'
): OverallSummary {
    const { start, end, days } = getDateRangeByFilter(filter, customStart, customEnd, bookings);
    const validBookings = bookings.filter(isValidBooking);

    // 1. 💰 매출액 & ADR: 기간 내 체크아웃(departure)한 예약 집계
    const checkoutBookings = validBookings.filter((b) => {
        return b.departure >= start && b.departure <= end;
    });

    let totalRevenue = 0;
    let checkoutNights = 0;

    checkoutBookings.forEach((b) => {
        const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId);
        totalRevenue += price;

        const arr = new Date(b.arrival);
        const dep = new Date(b.departure);
        const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
        checkoutNights += nights;
    });

    const netRevenue = totalRevenue;
    const adr = checkoutNights > 0 ? Math.round(totalRevenue / checkoutNights) : 0;

    // 2. 📈 가동률: 기간(start ~ end) 내에 각 날짜별 실제 판매된 숙박일수(Nights) 합산
    let totalStayNights = 0;

    // 기간 내 각 일자 순회 (start부터 end까지)
    for (let i = 0; i < days; i++) {
        const targetDate = addDays(start, i);
        if (targetDate > end) break;

        // targetDate 밤에 머문 예약 카운트 (arrival <= targetDate && departure > targetDate)
        const activeRoomsOnDate = new Set<string>();
        validBookings.forEach((b) => {
            if (b.arrival <= targetDate && b.departure > targetDate) {
                const matchedUnit = ALL_UNITS.find(
                    (u) => Number(b.roomId) === u.roomId && (u.unitId ? Number(b.unitId) === u.unitId : true)
                );
                const roomKey = matchedUnit ? matchedUnit.key : `${b.roomId}-${b.unitId || 1}`;
                activeRoomsOnDate.add(roomKey);
            }
        });
        totalStayNights += activeRoomsOnDate.size;
    }

    const totalRooms = ALL_UNITS.length || 14;
    const totalAvailableRoomNights = totalRooms * days;
    const rawOccupancy = totalAvailableRoomNights > 0 ? (totalStayNights / totalAvailableRoomNights) * 100 : 0;
    const occupancyRate = Math.min(100, Math.round(rawOccupancy * 10) / 10);

    return {
        totalRevenue,
        netRevenue,
        occupancyRate,
        adr,
        totalBookings: checkoutBookings.length,
        totalNights: totalStayNights,
        startDateStr: start,
        endDateStr: end,
        periodDays: days,
        dateMode: mode,
    };
}

export interface DayTypeAdr {
    weekdayAdr: number;      // 월~목 1박 평균단가
    weekdayNights: number;   // 월~목 투숙 박수
    weekendAdr: number;      // 금~토 1박 평균단가
    weekendNights: number;   // 금~토 투숙 박수
    sundayAdr: number;       // 일요일 1박 평균단가
    sundayNights: number;    // 일요일 투숙 박수
}

export interface PropertyStats {
    propName: string;
    roomCount: number;
    totalRevenue: number;     // 해당 숙소 총 매출 (체크아웃 기준)
    netRevenue: number;       // 해당 숙소 순매출 (20% 수수료 제외)
    totalBookings: number;    // 해당 숙소 체크아웃 예약 건수
    totalNights: number;      // 해당 숙소 실제 판매된 투숙 박수
    occupancyRate: number;    // 해당 숙소 가동률 (%)
    adr: number;              // 1박 평균 객실 단가
    revenueShare: number;     // 전체 매출 중 점유율 (%)
    dayTypeAdr: DayTypeAdr;   // 요일별 3분류(월~목, 금~토, 일) 단가
}

/**
 * 2. 🏢 숙소(건물)별 매출(체크아웃 기준) 및 가동률(실투숙 박수 기준) 통계 계산
 */
export function calculatePropertyStats(
    bookings: Booking[],
    filter: TimeFilterRange,
    customStart?: string,
    customEnd?: string,
    mode: DateFilterMode = 'stay'
): PropertyStats[] {
    const { start, end, days } = getDateRangeByFilter(filter, customStart, customEnd, bookings);
    const validBookings = bookings.filter(isValidBooking);

    // 숙소별 데이터 맵 초기화
    const propMap: Record<string, {
        roomCount: number;
        revenue: number;
        checkoutNights: number;
        checkoutBookings: number;
        stayNights: number;
        weekdayRev: number;
        weekdayNights: number;
        weekendRev: number;
        weekendNights: number;
        sundayRev: number;
        sundayNights: number;
    }> = {};

    ALL_UNITS.forEach((u) => {
        const pName = u.propName || '기타 숙소';
        if (!propMap[pName]) {
            propMap[pName] = {
                roomCount: 0,
                revenue: 0,
                checkoutNights: 0,
                checkoutBookings: 0,
                stayNights: 0,
                weekdayRev: 0,
                weekdayNights: 0,
                weekendRev: 0,
                weekendNights: 0,
                sundayRev: 0,
                sundayNights: 0,
            };
        }
        propMap[pName].roomCount += 1;
    });

    // 1. 매출: 체크아웃 기준
    let overallTotalRevenue = 0;
    const checkoutBookings = validBookings.filter((b) => b.departure >= start && b.departure <= end);

    checkoutBookings.forEach((b) => {
        const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId);
        overallTotalRevenue += price;

        const arr = new Date(b.arrival);
        const dep = new Date(b.departure);
        const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));

        const matchedUnit = getUnitForBooking(b);
        const propName = matchedUnit?.propName || '기타 숙소';

        if (!propMap[propName]) {
            propMap[propName] = {
                roomCount: 1,
                revenue: 0,
                checkoutNights: 0,
                checkoutBookings: 0,
                stayNights: 0,
                weekdayRev: 0,
                weekdayNights: 0,
                weekendRev: 0,
                weekendNights: 0,
                sundayRev: 0,
                sundayNights: 0,
            };
        }
        propMap[propName].revenue += price;
        propMap[propName].checkoutNights += nights;
        propMap[propName].checkoutBookings += 1;
    });

    // 2. 가동률 & 요일별 단가: 일자별 실제 판매 박수 집계
    for (let i = 0; i < days; i++) {
        const targetDate = addDays(start, i);
        if (targetDate > end) break;

        const dObj = new Date(targetDate);
        const dayOfWeek = dObj.getDay(); // 0: 일, 1~4: 월~목, 5~6: 금~토

        validBookings.forEach((b) => {
            if (b.arrival <= targetDate && b.departure > targetDate) {
                const matchedUnit = getUnitForBooking(b);
                const propName = matchedUnit?.propName || '기타 숙소';
                if (propMap[propName]) {
                    propMap[propName].stayNights += 1;

                    const arr = new Date(b.arrival);
                    const dep = new Date(b.departure);
                    const totalN = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
                    const dailyRate = calculateNetPayout(Number(b.price) || 0, b.apiSourceId) / totalN;

                    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
                        propMap[propName].weekdayRev += dailyRate;
                        propMap[propName].weekdayNights += 1;
                    } else if (dayOfWeek === 5 || dayOfWeek === 6) {
                        propMap[propName].weekendRev += dailyRate;
                        propMap[propName].weekendNights += 1;
                    } else if (dayOfWeek === 0) {
                        propMap[propName].sundayRev += dailyRate;
                        propMap[propName].sundayNights += 1;
                    }
                }
            }
        });
    }

    // 3. 결과 리스트 변환
    const result: PropertyStats[] = Object.entries(propMap).map(([propName, data]) => {
        const availNights = (data.roomCount || 1) * days;
        const occ = availNights > 0 ? Math.min(100, Math.round((data.stayNights / availNights) * 1000) / 10) : 0;
        const propAdr = data.checkoutNights > 0 ? Math.round(data.revenue / data.checkoutNights) : 0;
        const share = overallTotalRevenue > 0 ? Math.round((data.revenue / overallTotalRevenue) * 1000) / 10 : 0;
        const net = data.revenue;

        const weekdayAdr = data.weekdayNights > 0 ? Math.round(data.weekdayRev / data.weekdayNights) : 0;
        const weekendAdr = data.weekendNights > 0 ? Math.round(data.weekendRev / data.weekendNights) : 0;
        const sundayAdr = data.sundayNights > 0 ? Math.round(data.sundayRev / data.sundayNights) : 0;

        return {
            propName,
            roomCount: data.roomCount,
            totalRevenue: data.revenue,
            netRevenue: net,
            totalBookings: data.checkoutBookings,
            totalNights: data.stayNights,
            occupancyRate: occ,
            adr: propAdr,
            revenueShare: share,
            dayTypeAdr: {
                weekdayAdr,
                weekdayNights: data.weekdayNights,
                weekendAdr,
                weekendNights: data.weekendNights,
                sundayAdr,
                sundayNights: data.sundayNights,
            },
        };
    });

    return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export interface RoomStats {
    unitKey: string;
    roomName: string;
    propName: string;
    roomId: number;
    unitId?: number;
    totalRevenue: number;     // 해당 호실 총 매출 (체크아웃 기준)
    netRevenue: number;       // 해당 호실 순매출 (20% 수수료 제외)
    totalBookings: number;    // 해당 호실 체크아웃 건수
    totalNights: number;      // 해당 호실 실제 판매된 투숙 박수
    vacantNights: number;     // 해당 호실 실제 공실 박수
    occupancyRate: number;    // 해당 호실 가동률 (%)
    adr: number;              // 1박 평균 객실 단가
    revenueShare: number;     // 전체 매출 중 점유율 (%)
    dayTypeAdr: DayTypeAdr;   // 요일별 3분류(월~목, 금~토, 일) 단가
}

/**
 * 3. 🚪 개별 객실(호실)별 매출(체크아웃 기준) 및 실투숙/공실 박수 계산
 */
export function calculateRoomStats(
    bookings: Booking[],
    filter: TimeFilterRange,
    customStart?: string,
    customEnd?: string,
    mode: DateFilterMode = 'stay'
): RoomStats[] {
    const { start, end, days } = getDateRangeByFilter(filter, customStart, customEnd, bookings);
    const validBookings = bookings.filter(isValidBooking);

    // 14개 전체 호실 맵 초기화
    const roomMap: Record<string, {
        roomName: string;
        propName: string;
        roomId: number;
        unitId?: number;
        revenue: number;
        checkoutNights: number;
        checkoutBookings: number;
        stayNights: number;
        weekdayRev: number;
        weekdayNights: number;
        weekendRev: number;
        weekendNights: number;
        sundayRev: number;
        sundayNights: number;
    }> = {};

    ALL_UNITS.forEach((u) => {
        const fullRoomName = u.displayName + (u.subName ? ` (${u.subName})` : '');
        roomMap[u.key] = {
            roomName: fullRoomName,
            propName: u.propName || '기타 숙소',
            roomId: u.roomId,
            unitId: u.unitId,
            revenue: 0,
            checkoutNights: 0,
            checkoutBookings: 0,
            stayNights: 0,
            weekdayRev: 0,
            weekdayNights: 0,
            weekendRev: 0,
            weekendNights: 0,
            sundayRev: 0,
            sundayNights: 0,
        };
    });

    // 1. 매출: 체크아웃 기준
    let overallTotalRevenue = 0;
    const checkoutBookings = validBookings.filter((b) => b.departure >= start && b.departure <= end);

    checkoutBookings.forEach((b) => {
        const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId);
        overallTotalRevenue += price;

        const arr = new Date(b.arrival);
        const dep = new Date(b.departure);
        const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));

        const matchedUnit = getUnitForBooking(b);

        if (matchedUnit && roomMap[matchedUnit.key]) {
            roomMap[matchedUnit.key].revenue += price;
            roomMap[matchedUnit.key].checkoutNights += nights;
            roomMap[matchedUnit.key].checkoutBookings += 1;
        }
    });

    // 2. 가동률 & 공실 & 요일별 단가: 일자별 실제 판매 박수 집계
    for (let i = 0; i < days; i++) {
        const targetDate = addDays(start, i);
        if (targetDate > end) break;

        const dObj = new Date(targetDate);
        const dayOfWeek = dObj.getDay(); // 0: 일, 1~4: 월~목, 5~6: 금~토

        validBookings.forEach((b) => {
            if (b.arrival <= targetDate && b.departure > targetDate) {
                const matchedUnit = getUnitForBooking(b);
                if (matchedUnit && roomMap[matchedUnit.key]) {
                    roomMap[matchedUnit.key].stayNights += 1;

                    const arr = new Date(b.arrival);
                    const dep = new Date(b.departure);
                    const totalN = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
                    const dailyRate = calculateNetPayout(Number(b.price) || 0, b.apiSourceId) / totalN;

                    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
                        roomMap[matchedUnit.key].weekdayRev += dailyRate;
                        roomMap[matchedUnit.key].weekdayNights += 1;
                    } else if (dayOfWeek === 5 || dayOfWeek === 6) {
                        roomMap[matchedUnit.key].weekendRev += dailyRate;
                        roomMap[matchedUnit.key].weekendNights += 1;
                    } else if (dayOfWeek === 0) {
                        roomMap[matchedUnit.key].sundayRev += dailyRate;
                        roomMap[matchedUnit.key].sundayNights += 1;
                    }
                }
            }
        });
    }

    // 3. 결과 변환
    const result: RoomStats[] = Object.entries(roomMap).map(([unitKey, data]) => {
        const occ = days > 0 ? Math.min(100, Math.round((data.stayNights / days) * 1000) / 10) : 0;
        const roomAdr = data.checkoutNights > 0 ? Math.round(data.revenue / data.checkoutNights) : 0;
        const share = overallTotalRevenue > 0 ? Math.round((data.revenue / overallTotalRevenue) * 1000) / 10 : 0;
        const net = data.revenue;
        const vacant = Math.max(0, days - data.stayNights);

        const weekdayAdr = data.weekdayNights > 0 ? Math.round(data.weekdayRev / data.weekdayNights) : 0;
        const weekendAdr = data.weekendNights > 0 ? Math.round(data.weekendRev / data.weekendNights) : 0;
        const sundayAdr = data.sundayNights > 0 ? Math.round(data.sundayRev / data.sundayNights) : 0;

        return {
            unitKey,
            roomName: data.roomName,
            propName: data.propName,
            roomId: data.roomId,
            unitId: data.unitId,
            totalRevenue: data.revenue,
            netRevenue: net,
            totalBookings: data.checkoutBookings,
            totalNights: data.stayNights,
            vacantNights: vacant,
            occupancyRate: occ,
            adr: roomAdr,
            revenueShare: share,
            dayTypeAdr: {
                weekdayAdr,
                weekdayNights: data.weekdayNights,
                weekendAdr,
                weekendNights: data.weekendNights,
                sundayAdr,
                sundayNights: data.sundayNights,
            },
        };
    });

    return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export interface ChannelStats {
    name: string;
    code: string;
    count: number;            // 예약 건수
    nights: number;           // 투숙 박수
    revenue: number;          // 총 결제 매출액
    netRevenue: number;       // 순매출액 (20% 수수료 제외)
    percentage: number;       // 건수 기준 점유율 (%)
    revenueShare: number;     // 매출액 기준 점유율 (%)
    adr: number;              // 해당 채널 1박 평균 단가
    color: string;            // 브랜드 고유 색상
    bookings: Booking[];      // 해당 채널의 예약 객체 목록
}

// 플랫폼 고유 브랜드 색상 매핑
const CHANNEL_COLORS: Record<string, string> = {
    'Airbnb': '#FF5A5F',
    'Agoda': '#EAA315',
    'Booking.com': '#003580',
    'Trip.com': '#2681FF',
    'Expedia': '#64748B',
    '직접 예약': '#10B981',
    '기타': '#64748B',
};

/**
 * 4. 🍩 플랫폼(채널)별 예약 건수, 매출액, 점유율 비중 통계 계산
 * - mode === 'booked': 예약 접수일(bookingTime) 기준 유입 통계 (Beds24 공식 일치)
 * - mode === 'stay': 기간 내 체크아웃(departure) 기준 플랫폼별 매출 및 정산 통계
 */
export function calculateChannelStats(
    bookings: Booking[],
    filter: TimeFilterRange,
    customStart?: string,
    customEnd?: string,
    mode: DateFilterMode = 'booked'
): { channelList: ChannelStats[]; totalBookings: number; totalRevenue: number } {
    const { start, end } = getDateRangeByFilter(filter, customStart, customEnd, bookings);
    const validBookings = bookings.filter(isValidBooking);

    // 모드별 필터링
    const targetBookings = validBookings.filter((b) => {
        if (mode === 'booked') {
            const bDateStr = getBookingDateKST(b.bookingTime, b.arrival);
            return bDateStr >= start && bDateStr <= end;
        } else {
            // 체크아웃 기준 정산
            return b.departure >= start && b.departure <= end;
        }
    });

    let totalRevenue = 0;
    const totalBookings = targetBookings.length;
    const channelMap: Record<string, { count: number; nights: number; revenue: number; color: string; bookings: Booking[] }> = {};

    targetBookings.forEach((b) => {
        const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId);
        totalRevenue += price;

        const arr = new Date(b.arrival);
        const dep = new Date(b.departure);
        const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));

        const ch = getChannelStyle(b.apiSourceId);
        const chName = ch.name || '기타';
        const chColor = CHANNEL_COLORS[chName] || ch.bg || '#64748B';

        if (!channelMap[chName]) {
            channelMap[chName] = { count: 0, nights: 0, revenue: 0, color: chColor, bookings: [] };
        }
        channelMap[chName].count += 1;
        channelMap[chName].nights += nights;
        channelMap[chName].revenue += price;
        channelMap[chName].bookings.push(b);
    });

    const channelList: ChannelStats[] = Object.entries(channelMap).map(([name, data]) => {
        const countPct = totalBookings > 0 ? Math.round((data.count / totalBookings) * 1000) / 10 : 0;
        const revShare = totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0;
        const adr = data.nights > 0 ? Math.round(data.revenue / data.nights) : 0;
        const net = data.revenue;

        return {
            name,
            code: name.toLowerCase().replace(/\s+/g, ''),
            count: data.count,
            nights: data.nights,
            revenue: data.revenue,
            netRevenue: net,
            percentage: countPct,
            revenueShare: revShare,
            adr,
            color: data.color,
            bookings: data.bookings,
        };
    });

    return {
        channelList: channelList.sort((a, b) => b.count - a.count),
        totalBookings,
        totalRevenue,
    };
}

export interface CountryStats {
    countryCode: string;
    countryName: string;
    flag: string;
    count: number;            // 예약 건수
    nights: number;           // 투숙 박수
    revenue: number;          // 총 결제 매출액
    netRevenue: number;       // 순매출액 (20% 수수료 제외)
    percentage: number;       // 건수 기준 점유율 (%)
    revenueShare: number;     // 매출액 기준 점유율 (%)
    adr: number;              // 1박 평균 단가
    color: string;            // 국가 고유 테마 색상
}

/**
 * 5. 🌍 게스트 국적별 예약 건수, 매출액, 점유율 비중 통계 계산
 * - mode === 'booked': 예약 접수일(bookingTime) 기준 유입 통계
 * - mode === 'stay': 기간 내 체크아웃(departure) 기준 플랫폼별 실정산 통계
 */
export function calculateCountryStats(
    bookings: Booking[],
    filter: TimeFilterRange,
    customStart?: string,
    customEnd?: string,
    mode: DateFilterMode = 'booked',
    unitKeyFilter?: string
): { countryList: CountryStats[]; totalBookings: number; totalRevenue: number } {
    const { start, end } = getDateRangeByFilter(filter, customStart, customEnd, bookings);
    const validBookings = bookings.filter(isValidBooking);

    // 모드 및 특정 호실 필터링
    const targetBookings = validBookings.filter((b) => {
        if (unitKeyFilter && unitKeyFilter !== 'all') {
            const matchedUnit = getUnitForBooking(b);
            if (!matchedUnit || matchedUnit.key !== unitKeyFilter) return false;
        }

        if (mode === 'booked') {
            const bDateStr = getBookingDateKST(b.bookingTime, b.arrival);
            return bDateStr >= start && bDateStr <= end;
        } else {
            return b.departure >= start && b.departure <= end;
        }
    });

    let totalRevenue = 0;
    const totalBookings = targetBookings.length;
    const countryMap: Record<string, {
        countryName: string;
        flag: string;
        count: number;
        nights: number;
        revenue: number;
        color: string;
    }> = {};

    targetBookings.forEach((b) => {
        const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId);
        totalRevenue += price;

        const arr = new Date(b.arrival);
        const dep = new Date(b.departure);
        const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));

        const cInfo = getGuestCountryInfo(b);
        const cKey = cInfo.code;

        if (!countryMap[cKey]) {
            countryMap[cKey] = {
                countryName: cInfo.name,
                flag: cInfo.flag,
                count: 0,
                nights: 0,
                revenue: 0,
                color: cInfo.color,
            };
        }
        countryMap[cKey].count += 1;
        countryMap[cKey].nights += nights;
        countryMap[cKey].revenue += price;
    });

    const countryList: CountryStats[] = Object.entries(countryMap).map(([code, data]) => {
        const countPct = totalBookings > 0 ? Math.round((data.count / totalBookings) * 1000) / 10 : 0;
        const revShare = totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0;
        const adr = data.nights > 0 ? Math.round(data.revenue / data.nights) : 0;
        const net = data.revenue;

        return {
            countryCode: code,
            countryName: data.countryName,
            flag: data.flag,
            count: data.count,
            nights: data.nights,
            revenue: data.revenue,
            netRevenue: net,
            percentage: countPct,
            revenueShare: revShare,
            adr,
            color: data.color,
        };
    });

    return {
        countryList: countryList.sort((a, b) => b.count - a.count),
        totalBookings,
        totalRevenue,
    };
}

export interface CountryRoomPreference {
    unitKey: string;
    roomName: string;
    propName: string;
    count: number;            // 해당 호실 예약 건수
    nights: number;           // 투숙 박수
    revenue: number;          // 총 결제금액
    netRevenue: number;       // 순매출액 (80%)
    percentage: number;       // 해당 국가 전체 예약 중 비중 (%)
    adr: number;              // 1박 평균 단가
}

/**
 * 🏆 특정 국가 게스트가 가장 선호하는 인기 호실 랭킹 계산
 */
export function calculateCountryRoomPreferences(
    bookings: Booking[],
    countryCode: string,
    filter: TimeFilterRange,
    customStart?: string,
    customEnd?: string,
    mode: DateFilterMode = 'stay'
): CountryRoomPreference[] {
    const { start, end } = getDateRangeByFilter(filter, customStart, customEnd);
    const validBookings = bookings.filter(isValidBooking);

    // 1. 기간 및 국적 필터링
    const targetBookings = validBookings.filter((b) => {
        const bDateStr = getBookingDateKST(b.bookingTime, b.arrival);
        const isDateMatch = mode === 'booked'
            ? (bDateStr >= start && bDateStr <= end)
            : (b.departure >= start && b.departure <= end);

        if (!isDateMatch) return false;

        const cInfo = getGuestCountryInfo(b);
        return countryCode && countryCode !== 'ALL' ? cInfo.code === countryCode : true;
    });

    const totalCountryBookings = targetBookings.length;
    const roomMap: Record<string, { roomName: string; propName: string; count: number; nights: number; revenue: number }> = {};

    targetBookings.forEach((b) => {
        const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId);
        const arr = new Date(b.arrival);
        const dep = new Date(b.departure);
        const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));

        const matchedUnit = getUnitForBooking(b);
        const uKey = matchedUnit ? matchedUnit.key : `${b.roomId}-${b.unitId || 1}`;
        const rName = matchedUnit ? matchedUnit.displayName + (matchedUnit.subName ? ` (${matchedUnit.subName})` : '') : `호실(${b.roomId})`;
        const pName = matchedUnit?.propName || '기타 숙소';

        if (!roomMap[uKey]) {
            roomMap[uKey] = { roomName: rName, propName: pName, count: 0, nights: 0, revenue: 0 };
        }
        roomMap[uKey].count += 1;
        roomMap[uKey].nights += nights;
        roomMap[uKey].revenue += price;
    });

    const result: CountryRoomPreference[] = Object.entries(roomMap).map(([key, data]) => {
        const pct = totalCountryBookings > 0 ? Math.round((data.count / totalCountryBookings) * 1000) / 10 : 0;
        const adr = data.nights > 0 ? Math.round(data.revenue / data.nights) : 0;
        const net = data.revenue;

        return {
            unitKey: key,
            roomName: data.roomName,
            propName: data.propName,
            count: data.count,
            nights: data.nights,
            revenue: data.revenue,
            netRevenue: net,
            percentage: pct,
            adr,
        };
    });

    return result.sort((a, b) => b.count - a.count || b.revenue - a.revenue);
}


