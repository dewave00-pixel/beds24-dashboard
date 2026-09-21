'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Booking, UnitConfig } from '../../types';
import { ALL_UNITS, PROPERTY_GROUPS, getChannelStyle } from '../../config';
import { getUnitForBooking, calculateNetPayout, isValidBooking } from '../../utils/bookingUtils';

interface MultiMetricTrendTabProps {
    bookings: Booking[];
}

// 호실별 고유 식별 색상 팔레트
const PALETTE = [
    '#2563EB', // Blue
    '#DC2626', // Red
    '#D97706', // Amber
    '#059669', // Emerald
    '#7C3AED', // Purple
    '#DB2777', // Pink
    '#0891B2', // Cyan
    '#4F46E5', // Indigo
];

type TimeUnit = 'week' | 'month' | 'day';

interface TimeBucket {
    key: string;       // YYYY-MM-DD
    label: string;     // 예: "2026.9.18", "9월 3주차"
    shortLabel: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
}

export default function MultiMetricTrendTab({ bookings }: MultiMetricTrendTabProps) {
    // 1. 기간 설정 상태
    const today = useMemo(() => new Date(), []);
    const defaultStart = useMemo(() => {
        const d = new Date(today);
        d.setMonth(d.getMonth() - 2);
        d.setDate(1);
        return d.toISOString().split('T')[0];
    }, [today]);
    const defaultEnd = useMemo(() => {
        const d = new Date(today);
        d.setMonth(d.getMonth() + 1);
        d.setDate(0);
        return d.toISOString().split('T')[0];
    }, [today]);

    const [startDate, setStartDate] = useState<string>(defaultStart);
    const [endDate, setEndDate] = useState<string>(defaultEnd);
    const [timeUnit, setTimeUnit] = useState<TimeUnit>('week');

    // 2. 비교 대상 호실 다중 선택 상태 (기본값: 연남 102호, 남선 6호)
    const [selectedRoomKeys, setSelectedRoomKeys] = useState<string[]>(() => {
        const defaultKeys: string[] = [];
        const yeonnam = ALL_UNITS.find((u) => u.propName === 'YEONNAM');
        const namsun = ALL_UNITS.find((u) => u.propName === 'Namsun');
        if (yeonnam) defaultKeys.push(yeonnam.key);
        if (namsun) defaultKeys.push(namsun.key);
        return defaultKeys.length > 0 ? defaultKeys : [ALL_UNITS[0].key];
    });

    const [isAddRoomOpen, setIsAddRoomOpen] = useState<boolean>(false);

    // 마우스 호버 시 선택된 시간 버킷 인덱스 (상단 라이브 인스펙터 바 및 수직선 연동)
    const [hoveredBucketIdx, setHoveredBucketIdx] = useState<number | null>(null);

    // ★ 클릭 시 상세 보기 모달용 선택 상태
    const [detailBucket, setDetailBucket] = useState<TimeBucket | null>(null);

    // 선택된 호실 메타 정보 매핑
    const selectedUnits = useMemo(() => {
        return selectedRoomKeys
            .map((key, idx) => {
                const unit = ALL_UNITS.find((u) => u.key === key);
                if (!unit) return null;
                const propDisplayName = unit.propName === 'Namsun' ? '남선' : unit.propName === 'YEONNAM' ? '연남' : unit.propName === 'WAVE' ? '웨이브' : '그린';
                return {
                    ...unit,
                    displayNameFull: `${propDisplayName} ${unit.displayName}${unit.subName ? ` (${unit.subName})` : ''}`,
                    color: PALETTE[idx % PALETTE.length],
                };
            })
            .filter((u): u is UnitConfig & { displayNameFull: string; color: string } => u !== null);
    }, [selectedRoomKeys]);

    const handleToggleRoom = (key: string) => {
        setSelectedRoomKeys((prev) => {
            if (prev.includes(key)) {
                if (prev.length <= 1) return prev;
                return prev.filter((k) => k !== key);
            }
            if (prev.length >= 6) {
                alert('최대 6개 호실까지 동시에 비교할 수 있습니다.');
                return prev;
            }
            return [...prev, key];
        });
    };

    const handlePreset = (preset: 'last30' | 'last3m' | 'thisYear' | 'next30') => {
        const now = new Date();
        const endStr = now.toISOString().split('T')[0];

        if (preset === 'last30') {
            const s = new Date(now);
            s.setDate(s.getDate() - 29);
            setStartDate(s.toISOString().split('T')[0]);
            setEndDate(endStr);
            setTimeUnit('day');
        } else if (preset === 'last3m') {
            const s = new Date(now);
            s.setMonth(s.getMonth() - 2);
            s.setDate(1);
            setStartDate(s.toISOString().split('T')[0]);
            setEndDate(endStr);
            setTimeUnit('week');
        } else if (preset === 'thisYear') {
            const s = new Date(now.getFullYear(), 0, 1);
            const e = new Date(now.getFullYear(), 11, 31);
            setStartDate(s.toISOString().split('T')[0]);
            setEndDate(e.toISOString().split('T')[0]);
            setTimeUnit('month');
        } else if (preset === 'next30') {
            const future = new Date(now);
            future.setDate(future.getDate() + 30);
            setStartDate(endStr);
            setEndDate(future.toISOString().split('T')[0]);
            setTimeUnit('week');
        }
    };

    // 3. 시간 버킷 생성
    const timeBuckets: TimeBucket[] = useMemo(() => {
        const buckets: TimeBucket[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return buckets;

        if (timeUnit === 'month') {
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
        } else if (timeUnit === 'week') {
            const cur = new Date(start);
            while (cur <= end) {
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
            // day
            const cur = new Date(start);
            let count = 0;
            while (cur <= end && count < 62) {
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

    // 4. 버킷별 & 호실별 3대 지표 정밀 계산
    const validBookings = useMemo(() => bookings.filter(isValidBooking), [bookings]);

    const chartData = useMemo(() => {
        return timeBuckets.map((bucket) => {
            const bStart = bucket.startDate;
            const bEnd = bucket.endDate;

            const roomMetrics: Record<string, {
                revenue: number;
                nights: number;
                adr: number;
                occupancy: number;
                bookings: Booking[];
            }> = {};

            selectedUnits.forEach((unit) => {
                const matchedBookings = validBookings.filter((b) => {
                    const bUnit = getUnitForBooking(b);
                    if (!bUnit || bUnit.key !== unit.key) return false;
                    return b.departure >= bStart && b.departure <= bEnd;
                });

                let rev = 0;
                let nights = 0;
                matchedBookings.forEach((b) => {
                    const price = calculateNetPayout(Number(b.price) || 0, b.apiSourceId);
                    rev += price;

                    const arr = new Date(b.arrival);
                    const dep = new Date(b.departure);
                    const n = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
                    nights += n;
                });

                const adr = nights > 0 ? Math.round(rev / nights) : 0;

                const sD = new Date(bStart);
                const eD = new Date(bEnd);
                const bucketDays = Math.max(1, Math.round((eD.getTime() - sD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                const occ = Math.min(100, Math.round((nights / bucketDays) * 1000) / 10);

                roomMetrics[unit.key] = {
                    revenue: rev,
                    nights,
                    adr,
                    occupancy: occ,
                    bookings: matchedBookings,
                };
            });

            return {
                bucket,
                roomMetrics,
            };
        });
    }, [timeBuckets, selectedUnits, validBookings]);

    // 전체 기간 호실별 총합 성과
    const overallRoomTotals = useMemo(() => {
        return selectedUnits.map((unit) => {
            let totalRev = 0;
            let totalNights = 0;
            chartData.forEach((row) => {
                const m = row.roomMetrics[unit.key];
                if (m) {
                    totalRev += m.revenue;
                    totalNights += m.nights;
                }
            });
            const avgAdr = totalNights > 0 ? Math.round(totalRev / totalNights) : 0;
            return {
                unit,
                totalRev,
                totalNights,
                avgAdr,
            };
        });
    }, [selectedUnits, chartData]);

    const maxAdr = useMemo(() => {
        let max = 0;
        chartData.forEach((row) => {
            selectedUnits.forEach((u) => {
                const adr = row.roomMetrics[u.key]?.adr || 0;
                if (adr > max) max = adr;
            });
        });
        return max > 0 ? Math.ceil(max * 1.15) : 300000;
    }, [chartData, selectedUnits]);

    const maxRevenue = useMemo(() => {
        let max = 0;
        chartData.forEach((row) => {
            selectedUnits.forEach((u) => {
                const rev = row.roomMetrics[u.key]?.revenue || 0;
                if (rev > max) max = rev;
            });
        });
        return max > 0 ? Math.ceil(max * 1.15) : 1000000;
    }, [chartData, selectedUnits]);

    const numBuckets = chartData.length;
    const labelStep = useMemo(() => {
        if (timeUnit !== 'day') return 1;
        if (numBuckets <= 12) return 1;
        if (numBuckets <= 20) return 2;
        if (numBuckets <= 35) return 3;
        return 5;
    }, [numBuckets, timeUnit]);

    const minColWidth = timeUnit === 'day' ? 36 : timeUnit === 'week' ? 54 : 70;
    const chartW = Math.max(780, numBuckets * minColWidth);
    const chartH = 220;
    const padL = 80; // Y축 금액 레이블(₩163만 등)과 겹치지 않도록 충분한 여백 확보
    const padR = 25;
    const padT = 20;
    const padB = 35;
    const plotW = chartW - padL - padR;
    const plotH = chartH - padT - padB;
    const slotW = numBuckets > 0 ? plotW / numBuckets : plotW;

    // 각 시간 버킷의 중앙 X 좌표 (선 그래프와 막대 그래프의 일관된 컬럼 정렬)
    const getX = (idx: number) => {
        if (numBuckets <= 1) return padL + plotW / 2;
        return padL + (idx + 0.5) * slotW;
    };

    // 마우스 호버 시 해당 시간 버킷 추적 (상단 라이브 인스펙터 바 및 수직 가이드 연동)
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

    // 클릭 시 상세 모달 오픈
    const handleSvgClick = () => {
        if (hoveredBucketIdx !== null && chartData[hoveredBucketIdx]) {
            setDetailBucket(chartData[hoveredBucketIdx].bucket);
        }
    };

    const hoveredRow = hoveredBucketIdx !== null ? chartData[hoveredBucketIdx] : null;

    return (
        <div className="flex flex-col gap-4">
            {/* 1. 상단 컨트롤 패널 */}
            <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                        <span className="text-sm md:text-base font-extrabold text-gray-900">
                            호실별 추이 비교 (3대 지표 통합)
                        </span>
                        <span className="text-xs text-gray-500 font-medium hidden sm:inline">
                            체크아웃 정산 기준 시계열 트렌드 (그래프를 클릭하면 상세 내역 확인)
                        </span>
                    </div>

                    {/* 단위 토글 & 프리셋 */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setTimeUnit('day')}
                                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                    timeUnit === 'day' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'text-gray-600'
                                }`}
                            >
                                일별
                            </button>
                            <button
                                type="button"
                                onClick={() => setTimeUnit('week')}
                                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                    timeUnit === 'week' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'text-gray-600'
                                }`}
                            >
                                주별
                            </button>
                            <button
                                type="button"
                                onClick={() => setTimeUnit('month')}
                                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                    timeUnit === 'month' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'text-gray-600'
                                }`}
                            >
                                월별
                            </button>
                        </div>

                        <div className="flex items-center gap-1 text-xs">
                            <button
                                type="button"
                                onClick={() => handlePreset('last30')}
                                className="px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-gray-700 font-bold transition cursor-pointer text-[11px]"
                            >
                                최근 30일
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePreset('last3m')}
                                className="px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-gray-700 font-bold transition cursor-pointer text-[11px]"
                            >
                                최근 3개월
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePreset('next30')}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 text-blue-700 font-bold transition cursor-pointer text-[11px]"
                            >
                                향후 30일
                            </button>
                        </div>
                    </div>
                </div>

                {/* 날짜 입력 & 호실 다중 선택 칩 */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                        <span className="text-gray-500 font-medium">조회 기간:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-2 py-1 bg-white border border-gray-300 rounded-lg font-mono text-xs font-bold text-gray-800 cursor-pointer shadow-2xs"
                        />
                        <span className="text-gray-400 font-bold">~</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-2 py-1 bg-white border border-gray-300 rounded-lg font-mono text-xs font-bold text-gray-800 cursor-pointer shadow-2xs"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-600 mr-1">비교 호실:</span>
                        {selectedUnits.map((u) => (
                            <span
                                key={u.key}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-2xs transition"
                                style={{ backgroundColor: u.color }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                <span>{u.displayNameFull}</span>
                                {selectedUnits.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleToggleRoom(u.key)}
                                        className="ml-0.5 hover:bg-black/20 rounded-full w-4 h-4 flex items-center justify-center text-[11px] cursor-pointer"
                                        title="제거"
                                    >
                                        ✕
                                    </button>
                                )}
                            </span>
                        ))}

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsAddRoomOpen(!isAddRoomOpen)}
                                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-lg border border-gray-200 transition cursor-pointer flex items-center gap-1"
                            >
                                <span>+ 호실 추가</span>
                            </button>

                            {isAddRoomOpen && (
                                <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 p-3 z-30 flex flex-col gap-2.5 animate-fadeIn">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                                        <span className="text-xs font-bold text-gray-800">비교할 호실 선택 (최대 6개)</span>
                                        <button
                                            type="button"
                                            onClick={() => setIsAddRoomOpen(false)}
                                            className="text-gray-400 hover:text-gray-700 text-xs font-bold cursor-pointer"
                                        >
                                            닫기
                                        </button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto flex flex-col gap-2">
                                        {PROPERTY_GROUPS.map((group) => {
                                            const propLabel = group.name === 'Namsun' ? '남선' : group.name === 'YEONNAM' ? '연남' : group.name === 'WAVE' ? '웨이브' : '그린';
                                            return (
                                                <div key={group.name} className="flex flex-col gap-1">
                                                    <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">
                                                        {propLabel}
                                                    </span>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        {group.units.map((u) => {
                                                            const isSelected = selectedRoomKeys.includes(u.key);
                                                            return (
                                                                <button
                                                                    key={u.key}
                                                                    type="button"
                                                                    onClick={() => handleToggleRoom(u.key)}
                                                                    className={`px-2 py-1 rounded-md text-[11px] font-bold text-left transition cursor-pointer border ${
                                                                        isSelected
                                                                            ? 'bg-blue-50 text-blue-700 border-blue-300 font-extrabold'
                                                                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                                                    }`}
                                                                >
                                                                    {isSelected ? '✓ ' : ''}{u.displayName}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 메인 3대 통합 차트 영역 (화면 덜컹거림 원천 차단) */}
            {chartData.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-400 text-xs font-medium">
                    선택한 기간에 비교할 예약 데이터가 없습니다.
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* 좌측 8칸: 2개 메인 시계열 그래프 (선 그래프 + 막대 그래프) */}
                    <div className="lg:col-span-8 flex flex-col gap-4">
                        {/* 📈 차트 ①: [선 그래프 (Line)] 1박 평균단가(ADR) 가격 흐름 */}
                        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-3 relative">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                        <span>1박 평균 판매단가 (ADR) 변동 추이</span>
                                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-200">
                                            선 그래프
                                        </span>
                                    </h4>
                                    <span className="text-[11px] text-gray-500 font-medium">
                                        마우스를 올리면 상단 바에 수치 표시, <strong>클릭 시 해당 날짜의 세부 예약 내역 팝업</strong>
                                    </span>
                                </div>
                                <span className="text-xs font-mono font-extrabold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                    최고 ₩{maxAdr.toLocaleString()}
                                </span>
                            </div>

                            {/* 상단 고정 라이브 인스펙터 바 (말풍선 대체: 그래프 가림 & 짤림 원천 차단) */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 min-h-[44px]">
                                {hoveredRow ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-100/90 text-purple-900 font-extrabold text-xs font-mono border border-purple-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span>
                                                {hoveredRow.bucket.label}
                                            </span>
                                            <span className="text-[11px] text-purple-700 font-bold hidden sm:inline">
                                                (클릭 시 세부 예약 내역 확인)
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            {selectedUnits.map((u) => {
                                                const adr = hoveredRow.roomMetrics[u.key]?.adr || 0;
                                                return (
                                                    <div key={u.key} className="flex items-center gap-1.5 text-xs bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                                                        <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: u.color }} />
                                                        <span className="font-bold text-slate-700">{u.displayName}:</span>
                                                        <span className="font-mono font-extrabold text-slate-900">
                                                            ₩{adr.toLocaleString()}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                            <span className="text-slate-400">💡</span>
                                            <span>그래프에 마우스를 올리면 해당 일자의 호실별 단가가 실시간 표시됩니다.</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            {overallRoomTotals.map(({ unit, avgAdr }) => (
                                                <div key={unit.key} className="flex items-center gap-1.5 text-xs bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                                                    <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: unit.color }} />
                                                    <span className="text-slate-500 font-medium">{unit.displayName} 평균:</span>
                                                    <span className="font-mono font-bold text-slate-800">
                                                        ₩{avgAdr.toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* SVG 다중 라인 차트 */}
                            <div className="w-full overflow-x-auto pb-1 relative">
                                <svg
                                    width={chartW}
                                    height={chartH}
                                    viewBox={`0 0 ${chartW} ${chartH}`}
                                    className="select-none cursor-pointer"
                                    onMouseMove={handleSvgMouseMove}
                                    onMouseLeave={handleSvgMouseLeave}
                                    onClick={handleSvgClick}
                                >
                                    {/* 그리드 가로선 4줄 및 고대비 Y축 가격 라벨 */}
                                    {[0, 0.33, 0.66, 1].map((ratio) => {
                                        const y = padT + plotH * (1 - ratio);
                                        const val = Math.round(maxAdr * ratio);
                                        return (
                                            <g key={ratio}>
                                                <line
                                                    x1={padL}
                                                    y1={y}
                                                    x2={chartW - padR}
                                                    y2={y}
                                                    stroke="#E2E8F0"
                                                    strokeWidth="1"
                                                    strokeDasharray={ratio === 0 ? undefined : "3 3"}
                                                />
                                                <text
                                                    x={padL - 10}
                                                    y={y + 4}
                                                    textAnchor="end"
                                                    className="text-[11px] fill-slate-700 font-bold font-mono"
                                                >
                                                    ₩{(val / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만
                                                </text>
                                            </g>
                                        );
                                    })}

                                    {/* 수직 인터랙티브 가이드라인 & 하이라이트 */}
                                    {hoveredBucketIdx !== null && (
                                        <g>
                                            <rect
                                                x={getX(hoveredBucketIdx) - slotW / 2}
                                                y={padT}
                                                width={slotW}
                                                height={plotH}
                                                fill="#8B5CF6"
                                                opacity="0.06"
                                                rx="3"
                                            />
                                            <line
                                                x1={getX(hoveredBucketIdx)}
                                                y1={padT}
                                                x2={getX(hoveredBucketIdx)}
                                                y2={chartH - padB}
                                                stroke="#8B5CF6"
                                                strokeWidth="1.5"
                                                strokeDasharray="4 3"
                                            />
                                        </g>
                                    )}

                                    {/* X축 라벨 */}
                                    {chartData.map((row, idx) => {
                                        const isVisible = idx === 0 || idx === numBuckets - 1 || idx % labelStep === 0;
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
                                                        isHovered ? 'fill-purple-700 font-extrabold text-[12px]' : 'fill-slate-600 font-bold'
                                                    }`}
                                                >
                                                    {row.bucket.shortLabel}
                                                </text>
                                            </g>
                                        );
                                    })}

                                    {/* 호실별 꺾은선 (Polyline) */}
                                    {selectedUnits.map((unit) => {
                                        const points = chartData.map((row, idx) => {
                                            const x = getX(idx);
                                            const adr = row.roomMetrics[unit.key]?.adr || 0;
                                            const ratio = maxAdr > 0 ? adr / maxAdr : 0;
                                            const y = padT + plotH * (1 - Math.min(1, ratio));
                                            return `${x},${y}`;
                                        }).join(' ');

                                        return (
                                            <g key={unit.key}>
                                                <polyline
                                                    fill="none"
                                                    stroke={unit.color}
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    points={points}
                                                    className="transition-all duration-300"
                                                />
                                                {/* 포인트 점 */}
                                                {chartData.map((row, idx) => {
                                                    const x = getX(idx);
                                                    const adr = row.roomMetrics[unit.key]?.adr || 0;
                                                    const ratio = maxAdr > 0 ? adr / maxAdr : 0;
                                                    const y = padT + plotH * (1 - Math.min(1, ratio));
                                                    const isHovered = hoveredBucketIdx === idx;

                                                    if (timeUnit === 'day' && numBuckets > 20 && !isHovered) {
                                                        return null;
                                                    }

                                                    return (
                                                        <circle
                                                            key={idx}
                                                            cx={x}
                                                            cy={y}
                                                            r={isHovered ? '6' : '3.5'}
                                                            fill={isHovered ? unit.color : '#ffffff'}
                                                            stroke={unit.color}
                                                            strokeWidth={isHovered ? '2.5' : '2'}
                                                            className="transition-all duration-200"
                                                        />
                                                    );
                                                })}
                                            </g>
                                        );
                                    })}
                                </svg>
                            </div>
                        </div>

                        {/* 📊 차트 ②: [막대 그래프 (Bar)] 기간별 총 매출액 (Gross Revenue) 볼륨 비교 */}
                        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-3 relative">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                        <span>기간별 총 매출액 (Gross Revenue) 볼륨 비교</span>
                                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200">
                                            막대 그래프
                                        </span>
                                    </h4>
                                    <span className="text-[11px] text-gray-500 font-medium">
                                        시기별 각 호실의 총 결제 매출 볼륨 대조 (클릭 시 해당 일자 상세 확인)
                                    </span>
                                </div>
                                <span className="text-xs font-mono font-extrabold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                    최고 ₩{maxRevenue.toLocaleString()}
                                </span>
                            </div>

                            {/* 상단 고정 라이브 인스펙터 바 (말풍선 대체: 그래프 가림 & 짤림 원천 차단) */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 min-h-[44px]">
                                {hoveredRow ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100/90 text-blue-900 font-extrabold text-xs font-mono border border-blue-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                                                {hoveredRow.bucket.label}
                                            </span>
                                            <span className="text-[11px] text-blue-700 font-bold hidden sm:inline">
                                                (클릭 시 세부 예약 내역 확인)
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            {selectedUnits.map((u) => {
                                                const rev = hoveredRow.roomMetrics[u.key]?.revenue || 0;
                                                return (
                                                    <div key={u.key} className="flex items-center gap-1.5 text-xs bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                                                        <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: u.color }} />
                                                        <span className="font-bold text-slate-700">{u.displayName}:</span>
                                                        <span className="font-mono font-extrabold text-slate-900">
                                                            ₩{rev.toLocaleString()}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                            <span className="text-slate-400">💡</span>
                                            <span>그래프에 마우스를 올리면 해당 일자의 호실별 매출액이 실시간 표시됩니다.</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            {overallRoomTotals.map(({ unit, totalRev }) => (
                                                <div key={unit.key} className="flex items-center gap-1.5 text-xs bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                                                    <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: unit.color }} />
                                                    <span className="text-slate-500 font-medium">{unit.displayName} 총매출:</span>
                                                    <span className="font-mono font-bold text-slate-800">
                                                        ₩{totalRev.toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="w-full overflow-x-auto pb-1 relative">
                                <svg
                                    width={chartW}
                                    height={chartH}
                                    viewBox={`0 0 ${chartW} ${chartH}`}
                                    className="select-none cursor-pointer"
                                    onMouseMove={handleSvgMouseMove}
                                    onMouseLeave={handleSvgMouseLeave}
                                    onClick={handleSvgClick}
                                >
                                    {/* 그리드 가로선 4줄 및 고대비 Y축 가격 라벨 */}
                                    {[0, 0.33, 0.66, 1].map((ratio) => {
                                        const y = padT + plotH * (1 - ratio);
                                        const val = Math.round(maxRevenue * ratio);
                                        return (
                                            <g key={ratio}>
                                                <line
                                                    x1={padL}
                                                    y1={y}
                                                    x2={chartW - padR}
                                                    y2={y}
                                                    stroke="#E2E8F0"
                                                    strokeWidth="1"
                                                    strokeDasharray={ratio === 0 ? undefined : "3 3"}
                                                />
                                                <text
                                                    x={padL - 10}
                                                    y={y + 4}
                                                    textAnchor="end"
                                                    className="text-[11px] fill-slate-700 font-bold font-mono"
                                                >
                                                    ₩{(val / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만
                                                </text>
                                            </g>
                                        );
                                    })}

                                    {/* 수직 인터랙티브 가이드라인 & 하이라이트 */}
                                    {hoveredBucketIdx !== null && (
                                        <g>
                                            <rect
                                                x={getX(hoveredBucketIdx) - slotW / 2}
                                                y={padT}
                                                width={slotW}
                                                height={plotH}
                                                fill="#3B82F6"
                                                opacity="0.06"
                                                rx="3"
                                            />
                                            <line
                                                x1={getX(hoveredBucketIdx)}
                                                y1={padT}
                                                x2={getX(hoveredBucketIdx)}
                                                y2={chartH - padB}
                                                stroke="#3B82F6"
                                                strokeWidth="1.5"
                                                strokeDasharray="4 3"
                                            />
                                        </g>
                                    )}

                                    {/* 막대 그룹 렌더링 (Y축 라벨과 겹치지 않도록 슬롯 내 안전 배치) */}
                                    {chartData.map((row, bucketIdx) => {
                                        const groupCenterX = getX(bucketIdx);
                                        const numUnits = selectedUnits.length;
                                        const maxGroupWidth = slotW * 0.82;
                                        const barWidth = Math.min(22, Math.max(5, maxGroupWidth / numUnits));
                                        const groupTotalW = barWidth * numUnits;
                                        const startBarX = groupCenterX - groupTotalW / 2;
                                        const isHovered = hoveredBucketIdx === bucketIdx;

                                        const isLabelVisible = bucketIdx === 0 || bucketIdx === numBuckets - 1 || bucketIdx % labelStep === 0;

                                        return (
                                            <g key={row.bucket.key}>
                                                {selectedUnits.map((unit, uIdx) => {
                                                    const rev = row.roomMetrics[unit.key]?.revenue || 0;
                                                    const ratio = maxRevenue > 0 ? rev / maxRevenue : 0;
                                                    const barH = plotH * Math.min(1, ratio);
                                                    const x = startBarX + uIdx * barWidth;
                                                    const y = padT + plotH - barH;

                                                    return (
                                                        <rect
                                                            key={unit.key}
                                                            x={x}
                                                            y={y}
                                                            width={Math.max(3, barWidth - 1.5)}
                                                            height={barH}
                                                            fill={unit.color}
                                                            opacity={isHovered ? 1 : 0.85}
                                                            rx="2"
                                                            className="transition-all duration-200"
                                                        />
                                                    );
                                                })}

                                                {isLabelVisible && (
                                                    <text
                                                        x={groupCenterX}
                                                        y={chartH - 10}
                                                        textAnchor="middle"
                                                        className={`text-[11px] font-mono transition-colors ${
                                                            isHovered ? 'fill-blue-600 font-extrabold text-[12px]' : 'fill-slate-600 font-bold'
                                                        }`}
                                                    >
                                                        {row.bucket.shortLabel}
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    })}
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* 우측 4칸: 차트 ③ [가동률 & 투숙 박수 성과 카드] */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-3">
                            <div className="pb-2 border-b border-gray-100">
                                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                    <span>가동률 & 투숙 박수 성과</span>
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                                        지표 ③
                                    </span>
                                </h4>
                                <span className="text-[11px] text-gray-500 font-medium">
                                    선택 기간 동안의 총 판매 박수 및 점유율
                                </span>
                            </div>

                            <div className="flex flex-col gap-3">
                                {overallRoomTotals.map(({ unit, totalRev, totalNights, avgAdr }) => {
                                    return (
                                        <div
                                            key={unit.key}
                                            className="bg-gray-50/80 p-3 rounded-xl border border-gray-200 flex flex-col gap-2 shadow-2xs"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                                                        style={{ backgroundColor: unit.color }}
                                                    />
                                                    <span className="font-extrabold text-xs text-gray-900">
                                                        {unit.displayNameFull}
                                                    </span>
                                                </div>
                                                <span className="text-xs font-mono font-extrabold text-gray-900">
                                                    ₩{totalRev.toLocaleString()}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1.5 border-t border-gray-200/60">
                                                <div>
                                                    <span className="text-gray-400 block text-[10px]">총 투숙 박수</span>
                                                    <span className="font-bold text-gray-800">
                                                        {totalNights}박 판매
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-gray-400 block text-[10px]">평균 단가 (ADR)</span>
                                                    <span className="font-mono font-bold text-purple-700">
                                                        ₩{avgAdr.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 클릭 안내 카드 */}
                        <div className="bg-blue-50/70 rounded-2xl border border-blue-200/80 p-3.5 flex flex-col gap-1.5 text-xs text-blue-900">
                            <span className="font-extrabold flex items-center gap-1">
                                <span>💡</span>
                                <span>클릭하여 날짜별 상세 내역 확인</span>
                            </span>
                            <p className="text-[11px] text-blue-800 leading-relaxed">
                                그래프의 특정 날짜나 막대를 클릭하시면, 해당 일자에 투숙/체크아웃된 <strong>손님 성함, 예약 플랫폼, 결제금액 내역</strong>이 상세 팝업으로 차분하게 열립니다.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ★ 4. 날짜 클릭 시 열리는 [일자별 상세 비교 팝업 모달] */}
            {detailBucket && (
                <DateDetailModal
                    bucket={detailBucket}
                    selectedUnits={selectedUnits}
                    chartData={chartData}
                    onClose={() => setDetailBucket(null)}
                />
            )}
        </div>
    );
}

// ----------------------------------------------------------------------
// 클릭 시 열리는 일자별 상세 비교 모달 서브 컴포넌트
// ----------------------------------------------------------------------
interface DateDetailModalProps {
    bucket: TimeBucket;
    selectedUnits: (UnitConfig & { displayNameFull: string; color: string })[];
    chartData: { bucket: TimeBucket; roomMetrics: Record<string, { revenue: number; nights: number; adr: number; occupancy: number; bookings: Booking[] }> }[];
    onClose: () => void;
}

function DateDetailModal({ bucket, selectedUnits, chartData, onClose }: DateDetailModalProps) {
    const row = chartData.find((r) => r.bucket.key === bucket.key);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[85vh] overflow-hidden z-10 animate-scaleUp">
                {/* 모달 헤더 */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/80">
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-base font-extrabold text-gray-900">
                                {bucket.label} 호실별 상세 실적 대조
                            </h4>
                        </div>
                        <span className="text-[11px] text-gray-500 font-medium">
                            선택된 호실들의 단가, 매출 및 체크아웃 예약 내역
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition cursor-pointer text-sm font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* 모달 본문 (호실별 카드 리스트) */}
                <div className="p-4 overflow-y-auto flex flex-col gap-3 divide-y divide-gray-100">
                    {selectedUnits.map((u) => {
                        const m = row?.roomMetrics[u.key];
                        const adr = m?.adr || 0;
                        const rev = m?.revenue || 0;
                        const occ = m?.occupancy || 0;
                        const bList = m?.bookings || [];

                        return (
                            <div key={u.key} className="pt-3 first:pt-0 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="w-3 h-3 rounded-xs shrink-0"
                                            style={{ backgroundColor: u.color }}
                                        />
                                        <span className="font-extrabold text-sm text-gray-900">
                                            {u.displayNameFull}
                                        </span>
                                        {occ > 0 && (
                                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-md">
                                                가동률 {occ}%
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[11px] text-gray-500 mr-2">
                                            1박 단가: <strong className="text-purple-700 font-mono font-bold">₩{adr.toLocaleString()}</strong>
                                        </span>
                                        <span className="text-xs font-mono font-extrabold text-gray-900">
                                            총 매출: ₩{rev.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {/* 해당 기간 예약 건들 */}
                                {bList.length > 0 ? (
                                    <div className="bg-gray-50/80 rounded-xl p-2.5 border border-gray-200 flex flex-col gap-1.5 text-xs">
                                        {bList.map((b) => {
                                            const ch = getChannelStyle(b.apiSourceId);
                                            const guest = b.firstName || b.lastName ? `${b.firstName || ''} ${b.lastName || ''}`.trim() : '성함 미상';
                                            const gross = Number(b.price) || 0;
                                            const net = calculateNetPayout(gross, b.apiSourceId);

                                            return (
                                                <div key={b.id} className="flex items-center justify-between text-[11px]">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="px-1.5 py-0.2 rounded-xs text-[10px] font-bold"
                                                            style={{ backgroundColor: ch.bg, color: ch.text }}
                                                        >
                                                            {ch.name}
                                                        </span>
                                                        <span className="font-bold text-gray-800">{guest}</span>
                                                        <span className="text-gray-400 font-mono">#{b.id}</span>
                                                        <span className="text-gray-500">({b.arrival} ~ {b.departure})</span>
                                                    </div>
                                                    <div className="text-right font-mono">
                                                        <span className="text-gray-900 font-bold">₩{gross.toLocaleString()}</span>
                                                        <span className="text-emerald-700 font-bold ml-1.5">(순 ₩{net.toLocaleString()})</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-gray-400 py-1 pl-5">
                                        해당 기간에 체크아웃된 예약이 없습니다.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 모달 푸터 */}
                <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
