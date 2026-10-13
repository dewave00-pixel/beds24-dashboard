'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Booking } from '../../types';
import {
    calculateHierarchicalPeriodComparison,
    HierarchicalComparisonResult,
    PeriodComparisonResult,
} from '../../utils/analyticsCalculations';
import { getPreviousEquivalentPeriod, getPreviousYearEquivalentPeriod } from '../../utils/dateStepperUtils';

interface PeriodComparisonSectionProps {
    bookings: Booking[];
    startDate?: string; // YYYY-MM-DD (마스터 날짜)
    endDate?: string;   // YYYY-MM-DD (마스터 날짜)
    selectedProperty?: string;
    selectedUnitKey?: string;
}

type ComparisonMode = 'previous' | 'yoy'; // 직전 동일 기간(MoM) | 전년 동기(YoY)
type ViewMode = 'cards' | 'chart';
type SortField = 'revenue' | 'occupancy' | 'adr' | 'leadTime' | 'stayNights' | 'room';
type SortDirection = 'desc' | 'asc';
type ChartMetric = 'revenue' | 'occupancy' | 'adr' | 'leadTime' | 'stayNights';

// 직전 기간 대비 증감 배지 렌더러
function DiffBadge({
    diff,
    unit = '',
    reverse = false,
}: {
    diff: number;
    unit?: string;
    reverse?: boolean;
}) {
    if (diff === 0) {
        return (
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                변동없음
            </span>
        );
    }
    const isGood = reverse ? diff < 0 : diff > 0;
    const sign = diff > 0 ? '+' : '';

    return (
        <span
            className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 shrink-0 ${
                isGood
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
            }`}
        >
            <span>{diff > 0 ? '▲' : '▼'}</span>
            <span>
                {sign}
                {diff}
                {unit}
            </span>
        </span>
    );
}

// 건물 라벨 및 테마 뱃지
const PROPERTY_LABEL: Record<string, { label: string; badge: string }> = {
    YEONNAM: { label: '연남', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300' },
    WAVE: { label: '웨이브', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300' },
    Green: { label: '그린', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' },
    Namsun: { label: '남선', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300' },
};

interface UnitRowData {
    unitKey: string;
    roomName: string;
    propName: string;
    roomId: number;
    comparison: PeriodComparisonResult;
}

export default function PeriodComparisonSection({
    bookings,
    startDate,
    endDate,
    selectedProperty: parentProperty = 'all',
    selectedUnitKey = 'all',
}: PeriodComparisonSectionProps) {
    // 1. 기준 기간 A 계산 (마스터 날짜 우선, 기본값 최근 14일)
    const { startA, endA } = useMemo(() => {
        if (startDate && endDate) {
            return { startA: startDate, endA: endDate };
        }
        const now = new Date();
        const end = now.toISOString().slice(0, 10);
        const past = new Date(now);
        past.setDate(past.getDate() - 13);
        return { startA: past.toISOString().slice(0, 10), endA: end };
    }, [startDate, endDate]);

    // 비교 모드: 'previous' (직전 동일 기간) vs 'yoy' (전년 동기 - 1년 전 동일 일자)
    const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('previous');

    // 2. 비교 기간 B 계산 (A기간과 동일한 길이의 직전 기간 또는 전년 동기 자동 매칭)
    const { start: startB, end: endB } = useMemo(() => {
        if (comparisonMode === 'yoy') {
            return getPreviousYearEquivalentPeriod(startA, endA);
        }
        return getPreviousEquivalentPeriod(startA, endA);
    }, [startA, endA, comparisonMode]);

    // 3. 탑다운 계층형 A vs B 비교 연산 (전체 ➔ 지점 ➔ 호실)
    const hierarchicalData: HierarchicalComparisonResult = useMemo(() => {
        return calculateHierarchicalPeriodComparison(
            bookings,
            { start: startA, end: endA },
            { start: startB, end: endB }
        );
    }, [bookings, startA, endA, startB, endB]);

    // 4. 호실 평탄화 리스트 생성
    const allUnitRows: UnitRowData[] = useMemo(() => {
        const list: UnitRowData[] = [];
        hierarchicalData.properties.forEach((prop) => {
            prop.units.forEach((u) => {
                list.push({
                    unitKey: u.unitKey,
                    roomName: u.roomName,
                    propName: prop.propName,
                    roomId: u.roomId,
                    comparison: u.comparison,
                });
            });
        });
        return list;
    }, [hierarchicalData]);

    // 세부 탭 모드: 'cards' (1:1 비교 카드) | 'chart' (비교 차트)
    const [viewMode, setViewMode] = useState<ViewMode>('cards');
    const selectedProperty = parentProperty || 'all';
    const [sortField, setSortField] = useState<SortField>('revenue');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // 📊 비교 차트 뷰 전용 상태: 선택된 지표 (지표 변경 시 해당 지표로 자동 정렬)
    const [chartMetric, setChartMetric] = useState<ChartMetric>('revenue');

    const handleSelectChartMetric = (metric: ChartMetric) => {
        setChartMetric(metric);
        setSortField(metric);
        setSortDirection('desc');
    };

    // 필터링 및 정렬된 호실 리스트 (마스터바 및 지점 필터 100% 반영)
    const processedRooms = useMemo(() => {
        let list = allUnitRows;
        if (selectedProperty !== 'all') {
            list = list.filter((r) => r.propName === selectedProperty);
        }
        if (selectedUnitKey !== 'all') {
            list = list.filter((r) => r.unitKey === selectedUnitKey || String(r.roomId) === selectedUnitKey);
        }

        const sorted = [...list];
        sorted.sort((a, b) => {
            let diff = 0;
            if (sortField === 'revenue') {
                diff = a.comparison.periodA.totalRevenue - b.comparison.periodA.totalRevenue;
            } else if (sortField === 'occupancy') {
                diff = a.comparison.periodA.occupancyRate - b.comparison.periodA.occupancyRate;
            } else if (sortField === 'adr') {
                diff = a.comparison.periodA.adr - b.comparison.periodA.adr;
            } else if (sortField === 'leadTime') {
                diff = a.comparison.periodA.avgLeadDays - b.comparison.periodA.avgLeadDays;
            } else if (sortField === 'stayNights') {
                diff = a.comparison.periodA.avgStayNights - b.comparison.periodA.avgStayNights;
            } else if (sortField === 'room') {
                return sortDirection === 'desc'
                    ? b.roomName.localeCompare(a.roomName, 'ko-KR')
                    : a.roomName.localeCompare(b.roomName, 'ko-KR');
            }
            return sortDirection === 'desc' ? -diff : diff;
        });

        return sorted;
    }, [allUnitRows, selectedProperty, selectedUnitKey, sortField, sortDirection]);

    // 정렬 토글 핸들러
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const { overall } = hierarchicalData;

    // 📊 차트 렌더링용 계산 데이터 (마스터바와 지점에 의해 필터링된 호실들을 100% 그대로 차트에 바인딩)
    const chartRooms = processedRooms;

    // 지표별 최댓값 및 포맷터 설정
    const metricConfig = useMemo(() => {
        let maxVal = 1;
        chartRooms.forEach((r) => {
            const valA =
                chartMetric === 'revenue'
                    ? r.comparison.periodA.totalRevenue
                    : chartMetric === 'occupancy'
                    ? r.comparison.periodA.occupancyRate
                    : chartMetric === 'adr'
                    ? r.comparison.periodA.adr
                    : chartMetric === 'leadTime'
                    ? r.comparison.periodA.avgLeadDays
                    : r.comparison.periodA.avgStayNights;

            const valB =
                chartMetric === 'revenue'
                    ? r.comparison.periodB.totalRevenue
                    : chartMetric === 'occupancy'
                    ? r.comparison.periodB.occupancyRate
                    : chartMetric === 'adr'
                    ? r.comparison.periodB.adr
                    : chartMetric === 'leadTime'
                    ? r.comparison.periodB.avgLeadDays
                    : r.comparison.periodB.avgStayNights;

            if (valA > maxVal) maxVal = valA;
            if (valB > maxVal) maxVal = valB;
        });

        const label =
            chartMetric === 'revenue'
                ? '실매출'
                : chartMetric === 'occupancy'
                ? '가동률'
                : chartMetric === 'adr'
                ? '객단가 ADR'
                : chartMetric === 'leadTime'
                ? '리드타임'
                : '평균 투숙박수';

        const unit =
            chartMetric === 'revenue'
                ? '원'
                : chartMetric === 'occupancy'
                ? '%'
                : chartMetric === 'adr'
                ? '원'
                : chartMetric === 'leadTime'
                ? '일'
                : '박';

        const formatShort = (v: number) => {
            if (chartMetric === 'revenue') return `₩${Math.round(v / 10000).toLocaleString()}만`;
            if (chartMetric === 'occupancy') return `${v}%`;
            if (chartMetric === 'adr') return `₩${Math.round(v / 1000).toLocaleString()}k`;
            if (chartMetric === 'leadTime') return `${v}일`;
            return `${v}박`;
        };

        const formatFull = (v: number) => {
            if (chartMetric === 'revenue' || chartMetric === 'adr') return `₩${v.toLocaleString()}`;
            if (chartMetric === 'occupancy') return `${v}%`;
            if (chartMetric === 'leadTime') return `${v}일`;
            return `${v}박`;
        };

        return { maxVal: maxVal > 0 ? maxVal * 1.15 : 100, label, unit, formatShort, formatFull };
    }, [chartRooms, chartMetric]);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-4 md:p-6 shadow-xs flex flex-col gap-6 w-full">
            {/* 1. 상단 섹션 헤더 & 기간 정보 및 비교 모드 토글 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">
                        기간 전후 비교 분석
                    </h3>
                    <span className="text-xs text-gray-400 font-medium font-mono">
                        ({processedRooms.length}개 호실 대조)
                    </span>
                </div>

                {/* 기간 정보 및 비교 모드 토글 */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* 비교 모드 스위치: 직전 동일 기간 (MoM) vs 전년 동기 (YoY) */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-black">
                        <button
                            type="button"
                            onClick={() => setComparisonMode('previous')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1 ${
                                comparisonMode === 'previous'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <span>⏪ 직전 동일 기간</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setComparisonMode('yoy')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1 ${
                                comparisonMode === 'yoy'
                                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-2xs'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <span>🗓️ 전년 동기 (YoY)</span>
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-lg font-bold whitespace-nowrap">
                            기준 {startA} ~ {endA} ({overall.periodA.periodDays}일)
                        </span>
                        <span className="text-gray-400 font-medium text-[11px] whitespace-nowrap">
                            vs {comparisonMode === 'yoy' ? '전년 동기' : '직전'} ({startB} ~ {endB})
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. 전체 사업장 종합 지표 (대형 1:1 종합 비교 카드) */}
            <div className="bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/20 dark:from-slate-800/80 dark:via-slate-850 dark:to-slate-800/80 rounded-2xl border border-blue-200/70 dark:border-slate-700/80 p-4 md:p-5 shadow-2xs flex flex-col gap-3.5">
                {/* 상단 타이틀 바 */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="text-base">🏢</span>
                        <span className="font-black text-sm md:text-base text-gray-900 dark:text-slate-100">
                            전체 종합 실적 비교
                        </span>
                        <span className="text-[11px] text-gray-400 font-medium">
                            (모든 사업장 합산)
                        </span>
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono font-medium">
                        기준 {overall.periodA.periodDays}일 vs {comparisonMode === 'yoy' ? '전년 동기' : '직전'} {overall.periodB.periodDays}일
                    </div>
                </div>

                {/* 좌우 1:1 대조 그리드 (좌: 기준 기간 vs 우: 직전 기간) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-gray-100 dark:border-slate-800">
                    {/* 👈 좌측: 기준 기간 실적 */}
                    <div className="flex flex-col gap-2.5 md:border-r md:border-gray-100 dark:md:border-slate-800 md:pr-4">
                        <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-slate-800">
                            <span className="font-black text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-600" />
                                기준 기간 ({startA} ~ {endA})
                            </span>
                            <span className="text-[11px] text-gray-400 font-mono font-medium">
                                {overall.periodA.periodDays}일간
                            </span>
                        </div>

                        {/* 메인 2대 지표: 매출 & 가동률 */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-gray-50/80 dark:bg-slate-800/60 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 flex flex-col">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10.5px] text-gray-400 font-bold">정산 실매출</span>
                                    <DiffBadge diff={overall.revenuePct} unit="%" />
                                </div>
                                <span className="text-lg md:text-xl font-black text-gray-900 dark:text-slate-100 font-mono mt-0.5">
                                    ₩{Math.round(overall.periodA.totalRevenue / 10000).toLocaleString()}만
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                    (₩{overall.periodA.totalRevenue.toLocaleString()})
                                </span>
                            </div>
                            <div className="bg-gray-50/80 dark:bg-slate-800/60 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 flex flex-col">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10.5px] text-gray-400 font-bold">평균 가동률</span>
                                    <DiffBadge diff={overall.occupancyDiff} unit="%p" />
                                </div>
                                <span className="text-lg md:text-xl font-black text-blue-700 dark:text-blue-400 font-mono mt-0.5">
                                    {overall.periodA.occupancyRate}%
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                    총 {overall.periodA.totalNights}박 투숙
                                </span>
                            </div>
                        </div>

                        {/* 서브 지표 3개: ADR, 리드타임, 평균박수 */}
                        <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
                            <div className="bg-gray-50/50 dark:bg-slate-800/40 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-400 font-bold">객단가 ADR</span>
                                    <DiffBadge diff={overall.adrPct} unit="%" />
                                </div>
                                <span className="font-extrabold text-purple-700 dark:text-purple-300 text-xs md:text-sm mt-0.5">
                                    ₩{overall.periodA.adr.toLocaleString()}
                                </span>
                            </div>
                            <div className="bg-gray-50/50 dark:bg-slate-800/40 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-400 font-bold">평균 리드타임</span>
                                    <DiffBadge diff={overall.leadDaysDiff} unit="일" />
                                </div>
                                <span className="font-bold text-gray-900 dark:text-slate-100 text-xs md:text-sm mt-0.5">
                                    {overall.periodA.avgLeadDays === 0 ? '당일' : `${overall.periodA.avgLeadDays}일`}
                                </span>
                            </div>
                            <div className="bg-gray-50/50 dark:bg-slate-800/40 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-400 font-bold">평균 투숙박수</span>
                                    <DiffBadge diff={overall.stayNightsDiff} unit="박" />
                                </div>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs md:text-sm mt-0.5">
                                    {overall.periodA.avgStayNights}박
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 👉 우측: 비교 기간 실적 */}
                    <div className="flex flex-col gap-2.5 md:pl-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-slate-800">
                            <span className="font-black text-gray-500 dark:text-slate-400 text-xs flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-gray-400" />
                                {comparisonMode === 'yoy' ? '전년 동기' : '직전 기간'} ({startB} ~ {endB})
                            </span>
                            <span className="text-[11px] text-gray-400 font-mono font-medium">
                                {overall.periodB.periodDays}일간
                            </span>
                        </div>

                        {/* 메인 2대 지표: 매출 & 가동률 */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-gray-50/50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 flex flex-col">
                                <span className="text-[10.5px] text-gray-400 font-bold">정산 실매출</span>
                                <span className="text-lg md:text-xl font-bold text-gray-600 dark:text-slate-300 font-mono mt-0.5">
                                    ₩{Math.round(overall.periodB.totalRevenue / 10000).toLocaleString()}만
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                    (₩{overall.periodB.totalRevenue.toLocaleString()})
                                </span>
                            </div>
                            <div className="bg-gray-50/50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 flex flex-col">
                                <span className="text-[10.5px] text-gray-400 font-bold">평균 가동률</span>
                                <span className="text-lg md:text-xl font-bold text-gray-600 dark:text-slate-300 font-mono mt-0.5">
                                    {overall.periodB.occupancyRate}%
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                    총 {overall.periodB.totalNights}박 투숙
                                </span>
                            </div>
                        </div>

                        {/* 서브 지표 3개: ADR, 리드타임, 평균박수 */}
                        <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
                            <div className="bg-gray-50/30 dark:bg-slate-800/20 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col">
                                <span className="text-[10px] text-gray-400 font-bold">객단가 ADR</span>
                                <span className="font-bold text-gray-600 dark:text-slate-300 text-xs md:text-sm mt-0.5">
                                    ₩{overall.periodB.adr.toLocaleString()}
                                </span>
                            </div>
                            <div className="bg-gray-50/30 dark:bg-slate-800/20 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col">
                                <span className="text-[10px] text-gray-400 font-bold">평균 리드타임</span>
                                <span className="font-bold text-gray-600 dark:text-slate-300 text-xs md:text-sm mt-0.5">
                                    {overall.periodB.avgLeadDays === 0 ? '당일' : `${overall.periodB.avgLeadDays}일`}
                                </span>
                            </div>
                            <div className="bg-gray-50/30 dark:bg-slate-800/20 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col">
                                <span className="text-[10px] text-gray-400 font-bold">평균 투숙박수</span>
                                <span className="font-bold text-gray-600 dark:text-slate-300 text-xs md:text-sm mt-0.5">
                                    {overall.periodB.avgStayNights}박
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. 🎛️ 상단 컨트롤 바: 세부 탭 (1:1 카드 vs 비교 차트) + 건물 토글 칩 필터 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
                {/* 좌측: 1:1 카드 뷰 vs 비교 차트 뷰 세부 탭 */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => setViewMode('cards')}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 select-none ${
                            viewMode === 'cards'
                                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-black shadow-xs'
                                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <span>🗂️</span>
                        <span>1:1 비교 카드</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('chart')}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 select-none ${
                            viewMode === 'chart'
                                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-black shadow-xs'
                                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <span>📊</span>
                        <span>지표별 비교 차트</span>
                    </button>
                </div>

                {/* 우측: 마스터바 연동 안내 배지 (중복 건물 탭 제거) */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    <span>
                        {selectedUnitKey !== 'all'
                            ? `🚪 ${chartRooms[0]?.roomName || selectedUnitKey} 단독 분석`
                            : selectedProperty !== 'all'
                            ? `🏢 ${PROPERTY_LABEL[selectedProperty]?.label || selectedProperty} 지점 (${chartRooms.length}개 호실)`
                            : `🏢 전체 지점 (${chartRooms.length}개 호실)`}
                    </span>
                </div>
            </div>

            {/* 🗂️ MODE A: 1:1 비교 카드 뷰 */}
            {viewMode === 'cards' && (
                <div className="flex flex-col gap-3">
                    {/* 간이 정렬 바 */}
                    <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-slate-400 pb-1 overflow-x-auto">
                        <span className="shrink-0 mr-2">정렬 기준:</span>
                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800/80 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700 text-[11px] shrink-0">
                            {[
                                { key: 'revenue', label: '매출' },
                                { key: 'occupancy', label: '가동률' },
                                { key: 'adr', label: '단가' },
                                { key: 'leadTime', label: '리드타임' },
                                { key: 'stayNights', label: '박수' },
                            ].map((s) => (
                                <button
                                    key={s.key}
                                    type="button"
                                    onClick={() => handleSort(s.key as SortField)}
                                    className={`px-2 py-0.5 rounded transition ${
                                        sortField === s.key
                                            ? 'bg-blue-600 text-white font-black'
                                            : 'text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {s.label} {sortField === s.key && (sortDirection === 'desc' ? '▼' : '▲')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2열 그리드 카드 배열 (PC 2열, 모바일 1열) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                        {processedRooms.map((room, idx) => {
                            const uComp = room.comparison;
                            const propBadge = PROPERTY_LABEL[room.propName] || { label: room.propName, badge: 'bg-gray-100 text-gray-800' };

                            return (
                                <div
                                    key={room.unitKey}
                                    className="bg-white dark:bg-slate-850 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-2xs flex flex-col gap-3 hover:border-blue-400 dark:hover:border-blue-500/60 transition"
                                >
                                    {/* 카드 상단: 순위 + 호실명 + 건물 태그 + 총매출 증감 배지 */}
                                    <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                                idx === 0
                                                    ? 'bg-amber-400 text-slate-900 shadow-2xs font-extrabold'
                                                    : idx === 1
                                                    ? 'bg-slate-300 text-slate-900 font-extrabold'
                                                    : idx === 2
                                                    ? 'bg-amber-700 text-white font-extrabold'
                                                    : 'bg-slate-900 dark:bg-slate-700 text-white'
                                            }`}>
                                                {idx + 1}
                                            </span>
                                            <span className="font-black text-base text-gray-900 dark:text-slate-100">
                                                {room.roomName}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${propBadge.badge}`}>
                                                {propBadge.label}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] text-gray-400 font-mono">
                                                {uComp.revenueDiff >= 0 ? `+₩${Math.round(uComp.revenueDiff / 10000).toLocaleString()}만` : `-₩${Math.round(Math.abs(uComp.revenueDiff) / 10000).toLocaleString()}만`}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 카드 본문: 좌우 1:1 나란히 대조 (좌: 기준 기간 vs 우: 직전 기간) */}
                                    <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50/70 dark:bg-slate-900/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                                        {/* 👈 좌측 컬럼: 기준 기간 (이번 기간) */}
                                        <div className="flex flex-col gap-2 border-r border-gray-200/80 dark:border-slate-700/80 pr-3">
                                            <div className="flex items-center justify-between pb-1 border-b border-gray-200/60 dark:border-slate-700/60">
                                                <span className="font-extrabold text-blue-600 dark:text-blue-400 text-[11px]">
                                                    기준 기간 실적
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    {uComp.periodA.periodDays}일간
                                                </span>
                                            </div>

                                            {/* 실매출 */}
                                            <div className="flex flex-col">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] text-gray-400 font-bold">실매출</span>
                                                    <DiffBadge diff={uComp.revenuePct} unit="%" />
                                                </div>
                                                <span className="font-black text-sm text-gray-900 dark:text-slate-100 font-mono">
                                                    ₩{uComp.periodA.totalRevenue.toLocaleString()}
                                                </span>
                                            </div>

                                            {/* 가동률 */}
                                            <div className="flex flex-col">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] text-gray-400 font-bold">가동률</span>
                                                    <DiffBadge diff={uComp.occupancyDiff} unit="%p" />
                                                </div>
                                                <span className="font-black text-sm text-blue-600 dark:text-blue-400 font-mono">
                                                    {uComp.periodA.occupancyRate}%
                                                </span>
                                            </div>

                                            {/* 객단가 ADR */}
                                            <div className="flex flex-col">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] text-gray-400 font-bold">객단가 ADR</span>
                                                    <DiffBadge diff={uComp.adrPct} unit="%" />
                                                </div>
                                                <span className="font-extrabold text-xs text-purple-700 dark:text-purple-300 font-mono">
                                                    ₩{uComp.periodA.adr.toLocaleString()}
                                                </span>
                                            </div>

                                            {/* 리드타임 & 박수 */}
                                            <div className="grid grid-cols-2 gap-1 pt-1 border-t border-gray-200/50 dark:border-slate-700/50 font-mono text-[11px]">
                                                <div>
                                                    <span className="text-[9.5px] text-gray-400 block font-bold">리드타임</span>
                                                    <span className="font-bold text-gray-800 dark:text-slate-200">
                                                        {uComp.periodA.avgLeadDays === 0 ? '당일' : `${uComp.periodA.avgLeadDays}일`}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[9.5px] text-gray-400 block font-bold">평균박수</span>
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                        {uComp.periodA.avgStayNights}박
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 투숙 박수 및 건수 */}
                                            <div className="text-[10.5px] text-gray-500 font-mono">
                                                총 {uComp.periodA.totalNights}박 투숙 ({uComp.periodA.totalBookings}건)
                                            </div>
                                        </div>

                                        {/* 👉 우측 컬럼: 비교 기간 실적 */}
                                        <div className="flex flex-col gap-2 pl-1">
                                            <div className="flex items-center justify-between pb-1 border-b border-gray-200/60 dark:border-slate-700/60">
                                                <span className="font-extrabold text-gray-500 dark:text-slate-400 text-[11px]">
                                                    {comparisonMode === 'yoy' ? '전년 동기 실적' : '직전 기간 실적'}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    {uComp.periodB.periodDays}일간
                                                </span>
                                            </div>

                                            {/* 실매출 */}
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 font-bold">실매출</span>
                                                <span className="font-bold text-sm text-gray-600 dark:text-slate-300 font-mono">
                                                    ₩{uComp.periodB.totalRevenue.toLocaleString()}
                                                </span>
                                            </div>

                                            {/* 가동률 */}
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 font-bold">가동률</span>
                                                <span className="font-bold text-sm text-gray-600 dark:text-slate-300 font-mono">
                                                    {uComp.periodB.occupancyRate}%
                                                </span>
                                            </div>

                                            {/* 객단가 ADR */}
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 font-bold">객단가 ADR</span>
                                                <span className="font-bold text-xs text-gray-600 dark:text-slate-300 font-mono">
                                                    ₩{uComp.periodB.adr.toLocaleString()}
                                                </span>
                                            </div>

                                            {/* 리드타임 & 박수 */}
                                            <div className="grid grid-cols-2 gap-1 pt-1 border-t border-gray-200/50 dark:border-slate-700/50 font-mono text-[11px]">
                                                <div>
                                                    <span className="text-[9.5px] text-gray-400 block font-bold">리드타임</span>
                                                    <span className="text-gray-500 dark:text-slate-400">
                                                        {uComp.periodB.avgLeadDays === 0 ? '당일' : `${uComp.periodB.avgLeadDays}일`}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[9.5px] text-gray-400 block font-bold">평균박수</span>
                                                    <span className="text-gray-500 dark:text-slate-400">
                                                        {uComp.periodB.avgStayNights}박
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 투숙 박수 및 건수 */}
                                            <div className="text-[10.5px] text-gray-400 font-mono">
                                                총 {uComp.periodB.totalNights}박 투숙 ({uComp.periodB.totalBookings}건)
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 📊 MODE B: 지표별 비교 차트 뷰 (막대 그래프) */}
            {viewMode === 'chart' && (
                <div className="flex flex-col gap-4">
                    {/* 1. 지표 선택 서브탭 ([실매출] [가동률] [객단가 ADR] [리드타임] [평균 박수]) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-gray-400 mr-1">비교 지표:</span>
                            {(
                                [
                                    { key: 'revenue', label: '💰 실매출' },
                                    { key: 'occupancy', label: '📈 가동률' },
                                    { key: 'adr', label: '🏷️ 객단가 ADR' },
                                    { key: 'leadTime', label: '⏱️ 리드타임' },
                                    { key: 'stayNights', label: '🌙 평균 박수' },
                                ] as const
                            ).map((m) => (
                                <button
                                    key={m.key}
                                    type="button"
                                    onClick={() => handleSelectChartMetric(m.key)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer select-none ${
                                        chartMetric === m.key
                                            ? 'bg-blue-600 text-white font-black shadow-xs'
                                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        {/* 범례 및 정렬 방향 토글 */}
                        <div className="flex items-center gap-4 text-xs font-mono">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-sm bg-blue-600 shrink-0" />
                                    <span className="font-bold text-gray-900 dark:text-slate-100">기준 기간</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-sm bg-slate-400 dark:bg-slate-600 shrink-0" />
                                    <span className="font-bold text-gray-500 dark:text-slate-400">
                                        {comparisonMode === 'yoy' ? '전년 동기' : '직전 기간'}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                                className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1"
                                title="정렬 순서 변경"
                            >
                                <span>{sortDirection === 'desc' ? '높은순 ▼' : '낮은순 ▲'}</span>
                            </button>
                        </div>
                    </div>

                    {/* 2. 마스터 필터 연동 안내 바 */}
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-850 rounded-xl border border-gray-100 dark:border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                            <span className="font-bold text-gray-700 dark:text-slate-300">
                                {selectedUnitKey !== 'all'
                                    ? `선택 호실 단독 비교 (${chartRooms[0]?.roomName || selectedUnitKey})`
                                    : selectedProperty !== 'all'
                                    ? `${PROPERTY_LABEL[selectedProperty]?.label || selectedProperty} 지점 ${chartRooms.length}개 호실 비교`
                                    : `전체 ${chartRooms.length}개 호실 비교`}
                            </span>
                        </div>
                        <span className="text-[11px] text-gray-400">
                            상단 마스터바(지점/호실)와 100% 연동됩니다
                        </span>
                    </div>

                    {/* 3. A vs B 나란히 막대 차트 (SVG 기반 반응형 시각화) */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs flex flex-col gap-3 overflow-x-auto">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800 text-xs">
                            <span className="font-black text-gray-900 dark:text-slate-100">
                                📊 호실별 {metricConfig.label} A vs B 비교 차트
                            </span>
                            <span className="text-gray-400 font-mono">
                                단위: {metricConfig.unit}
                            </span>
                        </div>

                        {chartRooms.length === 0 ? (
                            <div className="text-center py-16 text-xs text-gray-400">
                                조건에 일치하는 호실이 없습니다. 상단 마스터바 필터를 확인해주세요.
                            </div>
                        ) : (
                            <div className="min-w-[680px] pt-4 pb-2">
                                {/* 막대 차트 그리드 */}
                                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${chartRooms.length}, minmax(72px, 1fr))` }}>
                                    {chartRooms.map((r) => {
                                        const uComp = r.comparison;
                                        const valA =
                                            chartMetric === 'revenue'
                                                ? uComp.periodA.totalRevenue
                                                : chartMetric === 'occupancy'
                                                ? uComp.periodA.occupancyRate
                                                : chartMetric === 'adr'
                                                ? uComp.periodA.adr
                                                : chartMetric === 'leadTime'
                                                ? uComp.periodA.avgLeadDays
                                                : uComp.periodA.avgStayNights;

                                        const valB =
                                            chartMetric === 'revenue'
                                                ? uComp.periodB.totalRevenue
                                                : chartMetric === 'occupancy'
                                                ? uComp.periodB.occupancyRate
                                                : chartMetric === 'adr'
                                                ? uComp.periodB.adr
                                                : chartMetric === 'leadTime'
                                                ? uComp.periodB.avgLeadDays
                                                : uComp.periodB.avgStayNights;

                                        const diff =
                                            chartMetric === 'revenue'
                                                ? uComp.revenuePct
                                                : chartMetric === 'occupancy'
                                                ? uComp.occupancyDiff
                                                : chartMetric === 'adr'
                                                ? uComp.adrPct
                                                : chartMetric === 'leadTime'
                                                ? uComp.leadDaysDiff
                                                : uComp.stayNightsDiff;

                                        const diffUnit =
                                            chartMetric === 'revenue' || chartMetric === 'adr'
                                                ? '%'
                                                : chartMetric === 'occupancy'
                                                ? '%p'
                                                : chartMetric === 'leadTime'
                                                ? '일'
                                                : '박';

                                        const heightA = Math.max(8, Math.min(180, Math.round((valA / metricConfig.maxVal) * 180)));
                                        const heightB = Math.max(8, Math.min(180, Math.round((valB / metricConfig.maxVal) * 180)));

                                        return (
                                            <div key={r.unitKey} className="flex flex-col items-center gap-2 group">
                                                {/* 상단 증감 뱃지 */}
                                                <div className="h-6 flex items-center justify-center">
                                                    <DiffBadge diff={diff} unit={diffUnit} />
                                                </div>

                                                {/* 나란히 2개 막대 (A vs B) 컨테이너 */}
                                                <div className="h-[180px] w-full flex items-end justify-center gap-1.5 px-1 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-gray-100 dark:border-slate-800/60 pb-1">
                                                    {/* 🔵 막대 A: 기준 기간 */}
                                                    <div className="flex flex-col items-center flex-1 max-w-[28px]">
                                                        <span className="text-[10px] font-black font-mono text-blue-600 dark:text-blue-400 mb-1 whitespace-nowrap">
                                                            {metricConfig.formatShort(valA)}
                                                        </span>
                                                        <div
                                                            className="w-full bg-blue-600 hover:bg-blue-500 rounded-t-md transition-all duration-300 shadow-xs cursor-pointer"
                                                            style={{ height: `${heightA}px` }}
                                                            title={`기준 기간: ${metricConfig.formatFull(valA)}`}
                                                        />
                                                    </div>

                                                    {/* ⚪ 막대 B: 직전 기간 */}
                                                    <div className="flex flex-col items-center flex-1 max-w-[28px]">
                                                        <span className="text-[9.5px] font-bold font-mono text-gray-400 dark:text-slate-500 mb-1 whitespace-nowrap">
                                                            {metricConfig.formatShort(valB)}
                                                        </span>
                                                        <div
                                                            className="w-full bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 rounded-t-md transition-all duration-300 cursor-pointer"
                                                            style={{ height: `${heightB}px` }}
                                                            title={`직전 기간: ${metricConfig.formatFull(valB)}`}
                                                        />
                                                    </div>
                                                </div>

                                                {/* X축: 호실 라벨 */}
                                                <div className="flex flex-col items-center text-center mt-1">
                                                    <span className="font-extrabold text-xs text-gray-900 dark:text-slate-100 group-hover:text-blue-600 transition truncate max-w-[70px]">
                                                        {r.roomName}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
