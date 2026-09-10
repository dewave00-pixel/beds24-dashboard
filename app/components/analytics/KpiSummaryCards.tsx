'use client';

import React from 'react';
import { OverallSummary } from '../../utils/analyticsCalculations';

interface KpiSummaryCardsProps {
    summary: OverallSummary;
}

export default function KpiSummaryCards({ summary }: KpiSummaryCardsProps) {
    const {
        totalRevenue,
        netRevenue,
        occupancyRate,
        adr,
        totalBookings,
        totalNights,
        periodDays,
    } = summary;

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3.5">
            {/* 1. 총 매출 카드 */}
            <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-500">💰 총 정산 매출액</span>
                    <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {periodDays}일간
                    </span>
                </div>
                <div className="my-2">
                    <div className="text-lg md:text-2xl font-black text-gray-900 font-mono tracking-tight">
                        ₩{totalRevenue.toLocaleString()}
                    </div>
                </div>
                <div className="text-[10px] text-gray-400 font-medium pt-1.5 border-t border-gray-100">
                    체크아웃 완료 예약 기준 정산 총액
                </div>
            </div>

            {/* 2. 평균 가동률 (예약률) 카드 */}
            <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-500">📈 평균 가동률 (Occ)</span>
                    <span className="text-[10.5px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        객실 점유율
                    </span>
                </div>
                <div className="my-2">
                    <div className="text-lg md:text-2xl font-black text-blue-600 font-mono tracking-tight">
                        {occupancyRate}%
                    </div>
                    {/* 가동률 프로그레스 바 */}
                    <div className="w-full bg-gray-100 rounded-full h-2 mt-1.5 overflow-hidden">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, occupancyRate)}%` }}
                        />
                    </div>
                </div>
                <div className="text-[10px] text-gray-400 font-medium pt-1.5 border-t border-gray-100">
                    전체 14개 호실 공급 대비 예약 비중
                </div>
            </div>

            {/* 3. 객실 평균 단가 (ADR) 카드 */}
            <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-500">🏷️ 1박 평균 단가 (ADR)</span>
                    <span className="text-[10.5px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                        1박 기준
                    </span>
                </div>
                <div className="my-2">
                    <div className="text-lg md:text-2xl font-black text-purple-700 font-mono tracking-tight">
                        ₩{adr.toLocaleString()}
                    </div>
                    <div className="text-[11px] font-bold text-gray-500 mt-0.5">
                        총 {totalNights}박 평균 결제 단가
                    </div>
                </div>
                <div className="text-[10px] text-gray-400 font-medium pt-1.5 border-t border-gray-100">
                    Average Daily Rate (총매출 ÷ 총박수)
                </div>
            </div>

            {/* 4. 총 예약 건수 & 투숙 박수 카드 */}
            <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-500">📑 총 예약 & 투숙 박수</span>
                    <span className="text-[10.5px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        실시간 확정
                    </span>
                </div>
                <div className="my-2">
                    <div className="text-lg md:text-2xl font-black text-gray-900 tracking-tight">
                        {totalBookings}<span className="text-sm font-bold text-gray-500">건</span>
                        <span className="text-gray-300 mx-1.5 font-light">/</span>
                        <span className="text-amber-600">{totalNights}</span><span className="text-sm font-bold text-gray-500">박</span>
                    </div>
                    <div className="text-[11px] font-bold text-gray-500 mt-0.5">
                        예약당 평균 {totalBookings > 0 ? (totalNights / totalBookings).toFixed(1) : 0}박 투숙
                    </div>
                </div>
                <div className="text-[10px] text-gray-400 font-medium pt-1.5 border-t border-gray-100">
                    취소 및 단순문의 제외 실예약 기준
                </div>
            </div>
        </div>
    );
}
