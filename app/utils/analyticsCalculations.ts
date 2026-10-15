// 🧮 매출 & 가동률 계산 전담 엔진 모듈

import { Booking } from '../types';
import { ALL_UNITS, PROPERTY_GROUPS, ROOM_TYPES, getChannelStyle } from '../config';
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
    mode: DateFilterMode = 'stay',
    targetProperty?: string,
    targetUnitKey?: string
): OverallSummary {
    const { start, end, days } = getDateRangeByFilter(filter, customStart, customEnd, bookings);
    const validBookings = bookings.filter(isValidBooking);

    // 대상 유닛 필터링
    let targetUnits = ALL_UNITS;
    if (targetUnitKey && targetUnitKey !== 'all') {
        targetUnits = ALL_UNITS.filter((u) => u.key === targetUnitKey);
    } else if (targetProperty && targetProperty !== 'all') {
        targetUnits = ALL_UNITS.filter((u) => u.propName === targetProperty);
    }
    const targetUnitKeys = new Set(targetUnits.map((u) => u.key));

    // 1. 💰 매출액 & ADR: 기간 내 체크아웃(departure)한 예약 중 대상 호실 집계
    const checkoutBookings = validBookings.filter((b) => {
        if (b.departure < start || b.departure > end) return false;
        if (targetUnitKey && targetUnitKey !== 'all') {
            const u = getUnitForBooking(b);
            return u?.key === targetUnitKey;
        }
        if (targetProperty && targetProperty !== 'all') {
            const u = getUnitForBooking(b);
            return u?.propName === targetProperty;
        }
        return true;
    });

    let totalRevenue = 0;
    let checkoutNights = 0;

    checkoutBookings.forEach((b) => {
        const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);
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
                if (matchedUnit && targetUnitKeys.has(matchedUnit.key)) {
                    activeRoomsOnDate.add(matchedUnit.key);
                }
            }
        });
        totalStayNights += activeRoomsOnDate.size;
    }

    const totalRooms = targetUnits.length || 1;
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
        const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);
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
                    const dailyRate = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime) / totalN;

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

export interface RoomChannelStat {
    channelName: string;
    displayName: string;
    color: string;
    count: number;        // 해당 객실 예약 건수
    nights: number;       // 해당 객실 투숙 박수
    revenue: number;      // 해당 객실 정산 매출
    share: number;        // 해당 객실 내 점유율 (%)
    bookings?: Booking[]; // 해당 플랫폼으로 예약된 실제 예약 목록
}

export interface RoomStats {
    unitKey: string;
    roomName: string;
    displayName?: string;
    propName: string;
    roomId: number;
    unitId?: number;
    unitCount: number;        // 해당 객실의 총 유닛(호실) 수 (WAVE C, D는 2)
    unitNames: string[];      // 소속 호실명 배열 (예: ['403호', '503호'])
    totalRevenue: number;     // 해당 객실 총 매출 (체크아웃 기준)
    netRevenue: number;       // 해당 객실 순매출
    totalBookings: number;    // 해당 객실 체크아웃 건수
    totalNights: number;      // 해당 객실 실제 판매된 총 투숙 박수 (모든 유닛 합산)
    availableNights: number;  // 총 공급 가능 박수 (days * unitCount)
    vacantNights: number;     // 해당 객실 실제 공실 박수 (availableNights - totalNights)
    occupancyRate: number;    // 해당 객실 가동률 (%) = (totalNights / availableNights) * 100
    adr: number;              // 1박 평균 객실 단가
    avgLeadDays: number;      // 평균 리드타임 (일)
    avgStayNights: number;    // 평균 투숙박수 (박)
    revenueShare: number;     // 전체 매출 중 점유율 (%)
    dayTypeAdr: DayTypeAdr;   // 요일별 3분류(월~목, 금~토, 일) 단가
    channels: RoomChannelStat[];  // 플랫폼(채널)별 예약 현황 목록 (건수/매출 내림차순)
    topChannel?: RoomChannelStat; // 1위 플랫폼
}

