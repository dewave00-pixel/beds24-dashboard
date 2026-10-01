'use client';

import { useState } from 'react';
import { Booking } from '../../types';
import { getUnitForBooking, findConflictingBookings } from '../../utils/bookingUtils';
import { getChannelStyle, PROPERTY_GROUPS } from '../../config';

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
    onSelectBooking?: (booking: Booking) => void;
}

export default function UnallocatedBookingsModal({
    bookings,
    allBookings = [],
    bookingNotes,
    onClose,
    onAssignUnit,
    onSelectBooking,
}: UnallocatedBookingsModalProps) {
    // 각 예약별로 선택된 호실 키 상태 관리: { [bookingId]: 'roomId-unitId' }
    const [selectedUnitKeys, setSelectedUnitKeys] = useState<Record<number, string>>({});
    const [assigningId, setAssigningId] = useState<number | null>(null);
    const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const handleSelectUnitKey = (bookingId: number, unitKey: string) => {
        setSelectedUnitKeys((prev) => ({
            ...prev,
            [bookingId]: unitKey,
        }));
    };

    const handleConfirmAssign = async (booking: Booking) => {
        const chosenKey = selectedUnitKeys[booking.id];

        if (!chosenKey) {
            alert('배정할 호실을 선택해 주세요.');
            return;
        }

        const [targetRoomId, targetUnitId] = chosenKey.split('-').map(Number);

        if (!targetRoomId || !targetUnitId) {
            alert('올바른 호실을 선택해 주세요.');
            return;
        }

        // 🛡️ 더블 부킹 사전 체크
        const conflicts = findConflictingBookings(booking, targetRoomId, targetUnitId, allBookings);
        if (conflicts.length > 0) {
            const c = conflicts[0];
            const cName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || `#${c.id}`;
            const ok = confirm(`⚠️ 더블 부킹 경고!\n해당 기간(${c.arrival} ~ ${c.departure})에 이미 [${cName}]님의 예약(#${c.id})이 배정되어 있습니다.\n\n정말 강제로 배정하시겠습니까? (권장하지 않음)`);
            if (!ok) return;
        }

        setAssigningId(booking.id);
        setFeedbackMessage(null);

        const result = await onAssignUnit(booking.id, targetRoomId, targetUnitId);

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
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-slate-800">

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
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-b border-emerald-300 dark:border-emerald-800'
                            : 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border-b border-rose-300 dark:border-rose-800'
                            }`}
                    >
                        <span>{feedbackMessage.text}</span>
                        <button onClick={() => setFeedbackMessage(null)} className="text-sm font-bold opacity-70 hover:opacity-100 cursor-pointer">✕</button>
                    </div>
                )}

                {/* 3. 모달 본문 (미배정 목록) */}
                <div className="flex-1 overflow-y-auto p-3.5 md:p-5 bg-gray-50 dark:bg-slate-950 flex flex-col gap-3.5 min-h-0">
                    {bookings.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-gray-300 dark:border-slate-800 p-6">
                            <span className="text-4xl block mb-2">🎉</span>
                            <h3 className="text-sm font-black text-gray-800 dark:text-slate-100">모든 예약의 호실 배정이 완료되었습니다!</h3>
                            <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold mt-1">현재 미배정 상태인 예약이 없습니다.</p>
                        </div>
                    ) : (
                        bookings.map((b) => {
                            const fallbackUnit = getUnitForBooking(b);
                            const propName = fallbackUnit?.propName || '숙소';
                            const ch = getChannelStyle(b.apiSourceId);
                            const guestName = (b.firstName || b.lastName)
                                ? `${b.firstName || ''} ${b.lastName || ''}`.trim()
                                : `예약 #${b.id}`;

                            // 박수 계산
                            const arr = new Date(b.arrival);
                            const dep = new Date(b.departure);
                            const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24))) || 1;

                            const chosenKey = selectedUnitKeys[b.id] || '';
                            const [tRoomId, tUnitId] = chosenKey ? chosenKey.split('-').map(Number) : [0, 0];
                            const currentConflicts = tRoomId && tUnitId ? findConflictingBookings(b, tRoomId, tUnitId, allBookings) : [];
                            const hasConflict = currentConflicts.length > 0;
                            const isAssigning = assigningId === b.id;

                            return (
                                <div
                                    key={`unallocated-${b.id}`}
                                    className="bg-white dark:bg-slate-900 rounded-xl border-2 border-amber-200 dark:border-amber-800/60 p-4 shadow-sm hover:border-amber-400 dark:hover:border-amber-600 transition flex flex-col gap-3"
                                >
                                    {/* 상단 정보줄: 숙소명 + 채널 + 예약번호 */}
                                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-900 dark:bg-slate-950 text-amber-300 border border-slate-700">
                                                {propName}
                                            </span>
                                            <span className="text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
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
                                            <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500">#{b.id}</span>
                                        </div>
                                    </div>

                                    {/* 중간 정보줄: 게스트명, 날짜, 인원, 금액 */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-gray-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-gray-100 dark:border-slate-800">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 font-black text-gray-900 dark:text-slate-100">
                                                <span>👤</span>
                                                <span className="truncate">{guestName}</span>
                                                <span className="text-gray-500 dark:text-slate-400 font-bold">({b.numAdult || 1}명)</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-400 font-bold">
                                                <span>📅</span>
                                                <span>{b.arrival} ~ {b.departure} ({nights}박)</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1 sm:items-end justify-center">
                                            {b.price ? (
                                                <div className="font-black text-slate-800 dark:text-slate-100 text-sm">
                                                    ₩{Number(b.price).toLocaleString()}
                                                </div>
                                            ) : null}
                                            {onSelectBooking && (
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectBooking(b)}
                                                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-0.5"
                                                >
                                                    <span>🔍</span> 예약 상세 확인
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* 하단: 배정할 호실 선택 (전체 건물 지원) 및 Beds24 전송 버튼 */}
                                    <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                                        <div className="flex flex-col gap-1 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-black text-gray-700 dark:text-slate-300 shrink-0">배정 호실:</span>
                                                <select
                                                    value={chosenKey}
                                                    onChange={(e) => handleSelectUnitKey(b.id, e.target.value)}
                                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-black bg-white dark:bg-slate-800 border text-gray-800 dark:text-slate-100 flex-1 cursor-pointer ${
                                                        hasConflict
                                                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
                                                            : 'border-gray-300 dark:border-slate-700'
                                                    }`}
                                                >
                                                    <option value="">-- 배정할 호실 선택 (전체 건물) --</option>
                                                    {PROPERTY_GROUPS.map((group) => (
                                                        <optgroup key={`unalloc-grp-${group.name}`} label={`🏢 ${group.name}`}>
                                                            {group.units.map((u) => {
                                                                const uRoomId = u.roomId;
                                                                const uUnitId = u.unitId || 1;
                                                                const keyVal = `${uRoomId}-${uUnitId}`;
                                                                const conf = findConflictingBookings(b, uRoomId, uUnitId, allBookings);
                                                                return (
                                                                    <option key={`cand-opt-${b.id}-${keyVal}`} value={keyVal}>
                                                                        🏠 [{group.name}] {u.displayName} {u.subName ? `(${u.subName})` : ''} {conf.length > 0 ? ' (⚠️ 중복)' : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                            </div>

                                            {hasConflict && (
                                                <div className="text-[11px] text-rose-600 dark:text-rose-400 font-black pl-1">
                                                    ⚠️ {currentConflicts[0]?.arrival}~{currentConflicts[0]?.departure}에 [{currentConflicts[0]?.firstName || ''} {currentConflicts[0]?.lastName || ''}]님 예약과 겹칩니다!
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            disabled={isAssigning || !chosenKey}
                                            onClick={() => handleConfirmAssign(b)}
                                            className={`px-4 py-2 text-white font-black text-xs rounded-lg transition shadow flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0 ${
                                                hasConflict
                                                    ? 'bg-rose-600 hover:bg-rose-700'
                                                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                                            }`}
                                        >
                                            {isAssigning ? (
                                                <>
                                                    <span className="animate-spin text-sm">⏳</span>
                                                    <span>Beds24 배정 중...</span>
                                                </>
                                            ) : hasConflict ? (
                                                <>
                                                    <span>⚠️</span>
                                                    <span>중복 감지 배정</span>
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
                <div className="px-5 py-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 font-black text-xs rounded-xl transition cursor-pointer"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
