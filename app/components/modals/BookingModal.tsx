'use client';

import { useState } from 'react';
import { Booking } from '../../types';
import { getChannelStyle, EARLY_CHECKIN_HOURS, LATE_CHECKOUT_HOURS } from '../../config';
import { getUnitsForRoomId, getUnitForBooking, findConflictingBookings } from '../../utils/bookingUtils';
import { formatKSTDateTime } from '../../utils/dateUtils';

interface BookingModalProps {
    booking: Booking;
    allBookings?: Booking[];
    memoInput: string;
    setMemoInput: (val: string) => void;
    selectedTags: string[];
    onToggleTag: (tagKey: string) => void;
    onSave: () => void;
    onDelete: () => void;
    onClose: () => void;
    onAssignUnit?: (bookingId: number, roomId: number, unitId: number) => Promise<{ success: boolean; error?: string }>;
    propertiesInfo?: Record<string, { doorPassword: string; maxGuests: number; repairNotes: string }>;
}

export default function BookingModal({
    booking,
    allBookings = [],
    memoInput,
    setMemoInput,
    selectedTags,
    onToggleTag,
    onSave,
    onDelete,
    onClose,
    onAssignUnit,
    propertiesInfo,
}: BookingModalProps) {
    const ch = getChannelStyle(booking.apiSourceId);
    const guestName =
        booking.firstName || booking.lastName
            ? `${booking.firstName || ''} ${booking.lastName || ''}`.trim()
            : '이름 없음';

    const candidateUnits = getUnitsForRoomId(booking.roomId);
    const currentUnit = getUnitForBooking(booking);

    const [selectedUnitId, setSelectedUnitId] = useState<number>(Number(booking.unitId) || (candidateUnits[0]?.unitId ?? 1));
    const [isAssigning, setIsAssigning] = useState<boolean>(false);
    const [assignMsg, setAssignMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // 🛡️ 선택된 호실에 더블 부킹 충돌이 있는지 실시간 계산 (0은 미배정 해제이므로 충돌 없음)
    const currentConflicts = selectedUnitId > 0
        ? findConflictingBookings(booking, Number(booking.roomId), selectedUnitId, allBookings)
        : [];
    const hasConflictOnSelectedUnit = currentConflicts.length > 0;

    const currentEarlyTag = selectedTags.find((t) => t.startsWith('early_'));
    const isEarlyActive = Boolean(currentEarlyTag);
    const earlyTime = currentEarlyTag ? currentEarlyTag.replace('early_', '') : EARLY_CHECKIN_HOURS[1];

    const currentLateTag = selectedTags.find((t) => t.startsWith('late_'));
    const isLateActive = Boolean(currentLateTag);
    const lateTime = currentLateTag ? currentLateTag.replace('late_', '') : LATE_CHECKOUT_HOURS[0];

    const isNoCleaning = selectedTags.includes('no_cleaning');
    const isRepair = selectedTags.includes('repair');

    const handleEarlyToggle = () => {
        if (isEarlyActive) {
            onToggleTag(currentEarlyTag!);
        } else {
            onToggleTag(`early_${earlyTime}`);
        }
    };

    const handleEarlyTimeChange = (newTime: string) => {
        if (currentEarlyTag) {
            onToggleTag(currentEarlyTag);
        }
        onToggleTag(`early_${newTime}`);
    };

    const handleLateToggle = () => {
        if (isLateActive) {
            onToggleTag(currentLateTag!);
        } else {
            onToggleTag(`late_${lateTime}`);
        }
    };

    const handleLateTimeChange = (newTime: string) => {
        if (currentLateTag) {
            onToggleTag(currentLateTag);
        }
        onToggleTag(`late_${newTime}`);
    };

    const handleAssignUnitClick = async () => {
        if (!onAssignUnit || !booking.roomId) return;

        // 🛡️ 더블 부킹 사전 경고
        if (hasConflictOnSelectedUnit) {
            const c = currentConflicts[0];
            const cName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || `#${c.id}`;
            const ok = confirm(`⚠️ 더블 부킹 경고!\n해당 기간(${c.arrival} ~ ${c.departure})에 이미 [${cName}]님의 예약(#${c.id})이 배정되어 있습니다.\n\n정말 강제로 이동/배정하시겠습니까? (권장하지 않음)`);
            if (!ok) return;
        }

        setIsAssigning(true);
        setAssignMsg(null);
        const result = await onAssignUnit(booking.id, Number(booking.roomId), selectedUnitId);
        setIsAssigning(false);
        if (result.success) {
            setAssignMsg({ text: '✅ Beds24 호실 배정 완료!', type: 'success' });
            setTimeout(() => setAssignMsg(null), 3000);
        } else {
            setAssignMsg({ text: `❌ ${result.error || '배정 실패'}`, type: 'error' });
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[95vh] border border-gray-300">

                {/* 상단 헤더 */}
                <div
                    className="p-3 md:p-3.5 flex items-center justify-between text-white shadow gap-2"
                    style={{ backgroundColor: ch.bg, color: ch.text }}
                >
                    <div className="flex items-center gap-1.5 md:gap-2 flex-wrap min-w-0">
                        <span className="font-extrabold text-sm md:text-base shrink-0">예약 상세정보</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-black/30 font-bold border border-white/20 shrink-0">
                            {ch.name}
                        </span>
                        {booking.bookingTime && (
                            <span className="text-[11px] md:text-xs px-2 py-0.5 rounded-full bg-black/20 font-bold text-white/90 border border-white/15 shrink-0">
                                예약: {formatKSTDateTime(booking.bookingTime)}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-lg font-extrabold hover:opacity-80 transition px-2 py-0.5 rounded bg-black/20 shrink-0 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* 본문 정보 */}
                <div className="p-3 md:p-5 overflow-y-auto flex flex-col gap-3.5 text-sm text-gray-800">
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-300">
                        <div>
                            <span className="text-[11px] text-gray-500 font-bold block">게스트 이름</span>
                            <span className="font-extrabold text-gray-900 text-sm md:text-base">{guestName}</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-gray-500 font-bold block">예약 번호</span>
                            <span className="font-bold text-gray-900 text-xs md:text-sm font-mono">{booking.id}</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-gray-500 font-bold block">체크인</span>
                            <span className="font-extrabold text-blue-700">{booking.arrival}</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-gray-500 font-bold block">체크아웃</span>
                            <span className="font-extrabold text-orange-700">{booking.departure}</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-gray-500 font-bold block">투숙 인원</span>
                            <span className="font-extrabold text-gray-900">{booking.numAdult || 1}명</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-gray-500 font-bold block">💰 예약 금액</span>
                            <span className="font-black text-emerald-700 text-sm md:text-base font-mono">
                                {booking.price ? `${Number(booking.price).toLocaleString()}원` : '0원'}
                            </span>
                        </div>
                    </div>

                    {/* 🏠 호실 배정 관리 섹션 */}
                    {candidateUnits.length > 0 && (
                        <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-300 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-amber-950 flex items-center gap-1">
                                    <span>🏠</span> 호실 배정 상태:
                                </span>
                                <span className={`text-xs font-black px-2 py-0.5 rounded ${Number(booking.unitId) > 0 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-700'}`}>
                                    {Number(booking.unitId) > 0
                                        ? `${currentUnit?.displayName || `Unit ${booking.unitId}`} (배정됨)`
                                        : '⚠️ 미배정 상태'}
                                </span>
                            </div>

                            {onAssignUnit && (
                                <div className="flex flex-col gap-1.5 pt-1 border-t border-amber-200">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1 flex-1">
                                            <span className="text-[11px] font-bold text-gray-700 shrink-0">변경 호실:</span>
                                            <select
                                                value={selectedUnitId}
                                                onChange={(e) => setSelectedUnitId(Number(e.target.value))}
                                                className={`px-2 py-1 text-xs font-black bg-white border rounded-md text-gray-800 focus:outline-none cursor-pointer flex-1 ${hasConflictOnSelectedUnit ? 'border-rose-500 bg-rose-50' : 'border-gray-300'}`}
                                            >
                                                {/* ⚠️ 미배정 상태로 되돌리기 옵션 */}
                                                <option value={0}>⚠️ [미배정 상태로 변경 (호실 해제)]</option>

                                                {candidateUnits.map((u) => {
                                                    const conf = u.unitId ? findConflictingBookings(booking, Number(booking.roomId), u.unitId, allBookings) : [];
                                                    return (
                                                        <option key={`opt-${u.key}`} value={u.unitId}>
                                                            🏠 {u.displayName} {u.subName ? `(${u.subName})` : ''} {conf.length > 0 ? '(⚠️ 중복)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={isAssigning || selectedUnitId === (Number(booking.unitId) || 0)}
                                            onClick={handleAssignUnitClick}
                                            className={`px-3 py-1 text-white font-black text-xs rounded-md transition shadow-xs disabled:opacity-40 cursor-pointer shrink-0 flex items-center gap-1 ${
                                                selectedUnitId === 0
                                                    ? 'bg-amber-600 hover:bg-amber-700'
                                                    : hasConflictOnSelectedUnit
                                                        ? 'bg-rose-600 hover:bg-rose-700'
                                                        : 'bg-blue-600 hover:bg-blue-700'
                                            }`}
                                        >
                                            {isAssigning
                                                ? '처리 중...'
                                                : selectedUnitId === 0
                                                    ? '⚠️ 미배정으로 해제'
                                                    : hasConflictOnSelectedUnit
                                                        ? '⚠️ 중복 배정'
                                                        : 'Beds24 배정'}
                                        </button>
                                    </div>

                                    {/* 실시간 더블 부킹 경고 메시지 */}
                                    {hasConflictOnSelectedUnit && (
                                        <div className="p-1.5 bg-rose-100 border border-rose-300 rounded text-rose-900 text-[11px] font-black flex items-center gap-1">
                                            <span>🚨</span>
                                            <span>
                                                {currentConflicts[0]?.arrival} ~ {currentConflicts[0]?.departure}에 [{currentConflicts[0]?.firstName || ''} {currentConflicts[0]?.lastName || ''}]님 예약과 겹칩니다!
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {assignMsg && (
                                <div className={`text-[11px] font-black ${assignMsg.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {assignMsg.text}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 🏷️ 빠른 상태 옵션 */}
                    <div className="flex flex-col gap-1.5">
                        <label className="font-extrabold text-xs text-gray-800 flex items-center gap-1">
                            <span>🏷️ 빠른 상태 옵션 (시간 설정 및 다중 선택)</span>
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">

                            {/* 1. 얼리체크인 */}
                            <div
                                className={`p-2 rounded-lg border flex items-center justify-between transition-all ${isEarlyActive
                                    ? 'bg-blue-50 border-blue-500 border-2 shadow-sm'
                                    : 'bg-white border-gray-300'
                                    }`}
                            >
                                <button
                                    type="button"
                                    onClick={handleEarlyToggle}
                                    className="flex items-center gap-1.5 font-extrabold text-xs text-blue-900 grow text-left"
                                >
                                    <span>🕒</span>
                                    <span>얼리체크인</span>
                                    <span>{isEarlyActive ? '✅' : '⬜'}</span>
                                </button>

                                {isEarlyActive && (
                                    <select
                                        value={earlyTime}
                                        onChange={(e) => handleEarlyTimeChange(e.target.value)}
                                        className="p-1 text-xs font-extrabold bg-white border border-blue-500 rounded text-blue-900 focus:outline-none cursor-pointer"
                                    >
                                        {EARLY_CHECKIN_HOURS.map((h) => (
                                            <option key={h} value={h}>
                                                {h}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* 2. 레이트체크아웃 */}
                            <div
                                className={`p-2 rounded-lg border flex items-center justify-between transition-all ${isLateActive
                                    ? 'bg-indigo-50 border-indigo-500 border-2 shadow-sm'
                                    : 'bg-white border-gray-300'
                                    }`}
                            >
                                <button
                                    type="button"
                                    onClick={handleLateToggle}
                                    className="flex items-center gap-1.5 font-extrabold text-xs text-indigo-900 grow text-left"
                                >
                                    <span>⏱️</span>
                                    <span>레이트체크아웃</span>
                                    <span>{isLateActive ? '✅' : '⬜'}</span>
                                </button>

                                {isLateActive && (
                                    <select
                                        value={lateTime}
                                        onChange={(e) => handleLateTimeChange(e.target.value)}
                                        className="p-1 text-xs font-extrabold bg-white border border-indigo-500 rounded text-indigo-900 focus:outline-none cursor-pointer"
                                    >
                                        {LATE_CHECKOUT_HOURS.map((h) => (
                                            <option key={h} value={h}>
                                                {h}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* 3. 청소안함 */}
                            <button
                                type="button"
                                onClick={() => onToggleTag('no_cleaning')}
                                className={`p-2 rounded-lg border text-xs font-extrabold flex items-center justify-between transition-all ${isNoCleaning
                                    ? 'bg-rose-50 border-rose-500 border-2 text-rose-900 shadow-sm'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <span>🧹</span>
                                    <span>청소안함</span>
                                </span>
                                <span>{isNoCleaning ? '✅' : '⬜'}</span>
                            </button>

                            {/* 4. 수리/점검 */}
                            <button
                                type="button"
                                onClick={() => onToggleTag('repair')}
                                className={`p-2 rounded-lg border text-xs font-extrabold flex items-center justify-between transition-all ${isRepair
                                    ? 'bg-amber-50 border-amber-500 border-2 text-amber-950 shadow-sm'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <span>🛠️</span>
                                    <span>수리/점검</span>
                                </span>
                                <span>{isRepair ? '✅' : '⬜'}</span>
                            </button>

                        </div>
                    </div>

                    {/* 🔥 고대비 특이사항 메모 입력창 */}
                    <div className="flex flex-col gap-1.5">
                        <label className="font-extrabold text-xs text-gray-900 flex items-center gap-1">
                            <span>🔥 특이사항 및 메모 (선명한 고대비)</span>
                        </label>
                        <textarea
                            rows={3}
                            value={memoInput}
                            onChange={(e) => setMemoInput(e.target.value)}
                            placeholder="예: 짐보관 요청(12시), 침구 추가 요청 등..."
                            className="w-full p-2.5 border-2 border-gray-400 focus:border-blue-600 rounded-lg text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none bg-yellow-50/40"
                        />
                    </div>
                </div>

                {/* 하단 버튼 바 */}
                <div className="p-3 md:p-4 bg-gray-100 border-t border-gray-300 flex justify-between items-center">
                    <button
                        onClick={onDelete}
                        className="px-3 py-2 text-xs font-extrabold text-red-700 hover:bg-red-100 rounded-lg border border-red-300 transition"
                    >
                        초기화/삭제
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 rounded-lg border border-gray-300 transition"
                        >
                            닫기
                        </button>
                        <button
                            onClick={onSave}
                            className="px-5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition"
                        >
                            저장하기
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}