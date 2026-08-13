'use client';

import { Booking } from '../types';
import { getChannelStyle } from '../config';

interface BookingModalProps {
    booking: Booking;
    memoInput: string;
    setMemoInput: (value: string) => void;
    onSave: () => void;
    onDelete: () => void;
    onClose: () => void;
}

export default function BookingModal({
    booking,
    memoInput,
    setMemoInput,
    onSave,
    onDelete,
    onClose,
}: BookingModalProps) {
    const guestName =
        booking.firstName || booking.lastName
            ? `${booking.firstName || ''} ${booking.lastName || ''}`.trim()
            : `예약 #${booking.id}`;

    const channelInfo = getChannelStyle(booking.apiSourceId);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                {/* 모달 상단 헤더 */}
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="text-lg font-bold text-gray-900">예약 상세 및 메모</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* 예약 기본 정보 */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between">
                        <span className="font-semibold text-gray-500">예약자 성함:</span>
                        <span className="font-bold text-gray-900">{guestName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-semibold text-gray-500">예약 채널:</span>
                        <span className="font-bold text-blue-600">{channelInfo.name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-semibold text-gray-500">투숙 기간:</span>
                        <span className="font-bold text-gray-900">
                            {booking.arrival} ~ {booking.departure}
                        </span>
                    </div>
                </div>

                {/* 메모 입력 칸 */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                        📝 관리자 특이사항 메모
                    </label>
                    <textarea
                        value={memoInput}
                        onChange={(e) => setMemoInput(e.target.value)}
                        placeholder="예: 얼리 체크인 요청, 레이트 체크아웃, 청소 특이사항 등 메모를 남겨주세요."
                        className="w-full h-28 p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* 하단 버튼 영역 */}
                <div className="flex justify-between gap-2 pt-2">
                    <button
                        onClick={onDelete}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition"
                    >
                        메모 삭제
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50"
                        >
                            취소
                        </button>
                        <button
                            onClick={onSave}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow"
                        >
                            메모 저장
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}