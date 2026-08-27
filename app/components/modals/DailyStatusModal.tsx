'use client';

import { useState } from 'react';
import { Booking } from '../../types';
import DailyBookingCard from './DailyBookingCard';
import DailyModalTabs from './DailyModalTabs';

interface BookingNoteData {
    note: string;
    tags: string[];
}

interface DailyStatusModalProps {
    title: string;
    dateStr: string;
    checkInBookings: Booking[];
    checkOutBookings: Booking[];
    bookingNotes: Record<string | number, BookingNoteData>;
    onClose: () => void;
    onSelectBooking: (booking: Booking) => void;
}

export default function DailyStatusModal({
    title,
    dateStr,
    checkInBookings,
    checkOutBookings,
    bookingNotes,
    onClose,
    onSelectBooking,
}: DailyStatusModalProps) {
    const [mobileTab, setMobileTab] = useState<'checkIn' | 'checkOut'>('checkIn');

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2.5 md:p-6 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">

                {/* 1. 상단 모달 타이틀 바 */}
                <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📅</span>
                        <div>
                            <h2 className="text-sm md:text-base font-black leading-tight">{title}</h2>
                            <span className="text-[11px] text-slate-400 font-bold">{dateStr} 기준 현황</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-black text-sm cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* 2. 📱 모바일 전용 탭 전환 버튼 (PC에선 CSS로 100% 강제 숨김) */}
                <div className="daily-modal-tabs-wrap p-2.5 bg-gray-50 border-b border-gray-200 shrink-0">
                    <DailyModalTabs
                        activeTab={mobileTab}
                        checkInCount={checkInBookings.length}
                        checkOutCount={checkOutBookings.length}
                        onTabChange={setMobileTab}
                    />
                </div>

                {/* 3. 모달 본문 영역 */}
                <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-gray-100 min-h-0">

                    {/* 🖥️ PC 전용: 정확한 50:50 좌우 반반 분할 뷰 */}
                    <div className="daily-modal-desktop">

                        {/* 좌측 50%: 체크인 컬럼 */}
                        <div className="daily-modal-col-half flex flex-col gap-2.5 bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between pb-2 border-b-2 border-blue-500">
                                <span className="font-black text-sm text-blue-900 flex items-center gap-1">
                                    <span>📥</span> 오늘 체크인
                                </span>
                                <span className="text-xs font-black bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                                    {checkInBookings.length}건
                                </span>
                            </div>

                            <div className="flex flex-col gap-2 max-h-[58vh] overflow-y-auto pr-1">
                                {checkInBookings.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 font-bold text-xs bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                        체크인 예정 예약이 없습니다.
                                    </div>
                                ) : (
                                    checkInBookings.map((b) => (
                                        <DailyBookingCard
                                            key={`pc-in-${b.id}`}
                                            booking={b}
                                            type="checkIn"
                                            bookingNotes={bookingNotes}
                                            onSelectBooking={onSelectBooking}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 우측 50%: 체크아웃 컬럼 */}
                        <div className="daily-modal-col-half flex flex-col gap-2.5 bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between pb-2 border-b-2 border-orange-500">
                                <span className="font-black text-sm text-orange-900 flex items-center gap-1">
                                    <span>📤</span> 오늘 체크아웃
                                </span>
                                <span className="text-xs font-black bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full">
                                    {checkOutBookings.length}건
                                </span>
                            </div>

                            <div className="flex flex-col gap-2 max-h-[58vh] overflow-y-auto pr-1">
                                {checkOutBookings.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 font-bold text-xs bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                        체크아웃 예정 예약이 없습니다.
                                    </div>
                                ) : (
                                    checkOutBookings.map((b) => (
                                        <DailyBookingCard
                                            key={`pc-out-${b.id}`}
                                            booking={b}
                                            type="checkOut"
                                            bookingNotes={bookingNotes}
                                            onSelectBooking={onSelectBooking}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                    </div>

                    {/* 📱 모바일 전용: 선택된 탭 1열 목록 */}
                    <div className="daily-modal-mobile">
                        {mobileTab === 'checkIn' ? (
                            checkInBookings.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 font-bold text-xs bg-white rounded-xl border border-dashed border-gray-300">
                                    체크인 예정 예약이 없습니다.
                                </div>
                            ) : (
                                checkInBookings.map((b) => (
                                    <DailyBookingCard
                                        key={`mob-in-${b.id}`}
                                        booking={b}
                                        type="checkIn"
                                        bookingNotes={bookingNotes}
                                        onSelectBooking={onSelectBooking}
                                    />
                                ))
                            )
                        ) : (
                            checkOutBookings.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 font-bold text-xs bg-white rounded-xl border border-dashed border-gray-300">
                                    체크아웃 예정 예약이 없습니다.
                                </div>
                            ) : (
                                checkOutBookings.map((b) => (
                                    <DailyBookingCard
                                        key={`mob-out-${b.id}`}
                                        booking={b}
                                        type="checkOut"
                                        bookingNotes={bookingNotes}
                                        onSelectBooking={onSelectBooking}
                                    />
                                ))
                            )
                        )}
                    </div>

                </div>

                {/* 4. 하단 닫기 바 */}
                <div className="p-3 bg-white border-t border-gray-200 flex justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 bg-gray-800 hover:bg-black text-white font-black text-xs rounded-lg transition cursor-pointer"
                    >
                        닫기
                    </button>
                </div>

            </div>
        </div>
    );
}