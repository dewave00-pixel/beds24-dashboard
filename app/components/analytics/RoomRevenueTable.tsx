'use client';

import React, { useState, useMemo } from 'react';
import { RoomStats } from '../../utils/analyticsCalculations';
import { PROPERTY_GROUPS } from '../../config';

interface RoomRevenueTableProps {
    roomStats: RoomStats[];
}

export default function RoomRevenueTable({ roomStats = [] }: RoomRevenueTableProps) {
    const [selectedProperty, setSelectedProperty] = useState<string>('all');
    const [openAdrUnitKey, setOpenAdrUnitKey] = useState<string | null>(null);

    // 선택된 숙소로 필터링
    const filteredRooms = useMemo(() => {
        if (selectedProperty === 'all') return roomStats;
        return roomStats.filter((r) => r.propName === selectedProperty);
    }, [roomStats, selectedProperty]);

    if (!roomStats || roomStats.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 font-bold text-xs">
                해당 기간에 집계된 객실별 예약 데이터가 없습니다.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-3.5 md:p-5 shadow-xs flex flex-col gap-3">
            {/* 상단 타이틀 & 건물 선택 드롭다운 필터 */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🚪</span>
                    <div>
                        <h3 className="text-sm md:text-base font-black text-gray-900 tracking-tight">
                            개별 객실(호실)별 매출 및 가동률 성과
                        </h3>
                        <span className="text-[10.5px] text-gray-500 font-bold hidden sm:inline">
                            14개 호실별 판매 박수, 공실 현황 및 요일별 3분류(월~목, 금~토, 일) 1박 평균단가(ADR)
                        </span>
                    </div>
                </div>

                {/* 숙소 선택 드롭다운 */}
                <div className="flex items-center gap-1.5 bg-gray-50 p-1 px-2.5 rounded-xl border border-gray-200 text-xs font-bold">
                    <span className="text-gray-500 font-extrabold text-[11px]">🏢 건물 필터:</span>
                    <select
                        value={selectedProperty}
                        onChange={(e) => setSelectedProperty(e.target.value)}
                        aria-label="특정 숙소의 호실만 필터링하여 조회"
                        className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-black text-gray-800 cursor-pointer focus:outline-none focus:border-blue-500 shadow-2xs"
                    >
                        <option value="all">전체 숙소 (14개 호실)</option>
                        {PROPERTY_GROUPS.map((g) => (
                            <option key={g.name} value={g.name}>
                                {g.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 💻 PC 테이블 뷰 (md 이상) */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                            <th className="py-2.5 px-3">순위 & 호실명</th>
                            <th className="py-2.5 px-3">소속 숙소</th>
                            <th className="py-2.5 px-3 text-right">매출액</th>
                            <th className="py-2.5 px-3 text-center">판매 / 공실 박수</th>
                            <th className="py-2.5 px-3 text-center">가동률 (Occ)</th>
                            <th className="py-2.5 px-3 text-right">1박 평균단가 (ADR)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredRooms.map((room, idx) => {
                            const isAdrOpen = openAdrUnitKey === room.unitKey;
                            const d = room.dayTypeAdr;

                            return (
                                <tr key={room.unitKey} className="hover:bg-blue-50/40 transition">
                                    {/* 순위 & 호실명 */}
                                    <td className="py-3 px-3 font-black text-gray-900 flex items-center gap-2">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                            idx === 0
                                                ? 'bg-amber-400 text-slate-900 shadow-2xs'
                                                : idx === 1
                                                ? 'bg-slate-300 text-slate-900'
                                                : idx === 2
                                                ? 'bg-amber-700 text-white'
                                                : 'bg-slate-900 text-white'
                                        }`}>
                                            {idx + 1}
                                        </span>
                                        <span className="text-sm font-black text-blue-900">{room.roomName}</span>
                                    </td>

                                    {/* 소속 숙소 */}
                                    <td className="py-3 px-3 font-bold text-gray-600">
                                        {room.propName}
                                    </td>

                                    {/* 매출액 */}
                                    <td className="py-3 px-3 text-right font-black text-gray-900 font-mono text-sm">
                                        ₩{room.totalRevenue.toLocaleString()}
                                    </td>

                                    {/* 판매 박수 vs 공실 박수 */}
                                    <td className="py-3 px-3 text-center font-bold">
                                        <span className="text-blue-700 font-black">{room.totalNights}박 판매</span>
                                        <span className="text-gray-300 mx-1">/</span>
                                        <span className={room.vacantNights > 0 ? 'text-amber-600 font-extrabold' : 'text-gray-400'}>
                                            {room.vacantNights}박 공실
                                        </span>
                                    </td>

                                    {/* 가동률 */}
                                    <td className="py-3 px-3 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <div className="w-16 bg-gray-100 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={`h-2 rounded-full ${
                                                        room.occupancyRate >= 80
                                                            ? 'bg-emerald-500'
                                                            : room.occupancyRate >= 50
                                                            ? 'bg-blue-500'
                                                            : 'bg-amber-500'
                                                    }`}
                                                    style={{ width: `${Math.min(100, room.occupancyRate)}%` }}
                                                />
                                            </div>
                                            <span className="font-black text-gray-800 text-[11px] w-9 text-right">
                                                {room.occupancyRate}%
                                            </span>
                                        </div>
                                    </td>

                                    {/* 1박 평균단가 (ADR) + 요일별 세분화 팝오버 버튼 */}
                                    <td className="py-3 px-3 text-right relative">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <span className="font-black text-purple-700 font-mono">
                                                ₩{room.adr.toLocaleString()}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setOpenAdrUnitKey(isAdrOpen ? null : room.unitKey)}
                                                title="월~목 / 금~토 / 일요일 세부 단가 보기"
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-black border transition cursor-pointer ${
                                                    isAdrOpen
                                                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                                        : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                                }`}
                                            >
                                                📊 요일별
                                            </button>
                                        </div>

                                        {/* 요일별 3분류 팝오버 말풍선 */}
                                        {isAdrOpen && d && (
                                            <div className="absolute right-3 top-11 z-30 bg-white rounded-xl shadow-xl border border-purple-200 p-3 min-w-[210px] text-left flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                                                <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 text-[11px] font-black text-gray-900">
                                                    <span>🚪 {room.roomName} 요일별 단가</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenAdrUnitKey(null)}
                                                        className="text-gray-400 hover:text-gray-600"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>

                                                <div className="flex flex-col gap-1 text-[11px]">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-600 font-bold flex items-center gap-1">
                                                            <span>💼</span> <span>월~목 (평일):</span>
                                                        </span>
                                                        <span className="font-black text-gray-900 font-mono">
                                                            {d.weekdayAdr > 0 ? `₩${d.weekdayAdr.toLocaleString()}` : '-'}
                                                            <span className="text-gray-400 font-normal text-[10px] ml-1">({d.weekdayNights}박)</span>
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <span className="text-amber-700 font-bold flex items-center gap-1">
                                                            <span>🔥</span> <span>금~토 (주말):</span>
                                                        </span>
                                                        <span className="font-black text-amber-900 font-mono">
                                                            {d.weekendAdr > 0 ? `₩${d.weekendAdr.toLocaleString()}` : '-'}
                                                            <span className="text-gray-400 font-normal text-[10px] ml-1">({d.weekendNights}박)</span>
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <span className="text-blue-700 font-bold flex items-center gap-1">
                                                            <span>🌤️</span> <span>일요일:</span>
                                                        </span>
                                                        <span className="font-black text-blue-900 font-mono">
                                                            {d.sundayAdr > 0 ? `₩${d.sundayAdr.toLocaleString()}` : '-'}
                                                            <span className="text-gray-400 font-normal text-[10px] ml-1">({d.sundayNights}박)</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* 📱 모바일 카드 뷰 (md 미만) */}
            <div className="grid grid-cols-1 gap-2.5 md:hidden">
                {filteredRooms.map((room, idx) => {
                    const isAdrOpen = openAdrUnitKey === room.unitKey;
                    const d = room.dayTypeAdr;

                    return (
                        <div
                            key={room.unitKey}
                            className="bg-gray-50/80 rounded-xl border border-gray-200 p-3 flex flex-col gap-2 shadow-2xs"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                        idx === 0
                                            ? 'bg-amber-400 text-slate-900'
                                            : idx === 1
                                            ? 'bg-slate-300 text-slate-900'
                                            : idx === 2
                                            ? 'bg-amber-700 text-white'
                                            : 'bg-slate-900 text-white'
                                    }`}>
                                        {idx + 1}
                                    </span>
                                    <span className="font-black text-xs text-blue-900">{room.roomName}</span>
                                    <span className="text-[10px] font-bold text-gray-500">({room.propName})</span>
                                </div>
                                <span className="font-black text-gray-900 text-xs font-mono">
                                    ₩{room.totalRevenue.toLocaleString()}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-gray-200/60 text-[11px]">
                                <div>
                                    <span className="text-gray-400 text-[10px] block">가동률</span>
                                    <span className="font-bold text-indigo-700">{room.occupancyRate}%</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 text-[10px] block">판매/공실</span>
                                    <span className="font-bold text-blue-700">{room.totalNights}박</span>
                                    <span className="text-gray-400 text-[10px] ml-1">({room.vacantNights}공실)</span>
                                </div>
                                <div className="text-right relative">
                                    <span className="text-gray-400 text-[10px] block">1박 단가</span>
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="font-black text-purple-700">₩{room.adr.toLocaleString()}</span>
                                        <button
                                            type="button"
                                            onClick={() => setOpenAdrUnitKey(isAdrOpen ? null : room.unitKey)}
                                            className="text-[9px] font-black text-purple-600 bg-purple-50 px-1 py-0.2 rounded border border-purple-200"
                                        >
                                            📊
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 모바일 요일별 단가 펼침 */}
                            {isAdrOpen && d && (
                                <div className="mt-1 p-2 bg-white rounded-lg border border-purple-200 flex flex-col gap-1 text-[10.5px]">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 font-bold">💼 월~목 (평일):</span>
                                        <span className="font-black font-mono">{d.weekdayAdr > 0 ? `₩${d.weekdayAdr.toLocaleString()}` : '-'} ({d.weekdayNights}박)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-amber-700 font-bold">🔥 금~토 (주말):</span>
                                        <span className="font-black font-mono text-amber-900">{d.weekendAdr > 0 ? `₩${d.weekendAdr.toLocaleString()}` : '-'} ({d.weekendNights}박)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-blue-700 font-bold">🌤️ 일요일:</span>
                                        <span className="font-black font-mono text-blue-900">{d.sundayAdr > 0 ? `₩${d.sundayAdr.toLocaleString()}` : '-'} ({d.sundayNights}박)</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