/**
 * 3. 🚪 개별 객실(룸타입)별 매출(체크아웃 기준) 및 실투숙/공실 박수 계산 (Unit 수 완벽 반영)
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

    // 13개 표준 객실(룸타입) 맵 초기화
    const roomMap: Record<number, {
        unitKey: string;
        roomName: string;
        displayName: string;
        propName: string;
        roomId: number;
        unitCount: number;
        unitNames: string[];
        revenue: number;
        checkoutNights: number;
        checkoutBookings: number;
        leadDaysSum: number;
        stayNights: number;
        weekdayRev: number;
        weekdayNights: number;
        weekendRev: number;
        weekendNights: number;
        sundayRev: number;
        sundayNights: number;
        channelMap: Record<string, { count: number; nights: number; revenue: number; color: string; displayName: string; bookings: Booking[] }>;
    }> = {};

    ROOM_TYPES.forEach((rt) => {
        roomMap[rt.roomId] = {
            unitKey: String(rt.roomId),
            roomName: rt.displayName,
            displayName: rt.displayName,
            propName: rt.propName,
            roomId: rt.roomId,
            unitCount: rt.unitCount,
            unitNames: rt.units.map((u) => u.displayName),
            revenue: 0,
            checkoutNights: 0,
            checkoutBookings: 0,
            leadDaysSum: 0,
            stayNights: 0,
            weekdayRev: 0,
            weekdayNights: 0,
            weekendRev: 0,
            weekendNights: 0,
            sundayRev: 0,
            sundayNights: 0,
            channelMap: {},
        };
    });

    // 1. 매출: 체크아웃 기준
    let overallTotalRevenue = 0;
    const checkoutBookings = validBookings.filter((b) => b.departure >= start && b.departure <= end);

    checkoutBookings.forEach((b) => {
        const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);
        overallTotalRevenue += price;

        const arr = new Date(b.arrival);
        const dep = new Date(b.departure);
        const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));

        // 리드타임 계산 (접수일 ~ 입실일 KST 기준)
        const bDate = getBookingDateKST(b.bookingTime);
        const arrDate = b.arrival.split('T')[0];
        const bDay = new Date(bDate);
        const aDay = new Date(arrDate);
        const diffDays = Math.max(0, Math.round((aDay.getTime() - bDay.getTime()) / (1000 * 60 * 60 * 24)));

        const rId = Number(b.roomId);
        if (roomMap[rId]) {
            roomMap[rId].revenue += price;
            roomMap[rId].checkoutNights += nights;
            roomMap[rId].checkoutBookings += 1;
            roomMap[rId].leadDaysSum += diffDays;

            // 플랫폼(채널)별 통계 누적
            const ch = getChannelStyle(b.apiSourceId);
            const rawName = ch.name || '기타';
            let channelName = rawName;
            let displayName = rawName;
            let color = '#64748B';

            const apiSourceNum = Number(b.apiSourceId);
            if (rawName.includes('Airbnb') || apiSourceNum === 46) {
                channelName = 'Airbnb';
                displayName = '에어비앤비';
                color = '#FF385C';
            } else if (rawName.includes('Trip') || apiSourceNum === 53) {
                channelName = 'Trip.com';
                displayName = '트립닷컴';
                color = '#2681FF';
            } else if (rawName.includes('Booking') || apiSourceNum === 19) {
                channelName = 'Booking.com';
                displayName = '부킹닷컴';
                color = '#003580';
            } else if (rawName.includes('Agoda') || apiSourceNum === 17) {
                channelName = 'Agoda';
                displayName = '아고다';
                color = '#8B5CF6';
            } else if (rawName.includes('Expedia') || apiSourceNum === 14) {
                channelName = 'Expedia';
                displayName = '익스피디아';
                color = '#EAA812';
            } else {
                channelName = '기타';
                displayName = '기타/직거래';
                color = '#64748B';
            }

            if (!roomMap[rId].channelMap[channelName]) {
                roomMap[rId].channelMap[channelName] = {
                    count: 0,
                    nights: 0,
                    revenue: 0,
                    color,
                    displayName,
                    bookings: [],
                };
            }
            roomMap[rId].channelMap[channelName].count += 1;
            roomMap[rId].channelMap[channelName].nights += nights;
            roomMap[rId].channelMap[channelName].revenue += price;
            roomMap[rId].channelMap[channelName].bookings.push(b);
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
                const rId = Number(b.roomId);
                if (roomMap[rId]) {
                    roomMap[rId].stayNights += 1;

                    const arr = new Date(b.arrival);
                    const dep = new Date(b.departure);
                    const totalN = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
                    const dailyRate = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime) / totalN;

                    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
                        roomMap[rId].weekdayRev += dailyRate;
                        roomMap[rId].weekdayNights += 1;
                    } else if (dayOfWeek === 5 || dayOfWeek === 6) {
                        roomMap[rId].weekendRev += dailyRate;
                        roomMap[rId].weekendNights += 1;
                    } else if (dayOfWeek === 0) {
                        roomMap[rId].sundayRev += dailyRate;
                        roomMap[rId].sundayNights += 1;
                    }
                }
            }
        });
    }

    // 3. 결과 변환 (유닛 수 unitCount를 반영한 공실 및 가동률 계산)
    const result: RoomStats[] = Object.values(roomMap).map((data) => {
        // 🌟 유닛 수를 곱한 총 공급 가능 박수 (예: WAVE C, D는 30일 × 2 = 60박)
        const availableNights = (data.unitCount || 1) * days;
        const occ = availableNights > 0 ? Math.min(100, Math.round((data.stayNights / availableNights) * 1000) / 10) : 0;
        const roomAdr = data.checkoutNights > 0 ? Math.round(data.revenue / data.checkoutNights) : 0;
        const share = overallTotalRevenue > 0 ? Math.round((data.revenue / overallTotalRevenue) * 1000) / 10 : 0;
        const net = data.revenue;
        const vacant = Math.max(0, availableNights - data.stayNights);

        const weekdayAdr = data.weekdayNights > 0 ? Math.round(data.weekdayRev / data.weekdayNights) : 0;
        const weekendAdr = data.weekendNights > 0 ? Math.round(data.weekendRev / data.weekendNights) : 0;
        const sundayAdr = data.sundayNights > 0 ? Math.round(data.sundayRev / data.sundayNights) : 0;

        // 플랫폼별 정렬 및 비중 계산
        const totalRoomBookings = data.checkoutBookings;
        const channels: RoomChannelStat[] = Object.entries(data.channelMap).map(([chKey, chData]) => {
            const chShare = totalRoomBookings > 0 ? Math.round((chData.count / totalRoomBookings) * 1000) / 10 : 0;
            return {
                channelName: chKey,
                displayName: chData.displayName,
                color: chData.color,
                count: chData.count,
                nights: chData.nights,
                revenue: chData.revenue,
                share: chShare,
                bookings: [...chData.bookings].sort((a, b) => b.arrival.localeCompare(a.arrival)),
            };
        }).sort((a, b) => b.count - a.count || b.revenue - a.revenue);

        const topChannel = channels.length > 0 ? channels[0] : undefined;
        const avgLeadDays = data.checkoutBookings > 0 ? Math.round((data.leadDaysSum / data.checkoutBookings) * 10) / 10 : 0;
        const avgStayNights = data.checkoutBookings > 0 ? Math.round((data.checkoutNights / data.checkoutBookings) * 10) / 10 : 0;

        return {
            unitKey: data.unitKey,
            roomName: data.roomName,
            displayName: data.displayName,
            propName: data.propName,
            roomId: data.roomId,
            unitCount: data.unitCount,
            unitNames: data.unitNames,
            totalRevenue: data.revenue,
            netRevenue: net,
            totalBookings: data.checkoutBookings,
            totalNights: data.stayNights,
            availableNights,
            vacantNights: vacant,
            occupancyRate: occ,
            adr: roomAdr,
            avgLeadDays,
            avgStayNights,
            revenueShare: share,
            dayTypeAdr: {
                weekdayAdr,
                weekdayNights: data.weekdayNights,
                weekendAdr,
                weekendNights: data.weekendNights,
                sundayAdr,
                sundayNights: data.sundayNights,
            },
            channels,
            topChannel,
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

// 플랫폼 고유 브랜드 색상 매핑 (대시보드 config.ts getChannelStyle과 100% 일치)
const CHANNEL_COLORS: Record<string, string> = {
    'Airbnb': '#d9ead3',     // 에어비앤비 (연초록)
    'Trip.com': '#f1c232',   // 트립닷컴 (옐로우)
    'Booking.com': '#4a86e8',// 부킹닷컴 (블루)
    'Agoda': '#9900ff',      // 아고다 (퍼플)
    'Expedia': '#cccccc',    // 익스피디아 (그레이)
    '직접 예약': '#6c757d',  // 직접 예약 (슬레이트)
    '기타': '#6c757d',       // 기타 채널
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
    mode: DateFilterMode = 'booked',
    targetProperty?: string,
    targetUnitKey?: string
): { channelList: ChannelStats[]; totalBookings: number; totalRevenue: number } {
    const { start, end } = getDateRangeByFilter(filter, customStart, customEnd, bookings);
    const validBookings = bookings.filter(isValidBooking);

    // 모드별 + 대상 호실/지점별 필터링
    const targetBookings = validBookings.filter((b) => {
        // 호실 / 지점 필터
        if (targetUnitKey && targetUnitKey !== 'all') {
            const u = getUnitForBooking(b);
            if (!u || u.key !== targetUnitKey) return false;
        } else if (targetProperty && targetProperty !== 'all') {
            const u = getUnitForBooking(b);
            if (!u || u.propName !== targetProperty) return false;
        }

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
        const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);
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

export interface DailyChannelSegment {
    channelName: string;
    color: string;
    revenue: number;
    bookings: number;
    sharePct: number;
}

export interface DailyChannelPoint {
    dateStr: string;
    shortLabel: string;
    dayOfWeek: string;
    isWeekend: boolean;
    totalRevenue: number;
    totalBookings: number;
    channelSegments: DailyChannelSegment[];
}

/**
 * 📊 일자별 채널 매출 & 예약 건수 시계열(스택 바) 데이터 집계
 */
