'use client';

import React, { useMemo } from 'react';
import { Booking } from '../../types';
import {
    calculateLeadTimeAndStayStats,
    TimeFilterRange,
} from '../../utils/analyticsCalculations';

interface LeadTimeStaySectionProps {
    bookings: Booking[];
    timeFilter?: TimeFilterRange;
    startDate?: string;
    endDate?: string;
    selectedProperty?: string;
    selectedUnitKey?: string;
}

export default function LeadTimeStaySection({
    bookings,
    timeFilter = 'custom',
    startDate,
    endDate,
    selectedProperty = 'all',
    selectedUnitKey = 'all',
}: LeadTimeStaySectionProps) {
    // 1. 리드타임 & 투숙기간 종합 통계 계산
    const stats = useMemo(() => {
        return calculateLeadTimeAndStayStats(
            bookings,
            timeFilter,
            startDate,
            endDate,
            selectedProperty,
            selectedUnitKey
        );
    }, [bookings, timeFilter, startDate, endDate, selectedProperty, selectedUnitKey]);

    // 연박(3박 이상) 비중 계산
    const multiNightShare = useMemo(() => {
        if (!stats.totalBookings) return 0;
        const multiCount = stats.stayDistribution.slice(1).reduce((acc, cur) => acc + cur.count, 0);
        return Math.round((multiCount / stats.totalBookings) * 1000) / 10;
    }, [stats]);

    // 당일/직전(0~1일) 비중
    const lastMinuteShare = stats.leadDistribution[0]?.sharePct || 0;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-4 md:p-6 shadow-xs flex flex-col gap-6 w-full">
            {/* 1. 상단 섹션 헤더 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl">
                        ⏱️
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-extrabold text-gray-900 dark:text-slate-100">
                                예약 리드타임 & 투숙기간 (LOS) 패턴 분석
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                마케팅 & 연박 전략
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            고객이 입실 며칠 전에 예약하는지(리드타임)와 평균 몇 박을 머무는지(LOS)를 파악하여 가격 및 프로모션 시점을 최적화합니다.
                        </p>
                    </div>
                </div>

                <div className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-2">
                    <span>분석 모수: <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-extrabold">{stats.totalBookings}</strong>건의 투숙 예약</span>
                </div>
            </div>

            {/* 2. 4대 핵심 지표 KPI 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* 평균 리드타임 */}
                <div className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">평균 예약 리드타임</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl md:text-3xl font-black text-gray-900 dark:text-slate-100 font-mono">
                            {stats.avgLeadDays}
                        </span>
                        <span className="text-xs font-bold text-gray-500 dark:text-slate-400">일 전</span>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                        중앙값: {stats.medianLeadDays}일 전 예약
                    </span>
                </div>

                {/* 평균 투숙기간 (ALOS) */}
                <div className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">평균 투숙기간 (ALOS)</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">
                            {stats.avgStayNights}
                        </span>
                        <span className="text-xs font-bold text-gray-500 dark:text-slate-400">박</span>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                        총 {stats.stayDistribution.reduce((a, b) => a + (b.label === '1박 (단기)' ? b.count : b.count * 2), 0)}실 투숙
                    </span>
                </div>

                {/* 당일/직전 임박 예약 비중 */}
                <div className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">라스트미닛 (0~1일 전)</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl md:text-3xl font-black text-rose-600 dark:text-rose-400 font-mono">
                            {lastMinuteShare}%
                        </span>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                        당일/직전 급매 유입 비중
                    </span>
                </div>

                {/* 연박(2박 이상) 비중 */}
                <div className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">연박 (2박 이상) 비중</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            {multiNightShare}%
                        </span>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                        청소비 절감 및 운영 효율
                    </span>
                </div>
            </div>

            {/* 3. 좌우 2열 대칭 상세 분포 분석 (리드타임 vs 투숙기간) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {/* 좌측: 📅 예약 리드타임 (Lead Time) 구간 분포 */}
                <div className="bg-gray-50/70 dark:bg-slate-800/40 p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-slate-800 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>📅</span>
                            <span>예약 리드타임 구간 분포</span>
                        </span>
                        <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500">
                            체크인 며칠 전 예약하는가?
                        </span>
                    </div>

                    {/* 누적 가로 게이지 바 */}
                    <div className="h-4 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                        {stats.leadDistribution.map((b) => (
                            <div
                                key={b.label}
                                style={{ width: `${b.sharePct}%`, backgroundColor: b.color }}
                                className="h-full transition-all duration-500 relative group"
                                title={`${b.label}: ${b.count}건 (${b.sharePct}%)`}
                            />
                        ))}
                    </div>

                    {/* 구간별 상세 리스트 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {stats.leadDistribution.map((b) => (
                            <div
                                key={b.label}
                                className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-800 shadow-2xs flex flex-col gap-1"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                                        <span className="text-xs font-bold text-gray-800 dark:text-slate-200">{b.label}</span>
                                    </div>
                                    <span className="text-xs font-black font-mono text-gray-900 dark:text-slate-100">
                                        {b.sharePct}%
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
                                    <span>{b.subLabel}</span>
                                    <span className="font-mono">{b.count}건</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 우측: 🛏️ 투숙기간 (Length of Stay) 구간 분포 */}
                <div className="bg-gray-50/70 dark:bg-slate-800/40 p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-slate-800 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>🛏️</span>
                            <span>투숙기간 (LOS) 박수 분포</span>
                        </span>
                        <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500">
                            한 번에 몇 박을 묵는가?
                        </span>
                    </div>

                    {/* 누적 가로 게이지 바 */}
                    <div className="h-4 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                        {stats.stayDistribution.map((b) => (
                            <div
                                key={b.label}
                                style={{ width: `${b.sharePct}%`, backgroundColor: b.color }}
                                className="h-full transition-all duration-500 relative group"
                                title={`${b.label}: ${b.count}건 (${b.sharePct}%)`}
                            />
                        ))}
                    </div>

                    {/* 구간별 상세 리스트 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {stats.stayDistribution.map((b) => (
                            <div
                                key={b.label}
                                className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-800 shadow-2xs flex flex-col gap-1"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                                        <span className="text-xs font-bold text-gray-800 dark:text-slate-200">{b.label}</span>
                                    </div>
                                    <span className="text-xs font-black font-mono text-gray-900 dark:text-slate-100">
                                        {b.sharePct}%
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
                                    <span>{b.subLabel}</span>
                                    <span className="font-mono">{b.count}건</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. 하단: 🌐 플랫폼(OTA)별 평균 리드타임 & 투숙기간 비교표 */}
            {stats.otaStats.length > 0 && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>🌐</span>
                            <span>플랫폼(OTA)별 리드타임 및 투숙 박수 특성</span>
                        </span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">
                            플랫폼별 예약 패턴 비교
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-300 font-bold border-b border-gray-200 dark:border-slate-700">
                                    <th className="py-2.5 px-3">플랫폼</th>
                                    <th className="py-2.5 px-3 text-right">예약 건수</th>
                                    <th className="py-2.5 px-3 text-right">평균 리드타임 (일)</th>
                                    <th className="py-2.5 px-3 text-right">평균 투숙기간 (박)</th>
                                    <th className="py-2.5 px-3 text-center">예약 성향 분석</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                {stats.otaStats.map((ota) => {
                                    // 채널 특성 한 줄 태그
                                    let traitLabel = '표준 예약형';
                                    let traitColor = 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300';
                                    if (ota.avgLeadDays >= 25) {
                                        traitLabel = '장기 사전 계획 (얼리버드)';
                                        traitColor = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
                                    } else if (ota.avgLeadDays <= 5) {
                                        traitLabel = '임박 번개 예약 (라스트미닛)';
                                        traitColor = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
                                    } else if (ota.avgStayNights >= 3.5) {
                                        traitLabel = '연박/장기 체류 위주';
                                        traitColor = 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
                                    }

                                    return (
                                        <tr key={ota.otaName} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition">
                                            <td className="py-2.5 px-3 font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ota.color }} />
                                                <span>{ota.otaName}</span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-700 dark:text-slate-300">
                                                {ota.bookingCount}건
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-extrabold text-gray-900 dark:text-slate-100">
                                                {ota.avgLeadDays}일 전
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400">
                                                {ota.avgStayNights}박
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${traitColor}`}>
                                                    {traitLabel}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
