'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import {
    calculateRoomChannelCrossMatrix,
    RoomChannelCrossRow,
    TimeFilterRange,
} from '../../utils/analyticsCalculations';

interface RoomChannelMatrixSectionProps {
    bookings: Booking[];
    timeFilter?: TimeFilterRange;
    startDate?: string;
    endDate?: string;
    selectedProperty?: string;
    selectedUnitKey?: string;
}

type SortMode = 'vacancy' | 'revenue' | 'occupancy' | 'airbnb' | 'booking' | 'agoda' | 'trip';
type ChannelFocus = 'all' | 'airbnb' | 'booking' | 'agoda' | 'trip';

const OTA_CONFIG: Record<string, { name: string; color: string; bg: string }> = {
    airbnb: { name: '에어비앤비', color: '#14532d', bg: '#d9ead3' }, // 에어비앤비: #d9ead3 (연초록)
    trip: { name: '트립닷컴', color: '#d97706', bg: '#f1c232' },     // 트립닷컴: #f1c232 (옐로우)
    booking: { name: '부킹닷컴', color: '#4a86e8', bg: '#4a86e8' }, // 부킹닷컴: #4a86e8 (블루)
    agoda: { name: '아고다', color: '#9900ff', bg: '#9900ff' },     // 아고다: #9900ff (퍼플)
    other: { name: '기타/직거래', color: '#6c757d', bg: '#6c757d' }, // 기타
};

