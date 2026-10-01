'use client';

import { useState, useMemo } from 'react';
import { Booking } from '../../types';
import { findExtensionConflicts } from '../../utils/bookingUtils';

interface StayExtensionSectionProps {
    booking: Booking;
    allBookings?: Booking[];
    onExtendStay: (
        bookingId: number,
        newDeparture: string,
        additionalPrice: number,
        note?: string
    ) => Promise<{ success: boolean; error?: string }>;
    onSuccess?: () => void;
}

export default function StayExtensionSection({
    booking,
    allBookings = [],
    onExtendStay,
    onSuccess,
}: StayExtensionSectionProps) {
    const currentDep = booking.departure || '';
    const currentPrice = Number(booking.price) || 0;

    // 다음 날짜 계산 함수
    const getNextDays = (baseDateStr: string, addDays: number): string => {
        if (!baseDateStr) return '';
        const d = new Date(baseDateStr);
        if (isNaN(d.getTime())) return '';
        d.setDate(d.getDate() + addDays);
        return d.toISOString().slice(0, 10);
    };

    // 📌 아코디언 접기/펼치기 토글 상태 (기본값: 접힘)
    const [isOpen, setIsOpen] = useState<boolean>(false);

    // 기본값: +1박
    const [newDeparture, setNewDeparture] = useState<string>(() => getNextDays(currentDep, 1));
    const [addPriceInput, setAddPriceInput] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [resultMsg, setResultMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // 연장 박수 계산
    const extensionNights = useMemo(() => {
        if (!currentDep || !newDeparture || newDeparture <= currentDep) return 0;
        const d1 = new Date(currentDep);
        const d2 = new Date(newDeparture);
        const diffTime = d2.getTime() - d1.getTime();
        return Math.round(diffTime / (1000 * 3600 * 24));
    }, [currentDep, newDeparture]);

    // 추가 금액 및 최종 총액 계산
    const additionalPrice = Math.max(0, parseInt(addPriceInput.replace(/[^0-9]/g, ''), 10) || 0);
    const finalTotalPrice = currentPrice + additionalPrice;

    // 🛡️ 실시간 더블 부킹 충돌 검사
    const conflicts = useMemo(() => {
        return findExtensionConflicts(booking, newDeparture, allBookings);
    }, [booking, newDeparture, allBookings]);

    const hasConflict = conflicts.length > 0;

    const handleQuickAddDays = (days: number) => {
        const next = getNextDays(currentDep, days);
        if (next) setNewDeparture(next);
    };

    const handleSave = async () => {
        if (!newDeparture || newDeparture <= currentDep) {
            setResultMsg({ text: '새 체크아웃 날짜는 기존 체크아웃보다 이후여야 합니다.', type: 'error' });
            return;
        }

        if (hasConflict) {
            const c = conflicts[0];
            const cName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || `#${c.id}`;
            alert(`🚨 연장 불가!\n해당 기간(${c.arrival} ~ ${c.departure})에 이미 [${cName}]님의 예약(#${c.id})이 배정되어 있습니다.\n\n연장하려면 먼저 해당 예약을 다른 호실로 옮겨주세요.`);
            return;
        }

        const confirmMsg = `📅 예약 #${booking.id} 연박을 진행하시겠습니까?\n\n`
            + `• 퇴실일 변경: ${currentDep} ➔ ${newDeparture} (+${extensionNights}박)\n`
            + `• 추가 금액: +${additionalPrice.toLocaleString()}원\n`
            + `• 최종 총액: ${finalTotalPrice.toLocaleString()}원\n\n`
            + `※ Beds24 및 OTA 캘린더에 즉시 연장 블록이 적용됩니다.`;

        if (!confirm(confirmMsg)) return;

        setIsSubmitting(true);
        setResultMsg(null);

        const res = await onExtendStay(Number(booking.id), newDeparture, additionalPrice);
        setIsSubmitting(false);

        if (res.success) {
            setResultMsg({ text: '✅ 성공적으로 연박 연장 및 금액이 업데이트되었습니다!', type: 'success' });
            if (onSuccess) onSuccess();
        } else {
            setResultMsg({ text: `❌ ${res.error || '연박 연장 실패'}`, type: 'error' });
        }
    };

    return (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 rounded-lg border border-emerald-300 dark:border-emerald-800/80 overflow-hidden transition-all duration-200">
            {/* 📱 1. 아코디언 토글 헤더 바 (평소에는 슬림하게 1줄만 차지) */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-2.5 flex items-center justify-between hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 transition cursor-pointer text-left focus:outline-none"
            >
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-xs font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                        <span>📅</span> 일정 연장 (연박 신청)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200/70 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-bold">
                        현재: {currentDep} 퇴실
                    </span>
                </div>
                <div className="flex items-center gap-1 text-emerald-800 dark:text-emerald-300 text-xs font-black shrink-0">
                    <span className="text-[11px] underline underline-offset-2">{isOpen ? '접기' : '연장하기'}</span>
                    <span className={`text-[10px] transition-transform duration-200 inline-block ${isOpen ? 'rotate-180' : ''}`}>
                        ▼
                    </span>
                </div>
            </button>

            {/* 📱 2. 펼쳐졌을 때만 나타나는 세부 폼 */}
            {isOpen && (
                <div className="p-3 pt-2 border-t border-emerald-200/80 dark:border-emerald-800/60 flex flex-col gap-2.5">

            {/* 날짜 선택 및 퀵버튼 */}
            <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                    변경할 체크아웃 날짜:
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <input
                        type="date"
                        min={getNextDays(currentDep, 1)}
                        value={newDeparture}
                        onChange={(e) => setNewDeparture(e.target.value)}
                        className={`px-2 py-1 text-xs font-black bg-white dark:bg-slate-800 border rounded-md text-gray-800 dark:text-slate-100 focus:outline-none cursor-pointer flex-1 min-w-[130px] ${
                            hasConflict
                                ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
                                : 'border-emerald-400 dark:border-emerald-700'
                        }`}
                    />
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => handleQuickAddDays(1)}
                            className="px-2 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded transition cursor-pointer"
                        >
                            +1박
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickAddDays(2)}
                            className="px-2 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded transition cursor-pointer"
                        >
                            +2박
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickAddDays(3)}
                            className="px-2 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded transition cursor-pointer"
                        >
                            +3박
                        </button>
                    </div>
                </div>
            </div>

            {/* 🛡️ 실시간 더블 부킹 충돌 경고 */}
            {hasConflict && (
                <div className="p-2 bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 rounded text-rose-900 dark:text-rose-200 text-xs font-bold flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-rose-700 dark:text-rose-400 font-extrabold">
                        <span>🚨</span>
                        <span>연장 불가 (다른 손님 예약과 겹침)</span>
                    </div>
                    {conflicts.map((c) => {
                        const cName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || `#${c.id}`;
                        return (
                            <div key={`conflict-${c.id}`} className="text-[11px] pl-4">
                                • [<strong>{cName}</strong>] ({c.arrival} ~ {c.departure}, #{c.id})
                            </div>
                        );
                    })}
                    <div className="text-[10px] text-rose-600 dark:text-rose-300 mt-0.5">
                        ※ 이 호실의 다음 날짜에 다른 예약이 배정되어 있습니다. 먼저 해당 예약을 다른 호실로 이동해주세요.
                    </div>
                </div>
            )}

            {/* 추가 요금 입력 (수수료 0% 직거래) */}
            <div className="pt-1 border-t border-emerald-200 dark:border-emerald-800/50">
                <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300 block mb-0.5">
                    연장 추가 수령액 (원): <span className="text-emerald-700 dark:text-emerald-400 font-extrabold text-[10px]">(※ 계좌/직접 수령은 플랫폼 수수료 0% 전액 정산)</span>
                </label>
                <input
                    type="text"
                    placeholder="예: 80000"
                    value={addPriceInput}
                    onChange={(e) => setAddPriceInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md text-gray-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
            </div>

            {/* 정산 미리보기 및 실행 버튼 */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-200 dark:border-emerald-800/50 flex-wrap">
                <div className="text-[11px] text-gray-600 dark:text-slate-300 font-medium">
                    최종 총액: <span className="font-extrabold text-emerald-700 dark:text-emerald-400 font-mono text-xs">{finalTotalPrice.toLocaleString()}원</span>
                    {additionalPrice > 0 && (
                        <span className="text-[10px] text-gray-500 dark:text-slate-400 ml-1">
                            (기존 {currentPrice.toLocaleString()} + 추가 {additionalPrice.toLocaleString()})
                        </span>
                    )}
                </div>

                <button
                    type="button"
                    disabled={isSubmitting || hasConflict || extensionNights <= 0}
                    onClick={handleSave}
                    className={`px-3 py-1.5 text-white font-black text-xs rounded-md transition shadow-xs disabled:opacity-40 cursor-pointer shrink-0 flex items-center gap-1 ${
                        hasConflict
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                    }`}
                >
                    {isSubmitting ? 'Beds24 연동 중...' : `📅 ${extensionNights > 0 ? `+${extensionNights}박 연장 저장` : '연장 저장'}`}
                </button>
            </div>

            {/* 처리 결과 메시지 */}
            {resultMsg && (
                <div
                    className={`p-1.5 rounded text-xs font-bold ${
                        resultMsg.type === 'success'
                            ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                            : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200'
                    }`}
                >
                    {resultMsg.text}
                </div>
            )}
                </div>
            )}
        </div>
    );
}
