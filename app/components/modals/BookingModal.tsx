'use client';

import { useState } from 'react';
import { Booking } from '../../types';
import { getChannelStyle, EARLY_CHECKIN_HOURS, LATE_CHECKOUT_HOURS, PROPERTY_GROUPS } from '../../config';
import { getUnitForBooking, findConflictingBookings, getCommissionInfo, getDirectExtensionPrice } from '../../utils/bookingUtils';
import { formatKSTDateTime } from '../../utils/dateUtils';
import StayExtensionSection from './StayExtensionSection';

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
    onExtendStay?: (bookingId: number, newDeparture: string, additionalPrice: number, note?: string) => Promise<{ success: boolean; error?: string }>;
    onCancelBooking?: (bookingId: number, action: 'noshow_cancel' | 'permanent_delete') => Promise<{ success: boolean; error?: string }>;
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
    onExtendStay,
    onCancelBooking,
    propertiesInfo,
}: BookingModalProps) {
    const ch = getChannelStyle(booking.apiSourceId);
    const guestName =
        booking.firstName || booking.lastName
            ? `${booking.firstName || ''} ${booking.lastName || ''}`.trim()
            : '이름 없음';

    const currentUnit = getUnitForBooking(booking);
    const directPrice = getDirectExtensionPrice(booking.notes);
    const isChicken = selectedTags.includes('chicken');
    const commInfo = getCommissionInfo(
        Number(booking.price) || 0,
        booking.apiSourceId,
        directPrice,
        booking.bookingTime,
        booking.roomId,
        isChicken
    );

    // 🔑 현재 배정된 키: 'roomId-unitId' (단, unitId가 0이거나 미배정이면 '0-0')
    const currentKey = Number(booking.unitId) > 0 && booking.roomId
        ? `${Number(booking.roomId)}-${Number(booking.unitId)}`
        : '0-0';

    const [selectedUnitKey, setSelectedUnitKey] = useState<string>(currentKey);
    const [isAssigning, setIsAssigning] = useState<boolean>(false);
    const [assignMsg, setAssignMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // 🚫 예약 취소/삭제 모달 상태
    const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
    const [cancelAction, setCancelAction] = useState<'noshow_cancel' | 'permanent_delete'>('noshow_cancel');
    const [isCancelling, setIsCancelling] = useState<boolean>(false);
    const [cancelError, setCancelError] = useState<string | null>(null);

    // 파싱된 선택 호실 정보
    const [targetRoomId, targetUnitId] = selectedUnitKey === '0-0'
        ? [Number(booking.roomId) || 0, 0]
        : selectedUnitKey.split('-').map(Number);

    // 🛡️ 선택된 호실에 더블 부킹 충돌이 있는지 실시간 계산 (0은 미배정 해제이므로 충돌 없음)
    const currentConflicts = targetUnitId > 0 && targetRoomId > 0
        ? findConflictingBookings(booking, targetRoomId, targetUnitId, allBookings)
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
        if (!onAssignUnit) return;

        // 🛡️ 더블 부킹 사전 경고
        if (hasConflictOnSelectedUnit) {
            const c = currentConflicts[0];
            const cName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || `#${c.id}`;
            const ok = confirm(`⚠️ 더블 부킹 경고!\n해당 기간(${c.arrival} ~ ${c.departure})에 이미 [${cName}]님의 예약(#${c.id})이 배정되어 있습니다.\n\n정말 강제로 이동/배정하시겠습니까? (권장하지 않음)`);
            if (!ok) return;
        }

        setIsAssigning(true);
        setAssignMsg(null);
        // targetUnitId === 0 이면 미배정 해제 (기존 roomId 유지하면서 unitId: 0 전달)
        const finalRoomId = targetUnitId === 0 ? Number(booking.roomId) || 0 : targetRoomId;
        const result = await onAssignUnit(booking.id, finalRoomId, targetUnitId);
        setIsAssigning(false);
        if (result.success) {
            setAssignMsg({ text: '✅ Beds24 호실 배정 완료!', type: 'success' });
            setTimeout(() => setAssignMsg(null), 3000);
        } else {
            setAssignMsg({ text: `❌ ${result.error || '배정 실패'}`, type: 'error' });
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
            <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[88dvh] sm:max-h-[90vh] border border-gray-300 dark:border-slate-700 my-auto">

                {/* 상단 헤더 */}
                <div
                    className="p-3 md:p-3.5 flex items-center justify-between text-white shadow gap-2 shrink-0"
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
                <div className="p-3 md:p-5 overflow-y-auto flex flex-col gap-3.5 text-sm text-gray-800 dark:text-slate-200">
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-slate-800/80 p-2.5 rounded-lg border border-gray-300 dark:border-slate-700 shrink-0">
                        <div>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-bold block">게스트 이름</span>
                            <span className="font-extrabold text-gray-900 dark:text-slate-100 text-sm md:text-base">{guestName}</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-bold block">예약 번호</span>
                            <span className="font-bold text-gray-900 dark:text-slate-200 text-xs md:text-sm font-mono">{booking.id}</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-bold block">체크인</span>
                            <span className="font-extrabold text-blue-700 dark:text-blue-400">{booking.arrival}</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-bold block">체크아웃</span>
                            <span className="font-extrabold text-orange-700 dark:text-amber-400">{booking.departure}</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-bold block">투숙 인원</span>
                            <span className="font-extrabold text-gray-900 dark:text-slate-100">{booking.numAdult || 1}명</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-bold block">정산 금액</span>
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm md:text-base font-mono">
                                    {commInfo.netPayout.toLocaleString()}원
                                </span>
                                {commInfo.chickenDeduction > 0 && (
                                    <span className="text-[11px] text-orange-600 dark:text-orange-400 font-bold">
                                        (🍗 치킨 -21,000원)
                                    </span>
                                )}
                                {commInfo.directPrice > 0 ? (
                                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                                        (연박계좌 {commInfo.directPrice.toLocaleString()}원 수수료0% 포함)
                                    </span>
                                ) : commInfo.hasDeduction && (
                                    <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                                        (결제: {commInfo.grossPrice.toLocaleString()}원)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 🏠 호실 배정 관리 섹션 (전체 건물 및 모든 호실 이동 가능) */}
                    <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-300 dark:border-amber-800/80 flex flex-col gap-2 shrink-0">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-950 dark:text-amber-200 flex items-center gap-1">
                                <span>🏠</span> 호실 배정 상태:
                            </span>
                            <span className={`text-xs font-black px-2 py-0.5 rounded ${Number(booking.unitId) > 0 ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200' : 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-200'}`}>
                                {Number(booking.unitId) > 0
                                    ? `${currentUnit?.propName ? `[${currentUnit.propName}] ` : ''}${currentUnit?.displayName || `Unit ${booking.unitId}`} (배정됨)`
                                    : '⚠️ 미배정 상태'}
                            </span>
                        </div>

                        {onAssignUnit && (
                            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-amber-200 dark:border-amber-800/50">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <span className="text-xs font-bold text-gray-700 dark:text-slate-300 shrink-0">변경 호실:</span>
                                        <select
                                            value={selectedUnitKey}
                                            onChange={(e) => setSelectedUnitKey(e.target.value)}
                                            className={`min-h-[38px] px-2.5 py-1.5 text-xs font-black bg-white dark:bg-slate-800 border rounded-md text-gray-800 dark:text-slate-100 focus:outline-none cursor-pointer flex-1 min-w-0 ${hasConflictOnSelectedUnit ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200' : 'border-gray-300 dark:border-slate-600'}`}
                                        >
                                            {/* ⚠️ 미배정 상태로 되돌리기 옵션 */}
                                            <option value="0-0" className="bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100">⚠️ [미배정 상태로 변경 (호실 해제)]</option>

                                            {PROPERTY_GROUPS.map((group) => (
                                                <optgroup key={`grp-${group.name}`} label={`🏢 ${group.name}`}>
                                                    {group.units.map((u) => {
                                                        const uRoomId = u.roomId;
                                                        const uUnitId = u.unitId || 1;
                                                        const keyVal = `${uRoomId}-${uUnitId}`;
                                                        const conf = findConflictingBookings(booking, uRoomId, uUnitId, allBookings);
                                                        const isCurrent = keyVal === currentKey;
                                                        return (
                                                            <option key={`opt-${u.key}`} value={keyVal} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100">
                                                                🏠 {u.displayName} {u.subName ? `(${u.subName})` : ''} {isCurrent ? ' (현재)' : ''} {conf.length > 0 ? ' (⚠️ 중복)' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={isAssigning || selectedUnitKey === currentKey}
                                        onClick={handleAssignUnitClick}
                                        className={`w-full sm:w-auto min-h-[38px] px-4 py-1.5 text-white font-black text-xs rounded-md transition shadow-xs disabled:opacity-40 cursor-pointer shrink-0 flex items-center justify-center gap-1 ${
                                            targetUnitId === 0
                                                ? 'bg-amber-600 hover:bg-amber-700'
                                                : hasConflictOnSelectedUnit
                                                    ? 'bg-rose-600 hover:bg-rose-700'
                                                    : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                    >
                                        {isAssigning
                                            ? '처리 중...'
                                            : targetUnitId === 0
                                                ? '⚠️ 미배정으로 해제'
                                                : hasConflictOnSelectedUnit
                                                    ? '⚠️ 중복 배정'
                                                    : 'Beds24 배정'}
                                    </button>
                                </div>

                                {/* 실시간 더블 부킹 경고 메시지 */}
                                {hasConflictOnSelectedUnit && (
                                    <div className="p-1.5 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded text-rose-900 dark:text-rose-200 text-[11px] font-black flex items-center gap-1">
                                        <span>🚨</span>
                                        <span>
                                            {currentConflicts[0]?.arrival} ~ {currentConflicts[0]?.departure}에 [{currentConflicts[0]?.firstName || ''} {currentConflicts[0]?.lastName || ''}]님 예약과 겹칩니다!
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {assignMsg && (
                            <div className={`text-[11px] font-black ${assignMsg.type === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                {assignMsg.text}
                            </div>
                        )}
                    </div>

                    {/* 📅 연박 연장 섹션 (일정 & 추가 요금) */}
                    {onExtendStay && (
                        <StayExtensionSection
                            booking={booking}
                            allBookings={allBookings}
                            onExtendStay={onExtendStay}
                        />
                    )}

                    {/* 🏷️ 빠른 상태 옵션 */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                        <label className="font-extrabold text-xs text-gray-800 dark:text-slate-200 flex items-center gap-1">
                            <span>🏷️ 빠른 상태 옵션 (시간 설정 및 다중 선택)</span>
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">

                            {/* 1. 얼리체크인 */}
                            <div
                                onClick={handleEarlyToggle}
                                className={`p-2 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${isEarlyActive
                                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 border-2 shadow-sm'
                                    : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1.5 font-extrabold text-xs text-blue-900 dark:text-blue-300">
                                        <span>🕒</span>
                                        <span>얼리체크인</span>
                                    </span>

                                    {isEarlyActive && (
                                        <select
                                            value={earlyTime}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handleEarlyTimeChange(e.target.value);
                                            }}
                                            className="py-0.5 px-1.5 text-xs font-extrabold bg-white dark:bg-slate-800 border border-blue-500 rounded text-blue-900 dark:text-blue-200 focus:outline-none cursor-pointer shadow-xs"
                                        >
                                            {EARLY_CHECKIN_HOURS.map((h) => (
                                                <option key={h} value={h} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100">
                                                    {h}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <span className="text-xs shrink-0">{isEarlyActive ? '✅' : '⬜'}</span>
                            </div>

                            {/* 2. 레이트체크아웃 */}
                            <div
                                onClick={handleLateToggle}
                                className={`p-2 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${isLateActive
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 border-2 shadow-sm'
                                    : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1.5 font-extrabold text-xs text-indigo-900 dark:text-indigo-300">
                                        <span>⏱️</span>
                                        <span>레이트체크아웃</span>
                                    </span>

                                    {isLateActive && (
                                        <select
                                            value={lateTime}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handleLateTimeChange(e.target.value);
                                            }}
                                            className="py-0.5 px-1.5 text-xs font-extrabold bg-white dark:bg-slate-800 border border-indigo-500 rounded text-indigo-900 dark:text-indigo-200 focus:outline-none cursor-pointer shadow-xs"
                                        >
                                            {LATE_CHECKOUT_HOURS.map((h) => (
                                                <option key={h} value={h} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100">
                                                    {h}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <span className="text-xs shrink-0">{isLateActive ? '✅' : '⬜'}</span>
                            </div>

                            {/* 3. 청소안함 */}
                            <button
                                type="button"
                                onClick={() => onToggleTag('no_cleaning')}
                                className={`p-2 rounded-lg border text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer ${isNoCleaning
                                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 border-2 text-rose-900 dark:text-rose-200 shadow-sm'
                                    : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
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
                                className={`p-2 rounded-lg border text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer ${isRepair
                                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 border-2 text-amber-950 dark:text-amber-200 shadow-sm'
                                    : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                                    }`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <span>🛠️</span>
                                    <span>수리/점검</span>
                                </span>
                                <span>{isRepair ? '✅' : '⬜'}</span>
                            </button>

                            {/* 5. 리뷰 치킨 이벤트 */}
                            <button
                                type="button"
                                onClick={() => onToggleTag('chicken')}
                                className={`p-2 rounded-lg border text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer md:col-span-2 ${isChicken
                                    ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-500 border-2 text-orange-950 dark:text-orange-200 shadow-sm'
                                    : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                                    }`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <span>🍗</span>
                                    <span>리뷰 치킨 이벤트</span>
                                </span>
                                <span>{isChicken ? '✅' : '⬜'}</span>
                            </button>

                        </div>
                    </div>

                    {/* 🔥 고대비 특이사항 메모 입력창 */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                        <label className="font-extrabold text-xs text-gray-900 dark:text-slate-100 flex items-center gap-1">
                            <span>🔥 특이사항 및 메모 (선명한 고대비)</span>
                        </label>
                        <textarea
                            rows={3}
                            value={memoInput}
                            onChange={(e) => setMemoInput(e.target.value)}
                            placeholder="예: 짐보관 요청(12시), 침구 추가 요청 등..."
                            className="w-full p-2.5 border-2 border-gray-400 dark:border-slate-600 focus:border-blue-600 dark:focus:border-blue-500 rounded-lg text-sm font-bold text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 placeholder:font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none bg-yellow-50/40 dark:bg-slate-800"
                        />
                    </div>
                </div>

                {/* 하단 버튼 바 */}
                <div className="p-3 md:p-4 bg-gray-100 dark:bg-slate-950 border-t border-gray-300 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                            type="button"
                            onClick={onDelete}
                            className="px-2.5 sm:px-3 py-2 text-xs font-extrabold text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-700 transition cursor-pointer"
                        >
                            초기화/삭제
                        </button>
                        {onCancelBooking && booking.status !== 'cancelled' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setCancelError(null);
                                    setCancelAction('noshow_cancel');
                                    setShowCancelConfirm(true);
                                }}
                                className="px-2.5 sm:px-3 py-2 text-xs font-extrabold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-300 dark:border-rose-900/60 transition cursor-pointer flex items-center gap-1"
                            >
                                <span>🚫</span>
                                <span>예약 취소 / 삭제</span>
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 sm:px-4 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-700 transition cursor-pointer"
                        >
                            닫기
                        </button>
                        <button
                            type="button"
                            onClick={onSave}
                            className="px-4 sm:px-5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition cursor-pointer"
                        >
                            저장하기
                        </button>
                    </div>
                </div>

                {/* 🚫 예약 취소 / 영구 삭제 선택 모달 오버레이 */}
                {showCancelConfirm && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
                        <div className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl p-4 sm:p-5 max-w-md w-full shadow-2xl flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center gap-2 text-gray-900 dark:text-slate-100 font-extrabold text-base border-b border-gray-200 dark:border-slate-800 pb-2.5">
                                <span className="text-lg">⚠️</span>
                                <span>Beds24 예약 취소 / 삭제 방식 선택</span>
                            </div>

                            <div className="text-xs text-gray-600 dark:text-slate-300">
                                <p>
                                    <span className="font-bold text-gray-900 dark:text-slate-100">{guestName}</span> 님의 예약 (ID: #{booking.id}, 결제금액: <strong className="text-blue-600 dark:text-blue-400">{Number(booking.price || 0).toLocaleString()}원</strong>)
                                </p>
                                <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                                    목적에 맞는 처리 방식을 선택해 주세요:
                                </p>
                            </div>

                            {/* 2가지 선택 옵션 카드 */}
                            <div className="flex flex-col gap-2.5">
                                {/* 옵션 1: 노쇼 취소 (위약금 매출 보존) */}
                                <div
                                    onClick={() => setCancelAction('noshow_cancel')}
                                    className={`p-3 rounded-lg border text-xs cursor-pointer flex flex-col gap-1 transition ${
                                        cancelAction === 'noshow_cancel'
                                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 border-2 text-amber-950 dark:text-amber-100 shadow-xs'
                                            : 'bg-white dark:bg-slate-800/60 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between font-extrabold text-xs sm:text-sm">
                                        <span className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                                            <span>🚫</span>
                                            <span>노쇼 / 취소 처리 (위약금 매출 보존)</span>
                                        </span>
                                        <span className="text-sm">{cancelAction === 'noshow_cancel' ? '🟢' : '⚪'}</span>
                                    </div>
                                    <div className="text-[11px] leading-relaxed text-gray-600 dark:text-slate-300 pl-5 space-y-0.5">
                                        <p>• Beds24 상태를 <strong>cancelled</strong>로 변경하여 방을 즉시 <strong>공실로 반환</strong>합니다.</p>
                                        <p>• 결제/위약금 <strong>{Number(booking.price || 0).toLocaleString()}원</strong>은 <strong>매출 통계에 그대로 보존</strong>됩니다.</p>
                                        <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold pt-0.5">💡 추천 대상: 투숙 당일 노쇼, 위약금이 부과된 정상 취소 건</p>
                                    </div>
                                </div>

                                {/* 옵션 2: 영구 삭제 (매출 제외 / 테스트 예약) */}
                                <div
                                    onClick={() => setCancelAction('permanent_delete')}
                                    className={`p-3 rounded-lg border text-xs cursor-pointer flex flex-col gap-1 transition ${
                                        cancelAction === 'permanent_delete'
                                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 border-2 text-rose-950 dark:text-rose-100 shadow-xs'
                                            : 'bg-white dark:bg-slate-800/60 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between font-extrabold text-xs sm:text-sm">
                                        <span className="flex items-center gap-1.5 text-rose-900 dark:text-rose-200">
                                            <span>🗑️</span>
                                            <span>영구 삭제 (매출 제외 / 테스트 예약)</span>
                                        </span>
                                        <span className="text-sm">{cancelAction === 'permanent_delete' ? '🔴' : '⚪'}</span>
                                    </div>
                                    <div className="text-[11px] leading-relaxed text-gray-600 dark:text-slate-300 pl-5 space-y-0.5">
                                        <p>• Beds24 및 대시보드 DB에서 <strong>예약을 완전히 삭제</strong>합니다.</p>
                                        <p>• 매출 통계에서도 0원으로 처리되어 <strong>완전히 제외</strong>됩니다.</p>
                                        <p className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold pt-0.5">⚠️ 주의 대상: 테스트 예약, 오등록 예약, 전액 환불 건 전용</p>
                                    </div>
                                </div>
                            </div>

                            {cancelError && (
                                <p className="text-rose-600 dark:text-rose-400 font-bold text-xs bg-rose-100 dark:bg-rose-900/50 p-2 rounded">
                                    ❌ {cancelError}
                                </p>
                            )}

                            <div className="flex justify-end gap-2 mt-1 border-t border-gray-200 dark:border-slate-800 pt-3">
                                <button
                                    type="button"
                                    disabled={isCancelling}
                                    onClick={() => setShowCancelConfirm(false)}
                                    className="px-3.5 py-1.5 text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-700 transition cursor-pointer"
                                >
                                    돌아가기
                                </button>
                                <button
                                    type="button"
                                    disabled={isCancelling}
                                    onClick={async () => {
                                        if (!onCancelBooking) return;
                                        setIsCancelling(true);
                                        setCancelError(null);
                                        try {
                                            const res = await onCancelBooking(booking.id, cancelAction);
                                            if (res.success) {
                                                setShowCancelConfirm(false);
                                                onClose();
                                            } else {
                                                setCancelError(res.error || '처리에 실패했습니다.');
                                            }
                                        } catch (err: unknown) {
                                            const errorMsg = err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.';
                                            setCancelError(errorMsg);
                                        } finally {
                                            setIsCancelling(false);
                                        }
                                    }}
                                    className={`px-4 py-1.5 text-xs font-extrabold text-white rounded-lg shadow transition cursor-pointer flex items-center gap-1.5 ${
                                        cancelAction === 'permanent_delete'
                                            ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400'
                                            : 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400'
                                    }`}
                                >
                                    {isCancelling ? (
                                        <>
                                            <span className="animate-spin text-xs">⏳</span>
                                            <span>처리 중...</span>
                                        </>
                                    ) : (
                                        <span>
                                            {cancelAction === 'permanent_delete' ? '🗑️ 예약 영구 삭제 실행' : '🚫 노쇼 취소(위약금 보존) 확정'}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}