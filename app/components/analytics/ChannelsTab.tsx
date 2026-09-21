'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import {
    calculateChannelStats,
    formatLocalDate,
} from '../../utils/analyticsCalculations';
import { getBookingDateKST, calculateNetPayout, isValidBooking } from '../../utils/bookingUtils';
import ChannelRevenueSection from './ChannelRevenueSection';
import CountryRevenueSection from './CountryRevenueSection';
import DateRangeToolbar from './DateRangeToolbar';

interface ChannelsTabProps {
    bookings: Booking[];
}

type InflowMetric = 'count' | 'revenue';

// 5대 핵심 OTA 플랫폼 및 기타 채널 정의 (트립, 부킹, 에어비앤비, 익스피디아, 아고다, 기타)
const CHANNEL_PALETTE: { id: string; name: string; color: string; matchApiId: number[] }[] = [
    { id: 'trip', name: '트립닷컴', color: '#2681FF', matchApiId: [53] },
    { id: 'booking', name: '부킹닷컴', color: '#003580', matchApiId: [19] },
    { id: 'airbnb', name: '에어비앤비', color: '#FF385C', matchApiId: [46] },
    { id: 'expedia', name: '익스피디아', color: '#EAA812', matchApiId: [14] },
    { id: 'agoda', name: '아고다', color: '#8B5CF6', matchApiId: [17] },
    { id: 'other', name: '기타/직거래', color: '#64748B', matchApiId: [0] },
];

