'use client';

import React, { useState } from 'react';
import { TimeSeriesBucket } from '../../utils/trendCalculations';

interface PeriodicBarChartProps {
    weeklyData: TimeSeriesBucket[];
    monthlyData: TimeSeriesBucket[];
    loading?: boolean;
}

type PeriodMode = 'weekly' | 'monthly';
type MetricMode = 'revenue' | 'occupancy';

export default function PeriodicBarChart({
    weeklyData,
    monthlyData,
    loading = false,
}: PeriodicBarChartProps) {
    const [periodMode, setPeriodMode] = useState<PeriodMode>('weekly');
    const [metricMode, setMetricMode] = useState<MetricMode>('revenue');
    const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);

    const activeList = periodMode === 'weekly' ? (weeklyData || []) : (monthlyData || []);

    // 현재 선택된 막대 아이템 (기본값: 가장 최근 아이템)
    const selectedItem = activeList.find((b) => b.key === selectedBucketKey) || activeList[activeList.length - 1];

    // 스케일 계산용 최대값
    const maxRevenue = Math.max(...activeList.map((b) => b.revenue), 100000);
    const maxOccupancy = 100; // 가동률은 100% 기준

    const formatKRW = (num: number) => `₩${Math.round(num / 10000).toLocaleString('ko-KR')}만`;
    const formatKRWFull = (num: number) => `₩${num.toLocaleString('ko-KR')}`;

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-200/80 shadow-xs h-64 animate-pulse" />
        );
    }

    const title = periodMode === 'weekly' ? '주간별 실적 비교 (최근 12주)' : '월별 실적 비교 (최근 12개월)';
    const subTitle = periodMode === 'weekly'
        ? '최근 12주간(약 3개월)의 주차별 변화 추이'
        : '최근 12개월간(1년)의 월별 변화 추이';

    return (
        <div className="bg-white rounded-2xl p-3.5 md:p-5 border border-gray-200/80 shadow-xs flex flex-col gap-4">
            {/* 1. 상단 툴바 (제목 + 지표 선택 + 주기 선택) */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-gray-100">
                <div>
                    <h3 className="text-xs md:text-sm font-black text-gray-900 leading-tight">
                        {title}
                    </h3>
                    <p className="text-[10.5px] text-gray-500 font-medium hidden sm:inline mt-0.5">
                        {subTitle}
                    </p>
                </div>

                {/* 컨트롤 버튼 그룹 (지표 토글 + 주기 토글) */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* 지표 선택 (매출 vs 가동률) */}
                    <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-[11px] font-bold">
                        <button
                            type="button"
                            onClick={() => setMetricMode('revenue')}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                                metricMode === 'revenue'
                                    ? 'bg-white text-gray-900 shadow-2xs font-black'
                                    : 'text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            매출
                        </button>
                        <button
                            type="button"
                            onClick={() => setMetricMode('occupancy')}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                                metricMode === 'occupancy'
                                    ? 'bg-white text-gray-900 shadow-2xs font-black'
                                    : 'text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            가동률
                        </button>
                    </div>

                    {/* 주기 선택 (주간 vs 월간) */}
                    <div className="flex bg-indigo-50/70 p-0.5 rounded-xl border border-indigo-100 text-[11px] font-bold">
                        <button
                            type="button"
                            onClick={() => {
                                setPeriodMode('weekly');
                                setSelectedBucketKey(null);
                            }}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                                periodMode === 'weekly'
                                    ? 'bg-indigo-600 text-white shadow-2xs font-black'
                                    : 'text-indigo-700 hover:text-indigo-900'
                            }`}
                        >
                            주간 (12주)
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPeriodMode('monthly');
                                setSelectedBucketKey(null);
                            }}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                                periodMode === 'monthly'
                                    ? 'bg-indigo-600 text-white shadow-2xs font-black'
                                    : 'text-indigo-700 hover:text-indigo-900'
                            }`}
                        >
                            월간 (12개월)
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. 막대 차트 본문 영역 (모바일: 가로 스크롤 지원) */}
            <div className="overflow-x-auto -mx-1 px-1 py-2">
                <div className="min-w-[640px] lg:min-w-full h-48 flex items-end justify-between gap-2 sm:gap-3.5 pt-6 pb-2">
                    {activeList.map((item) => {
                        const isSelected = selectedItem?.key === item.key;
                        const isCurrent = item.isCurrent;

                        // 높이 백분율 계산
                        const val = metricMode === 'revenue' ? item.revenue : item.occupancyRate;
                        const max = metricMode === 'revenue' ? maxRevenue : maxOccupancy;
                        const heightPercent = Math.max(6, Math.min(100, Math.round((val / max) * 100)));

                        // 스타일 색상 지정
                        let barColor = 'bg-slate-200 hover:bg-slate-300';
                        if (isCurrent) {
                            barColor = 'bg-indigo-500 hover:bg-indigo-600';
                        } else if (isSelected) {
                            barColor = 'bg-blue-400 hover:bg-blue-500';
                        }

                        return (
                            <div
                                key={item.key}
                                onClick={() => setSelectedBucketKey(item.key)}
                                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                            >
                                {/* 막대 상단 수치 라벨 */}
                                <span className={`text-[10px] sm:text-[11px] font-black mb-1.5 transition ${
                                    isSelected || isCurrent ? 'text-indigo-600' : 'text-gray-500 group-hover:text-gray-800'
                                }`}>
                                    {metricMode === 'revenue' ? formatKRW(item.revenue) : `${item.occupancyRate}%`}
                                </span>

                                {/* 세로 막대 바 (Click/Hover 시 피드백) */}
                                <div className="w-full max-w-[56px] bg-gray-100 rounded-t-xl overflow-hidden flex flex-col justify-end h-full">
                                    <div
                                        style={{ height: `${heightPercent}%` }}
                                        className={`w-full rounded-t-xl transition-all duration-500 ${barColor} ${
                                            isSelected ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
                                        }`}
                                    />
                                </div>

                                {/* 막대 하단 날짜/라벨 */}
                                <div className="mt-2 text-center flex flex-col items-center">
                                    <span className={`text-[11px] sm:text-xs font-black leading-tight ${
                                        isCurrent ? 'text-indigo-600' : isSelected ? 'text-gray-900' : 'text-gray-700'
                                    }`}>
                                        {item.label}
                                    </span>
                                    <span className="text-[9.5px] text-gray-500 font-semibold mt-0.5">
                                        {item.subLabel}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 3. 선택된 기간 상세 요약 배너 (터치/클릭 시 동적 반영) */}
            {selectedItem && (
                <div className="bg-gray-50/90 rounded-xl p-3 border border-gray-200/80 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        <span className="text-xs font-black text-gray-800">
                            {selectedItem.label} ({selectedItem.startDate} ~ {selectedItem.endDate})
                        </span>
                        {selectedItem.isCurrent && (
                            <span className="px-1.5 py-0.5 text-[9.5px] font-bold bg-indigo-100 text-indigo-700 rounded-md">
                                진행 중
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 sm:gap-5 text-xs font-black text-gray-700 flex-wrap">
                        <div>
                            <span className="text-[10.5px] text-gray-500 font-semibold mr-1">체크아웃 매출:</span>
                            <span className="text-gray-900">{formatKRWFull(selectedItem.revenue)}</span>
                        </div>
                        <div>
                            <span className="text-[10.5px] text-gray-500 font-semibold mr-1">평균 가동률:</span>
                            <span className="text-indigo-600">{selectedItem.occupancyRate}%</span>
                        </div>
                        <div>
                            <span className="text-[10.5px] text-gray-500 font-semibold mr-1">체크아웃 건수:</span>
                            <span className="text-gray-900">{selectedItem.bookingCount}건</span>
                        </div>
                        <div>
                            <span className="text-[10.5px] text-gray-500 font-semibold mr-1">투숙 박수:</span>
                            <span className="text-gray-900">{selectedItem.stayNights}박</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
