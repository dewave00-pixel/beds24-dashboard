'use client';

import React, { useState, useMemo } from 'react';
import { RoomStats } from '../../utils/analyticsCalculations';
import { PROPERTY_GROUPS } from '../../config';

interface RoomRevenueTableProps {
    roomStats: RoomStats[];
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
                            개별 객실(호실)별 매출 및 가동률 성과
                        </h3>
                        <span className="text-[10.5px] text-gray-500 dark:text-slate-400 font-bold hidden sm:inline">
                            호실별 판매 박수, 가동률 바, 평균단가 및 주말/평일 세부 단가 한눈에 비교
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400 hidden sm:inline">
                        총 <strong className="text-gray-900 dark:text-slate-100">{processedRooms.length}</strong>개 객실
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
                                전체 숙소 ({roomStats.length}개 호실)
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
                                    순위 & 호실
                                    {renderSortArrow('room')}
                                </span>
                            </th>

                            {/* 2. 사업장 */}
                            <th className="py-2.5 px-3">사업장</th>

                            {/* 3. 가동률 (Occ) */}
                            <th
                                className="py-2.5 px-3 text-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition"
                                onClick={() => handleSort('occupancy')}
                            >
                                <span className="inline-flex items-center justify-center">
                                    가동률 (Occ)
                                    {renderSortArrow('occupancy')}
                                </span>
                            </th>

                            {/* 4. 공실 / 투숙 */}
                            <th className="py-2.5 px-3 text-center">공실 / 투숙</th>

                            {/* 5. 평균 단가 (ADR) */}
                            <th
                                className="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition"
                                onClick={() => handleSort('adr')}
                            >
                                <span className="inline-flex items-center justify-end">
                                    평균 단가(ADR)
                                    {renderSortArrow('adr')}
                                </span>
                            </th>

                            {/* 6. 주말 단가 */}
                            <th className="py-2.5 px-3 text-right text-purple-700 dark:text-purple-400">
                                주말 단가 (금~토)
                            </th>

                            {/* 7. 평일 단가 */}
                            <th className="py-2.5 px-3 text-right text-blue-700 dark:text-blue-400">
                                평일 단가 (월~목)
                            </th>

                            {/* 8. 총매출액 */}
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

                            return (
                                <tr key={room.unitKey} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition">
                                    {/* 순위 & 호실명 */}
                                    <td className="py-2.5 px-3 font-black text-gray-900 dark:text-slate-100 flex items-center gap-2">
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
                                        <span className="font-extrabold text-sm text-gray-900 dark:text-slate-100">
                                            {room.roomName}
                                        </span>
                                    </td>

                                    {/* 소속 사업장 */}
                                    <td className="py-2.5 px-3 font-bold text-gray-700 dark:text-slate-300">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorInfo.color }} />
                                            <span>{propKOR}</span>
                                        </div>
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

                                    {/* 판매 박수 vs 공실 박수 */}
                                    <td className="py-2.5 px-3 text-center font-bold text-[11.5px]">
                                        <span className={room.vacantNights > 0 ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-gray-400 dark:text-slate-500'}>
                                            {room.vacantNights}박 공실
                                        </span>
                                        <span className="text-gray-300 dark:text-slate-600 mx-1">/</span>
                                        <span className="text-gray-900 dark:text-slate-100 font-bold">{room.totalNights}박 투숙</span>
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
                                    <span className="font-black text-sm text-gray-900 dark:text-slate-100 truncate">
                                        {room.roomName}
                                    </span>
                                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded text-white shrink-0" style={{ backgroundColor: colorInfo.color }}>
                                        {propKOR}
                                    </span>
                                </div>
                                <span className="font-black text-gray-900 dark:text-slate-100 text-sm font-mono shrink-0">
                                    ₩{room.totalRevenue.toLocaleString()}
                                </span>
                            </div>

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

                                <div className="text-[11px] font-bold">
                                    <span className={room.vacantNights > 0 ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-gray-400'}>
                                        {room.vacantNights}공실
                                    </span>
                                    <span className="text-gray-300 dark:text-slate-600 mx-1">/</span>
                                    <span className="text-gray-800 dark:text-slate-200">{room.totalNights}박 투숙</span>
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
        </div>
    );
}
