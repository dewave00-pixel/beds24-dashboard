'use client';

import React from 'react';
import { Booking } from '../../types';
import { getChannelStyle } from '../../config';
import { getUnitForBooking, isUnallocatedBooking } from '../../utils/bookingUtils';

interface OverlappingSelectionModalProps {
    dateStr: string;
    bookings: Booking[];
    onSelect: (booking: Booking) => void;
    onClose: () => void;
}

export default function OverlappingSelectionModal({
    dateStr,
    bookings,
    onSelect,
    onClose,
}: OverlappingSelectionModalProps) {
    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200">
                {/* 상단 헤더 */}
                <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">겹침</span>
                        <div>
                            <h3 className="text-sm font-black text-white leading-tight">
                                예약 선택 ({bookings.length}건)
                            </h3>
                            <p className="text-[11px] text-gray-300 font-bold">
                                {dateStr} 날짜에 겹쳐있는 예약 목록
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white font-black text-xs cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* 목록 선택 버튼들 */}
                <div className="p-3.5 bg-gray-50 flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto">
                    {bookings.map((b) => {
                        const isUnalloc = isUnallocatedBooking(b);
                        const ch = getChannelStyle(b.apiSourceId);
                        const guestName = (b.firstName || b.lastName)
                            ? `${b.firstName || ''} ${b.lastName || ''}`.trim()
                            : `예약 #${b.id}`;
                        const unit = getUnitForBooking(b);

                        return (
                            <button
                                key={`overlap-item-${b.id}`}
                                type="button"
                                onClick={() => {
                                    onSelect(b);
                                    onClose();
                                }}
                                className={`w-full p-3 rounded-xl border-2 text-left transition cursor-pointer flex flex-col gap-1.5 shadow-2xs hover:scale-[1.02] ${
                                    isUnalloc
                                        ? 'bg-amber-50/80 border-amber-400 hover:bg-amber-100/90 text-amber-950'
                                        : 'bg-white border-blue-300 hover:bg-blue-50 text-slate-900'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span
                                        className={`text-[10px] font-black px-1.5 py-0.5 rounded shadow-2xs ${
                                            isUnalloc
                                                ? 'bg-amber-500 text-slate-950 animate-pulse'
                                                : 'bg-blue-600 text-white'
                                        }`}
                                    >
                                        {isUnalloc ? '⚠️ 호실 미배정' : `🏠 ${unit?.displayName || '배정됨'}`}
                                    </span>

                                    <span
                                        className="text-[9px] font-black px-1 rounded truncate shadow-2xs"
                                        style={{ backgroundColor: ch.bg, color: ch.text }}
                                    >
                                        {ch.name}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black truncate">
                                        {guestName}
                                    </span>
                                    <span className="text-[10px] font-bold opacity-75">
                                        #{b.id}
                                    </span>
                                </div>

                                <div className="text-[10px] font-bold text-gray-600 flex items-center justify-between">
                                    <span>📅 {b.arrival} ~ {b.departure}</span>
                                    <span className="text-blue-600 font-black">상세보기 ➔</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* 풋터 */}
                <div className="px-4 py-2.5 bg-white border-t border-gray-200 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-black rounded-lg transition cursor-pointer"
                    >
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
}
