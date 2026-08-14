'use client';

import { useState, useEffect } from 'react';
import { Booking } from '../types';
import { getChannelStyle, parseBookingTag, getUnitDisplayInfo } from '../config';

interface BookingNoteData {
    note: string;
    tags: string[];
}

interface DailyStatusModalProps {
    title: string;
    dateStr: string;
    checkInBookings: Booking[];
    checkOutBookings: Booking[];
    bookingNotes: { [bookingId: number]: BookingNoteData };
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
    // 📱 모바일 전용 탭 상태
    const [mobileTab, setMobileTab] = useState<'checkin' | 'checkout'>('checkin');

    // 🖥️/📱 화면 크기 실시간 완벽 감지 (768px 기준)
    const [isMobile, setIsMobile] = useState<boolean>(false);

    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    // 단일 예약 카드 렌더링 서브 모듈 (슬림 콤팩트 폰트 적용)
    const renderBookingCard = (booking: Booking, type: 'checkin' | 'checkout') => {
        const ch = getChannelStyle(booking.apiSourceId);
        const guestName =
            booking.firstName || booking.lastName
                ? `${booking.firstName || ''} ${booking.lastName || ''}`.trim()
                : '이름 없음';

        // config 표준 모듈 함수를 통해 숙소명, 호실명, 초고대비 뱃지 스타일 추출
        const { propertyName, unitDisplayName, subName, badgeStyle } = getUnitDisplayInfo(booking);
        const fullUnitName = `${unitDisplayName}${subName ? `(${subName})` : ''}`;

        const noteData = bookingNotes[booking.id];
        const memo = noteData?.note || '';
        const tags = noteData?.tags || [];

        return (
            <div
                key={booking.id}
                onClick={() => onSelectBooking(booking)}
                className="p-2 bg-white rounded-lg border border-gray-300 shadow-sm hover:border-blue-500 hover:shadow-md transition cursor-pointer flex flex-col gap-1 overflow-hidden"
            >
                {/* 📌 1. 최상단: [숙소명] [호실명] [예약자명] + [채널 뱃지] (폰트 슬림화) */}
                <div className="flex items-start justify-between gap-1">
                    <div className="flex flex-wrap items-center gap-1 min-w-0 grow">

                        {/* 🎨 슬림하고 선명한 숙소명 뱃지 */}
                        <span
                            style={badgeStyle}
                            className="text-[9px] font-black px-1.5 py-0.2 rounded shadow-sm shrink-0 border border-black/10"
                        >
                            {propertyName}
                        </span>

                        {/* 슬림 호실명 뱃지 */}
                        <span className="font-black text-[10px] text-gray-950 bg-gray-200 border border-gray-300 px-1.5 py-0.2 rounded shrink-0">
                            {fullUnitName}
                        </span>

                        {/* 예약자명 + 인원수 */}
                        <div className="flex items-center gap-0.5 truncate">
                            <span className="font-extrabold text-[10.5px] md:text-[11px] text-gray-900 truncate">
                                📥 {guestName}
                            </span>
                            <span className="text-[9px] text-gray-500 font-bold shrink-0">
                                ({booking.numAdult || 1}명)
                            </span>
                        </div>
                    </div>

                    {/* 예약 사이트 채널 뱃지 */}
                    <span
                        className="text-[8px] md:text-[8.5px] font-black px-1.5 py-0.2 rounded shadow-sm shrink-0 ml-0.5"
                        style={{ backgroundColor: ch.bg, color: ch.text }}
                    >
                        {ch.name}
                    </span>
                </div>

                {/* 📌 2. 숙소/호실/이름 바로 밑: 슬림화된 빠른 태그들 가로 나열 */}
                {tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-0.5 pt-0.5 border-t border-gray-100">
                        {tags.map((tagKey) => {
                            const tagInfo = parseBookingTag(tagKey);
                            if (!tagInfo) return null;

                            const isEarly = tagKey.startsWith('early_');
                            const isLate = tagKey.startsWith('late_');
                            const badgeBg = isEarly
                                ? 'bg-blue-600 text-white border-blue-700'
                                : isLate
                                    ? 'bg-indigo-600 text-white border-indigo-700'
                                    : 'bg-gray-800 text-white border-gray-900';

                            return (
                                <span
                                    key={tagKey}
                                    className={`text-[7.5px] md:text-[8px] font-black px-1 py-0.2 rounded shadow-sm flex items-center gap-0.5 shrink-0 border ${badgeBg}`}
                                >
                                    <span>{tagInfo.icon}</span>
                                    <span>{tagInfo.label}</span>
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* 📌 3. 최하단: 특이사항 메모 (콤팩트 폰트 노란 박스) */}
                {memo && (
                    <div className="p-1.5 bg-yellow-50 border border-yellow-300 rounded text-[9.5px] md:text-[10px] font-bold text-gray-900 flex items-start gap-1">
                        <span className="shrink-0">🔥</span>
                        <span className="break-all line-clamp-2 leading-tight">{memo}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-1.5 md:p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col max-h-[94vh] border border-gray-300">

                {/* 모달 상단 헤더 */}
                <div className="p-3 md:p-3.5 bg-slate-900 text-white flex items-center justify-between shadow">
                    <div className="flex items-center gap-2">
                        <span className="text-sm md:text-base font-black">{title}</span>
                        <span className="text-[10.5px] md:text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold">
                            📅 {dateStr}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-sm md:text-base font-extrabold hover:bg-slate-800 px-2.5 py-1 rounded transition"
                    >
                        ✕
                    </button>
                </div>

                {/* 📱 모바일(화면 폭 768px 미만)일 때만 탭 전환 노출 */}
                {isMobile && (
                    <div className="flex border-b border-gray-200 bg-gray-100 p-1.5 gap-1.5">
                        <button
                            type="button"
                            onClick={() => setMobileTab('checkin')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${mobileTab === 'checkin'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'bg-white text-gray-700 border border-gray-300'
                                }`}
                        >
                            <span>📥 입실 (체크인)</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[9.5px] bg-black/20 font-black">
                                {checkInBookings.length}건
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setMobileTab('checkout')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${mobileTab === 'checkout'
                                    ? 'bg-orange-600 text-white shadow'
                                    : 'bg-white text-gray-700 border border-gray-300'
                                }`}
                        >
                            <span>📤 퇴실 (체크아웃)</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[9.5px] bg-black/20 font-black">
                                {checkOutBookings.length}건
                            </span>
                        </button>
                    </div>
                )}

                {/* 본문 리스트 영역 */}
                <div className="p-2 md:p-3 overflow-y-auto grow">

                    {/* 🖥️ PC 뷰 (768px 이상): 100% 좌/우 50:50 2열 분할 작동 */}
                    {!isMobile ? (
                        <div className="grid grid-cols-2 gap-3">

                            {/* 좌측: 입실 리스트 */}
                            <div className="flex flex-col gap-1.5">
                                <div className="p-1.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                                    <span className="font-black text-xs text-blue-900 flex items-center gap-1">
                                        <span>📥</span> 입실 (체크인) 목록
                                    </span>
                                    <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded-full">
                                        총 {checkInBookings.length}건
                                    </span>
                                </div>

                                <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[64vh] pr-1">
                                    {checkInBookings.length === 0 ? (
                                        <div className="text-center py-8 text-xs text-gray-400 font-bold bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                            입실 예정 예약이 없습니다.
                                        </div>
                                    ) : (
                                        checkInBookings.map((b) => renderBookingCard(b, 'checkin'))
                                    )}
                                </div>
                            </div>

                            {/* 우측: 퇴실 리스트 */}
                            <div className="flex flex-col gap-1.5">
                                <div className="p-1.5 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
                                    <span className="font-black text-xs text-orange-900 flex items-center gap-1">
                                        <span>📤</span> 퇴실 (체크아웃) 목록
                                    </span>
                                    <span className="text-[10px] font-black text-orange-700 bg-orange-100 px-1.5 py-0.2 rounded-full">
                                        총 {checkOutBookings.length}건
                                    </span>
                                </div>

                                <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[64vh] pr-1">
                                    {checkOutBookings.length === 0 ? (
                                        <div className="text-center py-8 text-xs text-gray-400 font-bold bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                            퇴실 예정 예약이 없습니다.
                                        </div>
                                    ) : (
                                        checkOutBookings.map((b) => renderBookingCard(b, 'checkout'))
                                    )}
                                </div>
                            </div>

                        </div>
                    ) : (
                        /* 📱 모바일 뷰 (768px 미만): 탭 전환에 맞춰 1열 와이드 노출 */
                        <div className="flex flex-col gap-1.5">
                            {mobileTab === 'checkin' ? (
                                checkInBookings.length === 0 ? (
                                    <div className="text-center py-8 text-xs text-gray-400 font-bold bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                        입실 예정 예약이 없습니다.
                                    </div>
                                ) : (
                                    checkInBookings.map((b) => renderBookingCard(b, 'checkin'))
                                )
                            ) : (
                                checkOutBookings.length === 0 ? (
                                    <div className="text-center py-8 text-xs text-gray-400 font-bold bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                        퇴실 예정 예약이 없습니다.
                                    </div>
                                ) : (
                                    checkOutBookings.map((b) => renderBookingCard(b, 'checkout'))
                                )
                            )}
                        </div>
                    )}

                </div>

                {/* 하단 닫기 바 */}
                <div className="p-2.5 md:p-3 bg-gray-100 border-t border-gray-300 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 md:px-5 py-1.5 text-xs font-black text-gray-700 bg-white hover:bg-gray-200 rounded-lg border border-gray-300 shadow-sm transition"
                    >
                        닫기
                    </button>
                </div>

            </div>
        </div>
    );
}