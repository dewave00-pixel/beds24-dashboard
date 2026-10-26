'use client';

import React, { useState, useMemo } from 'react';
import type { InventoryIssueItem } from '../../types';
import { getDayType } from '../../config';

interface InventoryIssuesModalProps {
    isOpen: boolean;
    issues: InventoryIssueItem[];
    onClose: () => void;
    onSelectDate: (dateStr: string) => void;
}

export default function InventoryIssuesModal({
    isOpen,
    issues,
    onClose,
    onSelectDate,
}: InventoryIssuesModalProps) {
    const [selectedTab, setSelectedTab] = useState<'all' | 'overbooked' | 'zero' | 'reduced'>('all');
    const [selectedProp, setSelectedProp] = useState<string>('all');

    const overbookedCount = useMemo(() => issues.filter((i) => i.issueType === 'overbooked').length, [issues]);
    const zeroCount = useMemo(() => issues.filter((i) => i.issueType === 'zero_inventory').length, [issues]);
    const reducedCount = useMemo(() => issues.filter((i) => i.issueType === 'reduced_inventory').length, [issues]);

    const propertyNames = useMemo(() => {
        const set = new Set<string>();
        issues.forEach((i) => set.add(i.propName));
        return Array.from(set);
    }, [issues]);

    const filteredIssues = useMemo(() => {
        return issues.filter((i) => {
            if (selectedTab === 'overbooked' && i.issueType !== 'overbooked') return false;
            if (selectedTab === 'zero' && i.issueType !== 'zero_inventory') return false;
            if (selectedTab === 'reduced' && i.issueType !== 'reduced_inventory') return false;
            if (selectedProp !== 'all' && i.propName !== selectedProp) return false;
            return true;
        });
    }, [issues, selectedTab, selectedProp]);

    if (!isOpen) return null;

    const handleJumpToTimeline = (dateStr: string) => {
        onSelectDate(dateStr);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-slate-800">
                
                {/* 1. 상단 모달 헤더 */}
                <div className="px-5 py-4 bg-slate-800 text-white flex items-center justify-between border-b border-slate-700 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <span className="text-2xl">🔒</span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base md:text-lg font-black leading-tight text-white">
                                    Beds24 재고 마감·초과 점검 현황
                                </h2>
                                <span className={`px-2 py-0.5 text-xs font-black rounded-full ${
                                    overbookedCount > 0
                                        ? 'bg-rose-500 text-white animate-pulse'
                                        : 'bg-amber-400 text-slate-900'
                                }`}>
                                    점검 {issues.length}건
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                                대시보드상 빈 객실이지만 Beds24에서 재고가 0이거나 차감되어 예약이 닫힌 목록입니다.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition text-2xl font-bold w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-700 cursor-pointer"
                        title="닫기"
                    >
                        ✕
                    </button>
                </div>

                {/* 2. 탭 필터 및 숙소 필터 영역 */}
                <div className="p-3 md:px-5 md:py-3 bg-gray-50 dark:bg-slate-850 border-b border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    {/* 유형별 탭 */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setSelectedTab('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                                selectedTab === 'all'
                                    ? 'bg-slate-800 text-white shadow-xs'
                                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 border border-gray-200 dark:border-slate-700'
                            }`}
                        >
                            전체 ({issues.length})
                        </button>
                        {overbookedCount > 0 && (
                            <button
                                type="button"
                                onClick={() => setSelectedTab('overbooked')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                                    selectedTab === 'overbooked'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-800'
                                }`}
                            >
                                🚨 재고 초과 ({overbookedCount})
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setSelectedTab('reduced')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                                selectedTab === 'reduced'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800'
                            }`}
                        >
                            ⚠️ 재고 축소 마감 ({reducedCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedTab('zero')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                                selectedTab === 'zero'
                                    ? 'bg-slate-700 text-white shadow-xs'
                                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 border border-gray-200 dark:border-slate-700'
                            }`}
                        >
                            🔒 전실 마감 ({zeroCount})
                        </button>
                    </div>

                    {/* 숙소 필터 */}
                    {propertyNames.length > 1 && (
                        <div className="flex items-center gap-1 text-xs">
                            <span className="text-gray-500 dark:text-slate-400 font-bold mr-1">숙소:</span>
                            <button
                                type="button"
                                onClick={() => setSelectedProp('all')}
                                className={`px-2 py-1 rounded text-xs font-bold transition cursor-pointer ${
                                    selectedProp === 'all'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                                }`}
                            >
                                전체
                            </button>
                            {propertyNames.map((pName) => (
                                <button
                                    key={`prop-filter-${pName}`}
                                    type="button"
                                    onClick={() => setSelectedProp(pName)}
                                    className={`px-2 py-1 rounded text-xs font-bold transition cursor-pointer ${
                                        selectedProp === pName
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                                    }`}
                                >
                                    {pName}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. 목록 본문 */}
                <div className="flex-1 overflow-y-auto p-3 md:p-5 flex flex-col gap-2.5">
                    {filteredIssues.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center text-center text-gray-500 dark:text-slate-400">
                            <span className="text-4xl mb-2">🎉</span>
                            <p className="font-black text-base text-gray-800 dark:text-slate-200">
                                해당 조건에 마감되거나 이상이 있는 객실이 없습니다.
                            </p>
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                모든 객실이 정상적으로 판매 중이거나 예약되어 있습니다.
                            </p>
                        </div>
                    ) : (
                        filteredIssues.map((item) => {
                            const dayInfo = getDayType(item.dateStr);
                            const dObj = new Date(item.dateStr);
                            const month = dObj.getMonth() + 1;
                            const dayNum = dObj.getDate();
                            const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dObj.getDay()];

                            let dayBadgeClass = 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200';
                            if (dayInfo.type === 'sunday' || dayInfo.type === 'holiday') {
                                dayBadgeClass = 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300';
                            } else if (dayInfo.type === 'saturday') {
                                dayBadgeClass = 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';
                            }

                            return (
                                <div
                                    key={item.id}
                                    className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition shadow-2xs flex flex-wrap items-center justify-between gap-3 group"
                                >
                                    {/* 좌측: 날짜 + 호실 정보 */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`px-2.5 py-1.5 rounded-lg flex flex-col items-center justify-center font-black text-xs shrink-0 select-none ${dayBadgeClass}`}>
                                            <span>{month}/{dayNum}</span>
                                            <span className="text-[10px] opacity-80 font-bold">({dayOfWeek})</span>
                                        </div>

                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase text-white ${item.themeClass}`}>
                                                    {item.propName}
                                                </span>
                                                <span className="font-extrabold text-sm text-gray-900 dark:text-slate-100">
                                                    {item.displayName}
                                                </span>
                                                {item.subName && (
                                                    <span className="text-xs text-gray-500 dark:text-slate-400 font-bold">
                                                        ({item.subName})
                                                    </span>
                                                )}
                                            </div>

                                            {/* 상태 및 설명 문구 */}
                                            <div className="text-xs text-gray-600 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                                                {item.issueType === 'overbooked' && (
                                                    <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-black text-[11px] border border-red-300 dark:border-red-800">
                                                        🚨 Beds24 재고 초과 ({item.numAvail}실)
                                                    </span>
                                                )}
                                                {item.issueType === 'zero_inventory' && (
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[11px] border border-slate-300 dark:border-slate-600">
                                                        🔒 전실 마감 (재고 0실)
                                                    </span>
                                                )}
                                                {item.issueType === 'reduced_inventory' && (
                                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 font-black text-[11px] border border-amber-300 dark:border-amber-700">
                                                        ⚠️ 재고 축소 마감 (Beds24 잔여 {item.numAvail}/{item.totalUnits}실)
                                                    </span>
                                                )}

                                                <span className="text-[11px] text-gray-400 dark:text-slate-400">
                                                    {item.issueType === 'zero_inventory'
                                                        ? '대시보드상 빈방이나 Beds24 재고가 0으로 닫혀 있습니다.'
                                                        : item.issueType === 'reduced_inventory'
                                                            ? `빈 객실 ${item.vacantCount}실 중 수동 재고 차감으로 인해 마감 처리되었습니다.`
                                                            : '오버부킹 위험이 있으니 Beds24 캘린더를 확인하세요.'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 우측: 판매 요금 + 타임라인 이동 버튼 */}
                                    <div className="flex items-center gap-3 shrink-0 ml-auto md:ml-0">
                                        <div className="text-right">
                                            <div className="text-[10px] text-gray-400 dark:text-slate-400 font-bold">당일 판매가</div>
                                            <div className="text-xs font-black text-gray-700 dark:text-slate-200">
                                                ₩{item.price.toLocaleString()}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleJumpToTimeline(item.dateStr)}
                                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white dark:bg-slate-700 dark:hover:bg-blue-600 dark:text-blue-300 dark:hover:text-white rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer border border-blue-200 dark:border-slate-600"
                                            title="해당 날짜 타임라인으로 바로 이동합니다"
                                        >
                                            <span>📅 타임라인 보기</span>
                                            <span>➔</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 4. 모달 하단 푸터 */}
                <div className="p-3 md:px-5 md:py-3 bg-gray-50 dark:bg-slate-850 border-t border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <div className="text-xs text-gray-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                        <span className="text-amber-500">💡</span>
                        <span>
                            Beds24 본사(Inventory &gt; Calendar)에서 재고 숫자를 복구하시면 대시보드에 실시간 반영되어 방이 다시 열립니다.
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
