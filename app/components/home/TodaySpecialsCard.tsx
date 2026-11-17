'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Booking } from '../../types';
import { getChannelStyle, parseBookingTag } from '../../config';
import { getUnitForBooking, isUnallocatedBooking } from '../../utils/bookingUtils';

export type BookingNotesMap = Record<number, { note: string; tags: string[] }>;

export interface GuestArrivalDetailSummary {
    estimatedArrivalTime?: string | null;
    earlyCheckinRequested?: boolean;
    earlyCheckinTime?: string | null;
    luggageRequested?: boolean;
    luggageTime?: string | null;
    hasFlight?: boolean;
}

interface TodaySpecialsCardProps {
    todayStr: string;
    bookings: Booking[];
    bookingNotes: BookingNotesMap;
    arrivalDetailsMap: Record<number, GuestArrivalDetailSummary>;
    unassignedCleaningCount?: number;
    inventoryIssueCount?: number;
    hasOverbooking?: boolean;
    onOpenInventoryModal?: () => void;
}

type FilterTab = 'all' | 'checkin' | 'checkout' | 'cancelled';

interface SpecialItem {
    booking: Booking;
    kind: 'checkin' | 'checkout';
    isCancelled: boolean;
    isNoshowWithFee: boolean;
    tags: string[];
    note: string;
    arrivalDetails?: GuestArrivalDetailSummary;
    isUnallocated: boolean;
    hasSpecial: boolean;
}

