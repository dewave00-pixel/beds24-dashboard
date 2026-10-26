'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import { calculateNetPayout, getUnitForBooking } from '../../utils/bookingUtils';
import { getChannelStyle } from '../../config';

interface ChickenEventDeductionSectionProps {
    bookings: Booking[];
    startDate: string;
    endDate: string;
    selectedProperty: string;
    selectedUnitKey: string;
}

export default function ChickenEventDeductionSection({
    bookings,
    startDate,
    endDate,
    selectedProperty,
    selectedUnitKey,
}: ChickenEventDeductionSectionProps) {
    const [isExpanded, setIsExpanded] = useState<boolean>(true);
    const [copied, setCopied] = useState<boolean>(false);

    // 🍗 조회 기간 내 치킨 이벤트 대상 예약 필터링 (정산 매출 기준: 체크아웃 날짜 departure)
    const chickenBookings = useMemo(() => {
        return bookings.filter((b) => {
            if (!b.isChicken) return false;
            if (b.status === 'cancelled') return false;
            if (b.departure < startDate || b.departure > endDate) return false;

            if (selectedProperty !== 'all') {
                const matchedUnit = getUnitForBooking(b);
                if (matchedUnit?.propName !== selectedProperty) return false;
            }
            if (selectedUnitKey !== 'all') {
                const matchedUnit = getUnitForBooking(b);
                const uKey = matchedUnit?.key || `${b.roomId}-${b.unitId || 1}`;
                if (uKey !== selectedUnitKey) return false;
            }
            return true;
        }).sort((a, b) => a.departure.localeCompare(b.departure));
    }, [bookings, startDate, endDate, selectedProperty, selectedUnitKey]);

    // 요약 집계
    const count = chickenBookings.length;
    const totalDeduction = count * 21000;

    const { totalGross, totalNet } = useMemo(() => {
        let gross = 0;
        let net = 0;
        chickenBookings.forEach((b) => {
            gross += Number(b.price) || 0;
            net += calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime, b.roomId, true);
        });
        return { totalGross: gross, totalNet: net };
    }, [chickenBookings]);

    // 클립보드 복사 (정산 및 보고용)
    const handleCopySummary = () => {
        if (count === 0) return;
        const lines = [
            `[🍗 리뷰 치킨 이벤트 정산 차감 보고]`,
            `기간: ${startDate} ~ ${endDate}`,
            `총 건수: ${count}건`,
            `총 차감액: -₩${totalDeduction.toLocaleString()} (건당 21,000원)`,
            `차감 후 정산 합계: ₩${totalNet.toLocaleString()}`,
            `----------------------------------`,
            ...chickenBookings.map((b, idx) => {
                const unit = getUnitForBooking(b);
                const unitName = unit ? `${unit.propName} ${unit.displayName}` : `호실(${b.roomId})`;
                const guest = [b.firstName, b.lastName].filter(Boolean).join(' ') || '이름 미기재';
                const net = calculateNetPayout(Number(b.price) || 0, b.apiSourceId, 0, b.bookingTime, b.roomId, true);
                return `${idx + 1}. [${unitName}] ${guest} (#${b.id}) | ${b.arrival}~${b.departure} | 차감 -21,000원 (실수령 ₩${net.toLocaleString()})`;
            }),
        ];
        navigator.clipboard.writeText(lines.join('\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-orange-200 dark:border-orange-900/60 shadow-xs p-4 md:p-5 flex flex-col gap-4">
            {/* 상단 헤더: 타이틀 + 뱃지 + 컨트롤 버튼 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-orange-100 dark:border-orange-950/80">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xl md:text-2xl">🍗</span>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm md:text-base font-extrabold text-gray-900 dark:text-slate-100">
                                리뷰 치킨 이벤트 정산 차감 모아보기
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-orange-100 text-orange-900 dark:bg-orange-950/80 dark:text-orange-200 border border-orange-300 dark:border-orange-800">
                                총 {count}건
                            </span>
                            {count > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-900 font-mono">
                                    -₩{totalDeduction.toLocaleString()} 차감
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium mt-0.5">
                            선택 기간 내 체크아웃 기준 · 건당 21,000원이 총 정산 매출에서 자동 차감 반영되었습니다.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {count > 0 && (
                        <button
                            type="button"
                            onClick={handleCopySummary}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200 bg-orange-50/70 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/60 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="치킨 차감 목록 텍스트 복사"
                        >
                            <span>{copied ? '✅' : '📋'}</span>
                            <span>{copied ? '복사됨!' : '목록 복사'}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1"
                    >
                        <span>{isExpanded ? '▲ 접기' : '▼ 펼치기'}</span>
                    </button>
                </div>
            </div>

            {/* 3대 핵심 요약 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-orange-50/60 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-900/50 flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-orange-900 dark:text-orange-300">
                        🍗 이벤트 적용 건수
                    </span>
                    <span className="text-xl md:text-2xl font-black text-orange-950 dark:text-orange-100 font-mono">
                        {count}건
                    </span>
                    <span className="text-[10px] text-orange-700 dark:text-orange-400 font-medium">
                        건당 21,000원 공제
                    </span>
                </div>

                <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50 flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-rose-900 dark:text-rose-300">
                        💸 총 정산 차감액
                    </span>
                    <span className="text-xl md:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                        -₩{totalDeduction.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-rose-700 dark:text-rose-400 font-medium">
                        정산 매출에서 차감 완료
                    </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-gray-600 dark:text-slate-400">
                        💰 차감 후 실수령 합계
                    </span>
                    <span className="text-xl md:text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                        ₩{totalNet.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">
                        원결제 합계 ₩{totalGross.toLocaleString()}
                    </span>
                </div>
            </div>

            {/* 상세 예약 리스트 (펼침 상태일 때만) */}
            {isExpanded && (
                <div className="flex flex-col gap-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-extrabold text-gray-700 dark:text-slate-300 px-1">
                        <span>대상 예약 목록 ({count}건)</span>
                        <span className="text-[11px] font-normal text-gray-400 dark:text-slate-500">
                            체크아웃 일자순 정렬
                        </span>
                    </div>

                    {count === 0 ? (
                        <div className="py-10 text-center text-xs font-bold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                            선택하신 기간({startDate} ~ {endDate})에는 리뷰 치킨 이벤트가 적용된 예약이 없습니다.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 overflow-hidden">
                            {chickenBookings.map((b) => {
                                const unit = getUnitForBooking(b);
                                const unitDisplay = unit
                                    ? `${unit.propName} ${unit.displayName}${unit.subName ? ` (${unit.subName})` : ''}`
                                    : `호실(${b.roomId})`;
                                const ch = getChannelStyle(b.apiSourceId);
                                const guestName = [b.firstName, b.lastName].filter(Boolean).join(' ') || '이름 미기재';

                                const grossPrice = Number(b.price) || 0;
                                const netPrice = calculateNetPayout(grossPrice, b.apiSourceId, 0, b.bookingTime, b.roomId, true);
                                const baseNet = calculateNetPayout(grossPrice, b.apiSourceId, 0, b.bookingTime, b.roomId, false);

                                const arr = new Date(b.arrival);
                                const dep = new Date(b.departure);
                                const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));

                                return (
                                    <div
                                        key={b.id}
                                        className="p-3 bg-gray-50/90 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition hover:border-orange-400 dark:hover:border-orange-500"
                                    >
                                        {/* 좌측: 예약자명 + 호실 + 일정 + 채널 */}
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-extrabold text-sm text-gray-900 dark:text-slate-100">
                                                    {guestName}
                                                </span>
                                                <span className="text-[10px] font-mono font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                                                    #{b.id}
                                                </span>
                                                <span
                                                    className="text-[10px] font-black px-1.5 py-0.5 rounded shadow-2xs"
                                                    style={{ backgroundColor: ch.bg, color: ch.text }}
                                                >
                                                    {ch.name}
                                                </span>
                                                <span className="text-[11px] font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                                                    {unitDisplay}
                                                </span>
                                            </div>

                                            <div className="text-xs text-gray-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                                                <span>📅 {b.arrival} ~ {b.departure} ({nights}박)</span>
                                            </div>
                                        </div>

                                        {/* 우측: 정산 차감 내역 및 최종 실수령 */}
                                        <div className="flex items-baseline sm:items-end flex-col shrink-0 gap-0.5 text-right">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                                                    결제: ₩{grossPrice.toLocaleString()}
                                                </span>
                                                <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/80 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800">
                                                    🍗 -21,000원
                                                </span>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">
                                                    최종 정산:
                                                </span>
                                                <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                                                    ₩{netPrice.toLocaleString()}원
                                                </span>
                                                <span className="text-[10px] text-gray-400 dark:text-slate-500 line-through font-mono">
                                                    (₩{baseNet.toLocaleString()})
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
