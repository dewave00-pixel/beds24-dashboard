'use client';

import { Booking } from '../../types';
import { ALL_UNITS, getChannelStyle, parseBookingTag } from '../../config';

interface BookingNoteData {
    note: string;
    tags: string[];
}

interface TotalNotesModalProps {
    bookings: Booking[];
    bookingNotes: Record<string | number, BookingNoteData>;
    onClose: () => void;
    onSelectBooking: (booking: Booking) => void;
}

export default function TotalNotesModal({
    bookings,
    bookingNotes,
    onClose,
    onSelectBooking,
}: TotalNotesModalProps) {
    // 호실 이름 찾아주는 헬퍼 함수
    const getUnitName = (booking: Booking) => {
        const matched = ALL_UNITS.find(
            (u) => Number(booking.roomId) === u.roomId && (u.unitId ? Number(booking.unitId) === u.unitId : true)
        );
        return matched ? `${matched.displayName} ${matched.subName ? `(${matched.subName})` : ''}` : '호실 미정';
    };

    // 📌 텍스트 메모가 있거나, 4대 태그 중 하나라도 걸려 있는 예약만 100% 필터링
    const notedBookings = bookings.filter((b) => {
        const data = bookingNotes[b.id] || bookingNotes[Number(b.id)] || bookingNotes[String(b.id)];
        if (!data) return false;
        const hasTextNote = Boolean(data.note && data.note.trim().length > 0);
        const hasTags = Boolean(data.tags && data.tags.length > 0);
        return hasTextNote || hasTags;
    });

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] border border-gray-300">

                {/* 상단 헤더 */}
                <div className="p-3.5 bg-amber-500 text-white flex items-center justify-between shadow">
                    <div className="flex items-center gap-2">
                        <span className="text-base md:text-lg font-black flex items-center gap-1">
                            <span>🔥</span> 전체 특이사항 및 빠른 태그 모아보기
                        </span>
                        <span className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full font-black">
                            총 {notedBookings.length}건
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-base font-extrabold hover:bg-amber-600 px-2.5 py-1 rounded transition"
                    >
                        ✕
                    </button>
                </div>

                {/* 본문 리스트 영역 (모바일 최적화 스크롤) */}
                <div className="p-3 md:p-5 overflow-y-auto flex flex-col gap-2.5">
                    {notedBookings.length === 0 ? (
                        <div className="text-center py-12 text-xs md:text-sm text-gray-400 font-bold bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            현재 등록된 특이사항 메모나 상태 옵션 태그가 없습니다.
                        </div>
                    ) : (
                        notedBookings.map((b) => {
                            const ch = getChannelStyle(b.apiSourceId);
                            const guestName =
                                b.firstName || b.lastName
                                    ? `${b.firstName || ''} ${b.lastName || ''}`.trim()
                                    : '이름 없음';

                            const noteData = bookingNotes[b.id] || bookingNotes[Number(b.id)] || bookingNotes[String(b.id)];
                            const memoText = noteData?.note || '';
                            const tags = noteData?.tags || [];

                            return (
                                <div
                                    key={b.id}
                                    onClick={() => onSelectBooking(b)}
                                    className="p-3 bg-white rounded-lg border border-gray-300 shadow-sm hover:border-amber-500 hover:shadow-md transition cursor-pointer flex flex-col gap-1.5"
                                >
                                    {/* 상단: 호실명 + 예약채널 + 일정 */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-black text-xs md:text-sm text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                                                {getUnitName(b)}
                                            </span>
                                            <span className="font-extrabold text-sm text-gray-900">
                                                {guestName}
                                            </span>
                                        </div>

                                        <span
                                            className="text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-sm"
                                            style={{ backgroundColor: ch.bg, color: ch.text }}
                                        >
                                            {ch.name}
                                        </span>
                                    </div>

                                    {/* 중단: 체크인/아웃 날짜 및 태그들 */}
                                    <div className="flex items-center justify-between text-xs text-gray-600 font-bold border-t border-gray-100 pt-2">
                                        <span>
                                            {b.arrival} ~ {b.departure}
                                        </span>

                                        <div className="flex flex-wrap gap-1">
                                            {tags.map((tagKey) => {
                                                const tagInfo = parseBookingTag(tagKey);
                                                if (!tagInfo) return null;
                                                return (
                                                    <span
                                                        key={tagKey}
                                                        className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded bg-gray-800 text-white shadow-sm"
                                                    >
                                                        {tagInfo.label}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 하단: 특이사항 메모 텍스트 */}
                                    {memoText && (
                                        <div className="p-2 bg-yellow-50 border border-yellow-300 rounded text-xs font-bold text-gray-900 flex items-start gap-1.5">
                                            <span className="shrink-0 font-black text-amber-700">메모:</span>
                                            <span className="break-all">{memoText}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 하단 닫기 바 */}
                <div className="p-3 bg-gray-100 border-t border-gray-300 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-xs font-black text-gray-700 bg-white hover:bg-gray-200 rounded-lg border border-gray-300 shadow-sm transition"
                    >
                        닫기
                    </button>
                </div>

            </div>
        </div>
    );
}