export default function ChannelsTab({ bookings }: ChannelsTabProps) {
    // 1. 자체 날짜 상태: 기본값 최근 30일
    const { defaultStart, defaultEnd } = useMemo(() => {
        const now = new Date();
        const endStr = formatLocalDate(now);
        const s = new Date(now);
        s.setDate(s.getDate() - 29);
        return { defaultStart: formatLocalDate(s), defaultEnd: endStr };
    }, []);

    const [startDate, setStartDate] = useState<string>(defaultStart);
    const [endDate, setEndDate] = useState<string>(defaultEnd);
    const [subTab, setSubTab] = useState<'channels' | 'countries'>('channels');

    // 예약 유입 그래프 설정: 일자별 예약 유입 건수 vs 금액
    const [inflowMetric, setInflowMetric] = useState<InflowMetric>('count');
    const [inflowUnit, setInflowUnit] = useState<'day' | 'week' | 'month'>('day');
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    const handleChangeRange = (newStart: string, newEnd: string) => {
        setStartDate(newStart);
        setEndDate(newEnd);
    };

    // 2. 전체 채널 통계 (채널별 KPI 카드용)
    const { channelList, totalBookings, totalRevenue } = useMemo(() => {
        return calculateChannelStats(bookings, 'custom', startDate, endDate, 'stay');
    }, [bookings, startDate, endDate]);

    // 주요 채널별 요약 카드 데이터 매핑
    const channelCards = useMemo(() => {
        return CHANNEL_PALETTE.map((item) => {
            const matched = channelList.filter((c) => {
                const cLower = c.name.toLowerCase();
                if (item.id === 'trip') return cLower.includes('trip') || cLower.includes('트립');
                if (item.id === 'booking') return cLower.includes('booking') || cLower.includes('부킹');
                if (item.id === 'airbnb') return cLower.includes('airbnb') || cLower.includes('에어비앤비');
                if (item.id === 'expedia') return cLower.includes('expedia') || cLower.includes('익스피디아');
                if (item.id === 'agoda') return cLower.includes('agoda') || cLower.includes('아고다');
                return (
                    !cLower.includes('trip') &&
                    !cLower.includes('트립') &&
                    !cLower.includes('booking') &&
                    !cLower.includes('부킹') &&
                    !cLower.includes('airbnb') &&
                    !cLower.includes('에어비앤비') &&
                    !cLower.includes('expedia') &&
                    !cLower.includes('익스피디아') &&
                    !cLower.includes('agoda') &&
                    !cLower.includes('아고다')
                );
            });

            const count = matched.reduce((acc, cur) => acc + cur.count, 0);
            const rev = matched.reduce((acc, cur) => acc + cur.revenue, 0);
            const share = totalBookings > 0 ? Math.round((count / totalBookings) * 1000) / 10 : 0;

            return {
                ...item,
                count,
                revenue: rev,
                share,
            };
        });
    }, [channelList, totalBookings]);

    // 3. 일자별/주별/월별 예약 생성일(유입일) 기준 시계열 버킷
    const inflowBuckets = useMemo(() => {
        const buckets: { key: string; label: string; shortLabel: string; startDate: string; endDate: string }[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return buckets;

        if (inflowUnit === 'month') {
            // 📅 월별: 기준 연도 1년 (1월 ~ 12월 12개월 보장)
            const targetYear = start.getFullYear();
            const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
            if (diffMonths >= 12) {
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
            } else {
                for (let m = 0; m < 12; m++) {
                    const firstDay = formatLocalDate(new Date(targetYear, m, 1));
                    const lastDay = formatLocalDate(new Date(targetYear, m + 1, 0));
                    buckets.push({
                        key: firstDay,
                        label: `${targetYear}년 ${m + 1}월`,
                        shortLabel: `${m + 1}월`,
                        startDate: firstDay,
                        endDate: lastDay,
                    });
                }
            }
        } else if (inflowUnit === 'week') {
            // 📅 주별: 기준일(endDate) 기준 최근 3개월 (12~13주, 약 84~91일)
            const targetEnd = new Date(end);
            const targetStart = new Date(targetEnd);
            targetStart.setDate(targetStart.getDate() - 84); // 12주 전
            const dayOfWeek = targetStart.getDay();
            const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            targetStart.setDate(targetStart.getDate() + diffToMon);

            const cur = new Date(targetStart);
            while (cur <= targetEnd) {
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
    }, [startDate, endDate, inflowUnit]);

    // 4. 버킷별 채널 유입량(건수 및 금액) 계산 - O(N) 1-Pass 사전 집계 최적화
    const validBookings = useMemo(() => bookings.filter(isValidBooking), [bookings]);

    const inflowChartData = useMemo(() => {
        if (!inflowBuckets.length) return [];

        const minDate = inflowBuckets[0].startDate;
        const maxDate = inflowBuckets[inflowBuckets.length - 1].endDate;

        // 1-Pass: bookings를 1회만 순회하여 날짜별 KST 유입 데이터 집계
        const dateChannelMap = new Map<string, Record<string, { count: number; revenue: number }>>();

        for (let i = 0; i < validBookings.length; i++) {
            const b = validBookings[i];
            const bookedDate = getBookingDateKST(b.bookingTime, b.arrival);
            if (bookedDate >= minDate && bookedDate <= maxDate) {
                let dayData = dateChannelMap.get(bookedDate);
                if (!dayData) {
                    dayData = {
                        trip: { count: 0, revenue: 0 },
                        booking: { count: 0, revenue: 0 },
                        airbnb: { count: 0, revenue: 0 },
                        expedia: { count: 0, revenue: 0 },
                        agoda: { count: 0, revenue: 0 },
                        other: { count: 0, revenue: 0 },
                    };
                    dateChannelMap.set(bookedDate, dayData);
                }

                const apiId = Number(b.apiSourceId) || 0;
                const payout = calculateNetPayout(Number(b.price) || 0, apiId);

                let chKey = 'other';
                if (apiId === 53) chKey = 'trip';
                else if (apiId === 19) chKey = 'booking';
                else if (apiId === 46) chKey = 'airbnb';
                else if (apiId === 14) chKey = 'expedia';
                else if (apiId === 17) chKey = 'agoda';

                dayData[chKey].count += 1;
                dayData[chKey].revenue += payout;
            }
        }

        // 각 버킷은 O(1) 조회(일별) 또는 최대 7일 조회(주별)로 즉시 조립
        return inflowBuckets.map((bucket) => {
            const values: Record<string, { count: number; revenue: number }> = {
                trip: { count: 0, revenue: 0 },
                booking: { count: 0, revenue: 0 },
                airbnb: { count: 0, revenue: 0 },
                expedia: { count: 0, revenue: 0 },
                agoda: { count: 0, revenue: 0 },
                other: { count: 0, revenue: 0 },
            };

            if (bucket.startDate === bucket.endDate) {
                const dayData = dateChannelMap.get(bucket.startDate);
                if (dayData) {
                    for (const ch of CHANNEL_PALETTE) {
                        values[ch.id].count = dayData[ch.id]?.count || 0;
                        values[ch.id].revenue = dayData[ch.id]?.revenue || 0;
                    }
                }
            } else {
                const cur = new Date(bucket.startDate);
                const end = new Date(bucket.endDate);
                while (cur <= end) {
                    const dStr = cur.toISOString().slice(0, 10);
                    const dayData = dateChannelMap.get(dStr);
                    if (dayData) {
                        for (const ch of CHANNEL_PALETTE) {
                            values[ch.id].count += dayData[ch.id]?.count || 0;
                            values[ch.id].revenue += dayData[ch.id]?.revenue || 0;
                        }
                    }
                    cur.setDate(cur.getDate() + 1);
                }
            }

            return {
                bucket,
                values,
            };
        });
    }, [inflowBuckets, validBookings]);

    // 유휴 상태 요약
    const overallInflowSummary = useMemo(() => {
        return CHANNEL_PALETTE.map((ch) => {
            let totalC = 0;
            let totalR = 0;
            inflowChartData.forEach((row) => {
                totalC += row.values[ch.id]?.count || 0;
                totalR += row.values[ch.id]?.revenue || 0;
            });
            return {
                ...ch,
                totalC,
                totalR,
            };
        });
    }, [inflowChartData]);

    const maxVal = useMemo(() => {
        let max = 0;
        inflowChartData.forEach((row) => {
            CHANNEL_PALETTE.forEach((ch) => {
                const val = inflowMetric === 'count' ? row.values[ch.id]?.count || 0 : row.values[ch.id]?.revenue || 0;
                if (val > max) max = val;
            });
        });
        if (inflowMetric === 'count') return Math.max(5, Math.ceil(max * 1.2));
        return max > 0 ? Math.ceil(max * 1.15) : 3000000;
    }, [inflowChartData, inflowMetric]);

    // SVG 차트 좌표 계산
    const numBuckets = inflowChartData.length;
    const minColWidth = inflowUnit === 'day' ? 36 : 60;
    const chartW = Math.max(760, numBuckets * minColWidth);
    const chartH = 200;
    const padL = 70;
    const padR = 25;
    const padT = 18;
    const padB = 32;
    const plotW = chartW - padL - padR;
    const plotH = chartH - padT - padB;
    const slotW = numBuckets > 0 ? plotW / numBuckets : plotW;

    const getX = (idx: number) => {
        if (numBuckets <= 1) return padL + plotW / 2;
        return padL + (idx + 0.5) * slotW;
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const svgEl = e.currentTarget;
        const rect = svgEl.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const svgX = (clientX / rect.width) * chartW;

        if (svgX < padL || svgX > chartW - padR) {
            setHoveredIdx(null);
            return;
        }

        const idx = Math.floor((svgX - padL) / slotW);
        if (idx >= 0 && idx < numBuckets) {
            setHoveredIdx(idx);
        }
    };

    const hoveredRow = hoveredIdx !== null ? inflowChartData[hoveredIdx] : null;

    return (
        <div className="flex flex-col gap-3.5">
            {/* 1. 상단 툴바 (날짜 범위 및 ◀ 이전 / 다음 ▶ 스텝) */}
            <DateRangeToolbar
                startDate={startDate}
                endDate={endDate}
                onChangeRange={handleChangeRange}
                title="분석 기간"
            />

            {/* 2. 5대 주요 채널 + 기타 요약 카드 (직관적인 숫자 중심) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {channelCards.map((ch) => (
                    <div key={ch.id} className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: ch.color }} />
                                {ch.name}
                            </span>
                            <span className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300 font-mono">
                                {ch.share}%
                            </span>
                        </div>
                        <span className="text-base md:text-xl font-extrabold text-gray-900 dark:text-slate-100 font-mono">
                            ₩{ch.revenue.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                            {ch.count}건 예약
                        </span>
                    </div>
                ))}
            </div>

            {/* 3. 신규: 채널별 일자별 예약 유입 추이 선 그래프 (Google Trends 스타일) */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => setInflowMetric('count')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                inflowMetric === 'count'
                                    ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-2xs font-extrabold'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                        >
                            예약 유입 건수
                        </button>
                        <button
                            type="button"
                            onClick={() => setInflowMetric('revenue')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                inflowMetric === 'revenue'
                                    ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-2xs font-extrabold'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                        >
                            예약 유입 금액
                        </button>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setInflowUnit('day')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                inflowUnit === 'day' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400'
                            }`}
                        >
                            일별
                        </button>
                        <button
                            type="button"
                            onClick={() => setInflowUnit('week')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                inflowUnit === 'week' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400'
                            }`}
                        >
                            주별 (3개월)
                        </button>
                        <button
                            type="button"
                            onClick={() => setInflowUnit('month')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                inflowUnit === 'month' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400'
                            }`}
                        >
                            월별 (1년)
                        </button>
                    </div>
                </div>

                {/* 라이브 데이터 표시 바 */}
                <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 min-h-[42px]">
                    {hoveredRow ? (
                        <>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 font-extrabold text-xs font-mono border border-rose-200 dark:border-rose-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                                {hoveredRow.bucket.label}
                            </span>
                            <div className="flex flex-wrap items-center gap-3">
                                {CHANNEL_PALETTE.map((ch) => {
                                    const val =
                                        inflowMetric === 'count'
                                            ? `${hoveredRow.values[ch.id]?.count || 0}건`
                                            : `₩${(hoveredRow.values[ch.id]?.revenue || 0).toLocaleString()}`;
                                    return (
                                        <div key={ch.id} className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs">
                                            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: ch.color }} />
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{ch.name}:</span>
                                            <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100">{val}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                기간 내 총 예약 유입:
                            </span>
                            <div className="flex flex-wrap items-center gap-2.5">
                                {overallInflowSummary.map((ch) => (
                                    <div key={ch.id} className="flex items-center gap-1.5 text-xs bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700">
                                        <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: ch.color }} />
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">{ch.name}:</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                            {inflowMetric === 'count' ? `${ch.totalC}건` : `₩${ch.totalR.toLocaleString()}`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* SVG 그래프 (구글 트렌드식: 평소 점 없음, 호버 시에만 점 표시) */}
                <div className="w-full overflow-x-auto pb-1 relative">
                    <svg
                        width={chartW}
                        height={chartH}
                        viewBox={`0 0 ${chartW} ${chartH}`}
                        className="select-none cursor-pointer"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={() => setHoveredIdx(null)}
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
                                        x={padL - 8}
                                        y={y + 4}
                                        textAnchor="end"
                                        className="text-[11px] fill-slate-700 dark:fill-slate-300 font-bold font-mono"
                                    >
                                        {inflowMetric === 'count'
                                            ? `${val}건`
                                            : `₩${(val / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만`}
                                    </text>
                                </g>
                            );
                        })}

                        {/* 구글 트렌드 인터랙션: 마우스 호버 시 수직 기준선 */}
                        {hoveredIdx !== null && (
                            <line
                                x1={getX(hoveredIdx)}
                                y1={padT}
                                x2={getX(hoveredIdx)}
                                y2={chartH - padB}
                                stroke="#64748B"
                                strokeWidth="1.5"
                                strokeDasharray="4 3"
                            />
                        )}

                        {/* X축 라벨 */}
                        {inflowChartData.map((row, idx) => {
                            const isVisible = idx === 0 || idx === numBuckets - 1 || idx % (inflowUnit === 'day' ? 3 : 2) === 0;
                            if (!isVisible) return null;
                            const x = getX(idx);
                            const isHovered = hoveredIdx === idx;
                            return (
                                <g key={row.bucket.key}>
                                    <text
                                        x={x}
                                        y={chartH - 10}
                                        textAnchor="middle"
                                        className={`text-[11px] font-mono transition-colors ${
                                            isHovered ? 'fill-rose-600 dark:fill-rose-400 font-extrabold text-[12px]' : 'fill-slate-600 dark:fill-slate-400 font-bold'
                                        }`}
                                    >
                                        {row.bucket.shortLabel}
                                    </text>
                                </g>
                            );
                        })}

                        {CHANNEL_PALETTE.map((ch) => {
                            const points = inflowChartData.map((row, idx) => {
                                const x = getX(idx);
                                const val = inflowMetric === 'count' ? row.values[ch.id]?.count || 0 : row.values[ch.id]?.revenue || 0;
                                const ratio = maxVal > 0 ? val / maxVal : 0;
                                const y = padT + plotH * (1 - Math.min(1, ratio));
                                return `${x},${y}`;
                            }).join(' ');

                            return (
                                <g key={ch.id}>
                                    {inflowChartData.length > 1 && (
                                        <polyline
                                            fill="none"
                                            stroke={ch.color}
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            points={points}
                                            className="transition-all duration-300"
                                        />
                                    )}

                                    {inflowChartData.map((row, idx) => {
                                        const x = getX(idx);
                                        const val =
                                            inflowMetric === 'count'
                                                ? row.values[ch.id]?.count || 0
                                                : row.values[ch.id]?.revenue || 0;
                                        const ratio = maxVal > 0 ? val / maxVal : 0;
                                        const y = padT + plotH * (1 - Math.min(1, ratio));
                                        const isHovered = hoveredIdx === idx;

                                        if (inflowChartData.length === 1 || isHovered) {
                                            return (
                                                <circle
                                                    key={idx}
                                                    cx={x}
                                                    cy={y}
                                                    r={isHovered ? 6 : 5}
                                                    fill={ch.color}
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

            {/* 4. 하단 서브 전환 토글: [플랫폼 점유율 & 도넛 차트] vs [게스트 국적별 비중] */}
            <div className="bg-white dark:bg-slate-900 p-2.5 px-3 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-2 self-start">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => setSubTab('channels')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            subTab === 'channels'
                                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold'
                                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        플랫폼별 점유율 & 상세 내역
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubTab('countries')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            subTab === 'countries'
                                ? 'bg-white text-purple-700 shadow-2xs font-extrabold'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        게스트 국적별 비중
                    </button>
                </div>
            </div>

            {/* 5. 기존 도넛 차트 및 상세 분석 컴포넌트 */}
            {subTab === 'channels' ? (
                <ChannelRevenueSection
                    bookings={bookings}
                    timeFilter="custom"
                    customStartDate={startDate}
                    customEndDate={endDate}
                />
            ) : (
                <CountryRevenueSection
                    bookings={bookings}
                    timeFilter="custom"
                    customStartDate={startDate}
                    customEndDate={endDate}
                />
            )}
        </div>
    );
}