export function calculateDailyChannelTrends(
    bookings: Booking[],
    filter: TimeFilterRange,
    customStart?: string,
    customEnd?: string,
    mode: DateFilterMode = 'stay',
    targetProperty?: string,
    targetUnitKey?: string
): DailyChannelPoint[] {
    const { start, end, days } = getDateRangeByFilter(filter, customStart, customEnd, bookings);
    const validBookings = bookings.filter(isValidBooking);

    const points: DailyChannelPoint[] = [];
    const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

    for (let i = 0; i < days; i++) {
        const curDateStr = addDays(start, i);
        if (curDateStr > end) break;

        const curDate = new Date(curDateStr);
        const dayOfWeek = DAY_NAMES[curDate.getDay()];
        const isWeekend = curDate.getDay() === 0 || curDate.getDay() === 6;
        const [, m, d] = curDateStr.split('-');
        const shortLabel = `${Number(m)}/${Number(d)}`;

        // 해당 날짜에 해당하는 예약 필터링
        const dateBookings = validBookings.filter((b) => {
            // 호실 / 지점 필터
            if (targetUnitKey && targetUnitKey !== 'all') {
                const u = getUnitForBooking(b);
                if (!u || u.key !== targetUnitKey) return false;
            } else if (targetProperty && targetProperty !== 'all') {
                const u = getUnitForBooking(b);
                if (!u || u.propName !== targetProperty) return false;
            }

            if (mode === 'booked') {
                const bDateStr = getBookingDateKST(b.bookingTime, b.arrival);
                return bDateStr === curDateStr;
            } else {
                return b.arrival <= curDateStr && b.departure > curDateStr;
            }
        });

        let dayRevenue = 0;
        const channelAgg: Record<string, { revenue: number; bookings: number; color: string }> = {};

        dateBookings.forEach((b) => {
            const arr = new Date(b.arrival);
            const dep = new Date(b.departure);
            const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
            const fullPrice = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);
            const dayPortionPrice = mode === 'stay' ? Math.round(fullPrice / nights) : fullPrice;

            const ch = getChannelStyle(b.apiSourceId);
            const chName = ch.name || '기타';
            const chColor = CHANNEL_COLORS[chName] || ch.bg || '#64748B';

            if (!channelAgg[chName]) {
                channelAgg[chName] = { revenue: 0, bookings: 0, color: chColor };
            }
            channelAgg[chName].revenue += dayPortionPrice;
            channelAgg[chName].bookings += 1;
            dayRevenue += dayPortionPrice;
        });

        const channelSegments: DailyChannelSegment[] = Object.entries(channelAgg).map(([chName, agg]) => {
            const sharePct = dayRevenue > 0 ? Math.round((agg.revenue / dayRevenue) * 1000) / 10 : 0;
            return {
                channelName: chName,
                color: agg.color,
                revenue: agg.revenue,
                bookings: agg.bookings,
                sharePct,
            };
        });

        channelSegments.sort((a, b) => b.revenue - a.revenue);

        points.push({
            dateStr: curDateStr,
            shortLabel,
            dayOfWeek,
            isWeekend,
            totalRevenue: dayRevenue,
            totalBookings: dateBookings.length,
            channelSegments,
        });
    }

    return points;
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
    unitKeyFilter?: string,
    propertyFilter?: string
): { countryList: CountryStats[]; totalBookings: number; totalRevenue: number } {
    const { start, end } = getDateRangeByFilter(filter, customStart, customEnd, bookings);
    const validBookings = bookings.filter(isValidBooking);

    // 모드 및 특정 호실/지점 필터링
    const targetBookings = validBookings.filter((b) => {
        const matchedUnit = getUnitForBooking(b);
        if (propertyFilter && propertyFilter !== 'all') {
            if (!matchedUnit || matchedUnit.propName !== propertyFilter) return false;
        }
        if (unitKeyFilter && unitKeyFilter !== 'all') {
            if (!matchedUnit || (matchedUnit.key !== unitKeyFilter && String(b.roomId) !== unitKeyFilter)) return false;
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
        const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);
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
    mode: DateFilterMode = 'stay',
    propertyFilter?: string,
    unitKeyFilter?: string
): CountryRoomPreference[] {
    const { start, end } = getDateRangeByFilter(filter, customStart, customEnd, bookings);
    const validBookings = bookings.filter(isValidBooking);

    // 1. 기간, 국적, 지점/호실 필터링
    const targetBookings = validBookings.filter((b) => {
        const matchedUnit = getUnitForBooking(b);
        if (propertyFilter && propertyFilter !== 'all') {
            if (!matchedUnit || matchedUnit.propName !== propertyFilter) return false;
        }
        if (unitKeyFilter && unitKeyFilter !== 'all') {
            if (!matchedUnit || (matchedUnit.key !== unitKeyFilter && String(b.roomId) !== unitKeyFilter)) return false;
        }

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
        const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);
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

// ============================================================================
// ⚖️ 7. A/B 기간 비교 분석기 전담 엔진 (A vs B 증감율 및 차이 계산)
// ============================================================================

export interface PeriodMetrics {
    periodStart: string;
    periodEnd: string;
    periodDays: number;
    totalRevenue: number;
    occupancyRate: number;
    adr: number;
    totalNights: number;
    totalBookings: number;
    avgLeadDays: number;   // ⏱️ 평균 리드타임 (일 전)
    avgStayNights: number; // 🛏️ 평균 투숙기간 (박)
}

export interface PeriodComparisonResult {
    periodA: PeriodMetrics;
    periodB: PeriodMetrics;
    revenueDiff: number;       // 매출 증감액 (A - B)
    revenuePct: number;        // 매출 증감율 (%)
    occupancyDiff: number;     // 가동률 증감 (%p)
    adrDiff: number;           // ADR 증감액 (A - B)
    adrPct: number;            // ADR 증감율 (%)
    nightsDiff: number;        // 판매 박수 증감 (A - B)
    bookingsDiff: number;      // 예약 건수 증감 (A - B)
    leadDaysDiff: number;      // 평균 리드타임 증감 (일)
    stayNightsDiff: number;    // 평균 투숙기간 증감 (박)
}

export interface HierarchicalUnitComparison {
    unitKey: string;
    roomName: string;
    propName: string;
    roomId: number;
    comparison: PeriodComparisonResult;
}

export interface HierarchicalPropertyComparison {
    propName: string;
    label: string;
    unitCount: number;
    comparison: PeriodComparisonResult;
    units: HierarchicalUnitComparison[];
}

export interface HierarchicalComparisonResult {
    overall: PeriodComparisonResult;
    properties: HierarchicalPropertyComparison[];
}

/**
 * 단일 기간에 대한 지표(매출, 가동률, ADR, 박수, 리드타임, 투숙기간 등) 집계 헬퍼 (호실/채널/지점 필터 완벽 지원)
 */
function calculateMetricsForPeriod(
    bookings: Booking[],
    startStr: string,
    endStr: string,
    options?: {
        propName?: string;
        unitKey?: string;
        channelMatch?: string; // 'airbnb' | 'booking' | 'agoda' | 'trip'
    }
): PeriodMetrics {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const diffMs = e.getTime() - s.getTime();
    const periodDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

    const validBookings = bookings.filter(isValidBooking);

    // 대상 유닛 필터링 및 총 유닛 수 산출
    let targetUnits = ALL_UNITS;
    if (options?.propName && options.propName !== 'all') {
        targetUnits = targetUnits.filter((u) => u.propName === options.propName);
    }
    if (options?.unitKey && options.unitKey !== 'all') {
        targetUnits = targetUnits.filter((u) => u.key === options.unitKey || String(u.roomId) === options.unitKey);
    }
    const targetUnitKeys = new Set(targetUnits.map((u) => u.key));
    const unitCount = Math.max(1, targetUnits.length);
    const availableNights = periodDays * unitCount;

    // 1. 매출, 건수, ADR, 리드타임 집계 (기간 내 [체크아웃]한 예약 기준 - 상단 총매출 및 정산서와 100% 일치)
    let totalRevenue = 0;
    let totalBookings = 0;
    let totalLeadDays = 0;
    let leadBookingCount = 0;
    let stayNightsSum = 0;

    validBookings.forEach((b) => {
        // 선택 기간(startStr ~ endStr) 내에 체크아웃(departure)한 예약만 집계
        if (b.departure < startStr || b.departure > endStr) return;

        // 호실 / 지점 필터
        const matchedUnit = getUnitForBooking(b);
        if (options?.propName && options.propName !== 'all') {
            if (matchedUnit && matchedUnit.propName !== options.propName) return;
        }
        if (options?.unitKey && options.unitKey !== 'all') {
            const uKey = matchedUnit?.key || `${b.roomId}-${b.unitId || 1}`;
            if (uKey !== options.unitKey && String(b.roomId) !== options.unitKey) return;
        }

        // OTA 채널 필터
        if (options?.channelMatch && options.channelMatch !== 'all') {
            const srcId = Number(b.apiSourceId);
            let isMatched = false;
            if (options.channelMatch === 'airbnb' && srcId === 46) isMatched = true;
            if (options.channelMatch === 'booking' && srcId === 19) isMatched = true;
            if (options.channelMatch === 'agoda' && srcId === 17) isMatched = true;
            if (options.channelMatch === 'trip' && srcId === 53) isMatched = true;
            if (!isMatched) return;
        }

        const netPayout = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);
        const arr = new Date(b.arrival);
        const dep = new Date(b.departure);
        const totalBookingNights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));

        // ⏱️ 리드타임: 체크인 날짜(KST) - 예약 접수 일자(KST) 정밀 일수 계산
        const bookedKST = getBookingDateKST(b.bookingTime, b.arrival);
        if (bookedKST && b.arrival) {
            const arrDate = new Date(b.arrival + 'T00:00:00');
            const bookDate = new Date(bookedKST + 'T00:00:00');
            const diffDays = Math.round((arrDate.getTime() - bookDate.getTime()) / (1000 * 60 * 60 * 24));
            const lDays = Math.max(0, diffDays);
            totalLeadDays += lDays;
            leadBookingCount += 1;
        }

        totalRevenue += netPayout;
        stayNightsSum += totalBookingNights;
        totalBookings += 1;
    });

    // 2. 📈 정확한 가동률(Occupancy) 계산:
    // 기간(startStr ~ endStr) 내 각 날짜(밤)별 실제 점유된 객실 수 합산 (중복 예약 방지 및 100% 상한 절대 보장)
    let totalStayNights = 0;
    for (let i = 0; i < periodDays; i++) {
        const targetDate = addDays(startStr, i);
        if (targetDate > endStr) break;

        const activeRoomsOnDate = new Set<string>();
        validBookings.forEach((b) => {
            if (b.arrival <= targetDate && b.departure > targetDate) {
                const matchedUnit = getUnitForBooking(b);
                if (matchedUnit && targetUnitKeys.has(matchedUnit.key)) {
                    if (options?.channelMatch && options.channelMatch !== 'all') {
                        const srcId = Number(b.apiSourceId);
                        let isMatched = false;
                        if (options.channelMatch === 'airbnb' && srcId === 46) isMatched = true;
                        if (options.channelMatch === 'booking' && srcId === 19) isMatched = true;
                        if (options.channelMatch === 'agoda' && srcId === 17) isMatched = true;
                        if (options.channelMatch === 'trip' && srcId === 53) isMatched = true;
                        if (!isMatched) return;
                    }
                    activeRoomsOnDate.add(matchedUnit.key);
                }
            }
        });
        totalStayNights += activeRoomsOnDate.size;
    }

    const rawOcc = availableNights > 0 ? (totalStayNights / availableNights) * 100 : 0;
    const occupancyRate = Math.min(100, Math.round(rawOcc * 10) / 10);
    const adr = totalStayNights > 0 ? Math.round(totalRevenue / totalStayNights) : 0;
    const avgLeadDays = leadBookingCount > 0 ? Math.round((totalLeadDays / leadBookingCount) * 10) / 10 : 0;
    const avgStayNights = totalBookings > 0 ? Math.round((stayNightsSum / totalBookings) * 10) / 10 : 0;

    return {
        periodStart: startStr,
        periodEnd: endStr,
        periodDays,
        totalRevenue,
        occupancyRate,
        adr,
        totalNights: totalStayNights,
        totalBookings,
        avgLeadDays,
        avgStayNights,
    };
}

/**
 * A기간 vs B기간 증감 비교 계산 함수
 */
export function compareTwoPeriods(
    bookings: Booking[],
    periodA: { start: string; end: string },
    periodB: { start: string; end: string },
    options?: {
        propName?: string;
        unitKey?: string;
        channelMatch?: string;
    }
): PeriodComparisonResult {
    const metricsA = calculateMetricsForPeriod(bookings, periodA.start, periodA.end, options);
    const metricsB = calculateMetricsForPeriod(bookings, periodB.start, periodB.end, options);

    const revenueDiff = metricsA.totalRevenue - metricsB.totalRevenue;
    const revenuePct = metricsB.totalRevenue > 0
        ? Math.round((revenueDiff / metricsB.totalRevenue) * 1000) / 10
        : (metricsA.totalRevenue > 0 ? 100 : 0);

    const occupancyDiff = Math.round((metricsA.occupancyRate - metricsB.occupancyRate) * 10) / 10;

    const adrDiff = metricsA.adr - metricsB.adr;
    const adrPct = metricsB.adr > 0
        ? Math.round((adrDiff / metricsB.adr) * 1000) / 10
        : (metricsA.adr > 0 ? 100 : 0);

    const nightsDiff = metricsA.totalNights - metricsB.totalNights;
    const bookingsDiff = metricsA.totalBookings - metricsB.totalBookings;
    const leadDaysDiff = Math.round((metricsA.avgLeadDays - metricsB.avgLeadDays) * 10) / 10;
    const stayNightsDiff = Math.round((metricsA.avgStayNights - metricsB.avgStayNights) * 10) / 10;

    return {
        periodA: metricsA,
        periodB: metricsB,
        revenueDiff,
        revenuePct,
        occupancyDiff,
        adrDiff,
        adrPct,
        nightsDiff,
        bookingsDiff,
        leadDaysDiff,
        stayNightsDiff,
    };
}

/**
 * 🏛️ 계층형 탑다운(Top-Down) 양쪽 기간 비교 연산 엔진
 * 전체 ➔ 4개 건물(지점) ➔ 각 건물별 호실들에 대해 한 번에 A vs B 비교 결과를 생성
 */
export function calculateHierarchicalPeriodComparison(
    bookings: Booking[],
    periodA: { start: string; end: string },
    periodB: { start: string; end: string }
): HierarchicalComparisonResult {
    // 1. 전체 종합 비교
    const overall = compareTwoPeriods(bookings, periodA, periodB);

    // 2. 4개 건물(지점)별 비교
    const properties: HierarchicalPropertyComparison[] = PROPERTY_GROUPS.map((pg) => {
        const propComparison = compareTwoPeriods(bookings, periodA, periodB, { propName: pg.name });

        const labelMap: Record<string, string> = {
            YEONNAM: '연남',
            WAVE: '웨이브',
            Green: '그린',
            Namsun: '남선',
        };
        const label = labelMap[pg.name] || pg.name;

        // 각 건물에 속한 호실들별 비교
        const propUnits = ALL_UNITS.filter((u) => u.propName === pg.name);
        const units: HierarchicalUnitComparison[] = propUnits.map((u) => {
            const unitComparison = compareTwoPeriods(bookings, periodA, periodB, {
                propName: pg.name,
                unitKey: u.key,
            });
            return {
                unitKey: u.key,
                roomName: u.displayName || u.key,
                propName: pg.name,
                roomId: u.roomId,
                comparison: unitComparison,
            };
        });

        return {
            propName: pg.name,
            label,
            unitCount: propUnits.length,
            comparison: propComparison,
            units,
        };
    });

    return {
        overall,
        properties,
    };
}

// ============================================================================
// 🎯 8. OTA 광고 최적화를 위한 호실 x OTA 교차 분석 매트릭스 계산 엔진
// ============================================================================

export interface OtaCrossMetric {
    nights: number;
    revenue: number;
    contributionOcc: number; // 전체 공급 박수 대비 해당 OTA 기여 가동률 (%)
    sharePct: number;        // 해당 호실 전체 판매 박수 중 점유율 (%)
    adr: number;
}

export interface RoomChannelCrossRow {
    unitKey: string;
    roomName: string;
    propName: string;
    roomId: number;
    unitCount: number;
    totalRevenue: number;
    occupancyRate: number;
    totalNights: number;
    availableNights: number;
    vacantNights: number;
    adr: number;
    isHighVacancy: boolean; // 공실률 40% 이상 여부 (광고 부스트 추천 호실)
    topChannelName: string;
    otaMetrics: {
        airbnb: OtaCrossMetric;
        booking: OtaCrossMetric;
        agoda: OtaCrossMetric;
        trip: OtaCrossMetric;
        other: OtaCrossMetric;
    };
}

/**
 * 호실별 x 주요 OTA 4대 플랫폼 교차 성과 매트릭스 집계
 */
export function calculateRoomChannelCrossMatrix(
    bookings: Booking[],
    filter: TimeFilterRange,
    customStart?: string,
    customEnd?: string,
    propFilter: string = 'all',
    unitFilter: string = 'all'
): RoomChannelCrossRow[] {
    const validBookings = bookings.filter(isValidBooking);
    const { start, end, days } = getDateRangeByFilter(filter, customStart, customEnd, bookings);

    // 🎯 단일 호실(단독 분석) 모드일 때
    if (unitFilter && unitFilter !== 'all') {
        const targetUnit = ALL_UNITS.find((u) => u.key === unitFilter);
        if (!targetUnit) return [];

        const otaData: Record<'airbnb' | 'booking' | 'agoda' | 'trip' | 'other', { nights: number; revenue: number }> = {
            airbnb: { nights: 0, revenue: 0 },
            booking: { nights: 0, revenue: 0 },
            agoda: { nights: 0, revenue: 0 },
            trip: { nights: 0, revenue: 0 },
            other: { nights: 0, revenue: 0 },
        };

        let unitTotalRevenue = 0;
        let unitTotalNights = 0;

        validBookings.forEach((b) => {
            if (b.departure < start || b.departure > end) return;
            const bUnit = getUnitForBooking(b);
            if (!bUnit || bUnit.key !== targetUnit.key) return;

            const netPayout = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);
            const arr = new Date(b.arrival);
            const dep = new Date(b.departure);
            const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));

            unitTotalRevenue += netPayout;
            unitTotalNights += nights;

            const srcId = Number(b.apiSourceId);
            if (srcId === 46) {
                otaData.airbnb.nights += nights;
                otaData.airbnb.revenue += netPayout;
            } else if (srcId === 19) {
                otaData.booking.nights += nights;
                otaData.booking.revenue += netPayout;
            } else if (srcId === 17) {
                otaData.agoda.nights += nights;
                otaData.agoda.revenue += netPayout;
            } else if (srcId === 53) {
                otaData.trip.nights += nights;
                otaData.trip.revenue += netPayout;
            } else {
                otaData.other.nights += nights;
                otaData.other.revenue += netPayout;
            }
        });

        const availableNights = 1 * days;
        const vacantNights = Math.max(0, availableNights - unitTotalNights);
        const occupancyRate = availableNights > 0 ? Math.min(100, Math.round((unitTotalNights / availableNights) * 1000) / 10) : 0;
        const vacancyRate = availableNights > 0 ? Math.round((vacantNights / availableNights) * 100) : 0;
        const adr = unitTotalNights > 0 ? Math.round(unitTotalRevenue / unitTotalNights) : 0;

        const makeMetric = (data: { nights: number; revenue: number }): OtaCrossMetric => {
            const contributionOcc = availableNights > 0
                ? Math.round((data.nights / availableNights) * 1000) / 10
                : 0;
            const sharePct = unitTotalNights > 0
                ? Math.round((data.nights / unitTotalNights) * 1000) / 10
                : 0;
            const chAdr = data.nights > 0 ? Math.round(data.revenue / data.nights) : 0;
            return {
                nights: data.nights,
                revenue: data.revenue,
                contributionOcc,
                sharePct,
                adr: chAdr,
            };
        };

        const unitName = targetUnit.subName
            ? `${targetUnit.displayName} (${targetUnit.subName})`
            : targetUnit.displayName;

        // 가장 점유율 높은 채널 산출
        let topChannelName = '없음';
        let maxChNights = 0;
        const otaList = [
            { name: '에어비앤비', nights: otaData.airbnb.nights },
            { name: '부킹닷컴', nights: otaData.booking.nights },
            { name: '아고다', nights: otaData.agoda.nights },
            { name: '트립닷컴', nights: otaData.trip.nights },
        ];
        otaList.forEach((ch) => {
            if (ch.nights > maxChNights) {
                maxChNights = ch.nights;
                topChannelName = ch.name;
            }
        });

        return [
            {
                unitKey: targetUnit.key,
                roomId: targetUnit.roomId,
                roomName: unitName,
                propName: targetUnit.propName || '',
                unitCount: 1,
                totalRevenue: unitTotalRevenue,
                totalNights: unitTotalNights,
                availableNights,
                vacantNights,
                occupancyRate,
                adr,
                isHighVacancy: vacancyRate >= 40,
                topChannelName,
                otaMetrics: {
                    airbnb: makeMetric(otaData.airbnb),
                    booking: makeMetric(otaData.booking),
                    agoda: makeMetric(otaData.agoda),
                    trip: makeMetric(otaData.trip),
                    other: makeMetric(otaData.other),
                },
            },
        ];
    }

    // 🏢 지점/전체 분석 모드일 때
    const roomStats = calculateRoomStats(bookings, filter, customStart, customEnd, 'stay');

    // 필터링된 호실 대상
    let filteredRooms = roomStats;
    if (propFilter && propFilter !== 'all') {
        filteredRooms = filteredRooms.filter((r) => r.propName === propFilter);
    }

    return filteredRooms.map((room) => {
        const otaData: Record<'airbnb' | 'booking' | 'agoda' | 'trip' | 'other', { nights: number; revenue: number }> = {
            airbnb: { nights: 0, revenue: 0 },
            booking: { nights: 0, revenue: 0 },
            agoda: { nights: 0, revenue: 0 },
            trip: { nights: 0, revenue: 0 },
            other: { nights: 0, revenue: 0 },
        };

        // 해당 호실의 예약 필터링
        validBookings.forEach((b) => {
            if (b.departure < start || b.departure > end) return;
            const matchedUnit = getUnitForBooking(b);
            const uKey = matchedUnit?.key || String(b.roomId);
            if (uKey !== room.unitKey && b.roomId !== room.roomId) return;

            const netPayout = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime);
            const arr = new Date(b.arrival);
            const dep = new Date(b.departure);
            const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));

            const srcId = Number(b.apiSourceId);

            if (srcId === 46) {
                otaData.airbnb.nights += nights;
                otaData.airbnb.revenue += netPayout;
            } else if (srcId === 19) {
                otaData.booking.nights += nights;
                otaData.booking.revenue += netPayout;
            } else if (srcId === 17) {
                otaData.agoda.nights += nights;
                otaData.agoda.revenue += netPayout;
            } else if (srcId === 53) {
                otaData.trip.nights += nights;
                otaData.trip.revenue += netPayout;
            } else {
                otaData.other.nights += nights;
                otaData.other.revenue += netPayout;
            }
        });

        const makeMetric = (data: { nights: number; revenue: number }): OtaCrossMetric => {
            const contributionOcc = room.availableNights > 0
                ? Math.round((data.nights / room.availableNights) * 1000) / 10
                : 0;
            const sharePct = room.totalNights > 0
                ? Math.round((data.nights / room.totalNights) * 1000) / 10
                : 0;
            const adr = data.nights > 0 ? Math.round(data.revenue / data.nights) : 0;
            return {
                nights: data.nights,
                revenue: data.revenue,
                contributionOcc,
                sharePct,
                adr,
            };
        };

        const vacancyRate = room.availableNights > 0
            ? Math.round((room.vacantNights / room.availableNights) * 100)
            : 0;

        return {
            unitKey: room.unitKey,
            roomName: room.roomName,
            propName: room.propName,
            roomId: room.roomId,
            unitCount: room.unitCount,
            totalRevenue: room.totalRevenue,
            occupancyRate: room.occupancyRate,
            totalNights: room.totalNights,
            availableNights: room.availableNights,
            vacantNights: room.vacantNights,
            adr: room.adr,
            isHighVacancy: vacancyRate >= 40, // 공실률 40% 이상인 경우 광고 부스트 필요 호실
            topChannelName: room.topChannel?.displayName || '없음',
            otaMetrics: {
                airbnb: makeMetric(otaData.airbnb),
                booking: makeMetric(otaData.booking),
                agoda: makeMetric(otaData.agoda),
                trip: makeMetric(otaData.trip),
                other: makeMetric(otaData.other),
            },
        };
    });
}

