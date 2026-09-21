'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import { ALL_UNITS, PROPERTY_GROUPS } from '../../config';
import {
    calculateRoomStats,
    calculateOverallSummary,
    RoomStats,
    OverallSummary,
    TimeFilterRange,
} from '../../utils/analyticsCalculations';
import DateRangeToolbar from './DateRangeToolbar';

interface PricingStrategyTabProps {
    bookings: Booking[];
}

export default function PricingStrategyTab({ bookings }: PricingStrategyTabProps) {
    // 탭 내부 자체 날짜 상태 (기본값: 오늘 하루)
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    const [startDate, setStartDate] = useState<string>(todayStr);
    const [endDate, setEndDate] = useState<string>(todayStr);
    const [selectedProperty, setSelectedProperty] = useState<string>('all');

    const handleChangeRange = (newStart: string, newEnd: string) => {
        setStartDate(newStart);
        setEndDate(newEnd);
    };

    // 선택된 기간 기준 실시간 전체 요약
    const summary: OverallSummary = useMemo(() => {
        return calculateOverallSummary(bookings, 'custom', startDate, endDate, 'stay');
    }, [bookings, startDate, endDate]);

    // 선택된 기간 기준 호실별 성과 (주말/평일 단가 포함)
    const roomStats: RoomStats[] = useMemo(() => {
        return calculateRoomStats(bookings, 'custom', startDate, endDate, 'stay');
    }, [bookings, startDate, endDate]);

    // 지점 필터링 적용된 호실 목록
    const filteredRoomStats = useMemo(() => {
        if (selectedProperty === 'all') return roomStats;
        return roomStats.filter((r) => r.propName === selectedProperty);
    }, [roomStats, selectedProperty]);

    // 지점 탭 목록 (연남, 웨이브, 그린, 남선)
    const propertyTabs = useMemo(() => {
        return [
            { key: 'all', label: '전체 지점' },
            ...PROPERTY_GROUPS.map((g) => ({
                key: g.name,
                label: g.name === 'Namsun' ? '남선' : g.name === 'YEONNAM' ? '연남' : g.name === 'WAVE' ? '웨이브' : '그린',
            })),
        ];
    }, []);

    // 의사결정 인사이트 계산 (공실 가장 많은 호실 TOP 3)
    const topVacantRooms = useMemo(() => {
        return [...roomStats]
            .sort((a, b) => b.vacantNights - a.vacantNights)
            .slice(0, 3)
            .filter((r) => r.vacantNights > 0);
    }, [roomStats]);

    return (
        <div className="flex flex-col gap-3.5">
            {/* 탭 자체 전용 날짜 툴바 */}
            <DateRangeToolbar
                startDate={startDate}
                endDate={endDate}
                onChangeRange={handleChangeRange}
                title="조회 기간"
            />

            {/* 1. 상단 4대 핵심 KPI 요약 미니 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-gray-500">선택 기간 총매출 (Gross)</span>
                    <div className="flex items-baseline justify-between">
                        <span className="text-lg md:text-xl font-extrabold text-gray-900 font-mono">
                            ₩{summary.totalRevenue.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded-md">
                            {summary.totalBookings}건
                        </span>
                    </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-gray-500">실수령 순매출 (Net 80%)</span>
                    <div className="flex items-baseline justify-between">
                        <span className="text-lg md:text-xl font-extrabold text-emerald-700 font-mono">
                            ₩{summary.netRevenue.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                            정산 추정
                        </span>
                    </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-gray-500">평균 가동률 (Occupancy)</span>
                    <div className="flex items-baseline justify-between">
                        <span className="text-lg md:text-xl font-extrabold text-blue-700 font-mono">
                            {summary.occupancyRate}%
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium">
                            {summary.totalNights}박 판매
                        </span>
                    </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-gray-500">1박 평균 객실단가 (ADR)</span>
                    <div className="flex items-baseline justify-between">
                        <span className="text-lg md:text-xl font-extrabold text-purple-700 font-mono">
                            ₩{summary.adr.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded-md">
                            박당 단가
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. 빠른 가격 수정 가이드 칩 (공실 집중 관리 안내) */}
            {topVacantRooms.length > 0 && (
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-2.5 px-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 animate-pulse"></span>
                        <span className="font-bold text-blue-900">
                            금액 조정 검토 추천 (공실 최다 호실):
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {topVacantRooms.map((r) => (
                                <span
                                    key={r.unitKey}
                                    className="bg-white px-2 py-0.5 rounded-md text-[11px] font-bold text-gray-800 border border-blue-200 shadow-2xs"
                                >
                                    {r.propName === 'Namsun' ? '남선' : r.propName === 'YEONNAM' ? '연남' : r.propName === 'WAVE' ? '웨이브' : r.propName} {r.roomName} <strong className="text-red-600">({r.vacantNights}박 공실)</strong>
                                </span>
                            ))}
                        </div>
                    </div>
                    <span className="text-[11px] text-blue-700 font-medium hidden md:inline">
                        * 주말/평일 단가를 조정하여 가동률을 끌어올려 보세요.
                    </span>
                </div>
            )}

            {/* 3. 호실별 가격 전략 & 공실 현황 테이블 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col overflow-hidden">
                {/* 헤더 및 지점 필터 버튼 */}
                <div className="p-3 md:p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2.5 bg-gray-50/60">
                    <div>
                        <h4 className="text-sm md:text-base font-bold text-gray-900">
                            호실별 잔여 공실 & 판매 단가 (주말 vs 평일)
                        </h4>
                        <span className="text-[11px] text-gray-500 font-medium">
                            선택 기간 동안 각 객실의 실제 판매단가와 공실 현황을 비교하여 요금을 수정하세요.
                        </span>
                    </div>

                    {/* 지점 전환 필터 버튼 (연남, 웨이브, 그린, 남선) */}
                    <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-bold">
                        {propertyTabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setSelectedProperty(tab.key)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    selectedProperty === tab.key
                                        ? 'bg-white text-blue-700 shadow-2xs'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* PC 테이블 뷰 */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                                <th className="py-2.5 px-3">숙소 지점</th>
                                <th className="py-2.5 px-3">호실명</th>
                                <th className="py-2.5 px-3 text-center">가동률</th>
                                <th className="py-2.5 px-3 text-center">공실 / 투숙</th>
                                <th className="py-2.5 px-3 text-right">평균 단가 (ADR)</th>
                                <th className="py-2.5 px-3 text-right text-purple-700">주말 단가 (금·토)</th>
                                <th className="py-2.5 px-3 text-right text-blue-700">평일 단가 (일~목)</th>
                                <th className="py-2.5 px-3 text-right">총 매출액 (Gross)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredRoomStats.map((r) => {
                                const occ = r.occupancyRate;
                                const isHighOcc = occ >= 80;
                                const isLowOcc = occ <= 40;

                                const weekendAdr = r.dayTypeAdr?.weekendAdr || 0;
                                const weekdayAdr = r.dayTypeAdr?.weekdayAdr || 0;

                                return (
                                    <tr key={r.unitKey} className="hover:bg-blue-50/40 transition">
                                        <td className="py-3 px-3 font-bold text-gray-700">
                                            {r.propName === 'Namsun' ? '남선' : r.propName === 'YEONNAM' ? '연남' : r.propName === 'WAVE' ? '웨이브' : r.propName}
                                        </td>
                                        <td className="py-3 px-3 font-extrabold text-gray-900">
                                            {r.roomName}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span
                                                className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                                    isHighOcc
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : isLowOcc
                                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                }`}
                                            >
                                                {occ}%
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center text-gray-700 font-medium">
                                            <span className={r.vacantNights > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}>
                                                {r.vacantNights}박 공실
                                            </span>
                                            <span className="text-gray-300 mx-1">/</span>
                                            <span className="text-gray-900 font-bold">{r.totalNights}박 투숙</span>
                                        </td>
                                        <td className="py-3 px-3 text-right font-extrabold text-gray-900 font-mono">
                                            ₩{r.adr.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 text-right font-bold text-purple-700 font-mono">
                                            {weekendAdr > 0 ? `₩${weekendAdr.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="py-3 px-3 text-right font-bold text-blue-700 font-mono">
                                            {weekdayAdr > 0 ? `₩${weekdayAdr.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="py-3 px-3 text-right font-extrabold text-gray-900 font-mono text-sm">
                                            ₩{r.totalRevenue.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* 모바일 카드 뷰 */}
                <div className="grid grid-cols-1 gap-2 p-3 md:hidden">
                    {filteredRoomStats.map((r) => {
                        const weekendAdr = r.dayTypeAdr?.weekendAdr || 0;
                        const weekdayAdr = r.dayTypeAdr?.weekdayAdr || 0;

                        return (
                            <div
                                key={r.unitKey}
                                className="bg-gray-50/80 rounded-xl border border-gray-200 p-3 flex flex-col gap-2 shadow-2xs"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-gray-500 bg-gray-200/60 px-1.5 py-0.5 rounded-sm">
                                            {r.propName === 'Namsun' ? '남선' : r.propName === 'YEONNAM' ? '연남' : r.propName === 'WAVE' ? '웨이브' : r.propName}
                                        </span>
                                        <span className="font-extrabold text-sm text-gray-900">{r.roomName}</span>
                                    </div>
                                    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                        가동률 {r.occupancyRate}%
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-200/60">
                                    <div>
                                        <span className="text-gray-400 block text-[10px]">공실 / 투숙</span>
                                        <span className="font-bold text-gray-800">
                                            <strong className="text-red-600">{r.vacantNights}박</strong> / {r.totalNights}박
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-gray-400 block text-[10px]">평균 단가</span>
                                        <span className="font-mono font-extrabold text-gray-900">
                                            ₩{r.adr.toLocaleString()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-purple-600 block text-[10px] font-bold">주말 단가</span>
                                        <span className="font-mono font-bold text-purple-700">
                                            {weekendAdr > 0 ? `₩${weekendAdr.toLocaleString()}` : '-'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-blue-600 block text-[10px] font-bold">평일 단가</span>
                                        <span className="font-mono font-bold text-blue-700">
                                            {weekdayAdr > 0 ? `₩${weekdayAdr.toLocaleString()}` : '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
