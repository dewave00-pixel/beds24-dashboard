// 📈 주간/월간 추이 분석 및 WoW(Week-over-Week) 비교 전담 계산 엔진 모듈

import { Booking } from '../types';
import { ALL_UNITS } from '../config';
import { calculateNetPayout, getUnitForBooking } from './bookingUtils';

export interface PeriodStats {
    startDate: string;
    endDate: string;
    days: number;
    totalRevenue: number;     // 총 매출액 (체크아웃 기준)
    netRevenue: number;       // 순매출 (수수료 20% 제외)
    occupancyRate: number;    // 가동률 (%)
    adr: number;              // 객실 평균 단가
    totalBookings: number;    // 체크아웃 예약 건수
    totalStayNights: number;  // 실제 판매된 투숙 박수
}

export interface MetricDelta {
    current: number;
    prev1W: number;
    prev2W: number;
    diff1W: number;           // current - prev1W
    diffRate1W: number;       // ((current - prev1W) / prev1W) * 100
    diff2W: number;           // current - prev2W
    diffRate2W: number;       // ((current - prev2W) / prev2W) * 100
}

export interface TrendComparisonResult {
    currentPeriod: { start: string; end: string; days: number };
    prev1WPeriod: { start: string; end: string; days: number };
    prev2WPeriod: { start: string; end: string; days: number };
    revenue: MetricDelta;
    occupancyRate: MetricDelta;
    bookingCount: MetricDelta;
    adr: MetricDelta;
    stayNights: MetricDelta;
}

export interface TimeSeriesBucket {
    key: string;              // 고유 식별자 (예: '2026-W36', '2026-08')
    label: string;            // 메인 라벨 (예: '이번 주', '1주 전', '8월')
    subLabel: string;         // 보조 라벨 (예: '09/04~09/10')
    startDate: string;
    endDate: string;
    revenue: number;          // 총 매출액
    occupancyRate: number;    // 가동률 (%)
    bookingCount: number;     // 예약 건수
    stayNights: number;       // 판매 박수
    isCurrent?: boolean;      // 현재 진행 중인 기간 여부
}

// 헬퍼: 유효 예약 여부 검사
function isValidBooking(b: Booking): boolean {
    if (!b.arrival || !b.departure) return false;
    if (b.status === 'cancelled' || b.status === 'deleted' || b.status === 'inquiry') return false;
    return true;
}

// 헬퍼: 날짜에 일수 더하기
function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

// 헬퍼: 증감율 계산 (0으로 나누기 방어)
function calcRate(current: number, previous: number): number {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return Number((((current - previous) / previous) * 100).toFixed(1));
}

/**
 * 🧮 특정 기간(start ~ end)의 통계 메트릭 계산 (단일 구간 계산기)
 */
export function calculatePeriodStats(
    bookings: Booking[],
    startDate: string,
    endDate: string
): PeriodStats {
    const validBookings = bookings.filter(isValidBooking);

    const s = new Date(startDate);
    const e = new Date(endDate);
    const diffMs = e.getTime() - s.getTime();
    const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

    // 1. 매출 & ADR (기간 내 체크아웃한 예약 기준)
    const checkoutBookings = validBookings.filter(
        (b) => b.departure >= startDate && b.departure <= endDate
    );

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

    // 2. 가동률: 기간 내 각 날짜별 실제 점유된 객실 수 합산
    let totalStayNights = 0;

    for (let i = 0; i < days; i++) {
        const targetDate = addDays(startDate, i);
        if (targetDate > endDate) break;

        const activeRoomsOnDate = new Set<string>();
        validBookings.forEach((b) => {
            if (b.arrival <= targetDate && b.departure > targetDate) {
                const matchedUnit = getUnitForBooking(b);
                const roomKey = matchedUnit ? matchedUnit.key : `${b.roomId}-${b.unitId || 1}`;
                activeRoomsOnDate.add(roomKey);
            }
        });
        totalStayNights += activeRoomsOnDate.size;
    }

    const totalRooms = ALL_UNITS.length || 14;
    const maxPossibleNights = totalRooms * days;
    const occupancyRate = maxPossibleNights > 0
        ? Number(((totalStayNights / maxPossibleNights) * 100).toFixed(1))
        : 0;

    return {
        startDate,
        endDate,
        days,
        totalRevenue,
        netRevenue,
        occupancyRate,
        adr,
        totalBookings: checkoutBookings.length,
        totalStayNights,
    };
}

/**
 * ⚡ [실적 추이 비교 연산] (선택 기간 vs 직전 동기간 vs 전전 동기간)
 * - 기간 지정 시: 선택한 N일간(Current) vs 직전 N일간(Prev1) vs 전전 N일간(Prev2)
 * - 기간 미지정 시: 기본 최근 7일(Current) vs 1주 전 7일(Prev1W) vs 2주 전 7일(Prev2W)
 */