// ============================================================================
// 📅 9. 월간 캘린더 기반 향후 예약 & 공실 레이더 계산 엔진
// ============================================================================

export interface DailyOccupancyInfo {
    dateStr: string;        // YYYY-MM-DD
    dayOfWeek: string;      // 월, 화, 수...
    isWeekend: boolean;
    totalUnits: number;     // 공급 가능 총 유닛 수
    bookedUnits: number;    // 예약된 유닛 수
    vacantUnits: number;    // 비어있는 유닛 수
    occupancyRate: number;  // 가동률 (%)
    vacantUnitList: Array<{
        unitKey: string;
        propName: string;
        unitName: string;
        roomId: number;
    }>;
    bookedUnitList: Array<{
        unitKey: string;
        propName: string;
        unitName: string;
        guestName: string;
        channelName: string;
        channelBg: string;
        channelText: string;
        bookingId?: string;
        arrival?: string;
        departure?: string;
        numAdult?: number;
    }>;
}

/**
 * 특정 기간 내 날짜별 가동률 및 비어있는 호실(유닛) 목록 추출
 */
export function calculateFutureOccupancyAndVacancies(
    bookings: Booking[],
    startStr: string,
    endStr: string,
    propFilter: string = 'all',
    unitKeyFilter: string = 'all'
): DailyOccupancyInfo[] {
    const validBookings = bookings.filter(isValidBooking);

    // 대상 유닛 목록 선정
    let targetUnits = ALL_UNITS;
    if (propFilter && propFilter !== 'all') {
        targetUnits = targetUnits.filter((u) => u.propName === propFilter);
    }
    if (unitKeyFilter && unitKeyFilter !== 'all') {
        targetUnits = targetUnits.filter((u) => u.key === unitKeyFilter || String(u.roomId) === unitKeyFilter);
    }

    const totalUnitsCount = Math.max(1, targetUnits.length);

    const s = new Date(startStr);
    const e = new Date(endStr);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const result: DailyOccupancyInfo[] = [];

    const cur = new Date(s);
    while (cur <= e) {
        const curStr = formatLocalDate(cur);
        const dayIdx = cur.getDay();
        const isWeekend = dayIdx === 5 || dayIdx === 6; // 금, 토

        // 해당 날짜(curStr)에 숙박 중인 예약 검색 (arrival <= curStr && departure > curStr)
        const bookedUnitKeySet = new Set<string>();
        const bookedUnitList: DailyOccupancyInfo['bookedUnitList'] = [];

        validBookings.forEach((b) => {
            if (b.arrival <= curStr && b.departure > curStr) {
                const matchedUnit = getUnitForBooking(b);
                if (matchedUnit) {
                    // 대상 유닛 범위 내에 속하는지 확인
                    const isTarget = targetUnits.some((u) => u.key === matchedUnit.key);
                    if (isTarget) {
                        bookedUnitKeySet.add(matchedUnit.key);
                        const chStyle = getChannelStyle(b.apiSourceId);
                        bookedUnitList.push({
                            unitKey: matchedUnit.key,
                            propName: matchedUnit.propName || '',
                            unitName: matchedUnit.displayName + (matchedUnit.subName ? ` (${matchedUnit.subName})` : ''),
                            guestName: `${b.firstName || ''} ${b.lastName || ''}`.trim() || '고객',
                            channelName: chStyle.name,
                            channelBg: chStyle.bg,
                            channelText: chStyle.text,
                            bookingId: String(b.id),
                            arrival: b.arrival,
                            departure: b.departure,
                            numAdult: b.numAdult,
                        });
                    }
                }
            }
        });

        // 공실 유닛 리스트 추출
        const vacantUnitList: DailyOccupancyInfo['vacantUnitList'] = targetUnits
            .filter((u) => !bookedUnitKeySet.has(u.key))
            .map((u) => ({
                unitKey: u.key,
                propName: u.propName || '',
                unitName: u.displayName + (u.subName ? ` (${u.subName})` : ''),
                roomId: u.roomId,
            }));

        const bookedUnits = bookedUnitList.length;
        const vacantUnits = vacantUnitList.length;
        const occupancyRate = Math.min(100, Math.round((bookedUnits / totalUnitsCount) * 100));

        result.push({
            dateStr: curStr,
            dayOfWeek: dayNames[dayIdx],
            isWeekend,
            totalUnits: totalUnitsCount,
            bookedUnits,
            vacantUnits,
            occupancyRate,
            vacantUnitList,
            bookedUnitList,
        });

        cur.setDate(cur.getDate() + 1);
    }

    return result;
}

