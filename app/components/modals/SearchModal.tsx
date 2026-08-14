'use client';

import { useState, useMemo } from 'react';
import { Booking } from '../../types';
import { getChannelStyle, getUnitDisplayInfo } from '../../config';

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

    // 🔍 스마트 다중 검색 필터링 모듈 (이름, 예약번호, 숙소/호실, 대시 없는 숫자 날짜 지원)
    const filteredBookings = useMemo(() => {
        const rawQuery = searchTerm.trim().toLowerCase();
        if (!rawQuery) return [];

        // 숫자만 추출한 검색어 (예: "2026-08-14" 또는 "20260814" -> "20260814")
        const digitsOnlyQuery = rawQuery.replace(/\D/g, '');

        return bookings.filter((b) => {
            const guestName = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
            const bookingIdStr = String(b.id);
            const ch = getChannelStyle(b.apiSourceId);
            const unitInfo = getUnitDisplayInfo(b);

            // 날짜 데이터에서 대시 뺀 순수 숫자 문자열
            const arrivalDigits = b.arrival.replace(/-/g, ''); // "20260814"
            const departureDigits = b.departure.replace(/-/g, ''); // "20260815"

            // 1. 게스트 이름 검색
            if (guestName.includes(rawQuery)) return true;

            // 2. 예약 번호 검색
            if (bookingIdStr.includes(rawQuery)) return true;

            // 3. 숙소명 및 호실명 검색
            if (
                unitInfo.propertyName.toLowerCase().includes(rawQuery) ||
                unitInfo.unitDisplayName.toLowerCase().includes(rawQuery) ||
                (unitInfo.subName && unitInfo.subName.toLowerCase().includes(rawQuery))
            ) {
                return true;
            }

            // 4. 예약 사이트 채널명 검색 (Airbnb, Agoda 등)
            if (ch.name.toLowerCase().includes(rawQuery)) return true;

            // 5. 일반 날짜 검색 (예: "2026-08" 등)
            if (b.arrival.includes(rawQuery) || b.departure.includes(rawQuery)) return true;

            // 📌 6. 대시 없는 숫자 날짜 검색 (예: "20260814", "0814", "260814" 등 2자리 이상)
            if (digitsOnlyQuery.length >= 2) {
                if (
                    arrivalDigits.includes(digitsOnlyQuery) ||
                    departureDigits.includes(digitsOnlyQuery)
                ) {
                    return true;
                }
            }

            return false;
        });
    }, [bookings, searchTerm]);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] border border-gray-300">

                {/* 상단 헤더 */}
                <div className="p-3.5 bg-blue-600 text-white flex items-center justify-between shadow">
                    <div className="flex items-center gap-2">
                        <span className="text-base md:text-lg font-black flex items-center gap-1.5">
                            <span>🔍</span> 통합 예약 검색
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-base font-extrabold hover:bg-blue-700 px-2.5 py-1 rounded transition"
                    >
                        ✕
                    </button>
                </div>

                {/* 검색 입력창 영역 */}
                <div className="p-3 md:p-4 bg-gray-50 border-b border-gray-200 flex flex-col gap-1.5">
                    <div className="relative">
                        <input
                            type="text"
                            autoFocus
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="예약자명, 숙소/호실, 날짜(예: 0814 또는 20260814), 예약번호"
                            className="w-full pl-9 pr-8 py-2.5 bg-white border-2 border-gray-300 focus:border-blue-600 rounded-lg text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:outline-none shadow-sm transition"
                        />
                        <span className="absolute left-3 top-3 text-gray-400 text-sm">🔍</span>
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 font-bold text-sm p-0.5"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1 pl-1">
                        <span>💡</span>
                        <span>날짜 검색 시 대시(-) 없이 <strong>0814</strong> 또는 <strong>20260814</strong> 처럼 숫자만 입력해도 검색됩니다.</span>
                    </div>
                </div>

                {/* 검색 결과 리스트 본문 */}
                <div className="p-3 md:p-4 overflow-y-auto flex flex-col gap-2 grow">
                    {!searchTerm.trim() ? (
                        <div className="text-center py-12 text-xs md:text-sm text-gray-400 font-bold bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            검색어를 입력하시면 실시간으로 예약이 검색됩니다.
                        </div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="text-center py-12 text-xs md:text-sm text-gray-400 font-bold bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            &apos;{searchTerm}&apos;에 해당하는 예약 검색 결과가 없습니다.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-black text-blue-900 px-1 flex items-center justify-between">
                                <span>검색 결과</span>
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black text-[10.5px]">
                                    총 {filteredBookings.length}건
                                </span>
                            </div>

                            {filteredBookings.map((b) => {
                                const ch = getChannelStyle(b.apiSourceId);
                                const guestName =
                                    b.firstName || b.lastName
                                        ? `${b.firstName || ''} ${b.lastName || ''}`.trim()
                                        : '이름 없음';

                                const { propertyName, unitDisplayName, subName, badgeStyle } = getUnitDisplayInfo(b);
                                const fullUnitName = `${unitDisplayName}${subName ? `(${subName})` : ''}`;

                                return (
                                    <div
                                        key={b.id}
                                        onClick={() => onSelectBooking(b)}
                                        className="p-2.5 md:p-3 bg-white rounded-lg border border-gray-300 shadow-sm hover:border-blue-500 hover:shadow-md transition cursor-pointer flex flex-col gap-1.5"
                                    >
                                        {/* 상단: 숙소명 + 호실 + 예약자명 + 채널 뱃지 */}
                                        <div className="flex items-start justify-between gap-1.5">
                                            <div className="flex flex-wrap items-center gap-1.5 min-w-0 grow">
                                                {/* 숙소명 뱃지 */}
                                                <span
                                                    style={badgeStyle}
                                                    className="text-[9.5px] font-black px-1.5 py-0.2 rounded shadow-sm shrink-0 border border-black/10"
                                                >
                                                    {propertyName}
                                                </span>

                                                {/* 호실명 뱃지 */}
                                                <span className="font-black text-xs md:text-sm text-gray-950 bg-gray-200 border border-gray-300 px-2 py-0.5 rounded shrink-0">
                                                    {fullUnitName}
                                                </span>

                                                {/* 예약자명 */}
                                                <div className="flex items-center gap-1 truncate">
                                                    <span className="font-black text-xs md:text-sm text-gray-900 truncate">
                                                        📥 {guestName}
                                                    </span>
                                                    <span className="text-[10px] md:text-xs text-gray-600 font-extrabold shrink-0">
                                                        ({b.numAdult || 1}명)
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

                                        {/* 하단: 일정 정보 및 예약 번호 */}
                                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] md:text-xs text-gray-600 font-bold bg-gray-50 p-2 rounded border border-gray-200">
                                            <div>
                                                📅 <strong className="text-blue-700">{b.arrival}</strong> ~ <strong className="text-orange-700">{b.departure}</strong>
                                            </div>
                                            <div className="text-gray-400 font-medium text-[10px] md:text-[11px]">
                                                예약 #{b.id}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 하단 닫기 바 */}
                <div className="p-3 bg-gray-100 border-t border-gray-300 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-1.5 md:py-2 text-xs font-black text-gray-700 bg-white hover:bg-gray-200 rounded-lg border border-gray-300 shadow-sm transition"
                    >
                        닫기
                    </button>
                </div>

            </div>
        </div>
    );
}