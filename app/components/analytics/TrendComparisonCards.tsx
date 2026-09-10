'use client';

import React from 'react';
import { TrendComparisonResult, MetricDelta } from '../../utils/trendCalculations';

interface TrendComparisonCardsProps {
    data: TrendComparisonResult;
    loading?: boolean;
}

interface KpiCardItemProps {
    title: string;
    value: string;
    delta: MetricDelta;
    formatDiff?: (val: number) => string;
    unit?: string;
    isPercentPoint?: boolean;
    label1?: string;
    label2?: string;
}

/**
 * 델타 증감률 뱃지 컴포넌트
 */
function DeltaBadge({
    label,
    diff,
    rate,
    isPercentPoint = false,
}: {
    label: string;
    diff: number;
    rate: number;
    isPercentPoint?: boolean;
}) {
    const isZero = diff === 0;
    const isPositive = diff > 0;

    const bgClass = isZero
        ? 'bg-gray-100 text-gray-600 border-gray-200'
        : isPositive
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';

    const arrow = isZero ? '-' : isPositive ? '▲' : '▼';
    const sign = isPositive ? '+' : '';

    return (
        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10.5px] font-bold border ${bgClass}`}>
            <span className="text-[9.5px] text-gray-500 font-semibold">{label}</span>
            <span>
                {arrow} {sign}{isPercentPoint ? `${rate}%p` : `${rate}%`}
            </span>
        </div>
    );
}

/**
 * 단일 KPI 추이 카드
 */
function KpiCardItem({
    title,
    value,
    delta,
    isPercentPoint = false,
    label1 = '1주전',
    label2 = '2주전',
}: KpiCardItemProps) {
    return (
        <div className="bg-white rounded-2xl p-3.5 md:p-4 border border-gray-200/80 shadow-xs flex flex-col justify-between gap-2.5 transition hover:shadow-sm">
            {/* 카드 상단: 지표명 */}
            <div>
                <span className="text-xs font-black text-gray-600 tracking-tight">{title}</span>
            </div>

            {/* 카드 본문: 현재 실적 수치 */}
            <div>
                <div className="text-lg md:text-xl font-black text-gray-900 tracking-tight">
                    {value}
                </div>
            </div>

            {/* 카드 하단: 직전 & 전전 비교 뱃지 */}
            <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                <DeltaBadge
                    label={label1}
                    diff={delta.diff1W}
                    rate={delta.diffRate1W}
                    isPercentPoint={isPercentPoint}
                />
                <DeltaBadge
                    label={label2}
                    diff={delta.diff2W}
                    rate={delta.diffRate2W}
                    isPercentPoint={isPercentPoint}
                />
            </div>
        </div>
    );
}

/**
 * 실적 추이 비교 KPI 카드 섹션 (동적 기간 대비 위젯)
 */
export default function TrendComparisonCards({ data, loading = false }: TrendComparisonCardsProps) {
    const formatKRW = (num: number) => `₩${num.toLocaleString('ko-KR')}`;
    const days = data?.currentPeriod?.days || 7;

    let label1 = '1주전';
    let label2 = '2주전';
    let title = '최근 실적 추이 비교 (WoW)';
    let subTitle = '(선택 7일 기준 vs 1주 전 vs 2주 전 동기간 비교)';

    if (days === 7) {
        label1 = '1주전';
        label2 = '2주전';
        title = '최근 실적 추이 비교 (WoW)';
        subTitle = '(선택 7일 기준 vs 1주 전 vs 2주 전)';
    } else if (days >= 28 && days <= 31) {
        label1 = '전월';
        label2 = '전전월';
        title = '월간 실적 추이 비교 (MoM)';
        subTitle = `(선택 ${days}일간 vs 전월 vs 전전월 동기간)`;
    } else {
        label1 = `직전 ${days}일`;
        label2 = `전전 ${days}일`;
        title = '동일 기간 실적 추이 비교';
        subTitle = `(선택 ${days}일간 vs 직전 ${days}일 vs 전전 ${days}일)`;
    }

    if (loading) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3.5">
                {[1, 2, 3, 4].map((idx) => (
                    <div key={idx} className="h-28 bg-gray-100 rounded-2xl animate-pulse border border-gray-200" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {/* 섹션 서브 헤더: 비교 구간 안내 */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 px-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-gray-800">
                        {title}
                    </span>
                    <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">
                        {subTitle}
                    </span>
                </div>
                <div className="text-[10.5px] font-bold text-gray-600 bg-gray-100/80 px-2 py-0.5 rounded-md border border-gray-200">
                    기준: {data.currentPeriod.start.slice(5)} ~ {data.currentPeriod.end.slice(5)} ({days}일간)
                </div>
            </div>

            {/* 카드 4개 그리드 (모바일: 2열, PC: 4열) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3.5">
                {/* 1. 매출액 */}
                <KpiCardItem
                    title="총 체크아웃 매출"
                    value={formatKRW(data.revenue.current)}
                    delta={data.revenue}
                    label1={label1}
                    label2={label2}
                />

                {/* 2. 평균 가동률 */}
                <KpiCardItem
                    title="평균 가동률"
                    value={`${data.occupancyRate.current}%`}
                    delta={data.occupancyRate}
                    isPercentPoint={true}
                    label1={label1}
                    label2={label2}
                />

                {/* 3. 체크아웃 건수 */}
                <KpiCardItem
                    title="체크아웃 건수"
                    value={`${data.bookingCount.current}건`}
                    delta={data.bookingCount}
                    label1={label1}
                    label2={label2}
                />

                {/* 4. 평균 객실 단가 (ADR) */}
                <KpiCardItem
                    title="평균 객실 단가 (ADR)"
                    value={formatKRW(data.adr.current)}
                    delta={data.adr}
                    label1={label1}
                    label2={label2}
                />
            </div>
        </div>
    );
}