// ============================================================================
// ⏱️ 10. 예약 리드타임(Lead Time) 및 투숙기간(LOS) 분석 계산 엔진
// ============================================================================

export interface DistributionBucket {
    label: string;
    subLabel: string;
    count: number;
    sharePct: number;
    color: string;
}

export interface OtaLeadTimeStat {
    otaName: string;
    avgLeadDays: number;
    avgStayNights: number;
    bookingCount: number;
    color: string;
}

export interface LeadTimeStaySummary {
    totalBookings: number;
    avgLeadDays: number;       // 평균 리드타임 (일)
    medianLeadDays: number;    // 중앙값 리드타임 (일)
    avgStayNights: number;     // 평균 투숙기간 (박, ALOS)
    leadDistribution: DistributionBucket[]; // 0~1일, 2~7일, 8~30일, 31일+
    stayDistribution: DistributionBucket[]; // 1박, 2~3박, 4~6박, 7박+
    otaStats: OtaLeadTimeStat[];
}

export function calculateLeadTimeAndStayStats(
    bookings: Booking[],
    filter: TimeFilterRange,
    customStart?: string,
    customEnd?: string,
    propFilter: string = 'all',
    unitFilter: string = 'all'
): LeadTimeStaySummary {
    const { start, end } = getDateRangeByFilter(filter, customStart, customEnd, bookings);
    const validBookings = bookings.filter(isValidBooking);

    // 대상 예약 필터링 (기간 내 체크아웃 + 지점/호실 필터)
    const targetBookings = validBookings.filter((b) => {
        if (b.departure < start || b.departure > end) return false;
        if (unitFilter && unitFilter !== 'all') {
            const u = getUnitForBooking(b);
            if (!u || u.key !== unitFilter) return false;
        } else if (propFilter && propFilter !== 'all') {
            const u = getUnitForBooking(b);
            if (!u || u.propName !== propFilter) return false;
        }
        return true;
    });

    const leadBuckets: DistributionBucket[] = [
        { label: '당일/직전 (0~1일)', subLabel: '급매/라스트미닛', count: 0, sharePct: 0, color: '#EF4444' },
        { label: '단기 임박 (2~7일)', subLabel: '1주일 내 임박 예약', count: 0, sharePct: 0, color: '#F59E0B' },
        { label: '중기 표준 (8~30일)', subLabel: '사전 계획형 예약', count: 0, sharePct: 0, color: '#3B82F6' },
        { label: '얼리버드 (31일+)', subLabel: '장기 사전 예약', count: 0, sharePct: 0, color: '#10B981' },
    ];

    const stayBuckets: DistributionBucket[] = [
        { label: '1박 (단기)', subLabel: '주말/단기 여행', count: 0, sharePct: 0, color: '#8B5CF6' },
        { label: '2~3박 (표준)', subLabel: '일반 표준 관광', count: 0, sharePct: 0, color: '#3B82F6' },
        { label: '4~6박 (중기)', subLabel: '휴가/장기 휴식', count: 0, sharePct: 0, color: '#10B981' },
        { label: '7박+ (연박)', subLabel: '장기/한달살기', count: 0, sharePct: 0, color: '#F59E0B' },
    ];

    const otaMap: Record<string, { totalLead: number; totalStay: number; count: number; color: string }> = {};

    let totalLeadDays = 0;
    let totalStayNights = 0;
    const allLeadDays: number[] = [];

    targetBookings.forEach((b) => {
        // 투숙 박수 계산
        const arr = new Date(b.arrival);
        const dep = new Date(b.departure);
        const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
        totalStayNights += nights;

        if (nights === 1) stayBuckets[0].count += 1;
        else if (nights <= 3) stayBuckets[1].count += 1;
        else if (nights <= 6) stayBuckets[2].count += 1;
        else stayBuckets[3].count += 1;

        // 리드타임 계산
        let leadDays = 0;
        if (b.bookingTime) {
            const bookDate = new Date(b.bookingTime);
            leadDays = Math.max(0, Math.floor((arr.getTime() - bookDate.getTime()) / (1000 * 60 * 60 * 24)));
        }
        totalLeadDays += leadDays;
        allLeadDays.push(leadDays);

        if (leadDays <= 1) leadBuckets[0].count += 1;
        else if (leadDays <= 7) leadBuckets[1].count += 1;
        else if (leadDays <= 30) leadBuckets[2].count += 1;
        else leadBuckets[3].count += 1;

        // OTA별 매핑
        const ch = getChannelStyle(b.apiSourceId);
        const chName = ch.name || '기타';
        const chColor = ch.bg || '#64748B';

        if (!otaMap[chName]) {
            otaMap[chName] = { totalLead: 0, totalStay: 0, count: 0, color: chColor };
        }
        otaMap[chName].totalLead += leadDays;
        otaMap[chName].totalStay += nights;
        otaMap[chName].count += 1;
    });

    const totalBookings = targetBookings.length;
    const avgLeadDays = totalBookings > 0 ? Math.round((totalLeadDays / totalBookings) * 10) / 10 : 0;
    const avgStayNights = totalBookings > 0 ? Math.round((totalStayNights / totalBookings) * 10) / 10 : 0;

    // 중앙값 계산
    allLeadDays.sort((a, b) => a - b);
    const midIdx = Math.floor(allLeadDays.length / 2);
    const medianLeadDays = allLeadDays.length > 0 ? allLeadDays[midIdx] : 0;

    // 퍼센티지 계산
    leadBuckets.forEach((b) => {
        b.sharePct = totalBookings > 0 ? Math.round((b.count / totalBookings) * 1000) / 10 : 0;
    });
    stayBuckets.forEach((b) => {
        b.sharePct = totalBookings > 0 ? Math.round((b.count / totalBookings) * 1000) / 10 : 0;
    });

    // OTA별 정렬 (예약 건수 많은 순)
    const otaStats: OtaLeadTimeStat[] = Object.entries(otaMap)
        .map(([otaName, data]) => ({
            otaName,
            avgLeadDays: data.count > 0 ? Math.round((data.totalLead / data.count) * 10) / 10 : 0,
            avgStayNights: data.count > 0 ? Math.round((data.totalStay / data.count) * 10) / 10 : 0,
            bookingCount: data.count,
            color: data.color,
        }))
        .sort((a, b) => b.bookingCount - a.bookingCount);

    return {
        totalBookings,
        avgLeadDays,
        medianLeadDays,
        avgStayNights,
        leadDistribution: leadBuckets,
        stayDistribution: stayBuckets,
        otaStats,
    };
}