export default function TodaySpecialsCard({
    todayStr,
    bookings,
    bookingNotes,
    arrivalDetailsMap,
    unassignedCleaningCount = 0,
    inventoryIssueCount = 0,
    hasOverbooking = false,
    onOpenInventoryModal,
}: TodaySpecialsCardProps) {
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [onlySpecialOrCancelled, setOnlySpecialOrCancelled] = useState<boolean>(true);

    const items = useMemo<SpecialItem[]>(() => {
        const result: SpecialItem[] = [];

        for (const b of bookings) {
            const status = (b.status || '').toLowerCase().trim();
            if (status === 'deleted' || status === 'inquiry') continue;

            const isCheckIn = b.arrival === todayStr;
            const isCheckOut = b.departure === todayStr;
            if (!isCheckIn && !isCheckOut) continue;

            const isCancelled = status === 'cancelled';
            const isNoshowWithFee = isCancelled && (Number(b.price) || 0) > 0;
            const noteInfo = bookingNotes[Number(b.id)];
            const tags = noteInfo?.tags || [];
            const note = (noteInfo?.note || '').trim();
            const arrivalDetails = arrivalDetailsMap[Number(b.id)];
            const unallocated = !isCancelled && isUnallocatedBooking(b);

            const hasGuestSpecial = Boolean(
                arrivalDetails &&
                (arrivalDetails.earlyCheckinRequested ||
                    arrivalDetails.luggageRequested ||
                    arrivalDetails.estimatedArrivalTime)
            );
            const hasSpecial =
                isCancelled ||
                tags.length > 0 ||
                note.length > 0 ||
                unallocated ||
                hasGuestSpecial;

            if (isCheckIn) {
                result.push({
                    booking: b,
                    kind: 'checkin',
                    isCancelled,
                    isNoshowWithFee,
                    tags,
                    note,
                    arrivalDetails,
                    isUnallocated: unallocated,
                    hasSpecial,
                });
            }
            if (isCheckOut) {
                result.push({
                    booking: b,
                    kind: 'checkout',
                    isCancelled,
                    isNoshowWithFee,
                    tags,
                    note,
                    arrivalDetails: undefined,
                    isUnallocated: unallocated,
                    hasSpecial,
                });
            }
        }

        // 정렬 우선순위: 취소/노쇼 → 특이사항 있음 → 체크인 → 체크아웃
        return result.sort((a, b) => {
            if (a.isCancelled !== b.isCancelled) return a.isCancelled ? -1 : 1;
            if (a.hasSpecial !== b.hasSpecial) return a.hasSpecial ? -1 : 1;
            if (a.kind !== b.kind) return a.kind === 'checkin' ? -1 : 1;
            return Number(a.booking.id) - Number(b.booking.id);
        });
    }, [bookings, todayStr, bookingNotes, arrivalDetailsMap]);

    const counts = useMemo(() => {
        const checkin = items.filter((i) => i.kind === 'checkin').length;
        const checkout = items.filter((i) => i.kind === 'checkout').length;
        const cancelled = items.filter((i) => i.isCancelled).length;
        const noshow = items.filter((i) => i.isNoshowWithFee).length;
        const fullCancel = cancelled - noshow;
        const specials = items.filter((i) => i.hasSpecial).length;
        return { all: items.length, checkin, checkout, cancelled, noshow, fullCancel, specials };
    }, [items]);

    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            if (activeTab === 'checkin' && item.kind !== 'checkin') return false;
            if (activeTab === 'checkout' && item.kind !== 'checkout') return false;
            if (activeTab === 'cancelled' && !item.isCancelled) return false;
            if (onlySpecialOrCancelled && activeTab !== 'cancelled' && !item.hasSpecial) return false;
            return true;
        });
    }, [items, activeTab, onlySpecialOrCancelled]);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3.5">
            {/* 헤더 */}
            <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🛎️</span>
                        <h3 className="text-sm md:text-base font-extrabold text-gray-900 dark:text-slate-100">
                            오늘의 체크인 / 체크아웃 특이사항
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {todayStr}
                        </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                        얼리/레이트·메모·짐보관 및 취소(노쇼 위약금 vs 아예 취소) 건을 한눈에 확인합니다.
                    </p>
                </div>

                <div className="flex items-center gap-1.5">
                    <Link
                        href="/checkin"
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 transition"
                    >
                        체크인 관리 →
                    </Link>
                </div>
            </div>

            {/* 청소 미배정 & 재고 점검 요약 바 */}
            <div className="grid grid-cols-2 gap-2">
                <Link
                    href="/cleaning"
                    className={`px-3 py-2 rounded-xl border flex items-center justify-between transition text-xs font-extrabold ${
                        unassignedCleaningCount > 0
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                            : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70'
                    }`}
                >
                    <span className="flex items-center gap-1.5">
                        <span>🧹</span>
                        <span>청소 미배정</span>
                    </span>
                    <span className="font-mono">
                        {unassignedCleaningCount > 0 ? `${unassignedCleaningCount}실` : '완료 ✓'}
                    </span>
                </Link>

                <button
                    type="button"
                    onClick={onOpenInventoryModal}
                    className={`px-3 py-2 rounded-xl border flex items-center justify-between transition text-xs font-extrabold cursor-pointer ${
                        inventoryIssueCount > 0
                            ? hasOverbooking
                                ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50'
                                : 'bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50'
                            : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                >
                    <span className="flex items-center gap-1.5">
                        <span>{hasOverbooking ? '🚨' : '🔒'}</span>
                        <span>재고 이슈</span>
                    </span>
                    <span className="font-mono">
                        {inventoryIssueCount > 0 ? `${inventoryIssueCount}건` : '정상 ✓'}
                    </span>
                </button>
            </div>

            {/* 취소/노쇼 요약 배지 바 */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    {(
                        [
                            { key: 'all', label: `전체 ${counts.all}` },
                            { key: 'checkin', label: `체크인 ${counts.checkin}` },
                            { key: 'checkout', label: `체크아웃 ${counts.checkout}` },
                            { key: 'cancelled', label: `취소/노쇼 ${counts.cancelled}` },
                        ] as { key: FilterTab; label: string }[]
                    ).map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                                activeTab === tab.key
                                    ? tab.key === 'cancelled'
                                        ? 'bg-rose-600 text-white border-rose-600'
                                        : 'bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900 border-gray-900 dark:border-slate-100'
                                    : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab !== 'cancelled' && (
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-slate-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={onlySpecialOrCancelled}
                            onChange={(e) => setOnlySpecialOrCancelled(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>특이사항·취소만 보기 ({counts.specials})</span>
                    </label>
                )}
            </div>

            {counts.cancelled > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-[11px] font-bold">
                    <span className="text-rose-700 dark:text-rose-300">
                        ⚠️ 오늘 일정 취소/노쇼 총 {counts.cancelled}건:
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white">
                        노쇼·위약금 발생 {counts.noshow}건
                    </span>
                    <span className="px-2 py-0.5 rounded bg-gray-600 text-white">
                        아예 취소(무료/환불) {counts.fullCancel}건
                    </span>
                </div>
            )}

            {/* 리스트 */}
            <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-0.5">
                {filteredItems.length === 0 ? (
                    <div className="py-10 text-center text-xs font-bold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                        {onlySpecialOrCancelled
                            ? '오늘 체크인/체크아웃 중 특이사항이나 취소 건이 없습니다.'
                            : '오늘 체크인/체크아웃 예정 건이 없습니다.'}
                    </div>
                ) : (
                    filteredItems.map((item) => {
                        const { booking, kind, isCancelled, isNoshowWithFee, tags, note, arrivalDetails, isUnallocated } = item;
                        const ch = getChannelStyle(booking.apiSourceId);
                        const unit = getUnitForBooking(booking);
                        const guestName = `${booking.firstName || ''} ${booking.lastName || ''}`.trim() || '게스트';

                        return (
                            <div
                                key={`${kind}-${booking.id}`}
                                className={`p-3 rounded-xl border transition flex flex-col gap-1.5 ${
                                    isCancelled
                                        ? isNoshowWithFee
                                            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/80'
                                            : 'bg-gray-50/90 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700'
                                        : 'bg-white dark:bg-slate-800/40 border-gray-200 dark:border-slate-700/80'
                                }`}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                        <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                                                kind === 'checkin'
                                                    ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300'
                                                    : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                            }`}
                                        >
                                            {kind === 'checkin' ? '입실' : '퇴실'}
                                        </span>

                                        {isCancelled && (
                                            <span
                                                className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                                                    isNoshowWithFee
                                                        ? 'bg-rose-600 text-white'
                                                        : 'bg-gray-600 text-white'
                                                }`}
                                            >
                                                {isNoshowWithFee
                                                    ? `노쇼/위약금 (${(Number(booking.price) || 0).toLocaleString()}원)`
                                                    : '아예 취소 (0원)'}
                                            </span>
                                        )}

                                        <span
                                            className={`font-extrabold text-xs md:text-sm truncate ${
                                                isCancelled
                                                    ? 'line-through text-gray-500 dark:text-slate-400'
                                                    : 'text-gray-900 dark:text-slate-100'
                                            }`}
                                        >
                                            {guestName}
                                        </span>

                                        <span
                                            className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                                            style={{ backgroundColor: ch.bg, color: ch.text }}
                                        >
                                            {ch.name}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-bold">
                                        {isUnallocated ? (
                                            <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                                                미배정
                                            </span>
                                        ) : unit ? (
                                            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700">
                                                {unit.propName} {unit.displayName}
                                            </span>
                                        ) : null}
                                        <span className="text-gray-400 dark:text-slate-500 font-mono text-[10px]">
                                            #{booking.id}
                                        </span>
                                    </div>
                                </div>

                                {/* 태그 / 게스트 도착정보 / 관리자 메모 */}
                                {(tags.length > 0 || arrivalDetails || note) && (
                                    <div className="flex flex-col gap-1 pt-1 border-t border-gray-100 dark:border-slate-800/80">
                                        <div className="flex flex-wrap items-center gap-1">
                                            {tags.map((t) => {
                                                const info = parseBookingTag(t);
                                                if (!info) return null;
                                                return (
                                                    <span
                                                        key={t}
                                                        className={`px-1.5 py-0.5 rounded text-[10px] ${info.badgeClass}`}
                                                    >
                                                        {info.icon ? `${info.icon} ` : ''}
                                                        {info.label}
                                                    </span>
                                                );
                                            })}
                                            {arrivalDetails?.estimatedArrivalTime && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                                    🏠 입실예정 {arrivalDetails.estimatedArrivalTime}
                                                </span>
                                            )}
                                            {arrivalDetails?.luggageRequested && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                    🧳 짐보관 {arrivalDetails.luggageTime || '요청'}
                                                </span>
                                            )}
                                        </div>
                                        {note && (
                                            <p className="text-[11px] font-medium text-gray-700 dark:text-slate-300 bg-yellow-50/70 dark:bg-yellow-950/20 px-2 py-1 rounded border border-yellow-200/70 dark:border-yellow-900/50">
                                                📝 {note}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
