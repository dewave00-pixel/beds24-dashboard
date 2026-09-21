'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import { PROPERTY_GROUPS } from '../../config';
import {
    calculateRoomStats,
    calculatePropertyStats,
    formatLocalDate,
    RoomStats,
    PropertyStats,
} from '../../utils/analyticsCalculations';
import RoomRevenueTable from './RoomRevenueTable';
import PropertyRevenueTable from './PropertyRevenueTable';
import DateRangeToolbar from './DateRangeToolbar';

interface RoomsPropertiesTabProps {
    bookings: Booking[];
}

export default function RoomsPropertiesTab({ bookings }: RoomsPropertiesTabProps) {
    // 자체 날짜 상태: 기본값 이번 달 1일 ~ 말일
    const { defaultStart, defaultEnd } = useMemo(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const first = formatLocalDate(new Date(y, m, 1));
        const last = formatLocalDate(new Date(y, m + 1, 0));
        return { defaultStart: first, defaultEnd: last };
    }, []);

    const [startDate, setStartDate] = useState<string>(defaultStart);
    const [endDate, setEndDate] = useState<string>(defaultEnd);

    const [viewMode, setViewMode] = useState<'rooms' | 'properties'>('rooms');
    const [selectedProperty, setSelectedProperty] = useState<string>('all');

    const handleChangeRange = (newStart: string, newEnd: string) => {
        setStartDate(newStart);
        setEndDate(newEnd);
    };

    // 선택된 기간 기준 객실별 성과
    const allRoomStats: RoomStats[] = useMemo(() => {
        return calculateRoomStats(bookings, 'custom', startDate, endDate, 'stay');
    }, [bookings, startDate, endDate]);

    // 선택된 기간 기준 건물별 성과
    const allPropertyStats: PropertyStats[] = useMemo(() => {
        return calculatePropertyStats(bookings, 'custom', startDate, endDate, 'stay');
    }, [bookings, startDate, endDate]);

    // 지점 필터링 적용된 객실 목록
    const filteredRoomStats = useMemo(() => {
        if (selectedProperty === 'all') return allRoomStats;
        return allRoomStats.filter((r) => r.propName === selectedProperty);
    }, [allRoomStats, selectedProperty]);

    // 지점 필터링 적용된 건물 목록
    const filteredPropertyStats = useMemo(() => {
        if (selectedProperty === 'all') return allPropertyStats;
        return allPropertyStats.filter((p) => p.propName === selectedProperty);
    }, [allPropertyStats, selectedProperty]);

    // 지점 탭 목록
    const propertyTabs = useMemo(() => {
        return [
            { key: 'all', label: '전체 지점' },
            ...PROPERTY_GROUPS.map((g) => ({
                key: g.name,
                label: g.name === 'Namsun' ? '남선' : g.name === 'YEONNAM' ? '연남' : g.name === 'WAVE' ? '웨이브' : '그린',
            })),
        ];
    }, []);

    return (
        <div className="flex flex-col gap-3.5">
            {/* 탭 자체 전용 날짜 툴바 */}
            <DateRangeToolbar
                startDate={startDate}
                endDate={endDate}
                onChangeRange={handleChangeRange}
                title="정산 기간"
            />

            {/* 상단 서브 컨트롤 바: [객실별 / 건물별 보기 서브 전환] & [지점 선택 필터] */}
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
                {/* 1. 객실별 vs 건물별 보기 전환 */}
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => setViewMode('rooms')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                            viewMode === 'rooms'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <span>객실별 상세 실적</span>
                        <span className="text-[10px] text-gray-400 font-medium">({allRoomStats.length}개)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('properties')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                            viewMode === 'properties'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <span>건물(지점)별 요약</span>
                        <span className="text-[10px] text-gray-400 font-medium">({allPropertyStats.length}개)</span>
                    </button>
                </div>

                {/* 2. 지점 선택 필터 (연남, 웨이브, 그린, 남선) */}
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-bold">
                    {propertyTabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setSelectedProperty(tab.key)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
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

            {/* 본문 뷰 렌더링 */}
            {viewMode === 'rooms' ? (
                <RoomRevenueTable roomStats={filteredRoomStats} />
            ) : (
                <PropertyRevenueTable propertyStats={filteredPropertyStats} />
            )}
        </div>
    );
}
