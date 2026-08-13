'use client';

import { useState } from 'react';
import { Booking } from '../types';
import { ALL_UNITS, getChannelStyle } from '../config';

interface SearchModalProps {
    bookings: Booking[];
    onClose: () => void;
    onSelectBooking: (booking: Booking) => void;
}

export default function SearchModal({
    bookings,
    onClose,
    onSelectBooking,
}: SearchModalProps) {
    const [searchTerm, setSearchTerm] = useState<string>('');

    // 숙소명 매핑 도우미 함수
    const getUnitDisplayName = (booking: Booking) => {
        const unit = ALL_UNITS.find(
            (u) =>
                u.roomId === Number(booking.roomId) &&
                (u.unitId ? u.unitId === Number(booking.unitId) : true)
        );
        if (!unit) return `호실 #${booking.roomId}`;
        return `${unit.propName} - ${unit.displayName}`;
    };

    // 1. 실시간 통합 필터링 검색
    const filteredBookings = bookings.filter((b) => {
        if (!searchTerm.trim()) return false;

        const term = searchTerm.toLowerCase().trim();
        const guestName = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
        const unitName = getUnitDisplayName(b).toLowerCase();
        const channelName = getChannelStyle(b.apiSourceId).name.toLowerCase();
        const arrival = b.arrival || '';
        const departure = b.departure || '';

        return (
            guestName.includes(term) ||
            unitName.includes(term) ||
            channelName.includes(term) ||
            arrival.includes(term) ||
            departure.includes(term)
        );
    });

    // 2. 날짜(입실일 arrival) 기준 오름차순 정렬
    filteredBookings.sort((a, b) => (a.arrival || '').localeCompare(b.arrival || ''));

    // 3. 날짜별 그룹화
    const groupedByDate: { [date: string]: Booking[] } = {};
    filteredBookings.forEach((b) => {
        const dateKey = b.arrival || '날짜 미정';
        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(b);
    });

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col p-6 space-y-4">
                {/* 모달 상단 헤더 */}
                <div className="flex justify-between items-center border-b pb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🔍</span>
                        <h3 className="text-lg font-bold text-gray-900">예약 통합 검색</h3>
                        {searchTerm.trim() && (
                            <span className="text-xs bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full">
                                검색 결과 {filteredBookings.length}건
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* 검색어 입력창 */}
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="고객명, 숙소명, 호실(101호), 날짜(2026-08-13), 채널명 검색..."
                        autoFocus
                        className="w-full p-3 pl-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                    <span className="absolute left-3 top-3.5 text-gray-400 text-sm">🔎</span>
                </div>

                {/* 검색 결과 목록 영역 (날짜별 나열) */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[250px]">
                    {!searchTerm.trim() ? (
                        <div className="text-center py-16 text-gray-400 text-sm">
                            💡 검색어를 입력하시면 날짜별로 정렬된 예약 목록이 표시됩니다.
                        </div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="text-center py-16 text-gray-400 text-sm">
                            검색 조건에 맞는 예약 내역이 없습니다.
                        </div>
                    ) : (
                        Object.keys(groupedByDate).map((date) => (
                            <div key={date} className="space-y-2">
                                {/* 날짜 분리 헤더 */}
                                <div className="text-xs font-extrabold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100 flex items-center gap-2">
                                    <span>📅 입실일: {date}</span>
                                </div>

                                {/* 해당 날짜의 예약 카드리스트 */}
                                <div className="space-y-2 pl-2">
                                    {groupedByDate[date].map((b) => {
                                        const guestName =
                                            b.firstName || b.lastName
                                                ? `${b.firstName || ''} ${b.lastName || ''}`.trim()
                                                : `예약 #${b.id}`;
                                        const channel = getChannelStyle(b.apiSourceId);
                                        const unitName = getUnitDisplayName(b);

                                        return (
                                            <div
                                                key={b.id}
                                                onClick={() => {
                                                    onSelectBooking(b);
                                                    onClose();
                                                }}
                                                className="p-3 bg-gray-50 hover:bg-blue-50/70 border border-gray-200 hover:border-blue-300 rounded-lg transition cursor-pointer flex justify-between items-center shadow-sm"
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-extrabold text-sm text-gray-900">
                                                            📥 {guestName}
                                                        </span>
                                                        <span
                                                            className="font-bold px-1.5 py-0.5 rounded text-[10px]"
                                                            style={{ backgroundColor: channel.bg, color: channel.text }}
                                                        >
                                                            {channel.name}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-600 font-semibold">
                                                        🏢 {unitName}
                                                    </div>
                                                </div>

                                                <div className="text-right space-y-0.5">
                                                    <div className="text-xs font-bold text-blue-600">
                                                        {b.arrival} ~ {b.departure}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 font-medium">
                                                        상세/메모 보기 ➔
                                                    </div>
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