'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Booking } from '../../types';
import {
    ChannelStats,
    DateFilterMode,
    TimeFilterRange,
    calculateChannelStats,
    calculateDailyChannelTrends,
    DailyChannelPoint,
} from '../../utils/analyticsCalculations';
import { calculateNetPayout, getUnitForBooking, getBookingDateKST } from '../../utils/bookingUtils';

interface ChannelRevenueSectionProps {
    bookings: Booking[];
    timeFilter: TimeFilterRange;
    customStartDate?: string;
    customEndDate?: string;
    selectedProperty?: string;
    selectedUnitKey?: string;
}

type ChannelViewMode = 'trend' | 'donut';
type ChartMetricType = 'revenue' | 'count';

export default function ChannelRevenueSection({
    bookings = [],
    timeFilter,
    customStartDate,
    customEndDate,
    selectedProperty,
    selectedUnitKey,
}: ChannelRevenueSectionProps) {
    // 사용자의 기본 분석 기준에 맞춰 진입 시 기본값을 'booked'(예약 접수일 기준)로 설정
    const [channelDateMode, setChannelDateMode] = useState<DateFilterMode>('booked');
    const [viewMode, setViewMode] = useState<ChannelViewMode>('donut'); // 🍩 도넛 & 점유율 테이블 뷰 기본
    const [chartMetric, setChartMetric] = useState<ChartMetricType>('revenue'); // 매출 기준 기본
    const [selectedChannelFilter, setSelectedChannelFilter] = useState<string | null>(null); // 특정 채널 단독 필터링 (null = 전체)
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const [hoveredDayPoint, setHoveredDayPoint] = useState<DailyChannelPoint | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<ChannelStats | null>(null);

    // 미래 조회 탭(next30) 선택 시 투숙/체크아웃 기준으로 자동 전환
    useEffect(() => {
        if (timeFilter === 'next30') {
            setChannelDateMode('stay');
        }
    }, [timeFilter]);

    // 1. 전체 채널별 요약 및 점유율 계산 (도넛 및 테이블용)
    const { channelList, totalBookings, totalRevenue } = useMemo(() => {
        return calculateChannelStats(
            bookings,
            timeFilter,
            customStartDate,
            customEndDate,
            channelDateMode,
            selectedProperty,
            selectedUnitKey
        );
    }, [bookings, timeFilter, customStartDate, customEndDate, channelDateMode, selectedProperty, selectedUnitKey]);

    // 2. 📊 일자별 시계열 채널 트렌드 계산 (하루하루 비교 차트용)
    const dailyTrends: DailyChannelPoint[] = useMemo(() => {
        return calculateDailyChannelTrends(
            bookings,
            timeFilter,
            customStartDate,
            customEndDate,
            channelDateMode,
            selectedProperty,
            selectedUnitKey
        );
    }, [bookings, timeFilter, customStartDate, customEndDate, channelDateMode, selectedProperty, selectedUnitKey]);

    // 모달이 열려있는 상태에서 탭/필터 변경 시 선택된 채널 통계 동기화
    useEffect(() => {
        if (selectedChannel) {
            const updated = channelList.find((c) => c.name === selectedChannel.name);
            setSelectedChannel(updated || null);
        }
    }, [channelList]);

    // 📈 일자별 스택 바 차트 SVG 계산 파라미터 (특정 채널 단독 필터 반영)
    const chartConfig = useMemo(() => {
        const pointCount = dailyTrends.length;
        if (pointCount === 0) return null;

        const leftPad = 52; // Y축 눈금 전용 독립 여백 (막대와 텍스트 겹침 완벽 방지)
        const itemWidth = Math.max(52, Math.min(74, 920 / pointCount));
        const chartWidth = Math.max(760, leftPad + pointCount * itemWidth + 24);
        const chartHeight = 290; // 시원한 높이로 상향
        const topPad = 34;
        const bottomPad = 50; // 날짜/요일 라벨을 위한 넉넉한 공간
        const plotHeight = chartHeight - topPad - bottomPad; // 206px로 확대

        // 최대값 산출 (특정 채널 필터 시 해당 채널 단독 값 기준, 전체일 땐 총합 기준)
        let maxVal = 1;
        dailyTrends.forEach((d) => {
            if (selectedChannelFilter) {
                const seg = d.channelSegments.find((s) => s.channelName === selectedChannelFilter);
                if (seg) {
                    const val = chartMetric === 'revenue' ? seg.revenue : seg.bookings;
                    if (val > maxVal) maxVal = val;
                }
            } else {
                const val = chartMetric === 'revenue' ? d.totalRevenue : d.totalBookings;
                if (val > maxVal) maxVal = val;
            }
        });

        // 넉넉한 Y축 상한선
        const yMax = Math.ceil(maxVal * 1.15) || 1;

        return { chartWidth, chartHeight, topPad, bottomPad, leftPad, plotHeight, itemWidth, yMax };
    }, [dailyTrends, chartMetric, selectedChannelFilter]);

    if (!channelList || channelList.length === 0 || totalBookings === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-8 text-center flex flex-col items-center gap-3">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold self-center">
                    <button
                        type="button"
                        onClick={() => setChannelDateMode('booked')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                            channelDateMode === 'booked'
                                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <span>예약 접수일 기준</span>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium hidden sm:inline">(Beds24 공식)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setChannelDateMode('stay')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                            channelDateMode === 'stay'
                                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <span>실제 투숙일 기준</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium hidden sm:inline">(운영 정산)</span>
                    </button>
                </div>
                <p className="text-gray-400 dark:text-slate-500 font-bold text-xs mt-2">
                    해당 기간에 집계된 플랫폼별 예약 데이터가 없습니다.
                </p>
            </div>
        );
    }

    // 도넛 차트 SVG 파라미터
    const donutSize = 240;
    const strokeWidth = 40;
    const radius = (donutSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const gapLength = channelList.length > 1 ? 3 : 0;
    let accumulatedPct = 0;
    const hoveredDonutItem = hoveredIdx !== null ? channelList[hoveredIdx] : null;

    // 선택된 단독 채널의 메타데이터
    const activeFilteredChannelMeta = selectedChannelFilter
        ? channelList.find((c) => c.name === selectedChannelFilter)
        : null;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-3.5 md:p-5 shadow-xs flex flex-col gap-4">
            {/* 1. 상단 타이틀 & 뷰 토글 & 기준 스위치 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <div>
                        <h3 className="text-sm md:text-base font-bold text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-2 flex-wrap">
                            <span>Booking Source (플랫폼별 점유율 & 일자별 추세)</span>
                            <span className="text-[10.5px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                                {channelDateMode === 'booked' ? '예약 접수일 기준' : '실제 투숙일 기준'}
                            </span>
                            {selectedChannelFilter && (
                                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                    🎯 {selectedChannelFilter} 단독 분석 중
                                </span>
                            )}
                        </h3>
                        <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium hidden sm:inline">
                            {channelDateMode === 'booked'
                                ? '선택된 기간 동안 새로 들어온 유입 예약 (Beds24 공식 화면 일치)'
                                : '선택된 기간 동안 실제로 투숙 및 체크아웃된 예약의 실매출 정산'}
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                    {/* 뷰 모드 토글: [🍩 전체 점유율 도넛] vs [📊 일자별 추세 차트] */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setViewMode('donut')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                viewMode === 'donut'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <span>🍩</span>
                            <span>점유율 도넛</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('trend')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                viewMode === 'trend'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <span>📊</span>
                            <span>일자별 추세</span>
                        </button>
                    </div>

                    {/* 집계 기준 스위치 */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setChannelDateMode('stay')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                channelDateMode === 'stay'
                                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs font-extrabold'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                            }`}
                        >
                            투숙일
                        </button>
                        <button
                            type="button"
                            onClick={() => setChannelDateMode('booked')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                channelDateMode === 'booked'
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                            }`}
                        >
                            접수일
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. 📊 [일자별 추세 차트 뷰] (선택한 플랫폼 단독 필터링 지원) */}
            {viewMode === 'trend' && chartConfig && (
                <div className="flex flex-col gap-3">
                    {/* 차트 상단 컨트롤: 플랫폼 선택 칩 + 지표 토글 */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                        {/* 플랫폼 선택 칩 목록 (클릭 시 해당 플랫폼만 단독 필터링!) */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-400 mr-1">플랫폼 선택:</span>
                            {/* 전체 보기 버튼 */}
                            <button
                                type="button"
                                onClick={() => setSelectedChannelFilter(null)}
                                className={`px-3 py-1.5 rounded-lg text-xs md:text-[12.5px] font-bold transition cursor-pointer border ${
                                    selectedChannelFilter === null
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-black'
                                        : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                전체 플랫폼 (누적)
                            </button>

                            {/* 개별 채널 칩들 */}
                            {channelList.map((ch) => {
                                const isSelected = selectedChannelFilter === ch.name;
                                return (
                                    <button
                                        key={ch.name}
                                        type="button"
                                        onClick={() => setSelectedChannelFilter(isSelected ? null : ch.name)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-[12.5px] font-bold transition cursor-pointer border ${
                                            isSelected
                                                ? 'bg-white dark:bg-slate-900 shadow-xs ring-2 ring-blue-500 text-gray-900 dark:text-slate-100 scale-105 font-black'
                                                : 'bg-gray-50 dark:bg-slate-800/80 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800'
                                        }`}
                                        style={{
                                            borderColor: isSelected ? ch.color : undefined,
                                        }}
                                    >
                                        <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: ch.color }} />
                                        <span>{ch.name}</span>
                                        <span className="text-gray-400 dark:text-slate-500 text-[11px] font-semibold">({ch.percentage}%)</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* 매출 vs 건수 토글 */}
                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setChartMetric('revenue')}
                                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                                    chartMetric === 'revenue'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-extrabold shadow-2xs'
                                        : 'text-gray-500'
                                }`}
                            >
                                ₩ 매출액
                            </button>
                            <button
                                type="button"
                                onClick={() => setChartMetric('count')}
                                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                                    chartMetric === 'count'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-extrabold shadow-2xs'
                                        : 'text-gray-500'
                                }`}
                            >
                                📋 예약건수
                            </button>
                        </div>
                    </div>

                    {/* SVG 인터랙티브 막대 차트 (가로 스크롤 가능) */}
                    <div className="w-full overflow-x-auto bg-gray-50/70 dark:bg-slate-800/30 rounded-2xl border border-gray-100 dark:border-slate-800/80 p-2 md:p-3">
                        <div style={{ minWidth: `${chartConfig.chartWidth}px` }} className="relative select-none">
                            <svg
                                width={chartConfig.chartWidth}
                                height={chartConfig.chartHeight}
                                className="overflow-visible"
                            >
                                {/* Y축 가이드 라인 (0%, 50%, 100%) - 독립된 leftPad 영역에 깔끔히 분리 */}
                                {[0, 0.5, 1].map((ratio) => {
                                    const y = chartConfig.topPad + (1 - ratio) * chartConfig.plotHeight;
                                    const val = Math.round(chartConfig.yMax * ratio);
                                    const label =
                                        chartMetric === 'revenue'
                                            ? val >= 10000
                                                ? `${Math.round(val / 10000)}만`
                                                : `${val.toLocaleString()}원`
                                            : `${val}건`;
                                    return (
                                        <g key={ratio}>
                                            <line
                                                x1={chartConfig.leftPad}
                                                y1={y}
                                                x2={chartConfig.chartWidth - 16}
                                                y2={y}
                                                stroke="#e2e8f0"
                                                strokeDasharray="3 3"
                                                className="dark:stroke-slate-700/80"
                                            />
                                            <text
                                                x={chartConfig.leftPad - 10}
                                                y={y + 4}
                                                textAnchor="end"
                                                fontSize="11"
                                                fontWeight="bold"
                                                fill="#64748b"
                                                className="dark:fill-slate-400 font-mono"
                                            >
                                                {label}
                                            </text>
                                        </g>
                                    );
                                })}

                                {/* 일자별 막대들 (leftPad 이후부터 독립 배치되어 Y축과 겹침 절대 없음) */}
                                {dailyTrends.map((d, idx) => {
                                    const x = chartConfig.leftPad + (idx + 0.5) * chartConfig.itemWidth;
                                    const barWidth = Math.max(22, chartConfig.itemWidth - 18);
                                    const isHovered = hoveredDayPoint?.dateStr === d.dateStr;

                                    const baseY = chartConfig.topPad + chartConfig.plotHeight;
                                    let curY = baseY;

                                    // 필터링 적용된 세그먼트 목록
                                    const activeSegments = selectedChannelFilter
                                        ? d.channelSegments.filter((s) => s.channelName === selectedChannelFilter)
                                        : d.channelSegments;

                                    // 해당 일자의 표시 금액/건수
                                    const displayVal = activeSegments.reduce(
                                        (acc, s) => acc + (chartMetric === 'revenue' ? s.revenue : s.bookings),
                                        0
                                    );

                                    const formattedVal =
                                        chartMetric === 'revenue'
                                            ? displayVal >= 100000
                                                ? `${Math.round(displayVal / 10000)}만`
                                                : `${Math.round(displayVal / 1000)}k`
                                            : `${displayVal}건`;

                                    const badgeWidth = Math.max(28, formattedVal.length * 8.5 + 10);

                                    return (
                                        <g
                                            key={d.dateStr}
                                            className="cursor-pointer transition-all duration-150"
                                            onMouseEnter={() => setHoveredDayPoint(d)}
                                            onMouseLeave={() => setHoveredDayPoint(null)}
                                        >
                                            {/* 배경 호버 하이라이트 열 */}
                                            {isHovered && (
                                                <rect
                                                    x={x - chartConfig.itemWidth / 2}
                                                    y={chartConfig.topPad}
                                                    width={chartConfig.itemWidth}
                                                    height={chartConfig.plotHeight + 40}
                                                    fill="#3b82f6"
                                                    opacity="0.1"
                                                    rx="8"
                                                />
                                            )}

                                            {/* 각 채널 세그먼트 막대 */}
                                            {activeSegments.map((seg) => {
                                                const segVal = chartMetric === 'revenue' ? seg.revenue : seg.bookings;
                                                const segHeight = (segVal / chartConfig.yMax) * chartConfig.plotHeight;
                                                curY -= segHeight;

                                                if (segHeight <= 0) return null;

                                                return (
                                                    <rect
                                                        key={seg.channelName}
                                                        x={x - barWidth / 2}
                                                        y={curY}
                                                        width={barWidth}
                                                        height={segHeight}
                                                        fill={seg.color}
                                                        rx={curY === baseY - segHeight ? 3 : 0}
                                                        className="transition-all duration-150"
                                                        opacity={isHovered ? 1 : 0.9}
                                                    />
                                                );
                                            })}

                                            {/* 막대 상단 수치 표기 (고대비 뱃지 스타일로 가독성 극대화) */}
                                            {displayVal > 0 && (
                                                <g>
                                                    <rect
                                                        x={x - badgeWidth / 2}
                                                        y={curY - 22}
                                                        width={badgeWidth}
                                                        height={18}
                                                        rx="4"
                                                        fill={isHovered ? '#1d4ed8' : '#0f172a'}
                                                        opacity={isHovered ? 0.95 : 0.78}
                                                        className="dark:fill-slate-800 dark:opacity-90"
                                                    />
                                                    <text
                                                        x={x}
                                                        y={curY - 9}
                                                        textAnchor="middle"
                                                        fontSize={isHovered ? '12' : '11'}
                                                        fontWeight="900"
                                                        fontFamily="monospace"
                                                        fill="#ffffff"
                                                        className="select-none tracking-tight"
                                                    >
                                                        {formattedVal}
                                                    </text>
                                                </g>
                                            )}

                                            {/* X축 일자/요일 라벨 (폰트 12px/11px로 시원하게 확대) */}
                                            <g transform={`translate(${x}, ${chartConfig.chartHeight - 32})`}>
                                                <text
                                                    x="0"
                                                    y="0"
                                                    textAnchor="middle"
                                                    fontSize="12"
                                                    fontWeight="bold"
                                                    fontFamily="monospace"
                                                    fill={isHovered ? '#2563eb' : '#334155'}
                                                    className="dark:fill-slate-200"
                                                >
                                                    {d.shortLabel}
                                                </text>
                                                <text
                                                    x="0"
                                                    y="15"
                                                    textAnchor="middle"
                                                    fontSize="11"
                                                    fontWeight="bold"
                                                    fill={d.isWeekend ? '#ef4444' : '#64748b'}
                                                    className={d.isWeekend ? 'font-black' : 'dark:fill-slate-400'}
                                                >
                                                    ({d.dayOfWeek})
                                                </text>
                                            </g>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>

                    {/* 호버된 날짜의 실시간 인스펙터 패널 */}
                    <div className="bg-blue-50/40 dark:bg-slate-800/60 rounded-xl p-3 border border-blue-200/70 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                        {hoveredDayPoint ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-black text-gray-900 dark:text-slate-100">
                                        📅 {hoveredDayPoint.dateStr} ({hoveredDayPoint.dayOfWeek}):
                                    </span>
                                    {selectedChannelFilter ? (
                                        (() => {
                                            const seg = hoveredDayPoint.channelSegments.find(
                                                (s) => s.channelName === selectedChannelFilter
                                            );
                                            return seg ? (
                                                <span className="font-extrabold text-blue-700 dark:text-blue-400">
                                                    {selectedChannelFilter} 매출 ₩{seg.revenue.toLocaleString()} ({seg.bookings}건 / 그날 점유율 {seg.sharePct}%)
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">
                                                    해당 날짜에 {selectedChannelFilter} 예약/매출 없음
                                                </span>
                                            );
                                        })()
                                    ) : (
                                        <span className="font-extrabold text-blue-700 dark:text-blue-400">
                                            총 매출 ₩{hoveredDayPoint.totalRevenue.toLocaleString()} ({hoveredDayPoint.totalBookings}건 예약)
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {hoveredDayPoint.channelSegments.map((seg) => (
                                        <span
                                            key={seg.channelName}
                                            className={`px-2 py-0.5 rounded-md border font-bold flex items-center gap-1.5 ${
                                                selectedChannelFilter === seg.channelName
                                                    ? 'bg-blue-100 dark:bg-blue-900/60 border-blue-400 text-blue-900 dark:text-blue-100 ring-1 ring-blue-400'
                                                    : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700'
                                            }`}
                                        >
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                                            <span>{seg.channelName}:</span>
                                            <span className="font-mono text-gray-900 dark:text-slate-100">
                                                ₩{seg.revenue.toLocaleString()} ({seg.bookings}건)
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-between w-full text-gray-400 dark:text-slate-500 font-medium">
                                <span>💡 상단에서 특정 플랫폼 버튼을 누르면 해당 플랫폼 데이터만 단독으로 추적할 수 있습니다.</span>
                                {activeFilteredChannelMeta && (
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                        {activeFilteredChannelMeta.name} 기간 전체 총액: ₩{activeFilteredChannelMeta.revenue.toLocaleString()} ({activeFilteredChannelMeta.count}건)
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3. 🍩 [전체 도넛 차트 & 상세 테이블 뷰] (오직 'donut' 뷰 모드일 때만 표시!) */}
            {viewMode === 'donut' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    {/* 좌측 도넛 차트 */}
                    <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 bg-gray-50/60 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700">
                        {/* 상단 범례 태그 버튼들 */}
                        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
                            {channelList.map((item, idx) => (
                                <button
                                    key={item.name}
                                    type="button"
                                    onClick={() => setSelectedChannel(item)}
                                    onMouseEnter={() => setHoveredIdx(idx)}
                                    onMouseLeave={() => setHoveredIdx(null)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                                        hoveredIdx === idx
                                            ? 'bg-white dark:bg-slate-900 shadow-2xs border-gray-300 dark:border-slate-600 scale-105 text-gray-900 dark:text-slate-100'
                                            : 'bg-white/70 dark:bg-slate-900/70 border-gray-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-900 text-gray-800 dark:text-slate-200'
                                    }`}
                                    title={`${item.name} 예약 ${item.count}건 확인하기`}
                                >
                                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: item.color }} />
                                    <span className="text-gray-800 dark:text-slate-200">{item.name}</span>
                                    <span className="text-gray-400 dark:text-slate-500 font-medium">({item.percentage}%)</span>
                                </button>
                            ))}
                        </div>

                        {/* SVG 원형 도넛 그래프 */}
                        <div className="relative flex items-center justify-center">
                            <svg
                                width={donutSize}
                                height={donutSize}
                                viewBox={`0 0 ${donutSize} ${donutSize}`}
                                className="transform -rotate-90 select-none"
                                onMouseLeave={() => setHoveredIdx(null)}
                            >
                                {channelList.map((item, idx) => {
                                    const sliceLen = Math.max(0, (item.percentage / 100) * circumference - gapLength);
                                    const strokeDasharray = `${sliceLen} ${circumference - sliceLen}`;
                                    const strokeDashoffset = -((accumulatedPct / 100) * circumference);
                                    accumulatedPct += item.percentage;

                                    const isHovered = hoveredIdx === idx;

                                    return (
                                        <circle
                                            key={item.name}
                                            cx={donutSize / 2}
                                            cy={donutSize / 2}
                                            r={radius}
                                            fill="none"
                                            stroke={item.color}
                                            strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                                            strokeDasharray={strokeDasharray}
                                            strokeDashoffset={strokeDashoffset}
                                            strokeLinecap="butt"
                                            onMouseEnter={() => setHoveredIdx(idx)}
                                            onClick={() => setSelectedChannel(item)}
                                            className="transition-all duration-200 cursor-pointer"
                                            style={{
                                                pointerEvents: 'stroke',
                                                filter: isHovered ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))' : 'none',
                                            }}
                                        />
                                    );
                                })}

                                <circle
                                    cx={donutSize / 2}
                                    cy={donutSize / 2}
                                    r={Math.max(1, radius - strokeWidth / 2)}
                                    fill="transparent"
                                    style={{ pointerEvents: 'all' }}
                                    onMouseEnter={() => setHoveredIdx(null)}
                                />
                            </svg>

                            {/* 도넛 중앙 정보 텍스트 */}
                            <div
                                className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none"
                                style={{ width: donutSize, height: donutSize }}
                            >
                                {hoveredDonutItem ? (
                                    <div className="animate-fadeIn flex flex-col items-center">
                                        <span className="text-xs font-bold text-gray-500 dark:text-slate-400">{hoveredDonutItem.name}</span>
                                        <span className="text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
                                            {hoveredDonutItem.percentage}%
                                        </span>
                                        <span className="text-[11px] font-bold text-gray-600 dark:text-slate-300">
                                            {hoveredDonutItem.count}건 ({hoveredDonutItem.nights}박)
                                        </span>
                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                            ₩{hoveredDonutItem.revenue.toLocaleString()}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <span className="text-[11px] font-medium text-gray-400 dark:text-slate-500">
                                            {channelDateMode === 'booked' ? '유입 예약 총합' : '투숙 예약 총합'}
                                        </span>
                                        <span className="text-2xl font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
                                            {totalBookings}건
                                        </span>
                                        <span className="text-[10.5px] text-gray-500 dark:text-slate-400 font-medium">
                                            플랫폼 점유율
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 우측 플랫폼별 상세 성과 테이블 */}
                    <div className="lg:col-span-7 flex flex-col gap-2">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-300 font-bold border-b border-gray-200 dark:border-slate-700">
                                        <th className="py-2.5 px-3">플랫폼</th>
                                        <th className="py-2.5 px-3 text-center">예약건수 (점유율)</th>
                                        <th className="py-2.5 px-3 text-right">총 매출액 (Gross)</th>
                                        <th className="py-2.5 px-3 text-right">1박 평균단가 (ADR)</th>
                                        <th className="py-2.5 px-2 text-center w-16">상세</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {channelList.map((ch, idx) => (
                                        <tr
                                            key={ch.name}
                                            onClick={() => setSelectedChannel(ch)}
                                            onMouseEnter={() => setHoveredIdx(idx)}
                                            onMouseLeave={() => setHoveredIdx(null)}
                                            className={`transition cursor-pointer group ${
                                                hoveredIdx === idx ? 'bg-blue-50/70 dark:bg-slate-800/70' : 'hover:bg-blue-50/40 dark:hover:bg-slate-800/40'
                                            }`}
                                        >
                                            <td className="py-3 px-3 font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-xs shrink-0" style={{ backgroundColor: ch.color }} />
                                                <span>{ch.name}</span>
                                            </td>
                                            <td className="py-3 px-3 text-center font-bold text-gray-700 dark:text-slate-300">
                                                {ch.count}건 <span className="text-blue-700 dark:text-blue-400 font-bold">({ch.percentage}%)</span>
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-slate-100 font-mono text-sm">
                                                ₩{ch.revenue.toLocaleString()}
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-gray-700 dark:text-slate-300 font-mono text-sm">
                                                ₩{ch.adr.toLocaleString()}
                                            </td>
                                            <td className="py-3 px-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedChannel(ch);
                                                    }}
                                                    className="px-2 py-1 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 text-blue-700 dark:text-blue-400 font-bold text-[11px] rounded-lg border border-gray-200 dark:border-slate-700 shadow-2xs transition"
                                                >
                                                    상세
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. 특정 채널 클릭 시 나타나는 예약 내역 모달 */}
            {selectedChannel && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
                    onClick={() => setSelectedChannel(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-5 md:p-6 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col gap-4 animate-scaleUp"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 모달 헤더 */}
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <span className="w-3.5 h-3.5 rounded-xs" style={{ backgroundColor: selectedChannel.color }} />
                                <h4 className="text-base font-extrabold text-gray-900 dark:text-slate-100">
                                    {selectedChannel.name} 예약 상세 내역
                                </h4>
                                <span className="text-xs font-mono font-bold text-gray-400">
                                    (총 {selectedChannel.count}건 / ₩{selectedChannel.revenue.toLocaleString()})
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedChannel(null)}
                                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-600 dark:text-slate-300 font-bold flex items-center justify-center transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* 모달 예약 목록 */}
                        <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
                            {selectedChannel.bookings.length === 0 ? (
                                <div className="py-12 text-center text-gray-400 dark:text-slate-500 text-xs font-medium">
                                    표시할 예약 내역이 없습니다.
                                </div>
                            ) : (
                                selectedChannel.bookings.map((b) => {
                                    const unit = getUnitForBooking(b);
                                    const unitDisplay = unit
                                        ? `${unit.propName} ${unit.displayName}${unit.subName ? ` (${unit.subName})` : ''}`
                                        : `호실 (${b.roomId})`;

                                    const guestName =
                                        b.firstName || b.lastName
                                            ? `${b.firstName || ''} ${b.lastName || ''}`.trim()
                                            : '예약자명 없음';

                                    const arr = new Date(b.arrival);
                                    const dep = new Date(b.departure);
                                    const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));

                                    const grossPrice = Number(b.price) || 0;
                                    const netPayout = calculateNetPayout(grossPrice, b.apiSourceId);
                                    const bookingDateKST = getBookingDateKST(b.bookingTime, b.arrival);

                                    return (
                                        <div
                                            key={b.id}
                                            className="p-3.5 bg-gray-50/80 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700/80 flex flex-col gap-2.5 transition hover:border-blue-300 dark:hover:border-blue-600/50"
                                        >
                                            {/* 상단: 게스트명 + 예약번호 + 호실 뱃지 + 상태 */}
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-extrabold text-sm text-gray-900 dark:text-slate-100">
                                                        {guestName}
                                                    </span>
                                                    <span className="text-[10px] font-mono font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-sm border border-gray-200 dark:border-slate-700">
                                                        #{b.id}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                                                        {unitDisplay}
                                                    </span>
                                                    {b.status && (
                                                        <span className="text-[9.5px] font-bold uppercase text-gray-600 dark:text-slate-300 bg-gray-200/70 dark:bg-slate-700 px-1.5 py-0.5 rounded-xs">
                                                            {b.status}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* 금액: 결제액 & 실수령액 */}
                                                <div className="flex items-baseline gap-2.5 sm:text-right">
                                                    <div className="flex items-baseline gap-1 text-[11px] text-gray-400 font-mono">
                                                        <span>결제:</span>
                                                        <span>₩{grossPrice.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-baseline gap-1 font-mono">
                                                        <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-bold">정산:</span>
                                                        <span className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                                                            ₩{netPayout.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 상세 정보 줄: 투숙 기간 + 접수일 + 인원 */}
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-slate-300 pt-1 border-t border-gray-100 dark:border-slate-700/60">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-gray-400 text-[11px]">투숙:</span>
                                                    <span className="font-mono font-bold text-gray-900 dark:text-slate-100">
                                                        {b.arrival} ~ {b.departure} ({nights}박)
                                                    </span>
                                                </div>
                                                <span className="text-gray-300 dark:text-slate-600">|</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-gray-400 text-[11px]">접수일:</span>
                                                    <span className="font-mono text-gray-700 dark:text-slate-300">
                                                        {bookingDateKST || '기록 없음'}
                                                    </span>
                                                </div>
                                                {(Number(b.numAdult) > 0 || Number(b.numChild) > 0) && (
                                                    <>
                                                        <span className="text-gray-300 dark:text-slate-600">|</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-gray-400 text-[11px]">인원:</span>
                                                            <span className="font-medium text-gray-700 dark:text-slate-300">
                                                                {Number(b.numAdult) || 0}인{Number(b.numChild) > 0 ? ` (아동 ${b.numChild})` : ''}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* 고객 요청사항 및 메모 */}
                                            {b.notes && (
                                                <p className="text-[11px] text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-lg border border-gray-100 dark:border-slate-700 line-clamp-2">
                                                    📝 {b.notes}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