export default function RoomChannelMatrixSection({
    bookings,
    timeFilter = 'custom',
    startDate,
    endDate,
    selectedProperty = 'all',
    selectedUnitKey = 'all',
}: RoomChannelMatrixSectionProps) {
    const [sortMode, setSortMode] = useState<SortMode>('vacancy');
    const [channelFocus, setChannelFocus] = useState<ChannelFocus>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');

    // 1. 호실 x OTA 교차 데이터 산출 (호실 단독 필터 반영)
    const matrixRows = useMemo(() => {
        return calculateRoomChannelCrossMatrix(
            bookings,
            timeFilter,
            startDate,
            endDate,
            selectedProperty,
            selectedUnitKey
        );
    }, [bookings, timeFilter, startDate, endDate, selectedProperty, selectedUnitKey]);

    // 2. 필터링 및 정렬 처리
    const processedRows = useMemo(() => {
        let list = [...matrixRows];

        // 검색어 필터
        if (searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase();
            list = list.filter((r) => r.roomName.toLowerCase().includes(term) || r.propName.toLowerCase().includes(term));
        }

        // 정렬
        list.sort((a, b) => {
            if (sortMode === 'vacancy') {
                return b.vacantNights - a.vacantNights; // 공실 박수 많은 순 (광고 우선순위)
            }
            if (sortMode === 'revenue') {
                return b.totalRevenue - a.totalRevenue;
            }
            if (sortMode === 'occupancy') {
                return b.occupancyRate - a.occupancyRate;
            }
            if (sortMode === 'airbnb') {
                return b.otaMetrics.airbnb.nights - a.otaMetrics.airbnb.nights;
            }
            if (sortMode === 'booking') {
                return b.otaMetrics.booking.nights - a.otaMetrics.booking.nights;
            }
            if (sortMode === 'agoda') {
                return b.otaMetrics.agoda.nights - a.otaMetrics.agoda.nights;
            }
            if (sortMode === 'trip') {
                return b.otaMetrics.trip.nights - a.otaMetrics.trip.nights;
            }
            return 0;
        });

        return list;
    }, [matrixRows, sortMode, searchTerm]);

    // 3. 광고 타겟 인사이트 통계
    const highVacancyRooms = useMemo(() => {
        return matrixRows.filter((r) => r.isHighVacancy);
    }, [matrixRows]);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-4">
            {/* 상단 1열: 타이틀 및 목적 안내 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="text-xl">🎯</span>
                    <div>
                        <h3 className="text-base font-black text-gray-900 dark:text-slate-100 flex items-center gap-2">
                            호실별 x OTA 광고 성과 교차 매트릭스
                            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">
                                광고 최적화 & 공실 타겟팅
                            </span>
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                            각 OTA별 기여 예약률과 매출을 비교하고, 공실률이 높은 방을 즉시 식별하여 맞춤형 광고/프로모션을 집행합니다.
                        </p>
                    </div>
                </div>

                {/* 빠른 검색 및 정렬 선택 */}
                <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                    <input
                        type="text"
                        placeholder="호실명 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl font-bold w-28 md:w-36 focus:outline-blue-500"
                    />

                    <select
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value as SortMode)}
                        className="px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl font-bold text-gray-700 dark:text-slate-200 cursor-pointer"
                    >
                        <option value="vacancy">⚠️ 공실 많은 순 (광고 필요)</option>
                        <option value="revenue">💰 총매출 높은 순</option>
                        <option value="occupancy">📈 가동률 높은 순</option>
                        <option value="airbnb">에어비앤비 점유 순</option>
                        <option value="booking">부킹닷컴 점유 순</option>
                        <option value="agoda">아고다 점유 순</option>
                        <option value="trip">트립닷컴 점유 순</option>
                    </select>
                </div>
            </div>

            {/* 광고 타겟팅 추천 인사이트 배너 */}
            {highVacancyRooms.length > 0 && (
                <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
                        <span>📢</span>
                        <span>
                            공실률 40% 이상으로 <span className="font-extrabold underline decoration-amber-500">광고/부스트 집행이 시급한 호실</span>이{' '}
                            <span className="font-black text-rose-600 dark:text-rose-400 font-mono">{highVacancyRooms.length}개</span> 있습니다:
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {highVacancyRooms.slice(0, 6).map((r) => (
                            <span
                                key={r.unitKey}
                                className="px-2 py-0.5 bg-white dark:bg-slate-900 text-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-700 font-extrabold rounded-md text-[11px] shadow-2xs"
                            >
                                {r.roomName} ({r.vacantNights}박 공실)
                            </span>
                        ))}
                        {highVacancyRooms.length > 6 && (
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-bold">
                                외 {highVacancyRooms.length - 6}개
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* 채널 뷰 필터 탭 (전체 vs 특정 OTA 강조) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold border-b border-gray-100 dark:border-slate-800">
                <span className="text-gray-400 dark:text-slate-500 mr-1 text-[11px]">OTA 보기:</span>
                <button
                    type="button"
                    onClick={() => setChannelFocus('all')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                        channelFocus === 'all'
                            ? 'bg-blue-600 text-white font-extrabold shadow-2xs'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:text-gray-900'
                    }`}
                >
                    전체 OTA 나란히 비교
                </button>
                {(['airbnb', 'booking', 'agoda', 'trip'] as const).map((key) => {
                    const cfg = OTA_CONFIG[key];
                    const isSelected = channelFocus === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setChannelFocus(key)}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                                isSelected
                                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-extrabold shadow-2xs'
                                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:text-gray-900'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                            <span>{cfg.name} 집중</span>
                        </button>
                    );
                })}
            </div>

            {/* 데스크톱 교차 매트릭스 테이블 */}
            <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-slate-400 font-bold border-b border-gray-200 dark:border-slate-700">
                            <th className="py-2.5 px-3">객실(호실)명</th>
                            <th className="py-2.5 px-3 text-center">총 가동률 (Occ)</th>
                            <th className="py-2.5 px-3 text-center">잔여 공실 (타겟팅)</th>

                            {/* 4대 주요 OTA 컬럼 */}
                            {(channelFocus === 'all' || channelFocus === 'airbnb') && (
                                <th className="py-2.5 px-3 text-center min-w-[130px] border-l border-gray-100 dark:border-slate-800 text-emerald-700 dark:text-emerald-400">
                                    에어비앤비 (Airbnb)
                                </th>
                            )}
                            {(channelFocus === 'all' || channelFocus === 'booking') && (
                                <th className="py-2.5 px-3 text-center min-w-[130px] border-l border-gray-100 dark:border-slate-800 text-blue-700 dark:text-blue-400">
                                    부킹닷컴 (Booking)
                                </th>
                            )}
                            {(channelFocus === 'all' || channelFocus === 'agoda') && (
                                <th className="py-2.5 px-3 text-center min-w-[130px] border-l border-gray-100 dark:border-slate-800 text-purple-600 dark:text-purple-400">
                                    아고다 (Agoda)
                                </th>
                            )}
                            {(channelFocus === 'all' || channelFocus === 'trip') && (
                                <th className="py-2.5 px-3 text-center min-w-[130px] border-l border-gray-100 dark:border-slate-800 text-amber-600 dark:text-amber-400">
                                    트립닷컴 (Trip)
                                </th>
                            )}

                            <th className="py-2.5 px-3 text-right border-l border-gray-200 dark:border-slate-700">총 실매출액</th>
                            <th className="py-2.5 px-3 text-right">평균단가 (ADR)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {processedRows.map((r) => {
                            return (
                                <tr
                                    key={r.unitKey}
                                    className={`hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition ${
                                        r.isHighVacancy ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                                    }`}
                                >
                                    {/* 1. 호실명 */}
                                    <td className="py-3 px-3 font-extrabold text-gray-900 dark:text-slate-100">
                                        <div className="flex items-center gap-1.5">
                                            <span>{r.roomName}</span>
                                            {r.unitCount > 1 && (
                                                <span className="text-[10px] px-1 py-0.2 bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 rounded font-bold">
                                                    {r.unitCount}실
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* 2. 총 가동률 */}
                                    <td className="py-3 px-3 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-black font-mono text-gray-900 dark:text-slate-100">
                                                {r.occupancyRate}%
                                            </span>
                                            <span className="text-[10px] text-gray-400 dark:text-slate-500">
                                                ({r.totalNights}/{r.availableNights}박)
                                            </span>
                                        </div>
                                    </td>

                                    {/* 3. 잔여 공실 */}
                                    <td className="py-3 px-3 text-center">
                                        <div className="flex flex-col items-center">
                                            <span
                                                className={`font-black font-mono ${
                                                    r.isHighVacancy
                                                        ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                                                        : 'text-gray-700 dark:text-slate-300'
                                                }`}
                                            >
                                                {r.vacantNights}박 공실
                                            </span>
                                            {r.isHighVacancy && (
                                                <span className="text-[10px] font-black px-1.5 py-0.2 bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 rounded mt-0.5 animate-pulse">
                                                    광고 필요 ⚠️
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* 4. 에어비앤비 */}
                                    {(channelFocus === 'all' || channelFocus === 'airbnb') && (
                                        <td className="py-3 px-3 text-center border-l border-gray-100 dark:border-slate-800">
                                            <div className="flex flex-col items-center">
                                                <span className="font-extrabold text-gray-900 dark:text-slate-100">
                                                    {r.otaMetrics.airbnb.nights}박 ({r.otaMetrics.airbnb.contributionOcc}%)
                                                </span>
                                                <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                                                    ₩{r.otaMetrics.airbnb.revenue.toLocaleString()}
                                                </span>
                                            </div>
                                        </td>
                                    )}

                                    {/* 5. 부킹닷컴 */}
                                    {(channelFocus === 'all' || channelFocus === 'booking') && (
                                        <td className="py-3 px-3 text-center border-l border-gray-100 dark:border-slate-800">
                                            <div className="flex flex-col items-center">
                                                <span className="font-extrabold text-gray-900 dark:text-slate-100">
                                                    {r.otaMetrics.booking.nights}박 ({r.otaMetrics.booking.contributionOcc}%)
                                                </span>
                                                <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                                                    ₩{r.otaMetrics.booking.revenue.toLocaleString()}
                                                </span>
                                            </div>
                                        </td>
                                    )}

                                    {/* 6. 아고다 */}
                                    {(channelFocus === 'all' || channelFocus === 'agoda') && (
                                        <td className="py-3 px-3 text-center border-l border-gray-100 dark:border-slate-800">
                                            <div className="flex flex-col items-center">
                                                <span className="font-extrabold text-gray-900 dark:text-slate-100">
                                                    {r.otaMetrics.agoda.nights}박 ({r.otaMetrics.agoda.contributionOcc}%)
                                                </span>
                                                <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                                                    ₩{r.otaMetrics.agoda.revenue.toLocaleString()}
                                                </span>
                                            </div>
                                        </td>
                                    )}

                                    {/* 7. 트립닷컴 */}
                                    {(channelFocus === 'all' || channelFocus === 'trip') && (
                                        <td className="py-3 px-3 text-center border-l border-gray-100 dark:border-slate-800">
                                            <div className="flex flex-col items-center">
                                                <span className="font-extrabold text-gray-900 dark:text-slate-100">
                                                    {r.otaMetrics.trip.nights}박 ({r.otaMetrics.trip.contributionOcc}%)
                                                </span>
                                                <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                                                    ₩{r.otaMetrics.trip.revenue.toLocaleString()}
                                                </span>
                                            </div>
                                        </td>
                                    )}

                                    {/* 8. 총매출 */}
                                    <td className="py-3 px-3 text-right font-black font-mono text-gray-900 dark:text-slate-100 border-l border-gray-200 dark:border-slate-700">
                                        ₩{r.totalRevenue.toLocaleString()}
                                    </td>

                                    {/* 9. ADR */}
                                    <td className="py-3 px-3 text-right font-extrabold font-mono text-gray-700 dark:text-slate-300">
                                        ₩{r.adr.toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* 모바일 뷰: 카드 리스트 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3">
                {processedRows.map((r) => (
                    <div
                        key={r.unitKey}
                        className={`bg-gray-50/70 dark:bg-slate-800/70 rounded-xl p-3.5 border ${
                            r.isHighVacancy
                                ? 'border-amber-300 dark:border-amber-800/80 shadow-2xs'
                                : 'border-gray-200 dark:border-slate-700'
                        } flex flex-col gap-2.5`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-black text-sm text-gray-900 dark:text-slate-100">
                                {r.roomName}
                            </span>
                            {r.isHighVacancy ? (
                                <span className="text-[10px] font-black px-1.5 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 rounded">
                                    광고 필요 ⚠️
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded">
                                    가동률 양호
                                </span>
                            )}
                        </div>

                        {/* 가동률 & 공실 박수 */}
                        <div className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-gray-100 dark:border-slate-800">
                            <div>
                                <span className="text-gray-400 dark:text-slate-500 text-[10px] block">가동률</span>
                                <span className="font-black font-mono text-gray-900 dark:text-slate-100">
                                    {r.occupancyRate}% ({r.totalNights}박)
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-400 dark:text-slate-500 text-[10px] block">잔여 공실</span>
                                <span className="font-black font-mono text-rose-600 dark:text-rose-400">
                                    {r.vacantNights}박 공실
                                </span>
                            </div>
                        </div>

                        {/* 4대 OTA 기여 현황 */}
                        <div className="space-y-1.5 pt-1 text-[11px]">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">에어비앤비</span>
                                <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                                    {r.otaMetrics.airbnb.nights}박 ({r.otaMetrics.airbnb.contributionOcc}%)
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-blue-600 dark:text-blue-400">부킹닷컴</span>
                                <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                                    {r.otaMetrics.booking.nights}박 ({r.otaMetrics.booking.contributionOcc}%)
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-purple-600 dark:text-purple-400">아고다</span>
                                <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                                    {r.otaMetrics.agoda.nights}박 ({r.otaMetrics.agoda.contributionOcc}%)
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-amber-600 dark:text-amber-400">트립닷컴</span>
                                <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                                    {r.otaMetrics.trip.nights}박 ({r.otaMetrics.trip.contributionOcc}%)
                                </span>
                            </div>
                        </div>

                        {/* 총 매출 & ADR */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 dark:border-slate-700/60 text-xs">
                            <span className="font-bold text-gray-500 dark:text-slate-400">총 실매출</span>
                            <span className="font-black font-mono text-gray-900 dark:text-slate-100">
                                ₩{r.totalRevenue.toLocaleString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
