'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import { PROPERTY_GROUPS, ALL_UNITS } from '../../config';
import {
    calculateRoomStats,
    calculatePropertyStats,
    calculateOverallSummary,
    RoomStats,
    PropertyStats,
    OverallSummary,
} from '../../utils/analyticsCalculations';
import { calculateNetPayout, getUnitForBooking, isValidBooking } from '../../utils/bookingUtils';
import DateRangeToolbar from './DateRangeToolbar';
import RoomRevenueTable from './RoomRevenueTable';

interface PricingRoomsTabProps {
    bookings: Booking[];
}

type MetricType = 'revenue' | 'occupancy' | 'adr';

// 4개 건물 고유 브랜드 컬러 팔레트
const PROPERTY_COLORS: Record<string, { label: string; color: string }> = {
    YEONNAM: { label: '연남', color: '#2563EB' }, // Blue
    WAVE: { label: '웨이브', color: '#EA580C' },   // Orange
    Green: { label: '그린', color: '#059669' },    // Emerald
    Namsun: { label: '남선', color: '#7C3AED' },   // Purple
};

export default function PricingRoomsTab({ bookings }: PricingRoomsTabProps) {
    // 1. 날짜 범위 상태 (기본값: 이번 달 1일 ~ 말일)
    const { defaultStart, defaultEnd } = useMemo(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const first = new Date(y, m, 1).toISOString().split('T')[0];
        const last = new Date(y, m + 1, 0).toISOString().split('T')[0];
        return { defaultStart: first, defaultEnd: last };
    }, []);

    const [startDate, setStartDate] = useState<string>(defaultStart);
    const [endDate, setEndDate] = useState<string>(defaultEnd);
    const [timeUnit, setTimeUnit] = useState<'day' | 'week' | 'month'>('week');
    const [selectedProperty, setSelectedProperty] = useState<string>('all');

    // 2. 그래프 선택 지표 (매출, 가동률, ADR)
    const [activeMetric, setActiveMetric] = useState<MetricType>('revenue');

    // 3. 하단 세부사항 서브 토글 (가격·공실 매트릭스 vs 호실별 상세 실적)
    const [detailViewMode, setDetailViewMode] = useState<'matrix' | 'table'>('matrix');

    // 4. 그래프 호버 상태 (구글 트렌드식 인터랙션)
    const [hoveredBucketIdx, setHoveredBucketIdx] = useState<number | null>(null);

    const handleChangeRange = (newStart: string, newEnd: string) => {
        setStartDate(newStart);
        setEndDate(newEnd);
    };

    // 5. 전체 집계 요약 (3대 KPI 카드용)
    const summary: OverallSummary = useMemo(() => {
        return calculateOverallSummary(bookings, 'custom', startDate, endDate, 'stay');
    }, [bookings, startDate, endDate]);

    // 6. 사업장별 성과 요약 (수수료 제외한 깔끔한 테이블용)
    const allPropertyStats: PropertyStats[] = useMemo(() => {
        return calculatePropertyStats(bookings, 'custom', startDate, endDate, 'stay');
    }, [bookings, startDate, endDate]);

    // 7. 호실별 가격 & 공실 매트릭스 데이터
    const allRoomStats: RoomStats[] = useMemo(() => {
        return calculateRoomStats(bookings, 'custom', startDate, endDate, 'stay');
    }, [bookings, startDate, endDate]);

    const filteredRoomStats = useMemo(() => {
        if (selectedProperty === 'all') return allRoomStats;
        return allRoomStats.filter((r) => r.propName === selectedProperty);
    }, [allRoomStats, selectedProperty]);

    // 8. 시계열 시간 버킷 생성 (그래프용)
    // - timeUnit === 'month': 기준 연도 1년(1월 ~ 12월 12개월) 연간 추이
    // - timeUnit === 'week': 기준일(endDate) 기준 최근 3개월(약 12~13주) 주별 추이
    // - timeUnit === 'day': 선택 기간(하루만 선택된 경우 해당 월 1일~말일) 일별 추이
    const timeBuckets = useMemo(() => {
        const buckets: { key: string; label: string; shortLabel: string; startDate: string; endDate: string }[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return buckets;

        if (timeUnit === 'month') {
            // 📅 월별: 기준 연도 1년 (1월 ~ 12월 12개월 보장)
            const targetYear = start.getFullYear();
            const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
            if (diffMonths >= 12) {
                const cur = new Date(start.getFullYear(), start.getMonth(), 1);
                while (cur <= end) {
                    const y = cur.getFullYear();
                    const m = cur.getMonth();
                    const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
                    const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
                    buckets.push({
                        key: firstDay,
                        label: `${y}년 ${m + 1}월`,
                        shortLabel: `${m + 1}월`,
                        startDate: firstDay,
                        endDate: lastDay,
                    });
                    cur.setMonth(cur.getMonth() + 1);
                }
            } else {
                for (let m = 0; m < 12; m++) {
                    const firstDay = new Date(targetYear, m, 1).toISOString().split('T')[0];
                    const lastDay = new Date(targetYear, m + 1, 0).toISOString().split('T')[0];
                    buckets.push({
                        key: firstDay,
                        label: `${targetYear}년 ${m + 1}월`,
                        shortLabel: `${m + 1}월`,
                        startDate: firstDay,
                        endDate: lastDay,
                    });
                }
            }
        } else if (timeUnit === 'week') {
            // 📅 주별: 기준일(endDate) 기준 최근 3개월 (12~13주, 약 84~91일)
            const targetEnd = new Date(end);
            const targetStart = new Date(targetEnd);
            targetStart.setDate(targetStart.getDate() - 84); // 12주 전
            const dayOfWeek = targetStart.getDay();
            const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            targetStart.setDate(targetStart.getDate() + diffToMon);

            const cur = new Date(targetStart);
            while (cur <= targetEnd) {
                const sStr = cur.toISOString().split('T')[0];
                const wEnd = new Date(cur);
                wEnd.setDate(wEnd.getDate() + 6);
                const eStr = wEnd.toISOString().split('T')[0];
                const m = cur.getMonth() + 1;
                const d = cur.getDate();
                buckets.push({
                    key: sStr,
                    label: `${m}월 ${d}일 주차 (${sStr} ~ ${eStr})`,
                    shortLabel: `${m}/${d}~`,
                    startDate: sStr,
                    endDate: eStr,
                });
                cur.setDate(cur.getDate() + 7);
            }
        } else {
            // 📅 일별: startDate ~ endDate (하루만 선택된 경우 해당 월 전체로 일별 그래프 보장)
            let sDate = new Date(start);
            let eDate = new Date(end);

            if (startDate === endDate) {
                sDate = new Date(start.getFullYear(), start.getMonth(), 1);
                eDate = new Date(start.getFullYear(), start.getMonth() + 1, 0);
            }

            const cur = new Date(sDate);
            let count = 0;
            while (cur <= eDate && count < 62) {
                const sStr = cur.toISOString().split('T')[0];
                const m = cur.getMonth() + 1;
                const d = cur.getDate();
                buckets.push({
                    key: sStr,
                    label: `${cur.getFullYear()}년 ${m}월 ${d}일`,
                    shortLabel: `${m}/${d}`,
                    startDate: sStr,
                    endDate: sStr,
                });
                cur.setDate(cur.getDate() + 1);
                count++;
            }
        }
        return buckets;
    }, [startDate, endDate, timeUnit]);

    // 9. 그래프 비교 라인 정의: '전체'면 4개 건물, 특정 지점이면 그 지점의 호실들
    const compareTargets = useMemo(() => {
        if (selectedProperty === 'all') {
            return Object.entries(PROPERTY_COLORS).map(([propKey, info]) => ({
                id: propKey,
                label: info.label,
                color: info.color,
                type: 'property' as const,
            }));
        } else {
            const group = PROPERTY_GROUPS.find((g) => g.name === selectedProperty);
            if (!group) return [];
            return group.units.map((u, idx) => ({
                id: u.key,
                label: u.displayName,
                color: ['#2563EB', '#DC2626', '#D97706', '#059669', '#7C3AED', '#DB2777'][idx % 6],
                type: 'unit' as const,
                unit: u,
            }));
        }
    }, [selectedProperty]);

    // 10. 버킷별 지표 계산
    const validBookings = useMemo(() => bookings.filter(isValidBooking), [bookings]);

    const chartData = useMemo(() => {
        return timeBuckets.map((bucket) => {
            const bStart = bucket.startDate;
            const bEnd = bucket.endDate;

            const targetValues: Record<string, { revenue: number; occupancy: number; adr: number }> = {};

            compareTargets.forEach((target) => {
                let matchedBookings: Booking[] = [];
                let totalUnitsCount = 1;

                if (target.type === 'property') {
                    const group = PROPERTY_GROUPS.find((g) => g.name === target.id);
                    totalUnitsCount = group ? group.units.length : 1;
                    matchedBookings = validBookings.filter((b) => {
                        const bUnit = getUnitForBooking(b);
                        if (!bUnit) return false;
                        return bUnit.propName === target.id && b.departure >= bStart && b.departure <= bEnd;
                    });
                } else {
                    totalUnitsCount = 1;
                    matchedBookings = validBookings.filter((b) => {
                        const bUnit = getUnitForBooking(b);
                        if (!bUnit) return false;
                        return bUnit.key === target.id && b.departure >= bStart && b.departure <= bEnd;
                    });
                }

                let rev = 0;
                let nights = 0;
                matchedBookings.forEach((b) => {
                    const payout = calculateNetPayout(Number(b.price) || 0, b.apiSourceId);
                    rev += payout;
                    const arr = new Date(b.arrival);
                    const dep = new Date(b.departure);
                    const n = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
                    nights += n;
                });

                const adr = nights > 0 ? Math.round(rev / nights) : 0;

                const sD = new Date(bStart);
                const eD = new Date(bEnd);
                const bucketDays = Math.max(1, Math.round((eD.getTime() - sD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                const totalPossibleNights = totalUnitsCount * bucketDays;
                const occ = totalPossibleNights > 0 ? Math.min(100, Math.round((nights / totalPossibleNights) * 1000) / 10) : 0;

                targetValues[target.id] = {
                    revenue: rev,
                    occupancy: occ,
                    adr,
                };
            });

            return {
                bucket,
                targetValues,
            };
        });
    }, [timeBuckets, compareTargets, validBookings]);

    // 전체 기간 평균/합계 (유휴 상태 표시용 - 상단 조회 기간 실제 매출과 100% 일치)
    const overallTargetStats = useMemo(() => {
        return compareTargets.map((target) => {
            if (target.type === 'property') {
                const propStat = allPropertyStats.find((p) => p.propName === target.id);
                return {
                    target,
                    totalRev: propStat ? propStat.totalRevenue : 0,
                    avgOcc: propStat ? propStat.occupancyRate : 0,
                    avgAdr: propStat ? propStat.adr : 0,
                };
            } else {
                const roomStat = allRoomStats.find((r) => r.unitKey === target.id);
                return {
                    target,
                    totalRev: roomStat ? roomStat.totalRevenue : 0,
                    avgOcc: roomStat ? roomStat.occupancyRate : 0,
                    avgAdr: roomStat ? roomStat.adr : 0,
                };
            }
        });
    }, [compareTargets, allPropertyStats, allRoomStats]);

    // 현재 활성화된 메트릭의 최댓값
    const maxVal = useMemo(() => {
        let m = 0;
        chartData.forEach((row) => {
            compareTargets.forEach((t) => {
                const v = row.targetValues[t.id]?.[activeMetric] || 0;
                if (v > m) m = v;
            });
        });
        if (activeMetric === 'occupancy') return 100;
        return m > 0 ? Math.ceil(m * 1.15) : (activeMetric === 'adr' ? 300000 : 10000000);
    }, [chartData, compareTargets, activeMetric]);

    // 차트 레이아웃 크기 및 축 좌표 계산
    const numBuckets = chartData.length;
    const minColWidth = timeUnit === 'day' ? 36 : timeUnit === 'week' ? 56 : 72;
    const chartW = Math.max(760, numBuckets * minColWidth);
    const chartH = 220;
    const padL = 80;
    const padR = 25;
    const padT = 20;
    const padB = 35;
    const plotW = chartW - padL - padR;
    const plotH = chartH - padT - padB;
    const slotW = numBuckets > 0 ? plotW / numBuckets : plotW;

    const getX = (idx: number) => {
        if (numBuckets <= 1) return padL + plotW / 2;
        return padL + (idx + 0.5) * slotW;
    };

    const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const svgEl = e.currentTarget;
        const rect = svgEl.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const svgX = (clientX / rect.width) * chartW;

        if (svgX < padL || svgX > chartW - padR) {
            setHoveredBucketIdx(null);
            return;
        }

        const idx = Math.floor((svgX - padL) / slotW);
        if (idx >= 0 && idx < numBuckets) {
            setHoveredBucketIdx(idx);
        }
    };

    const handleSvgMouseLeave = () => {
        setHoveredBucketIdx(null);
    };

    const hoveredRow = hoveredBucketIdx !== null ? chartData[hoveredBucketIdx] : null;

    // 수치 포맷팅 헬퍼
    const formatMetricValue = (val: number, metric: MetricType) => {
        if (metric === 'occupancy') return `${val}%`;
        return `₩${val.toLocaleString()}`;
    };

    return (
        <div className="flex flex-col gap-3.5">
            {/* 1. 상단 툴바 (◀ 이전 / 다음 ▶ 및 지점 필터) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                <DateRangeToolbar
                    startDate={startDate}
                    endDate={endDate}
                    onChangeRange={handleChangeRange}
                    title="조회 기간"
                />

                {/* 지점 선택 필터 */}
                <div className="flex items-center gap-1.5 self-start md:self-auto bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400 ml-1">지점:</span>
                    <button
                        type="button"
                        onClick={() => setSelectedProperty('all')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            selectedProperty === 'all'
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        전체 사업장 (4개 지점)
                    </button>
                    {PROPERTY_GROUPS.map((g) => {
                        const propLabel = g.name === 'Namsun' ? '남선' : g.name === 'YEONNAM' ? '연남' : g.name === 'WAVE' ? '웨이브' : '그린';
                        return (
                            <button
                                key={g.name}
                                type="button"
                                onClick={() => setSelectedProperty(g.name)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    selectedProperty === g.name
                                        ? 'bg-blue-600 text-white shadow-2xs'
                                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                {propLabel}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. 3대 핵심 KPI 카드 (매출, 가동률, ADR) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">매출</span>
                    <span className="text-xl md:text-3xl font-extrabold text-gray-900 dark:text-slate-100 font-mono">
                        ₩{summary.totalRevenue.toLocaleString()}
                    </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">가동률</span>
                    <span className="text-xl md:text-3xl font-extrabold text-blue-700 dark:text-blue-400 font-mono">
                        {summary.occupancyRate}%
                    </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">ADR</span>
                    <span className="text-xl md:text-3xl font-extrabold text-purple-700 dark:text-purple-400 font-mono">
                        ₩{summary.adr.toLocaleString()}
                    </span>
                </div>
            </div>

            {/* 3. 성과 추이 선 그래프 (Google Trends 스타일) */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col gap-3">
                {/* 상단 컨트롤: [매출 / 가동률 / ADR] 알약 버튼 & 단위(일/주/월) */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
                        {(
                            [
                                { key: 'revenue', label: '매출' },
                                { key: 'occupancy', label: '가동률' },
                                { key: 'adr', label: 'ADR' },
                            ] as const
                        ).map((m) => (
                            <button
                                key={m.key}
                                type="button"
                                onClick={() => setActiveMetric(m.key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    activeMetric === m.key
                                        ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-2xs font-extrabold'
                                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setTimeUnit('day')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                timeUnit === 'day' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400'
                            }`}
                        >
                            일별
                        </button>
                        <button
                            type="button"
                            onClick={() => setTimeUnit('week')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                timeUnit === 'week' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400'
                            }`}
                        >
                            주별 (3개월)
                        </button>
                        <button
                            type="button"
                            onClick={() => setTimeUnit('month')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                timeUnit === 'month' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400'
                            }`}
                        >
                            월별 (1년)
                        </button>
                    </div>
                </div>

                {/* 라이브 데이터 표시 바 (마우스 올렸을 때 실시간 수치 / 유휴 시 평균 수치) */}
                <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 min-h-[42px]">
                    {hoveredRow ? (
                        <>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 font-extrabold text-xs font-mono border border-blue-200 dark:border-blue-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                                {hoveredRow.bucket.label}
                            </span>
                            <div className="flex flex-wrap items-center gap-3">
                                {compareTargets.map((target) => {
                                    const val = hoveredRow.targetValues[target.id]?.[activeMetric] || 0;
                                    return (
                                        <div key={target.id} className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs">
                                            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: target.color }} />
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{target.label}:</span>
                                            <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100">
                                                {formatMetricValue(val, activeMetric)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                선택 기간 매출:
                            </span>
                            <div className="flex flex-wrap items-center gap-2.5">
                                {overallTargetStats.map(({ target, totalRev, avgOcc, avgAdr }) => {
                                    const val =
                                        activeMetric === 'revenue'
                                            ? totalRev
                                            : activeMetric === 'occupancy'
                                            ? avgOcc
                                            : avgAdr;
                                    return (
                                        <div key={target.id} className="flex items-center gap-1.5 text-xs bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700">
                                            <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: target.color }} />
                                            <span className="text-slate-500 dark:text-slate-400 font-medium">{target.label}:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                {formatMetricValue(val, activeMetric)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* SVG 그래프: 평소엔 점 없이 선만 매끄럽게 흐르고, 호버 시에만 수직선 + 강조점 */}
                <div className="w-full overflow-x-auto pb-1 relative">
                    <svg
                        width={chartW}
                        height={chartH}
                        viewBox={`0 0 ${chartW} ${chartH}`}
                        className="select-none cursor-pointer"
                        onMouseMove={handleSvgMouseMove}
                        onMouseLeave={handleSvgMouseLeave}
                    >
                        {/* 그리드 가로선 4줄 및 Y축 레이블 */}
                        {[0, 0.33, 0.66, 1].map((ratio) => {
                            const y = padT + plotH * (1 - ratio);
                            const val = Math.round(maxVal * ratio);
                            return (
                                <g key={ratio}>
                                    <line
                                        x1={padL}
                                        y1={y}
                                        x2={chartW - padR}
                                        y2={y}
                                        stroke="currentColor"
                                        className="text-slate-200 dark:text-slate-800"
                                        strokeWidth="1"
                                        strokeDasharray={ratio === 0 ? undefined : '3 3'}
                                    />
                                    <text
                                        x={padL - 10}
                                        y={y + 4}
                                        textAnchor="end"
                                        className="text-[11px] fill-slate-700 dark:fill-slate-300 font-bold font-mono"
                                    >
                                        {activeMetric === 'occupancy'
                                            ? `${val}%`
                                            : `₩${(val / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만`}
                                    </text>
                                </g>
                            );
                        })}

                        {/* 구글 트렌드 인터랙션: 마우스 호버 시 수직 기준선 */}
                        {hoveredBucketIdx !== null && (
                            <line
                                x1={getX(hoveredBucketIdx)}
                                y1={padT}
                                x2={getX(hoveredBucketIdx)}
                                y2={chartH - padB}
                                stroke="#64748B"
                                strokeWidth="1.5"
                                strokeDasharray="4 3"
                            />
                        )}

                        {/* X축 라벨 */}
                        {chartData.map((row, idx) => {
                            const isVisible = idx === 0 || idx === numBuckets - 1 || idx % 2 === 0;
                            if (!isVisible) return null;
                            const x = getX(idx);
                            const isHovered = hoveredBucketIdx === idx;
                            return (
                                <g key={row.bucket.key}>
                                    <text
                                        x={x}
                                        y={chartH - 10}
                                        textAnchor="middle"
                                        className={`text-[11px] font-mono transition-colors ${
                                            isHovered ? 'fill-blue-600 dark:fill-blue-400 font-extrabold text-[12px]' : 'fill-slate-600 dark:fill-slate-400 font-bold'
                                        }`}
                                    >
                                        {row.bucket.shortLabel}
                                    </text>
                                </g>
                            );
                        })}

                        {/* 4개 지점/호실 꺾은선 (Polyline) 및 포인트 */}
                        {compareTargets.map((target) => {
                            const points = chartData.map((row, idx) => {
                                const x = getX(idx);
                                const val = row.targetValues[target.id]?.[activeMetric] || 0;
                                const ratio = maxVal > 0 ? val / maxVal : 0;
                                const y = padT + plotH * (1 - Math.min(1, ratio));
                                return `${x},${y}`;
                            }).join(' ');

                            return (
                                <g key={target.id}>
                                    {chartData.length > 1 && (
                                        <polyline
                                            fill="none"
                                            stroke={target.color}
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            points={points}
                                            className="transition-all duration-300"
                                        />
                                    )}

                                    {/* 데이터 포인트가 1개뿐일 때 기본 점 표시, 혹은 호버 시 강조 점 */}
                                    {chartData.map((row, idx) => {
                                        const x = getX(idx);
                                        const val = row.targetValues[target.id]?.[activeMetric] || 0;
                                        const ratio = maxVal > 0 ? val / maxVal : 0;
                                        const y = padT + plotH * (1 - Math.min(1, ratio));
                                        const isHovered = hoveredBucketIdx === idx;

                                        if (chartData.length === 1 || isHovered) {
                                            return (
                                                <circle
                                                    key={idx}
                                                    cx={x}
                                                    cy={y}
                                                    r={isHovered ? 6 : 5}
                                                    fill={target.color}
                                                    stroke="#ffffff"
                                                    strokeWidth={isHovered ? 2.5 : 1.5}
                                                    className="animate-scaleUp shadow-md"
                                                />
                                            );
                                        }
                                        return null;
                                    })}
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>

            {/* 4. 사업장별 성과 요약 테이블 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-3.5 md:p-4 shadow-xs flex flex-col gap-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        사업장별 성과 요약
                    </span>
                    <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                        총 {allPropertyStats.length}개 사업장
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-300 font-bold border-b border-gray-200 dark:border-slate-700">
                                <th className="py-2 px-3">사업장</th>
                                <th className="py-2 px-3 text-right">매출</th>
                                <th className="py-2 px-3 text-center">가동률</th>
                                <th className="py-2 px-3 text-right">ADR</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {allPropertyStats.map((prop) => {
                                const propNameKOR = prop.propName === 'Namsun' ? '남선' : prop.propName === 'YEONNAM' ? '연남' : prop.propName === 'WAVE' ? '웨이브' : '그린';
                                const colorInfo = PROPERTY_COLORS[prop.propName] || { color: '#2563EB' };

                                return (
                                    <tr key={prop.propName} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition">
                                        <td className="py-2.5 px-3 font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorInfo.color }} />
                                            <span>{propNameKOR}</span>
                                            <span className="text-[11px] text-gray-400 dark:text-slate-500 font-normal">({prop.roomCount}개 호실)</span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-extrabold text-gray-900 dark:text-slate-100 font-mono">
                                            ₩{prop.totalRevenue.toLocaleString()}
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                            <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                {prop.occupancyRate}%
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-extrabold text-purple-700 dark:text-purple-400 font-mono">
                                            ₩{prop.adr.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 5. 세부사항 영역: [호실별 가격 & 공실 매트릭스] vs [호실별 상세 실적 테이블] */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col overflow-hidden">
                <div className="p-3 md:p-4 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-gray-50/60 dark:bg-slate-800/60">
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setDetailViewMode('matrix')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                detailViewMode === 'matrix'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                        >
                            호실별 가격 & 공실 매트릭스
                        </button>
                        <button
                            type="button"
                            onClick={() => setDetailViewMode('table')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                detailViewMode === 'table'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                        >
                            호실별 상세 정산 테이블
                        </button>
                    </div>

                    <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                        총 {filteredRoomStats.length}개 객실
                    </span>
                </div>

                {detailViewMode === 'matrix' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-300 font-bold border-b border-gray-200 dark:border-slate-700">
                                    <th className="py-2.5 px-3">사업장</th>
                                    <th className="py-2.5 px-3">호실</th>
                                    <th className="py-2.5 px-3 text-center">가동률</th>
                                    <th className="py-2.5 px-3 text-center">공실 / 투숙</th>
                                    <th className="py-2.5 px-3 text-right">평균 단가(ADR)</th>
                                    <th className="py-2.5 px-3 text-right text-purple-700 dark:text-purple-400">주말 단가</th>
                                    <th className="py-2.5 px-3 text-right text-blue-700 dark:text-blue-400">평일 단가</th>
                                    <th className="py-2.5 px-3 text-right">총매출</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                {filteredRoomStats.map((r) => {
                                    const weekendAdr = r.dayTypeAdr?.weekendAdr || 0;
                                    const weekdayAdr = r.dayTypeAdr?.weekdayAdr || 0;
                                    const propKOR = r.propName === 'Namsun' ? '남선' : r.propName === 'YEONNAM' ? '연남' : r.propName === 'WAVE' ? '웨이브' : r.propName;

                                    return (
                                        <tr key={r.unitKey} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition">
                                            <td className="py-2.5 px-3 font-bold text-gray-700 dark:text-slate-300">{propKOR}</td>
                                            <td className="py-2.5 px-3 font-extrabold text-gray-900 dark:text-slate-100">{r.roomName}</td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                    {r.occupancyRate}%
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className={r.vacantNights > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-400 dark:text-slate-500'}>
                                                    {r.vacantNights}박 공실
                                                </span>
                                                <span className="text-gray-300 dark:text-slate-600 mx-1">/</span>
                                                <span className="text-gray-900 dark:text-slate-100 font-bold">{r.totalNights}박 투숙</span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-extrabold text-gray-900 dark:text-slate-100 font-mono">
                                                ₩{r.adr.toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-bold text-purple-700 dark:text-purple-400 font-mono">
                                                {weekendAdr > 0 ? `₩${weekendAdr.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-bold text-blue-700 dark:text-blue-400 font-mono">
                                                {weekdayAdr > 0 ? `₩${weekdayAdr.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-extrabold text-gray-900 dark:text-slate-100 font-mono">
                                                ₩{r.totalRevenue.toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-3">
                        <RoomRevenueTable roomStats={filteredRoomStats} />
                    </div>
                )}
            </div>
        </div>
    );
}
