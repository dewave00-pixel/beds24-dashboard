'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Booking } from '../../types';
import {
    CountryStats,
    CountryRoomPreference,
    DateFilterMode,
    TimeFilterRange,
    calculateCountryStats,
    calculateCountryRoomPreferences,
} from '../../utils/analyticsCalculations';

interface CountryRevenueSectionProps {
    bookings: Booking[];
    timeFilter: TimeFilterRange;
    customStartDate?: string;
    customEndDate?: string;
    selectedProperty?: string;
    selectedUnitKey?: string;
}

export default function CountryRevenueSection({
    bookings = [],
    timeFilter,
    customStartDate,
    customEndDate,
    selectedProperty = 'all',
    selectedUnitKey = 'all',
}: CountryRevenueSectionProps) {
    const [countryDateMode, setCountryDateMode] = useState<DateFilterMode>(
        timeFilter === 'next30' ? 'stay' : 'booked'
    );
    const [selectedCountryCode, setSelectedCountryCode] = useState<string>('');
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    // 미래 조회 탭(next30) 선택 시 투숙/체크아웃 기준으로 자동 전환
    useEffect(() => {
        if (timeFilter === 'next30') {
            setCountryDateMode('stay');
        }
    }, [timeFilter]);

    // 1. 🧮 국적별 전체 통계 계산 (마스터바 지점 및 선택된 호실 필터 반영)
    const { countryList, totalBookings, totalRevenue } = useMemo(() => {
        return calculateCountryStats(
            bookings,
            timeFilter,
            customStartDate,
            customEndDate,
            countryDateMode,
            selectedUnitKey,
            selectedProperty !== 'all' ? selectedProperty : undefined
        );
    }, [bookings, timeFilter, customStartDate, customEndDate, countryDateMode, selectedUnitKey, selectedProperty]);

    // 2. 초기 1위 국가 자동 선택 (비어있을 때)
    useEffect(() => {
        if (countryList.length > 0 && !selectedCountryCode) {
            setSelectedCountryCode(countryList[0].countryCode);
        } else if (countryList.length > 0 && !countryList.some((c) => c.countryCode === selectedCountryCode)) {
            setSelectedCountryCode(countryList[0].countryCode);
        }
    }, [countryList, selectedCountryCode]);

    // 3. 🏆 선택된 국가 게스트의 인기 호실 랭킹 계산 (마스터바 지점 및 호실 필터 반영)
    const roomPreferences = useMemo(() => {
        if (!selectedCountryCode) return [];
        return calculateCountryRoomPreferences(
            bookings,
            selectedCountryCode,
            timeFilter,
            customStartDate,
            customEndDate,
            countryDateMode,
            selectedProperty !== 'all' ? selectedProperty : undefined,
            selectedUnitKey
        );
    }, [bookings, selectedCountryCode, timeFilter, customStartDate, customEndDate, countryDateMode, selectedProperty, selectedUnitKey]);

    const activeCountryObj = countryList.find((c) => c.countryCode === selectedCountryCode) || countryList[0];

    if (!countryList || countryList.length === 0 || totalBookings === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-8 text-center flex flex-col items-center gap-3">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-black self-center">
                    <button
                        type="button"
                        onClick={() => setCountryDateMode('booked')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            countryDateMode === 'booked'
                                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <span>🛒 예약 접수일 기준</span>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hidden sm:inline">(신규 유입)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setCountryDateMode('stay')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            countryDateMode === 'stay'
                                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <span>🛏️ 실제 투숙(체크아웃) 기준</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hidden sm:inline">(정산)</span>
                    </button>
                </div>
                <p className="text-gray-400 dark:text-slate-500 font-bold text-xs mt-2">
                    해당 조건에 집계된 게스트 국적 데이터가 없습니다.
                </p>
            </div>
        );
    }

    // 도넛 차트 SVG 파라미터 (스크롤 없이 뷰포트에 쏙 들어오는 컴팩트 규격)
    const donutSize = 220;
    const strokeWidth = 32;
    const radius = (donutSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const gapLength = countryList.length > 1 ? 2 : 0;

    // 각 국적별 도넛 조각의 시작 offset 사전 계산 (누적 오차 및 포커스 어긋남 완전 방지)
    const slices = useMemo(() => {
        let acc = 0;
        return countryList.map((item, idx) => {
            const sliceLen = Math.max(0, (item.percentage / 100) * circumference - gapLength);
            const offset = -((acc / 100) * circumference);
            acc += item.percentage;
            return {
                ...item,
                idx,
                sliceLen,
                offset,
            };
        });
    }, [countryList, circumference, gapLength]);

    const hoveredItem = hoveredIdx !== null ? countryList[hoveredIdx] : null;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-3.5 md:p-5 shadow-xs flex flex-col gap-4">
            {/* 1. 상단 타이틀 & ⚙️ 기준 전환 스위치 (호실 필터는 상단 마스터바와 일원화) */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🌍</span>
                    <div>
                        <h3 className="text-sm md:text-base font-black text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-1.5 flex-wrap">
                            <span>Guest Origin (게스트 국적 & 인기 호실 분석)</span>
                            {selectedProperty && selectedProperty !== 'all' && (
                                <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                                    🏢 {selectedProperty}
                                </span>
                            )}
                            <span className="text-[10px] font-black text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                                {countryDateMode === 'booked' ? '🛒 예약 접수일 기준' : '🛏️ 실제 투숙(체크아웃) 기준'}
                            </span>
                        </h3>
                        <span className="text-[10.5px] text-gray-500 dark:text-slate-400 font-bold hidden sm:inline">
                            국가별 게스트 비중 및 어떤 호실을 가장 좋아하는지 한눈에 비교
                        </span>
                    </div>
                </div>

                {/* 우측 기준 전환 스위치 */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-black">
                    <button
                        type="button"
                        onClick={() => setCountryDateMode('booked')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition flex items-center gap-1 cursor-pointer ${
                            countryDateMode === 'booked'
                                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <span>🛒 접수일 기준</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setCountryDateMode('stay')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition flex items-center gap-1 cursor-pointer ${
                            countryDateMode === 'stay'
                                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <span>🛏️ 체크아웃 기준</span>
                    </button>
                </div>
            </div>

            {/* 2. 도넛 차트 (좌측) + 국적별 상세 성과 테이블 (우측) 2열 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* 좌측 도넛 차트 (5칸) */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 bg-gray-50/60 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700">
                    {/* 상단 범례 태그 (스크롤 없이 감싸지도록 flex-wrap 지원) */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2.5">
                        {countryList.map((item, idx) => {
                            const isSelected = selectedCountryCode === item.countryCode;
                            const isHovered = hoveredIdx === idx;
                            return (
                                <button
                                    key={item.countryCode}
                                    type="button"
                                    onClick={() => setSelectedCountryCode(item.countryCode)}
                                    onMouseEnter={() => setHoveredIdx(idx)}
                                    onMouseLeave={() => setHoveredIdx(null)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                                        isHovered || isSelected
                                            ? 'bg-white dark:bg-slate-900 shadow-2xs border-purple-400 dark:border-purple-600 scale-105 text-purple-900 dark:text-purple-200 font-extrabold'
                                            : 'bg-white/80 dark:bg-slate-900/80 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900'
                                    }`}
                                >
                                    <span>{item.flag}</span>
                                    <span>{item.countryName}</span>
                                    <span className="text-gray-400 dark:text-slate-500 font-medium">({item.percentage}%)</span>
                                </button>
                            );
                        })}
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
                            {slices.map((item) => {
                                const strokeDasharray = `${item.sliceLen} ${circumference - item.sliceLen}`;
                                const isHovered = hoveredIdx === item.idx;
                                const isSelected = selectedCountryCode === item.countryCode;

                                return (
                                    <circle
                                        key={item.countryCode}
                                        cx={donutSize / 2}
                                        cy={donutSize / 2}
                                        r={radius}
                                        fill="none"
                                        stroke={item.color}
                                        strokeWidth={isHovered || isSelected ? strokeWidth + 6 : strokeWidth}
                                        strokeDasharray={strokeDasharray}
                                        strokeDashoffset={item.offset}
                                        strokeLinecap="butt"
                                        onClick={() => setSelectedCountryCode(item.countryCode)}
                                        onMouseEnter={() => setHoveredIdx(item.idx)}
                                        className="transition-all duration-200 cursor-pointer"
                                        style={{
                                            pointerEvents: 'stroke',
                                            filter: isHovered || isSelected ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))' : 'none',
                                        }}
                                    />
                                );
                            })}

                            {/* 도넛 중앙 빈 공간 (마우스 진입 시 슬라이스 호버 해제) */}
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
                            {hoveredItem ? (
                                <div className="animate-fadeIn flex flex-col items-center">
                                    <span className="text-xl">{hoveredItem.flag}</span>
                                    <span className="text-xs font-black text-gray-500 dark:text-slate-400 mt-0.5">{hoveredItem.countryName}</span>
                                    <span className="text-2xl font-black text-gray-900 dark:text-slate-100 leading-tight">
                                        {hoveredItem.percentage}%
                                    </span>
                                    <span className="text-[11px] font-bold text-gray-600 dark:text-slate-300">
                                        {hoveredItem.count}건 ({hoveredItem.nights}박)
                                    </span>
                                    <span className="text-xs font-black text-purple-700 dark:text-purple-400 mt-0.5 font-mono">
                                        ₩{hoveredItem.revenue.toLocaleString()}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500">
                                        {countryDateMode === 'booked' ? '유입 예약' : '투숙 예약'}
                                    </span>
                                    <span className="text-2xl font-black text-gray-900 dark:text-slate-100 leading-tight">
                                        {totalBookings}건
                                    </span>
                                    <span className="text-[10.5px] text-gray-500 dark:text-slate-400 font-bold">
                                        총 {countryList.length}개국 손님
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 우측 국적별 상세 랭킹 테이블 (7칸) */}
                <div className="lg:col-span-7 flex flex-col gap-2">
                    {/* PC 테이블 */}
                    <div className="hidden md:block overflow-x-auto max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-300 font-bold border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                                    <th className="py-2 px-3">순위 & 국적 (클릭 시 인기호실 조회)</th>
                                    <th className="py-2 px-3 text-center">예약건수 (비중)</th>
                                    <th className="py-2 px-3 text-right">매출액</th>
                                    <th className="py-2 px-3 text-right">1박 단가 (ADR)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                {countryList.map((c, idx) => {
                                    const isSelected = selectedCountryCode === c.countryCode;
                                    return (
                                        <tr
                                            key={c.countryCode}
                                            onClick={() => setSelectedCountryCode(c.countryCode)}
                                            className={`cursor-pointer transition ${
                                                isSelected ? 'bg-purple-50/80 dark:bg-purple-950/40 font-bold' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                                            }`}
                                        >
                                            <td className="py-2 px-3 font-black text-gray-900 dark:text-slate-100 flex items-center gap-2">
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                                    idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                                    idx === 1 ? 'bg-slate-200 text-slate-700' :
                                                    idx === 2 ? 'bg-amber-50 text-amber-700' :
                                                    'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                                                }`}>
                                                    {idx + 1}
                                                </span>
                                                <span className="text-base">{c.flag}</span>
                                                <span>{c.countryName}</span>
                                                {isSelected && (
                                                    <span className="text-[10px] text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.2 rounded-md">
                                                        선택됨
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 text-center font-bold text-gray-700 dark:text-slate-300">
                                                {c.count}건 <span className="text-purple-700 dark:text-purple-400 font-black">({c.percentage}%)</span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-black text-gray-900 dark:text-slate-100 font-mono text-sm">
                                                ₩{c.revenue.toLocaleString()}
                                            </td>
                                            <td className="py-2 px-3 text-right font-black text-purple-700 dark:text-purple-400 font-mono">
                                                ₩{c.adr.toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* 모바일 카드 */}
                    <div className="grid grid-cols-1 gap-2 md:hidden">
                        {countryList.map((c, idx) => {
                            const isSelected = selectedCountryCode === c.countryCode;
                            return (
                                <button
                                    key={c.countryCode}
                                    type="button"
                                    onClick={() => setSelectedCountryCode(c.countryCode)}
                                    className={`w-full text-left rounded-xl border p-2.5 flex flex-col gap-1.5 transition ${
                                        isSelected
                                            ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 shadow-2xs'
                                            : 'bg-gray-50/80 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-[10px] font-black flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <span className="text-base">{c.flag}</span>
                                            <span className="font-black text-xs text-gray-900 dark:text-slate-100">{c.countryName}</span>
                                            <span className="text-xs font-black text-purple-700 dark:text-purple-400">({c.percentage}%)</span>
                                        </div>
                                        <span className="font-black text-gray-900 dark:text-slate-100 text-xs font-mono">
                                            ₩{c.revenue.toLocaleString()}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 3. 🏆 [선택된 국가 게스트의 인기 호실 TOP 랭킹 상세 카드] */}
            {activeCountryObj && (
                <div className="mt-2 p-3.5 md:p-4 bg-gradient-to-br from-purple-50/50 via-white to-blue-50/30 dark:from-purple-950/30 dark:via-slate-900 dark:to-blue-950/20 rounded-2xl border border-purple-200/80 dark:border-purple-900/40 shadow-xs flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-purple-100 dark:border-purple-900/40">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">{activeCountryObj.flag}</span>
                            <div>
                                <h4 className="text-xs md:text-sm font-black text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-1.5 flex-wrap">
                                    <span>{activeCountryObj.countryName} 손님이 가장 많이 예약한 인기 호실 TOP 랭킹</span>
                                    <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800 shadow-2xs">
                                        총 {activeCountryObj.count}건 (₩{activeCountryObj.revenue.toLocaleString()})
                                    </span>
                                </h4>
                                <span className="text-[10.5px] text-gray-500 dark:text-slate-400 font-bold hidden sm:inline">
                                    {activeCountryObj.countryName} 게스트들이 어떤 방 타입(호실)을 주로 선호하는지 확인하세요.
                                </span>
                            </div>
                        </div>

                        {/* 국가 빠른 변경 뱃지 목록 */}
                        <div className="flex items-center gap-1 overflow-x-auto max-w-full py-0.5">
                            {countryList.slice(0, 6).map((c) => (
                                <button
                                    key={c.countryCode}
                                    type="button"
                                    onClick={() => setSelectedCountryCode(c.countryCode)}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition cursor-pointer border whitespace-nowrap ${
                                        selectedCountryCode === c.countryCode
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                            : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <span>{c.flag}</span> <span>{c.countryName}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 호실별 선호도 랭킹 그리드 / 테이블 */}
                    {roomPreferences.length === 0 ? (
                        <div className="p-6 text-center text-gray-400 dark:text-slate-500 text-xs font-bold">
                            해당 국가 게스트의 호실 예약 데이터가 없습니다.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {roomPreferences.map((room, idx) => (
                                <div
                                    key={room.unitKey}
                                    className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200/90 dark:border-slate-700/80 p-3 shadow-2xs hover:shadow-xs transition flex flex-col justify-between gap-2"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                                idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                                idx === 1 ? 'bg-slate-200 text-slate-700' :
                                                idx === 2 ? 'bg-amber-50 text-amber-700' :
                                                'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                                            }`}>
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 block leading-tight">
                                                    🏢 {room.propName}
                                                </span>
                                                <span className="font-black text-xs text-gray-900 dark:text-slate-100">
                                                    {room.roomName}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-black text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                                            {room.percentage}%
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100 dark:border-slate-800/80 mt-1">
                                        <span className="font-bold text-gray-700 dark:text-slate-300">
                                            {room.count}건 <span className="text-gray-400 dark:text-slate-500 font-normal">({room.nights}박)</span>
                                        </span>
                                        <span className="font-black text-gray-900 dark:text-slate-100 font-mono text-xs">
                                            ₩{room.revenue.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
