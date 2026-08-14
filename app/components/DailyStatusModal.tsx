'use client';

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

    // 단일 예약 카드 렌더링 서브 모듈
    const renderBookingCard = (booking: Booking, type: 'checkin' | 'checkout') => {
        const ch = getChannelStyle(booking.apiSourceId);
        const guestName =
            booking.firstName || booking.lastName
                ? `${booking.firstName || ''} ${booking.lastName || ''}`.trim()
                : '이름 없음';

        // 📌 config의 표준 모듈 함수를 통해 정확한 숙소명과 호실명 추출
        const { propertyName, unitDisplayName, subName, themeClass } = getUnitDisplayInfo(booking);
        const fullUnitName = `${unitDisplayName}${subName ? `(${subName})` : ''}`;

        const noteData = bookingNotes[booking.id];
        const memo = noteData?.note || '';
        const tags = noteData?.tags || [];

        return (
            <div
                key={booking.id}
                onClick={() => onSelectBooking(booking)}
                className="p-2 md:p-2.5 bg-white rounded-lg border border-gray-300 shadow-sm hover:border-blue-500 hover:shadow-md transition cursor-pointer flex flex-col gap-1.5 overflow-hidden"
            >
                {/* 📌 1. 최상단: [숙소명] [호실명] [예약자명] 나란히 정렬 + 우측 [채널 뱃지] */}
                <div className="flex items-start justify-between gap-1">
                    <div className="flex flex-wrap items-center gap-1 min-w-0 grow">
                        {/* 숙소명 뱃지 */}
                        <span className={`text-[9px] md:text-[10px] font-black px-1.5 py-0.2 rounded shrink-0 shadow-sm ${themeClass}`}>
                            {propertyName}
                        </span>

                        {/* 숙소 호실 */}
                        <span className="font-black text-[11px] md:text-xs text-gray-900 bg-gray-100 px-1.5 py-0.2 rounded shrink-0">
                            {fullUnitName}
                        </span>

                        {/* 예약자명 + 인원 */}
                        <div className="flex items-center gap-0.5 truncate">
                            <span className="font-extrabold text-[11px] md:text-xs text-gray-900 truncate">
                                📥 {guestName}
                            </span>
                            <span className="text-[9.5px] md:text-[10.5px] text-gray-500 font-bold shrink-0">
                                ({booking.numAdult || 1}명)
                            </span>
                        </div>
                    </div>

                    {/* 예약 사이트 채널 뱃지 */}
                    <span
                        className="text-[8.5px] md:text-[9.5px] font-black px-1.5 py-0.2 rounded shadow-sm shrink-0 ml-1"
                        style={{ backgroundColor: ch.bg, color: ch.text }}
                    >
                        {ch.name}
                    </span>
                </div>

                {/* 📌 2. 숙소/호실/이름 바로 밑: 빠른 태그들 가로 나열 */}
                {tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-0.5 pt-0.5 border-t border-gray-100">
                        {tags.map((tagKey) => {
                            const tagInfo = parseBookingTag(tagKey);
                            if (!tagInfo) return null;

                            const isEarly = tagKey.startsWith('early_');
                            const isLate = tagKey.startsWith('late_');
                            const badgeBg = isEarly
                                ? 'bg-blue-600 text-white'
                                : isLate
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-800 text-white';

                            return (
                                <span
                                    key={tagKey}
                                    className={`text-[8px] md:text-[9px] font-black px-1.5 py-0.2 rounded shadow-sm flex items-center gap-0.5 shrink-0 ${badgeBg}`}
                                >
                                    <span>{tagInfo.icon}</span>
                                    <span>{tagInfo.label}</span>
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* 📌 3. 최하단: 특이사항 메모 (선명한 노란 박스) */}
                {memo && (
                    <div className="p-1.5 bg-yellow-50 border border-yellow-300 rounded text-[9.5px] md:text-[11px] font-bold text-gray-900 flex items-start gap-1">
                        <span className="shrink-0">🔥</span>
                        <span className="break-all line-clamp-2">{memo}</span>
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
                        <span className="text-sm md:text-lg font-black">{title}</span>
                        <span className="text-[11px] md:text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold">
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

                {/* 📌 본문 리스트: PC와 모바일 모두 좌/우 반반(50:50) 2열 분할 */}
                <div className="p-2 md:p-4 overflow-y-auto grow">
                    <div className="grid grid-cols-2 gap-2 md:gap-4">

                        {/* 좌측: 입실 (체크인) 목록 */}
                        <div className="flex flex-col gap-2">
                            <div className="p-1.5 md:p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                                <span className="font-black text-[11px] md:text-xs text-blue-900 flex items-center gap-1">
                                    <span>📥</span> 입실 (체크인)
                                </span>
                                <span className="text-[10px] md:text-xs font-black text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded-full">
                                    {checkInBookings.length}건
                                </span>
                            </div>

                            <div className="flex flex-col gap-1.5 md:gap-2 overflow-y-auto max-h-[65vh] pr-0.5">
                                {checkInBookings.length === 0 ? (
                                    <div className="text-center py-8 text-[11px] md:text-xs text-gray-400 font-bold bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                        입실 예약 없음
                                    </div>
                                ) : (
                                    checkInBookings.map((b) => renderBookingCard(b, 'checkin'))
                                )}
                            </div>
                        </div>

                        {/* 우측: 퇴실 (체크아웃) 목록 */}
                        <div className="flex flex-col gap-2">
                            <div className="p-1.5 md:p-2 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
                                <span className="font-black text-[11px] md:text-xs text-orange-900 flex items-center gap-1">
                                    <span>📤</span> 퇴실 (체크아웃)
                                </span>
                                <span className="text-[10px] md:text-xs font-black text-orange-700 bg-orange-100 px-1.5 py-0.2 rounded-full">
                                    {checkOutBookings.length}건
                                </span>
                            </div>

                            <div className="flex flex-col gap-1.5 md:gap-2 overflow-y-auto max-h-[65vh] pr-0.5">
                                {checkOutBookings.length === 0 ? (
                                    <div className="text-center py-8 text-[11px] md:text-xs text-gray-400 font-bold bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                        퇴실 예약 없음
                                    </div>
                                ) : (
                                    checkOutBookings.map((b) => renderBookingCard(b, 'checkout'))
                                )}
                            </div>
                        </div>

                    </div>
                </div>

                {/* 하단 닫기 바 */}
                <div className="p-2.5 md:p-3 bg-gray-100 border-t border-gray-300 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 md:px-5 py-1.5 md:py-2 text-xs font-black text-gray-700 bg-white hover:bg-gray-200 rounded-lg border border-gray-300 shadow-sm transition"
                    >
                        닫기
                    </button>
                </div>

            </div>
        </div>
    );
}