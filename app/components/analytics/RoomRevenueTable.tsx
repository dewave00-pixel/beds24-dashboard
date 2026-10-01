'use client';

import React, { useState, useMemo } from 'react';
import { RoomStats, RoomChannelStat } from '../../utils/analyticsCalculations';
import { calculateNetPayout } from '../../utils/bookingUtils';
import { PROPERTY_GROUPS } from '../../config';

interface RoomRevenueTableProps {
    roomStats: RoomStats[];
}

interface ChannelDetailModalState {
    roomName: string;
    propName: string;
    channel: RoomChannelStat;
}

type SortField = 'revenue' | 'occupancy' | 'adr' | 'room';
type SortDirection = 'desc' | 'asc';

// 4개 건물 고유 브랜드 컬러 팔레트
const PROPERTY_COLORS: Record<string, { label: string; color: string }> = {
    YEONNAM: { label: '연남', color: '#2563EB' },
    WAVE: { label: '웨이브', color: '#EA580C' },
    Green: { label: '그린', color: '#059669' },
    Namsun: { label: '남선', color: '#7C3AED' },
};

export default function RoomRevenueTable({ roomStats = [] }: RoomRevenueTableProps) {
    const [selectedProperty, setSelectedProperty] = useState<string>('all');
    const [sortField, setSortField] = useState<SortField>('revenue');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
    const [selectedChannelDetail, setSelectedChannelDetail] = useState<ChannelDetailModalState | null>(null);

    // 호실별 플랫폼 아코디언 토글 핸들러
    const toggleExpand = (unitKey: string) => {
        setExpandedRooms((prev) => {
            const next = new Set(prev);
            if (next.has(unitKey)) {
                next.delete(unitKey);
            } else {
                next.add(unitKey);
            }
            return next;
        });
    };

    // 정렬 토글 핸들러
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // 정렬 방향 화살표 렌더링 헬퍼
    const renderSortArrow = (field: SortField) => {
        if (sortField !== field) {
            return <span className="text-gray-300 dark:text-slate-600 ml-1 text-[10px]">↕</span>;
        }
        return (
            <span className="text-blue-600 dark:text-blue-400 font-black ml-1 text-xs">
                {sortDirection === 'desc' ? '▼' : '▲'}
            </span>
        );
    };

    // 필터링 및 정렬된 호실 리스트
    const processedRooms = useMemo(() => {
        // 1. 건물 필터링
        let list = selectedProperty === 'all'
            ? [...roomStats]
            : roomStats.filter((r) => r.propName === selectedProperty);

        // 2. 정렬 로직
        list.sort((a, b) => {
            let diff = 0;
            if (sortField === 'revenue') {
                diff = a.totalRevenue - b.totalRevenue;
            } else if (sortField === 'occupancy') {
                diff = a.occupancyRate - b.occupancyRate;
            } else if (sortField === 'adr') {
                diff = a.adr - b.adr;
            } else if (sortField === 'room') {
                return sortDirection === 'desc'
                    ? b.roomName.localeCompare(a.roomName, 'ko-KR')
                    : a.roomName.localeCompare(b.roomName, 'ko-KR');
            }
            return sortDirection === 'desc' ? -diff : diff;
        });

        return list;
    }, [roomStats, selectedProperty, sortField, sortDirection]);

    if (!roomStats || roomStats.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-8 text-center text-gray-400 dark:text-slate-500 font-bold text-xs">
                해당 기간에 집계된 객실별 예약 데이터가 없습니다.
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-3.5 md:p-5 shadow-xs flex flex-col gap-3">
            {/* 상단 타이틀 & 건물 선택 드롭다운 필터 */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🚪</span>
                    <div>
                        <h3 className="text-sm md:text-base font-black text-gray-900 dark:text-slate-100 tracking-tight">
                            개별 객실(룸타입)별 매출 및 가동률 성과
                        </h3>
                        <span className="text-[10.5px] text-gray-500 dark:text-slate-400 font-bold hidden sm:inline">
                            룸타입별 주요 예약 플랫폼, 가동률, 평균단가 및 주말/평일 세부 단가 한눈에 비교 (호실 클릭 시 플랫폼 상세 분석)
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400 hidden sm:inline">
                        총 <strong className="text-gray-900 dark:text-slate-100">{processedRooms.length}</strong>개 룸타입
                    </span>

                    {/* 숙소 선택 드롭다운 */}
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 p-1 px-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold">
                        <span className="text-gray-500 dark:text-slate-400 font-extrabold text-[11px]">🏢 건물:</span>
                        <select
                            value={selectedProperty}
                            onChange={(e) => setSelectedProperty(e.target.value)}
                            aria-label="특정 숙소의 호실만 필터링하여 조회"
                            className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-black text-gray-800 dark:text-slate-100 cursor-pointer focus:outline-none focus:border-blue-500 shadow-2xs"
                        >
                            <option value="all" className="bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100">
                                전체 숙소 ({roomStats.length}개 룸타입)
                            </option>
                            {PROPERTY_GROUPS.map((g) => (
                                <option key={g.name} value={g.name} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100">
                                    {g.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 💻 PC 테이블 뷰 (md 이상) */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-300 font-bold border-b border-gray-200 dark:border-slate-700 select-none">
                            {/* 1. 순위 & 호실명 */}
                            <th
                                className="py-2.5 px-3 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition"
                                onClick={() => handleSort('room')}
                            >
                                <span className="inline-flex items-center">
                                    순위 & 객실(룸타입)
                                    {renderSortArrow('room')}
                                </span>
                            </th>

                            {/* 2. 사업장 */}
                            <th className="py-2.5 px-3">사업장</th>

                            {/* 3. 주요 플랫폼 (예약 유입) */}
                            <th className="py-2.5 px-3 min-w-[130px]">
                                주요 플랫폼 (유입)
                            </th>

                            {/* 4. 가동률 (Occ) */}
                            <th
                                className="py-2.5 px-3 text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition"
                                onClick={() => handleSort('occupancy')}
                            >
                                <span className="inline-flex items-center justify-center">
                                    가동률 (Occ)
                                    {renderSortArrow('occupancy')}
                                </span>
                            </th>

                            {/* 5. 판매 / 공급 (공실) */}
                            <th className="py-2.5 px-3 text-center">판매 / 공급 (공실)</th>

                            {/* 6. 평균 단가 (ADR) */}
                            <th
                                className="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition"
                                onClick={() => handleSort('adr')}
                            >
                                <span className="inline-flex items-center justify-end">
                                    평균 단가(ADR)
                                    {renderSortArrow('adr')}
                                </span>
                            </th>

                            {/* 7. 주말 단가 */}
                            <th className="py-2.5 px-3 text-right text-purple-700 dark:text-purple-400">
                                주말 단가 (금~토)
                            </th>

                            {/* 8. 평일 단가 */}
                            <th className="py-2.5 px-3 text-right text-blue-700 dark:text-blue-400">
                                평일 단가 (월~목)
                            </th>

                            {/* 9. 총매출액 */}
                            <th
                                className="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition"
                                onClick={() => handleSort('revenue')}
                            >
                                <span className="inline-flex items-center justify-end">
                                    총매출
                                    {renderSortArrow('revenue')}
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {processedRooms.map((room, idx) => {
                            const weekendAdr = room.dayTypeAdr?.weekendAdr || 0;
                            const weekdayAdr = room.dayTypeAdr?.weekdayAdr || 0;
                            const propKOR = room.propName === 'Namsun' ? '남선' : room.propName === 'YEONNAM' ? '연남' : room.propName === 'WAVE' ? '웨이브' : room.propName;
                            const colorInfo = PROPERTY_COLORS[room.propName] || { color: '#64748B' };
                            const isExpanded = expandedRooms.has(room.unitKey);

                            return (
                                <React.Fragment key={room.unitKey}>
                                    <tr
                                        onClick={() => toggleExpand(room.unitKey)}
                                        className={`hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition cursor-pointer ${
                                            isExpanded ? 'bg-blue-50/30 dark:bg-slate-800/40' : ''
                                        }`}
                                    >
                                        {/* 순위 & 호실명 */}
                                        <td className="py-2.5 px-3 font-black text-gray-900 dark:text-slate-100">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                                    idx === 0
                                                        ? 'bg-amber-400 text-slate-900 shadow-2xs font-extrabold'
                                                        : idx === 1
                                                        ? 'bg-slate-300 text-slate-900 font-extrabold'
                                                        : idx === 2
                                                        ? 'bg-amber-700 text-white font-extrabold'
                                                        : 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                                                }`}>
                                                    {idx + 1}
                                                </span>
                                                <span className="text-gray-400 dark:text-slate-500 text-[10px] transition-transform duration-200">
                                                    {isExpanded ? '▼' : '▶'}
                                                </span>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-extrabold text-sm text-gray-900 dark:text-slate-100">
                                                        {room.roomName}
                                                    </span>
                                                    {room.unitCount > 1 && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50">
                                                            {room.unitCount}유닛
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* 소속 사업장 */}
                                        <td className="py-2.5 px-3 font-bold text-gray-700 dark:text-slate-300">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorInfo.color }} />
                                                <span>{propKOR}</span>
                                            </div>
                                        </td>

                                        {/* 주요 플랫폼 (유입) */}
                                        <td className="py-2.5 px-3">
                                            {room.topChannel ? (
                                                <div className="flex flex-col gap-1 min-w-[125px]">
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className="px-1.5 py-0.5 rounded text-[10.5px] font-black text-white shrink-0"
                                                            style={{ backgroundColor: room.topChannel.color }}
                                                        >
                                                            {room.topChannel.displayName}
                                                        </span>
                                                        <span className="font-extrabold text-[11px] text-gray-800 dark:text-slate-200">
                                                            {room.topChannel.share}%
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 dark:text-slate-500">
                                                            ({room.topChannel.count}건)
                                                        </span>
                                                    </div>
                                                    {/* 미니 채널 분포 스택 바 */}
                                                    {room.channels && room.channels.length > 1 && (
                                                        <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden flex">
                                                            {room.channels.map((ch) => (
                                                                <div
                                                                    key={ch.channelName}
                                                                    className="h-full"
                                                                    style={{
                                                                        width: `${ch.share}%`,
                                                                        backgroundColor: ch.color,
                                                                    }}
                                                                    title={`${ch.displayName}: ${ch.count}건 (${ch.share}%)`}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 dark:text-slate-600">-</span>
                                            )}
                                        </td>

                                        {/* 가동률 (Occ) - 프로그레스 바 + 수치% */}
                                        <td className="py-2.5 px-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5 min-w-[120px]">
                                                <div className="w-16 bg-gray-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden shrink-0 border border-gray-200/60 dark:border-slate-700">
                                                    <div
                                                        className={`h-2 rounded-full transition-all duration-300 ${
                                                            room.occupancyRate >= 80
                                                                ? 'bg-emerald-500'
                                                                : room.occupancyRate >= 50
                                                                ? 'bg-blue-500'
                                                                : 'bg-amber-500'
                                                        }`}
                                                        style={{ width: `${Math.min(100, Math.max(0, room.occupancyRate))}%` }}
                                                    />
                                                </div>
                                                <span className="font-black text-gray-800 dark:text-slate-100 text-[11.5px] w-10 text-right font-mono">
                                                    {room.occupancyRate}%
                                                </span>
                                            </div>
                                        </td>

                                        {/* 판매 박수 vs 공급 박수 (공실) */}
                                        <td className="py-2.5 px-3 text-center font-bold text-[11.5px]">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-gray-900 dark:text-slate-100 font-black">{room.totalNights}박</span>
                                                    <span className="text-gray-400 dark:text-slate-500 text-[10.5px]">/ {room.availableNights}박</span>
                                                </div>
                                                <span className={`text-[10px] ${room.vacantNights > 0 ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-bold'}`}>
                                                    {room.vacantNights > 0 ? `${room.vacantNights}박 공실` : '만실'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* 1박 평균단가 (ADR) */}
                                        <td className="py-2.5 px-3 text-right font-extrabold text-gray-900 dark:text-slate-100 font-mono">
                                            ₩{room.adr.toLocaleString()}
                                        </td>

                                        {/* 주말 단가 (풀어서 표시) */}
                                        <td className="py-2.5 px-3 text-right font-bold text-purple-700 dark:text-purple-300 font-mono">
                                            {weekendAdr > 0 ? `₩${weekendAdr.toLocaleString()}` : '-'}
                                        </td>

                                        {/* 평일 단가 (풀어서 표시) */}
                                        <td className="py-2.5 px-3 text-right font-bold text-blue-700 dark:text-blue-300 font-mono">
                                            {weekdayAdr > 0 ? `₩${weekdayAdr.toLocaleString()}` : '-'}
                                        </td>

                                        {/* 총매출액 */}
                                        <td className="py-2.5 px-3 text-right font-black text-gray-900 dark:text-slate-100 font-mono text-sm">
                                            ₩{room.totalRevenue.toLocaleString()}
                                        </td>
                                    </tr>

                                    {/* 🌟 아코디언 서브 패널: 플랫폼별 상세 분석 */}
                                    {isExpanded && (
                                        <tr className="bg-blue-50/25 dark:bg-slate-800/40 border-b border-gray-100 dark:border-slate-800">
                                            <td colSpan={9} className="p-3 md:p-4">
                                                <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-blue-200/80 dark:border-slate-700/80 space-y-3 shadow-2xs">
                                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm">📊</span>
                                                            <span className="font-black text-xs md:text-sm text-gray-900 dark:text-slate-100">
                                                                {room.roomName} 플랫폼별 예약 비중 분석
                                                            </span>
                                                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-bold">
                                                                (총 {room.totalBookings}건 예약 / {room.totalNights}박 투숙)
                                                            </span>
                                                        </div>
                                                        <span className="text-[10.5px] text-gray-400 dark:text-slate-500 font-medium">
                                                            예약 건수 점유율 기준 정렬
                                                        </span>
                                                    </div>

                                                    {!room.channels || room.channels.length === 0 ? (
                                                        <div className="text-xs text-gray-400 dark:text-slate-500 text-center py-3">
                                                            해당 기간에 완료된 예약 데이터가 없습니다.
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                                                            {room.channels.map((ch, chIdx) => (
                                                                <div
                                                                    key={ch.channelName}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedChannelDetail({ roomName: room.roomName, propName: room.propName, channel: ch });
                                                                    }}
                                                                    className="bg-gray-50/90 dark:bg-slate-800/90 rounded-xl p-2.5 border border-gray-200/70 dark:border-slate-700/80 flex flex-col gap-1.5 shadow-2xs hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition cursor-pointer group"
                                                                    title="클릭 시 해당 플랫폼 예약 상세 보기"
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                            <span
                                                                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                                                                style={{ backgroundColor: ch.color }}
                                                                            />
                                                                            <span className="font-black text-xs text-gray-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                                                                                {ch.displayName}
                                                                            </span>
                                                                        </div>
                                                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                                                                            chIdx === 0
                                                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                                                                                : 'bg-gray-200/80 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                                                                        }`}>
                                                                            {chIdx === 0 ? '1위' : `${ch.share}%`}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-200/50 dark:border-slate-700/50">
                                                                        <span className="text-gray-500 dark:text-slate-400 font-medium">예약 건수</span>
                                                                        <span className="font-black text-gray-900 dark:text-slate-100 font-mono">
                                                                            {ch.count}건 ({ch.share}%)
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-[11px]">
                                                                        <span className="text-gray-500 dark:text-slate-400 font-medium">투숙 박수</span>
                                                                        <span className="font-black text-gray-900 dark:text-slate-100 font-mono">
                                                                            {ch.nights}박
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-[11px]">
                                                                        <span className="text-gray-500 dark:text-slate-400 font-medium">정산 매출</span>
                                                                        <span className="font-black text-blue-700 dark:text-blue-300 font-mono text-[10.5px]">
                                                                            ₩{ch.revenue.toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-center pt-1 border-t border-gray-200/40 dark:border-slate-700/40 text-[10px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
                                                                        <span>예약 내역 보기 →</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* 📱 모바일 카드 뷰 (md 미만) */}
            <div className="grid grid-cols-1 gap-2.5 md:hidden">
                {/* 모바일 상단 간이 정렬 탭바 */}
                <div className="flex items-center justify-between text-xs font-bold pb-1 text-gray-600 dark:text-slate-400">
                    <span>정렬 기준:</span>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700 text-[11px]">
                        <button
                            type="button"
                            onClick={() => handleSort('revenue')}
                            className={`px-2 py-0.5 rounded transition ${sortField === 'revenue' ? 'bg-blue-600 text-white font-black' : 'text-gray-700 dark:text-slate-300'}`}
                        >
                            매출 {sortField === 'revenue' && (sortDirection === 'desc' ? '▼' : '▲')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSort('occupancy')}
                            className={`px-2 py-0.5 rounded transition ${sortField === 'occupancy' ? 'bg-blue-600 text-white font-black' : 'text-gray-700 dark:text-slate-300'}`}
                        >
                            가동률 {sortField === 'occupancy' && (sortDirection === 'desc' ? '▼' : '▲')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSort('adr')}
                            className={`px-2 py-0.5 rounded transition ${sortField === 'adr' ? 'bg-blue-600 text-white font-black' : 'text-gray-700 dark:text-slate-300'}`}
                        >
                            단가 {sortField === 'adr' && (sortDirection === 'desc' ? '▼' : '▲')}
                        </button>
                    </div>
                </div>

                {processedRooms.map((room, idx) => {
                    const weekendAdr = room.dayTypeAdr?.weekendAdr || 0;
                    const weekdayAdr = room.dayTypeAdr?.weekdayAdr || 0;
                    const propKOR = room.propName === 'Namsun' ? '남선' : room.propName === 'YEONNAM' ? '연남' : room.propName === 'WAVE' ? '웨이브' : room.propName;
                    const colorInfo = PROPERTY_COLORS[room.propName] || { color: '#64748B' };
                    const isExpanded = expandedRooms.has(room.unitKey);

                    return (
                        <div
                            key={room.unitKey}
                            className="bg-gray-50/80 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700 p-3 flex flex-col gap-2.5 shadow-2xs"
                        >
                            {/* 상단: 순위 + 호실 + 사업장 + 총매출 */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                        idx === 0
                                            ? 'bg-amber-400 text-slate-900'
                                            : idx === 1
                                            ? 'bg-slate-300 text-slate-900'
                                            : idx === 2
                                            ? 'bg-amber-700 text-white'
                                            : 'bg-slate-900 dark:bg-slate-700 text-white'
                                    }`}>
                                        {idx + 1}
                                    </span>
                                    <div className="flex items-center gap-1 min-w-0 truncate">
                                        <span className="font-black text-sm text-gray-900 dark:text-slate-100 truncate">
                                            {room.roomName}
                                        </span>
                                        {room.unitCount > 1 && (
                                            <span className="px-1 py-0.2 rounded text-[9.5px] font-black bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50 shrink-0">
                                                {room.unitCount}유닛
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded text-white shrink-0" style={{ backgroundColor: colorInfo.color }}>
                                        {propKOR}
                                    </span>
                                </div>
                                <span className="font-black text-gray-900 dark:text-slate-100 text-sm font-mono shrink-0">
                                    ₩{room.totalRevenue.toLocaleString()}
                                </span>
                            </div>

                            {/* 주요 플랫폼 요약 및 아코디언 토글 */}
                            <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-200/60 dark:border-slate-700/60 text-xs">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-gray-400 dark:text-slate-500 font-bold text-[10.5px] shrink-0">주요 채널:</span>
                                    {room.topChannel ? (
                                        <div className="flex items-center gap-1 min-w-0">
                                            <span
                                                className="px-1.5 py-0.2 rounded text-[10px] font-black text-white shrink-0"
                                                style={{ backgroundColor: room.topChannel.color }}
                                            >
                                                {room.topChannel.displayName}
                                            </span>
                                            <span className="font-extrabold text-gray-900 dark:text-slate-100 text-[11px]">
                                                {room.topChannel.share}% ({room.topChannel.count}건)
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 text-[11px]">-</span>
                                    )}
                                </div>

                                {room.channels && room.channels.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => toggleExpand(room.unitKey)}
                                        className="text-blue-600 dark:text-blue-400 text-[11px] font-bold shrink-0 hover:underline cursor-pointer flex items-center gap-0.5 ml-2"
                                    >
                                        <span>{isExpanded ? '접기' : '플랫폼별 보기'}</span>
                                        <span>{isExpanded ? '▲' : '▼'}</span>
                                    </button>
                                )}
                            </div>

                            {/* 모바일 플랫폼 상세 아코디언 */}
                            {isExpanded && room.channels && room.channels.length > 0 && (
                                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-900/50 space-y-2">
                                    <div className="flex items-center justify-between text-[11px] font-black text-gray-700 dark:text-slate-300 pb-1 border-b border-gray-100 dark:border-slate-800">
                                        <span>플랫폼별 예약 비중 분석</span>
                                        <span className="text-gray-400 dark:text-slate-500 font-medium">총 {room.totalBookings}건</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {room.channels.map((ch, chIdx) => (
                                            <div
                                                key={ch.channelName}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedChannelDetail({ roomName: room.roomName, propName: room.propName, channel: ch });
                                                }}
                                                className="flex items-center justify-between text-xs py-2 px-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 hover:bg-blue-50/80 dark:hover:bg-slate-800 active:scale-[0.99] border border-transparent hover:border-blue-200 dark:hover:border-slate-700 transition cursor-pointer"
                                                title="클릭 시 해당 플랫폼 예약 상세 보기"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: ch.color }}
                                                    />
                                                    <span className="font-black text-gray-900 dark:text-slate-100">
                                                        {ch.displayName}
                                                    </span>
                                                    {chIdx === 0 && (
                                                        <span className="text-[9px] font-black px-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                                                            1위
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                                                    <span className="font-extrabold text-blue-600 dark:text-blue-400">
                                                        {ch.count}건 ({ch.share}%)
                                                    </span>
                                                    <span className="text-gray-300 dark:text-slate-600">·</span>
                                                    <span className="text-gray-600 dark:text-slate-300">
                                                        {ch.nights}박
                                                    </span>
                                                    <span className="text-gray-300 dark:text-slate-600">·</span>
                                                    <span className="font-black text-gray-900 dark:text-slate-100">
                                                        ₩{ch.revenue.toLocaleString()}
                                                    </span>
                                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold ml-0.5">
                                                        ›
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 중단: 가동률 바 & 공실/투숙 */}
                            <div className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-200/60 dark:border-slate-700/60 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 dark:text-slate-400 font-bold text-[11px]">가동률:</span>
                                    <div className="w-14 bg-gray-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-gray-200/60 dark:border-slate-700">
                                        <div
                                            className={`h-2 rounded-full ${
                                                room.occupancyRate >= 80
                                                    ? 'bg-emerald-500'
                                                    : room.occupancyRate >= 50
                                                    ? 'bg-blue-500'
                                                    : 'bg-amber-500'
                                            }`}
                                            style={{ width: `${Math.min(100, Math.max(0, room.occupancyRate))}%` }}
                                        />
                                    </div>
                                    <span className="font-black text-gray-800 dark:text-slate-200 font-mono text-[11px]">
                                        {room.occupancyRate}%
                                    </span>
                                </div>

                                <div className="text-[11px] font-bold flex items-center gap-1">
                                    <span className="text-gray-900 dark:text-slate-100 font-black">{room.totalNights}박</span>
                                    <span className="text-gray-400 dark:text-slate-500 text-[10px]">/{room.availableNights}박</span>
                                    <span className={`text-[10px] ${room.vacantNights > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-emerald-600 font-bold'}`}>
                                        ({room.vacantNights > 0 ? `${room.vacantNights}공실` : '만실'})
                                    </span>
                                </div>
                            </div>

                            {/* 하단: 단가 3종 그리드 (평균단가, 주말단가, 평일단가) */}
                            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-gray-200/60 dark:border-slate-700/60 text-[11px]">
                                <div className="flex flex-col">
                                    <span className="text-gray-400 dark:text-slate-500 text-[10px]">평균단가(ADR)</span>
                                    <span className="font-black text-gray-900 dark:text-slate-100 font-mono">
                                        ₩{room.adr.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex flex-col text-center">
                                    <span className="text-purple-600 dark:text-purple-400 text-[10px]">주말 (금~토)</span>
                                    <span className="font-black text-purple-700 dark:text-purple-300 font-mono">
                                        {weekendAdr > 0 ? `₩${weekendAdr.toLocaleString()}` : '-'}
                                    </span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-blue-600 dark:text-blue-400 text-[10px]">평일 (월~목)</span>
                                    <span className="font-black text-blue-700 dark:text-blue-300 font-mono">
                                        {weekdayAdr > 0 ? `₩${weekdayAdr.toLocaleString()}` : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 🔍 플랫폼별 예약 상세 모달 */}
            {selectedChannelDetail && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-fadeIn"
                    onClick={() => setSelectedChannelDetail(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-slate-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 모달 헤더 */}
                        <div className="px-4 py-3.5 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0"
                                    style={{ backgroundColor: selectedChannelDetail.channel.color }}
                                />
                                <div>
                                    <h3 className="text-sm md:text-base font-black flex items-center gap-1.5 flex-wrap">
                                        <span>{selectedChannelDetail.roomName}</span>
                                        <span className="text-slate-400 font-medium">·</span>
                                        <span style={{ color: selectedChannelDetail.channel.color }}>
                                            {selectedChannelDetail.channel.displayName}
                                        </span>
                                        <span>예약 상세</span>
                                    </h3>
                                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                        총 {selectedChannelDetail.channel.count}건 ({selectedChannelDetail.channel.share}%) · {selectedChannelDetail.channel.nights}박 투숙 · 정산합계 ₩{selectedChannelDetail.channel.revenue.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedChannelDetail(null)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-black text-sm cursor-pointer shrink-0"
                            >
                                ✕
                            </button>
                        </div>

                        {/* 모달 본문 (예약 카드 리스트) */}
                        <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-gray-50 dark:bg-slate-950 flex flex-col gap-2 min-h-0">
                            {(!selectedChannelDetail.channel.bookings || selectedChannelDetail.channel.bookings.length === 0) ? (
                                <div className="text-center py-12 text-gray-400 dark:text-slate-500 font-bold text-xs bg-white dark:bg-slate-900 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                                    상세 예약 정보가 없습니다.
                                </div>
                            ) : (
                                selectedChannelDetail.channel.bookings.map((b, idx) => {
                                    const netPrice = calculateNetPayout(Number(b.price) || 0, b.apiSourceId);
                                    const arr = new Date(b.arrival);
                                    const dep = new Date(b.departure);
                                    const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
                                    const guestName = [b.firstName, b.lastName].filter(Boolean).join(' ') || '이름 미기재';

                                    return (
                                        <div
                                            key={b.id || idx}
                                            className="bg-white dark:bg-slate-900 rounded-xl p-3 md:p-3.5 border border-gray-200/80 dark:border-slate-800 shadow-2xs flex flex-col gap-1.5"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-xs md:text-sm text-gray-900 dark:text-slate-100">
                                                        {guestName}
                                                    </span>
                                                    <span className="text-[10.5px] font-mono text-gray-400 dark:text-slate-500">
                                                        #{b.id}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono">
                                                        ₩{netPrice.toLocaleString()}
                                                    </span>
                                                    {b.status && (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                                            b.status === 'confirmed' || b.status === 'new'
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                                : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300'
                                                        }`}>
                                                            {b.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center justify-between text-[11.5px] text-gray-600 dark:text-slate-400 pt-1 border-t border-gray-100 dark:border-slate-800">
                                                <div className="flex items-center gap-1.5 font-mono">
                                                    <span>📅 {b.arrival} ~ {b.departure}</span>
                                                    <span className="font-bold text-gray-900 dark:text-slate-200">({nights}박)</span>
                                                </div>
                                                <div className="text-[11px] text-gray-400 dark:text-slate-500">
                                                    1박당 약 ₩{Math.round(netPrice / nights).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* 모달 푸터 */}
                        <div className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex items-center justify-end shrink-0">
                            <button
                                type="button"
                                onClick={() => setSelectedChannelDetail(null)}
                                className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 font-black text-xs rounded-xl transition cursor-pointer"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
