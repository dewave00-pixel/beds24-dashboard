'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import {
    ChannelStats,
    DateFilterMode,
    TimeFilterRange,
    calculateChannelStats,
} from '../../utils/analyticsCalculations';

interface ChannelRevenueSectionProps {
    bookings: Booking[];
    timeFilter: TimeFilterRange;
    customStartDate?: string;
    customEndDate?: string;
}

export default function ChannelRevenueSection({
    bookings = [],
    timeFilter,
    customStartDate,
    customEndDate,
}: ChannelRevenueSectionProps) {
    const [channelDateMode, setChannelDateMode] = useState<DateFilterMode>(
        timeFilter === 'next30' ? 'stay' : 'booked'
    );
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    // 미래 조회 탭(next30) 선택 시 투숙/체크아웃 기준으로 자동 전환
    React.useEffect(() => {
        if (timeFilter === 'next30') {
            setChannelDateMode('stay');
        }
    }, [timeFilter]);

    // 🧮 선택된 기준(접수일 vs 투숙일)에 맞추어 실시간 계산
    const { channelList, totalBookings, totalRevenue } = useMemo(() => {
        return calculateChannelStats(bookings, timeFilter, customStartDate, customEndDate, channelDateMode);
    }, [bookings, timeFilter, customStartDate, customEndDate, channelDateMode]);

    if (!channelList || channelList.length === 0 || totalBookings === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center flex flex-col items-center gap-3">
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-black self-center">
                    <button
                        type="button"
                        onClick={() => setChannelDateMode('booked')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            channelDateMode === 'booked'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <span>🛒 예약 접수일 기준</span>
                        <span className="text-[10px] text-blue-600 font-bold hidden sm:inline">(Beds24 공식)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setChannelDateMode('stay')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            channelDateMode === 'stay'
                                ? 'bg-white text-emerald-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <span>🛏️ 실제 투숙일 기준</span>
                        <span className="text-[10px] text-emerald-600 font-bold hidden sm:inline">(운영 정산)</span>
                    </button>
                </div>
                <p className="text-gray-400 font-bold text-xs mt-2">
                    해당 기간에 집계된 플랫폼별 예약 데이터가 없습니다.
                </p>
            </div>
        );
    }

    // 도넛 차트 SVG 파라미터
    const size = 260;
    const strokeWidth = 46;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    let accumulatedPercentage = 0;
    const hoveredItem = hoveredIdx !== null ? channelList[hoveredIdx] : null;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-3.5 md:p-5 shadow-xs flex flex-col gap-4">
            {/* 1. 상단 타이틀 & ⚙️ 전용 기준 전환 스위치 */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🍩</span>
                    <div>
                        <h3 className="text-sm md:text-base font-black text-gray-900 tracking-tight flex items-center gap-1.5 flex-wrap">
                            <span>Booking Source (플랫폼별 점유율 & 매출)</span>
                            <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                {channelDateMode === 'booked' ? '🛒 예약 접수일 기준' : '🛏️ 실제 투숙일 기준'}
                            </span>
                        </h3>
                        <span className="text-[10.5px] text-gray-500 font-bold hidden sm:inline">
                            {channelDateMode === 'booked'
                                ? '💡 Beds24 공식 화면과 동일: 최근 선택 기간 동안 새로 들어온 유입 예약'
                                : '💡 선택된 기간 동안 실제로 숙소에 머문 손님들의 플랫폼별 매출/점유율'}
                        </span>
                    </div>
                </div>

                {/* ⚙️ 플랫폼 전용 기준 전환 스위치 */}
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-black">
                    <button
                        type="button"
                        onClick={() => setChannelDateMode('booked')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            channelDateMode === 'booked'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <span>🛒 예약 접수일 기준</span>
                        <span className="text-[10px] text-blue-600 font-bold hidden sm:inline">(Beds24 공식)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setChannelDateMode('stay')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            channelDateMode === 'stay'
                                ? 'bg-white text-emerald-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <span>🛏️ 실제 투숙일 기준</span>
                        <span className="text-[10px] text-emerald-600 font-bold hidden sm:inline">(운영 정산)</span>
                    </button>
                </div>
            </div>

            {/* 2. 도넛 차트 (좌측) + 플랫폼별 상세 성과 테이블 (우측) 2열 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* 좌측 도넛 차트 (5칸) */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 bg-gray-50/60 rounded-2xl border border-gray-100">
                    {/* 상단 범례 태그 */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
                        {channelList.map((item, idx) => (
                            <button
                                key={item.name}
                                type="button"
                                onMouseEnter={() => setHoveredIdx(idx)}
                                onMouseLeave={() => setHoveredIdx(null)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold transition cursor-pointer ${
                                    hoveredIdx === idx
                                        ? 'bg-white shadow-2xs scale-105'
                                        : 'hover:bg-white/80'
                                }`}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="text-gray-800">{item.name}</span>
                                <span className="text-gray-400 font-normal">({item.percentage}%)</span>
                            </button>
                        ))}
                    </div>

                    {/* SVG 원형 도넛 그래프 */}
                    <div className="relative flex items-center justify-center">
                        <svg
                            width={size}
                            height={size}
                            viewBox={`0 0 ${size} ${size}`}
                            className="transform -rotate-90"
                        >
                            {channelList.map((item, idx) => {
                                const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                                const strokeDashoffset = -((accumulatedPercentage / 100) * circumference);
                                accumulatedPercentage += item.percentage;

                                const isHovered = hoveredIdx === idx;

                                return (
                                    <circle
                                        key={item.name}
                                        cx={size / 2}
                                        cy={size / 2}
                                        r={radius}
                                        fill="transparent"
                                        stroke={item.color}
                                        strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                                        strokeDasharray={strokeDasharray}
                                        strokeDashoffset={strokeDashoffset}
                                        onMouseEnter={() => setHoveredIdx(idx)}
                                        onMouseLeave={() => setHoveredIdx(null)}
                                        className="transition-all duration-300 cursor-pointer"
                                        style={{
                                            filter: isHovered ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' : 'none',
                                        }}
                                    />
                                );
                            })}
                        </svg>

                        {/* 도넛 중앙 정보 텍스트 */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4">
                            {hoveredItem ? (
                                <>
                                    <span className="text-xs font-black text-gray-500">{hoveredItem.name}</span>
                                    <span className="text-xl font-black text-gray-900 leading-tight">
                                        {hoveredItem.percentage}%
                                    </span>
                                    <span className="text-[11px] font-bold text-gray-600">
                                        {hoveredItem.count}건 ({hoveredItem.nights}박)
                                    </span>
                                    <span className="text-xs font-black text-emerald-600 mt-0.5">
                                        ₩{hoveredItem.revenue.toLocaleString()}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="text-[11px] font-bold text-gray-400">
                                        {channelDateMode === 'booked' ? '유입 예약 총합' : '투숙 예약 총합'}
                                    </span>
                                    <span className="text-2xl font-black text-gray-900 leading-tight">
                                        {totalBookings}건
                                    </span>
                                    <span className="text-[10.5px] text-gray-500 font-bold">
                                        플랫폼 점유율
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* 우측 플랫폼별 상세 성과 테이블 (7칸) */}
                <div className="lg:col-span-7 flex flex-col gap-2">
                    {/* PC 테이블 */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                                    <th className="py-2.5 px-3">플랫폼</th>
                                    <th className="py-2.5 px-3 text-center">예약건수 (점유율)</th>
                                    <th className="py-2.5 px-3 text-right">총 매출액 (Gross)</th>
                                    <th className="py-2.5 px-3 text-right">순매출 (Net 80%)</th>
                                    <th className="py-2.5 px-3 text-right">1박 평균단가 (ADR)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {channelList.map((ch) => (
                                    <tr key={ch.name} className="hover:bg-blue-50/40 transition">
                                        <td className="py-3 px-3 font-black text-gray-900 flex items-center gap-2">
                                            <span
                                                className="w-3 h-3 rounded-xs shrink-0"
                                                style={{ backgroundColor: ch.color }}
                                            />
                                            <span>{ch.name}</span>
                                        </td>
                                        <td className="py-3 px-3 text-center font-bold text-gray-700">
                                            {ch.count}건 <span className="text-blue-700 font-black">({ch.percentage}%)</span>
                                        </td>
                                        <td className="py-3 px-3 text-right font-black text-gray-900 font-mono text-sm">
                                            ₩{ch.revenue.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 text-right font-black text-emerald-700 font-mono text-sm">
                                            ₩{ch.netRevenue.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 text-right font-black text-purple-700 font-mono">
                                            ₩{ch.adr.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 모바일 카드 */}
                    <div className="grid grid-cols-1 gap-2 md:hidden">
                        {channelList.map((ch) => (
                            <div
                                key={ch.name}
                                className="bg-gray-50/80 rounded-xl border border-gray-200 p-3 flex flex-col gap-1.5 shadow-2xs"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="w-3 h-3 rounded-xs shrink-0"
                                            style={{ backgroundColor: ch.color }}
                                        />
                                        <span className="font-black text-xs text-gray-900">{ch.name}</span>
                                        <span className="text-xs font-black text-blue-700">({ch.percentage}%)</span>
                                    </div>
                                    <span className="font-black text-gray-900 text-xs font-mono">
                                        ₩{ch.revenue.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 text-[11px]">
                                    <span className="text-gray-500 font-bold">
                                        {ch.count}건 ({ch.nights}박)
                                    </span>
                                    <span className="text-emerald-700 font-bold">
                                        순 ₩{ch.netRevenue.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
