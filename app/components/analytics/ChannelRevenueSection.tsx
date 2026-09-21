'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Booking } from '../../types';
import {
    ChannelStats,
    DateFilterMode,
    TimeFilterRange,
    calculateChannelStats,
} from '../../utils/analyticsCalculations';
import { getUnitForBooking, getBookingDateKST, calculateNetPayout } from '../../utils/bookingUtils';

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
    const [selectedChannel, setSelectedChannel] = useState<ChannelStats | null>(null);

    // 미래 조회 탭(next30) 선택 시 투숙/체크아웃 기준으로 자동 전환
    useEffect(() => {
        if (timeFilter === 'next30') {
            setChannelDateMode('stay');
        }
    }, [timeFilter]);

    // 선택된 기준(접수일 vs 투숙일)에 맞추어 실시간 계산
    const { channelList, totalBookings, totalRevenue } = useMemo(() => {
        return calculateChannelStats(bookings, timeFilter, customStartDate, customEndDate, channelDateMode);
    }, [bookings, timeFilter, customStartDate, customEndDate, channelDateMode]);

    // 모달이 열려있는 상태에서 탭/필터 변경 시 선택된 채널 통계도 동기화
    useEffect(() => {
        if (selectedChannel) {
            const updated = channelList.find((c) => c.name === selectedChannel.name);
            setSelectedChannel(updated || null);
        }
    }, [channelList]);

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
    const size = 260;
    const strokeWidth = 44;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // 조각 간의 깔끔한 간격(gap): 조각이 2개 이상일 때 2px 간격 분리
    const hasMultiple = channelList.length > 1;
    const gapLength = hasMultiple ? 3 : 0;

    let accumulatedPct = 0;
    const hoveredItem = hoveredIdx !== null ? channelList[hoveredIdx] : null;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-3.5 md:p-5 shadow-xs flex flex-col gap-4">
            {/* 1. 상단 타이틀 & 전용 기준 전환 스위치 */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <div>
                        <h3 className="text-sm md:text-base font-bold text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-2 flex-wrap">
                            <span>Booking Source (플랫폼별 점유율 & 매출)</span>
                            <span className="text-[10.5px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                                {channelDateMode === 'booked' ? '예약 접수일 기준' : '실제 투숙일 기준'}
                            </span>
                        </h3>
                        <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium hidden sm:inline">
                            {channelDateMode === 'booked'
                                ? '선택된 기간 동안 새로 들어온 유입 예약 (Beds24 공식 화면 일치)'
                                : '선택된 기간 동안 실제로 투숙 및 체크아웃된 예약의 실매출 정산'}
                        </span>
                    </div>
                </div>

                {/* 플랫폼 전용 기준 전환 스위치 */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold">
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
            </div>

            {/* 2. 도넛 차트 (좌측) + 플랫폼별 상세 성과 테이블 (우측) 2열 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* 좌측 도넛 차트 */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 bg-gray-50/60 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700">
                    {/* 상단 범례 태그 버튼들 (클릭 시 모달 열림) */}
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
                                        : 'bg-white/70 dark:bg-slate-900/70 border-gray-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-600 text-gray-800 dark:text-slate-200'
                                }`}
                                title={`${item.name} 예약 ${item.count}건 확인하기`}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="text-gray-800 dark:text-slate-200">{item.name}</span>
                                <span className="text-gray-400 dark:text-slate-500 font-medium">({item.percentage}%)</span>
                            </button>
                        ))}
                    </div>

                    {/* SVG 원형 도넛 그래프 (stroke에만 포인터 반응하도록 fill="none" & pointerEvents="stroke" 적용) */}
                    <div className="relative flex items-center justify-center">
                        <svg
                            width={size}
                            height={size}
                            viewBox={`0 0 ${size} ${size}`}
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
                                        cx={size / 2}
                                        cy={size / 2}
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

                            {/* 도넛 가운데 빈 구멍(Hole) 센서: 마우스가 중앙으로 진입하면 hover를 즉시 해제 */}
                            <circle
                                cx={size / 2}
                                cy={size / 2}
                                r={Math.max(1, radius - strokeWidth / 2)}
                                fill="transparent"
                                style={{ pointerEvents: 'all' }}
                                onMouseEnter={() => setHoveredIdx(null)}
                            />
                        </svg>

                        {/* 도넛 중앙 정보 텍스트 (클릭 힌트 제공) */}
                        <div
                            className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none"
                            style={{ width: size, height: size }}
                        >
                            {hoveredItem ? (
                                <div className="animate-fadeIn flex flex-col items-center">
                                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">{hoveredItem.name}</span>
                                    <span className="text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
                                        {hoveredItem.percentage}%
                                    </span>
                                    <span className="text-[11px] font-bold text-gray-600 dark:text-slate-300">
                                        {hoveredItem.count}건 ({hoveredItem.nights}박)
                                    </span>
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                        ₩{hoveredItem.revenue.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded-sm">
                                        클릭하여 예약 보기
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
                                    <span className="text-[9.5px] text-gray-400 dark:text-slate-500 mt-1">
                                        (바를 누르면 목록 확인)
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 우측 플랫폼별 상세 성과 테이블 */}
                <div className="lg:col-span-7 flex flex-col gap-2">
                    {/* PC 테이블 */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-300 font-bold border-b border-gray-200 dark:border-slate-700">
                                    <th className="py-2.5 px-3">플랫폼</th>
                                    <th className="py-2.5 px-3 text-center">예약건수 (점유율)</th>
                                    <th className="py-2.5 px-3 text-right">총 매출액 (Gross)</th>
                                    <th className="py-2.5 px-3 text-right">순매출 (Net)</th>
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
                                            <span
                                                className="w-3 h-3 rounded-xs shrink-0"
                                                style={{ backgroundColor: ch.color }}
                                            />
                                            <span>{ch.name}</span>
                                        </td>
                                        <td className="py-3 px-3 text-center font-bold text-gray-700 dark:text-slate-300">
                                            {ch.count}건 <span className="text-blue-700 dark:text-blue-400 font-bold">({ch.percentage}%)</span>
                                        </td>
                                        <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-slate-100 font-mono text-sm">
                                            ₩{ch.revenue.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400 font-mono text-sm">
                                            ₩{ch.netRevenue.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 text-right font-bold text-purple-700 dark:text-purple-400 font-mono">
                                            ₩{ch.adr.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-2 text-center">
                                            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 group-hover:bg-blue-600 group-hover:text-white px-2 py-0.5 rounded-md transition border border-blue-200 dark:border-blue-800">
                                                보기
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 모바일 카드 */}
                    <div className="grid grid-cols-1 gap-2 md:hidden">
                        {channelList.map((ch, idx) => (
                            <div
                                key={ch.name}
                                onClick={() => setSelectedChannel(ch)}
                                className={`bg-gray-50/90 dark:bg-slate-800/90 rounded-xl border p-3 flex flex-col gap-1.5 shadow-2xs cursor-pointer active:scale-[0.99] transition ${
                                    hoveredIdx === idx ? 'border-blue-400 bg-blue-50/50 dark:bg-slate-700/60' : 'border-gray-200 dark:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="w-3 h-3 rounded-xs shrink-0"
                                            style={{ backgroundColor: ch.color }}
                                        />
                                        <span className="font-bold text-xs text-gray-900 dark:text-slate-100">{ch.name}</span>
                                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">({ch.percentage}%)</span>
                                    </div>
                                    <span className="font-bold text-gray-900 dark:text-slate-100 text-xs font-mono">
                                        ₩{ch.revenue.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 dark:border-slate-700/60 text-[11px]">
                                    <span className="text-gray-500 dark:text-slate-400 font-medium">
                                        {ch.count}건 ({ch.nights}박)
                                    </span>
                                    <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5">
                                        예약 {ch.count}건 보기 →
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. 플랫폼별 상세 예약 목록 모달 */}
            {selectedChannel && (
                <ChannelBookingsModal
                    channel={selectedChannel}
                    dateMode={channelDateMode}
                    onClose={() => setSelectedChannel(null)}
                />
            )}
        </div>
    );
}

// ----------------------------------------------------------------------
// 플랫폼별 예약 목록 팝업 모달 서브 컴포넌트
// ----------------------------------------------------------------------
interface ChannelBookingsModalProps {
    channel: ChannelStats;
    dateMode: DateFilterMode;
    onClose: () => void;
}

function ChannelBookingsModal({ channel, dateMode, onClose }: ChannelBookingsModalProps) {
    // ESC 키로 닫기
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // 예약 목록 정렬: 접수일 기준일 때는 최신 접수순, 투숙일 기준일 때는 체크인 날짜순
    const sortedBookings = useMemo(() => {
        const list = [...(channel.bookings || [])];
        return list.sort((a, b) => {
            if (dateMode === 'booked') {
                const timeA = a.bookingTime || a.arrival || '';
                const timeB = b.bookingTime || b.arrival || '';
                return timeB.localeCompare(timeA);
            }
            return (b.arrival || '').localeCompare(a.arrival || '');
        });
    }, [channel.bookings, dateMode]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            {/* 바깥 배경 클릭 시 닫기 */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* 모달 본체 */}
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden z-10 animate-scaleUp">
                {/* 모달 헤더 */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/70">
                    <div className="flex items-center gap-2.5">
                        <span
                            className="w-3.5 h-3.5 rounded-sm shrink-0 shadow-2xs"
                            style={{ backgroundColor: channel.color }}
                        />
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-base font-bold text-gray-900 dark:text-slate-100">
                                    {channel.name} 예약 목록
                                </h4>
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                                    총 {channel.count}건
                                </span>
                            </div>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                                {dateMode === 'booked' ? '예약 접수일 기준' : '실제 투숙일 기준'} · 총 매출 ₩{channel.revenue.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-200/60 dark:hover:bg-slate-700 transition cursor-pointer text-sm font-bold"
                        title="닫기"
                    >
                        ✕
                    </button>
                </div>

                {/* 모달 본문 (스크롤 리스트) */}
                <div className="p-4 overflow-y-auto flex flex-col gap-3 divide-y divide-gray-100 dark:divide-slate-800">
                    {sortedBookings.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 dark:text-slate-500 text-xs font-medium">
                            표시할 예약 내역이 없습니다.
                        </div>
                    ) : (
                        sortedBookings.map((b) => {
                            const unit = getUnitForBooking(b);
                            const unitDisplay = unit
                                ? `${unit.propName} ${unit.displayName}${unit.subName ? ` (${unit.subName})` : ''}`
                                : `호실 (${b.roomId})`;

                            const guestName =
                                b.firstName || b.lastName
                                    ? `${b.firstName || ''} ${b.lastName || ''}`.trim()
                                    : '성함 미상';

                            const arr = new Date(b.arrival);
                            const dep = new Date(b.departure);
                            const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));

                            const grossPrice = Number(b.price) || 0;
                            const netPayout = calculateNetPayout(grossPrice, b.apiSourceId);
                            const bookingDateKST = getBookingDateKST(b.bookingTime, b.arrival);

                            return (
                                <div
                                    key={b.id}
                                    className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                                                {guestName}
                                            </span>
                                            <span className="text-[11px] font-mono font-medium text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                                                #{b.id}
                                            </span>
                                            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">
                                                {unitDisplay}
                                            </span>
                                            {b.status && (
                                                <span className="text-[10px] font-bold uppercase text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-xs">
                                                    {b.status}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-slate-400 flex-wrap">
                                            <span>
                                                투숙: <strong className="text-gray-900 dark:text-slate-200 font-semibold">{b.arrival}</strong> ~ <strong className="text-gray-900 dark:text-slate-200 font-semibold">{b.departure}</strong> ({nights}박)
                                            </span>
                                            <span className="text-gray-300 dark:text-slate-600">|</span>
                                            <span>
                                                접수일: <strong className="text-gray-900 dark:text-slate-200 font-semibold">{bookingDateKST}</strong>
                                                {b.bookingTime && b.bookingTime.includes('T') && (
                                                    <span className="text-[11px] text-gray-400 dark:text-slate-500 ml-1">
                                                        ({b.bookingTime.split('T')[1]?.slice(0, 5)} UTC)
                                                    </span>
                                                )}
                                            </span>
                                            {(Number(b.numAdult) > 0 || Number(b.numChild) > 0) && (
                                                <>
                                                    <span className="text-gray-300 dark:text-slate-600">|</span>
                                                    <span>
                                                        인원: {Number(b.numAdult) || 0}인
                                                        {Number(b.numChild) > 0 ? ` (아동 ${b.numChild})` : ''}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {b.notes && (
                                            <p className="text-[11px] text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/70 p-2 rounded-lg border border-gray-100 dark:border-slate-700 mt-1 line-clamp-2">
                                                {b.notes}
                                            </p>
                                        )}
                                    </div>

                                    {/* 금액 정보 */}
                                    <div className="text-right sm:shrink-0 flex sm:flex-col items-baseline sm:items-end justify-between border-t sm:border-t-0 pt-1 sm:pt-0 border-gray-100 dark:border-slate-800">
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-xs text-gray-400 dark:text-slate-500">결제액</span>
                                            <span className="text-sm font-extrabold text-gray-900 dark:text-slate-100 font-mono">
                                                ₩{grossPrice.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">실수령</span>
                                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                                                ₩{netPayout.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 모달 푸터 */}
                <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
