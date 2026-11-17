'use client';

import React, { useMemo } from 'react';
import { Booking } from '../../types';
import { getChannelStyle } from '../../config';
import {
    calculateNetPayout,
    getBookingDateKST,
    getUnitForBooking,
    isRevenueBooking,
} from '../../utils/bookingUtils';

interface TodayPlatformBookingsCardProps {
    todayStr: string;
    bookings: Booking[];
}

interface PlatformRow {
    channelName: string;
    bg: string;
    text: string;
    count: number;
    nights: number;
    netRevenue: number;
}

function getNightCount(arrival: string, departure: string): number {
    if (!arrival || !departure) return 1;
    const [ay, am, ad] = arrival.split('-').map(Number);
    const [dy, dm, dd] = departure.split('-').map(Number);
    if (!ay || !am || !ad || !dy || !dm || !dd) return 1;
    const diff = Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ay, am - 1, ad)) / 86400000);
    return Math.max(1, diff);
}

export default function TodayPlatformBookingsCard({
    todayStr,
    bookings,
}: TodayPlatformBookingsCardProps) {
    const { todayBookings, platformRows, totalCount, totalNights, totalNetRevenue } = useMemo(() => {
        const list = bookings.filter((b) => {
            if (!isRevenueBooking(b)) return false;
            if ((b.status || '').toLowerCase().trim() === 'cancelled') return false;
            const bookedDate = getBookingDateKST(b.bookingTime, b.arrival);
            return bookedDate === todayStr;
        });

        const map = new Map<string, PlatformRow>();
        let nightsSum = 0;
        let revenueSum = 0;

        for (const b of list) {
            const ch = getChannelStyle(b.apiSourceId);
            const nights = getNightCount(b.arrival, b.departure);
            const net = calculateNetPayout(
                Number(b.price) || 0,
                b.apiSourceId,
                0,
                b.bookingTime,
                b.roomId,
                Boolean(b.isChicken)
            );

            nightsSum += nights;
            revenueSum += net;

            const prev = map.get(ch.name) || {
                channelName: ch.name,
                bg: ch.bg,
                text: ch.text,
                count: 0,
                nights: 0,
                netRevenue: 0,
            };
            prev.count += 1;
            prev.nights += nights;
            prev.netRevenue += net;
            map.set(ch.name, prev);
        }

        const rows = Array.from(map.values()).sort((a, b) => b.netRevenue - a.netRevenue || b.count - a.count);

        return {
            todayBookings: list,
            platformRows: rows,
            totalCount: list.length,
            totalNights: nightsSum,
            totalNetRevenue: revenueSum,
        };
    }, [bookings, todayStr]);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3.5">
            {/* 헤더 */}
            <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🌐</span>
                        <h3 className="text-sm md:text-base font-extrabold text-gray-900 dark:text-slate-100">
                            플랫폼별 당일 예약 현황
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            오늘 유입 ({todayStr})
                        </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                        오늘(KST) 새로 체결된 예약의 채널별 건수·박수·정산 예상액입니다.
                    </p>
                </div>

                <div className="text-right">
                    <div className="text-xs font-extrabold text-gray-900 dark:text-slate-100 font-mono">
                        총 {totalCount}건 · {totalNights}박
                    </div>
                    <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        +{totalNetRevenue.toLocaleString()}원
                    </div>
                </div>
            </div>

            {/* 플랫폼별 바 요약 */}
            {platformRows.length === 0 ? (
                <div className="py-10 text-center text-xs font-bold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                    오늘 아직 새로 유입된 예약이 없습니다.
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-2">
                        {platformRows.map((row) => {
                            const sharePct = totalCount > 0 ? Math.round((row.count / totalCount) * 100) : 0;
                            return (
                                <div
                                    key={row.channelName}
                                    className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 flex flex-col gap-1.5"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="px-2 py-0.5 rounded text-[11px] font-extrabold shrink-0"
                                                style={{ backgroundColor: row.bg, color: row.text }}
                                            >
                                                {row.channelName}
                                            </span>
                                            <span className="text-xs font-bold text-gray-700 dark:text-slate-200 font-mono">
                                                {row.count}건 ({row.nights}박)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs font-extrabold text-gray-900 dark:text-slate-100 font-mono">
                                                {row.netRevenue.toLocaleString()}원
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 w-8 text-right font-mono">
                                                {sharePct}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-300"
                                            style={{ width: `${sharePct}%`, backgroundColor: row.bg }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 당일 유입 예약 미니 리스트 */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                        <span className="text-[11px] font-extrabold text-gray-500 dark:text-slate-400">
                            당일 신규 유입 내역 ({todayBookings.length}건)
                        </span>
                        <div className="flex flex-col gap-1.5 max-h-[210px] overflow-y-auto pr-0.5">
                            {todayBookings.map((b) => {
                                const ch = getChannelStyle(b.apiSourceId);
                                const unit = getUnitForBooking(b);
                                const nights = getNightCount(b.arrival, b.departure);
                                const net = calculateNetPayout(
                                    Number(b.price) || 0,
                                    b.apiSourceId,
                                    0,
                                    b.bookingTime,
                                    b.roomId,
                                    Boolean(b.isChicken)
                                );
                                const guestName = `${b.firstName || ''} ${b.lastName || ''}`.trim() || '게스트';

                                return (
                                    <div
                                        key={b.id}
                                        className="px-2.5 py-2 rounded-lg bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/70 flex items-center justify-between gap-2 text-xs"
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: ch.bg }}
                                            />
                                            <span className="font-bold text-gray-900 dark:text-slate-100 truncate">
                                                {guestName}
                                            </span>
                                            <span className="text-[10px] text-gray-500 dark:text-slate-400 shrink-0">
                                                {unit ? `${unit.propName} ${unit.displayName}` : '미배정'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                                            <span className="text-gray-500 dark:text-slate-400 hidden sm:inline">
                                                {b.arrival.slice(5)}~{b.departure.slice(5)} ({nights}박)
                                            </span>
                                            <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                                                {net.toLocaleString()}원
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