export function calculateTrendComparison(
    bookings: Booking[],
    customStartDate?: string,
    customEndDate?: string,
    baseDate: Date = new Date()
): TrendComparisonResult {
    const pad = (n: number) => String(n).padStart(2, '0');
    const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let curStart: Date;
    let curEnd: Date;
    let days: number;

    if (customStartDate && customEndDate) {
        curStart = new Date(customStartDate);
        curEnd = new Date(customEndDate);
        const diffTime = Math.abs(curEnd.getTime() - curStart.getTime());
        days = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
    } else {
        curEnd = new Date(baseDate);
        curStart = new Date(baseDate);
        curStart.setDate(curEnd.getDate() - 6);
        days = 7;
    }

    // 2. 직전 동일 기간 (동일한 N일 윈도우)
    const p1End = new Date(curStart);
    p1End.setDate(p1End.getDate() - 1);
    const p1Start = new Date(p1End);
    p1Start.setDate(p1End.getDate() - (days - 1));

    // 3. 전전 동일 기간 (동일한 N일 윈도우)
    const p2End = new Date(p1Start);
    p2End.setDate(p2End.getDate() - 1);
    const p2Start = new Date(p2End);
    p2Start.setDate(p2End.getDate() - (days - 1));

    const curStats = calculatePeriodStats(bookings, toDateStr(curStart), toDateStr(curEnd));
    const p1Stats = calculatePeriodStats(bookings, toDateStr(p1Start), toDateStr(p1End));
    const p2Stats = calculatePeriodStats(bookings, toDateStr(p2Start), toDateStr(p2End));

    const buildDelta = (cur: number, p1: number, p2: number, isPercent = false): MetricDelta => ({
        current: cur,
        prev1W: p1,
        prev2W: p2,
        diff1W: Number((cur - p1).toFixed(1)),
        diffRate1W: isPercent ? Number((cur - p1).toFixed(1)) : calcRate(cur, p1),
        diff2W: Number((cur - p2).toFixed(1)),
        diffRate2W: isPercent ? Number((cur - p2).toFixed(1)) : calcRate(cur, p2),
    });

    return {
        currentPeriod: { start: toDateStr(curStart), end: toDateStr(curEnd), days },
        prev1WPeriod: { start: toDateStr(p1Start), end: toDateStr(p1End), days },
        prev2WPeriod: { start: toDateStr(p2Start), end: toDateStr(p2End), days },
        revenue: buildDelta(curStats.totalRevenue, p1Stats.totalRevenue, p2Stats.totalRevenue),
        occupancyRate: buildDelta(curStats.occupancyRate, p1Stats.occupancyRate, p2Stats.occupancyRate, true),
        bookingCount: buildDelta(curStats.totalBookings, p1Stats.totalBookings, p2Stats.totalBookings),
        adr: buildDelta(curStats.adr, p1Stats.adr, p2Stats.adr),
        stayNights: buildDelta(curStats.totalStayNights, p1Stats.totalStayNights, p2Stats.totalStayNights),
    };
}

/**
 * 📊 [주간(Weekly) 시계열 버킷 데이터]
 * 과거 N주차별(예: 최근 6주 또는 8주) 실적을 계산하여 막대 차트용 데이터 반환
 */
export function getWeeklyTimeSeries(
    bookings: Booking[],
    weeksCount: number = 6,
    baseDate: Date = new Date()
): TimeSeriesBucket[] {
    const pad = (n: number) => String(n).padStart(2, '0');
    const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const buckets: TimeSeriesBucket[] = [];

    // 오늘부터 과거로 주차 역산
    for (let i = weeksCount - 1; i >= 0; i--) {
        const end = new Date(baseDate);
        end.setDate(end.getDate() - (i * 7));

        const start = new Date(end);
        start.setDate(end.getDate() - 6);

        const startStr = toDateStr(start);
        const endStr = toDateStr(end);

        const stats = calculatePeriodStats(bookings, startStr, endStr);

        let label = `${i}주 전`;
        if (i === 0) label = '이번 주';
        else if (i === 1) label = '1주 전';

        const subLabel = `${pad(start.getMonth() + 1)}.${pad(start.getDate())}~${pad(end.getMonth() + 1)}.${pad(end.getDate())}`;

        buckets.push({
            key: `week-${i}`,
            label,
            subLabel,
            startDate: startStr,
            endDate: endStr,
            revenue: stats.totalRevenue,
            occupancyRate: stats.occupancyRate,
            bookingCount: stats.totalBookings,
            stayNights: stats.totalStayNights,
            isCurrent: i === 0,
        });
    }

    return buckets;
}

/**
 * 📅 [월간(Monthly) 시계열 버킷 데이터]
 * 과거 N개월간(예: 최근 6개월) 월별 실적을 계산하여 막대 차트용 데이터 반환
 */
export function getMonthlyTimeSeries(
    bookings: Booking[],
    monthsCount: number = 6,
    baseDate: Date = new Date()
): TimeSeriesBucket[] {
    const pad = (n: number) => String(n).padStart(2, '0');
    const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const buckets: TimeSeriesBucket[] = [];
    const curYear = baseDate.getFullYear();
    const curMonth = baseDate.getMonth(); // 0 ~ 11

    for (let i = monthsCount - 1; i >= 0; i--) {
        // i개월 전 월의 1일과 마지막 날 계산
        const targetMonthDate = new Date(curYear, curMonth - i, 1);
        const y = targetMonthDate.getFullYear();
        const m = targetMonthDate.getMonth();

        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);

        const startStr = toDateStr(firstDay);
        const endStr = toDateStr(lastDay);

        const stats = calculatePeriodStats(bookings, startStr, endStr);

        const label = `${m + 1}월`;
        const subLabel = `${y}.${pad(m + 1)}`;

        buckets.push({
            key: `month-${y}-${m + 1}`,
            label,
            subLabel,
            startDate: startStr,
            endDate: endStr,
            revenue: stats.totalRevenue,
            occupancyRate: stats.occupancyRate,
            bookingCount: stats.totalBookings,
            stayNights: stats.totalStayNights,
            isCurrent: i === 0,
        });
    }

    return buckets;
}
