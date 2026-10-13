'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import { ALL_UNITS } from '../../config';
import {
    calculateFutureOccupancyAndVacancies,
    DailyOccupancyInfo,
} from '../../utils/analyticsCalculations';
import { formatDateStr } from '../../utils/dateStepperUtils';

interface FutureOccupancyRadarProps {
    bookings: Booking[];
    selectedProperty?: string;
    selectedUnitKey?: string;
}

type PeriodPreset = 'next7' | 'next14' | 'next30' | 'month';
type ViewMode = 'calendar' | 'summary' | 'chart';

export interface DailyOccupancyWithTrend extends DailyOccupancyInfo {
    diffFromPrev: number | null; // 전일 대비 가동률 증감 (±%p)
    trendDirection: 'up' | 'down' | 'flat' | 'none';
}

const PROPERTY_THEME: Record<string, { label: string; badge: string }> = {
    YEONNAM: { label: '연남', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300' },
    WAVE: { label: '웨이브', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300' },
    Green: { label: '그린', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' },
    Namsun: { label: '남선', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300' },
};

export default function FutureOccupancyRadar({
    bookings,
    selectedProperty = 'all',
    selectedUnitKey = 'all',
}: FutureOccupancyRadarProps) {
    const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('next14');
    const [viewMode, setViewMode] = useState<ViewMode>('calendar'); // 📅 공실 특화 달력 뷰 기본
    const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
    const [hoveredDateStr, setHoveredDateStr] = useState<string | null>(null);

    // 월간 모드일 때 탐색할 기준 월 (기본값: 오늘 속한 월 1일)
    const [monthOffset, setMonthOffset] = useState<number>(0);

    // 조회 기간 계산 (시작일 ~ 종료일)
    const { startDate, endDate } = useMemo(() => {
        const today = new Date();

        if (periodPreset === 'next7') {
            const end = new Date(today);
            end.setDate(today.getDate() + 6);
            return { startDate: formatDateStr(today), endDate: formatDateStr(end) };
        }
        if (periodPreset === 'next14') {
            const end = new Date(today);
            end.setDate(today.getDate() + 13);
            return { startDate: formatDateStr(today), endDate: formatDateStr(end) };
        }
        if (periodPreset === 'next30') {
            const end = new Date(today);
            end.setDate(today.getDate() + 29);
            return { startDate: formatDateStr(today), endDate: formatDateStr(end) };
        }

        // month 모드 (monthOffset 적용)
        const targetDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
        const y = targetDate.getFullYear();
        const m = targetDate.getMonth();
        const first = new Date(y, m, 1);
        const last = new Date(y, m + 1, 0);
        return { startDate: formatDateStr(first), endDate: formatDateStr(last) };
    }, [periodPreset, monthOffset]);

    // 일자별 가동률 및 공실 호실 데이터 계산
    const rawDailyData: DailyOccupancyInfo[] = useMemo(() => {
        return calculateFutureOccupancyAndVacancies(
            bookings,
            startDate,
            endDate,
            selectedProperty,
            selectedUnitKey
        );
    }, [bookings, startDate, endDate, selectedProperty, selectedUnitKey]);

    // 전일 대비 가동률 증감(Day-over-Day ±%p) 추가 계산
    const dailyData: DailyOccupancyWithTrend[] = useMemo(() => {
        return rawDailyData.map((item, idx) => {
            if (idx === 0) {
                return {
                    ...item,
                    diffFromPrev: null,
                    trendDirection: 'none',
                };
            }
            const prev = rawDailyData[idx - 1];
            const diff = Math.round((item.occupancyRate - prev.occupancyRate) * 10) / 10;
            let trendDirection: 'up' | 'down' | 'flat' = 'flat';
            if (diff > 0) trendDirection = 'up';
            else if (diff < 0) trendDirection = 'down';

            return {
                ...item,
                diffFromPrev: diff,
                trendDirection,
            };
        });
    }, [rawDailyData]);

    // 기간 전체 요약 지표 (평균 가동률, 최대 상승일, 최저 가동일)
    const summaryStats = useMemo<{
        avgOcc: number;
        maxJumpDay: DailyOccupancyWithTrend | null;
        minOccDay: DailyOccupancyWithTrend | null;
        totalVacantNights: number;
    }>(() => {
        if (!dailyData || dailyData.length === 0) {
            return { avgOcc: 0, maxJumpDay: null, minOccDay: null, totalVacantNights: 0 };
        }
        const totalOcc = dailyData.reduce((acc, d) => acc + d.occupancyRate, 0);
        const avgOcc = Math.round((totalOcc / dailyData.length) * 10) / 10;
        const totalVacantNights = dailyData.reduce((acc, d) => acc + d.vacantUnits, 0);

        // 최대 상승일 (DoD diff가 가장 큰 날)
        let maxJumpDay: DailyOccupancyWithTrend | null = null;
        let maxJumpDiff = 0;
        dailyData.forEach((d) => {
            if (d.diffFromPrev !== null && d.diffFromPrev > maxJumpDiff) {
                maxJumpDiff = d.diffFromPrev;
                maxJumpDay = d;
            }
        });

        // 최저 가동일
        let minOccDay = dailyData[0];
        dailyData.forEach((d) => {
            if (d.occupancyRate < minOccDay.occupancyRate) {
                minOccDay = d;
            }
        });

        return { avgOcc, maxJumpDay, minOccDay, totalVacantNights };
    }, [dailyData]);

    // ⚠️ 조기 공실 주의 위험 일자 감지:
    // 1. 주말(금, 토)인데 가동률이 60% 미만인 날
    // 2. 또는 가동률이 35% 이하로 공실이 집중된 날
    const riskDates = useMemo(() => {
        if (!dailyData || dailyData.length === 0) return [];
        return dailyData.filter((d) => {
            const isWeekend = d.dayOfWeek === '금' || d.dayOfWeek === '토';
            if (isWeekend && d.occupancyRate < 60) return true;
            if (d.occupancyRate <= 35) return true;
            return false;
        });
    }, [dailyData]);

    // 🛏️ 매트릭스 룸 랙용: 현재 필터링된 호실 리스트
    const activeUnits = useMemo(() => {
        let list = ALL_UNITS;
        if (selectedProperty && selectedProperty !== 'all') {
            list = list.filter((u) => u.propName === selectedProperty);
        }
        if (selectedUnitKey && selectedUnitKey !== 'all') {
            list = list.filter((u) => u.key === selectedUnitKey || u.unitKey === selectedUnitKey);
        }
        return list;
    }, [selectedProperty, selectedUnitKey]);

    // 🗺️ 날짜별 x 호실별 예약 정보 O(1) 맵 (dateStr -> unitKey -> BookedUnitInfo)
    const dateUnitBookingMap = useMemo(() => {
        const map = new Map<string, Map<string, DailyOccupancyInfo['bookedUnitList'][number]>>();
        dailyData.forEach((d) => {
            const uMap = new Map<string, DailyOccupancyInfo['bookedUnitList'][number]>();
            d.bookedUnitList.forEach((b) => {
                uMap.set(b.unitKey, b);
            });
            map.set(d.dateStr, uMap);
        });
        return map;
    }, [dailyData]);

    // 📊 각 호실별 기간 내 가동률 (%) 계산
    const unitOccRates = useMemo(() => {
        const rates: Record<string, number> = {};
        if (dailyData.length === 0) return rates;

        activeUnits.forEach((u) => {
            const uKey = u.unitKey || u.key;
            let bookedCount = 0;
            dailyData.forEach((d) => {
                const uMap = dateUnitBookingMap.get(d.dateStr);
                if (uMap && uMap.has(uKey)) {
                    bookedCount++;
                }
            });
            rates[uKey] = Math.round((bookedCount / dailyData.length) * 100);
        });
        return rates;
    }, [activeUnits, dailyData, dateUnitBookingMap]);

    // 📅 공실 달력용: 시작 요일(일=0 ~ 토=6)에 맞춘 빈 셀(blank cells) 패딩
    const calendarDaysWithBlanks = useMemo(() => {
        if (!dailyData || dailyData.length === 0) return [];
        const [y, m, d] = dailyData[0].dateStr.split('-').map(Number);
        const firstDayIdx = new Date(y, m - 1, d).getDay();

        type CalendarCell =
            | { type: 'blank'; key: string }
            | { type: 'day'; key: string; data: DailyOccupancyWithTrend };

        const blanks: CalendarCell[] = Array.from({ length: firstDayIdx }, (_, i) => ({
            type: 'blank',
            key: `blank-${i}`,
        }));

        const days: CalendarCell[] = dailyData.map((item) => ({
            type: 'day',
            key: item.dateStr,
            data: item,
        }));

        return [...blanks, ...days];
    }, [dailyData]);

    // 선택된 날짜 상세 정보 (기본값: 첫 번째 날짜 또는 클릭/호버한 날짜)
    const activeDayDetail = useMemo(() => {
        if (!dailyData || dailyData.length === 0) return null;
        const targetStr = hoveredDateStr || selectedDateStr;
        if (targetStr) {
            const found = dailyData.find((d) => d.dateStr === targetStr);
            if (found) return found;
        }
        return dailyData[0];
    }, [dailyData, selectedDateStr, hoveredDateStr]);

    // 공실 유닛들을 지점별로 그룹핑
    const groupedVacantUnits = useMemo(() => {
        if (!activeDayDetail) return {};
        const group: Record<string, Array<{ unitKey: string; unitName: string }>> = {};
        activeDayDetail.vacantUnitList.forEach((u) => {
            const pName = u.propName || '기타';
            if (!group[pName]) group[pName] = [];
            group[pName].push({ unitKey: u.unitKey, unitName: u.unitName });
        });
        return group;
    }, [activeDayDetail]);

    // 🚨 1. 주말(금/토) 공실 일자 목록
    const weekendVacancies = useMemo(() => {
        return dailyData.filter((d) => (d.dayOfWeek === '금' || d.dayOfWeek === '토') && d.vacantUnits > 0);
    }, [dailyData]);

    // ⚡ 2. D-3 임박 공실 일자 목록 (앞 3일 중 공실 있는 날)
    const imminentVacancies = useMemo(() => {
        return dailyData.slice(0, 3).filter((d) => d.vacantUnits > 0);
    }, [dailyData]);

    // 🛏️ 3. 호실별 향후 가동률 & 공실 박수 랭킹 (취약 호실 순)
    const rankedUnitStats = useMemo(() => {
        if (!dailyData || dailyData.length === 0) return [];
        return activeUnits
            .map((u) => {
                const uKey = u.unitKey || u.key;
                const occRate = unitOccRates[uKey] ?? 0;
                let bookedNights = 0;
                dailyData.forEach((d) => {
                    const uMap = dateUnitBookingMap.get(d.dateStr);
                    if (uMap && uMap.has(uKey)) bookedNights++;
                });
                const vacantNights = Math.max(0, dailyData.length - bookedNights);
                return {
                    unitKey: uKey,
                    displayName: u.displayName,
                    subName: u.subName,
                    propName: u.propName,
                    occRate,
                    bookedNights,
                    vacantNights,
                };
            })
            .sort((a, b) => a.occRate - b.occRate); // 공실률 높은(가동률 낮은) 순
    }, [activeUnits, dailyData, dateUnitBookingMap, unitOccRates]);

    // 📅 4. 요일별 평균 가동률 통계 (월 ~ 일)
    const dayOfWeekStats = useMemo(() => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return days.map((day) => {
            const matches = dailyData.filter((d) => d.dayOfWeek === day);
            if (matches.length === 0) return { day, avgOcc: 0 };
            const sum = matches.reduce((acc, m) => acc + m.occupancyRate, 0);
            return { day, avgOcc: Math.round(sum / matches.length) };
        });
    }, [dailyData]);

    const { minDow, maxDow } = useMemo(() => {
        if (dayOfWeekStats.length === 0) {
            return { minDow: { day: '-', avgOcc: 0 }, maxDow: { day: '-', avgOcc: 0 } };
        }
        let min = dayOfWeekStats[0];
        let max = dayOfWeekStats[0];
        dayOfWeekStats.forEach((d) => {
            if (d.avgOcc < min.avgOcc) min = d;
            if (d.avgOcc > max.avgOcc) max = d;
        });
        return { minDow: min, maxDow: max };
    }, [dayOfWeekStats]);

    // 💸 5. 잠재 공실 손실액 추산
    const { estimatedAdr, estimatedLostRevenue } = useMemo(() => {
        let totalRev = 0;
        let totalNights = 0;
        bookings.forEach((b) => {
            if (b.price && b.arrival && b.departure) {
                const arr = new Date(b.arrival);
                const dep = new Date(b.departure);
                const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
                totalRev += Number(b.price) || 0;
                totalNights += nights;
            }
        });
        const adr = totalNights > 0 ? Math.round(totalRev / totalNights) : 120000;
        const lostRevenue = summaryStats.totalVacantNights * adr;
        return { estimatedAdr: adr, estimatedLostRevenue: lostRevenue };
    }, [bookings, summaryStats.totalVacantNights]);

    // 가동률 색상 판정
    const getOccupancyBadge = (occ: number) => {
        if (occ >= 100) {
            return {
                bg: 'bg-emerald-500',
                fill: '#10b981',
                text: 'text-emerald-700 dark:text-emerald-300',
                label: '만실 🟢',
                lightBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
            };
        }
        if (occ >= 70) {
            return {
                bg: 'bg-blue-500',
                fill: '#3b82f6',
                text: 'text-blue-700 dark:text-blue-300',
                label: '양호 🔵',
                lightBg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
            };
        }
        if (occ >= 50) {
            return {
                bg: 'bg-amber-500',
                fill: '#f59e0b',
                text: 'text-amber-700 dark:text-amber-300',
                label: '주의 🟠',
                lightBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
            };
        }
        return {
            bg: 'bg-rose-500',
            fill: '#ef4444',
            text: 'text-rose-700 dark:text-rose-300',
            label: '공실집중 🔴',
            lightBg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 animate-pulse',
        };
    };

    // 📈 차트 좌표 계산 (SVG 반응형 가로 레이아웃)
    const chartConfig = useMemo(() => {
        const pointCount = dailyData.length;
        if (pointCount === 0) return null;

        // 아이템당 최소 56px 너비 보장 (모바일 가로 스크롤 대비)
        const itemWidth = Math.max(58, Math.min(84, 900 / pointCount));
        const chartWidth = Math.max(760, pointCount * itemWidth);
        const chartHeight = 220;
        const topPadding = 42;
        const bottomPadding = 48;
        const plotHeight = chartHeight - topPadding - bottomPadding;

        const points = dailyData.map((d, idx) => {
            const x = (idx + 0.5) * itemWidth;
            // 가동률 100%일 때 y = topPadding, 0%일 때 y = topPadding + plotHeight
            const y = topPadding + (1 - d.occupancyRate / 100) * plotHeight;
            return { ...d, x, y };
        });

        // SVG 곡선 패스 (Cubic Bezier Spline)
        let linePath = '';
        let areaPath = '';
        if (points.length > 0) {
            linePath = `M ${points[0].x} ${points[0].y}`;
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i];
                const p1 = points[i + 1];
                const cp1x = p0.x + (p1.x - p0.x) / 2;
                const cp1y = p0.y;
                const cp2x = p0.x + (p1.x - p0.x) / 2;
                const cp2y = p1.y;
                linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
            }

            // 영역 패스 (아래 닫힘)
            const baseY = topPadding + plotHeight;
            areaPath = `${linePath} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;
        }

        return { chartWidth, chartHeight, topPadding, bottomPadding, plotHeight, points, linePath, areaPath };
    }, [dailyData]);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-4">
            {/* 상단 1열: 타이틀 & 기간 프리셋 / 뷰 모드 토글 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="text-xl">📈</span>
                    <div>
                        <h3 className="text-base font-black text-gray-900 dark:text-slate-100 flex items-center gap-2">
                            향후 예약 & 가동률 레이더
                            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/60">
                                일자별 가동률 추세 & 증감 (DoD)
                            </span>
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                            향후 날짜별로 가동률이 어떻게 차오르고 있는지(전일 대비 증감 ±%p)를 확인하고, 공실 일자에 특가 프로모션을 집중 집행합니다.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                    {/* 기간 프리셋 선택 */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setPeriodPreset('next7')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                periodPreset === 'next7'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 font-extrabold shadow-2xs'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                            }`}
                        >
                            향후 7일
                        </button>
                        <button
                            type="button"
                            onClick={() => setPeriodPreset('next14')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                periodPreset === 'next14'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 font-extrabold shadow-2xs'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                            }`}
                        >
                            향후 14일
                        </button>
                        <button
                            type="button"
                            onClick={() => setPeriodPreset('next30')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                periodPreset === 'next30'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 font-extrabold shadow-2xs'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                            }`}
                        >
                            향후 30일
                        </button>
                        <button
                            type="button"
                            onClick={() => setPeriodPreset('month')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                periodPreset === 'month'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 font-extrabold shadow-2xs'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                            }`}
                        >
                            월간
                        </button>
                    </div>

                    {/* 뷰 모드 토글: [🛏️ 룸 랙 히트맵(기본)] vs [📅 달력 타일] vs [📈 추세 그래프] */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setViewMode('calendar')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                viewMode === 'calendar'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 font-extrabold shadow-2xs'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <span>📅</span>
                            <span>공실 달력 (기본)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('summary')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                viewMode === 'summary'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 font-extrabold shadow-2xs'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <span>📊</span>
                            <span>공실 요약</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('chart')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                viewMode === 'chart'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 font-extrabold shadow-2xs'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <span>📈</span>
                            <span>추세 선 그래프</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 상단 2열: 핵심 가동률 요약 칩 (평균 가동률, 최대 상승일, 최저 가동일) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="bg-gray-50 dark:bg-slate-800/60 p-2.5 md:p-3 rounded-xl border border-gray-200/80 dark:border-slate-800 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">조회 기간 평균 가동률</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl md:text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                            {summaryStats.avgOcc}%
                        </span>
                        <span className="text-[10px] text-gray-400">예약 가동</span>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-800/60 p-2.5 md:p-3 rounded-xl border border-gray-200/80 dark:border-slate-800 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">최대 가동률 상승일 (DoD)</span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                        {summaryStats.maxJumpDay ? (
                            <>
                                <span className="text-base font-extrabold font-mono text-gray-900 dark:text-slate-100">
                                    {summaryStats.maxJumpDay.dateStr.slice(5)}
                                </span>
                                <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded">
                                    ▲ +{summaryStats.maxJumpDay.diffFromPrev}%p
                                </span>
                            </>
                        ) : (
                            <span className="text-xs text-gray-400">변동 없음</span>
                        )}
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-800/60 p-2.5 md:p-3 rounded-xl border border-gray-200/80 dark:border-slate-800 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">최저 가동률 일자 (공실주의)</span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                        {summaryStats.minOccDay ? (
                            <>
                                <span className="text-base font-extrabold font-mono text-gray-900 dark:text-slate-100">
                                    {summaryStats.minOccDay.dateStr.slice(5)}
                                </span>
                                <span className="text-xs font-black font-mono text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.2 rounded">
                                    {summaryStats.minOccDay.occupancyRate}% ({summaryStats.minOccDay.vacantUnits}실 공실)
                                </span>
                            </>
                        ) : (
                            <span className="text-xs text-gray-400">-</span>
                        )}
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-800/60 p-2.5 md:p-3 rounded-xl border border-gray-200/80 dark:border-slate-800 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">향후 누적 공실 객실-박</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl md:text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
                            {summaryStats.totalVacantNights}
                        </span>
                        <span className="text-[10px] text-gray-400">room-nights 잔여</span>
                    </div>
                </div>
            </div>

            {/* ⚠️ 조기 공실 주의 & 프로모션 추천 날짜 (Low Occupancy Alert) */}
            {riskDates.length > 0 ? (
                <div className="bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 p-3 md:p-3.5 flex flex-col gap-2 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                            <span className="text-base">🚨</span>
                            <span className="text-xs md:text-sm font-black text-amber-900 dark:text-amber-200">
                                조기 공실 주의 일자 ({riskDates.length}일 감지)
                            </span>
                            <span className="text-[10.5px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
                                주말 가동률 &lt; 60% 또는 공실 집중일
                            </span>
                        </div>
                        <span className="text-[10.5px] text-amber-600 dark:text-amber-400 font-bold hidden sm:inline">
                            💡 배지를 클릭하면 해당 날짜 공실 호실을 즉시 확인합니다
                        </span>
                    </div>

                    {/* 위험 날짜 클릭형 칩 리스트 */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {riskDates.map((d) => {
                            const isWeekend = d.dayOfWeek === '금' || d.dayOfWeek === '토';
                            const isSelected = activeDayDetail?.dateStr === d.dateStr;
                            return (
                                <button
                                    key={d.dateStr}
                                    type="button"
                                    onClick={() => setSelectedDateStr(d.dateStr)}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                                        isSelected
                                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs font-black scale-105'
                                            : isWeekend
                                            ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-50'
                                            : 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-50'
                                    }`}
                                >
                                    <span>{isWeekend ? '🔥' : '⚠️'}</span>
                                    <span className="font-mono">{d.dateStr.slice(5)}</span>
                                    <span>({d.dayOfWeek})</span>
                                    <span className="font-mono font-black ml-0.5">{d.occupancyRate}%</span>
                                    <span className="text-[10px] opacity-80">({d.vacantUnits}실 공실)</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 p-2.5 px-3 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                    <div className="flex items-center gap-2">
                        <span>🟢</span>
                        <span>안심: 조회 기간 내 모든 날짜의 가동률이 안정적으로 확보되어 있습니다.</span>
                    </div>
                    <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium hidden sm:inline font-mono">
                        (평균 가동률 {summaryStats.avgOcc}%)
                    </span>
                </div>
            )}

            {/* 월간 모드일 때 나타나는 이전달/다음달 스텝퍼 */}
            {periodPreset === 'month' && (
                <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/60 p-2 px-3 rounded-xl border border-gray-200/70 dark:border-slate-700/70">
                    <button
                        type="button"
                        onClick={() => setMonthOffset((prev) => prev - 1)}
                        className="px-2.5 py-1 bg-white dark:bg-slate-900 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 shadow-2xs hover:bg-gray-100 transition cursor-pointer"
                    >
                        ◀ 이전달
                    </button>
                    <span className="text-xs font-extrabold font-mono text-gray-900 dark:text-slate-100">
                        {startDate.slice(0, 7)} 전체 월간 공실 & 가동률 추이
                    </span>
                    <button
                        type="button"
                        onClick={() => setMonthOffset((prev) => prev + 1)}
                        className="px-2.5 py-1 bg-white dark:bg-slate-900 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 shadow-2xs hover:bg-gray-100 transition cursor-pointer"
                    >
                        다음달 ▶
                    </button>
                </div>
            )}

            {/* 3. 메인 뷰: [🛏️ 룸 랙 히트맵 뷰 (기본)] / [📅 달력 타일 뷰] / [📈 추세 선 그래프 뷰] */}

            {/* 📊 [뷰 2] 공실 종합 요약 탭 */}
            {viewMode === 'summary' && (
                <div className="flex flex-col gap-3">
                    {/* 상단 1열: 🚨 긴급 조치 리스크 (주말 공실 & D-3 임박 공실) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 1-A: 🔥 주말(금/토) 공실 경보 */}
                        <div className="bg-rose-50/60 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/60 p-3.5 flex flex-col justify-between shadow-2xs">
                            <div>
                                <div className="flex items-center justify-between pb-2 border-b border-rose-200/60 dark:border-rose-900/40">
                                    <div className="flex items-center gap-1.5 font-black text-rose-800 dark:text-rose-300 text-xs">
                                        <span className="text-sm">🔥</span>
                                        <span>주말(금/토) 공실 경보</span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 font-mono">
                                            {weekendVacancies.length}일 발견
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">최고 객단가 보호</span>
                                </div>

                                <div className="mt-2.5 flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                                    {weekendVacancies.length === 0 ? (
                                        <div className="py-4 text-center text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                                            <span>✓</span> 모든 주말이 완판되었습니다!
                                        </div>
                                    ) : (
                                        weekendVacancies.map((w) => (
                                            <div
                                                key={w.dateStr}
                                                onClick={() => setSelectedDateStr(w.dateStr)}
                                                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/50 flex items-center justify-between cursor-pointer hover:border-rose-400 transition"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-black text-xs text-gray-900 dark:text-slate-100">
                                                        {w.dateStr.slice(5)} ({w.dayOfWeek})
                                                    </span>
                                                    <span className="text-[10.5px] font-black text-rose-600 dark:text-rose-400">
                                                        {w.vacantUnits}실 공실
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1 max-w-[55%] justify-end">
                                                    {w.vacantUnitList.slice(0, 2).map((u) => (
                                                        <span
                                                            key={u.unitKey}
                                                            className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-100/70 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 truncate"
                                                        >
                                                            {u.unitName.replace(/\(.*?\)/, '').trim()}
                                                        </span>
                                                    ))}
                                                    {w.vacantUnitList.length > 2 && (
                                                        <span className="text-[9px] font-bold text-rose-500 self-center">
                                                            +{w.vacantUnitList.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-rose-200/50 dark:border-rose-900/40 text-[10.5px] text-rose-700/80 dark:text-rose-300/80 flex items-center justify-between">
                                <span>💡 클릭 시 해당 일자의 상세 공실 호실로 이동합니다</span>
                            </div>
                        </div>

                        {/* 1-B: ⚡ D-3 임박 공실 (라스트미닛) */}
                        <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900/60 p-3.5 flex flex-col justify-between shadow-2xs">
                            <div>
                                <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                                    <div className="flex items-center gap-1.5 font-black text-amber-800 dark:text-amber-300 text-xs">
                                        <span className="text-sm">⚡</span>
                                        <span>D-3 임박 공실 (라스트미닛)</span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-mono">
                                            {imminentVacancies.length}일 잔여
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">당일 특가 필요</span>
                                </div>

                                <div className="mt-2.5 flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                                    {imminentVacancies.length === 0 ? (
                                        <div className="py-4 text-center text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                                            <span>✓</span> 향후 3일간 공실이 없습니다!
                                        </div>
                                    ) : (
                                        imminentVacancies.map((iv) => (
                                            <div
                                                key={iv.dateStr}
                                                onClick={() => setSelectedDateStr(iv.dateStr)}
                                                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50 flex items-center justify-between cursor-pointer hover:border-amber-400 transition"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-black text-xs text-gray-900 dark:text-slate-100">
                                                        {iv.dateStr.slice(5)} ({iv.dayOfWeek})
                                                    </span>
                                                    <span className="text-[10.5px] font-black text-amber-700 dark:text-amber-300">
                                                        {iv.vacantUnits}실 비어있음
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1 max-w-[55%] justify-end">
                                                    {iv.vacantUnitList.slice(0, 2).map((u) => (
                                                        <span
                                                            key={u.unitKey}
                                                            className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-amber-100/70 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 truncate"
                                                        >
                                                            {u.unitName.replace(/\(.*?\)/, '').trim()}
                                                        </span>
                                                    ))}
                                                    {iv.vacantUnitList.length > 2 && (
                                                        <span className="text-[9px] font-bold text-amber-600 self-center">
                                                            +{iv.vacantUnitList.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-amber-200/50 dark:border-amber-900/40 text-[10.5px] text-amber-700/80 dark:text-amber-300/80 flex items-center justify-between">
                                <span>💡 당일 입실 타임세일(10~15%) 프로모션 권장</span>
                            </div>
                        </div>
                    </div>

                    {/* 중단 2열: 🛏️ 호실별 향후 가동률 랭킹 & 📅 요일별 가동 패턴 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 2-A: 호실별 가동률 & 공실 랭킹 (Top 5 취약 호실) */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-3.5 shadow-2xs">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                                <span className="font-black text-xs text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                                    <span>🛏️</span>
                                    <span>호실별 공실 취약도 랭킹 (주의 호실)</span>
                                </span>
                                <span className="text-[10px] text-gray-400">공실 많은 순</span>
                            </div>

                            <div className="mt-2.5 flex flex-col gap-2">
                                {rankedUnitStats.slice(0, 5).map((u, idx) => {
                                    const theme = PROPERTY_THEME[u.propName || ''] || {
                                        label: u.propName || '기타',
                                        badge: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200',
                                    };

                                    return (
                                        <div key={u.unitKey} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/40 transition">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-mono text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                                                <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded shrink-0 ${theme.badge}`}>
                                                    {theme.label}
                                                </span>
                                                <span className="font-black text-xs text-gray-900 dark:text-slate-100 truncate">
                                                    {u.displayName}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="w-16 md:w-20 bg-gray-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${
                                                            u.occRate >= 70 ? 'bg-emerald-500' : u.occRate >= 40 ? 'bg-blue-500' : 'bg-rose-500'
                                                        }`}
                                                        style={{ width: `${u.occRate}%` }}
                                                    />
                                                </div>
                                                <span className={`font-mono text-xs font-black min-w-[36px] text-right ${
                                                    u.occRate >= 70 ? 'text-emerald-600' : u.occRate >= 40 ? 'text-blue-600' : 'text-rose-600'
                                                }`}>
                                                    {u.occRate}%
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-bold min-w-[40px] text-right">
                                                    ({u.vacantNights}박 공실)
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2-B: 요일별 가동률 패턴 (월 ~ 일) */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-3.5 shadow-2xs">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                                <span className="font-black text-xs text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                                    <span>📅</span>
                                    <span>요일별 평균 가동률 패턴</span>
                                </span>
                                <span className="text-[10px] text-gray-400">주중 vs 주말 격차</span>
                            </div>

                            <div className="mt-3 flex items-end justify-between gap-1.5 h-[110px] px-1">
                                {dayOfWeekStats.map((dow) => {
                                    const isWeekend = dow.day === '금' || dow.day === '토';
                                    return (
                                        <div key={dow.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                                            <span className="font-mono text-[10px] font-black text-gray-600 dark:text-slate-300">
                                                {dow.avgOcc}%
                                            </span>
                                            <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-t-md h-full max-h-[70px] flex items-end p-0.5">
                                                <div
                                                    className={`w-full rounded-t-sm transition-all duration-300 ${
                                                        isWeekend
                                                            ? 'bg-rose-500 dark:bg-rose-600'
                                                            : dow.avgOcc >= 70
                                                            ? 'bg-blue-500 dark:bg-blue-600'
                                                            : 'bg-amber-400 dark:bg-amber-500'
                                                    }`}
                                                    style={{ height: `${Math.max(5, dow.avgOcc)}%` }}
                                                />
                                            </div>
                                            <span className={`text-[10.5px] font-black ${
                                                isWeekend ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-slate-400'
                                            }`}>
                                                {dow.day}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-800/80 text-[11px] text-gray-500 dark:text-slate-400 flex items-center justify-between">
                                <span>
                                    최저 요일: <strong className="text-amber-600 dark:text-amber-400">{minDow.day}요일 ({minDow.avgOcc}%)</strong>
                                </span>
                                <span>
                                    최고 요일: <strong className="text-emerald-600 dark:text-emerald-400">{maxDow.day}요일 ({maxDow.avgOcc}%)</strong>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 하단 3열: 💸 잠재 공실 손실액 추정 배너 */}
                    <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-3.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">
                                💸
                            </div>
                            <div>
                                <div className="text-xs text-blue-200 font-bold">향후 조회 기간 누적 공실 기회손실 추정</div>
                                <div className="text-sm md:text-base font-black text-white mt-0.5">
                                    총 <span className="text-amber-300 font-mono text-lg">{summaryStats.totalVacantNights}박</span> 공실 
                                    <span className="mx-1.5 opacity-40">|</span> 
                                    예상 손실액 약 <span className="text-amber-300 font-mono text-lg">{estimatedLostRevenue.toLocaleString()}원</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-[11px] text-blue-200/80 max-w-xs text-right hidden sm:block">
                            * 평균 1박 단가(ADR 약 {estimatedAdr.toLocaleString()}원) 기준 단순 추정치이며, 조기 특가 프로모션으로 방어 가능합니다.
                        </div>
                    </div>
                </div>
            )}

            {/* 📈 [뷰 3] 추세 선 그래프 뷰 */}
            {viewMode === 'chart' && chartConfig && (
                <div className="flex flex-col gap-2">
                    {/* SVG 추세 차트 영역 (가로 스크롤 가능하여 모바일에서도 완벽하게 표시) */}
                    <div className="w-full overflow-x-auto bg-gray-50/70 dark:bg-slate-800/30 rounded-2xl border border-gray-100 dark:border-slate-800/80 p-2 md:p-3">
                        <div style={{ minWidth: `${chartConfig.chartWidth}px` }} className="relative select-none">
                            <svg
                                width={chartConfig.chartWidth}
                                height={chartConfig.chartHeight}
                                className="overflow-visible"
                            >
                                <defs>
                                    {/* 그라데이션 영역 채우기 */}
                                    <linearGradient id="occGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
                                        <stop offset="85%" stopColor="#3b82f6" stopOpacity="0.02" />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                    </linearGradient>
                                </defs>

                                {/* Y축 기준 가이드 라인 (0%, 50%, 100%) */}
                                {[0, 50, 100].map((rate) => {
                                    const yPos = chartConfig.topPadding + (1 - rate / 100) * chartConfig.plotHeight;
                                    return (
                                        <g key={rate}>
                                            <line
                                                x1="16"
                                                y1={yPos}
                                                x2={chartConfig.chartWidth - 16}
                                                y2={yPos}
                                                stroke={rate === 100 ? '#10b981' : '#e2e8f0'}
                                                strokeWidth={rate === 100 ? '1.5' : '1'}
                                                strokeDasharray={rate === 100 ? '4 3' : '2 3'}
                                                className="dark:stroke-slate-700/60"
                                            />
                                            <text
                                                x="20"
                                                y={yPos - 4}
                                                fontSize="9"
                                                fontWeight="bold"
                                                fill={rate === 100 ? '#10b981' : '#94a3b8'}
                                                fontFamily="monospace"
                                            >
                                                {rate}% {rate === 100 && '(만실)'}
                                            </text>
                                        </g>
                                    );
                                })}

                                {/* 영역 채우기 */}
                                <path d={chartConfig.areaPath} fill="url(#occGradient)" />

                                {/* 메인 가동률 곡선 */}
                                <path
                                    d={chartConfig.linePath}
                                    fill="none"
                                    stroke="#2563eb"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="drop-shadow-xs"
                                />

                                {/* 각 날짜 데이터 포인트 및 전일 대비 증감 뱃지 */}
                                {chartConfig.points.map((pt) => {
                                    const isSelected = activeDayDetail?.dateStr === pt.dateStr;
                                    const isHovered = hoveredDateStr === pt.dateStr;
                                    const [, month, day] = pt.dateStr.split('-');
                                    const badge = getOccupancyBadge(pt.occupancyRate);

                                    return (
                                        <g
                                            key={pt.dateStr}
                                            className="cursor-pointer transition-all duration-200"
                                            onClick={() => setSelectedDateStr(pt.dateStr)}
                                            onMouseEnter={() => setHoveredDateStr(pt.dateStr)}
                                            onMouseLeave={() => setHoveredDateStr(null)}
                                        >
                                            {/* 선택된 날짜 수직 가이드 하이라이트 */}
                                            {isSelected && (
                                                <line
                                                    x1={pt.x}
                                                    y1={chartConfig.topPadding}
                                                    x2={pt.x}
                                                    y2={chartConfig.topPadding + chartConfig.plotHeight + 35}
                                                    stroke="#3b82f6"
                                                    strokeWidth="2"
                                                    strokeDasharray="3 3"
                                                    className="animate-pulse"
                                                />
                                            )}

                                            {/* 데이터 포인트 원 */}
                                            <circle
                                                cx={pt.x}
                                                cy={pt.y}
                                                r={isSelected || isHovered ? 6.5 : 4.5}
                                                fill={badge.fill}
                                                stroke="#ffffff"
                                                strokeWidth={isSelected || isHovered ? 2.5 : 1.5}
                                                className="transition-all duration-150"
                                            />

                                            {/* 상단 1) 가동률 수치 라벨 */}
                                            <text
                                                x={pt.x}
                                                y={pt.y - 14}
                                                textAnchor="middle"
                                                fontSize={isSelected ? '12' : '10.5'}
                                                fontWeight="900"
                                                fontFamily="monospace"
                                                fill={isSelected ? '#1d4ed8' : '#1e293b'}
                                                className="dark:fill-slate-100"
                                            >
                                                {pt.occupancyRate}%
                                            </text>

                                            {/* 상단 2) 전일 대비 증감 (DoD) 뱃지 (첫날 제외) */}
                                            {pt.diffFromPrev !== null && (
                                                <g transform={`translate(${pt.x}, ${pt.y - 28})`}>
                                                    <rect
                                                        x={pt.diffFromPrev > 0 ? -18 : pt.diffFromPrev < 0 ? -18 : -12}
                                                        y="-9"
                                                        width={pt.diffFromPrev === 0 ? 24 : 36}
                                                        height="14"
                                                        rx="4"
                                                        fill={
                                                            pt.diffFromPrev > 0
                                                                ? '#10b981'
                                                                : pt.diffFromPrev < 0
                                                                ? '#ef4444'
                                                                : '#94a3b8'
                                                        }
                                                        opacity="0.9"
                                                    />
                                                    <text
                                                        x="0"
                                                        y="1.5"
                                                        textAnchor="middle"
                                                        fontSize="8.5"
                                                        fontWeight="bold"
                                                        fill="#ffffff"
                                                        fontFamily="monospace"
                                                    >
                                                        {pt.diffFromPrev > 0
                                                            ? `▲+${pt.diffFromPrev}`
                                                            : pt.diffFromPrev < 0
                                                            ? `▼${pt.diffFromPrev}`
                                                            : '0'}
                                                    </text>
                                                </g>
                                            )}

                                            {/* 하단 X축 날짜 및 요일 라벨 */}
                                            <g transform={`translate(${pt.x}, ${chartConfig.chartHeight - 32})`}>
                                                <text
                                                    x="0"
                                                    y="0"
                                                    textAnchor="middle"
                                                    fontSize="11"
                                                    fontWeight="bold"
                                                    fontFamily="monospace"
                                                    fill={isSelected ? '#2563eb' : '#475569'}
                                                    className="dark:fill-slate-200"
                                                >
                                                    {Number(month)}/{Number(day)}
                                                </text>
                                                <text
                                                    x="0"
                                                    y="13"
                                                    textAnchor="middle"
                                                    fontSize="9.5"
                                                    fontWeight="bold"
                                                    fill={
                                                        pt.isWeekend
                                                            ? '#e11d48'
                                                            : isSelected
                                                            ? '#2563eb'
                                                            : '#94a3b8'
                                                    }
                                                >
                                                    ({pt.dayOfWeek})
                                                </text>
                                            </g>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500 px-1">
                        <span>💡 포인트 클릭 시 하단에서 해당 일자의 공실 호실을 즉시 확인할 수 있습니다.</span>
                        <div className="flex items-center gap-3 font-semibold">
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> 전일 대비 상승 (▲)
                            </span>
                            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> 전일 대비 하락 (▼)
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* 📅 [뷰 1] 공실 중심 7열 캘린더 뷰 */}
            {viewMode === 'calendar' && (
                <div className="flex flex-col gap-2">
                    {/* 상단 요일 헤더 (일 ~ 토) */}
                    <div className="grid grid-cols-7 gap-1 md:gap-2 text-center text-xs font-black py-1.5 px-1 bg-gray-50/80 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800">
                        <span className="text-rose-600 dark:text-rose-400">일</span>
                        <span className="text-gray-700 dark:text-slate-300">월</span>
                        <span className="text-gray-700 dark:text-slate-300">화</span>
                        <span className="text-gray-700 dark:text-slate-300">수</span>
                        <span className="text-gray-700 dark:text-slate-300">목</span>
                        <span className="text-rose-600 dark:text-rose-400">금 🔥</span>
                        <span className="text-rose-600 dark:text-rose-400">토 🔥</span>
                    </div>

                    {/* 7열 달력 날짜 그리드 (빈 셀 패딩 적용) */}
                    <div className="grid grid-cols-7 gap-1 md:gap-2">
                        {calendarDaysWithBlanks.map((cell) => {
                            if (cell.type === 'blank') {
                                return (
                                    <div
                                        key={cell.key}
                                        className="min-h-[115px] md:min-h-[125px] rounded-xl bg-gray-50/40 dark:bg-slate-850/20 border border-dashed border-gray-100 dark:border-slate-800/40 opacity-40"
                                    />
                                );
                            }

                            const d = cell.data;
                            const isSelected = activeDayDetail?.dateStr === d.dateStr;
                            const [, month, day] = d.dateStr.split('-');
                            const isWeekend = d.dayOfWeek === '금' || d.dayOfWeek === '토';
                            const hasVacant = d.vacantUnits > 0;

                            return (
                                <div
                                    key={d.dateStr}
                                    onClick={() => setSelectedDateStr(d.dateStr)}
                                    className={`p-2 md:p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between min-h-[115px] md:min-h-[125px] shadow-2xs select-none ${
                                        isSelected
                                            ? 'border-blue-600 dark:border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/50 dark:bg-blue-950/30 shadow-xs'
                                            : hasVacant
                                            ? isWeekend
                                                ? 'border-rose-300 dark:border-rose-800/80 bg-rose-50/60 dark:bg-rose-950/25 hover:border-rose-400 hover:shadow-xs'
                                                : 'border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-300'
                                            : 'border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/25 dark:bg-emerald-950/10 hover:border-emerald-200'
                                    }`}
                                >
                                    {/* 상단: 날짜 & 요일 & 가동률 */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-baseline gap-1">
                                            <span className="font-mono font-black text-xs md:text-sm text-gray-900 dark:text-slate-100">
                                                {Number(day)}
                                            </span>
                                            <span
                                                className={`text-[10px] font-bold ${
                                                    isWeekend
                                                        ? 'text-rose-600 dark:text-rose-400 font-black'
                                                        : 'text-gray-400 dark:text-slate-500'
                                                }`}
                                            >
                                                {d.dayOfWeek}
                                            </span>
                                        </div>

                                        <span
                                            className={`text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded ${
                                                !hasVacant
                                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                                    : isWeekend
                                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-black'
                                                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                            }`}
                                        >
                                            {d.occupancyRate}%
                                        </span>
                                    </div>

                                    {/* 중앙: 🛏️ 공실 호실 직접 표시 (핵심!) */}
                                    <div className="flex-1 flex flex-col justify-center my-1">
                                        {!hasVacant ? (
                                            /* 🟢 만실인 날 */
                                            <div className="flex flex-col items-center justify-center py-1 text-emerald-600 dark:text-emerald-400">
                                                <span className="text-[11px] font-black flex items-center gap-0.5">
                                                    <span>✓</span> 만실
                                                </span>
                                                <span className="text-[9px] opacity-75 font-normal">공실 없음</span>
                                            </div>
                                        ) : (
                                            /* 🔴 공실이 있는 날 */
                                            <div className="flex flex-col gap-1">
                                                {/* 공실 개수 헤더 배지 */}
                                                <div className="flex items-center justify-between">
                                                    <span
                                                        className={`text-[10px] font-black px-1.5 py-0.2 rounded flex items-center gap-1 ${
                                                            isWeekend
                                                                ? 'bg-rose-600 text-white shadow-2xs'
                                                                : 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                                                        }`}
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-rose-400 inline-block animate-pulse" />
                                                        <span>공실 {d.vacantUnits}실</span>
                                                    </span>
                                                </div>

                                                {/* 🏷️ 실제 비어있는 호실명 칩들 */}
                                                <div className="flex flex-wrap gap-1 mt-0.5 max-h-[46px] overflow-hidden">
                                                    {d.vacantUnitList.slice(0, 2).map((v) => {
                                                        const cleanName = v.unitName.replace(/\(.*?\)/, '').trim();
                                                        return (
                                                            <span
                                                                key={v.unitKey}
                                                                className="text-[9px] md:text-[9.5px] font-black px-1 py-0.2 rounded bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-rose-300 dark:border-rose-800 shadow-2xs truncate max-w-full"
                                                                title={v.unitName}
                                                            >
                                                                {cleanName}
                                                            </span>
                                                        );
                                                    })}
                                                    {d.vacantUnitList.length > 2 && (
                                                        <span className="text-[8.5px] font-bold text-rose-600 dark:text-rose-400 self-center">
                                                            +{d.vacantUnitList.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 하단: 선택 표시 또는 점유 안내 */}
                                    <div className="flex items-center justify-between text-[9.5px] pt-1 border-t border-gray-100 dark:border-slate-800/80">
                                        <span className="text-gray-400 dark:text-slate-500 font-mono">
                                            {d.bookedUnits}/{d.totalUnits}실
                                        </span>
                                        {isSelected ? (
                                            <span className="text-blue-600 dark:text-blue-400 font-black">
                                                선택됨 ✓
                                            </span>
                                        ) : isWeekend && hasVacant ? (
                                            <span className="text-rose-600 dark:text-rose-400 font-black text-[9px]">
                                                주말주의
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 4. 하단 상세 패널: 선택된 날짜의 가동률/전일비 변동 및 공실 호실 목록 */}
            {activeDayDetail && (
                <div className="bg-blue-50/40 dark:bg-slate-800/50 rounded-xl p-3.5 border border-blue-200/70 dark:border-slate-700/70 flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-blue-100 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">🔍</span>
                            <span className="font-black text-xs md:text-sm text-gray-900 dark:text-slate-100 font-mono">
                                {activeDayDetail.dateStr} ({activeDayDetail.dayOfWeek}) 가동률 및 공실 상세
                            </span>
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                • 가동률: {activeDayDetail.occupancyRate}%
                            </span>
                            {activeDayDetail.diffFromPrev !== null && (
                                <span
                                    className={`text-xs font-black font-mono px-1.5 py-0.2 rounded ${
                                        activeDayDetail.diffFromPrev > 0
                                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                            : activeDayDetail.diffFromPrev < 0
                                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                            : 'bg-gray-100 dark:bg-slate-800 text-gray-500'
                                    }`}
                                >
                                    전일 대비 {activeDayDetail.diffFromPrev > 0 ? `▲+${activeDayDetail.diffFromPrev}%p` : activeDayDetail.diffFromPrev < 0 ? `▼${activeDayDetail.diffFromPrev}%p` : '변동없음'}
                                </span>
                            )}
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                (잔여 공실 {activeDayDetail.vacantUnits}실 / 총 공급 {activeDayDetail.totalUnits}실)
                            </span>
                        </div>
                        <span className="text-[11px] font-medium text-gray-400 dark:text-slate-500">
                            차트 포인트를 클릭하거나 호버하여 일자 전환
                        </span>
                    </div>

                    {activeDayDetail.vacantUnits === 0 ? (
                        <div className="text-center py-4 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5">
                            <span>🎉</span>
                            <span>해당 일자는 모든 호실이 예약 완료된 만실(100%) 상태입니다!</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {Object.entries(groupedVacantUnits).map(([propName, units]) => (
                                <div key={propName} className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-extrabold text-gray-700 dark:text-slate-300 min-w-[70px]">
                                        • {propName} ({units.length}실):
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {units.map((u) => (
                                            <span
                                                key={u.unitKey}
                                                className="px-2 py-1 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 font-black rounded-lg text-xs shadow-2xs hover:bg-rose-50 transition"
                                            >
                                                {u.unitName}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
