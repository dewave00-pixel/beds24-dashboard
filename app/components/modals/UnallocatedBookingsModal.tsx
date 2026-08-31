'use client';

import { useState } from 'react';
import { Booking } from '../../types';
import { getUnitsForRoomId, getUnitForBooking, findConflictingBookings } from '../../utils/bookingUtils';
import { getChannelStyle } from '../../config';

interface BookingNoteData {
    note: string;
    tags: string[];
}

interface UnallocatedBookingsModalProps {
    bookings: Booking[];
    allBookings?: Booking[];
    bookingNotes: Record<string | number, BookingNoteData>;
    onClose: () => void;
    onAssignUnit: (bookingId: number, roomId: number, unitId: number) => Promise<{ success: boolean; error?: string }>;
    onSelectBooking: (booking: Booking) => void;
}

export default function UnallocatedBookingsModal({
    bookings,
    allBookings = [],
    bookingNotes,
    onClose,
    onAssignUnit,
    onSelectBooking,
}: UnallocatedBookingsModalProps) {
    // 각 예약별로 선택된 unitId 상태 관리: { [bookingId]: unitId }
    const [selectedUnits, setSelectedUnits] = useState<Record<number, number>>({});
    const [assigningId, setAssigningId] = useState<number | null>(null);
    const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const handleSelectUnit = (bookingId: number, unitId: number) => {
        setSelectedUnits((prev) => ({
            ...prev,
            [bookingId]: unitId,
        }));
    };

    const handleConfirmAssign = async (booking: Booking) => {
        const candidateUnits = getUnitsForRoomId(booking.roomId);
        const chosenUnitId = selectedUnits[booking.id] || (candidateUnits.length > 0 ? candidateUnits[0].unitId : undefined);

        if (!chosenUnitId || !booking.roomId) {
            alert('배정할 호실을 선택해 주세요.');
            return;
        }

        // 🛡️ 더블 부킹 사전 체크
        const conflicts = findConflictingBookings(booking, Number(booking.roomId), chosenUnitId, allBookings);
        if (conflicts.length > 0) {
            const c = conflicts[0];
            const cName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || `#${c.id}`;
            const ok = confirm(`⚠️ 더블 부킹 경고!\n해당 기간(${c.arrival} ~ ${c.departure})에 이미 [${cName}]님의 예약(#${c.id})이 배정되어 있습니다.\n\n정말 강제로 배정하시겠습니까? (권장하지 않음)`);
            if (!ok) return;
        }

        setAssigningId(booking.id);
        setFeedbackMessage(null);

        const result = await onAssignUnit(booking.id, Number(booking.roomId), chosenUnitId);

        setAssigningId(null);

        if (result.success) {
            setFeedbackMessage({
                text: `✅ 예약 #${booking.id} (${booking.firstName || ''}) 호실 배정이 Beds24에 성공적으로 완료되었습니다!`,
                type: 'success',
            });
            setTimeout(() => setFeedbackMessage(null), 4000);
        } else {
            setFeedbackMessage({
                text: `❌ 배정 실패: ${result.error || 'Beds24 통신 오류'}`,
                type: 'error',
            });
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">

                {/* 1. 모달 상단 헤더 */}
                <div className="px-5 py-4 bg-amber-500 text-slate-900 flex items-center justify-between border-b border-amber-600 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <span className="text-2xl">⚠️</span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base md:text-lg font-black leading-tight text-slate-950">
                                    미배정 예약 관리
                                </h2>
                                <span className="px-2 py-0.5 text-xs font-black bg-slate-900 text-amber-300 rounded-full">
                                    {bookings.length}건
                                </span>
                            </div>
                            <p className="text-xs text-slate-800 font-bold mt-0.5">
                                객실 타입만 지정되고 세부 호실이 배정되지 않은 예약입니다.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-600/60 hover:bg-amber-700 text-slate-900 hover:text-white transition font-black text-sm cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* 2. 피드백 알림 배너 */}
                {feedbackMessage && (
                    <div
                        className={`px-4 py-2.5 text-xs font-black flex items-center justify-between ${feedbackMessage.type === 'success'
                            ? 'bg-emerald-100 text-emerald-900 border-b border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border-b border-rose-300'
                            }`}
                    >
                        <span>{feedbackMessage.text}</span>
                        <button onClick={() => setFeedbackMessage(null)} className="text-sm font-bold opacity-70 hover:opacity-100">✕</button>
                    </div>
                )}

                {/* 3. 모달 본문 (미배정 목록) */}
                <div className="flex-1 overflow-y-auto p-3.5 md:p-5 bg-gray-50 flex flex-col gap-3.5 min-h-0">
                    {bookings.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300 p-6">
                            <span className="text-4xl block mb-2">🎉</span>
                            <h3 className="text-sm font-black text-gray-800">모든 예약의 호실 배정이 완료되었습니다!</h3>
                            <p className="text-xs text-gray-500 font-semibold mt-1">현재 미배정 상태인 예약이 없습니다.</p>
                        </div>
                    ) : (
                        bookings.map((b) => {
                            const candidateUnits = getUnitsForRoomId(b.roomId);
                            const fallbackUnit = getUnitForBooking(b);
                            const propName = candidateUnits[0]?.propName || fallbackUnit?.propName || '숙소';
                            const ch = getChannelStyle(b.apiSourceId);
                            const guestName = (b.firstName || b.lastName)
                                ? `${b.firstName || ''} ${b.lastName || ''}`.trim()
                                : `예약 #${b.id}`;

                            // 박수 계산
                            const arr = new Date(b.arrival);
                            const dep = new Date(b.departure);
                            const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24))) || 1;

                            const selectedUnitId = selectedUnits[b.id] || (candidateUnits.length > 0 ? candidateUnits[0].unitId : 1);
                            const isAssigning = assigningId === b.id;

                            return (
                                <div
                                    key={`unallocated-${b.id}`}
                                    className="bg-white rounded-xl border-2 border-amber-200 p-4 shadow-sm hover:border-amber-400 transition flex flex-col gap-3"
                                >
                                    {/* 상단 정보줄: 숙소명 + 채널 + 예약번호 */}
                                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                                                {propName}
                                            </span>
                                            <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                                🚨 호실 미배정 (Room {b.roomId})
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className="text-[10px] font-black px-2 py-0.5 rounded shadow-sm"
                                                style={{ backgroundColor: ch.bg, color: ch.text }}
                                            >
                                                {ch.name}
                                            </span>
                                            <span className="text-[11px] font-bold text-gray-400">#{b.id}</span>
                                        </div>
                                    </div>

                                    {/* 중간 정보줄: 게스트명, 날짜, 인원, 금액 */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 font-black text-gray-900">
                                                <span>👤</span>
                                                <span className="truncate">{guestName}</span>
                                                <span className="text-gray-500 font-bold">({b.numAdult || 1}명)</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-gray-600 font-bold">
                                                <span>📅</span>
                                                <span>{b.arrival} ~ {b.departure} ({nights}박)</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1 sm:items-end justify-center">
                                            {b.price ? (
                                                <div className="font-black text-slate-800 text-sm">
                                                    ₩{Number(b.price).toLocaleString()}
                                                </div>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() => onSelectBooking(b)}
                                                className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-0.5"
                                            >
                                                <span>🔍</span> 예약 상세 확인
                                            </button>
                                        </div>
                                    </div>

                                    {/* 하단: 배정할 호실 선택 및 Beds24 전송 버튼 */}
                                    <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                                        <div className="flex items-center gap-1.5 flex-1">
                                            <span className="text-xs font-black text-gray-700 shrink-0">배정 호실 선택:</span>
                                            <div className="flex items-center gap-1.5 flex-wrap flex-1">
                                                {candidateUnits.map((unit) => {
                                                    const isSelected = selectedUnitId === unit.unitId;
                                                    const conflictsForThisUnit = unit.unitId
                                                        ? findConflictingBookings(b, Number(b.roomId), unit.unitId, allBookings)
                                                        : [];
                                                    const hasConflict = conflictsForThisUnit.length > 0;

                                                    return (
                                                        <button
                                                            key={`cand-btn-${b.id}-${unit.key}`}
                                                            type="button"
                                                            onClick={() => unit.unitId && handleSelectUnit(b.id, unit.unitId)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${isSelected
                                                                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                                                                : hasConflict
                                                                    ? 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
                                                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                                                }`}
                                                        >
                                                            <span>🏠</span>
                                                            <span>{unit.displayName} {unit.subName ? `(${unit.subName})` : ''}</span>
                                                            {hasConflict && (
                                                                <span className="text-[10px] font-extrabold bg-rose-600 text-white px-1 py-0.2 rounded-full">
                                                                    중복
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={isAssigning}
                                            onClick={() => handleConfirmAssign(b)}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-lg transition shadow flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                                        >
                                            {isAssigning ? (
                                                <>
                                                    <span className="animate-spin text-sm">⏳</span>
                                                    <span>Beds24 배정 중...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>🚀</span>
                                                    <span>Beds24 호실 배정 확정</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 4. 하단 닫기 풋터 */}
                <div className="px-5 py-3 bg-white border-t border-gray-200 flex justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-black text-xs rounded-xl transition cursor-pointer"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
