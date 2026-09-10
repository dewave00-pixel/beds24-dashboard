'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Booking } from '../../types';
import { ALL_UNITS, PROPERTY_GROUPS } from '../../config';
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
}

export default function CountryRevenueSection({
    bookings = [],
    timeFilter,
    customStartDate,
    customEndDate,
}: CountryRevenueSectionProps) {
    const [countryDateMode, setCountryDateMode] = useState<DateFilterMode>(
        timeFilter === 'next30' ? 'stay' : 'booked'
    );
    const [selectedUnitKey, setSelectedUnitKey] = useState<string>('all');
    const [selectedCountryCode, setSelectedCountryCode] = useState<string>('');
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    // 미래 조회 탭(next30) 선택 시 투숙/체크아웃 기준으로 자동 전환
    useEffect(() => {
        if (timeFilter === 'next30') {
            setCountryDateMode('stay');
        }
    }, [timeFilter]);

    // 1. 🧮 국적별 전체 통계 계산 (선택된 호실 필터 반영)
    const { countryList, totalBookings, totalRevenue } = useMemo(() => {
        return calculateCountryStats(
            bookings,
            timeFilter,
            customStartDate,
            customEndDate,
            countryDateMode,
            selectedUnitKey
        );
    }, [bookings, timeFilter, customStartDate, customEndDate, countryDateMode, selectedUnitKey]);

    // 2. 초기 1위 국가 자동 선택 (비어있을 때)
    useEffect(() => {
        if (countryList.length > 0 && !selectedCountryCode) {
            setSelectedCountryCode(countryList[0].countryCode);
        } else if (countryList.length > 0 && !countryList.some((c) => c.countryCode === selectedCountryCode)) {
            setSelectedCountryCode(countryList[0].countryCode);
        }
    }, [countryList, selectedCountryCode]);

    // 3. 🏆 선택된 국가 게스트의 인기 호실 랭킹 계산
    const roomPreferences = useMemo(() => {
        if (!selectedCountryCode) return [];
        return calculateCountryRoomPreferences(
            bookings,
            selectedCountryCode,
            timeFilter,
            customStartDate,
            customEndDate,
            countryDateMode
        );
    }, [bookings, selectedCountryCode, timeFilter, customStartDate, customEndDate, countryDateMode]);

    const activeCountryObj = countryList.find((c) => c.countryCode === selectedCountryCode) || countryList[0];

    if (!countryList || countryList.length === 0 || totalBookings === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center flex flex-col items-center gap-3">
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-black self-center">
                    <button
                        type="button"
                        onClick={() => setCountryDateMode('booked')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            countryDateMode === 'booked'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <span>🛒 예약 접수일 기준</span>
                        <span className="text-[10px] text-blue-600 font-bold hidden sm:inline">(신규 유입)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setCountryDateMode('stay')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            countryDateMode === 'stay'
                                ? 'bg-white text-emerald-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <span>🛏️ 실제 투숙(체크아웃) 기준</span>
                        <span className="text-[10px] text-emerald-600 font-bold hidden sm:inline">(정산)</span>
                    </button>
                </div>
                <p className="text-gray-400 font-bold text-xs mt-2">
                    해당 조건에 집계된 게스트 국적 데이터가 없습니다.
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
    const hoveredItem = hoveredIdx !== null ? countryList[hoveredIdx] : null;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-3.5 md:p-5 shadow-xs flex flex-col gap-4">
            {/* 1. 상단 타이틀 & 🏢 호실 필터 & ⚙️ 기준 전환 스위치 */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🌍</span>
                    <div>
                        <h3 className="text-sm md:text-base font-black text-gray-900 tracking-tight flex items-center gap-1.5 flex-wrap">
                            <span>Guest Origin (게스트 국적 & 인기 호실 분석)</span>
                            <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                {countryDateMode === 'booked' ? '🛒 예약 접수일 기준' : '🛏️ 실제 투숙(체크아웃) 기준'}
                            </span>
                        </h3>
                        <span className="text-[10.5px] text-gray-500 font-bold hidden sm:inline">
                            국가별 게스트 비중 및 어떤 호실을 가장 좋아하는지 한눈에 비교
                        </span>
                    </div>
                </div>

                {/* 우측 필터 컨트롤 영역 */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* 🏠 호실 선택 드롭다운 */}
                    <div className="flex items-center gap-1 bg-gray-50 p-1 px-2 rounded-xl border border-gray-200 text-xs">
                        <span className="text-gray-500 font-black hidden sm:inline">호실 필터:</span>
                        <select
                            value={selectedUnitKey}
                            onChange={(e) => setSelectedUnitKey(e.target.value)}
                            aria-label="국적별 비중을 확인할 호실 선택"
                            className="bg-transparent font-black text-xs text-gray-900 border-none outline-none cursor-pointer"
                        >
                            <option value="all">전체 숙소 (14개 호실)</option>
                            {PROPERTY_GROUPS.map((group) => (
                                <optgroup key={group.name} label={`🏢 ${group.name}`}>
                                    {group.units.map((u) => (
                                        <option key={u.key} value={u.key}>
                                            {group.name} - {u.displayName} {u.subName ? `(${u.subName})` : ''}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    {/* ⚙️ 기준 전환 스위치 */}
                    <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-black">
                        <button
                            type="button"
                            onClick={() => setCountryDateMode('booked')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition flex items-center gap-1 cursor-pointer ${
                                countryDateMode === 'booked'
                                    ? 'bg-white text-blue-700 shadow-2xs'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <span>🛒 접수일 기준</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCountryDateMode('stay')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition flex items-center gap-1 cursor-pointer ${
                                countryDateMode === 'stay'
                                    ? 'bg-white text-emerald-700 shadow-2xs'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <span>🛏️ 체크아웃 기준</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. 도넛 차트 (좌측) + 국적별 상세 성과 테이블 (우측) 2열 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* 좌측 도넛 차트 (5칸) */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 bg-gray-50/60 rounded-2xl border border-gray-100">
                    {/* 상단 범례 태그 (클릭 시 하단 인기 호실 랭킹 국가 변경) */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3 max-h-24 overflow-y-auto">
                        {countryList.map((item, idx) => {
                            const isSelected = selectedCountryCode === item.countryCode;
                            return (
                                <button
                                    key={item.countryCode}
                                    type="button"
                                    onClick={() => setSelectedCountryCode(item.countryCode)}
                                    onMouseEnter={() => setHoveredIdx(idx)}
                                    onMouseLeave={() => setHoveredIdx(null)}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold transition cursor-pointer border ${
                                        isSelected
                                            ? 'bg-purple-50 text-purple-900 border-purple-300 shadow-xs scale-105'
                                            : 'bg-white/80 border-transparent hover:bg-white'
                                    }`}
                                >
                                    <span>{item.flag}</span>
                                    <span>{item.countryName}</span>
                                    <span className="text-gray-400 font-normal">({item.percentage}%)</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* SVG 원형 도넛 그래프 */}
                    <div className="relative flex items-center justify-center">
                        <svg
                            width={size}
                            height={size}
                            viewBox={`0 0 ${size} ${size}`}
                            className="transform -rotate-90"
                        >
                            {countryList.map((item, idx) => {
                                const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                                const strokeDashoffset = -((accumulatedPercentage / 100) * circumference);
                                accumulatedPercentage += item.percentage;

                                const isHovered = hoveredIdx === idx;
                                const isSelected = selectedCountryCode === item.countryCode;

                                return (
                                    <circle
                                        key={item.countryCode}
                                        cx={size / 2}
                                        cy={size / 2}
                                        r={radius}
                                        fill="transparent"
                                        stroke={item.color}
                                        strokeWidth={isHovered || isSelected ? strokeWidth + 6 : strokeWidth}
                                        strokeDasharray={strokeDasharray}
                                        strokeDashoffset={strokeDashoffset}
                                        onClick={() => setSelectedCountryCode(item.countryCode)}
                                        onMouseEnter={() => setHoveredIdx(idx)}
                                        onMouseLeave={() => setHoveredIdx(null)}
                                        className="transition-all duration-300 cursor-pointer"
                                        style={{
                                            filter: isHovered || isSelected ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' : 'none',
                                        }}
                                    />
                                );
                            })}
                        </svg>

                        {/* 도넛 중앙 정보 텍스트 */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4">
                            {hoveredItem ? (
                                <>
                                    <span className="text-base">{hoveredItem.flag}</span>
                                    <span className="text-xs font-black text-gray-700">{hoveredItem.countryName}</span>
                                    <span className="text-xl font-black text-gray-900 leading-tight">
                                        {hoveredItem.percentage}%
                                    </span>
                                    <span className="text-[11px] font-bold text-gray-600">
                                        {hoveredItem.count}건 ({hoveredItem.nights}박)
                                    </span>
                                    <span className="text-xs font-black text-purple-700 mt-0.5">
                                        ₩{hoveredItem.revenue.toLocaleString()}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="text-[11px] font-bold text-gray-400">
                                        {countryDateMode === 'booked' ? '유입 국적 총합' : '투숙 국적 총합'}
                                    </span>
                                    <span className="text-2xl font-black text-gray-900 leading-tight">
                                        {totalBookings}건
                                    </span>
                                    <span className="text-[10.5px] text-gray-500 font-bold">
                                        총 {countryList.length}개국 손님
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* 우측 국적별 상세 성과 테이블 (7칸) */}
                <div className="lg:col-span-7 flex flex-col gap-2 max-h-[360px] overflow-y-auto">
                    {/* PC 테이블 */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 sticky top-0 bg-white z-10">
                                    <th className="py-2 px-3">순위 & 국적 (클릭 시 인기호실 조회)</th>
                                    <th className="py-2 px-3 text-center">예약건수 (비중)</th>
                                    <th className="py-2 px-3 text-right">매출액</th>
                                    <th className="py-2 px-3 text-right">1박 단가 (ADR)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {countryList.map((c, idx) => {
                                    const isSelected = selectedCountryCode === c.countryCode;
                                    return (
                                        <tr
                                            key={c.countryCode}
                                            onClick={() => setSelectedCountryCode(c.countryCode)}
                                            className={`cursor-pointer transition ${
                                                isSelected ? 'bg-purple-50/80 font-bold' : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            <td className="py-2 px-3 font-black text-gray-900 flex items-center gap-2">
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                                    idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                                    idx === 1 ? 'bg-slate-200 text-slate-700' :
                                                    idx === 2 ? 'bg-amber-50 text-amber-700' :
                                                    'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {idx + 1}
                                                </span>
                                                <span className="text-base">{c.flag}</span>
                                                <span>{c.countryName}</span>
                                                {isSelected && (
                                                    <span className="text-[10px] text-purple-600 bg-purple-100 px-1.5 py-0.2 rounded-md">
                                                        선택됨
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 text-center font-bold text-gray-700">
                                                {c.count}건 <span className="text-purple-700 font-black">({c.percentage}%)</span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-black text-gray-900 font-mono text-sm">
                                                ₩{c.revenue.toLocaleString()}
                                            </td>
                                            <td className="py-2 px-3 text-right font-black text-purple-700 font-mono">
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
                                            ? 'bg-purple-50/90 border-purple-300 shadow-2xs'
                                            : 'bg-gray-50/80 border-gray-200'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-[10px] font-black flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <span className="text-base">{c.flag}</span>
                                            <span className="font-black text-xs text-gray-900">{c.countryName}</span>
                                            <span className="text-xs font-black text-purple-700">({c.percentage}%)</span>
                                        </div>
                                        <span className="font-black text-gray-900 text-xs font-mono">
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
                <div className="mt-2 p-3.5 md:p-4 bg-gradient-to-br from-purple-50/50 via-white to-blue-50/30 rounded-2xl border border-purple-200/80 shadow-xs flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-purple-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">{activeCountryObj.flag}</span>
                            <div>
                                <h4 className="text-xs md:text-sm font-black text-gray-900 tracking-tight flex items-center gap-1.5 flex-wrap">
                                    <span>{activeCountryObj.countryName} 손님이 가장 많이 예약한 인기 호실 TOP 랭킹</span>
                                    <span className="text-[10px] font-extrabold text-purple-700 bg-white px-2 py-0.5 rounded-full border border-purple-200 shadow-2xs">
                                        총 {activeCountryObj.count}건 (₩{activeCountryObj.revenue.toLocaleString()})
                                    </span>
                                </h4>
                                <span className="text-[10.5px] text-gray-500 font-bold hidden sm:inline">
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
                                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    <span>{c.flag}</span> <span>{c.countryName}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 호실별 선호도 랭킹 그리드 / 테이블 */}
                    {roomPreferences.length === 0 ? (
                        <div className="p-6 text-center text-gray-400 text-xs font-bold">
                            해당 국가 게스트의 호실 예약 데이터가 없습니다.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {roomPreferences.map((room, idx) => (
                                <div
                                    key={room.unitKey}
                                    className="bg-white rounded-xl border border-gray-200/90 p-3 shadow-2xs hover:shadow-xs transition flex flex-col justify-between gap-2"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                                idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                                idx === 1 ? 'bg-slate-200 text-slate-700' :
                                                idx === 2 ? 'bg-amber-50 text-amber-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-500 block leading-tight">
                                                    🏢 {room.propName}
                                                </span>
                                                <span className="font-black text-xs text-gray-900">
                                                    {room.roomName}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                            {room.percentage}%
                                        </span>
                                    </div>

                                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                                        <span className="text-gray-600 font-bold">
                                            {room.count}건 <span className="text-gray-400 font-normal">({room.nights}박)</span>
                                        </span>
                                        <span className="font-black text-gray-900 font-mono text-xs">
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
