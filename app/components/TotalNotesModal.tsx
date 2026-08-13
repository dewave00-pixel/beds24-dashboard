'use client';

import { Booking } from '../types';
import { ALL_UNITS, getChannelStyle } from '../config';

interface TotalNotesModalProps {
    bookings: Booking[];
    bookingMemos: { [bookingId: number]: string };
    onClose: () => void;
    onSelectBooking: (booking: Booking) => void;
}

export default function TotalNotesModal({
    bookings,
    bookingMemos,
    onClose,
    onSelectBooking,
}: TotalNotesModalProps) {
    // 메모가 존재하는 예약만 필터링
    const memoBookings = bookings.filter((b) => Boolean(bookingMemos[b.id]));

    // 체크인 날짜(arrival) 기준 오름차순 정렬
    memoBookings.sort((a, b) => a.arrival.localeCompare(b.arrival));

    // 날짜별 그룹화
    const groupedByDate: { [date: string]: Booking[] } = {};
    memoBookings.forEach((b) => {
        if (!groupedByDate[b.arrival]) {
            groupedByDate[b.arrival] = [];
        }
        groupedByDate[b.arrival].push(b);
    });

    // 호실 및 숙소 이름 매핑 함수
    const getUnitDisplayName = (booking: Booking) => {
        const unit = ALL_UNITS.find(
            (u) =>
                u.roomId === Number(booking.roomId) &&
                (u.unitId ? u.unitId === Number(booking.unitId) : true)
        );
        if (!unit) return `호실 #${booking.roomId}`;
        return `${unit.propName} - ${unit.displayName}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col p-6 space-y-4">
                {/* 모달 상단 헤더 */}
                <div className="flex justify-between items-center border-b pb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🔥</span>
                        <h3 className="text-lg font-bold text-gray-900">전체 특이사항 메모 모아보기</h3>
                        <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full">
                            총 {memoBookings.length}건
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* 특이사항 목록 영역 (스크롤 가능) */}
                <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                    {Object.keys(groupedByDate).length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">
                            등록된 특이사항 메모가 없습니다.
                        </div>
                    ) : (
                        Object.keys(groupedByDate).map((date) => (
                            <div key={date} className="space-y-2">
                                {/* 날짜 분리 헤더 */}
                                <div className="text-xs font-extrabold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100 flex items-center gap-2">
                                    <span>📅 입실일: {date}</span>
                                </div>

                                {/* 해당 날짜의 메모 카드 목록 */}
                                <div className="space-y-2 pl-2">
                                    {groupedByDate[date].map((b) => {
                                        const guestName =
                                            b.firstName || b.lastName
                                                ? `${b.firstName || ''} ${b.lastName || ''}`.trim()
                                                : `예약 #${b.id}`;
                                        const channel = getChannelStyle(b.apiSourceId);
                                        const memoText = bookingMemos[b.id];

                                        return (
                                            <div
                                                key={b.id}
                                                onClick={() => {
                                                    onSelectBooking(b);
                                                    onClose();
                                                }}
                                                className="p-3 bg-gray-50 hover:bg-amber-50/60 border border-gray-200 hover:border-amber-300 rounded-lg transition cursor-pointer flex flex-col gap-1.5 shadow-sm"
                                            >
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="font-extrabold text-gray-900">
                                                        🏢 {getUnitDisplayName(b)}
                                                    </span>
                                                    <span
                                                        className="font-bold px-1.5 py-0.5 rounded text-[10px]"
                                                        style={{ backgroundColor: channel.bg, color: channel.text }}
                                                    >
                                                        {channel.name}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between items-center text-xs text-gray-600">
                                                    <span className="font-bold text-gray-800">📥 {guestName}</span>
                                                    <span className="text-[11px] text-gray-500">
                                                        투숙: {b.arrival} ~ {b.departure}
                                                    </span>
                                                </div>

                                                <div className="bg-white p-2 rounded border border-amber-200 text-xs font-semibold text-amber-900 mt-1">
                                                    📝 {memoText}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* 하단 닫기 버튼 */}
                <div className="pt-2 border-t flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-lg transition"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}