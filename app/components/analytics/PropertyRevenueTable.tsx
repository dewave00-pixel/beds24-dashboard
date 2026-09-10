'use client';

import React, { useState } from 'react';
import { PropertyStats } from '../../utils/analyticsCalculations';

interface PropertyRevenueTableProps {
    propertyStats: PropertyStats[];
}

export default function PropertyRevenueTable({ propertyStats = [] }: PropertyRevenueTableProps) {
    const [openAdrProp, setOpenAdrProp] = useState<string | null>(null);

    if (!propertyStats || propertyStats.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 font-bold text-xs">
                해당 기간에 집계된 숙소별 예약 데이터가 없습니다.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-3.5 md:p-5 shadow-xs flex flex-col gap-3">
            {/* 상단 타이틀 */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🏢</span>
                    <div>
                        <h3 className="text-sm md:text-base font-black text-gray-900 tracking-tight">
                            건물(숙소)별 매출 및 가동률 성과
                        </h3>
                        <span className="text-[10.5px] text-gray-500 font-bold hidden sm:inline">
                            총 매출액 기준 랭킹 및 요일별 3분류(월~목, 금~토, 일) 1박 평균단가(ADR) 비교
                        </span>
                    </div>
                </div>
                <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    총 {propertyStats.length}개 숙소
                </span>
            </div>

            {/* 💻 PC 테이블 뷰 (md 이상) */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                            <th className="py-2.5 px-3">순위 & 숙소명</th>
                            <th className="py-2.5 px-3 text-center">호실 수</th>
                            <th className="py-2.5 px-3 text-right">매출액</th>
                            <th className="py-2.5 px-3 text-center">매출 비중</th>
                            <th className="py-2.5 px-3 text-center">예약 / 박수</th>
                            <th className="py-2.5 px-3 text-center">가동률 (Occ)</th>
                            <th className="py-2.5 px-3 text-right">1박 평균단가 (ADR)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {propertyStats.map((prop, idx) => {
                            const isAdrOpen = openAdrProp === prop.propName;
                            const d = prop.dayTypeAdr;

                            return (
                                <tr key={prop.propName} className="hover:bg-blue-50/40 transition">
                                    {/* 순위 & 숙소명 */}
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
                                        <span className="text-sm">{prop.propName}</span>
                                    </td>

                                    {/* 호실 수 */}
                                    <td className="py-3 px-3 text-center font-bold text-gray-600">
                                        {prop.roomCount}개
                                    </td>

                                    {/* 매출액 */}
                                    <td className="py-3 px-3 text-right font-black text-gray-900 font-mono text-sm">
                                        ₩{prop.totalRevenue.toLocaleString()}
                                    </td>

                                    {/* 매출 비중 바 */}
                                    <td className="py-3 px-3 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <div className="w-16 bg-gray-100 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="bg-indigo-600 h-2 rounded-full"
                                                    style={{ width: `${Math.min(100, prop.revenueShare)}%` }}
                                                />
                                            </div>
                                            <span className="font-extrabold text-indigo-700 text-[11px] w-9 text-right">
                                                {prop.revenueShare}%
                                            </span>
                                        </div>
                                    </td>

                                    {/* 예약 / 투숙 박수 */}
                                    <td className="py-3 px-3 text-center font-bold text-gray-700">
                                        {prop.totalBookings}건 <span className="text-gray-400">({prop.totalNights}박)</span>
                                    </td>

                                    {/* 가동률 */}
                                    <td className="py-3 px-3 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <div className="w-16 bg-gray-100 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={`h-2 rounded-full ${
                                                        prop.occupancyRate >= 80
                                                            ? 'bg-emerald-500'
                                                            : prop.occupancyRate >= 50
                                                            ? 'bg-blue-500'
                                                            : 'bg-amber-500'
                                                    }`}
                                                    style={{ width: `${Math.min(100, prop.occupancyRate)}%` }}
                                                />
                                            </div>
                                            <span className="font-black text-gray-800 text-[11px] w-9 text-right">
                                                {prop.occupancyRate}%
                                            </span>
                                        </div>
                                    </td>

                                    {/* 1박 평균단가 (ADR) + 요일별 세분화 팝오버 버튼 */}
                                    <td className="py-3 px-3 text-right relative">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <span className="font-black text-purple-700 font-mono">
                                                ₩{prop.adr.toLocaleString()}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setOpenAdrProp(isAdrOpen ? null : prop.propName)}
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
                                            <div className="absolute right-3 top-11 z-30 bg-white rounded-xl shadow-xl border border-purple-200 p-3 min-w-[200px] text-left flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                                                <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 text-[11px] font-black text-gray-900">
                                                    <span>🏢 {prop.propName} 요일별 단가</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenAdrProp(null)}
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
                {propertyStats.map((prop, idx) => {
                    const isAdrOpen = openAdrProp === prop.propName;
                    const d = prop.dayTypeAdr;

                    return (
                        <div
                            key={prop.propName}
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
                                    <span className="font-black text-xs text-gray-900">{prop.propName}</span>
                                    <span className="text-[10px] font-bold text-gray-500">({prop.roomCount}개실)</span>
                                </div>
                                <span className="font-black text-gray-900 text-xs font-mono">
                                    ₩{prop.totalRevenue.toLocaleString()}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-gray-200/60 text-[11px]">
                                <div>
                                    <span className="text-gray-400 text-[10px] block">매출 비중</span>
                                    <span className="font-bold text-indigo-700">{prop.revenueShare}%</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 text-[10px] block">가동률 / 박수</span>
                                    <span className="font-bold text-gray-800">{prop.occupancyRate}% ({prop.totalNights}박)</span>
                                </div>
                                <div className="text-right relative">
                                    <span className="text-gray-400 text-[10px] block">1박 단가</span>
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="font-black text-purple-700">₩{prop.adr.toLocaleString()}</span>
                                        <button
                                            type="button"
                                            onClick={() => setOpenAdrProp(isAdrOpen ? null : prop.propName)}
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
