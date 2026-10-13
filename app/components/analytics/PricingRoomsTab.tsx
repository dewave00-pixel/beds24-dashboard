'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Booking } from '../../types';
import { PROPERTY_GROUPS, ALL_UNITS } from '../../config';
import {
    calculateRoomStats,
    calculatePropertyStats,
    calculateOverallSummary,
    formatLocalDate,
    RoomStats,
    PropertyStats,
    OverallSummary,
} from '../../utils/analyticsCalculations';
import { calculateNetPayout, getUnitForBooking, isValidBooking } from '../../utils/bookingUtils';
import DateRangeToolbar from './DateRangeToolbar';
import PeriodComparisonSection from './PeriodComparisonSection';
import RoomChannelMatrixSection from './RoomChannelMatrixSection';
import FutureOccupancyRadar from './FutureOccupancyRadar';
import ChannelRevenueSection from './ChannelRevenueSection';
import CountryRevenueSection from './CountryRevenueSection';
import LeadTimeStaySection from './LeadTimeStaySection';

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
        const first = formatLocalDate(new Date(y, m, 1));
        const last = formatLocalDate(new Date(y, m + 1, 0));
        return { defaultStart: first, defaultEnd: last };
    }, []);

    const [startDate, setStartDate] = useState<string>(defaultStart);
    const [endDate, setEndDate] = useState<string>(defaultEnd);
    const [timeUnit, setTimeUnit] = useState<'day' | 'week' | 'month'>('week');
    const [selectedProperty, setSelectedProperty] = useState<string>('all');
    const [selectedUnitKey, setSelectedUnitKey] = useState<string>('all');
    const [showTopBtn, setShowTopBtn] = useState<boolean>(false);

    // 스크롤 감지하여 일정 이상 내려가면 Top 플로팅 버튼 표시
    useEffect(() => {
        const handleScroll = () => {
            setShowTopBtn(window.scrollY > 300);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 🎛️ 커스텀 분석 뷰 위젯 설정 (사용자가 보고 싶은 모듈만 다중 체크, 순서대로 리스트 나열)
    type WidgetKey = 'trend' | 'comparison' | 'channels' | 'leadTime' | 'matrix' | 'radar' | 'country';
    const WIDGET_CONFIG: { key: WidgetKey; label: string; icon: string; desc: string }[] = [
        { key: 'trend', label: '총매출 & 추이', icon: '💰', desc: 'KPI 카드 + 시계열 차트' },
        { key: 'comparison', label: '기간 분석 (호실별 성과표)', icon: '⚖️', desc: '직전 기간 비교 + 호실별 실적 & 플랫폼' },
        { key: 'channels', label: '채널 & 플랫폼 점유율', icon: '🌐', desc: 'OTA 도넛 + 상세 정산 내역' },
        { key: 'leadTime', label: '리드타임 & 투숙기간', icon: '⏱️', desc: '예약 리드 일수 및 평균 투숙 박수(LOS) 분석' },
        { key: 'matrix', label: 'OTA 광고 분석', icon: '🎯', desc: '호실 x 채널 기여도 매트릭스' },
        { key: 'radar', label: '향후 가동률 레이더', icon: '📈', desc: '일자별 가동률 추세선 & 전일 대비 변동폭' },
        { key: 'country', label: '게스트 국적 분석', icon: '🌍', desc: '국가별 유입 비중' },
    ];

    // 기본 선택: 총매출&추이 + 양쪽 기간 비교 + 채널 점유율
    const [selectedWidgets, setSelectedWidgets] = useState<Set<WidgetKey>>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('analytics_custom_widgets');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        const migrated = parsed.map((k) => (k === 'table' ? 'comparison' : k)).filter((k) => k !== 'table') as WidgetKey[];
                        return new Set<WidgetKey>(migrated);
                    }
                }
            } catch {}
        }
        return new Set<WidgetKey>(['trend', 'comparison', 'channels']);
    });

    // 위젯 토글 (0개 선택 가능하도록 최소 제한 해제)
    const toggleWidget = (key: WidgetKey) => {
        setSelectedWidgets((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem('analytics_custom_widgets', JSON.stringify(Array.from(next)));
                } catch {}
            }
            return next;
        });
    };

    // 전체 선택
    const selectAllWidgets = () => {
        const allKeys = new Set<WidgetKey>(WIDGET_CONFIG.map((w) => w.key));
        setSelectedWidgets(allKeys);
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('analytics_custom_widgets', JSON.stringify(Array.from(allKeys)));
            } catch {}
        }
    };

    // 전체 해제 (0개 빈 화면)
    const clearAllWidgets = () => {
        const emptySet = new Set<WidgetKey>();
        setSelectedWidgets(emptySet);
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('analytics_custom_widgets', JSON.stringify([]));
            } catch {}
        }
    };

    // 기본 추천 세트 복원
    const resetDefaultWidgets = () => {
        const defaultKeys = new Set<WidgetKey>(['trend', 'comparison', 'channels']);
        setSelectedWidgets(defaultKeys);
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('analytics_custom_widgets', JSON.stringify(Array.from(defaultKeys)));
            } catch {}
        }
    };

    // 선택된 지점에 속하는 가용 호실(Unit) 목록
    const availableUnits = useMemo(() => {
        if (selectedProperty === 'all') return ALL_UNITS;
        return ALL_UNITS.filter((u) => u.propName === selectedProperty);
    }, [selectedProperty]);

    // 지점 변경 시 호실 선택 리셋 핸들러
    const handleSelectProperty = (propName: string) => {
        setSelectedProperty(propName);
        setSelectedUnitKey('all');
    };

    // 2. 그래프 선택 지표 (매출, 가동률, ADR)
    const [activeMetric, setActiveMetric] = useState<MetricType>('revenue');

    // 4. 그래프 호버 상태 (구글 트렌드식 인터랙션)
    const [hoveredBucketIdx, setHoveredBucketIdx] = useState<number | null>(null);

    const handleChangeRange = (newStart: string, newEnd: string) => {
        setStartDate(newStart);
        setEndDate(newEnd);
    };

    // 5. 전체 집계 요약 (3대 KPI 카드용 - 지점 및 호실 필터 완벽 반영)
    const summary: OverallSummary = useMemo(() => {
        return calculateOverallSummary(bookings, 'custom', startDate, endDate, 'stay', selectedProperty, selectedUnitKey);
    }, [bookings, startDate, endDate, selectedProperty, selectedUnitKey]);
    // 6. 사업장별 성과 통계 (추이 차트 지점 비교용)
    const allPropertyStats: PropertyStats[] = useMemo(() => {
        const stats = calculatePropertyStats(bookings, 'custom', startDate, endDate, 'stay');
        if (selectedProperty === 'all') return stats;
        return stats.filter((p) => p.propName === selectedProperty);
    }, [bookings, startDate, endDate, selectedProperty]);
    // 7. 호실별 가격 & 공실 매트릭스 데이터 (지점 및 호실 필터 반영)
    const allRoomStats: RoomStats[] = useMemo(() => {
        const stats = calculateRoomStats(bookings, 'custom', startDate, endDate, 'stay');
        let list = stats;
        if (selectedProperty !== 'all') {
            list = list.filter((r) => r.propName === selectedProperty);
        }
        if (selectedUnitKey !== 'all') {
            list = list.filter((r) => r.unitKey === selectedUnitKey);
        }
        return list;
    }, [bookings, startDate, endDate, selectedProperty, selectedUnitKey]);

    // 8. 🎯 상단 조회 기간과 100% 동기화되는 시계열 시간 버킷 생성
    const diffDays = useMemo(() => {
        const s = new Date(startDate);
        const e = new Date(endDate);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
        return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }, [startDate, endDate]);

    // 상단 조회 기간 변경 시, 기간 길이에 맞춰 최적의 시간 단위 자동 동기화
    useEffect(() => {
        if (diffDays <= 31) {
            setTimeUnit('day');
        } else if (diffDays <= 185) {
            setTimeUnit('week');
        } else {
            setTimeUnit('month');
        }
    }, [diffDays]);

    const timeBuckets = useMemo(() => {
        const buckets: { key: string; label: string; shortLabel: string; startDate: string; endDate: string }[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return buckets;

        if (timeUnit === 'month') {
            // 📅 월별: startDate ~ endDate 사이에 속한 월들만 정확히 생성 (3개월, 6개월, 1년 등)
            const cur = new Date(start.getFullYear(), start.getMonth(), 1);
            while (cur <= end) {
                const y = cur.getFullYear();
                const m = cur.getMonth();
                const firstDay = formatLocalDate(new Date(y, m, 1));
                const lastDay = formatLocalDate(new Date(y, m + 1, 0));
                buckets.push({
                    key: firstDay,
                    label: `${y}년 ${m + 1}월`,
                    shortLabel: `${m + 1}월`,
                    startDate: firstDay,
                    endDate: lastDay,
                });
                cur.setMonth(cur.getMonth() + 1);
            }
        } else if (timeUnit === 'week') {
            // 📅 주별: startDate ~ endDate 사이의 주차들만 정확히 생성 (시작 월요일 기준)
            const cur = new Date(start);
            const dayOfWeek = cur.getDay();
            const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            cur.setDate(cur.getDate() + diffToMon);

            while (cur <= end) {
                const sStr = formatLocalDate(cur);
                const wEnd = new Date(cur);
                wEnd.setDate(wEnd.getDate() + 6);
                const eStr = formatLocalDate(wEnd);
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
            // 📅 일별: startDate ~ endDate 사이의 날짜들만 정확히 생성
            // (만약 1일만 선택된 경우, 선 그래프 가시성을 위해 해당 주의 7일 또는 해당 월 1일~말일 표시)
            let sDate = new Date(start);
            let eDate = new Date(end);

            if (startDate === endDate) {
                // 단 1일 선택 시: 해당 일자가 포함된 주(월~일 7일)로 자연스러운 추세선 제공
                const dayOfWeek = sDate.getDay();
                const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                sDate.setDate(sDate.getDate() + diffToMon);
                eDate = new Date(sDate);
                eDate.setDate(eDate.getDate() + 6);
            }

            const cur = new Date(sDate);
            let count = 0;
            while (cur <= eDate && count < 62) {
                const sStr = formatLocalDate(cur);
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

    // 9. 그래프 비교 라인 정의:
    // - 특정 호실(selectedUnitKey !== 'all') 선택 시: 해당 호실 1개 단독 라인
    // - 특정 지점(selectedProperty !== 'all') 선택 시: 그 지점의 호실들
    // - 전체(all) 선택 시: 4개 건물 라인
    const compareTargets = useMemo(() => {
        if (selectedUnitKey !== 'all') {
            const u = ALL_UNITS.find((unit) => unit.key === selectedUnitKey);
            return [
                {
                    id: selectedUnitKey,
                    label: u ? `${u.displayName} (${u.propName})` : selectedUnitKey,
                    color: '#2563EB',
                    type: 'unit' as const,
                    unit: u,
                },
            ];
        } else if (selectedProperty === 'all') {
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
    }, [selectedProperty, selectedUnitKey]);

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
            {/* 1. 상단 통합 마스터 컨트롤 패널 (기간 + 지점/호실 타겟팅 일체형 카드 - 스크롤 시 상단 플로팅 고정) */}
            <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 md:p-3.5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                {/* 1행: 기간 제어 마스터 */}
                <DateRangeToolbar
                    startDate={startDate}
                    endDate={endDate}
                    onChangeRange={handleChangeRange}
                    title="조회 기간"
                    embedded={true}
                />

                {/* 구분선 */}
                <div className="h-px bg-gray-100 dark:bg-slate-800/80 w-full" />

                {/* 2행: 지점 및 호실 타겟팅 드롭다운 세트 */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-gray-500 dark:text-slate-400">분석 대상:</span>

                        {/* 지점(Property) 선택 드롭다운 */}
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800/80 p-1 px-3 rounded-xl border border-gray-200 dark:border-slate-700">
                            <span className="text-xs font-bold text-gray-500 dark:text-slate-400">🏢 지점:</span>
                            <select
                                value={selectedProperty}
                                onChange={(e) => handleSelectProperty(e.target.value)}
                                className="bg-transparent text-xs font-bold text-gray-900 dark:text-slate-100 cursor-pointer focus:outline-none"
                            >
                                <option value="all" className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
                                    전체 지점
                                </option>
                                {PROPERTY_GROUPS.map((g) => {
                                    const propLabel = g.name === 'Namsun' ? '남선' : g.name === 'YEONNAM' ? '연남' : g.name === 'WAVE' ? '웨이브' : '그린';
                                    return (
                                        <option
                                            key={g.name}
                                            value={g.name}
                                            className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                                        >
                                            {propLabel}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* 호실(Unit) 선택 드롭다운 */}
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800/80 p-1 px-3 rounded-xl border border-gray-200 dark:border-slate-700">
                            <span className="text-xs font-bold text-gray-500 dark:text-slate-400">🚪 호실:</span>
                            <select
                                value={selectedUnitKey}
                                onChange={(e) => {
                                    const newKey = e.target.value;
                                    setSelectedUnitKey(newKey);
                                    if (newKey !== 'all') {
                                        const matchedUnit = ALL_UNITS.find((u) => u.key === newKey);
                                        if (matchedUnit && matchedUnit.propName && selectedProperty === 'all') {
                                            setSelectedProperty(matchedUnit.propName);
                                        }
                                    }
                                }}
                                className="bg-transparent text-xs font-bold text-gray-900 dark:text-slate-100 cursor-pointer focus:outline-none"
                            >
                                <option value="all" className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
                                    {selectedProperty === 'all' ? '전체 호실 (일괄 분석)' : `${selectedProperty} 전체 호실`}
                                </option>
                                {availableUnits.map((u) => (
                                    <option
                                        key={u.key}
                                        value={u.key}
                                        className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                                    >
                                        {u.displayName} {u.subName ? `(${u.subName})` : ''} - {u.propName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 현재 분석 범위 뱃지 */}
                    <div className="text-xs font-bold">
                        {selectedUnitKey !== 'all' ? (
                            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                🎯 {ALL_UNITS.find((u) => u.key === selectedUnitKey)?.displayName || selectedUnitKey} 단독 분석 중
                            </span>
                        ) : selectedProperty !== 'all' ? (
                            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                🏢 {selectedProperty} 전체 호실 분석 중
                            </span>
                        ) : (
                            <span className="text-gray-400 dark:text-slate-500">
                                전체 4개 건물 통합 분석
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* 🎛️ 2. 커스텀 분석 뷰 위젯 선택 바 (보고 싶은 항목만 다중 체크, 0개 선택 가능) */}
            <div className="bg-white dark:bg-slate-900 p-2.5 px-3 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black text-gray-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                        <span>🎛️</span>
                        <span>표시할 분석 화면:</span>
                    </span>
                    {WIDGET_CONFIG.map((w) => {
                        const isSelected = selectedWidgets.has(w.key);
                        return (
                            <button
                                key={w.key}
                                type="button"
                                onClick={() => toggleWidget(w.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                    isSelected
                                        ? 'bg-blue-600 text-white shadow-2xs font-extrabold ring-2 ring-blue-500/20'
                                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 opacity-60 hover:opacity-100'
                                }`}
                                title={w.desc}
                            >
                                <span>{w.icon}</span>
                                <span>{w.label}</span>
                                <span className="text-[10px] font-mono opacity-80">
                                    {isSelected ? '✓' : '+'}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 dark:text-slate-500">
                    <span>선택됨: <strong className="text-blue-600 dark:text-blue-400">{selectedWidgets.size}</strong>/{WIDGET_CONFIG.length}</span>
                    <span className="text-gray-300 dark:text-slate-700">|</span>
                    <button
                        type="button"
                        onClick={selectAllWidgets}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                        전체 선택
                    </button>
                    <button
                        type="button"
                        onClick={clearAllWidgets}
                        className="text-xs text-gray-500 hover:text-red-500 dark:text-slate-400 hover:underline cursor-pointer"
                    >
                        모두 해제
                    </button>
                </div>
            </div>

            {/* 3. 선택된 위젯 렌더링 컨테이너 (100% 전체 너비 리스트 형식으로 시원하게 배치) */}
            <div className="flex flex-col gap-6 w-full">
                {/* 0개 선택 시: 친절한 안내 Empty State */}
                {selectedWidgets.size === 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-gray-300 dark:border-slate-800 p-12 text-center flex flex-col items-center justify-center gap-4 my-2 shadow-xs">
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-3xl">
                            📊
                        </div>
                        <div className="flex flex-col gap-1 max-w-md">
                            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                                선택된 분석 화면이 없습니다
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                                상단의 분석 화면 칩을 클릭하여 확인하고 싶은 통계 위젯을 자유롭게 켜고 끌 수 있습니다.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <button
                                type="button"
                                onClick={resetDefaultWidgets}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                            >
                                기본 분석 보기 (총매출 + 비교 + 채널)
                            </button>
                            <button
                                type="button"
                                onClick={selectAllWidgets}
                                className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 font-bold text-xs rounded-xl border border-gray-200 dark:border-slate-700 transition cursor-pointer"
                            >
                                전체 모듈 켜기
                            </button>
                        </div>
                    </div>
                )}

                {/* 1) 💰 총매출 & 추이 그래프 위젯 */}
                {selectedWidgets.has('trend') && (
                    <div className="flex flex-col gap-3.5">
                        {/* 3대 핵심 KPI 카드 (매출, 가동률, ADR) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                                        {selectedUnitKey !== 'all'
                                            ? `${ALL_UNITS.find((u) => u.key === selectedUnitKey)?.displayName || '호실'} 매출`
                                            : selectedProperty !== 'all'
                                            ? `${selectedProperty} 매출`
                                            : '총매출'}
                                    </span>
                                    {selectedUnitKey !== 'all' && (
                                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                                            호실 단독
                                        </span>
                                    )}
                                </div>
                                <span className="text-xl md:text-3xl font-extrabold text-gray-900 dark:text-slate-100 font-mono">
                                    ₩{summary.totalRevenue.toLocaleString()}
                                </span>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                                        {selectedUnitKey !== 'all'
                                            ? `${ALL_UNITS.find((u) => u.key === selectedUnitKey)?.displayName || '호실'} 가동률`
                                            : selectedProperty !== 'all'
                                            ? `${selectedProperty} 가동률`
                                            : '평균 가동률'}
                                    </span>
                                    {selectedUnitKey !== 'all' && (
                                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                                            호실 단독
                                        </span>
                                    )}
                                </div>
                                <span className="text-xl md:text-3xl font-extrabold text-blue-700 dark:text-blue-400 font-mono">
                                    {summary.occupancyRate}%
                                </span>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                                        {selectedUnitKey !== 'all'
                                            ? `${ALL_UNITS.find((u) => u.key === selectedUnitKey)?.displayName || '호실'} ADR`
                                            : selectedProperty !== 'all'
                                            ? `${selectedProperty} ADR`
                                            : '평균 객실 단가 (ADR)'}
                                    </span>
                                    {selectedUnitKey !== 'all' && (
                                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                                            호실 단독
                                        </span>
                                    )}
                                </div>
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

                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 hidden sm:inline">
                            기간 연동 ({diffDays}일):
                        </span>
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
                                주별
                            </button>
                            <button
                                type="button"
                                onClick={() => setTimeUnit('month')}
                                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                    timeUnit === 'month' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400'
                                }`}
                            >
                                월별
                            </button>
                        </div>
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
        </div>
    )}

    {/* 2) ⚖️ 양쪽 기간 종합 비교 위젯 (탑다운 전체 ➔ 건물 ➔ 호실 드릴다운) */}
    {selectedWidgets.has('comparison') && (
        <PeriodComparisonSection
            bookings={bookings}
            startDate={startDate}
            endDate={endDate}
            selectedProperty={selectedProperty}
            selectedUnitKey={selectedUnitKey}
        />
    )}

    {/* 3) 🌐 채널 & 플랫폼 점유율 위젯 (도넛 차트 + 상세 정산 내역) */}
    {selectedWidgets.has('channels') && (
        <ChannelRevenueSection
            bookings={bookings}
            timeFilter="custom"
            customStartDate={startDate}
            customEndDate={endDate}
            selectedProperty={selectedProperty}
            selectedUnitKey={selectedUnitKey}
        />
    )}

    {/* 3-2) ⏱️ 예약 리드타임 & 투숙기간 (LOS) 분석 위젯 */}
    {selectedWidgets.has('leadTime') && (
        <LeadTimeStaySection
            bookings={bookings}
            timeFilter="custom"
            startDate={startDate}
            endDate={endDate}
            selectedProperty={selectedProperty}
            selectedUnitKey={selectedUnitKey}
        />
    )}

    {/* 4) 🎯 호실별 x OTA 광고 성과 교차 매트릭스 위젯 */}
    {selectedWidgets.has('matrix') && (
        <RoomChannelMatrixSection
            bookings={bookings}
            timeFilter="custom"
            startDate={startDate}
            endDate={endDate}
            selectedProperty={selectedProperty}
            selectedUnitKey={selectedUnitKey}
        />
    )}

    {/* 5) 📅 향후 공실 레이더 위젯 (월간 캘린더) */}
    {selectedWidgets.has('radar') && (
        <FutureOccupancyRadar
            bookings={bookings}
            selectedProperty={selectedProperty}
            selectedUnitKey={selectedUnitKey}
        />
    )}

    {/* 6) 🌍 게스트 국적 분석 위젯 */}
    {selectedWidgets.has('country') && (
        <CountryRevenueSection
            bookings={bookings}
            timeFilter="custom"
            customStartDate={startDate}
            customEndDate={endDate}
            selectedProperty={selectedProperty}
            selectedUnitKey={selectedUnitKey}
        />
    )}
</div>

{/* 🚀 스크롤 맨 위로 이동 플로팅 버튼 (모바일/데스크톱 대응) */}
{showTopBtn && (
    <button
        type="button"
        onClick={scrollToTop}
        aria-label="맨 위로 이동"
        className="fixed bottom-6 right-6 z-40 p-3 rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer group"
    >
        <svg className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
    </button>
)}
</div>
    );
}
