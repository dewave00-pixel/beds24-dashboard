'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '../../types';
import { PROPERTY_GROUPS, OTHER_CHANNEL_COMMISSION_RATE } from '../../config';
import { findConflictingBookings } from '../../utils/bookingUtils';
import { addDaysToDateStr, getKSTTodayStr, getKSTTomorrowStr } from '../../utils/dateUtils';

export interface CreateBookingPayload {
    roomId: number;
    unitId: number;
    arrival: string;
    departure: string;
    numAdult: number;
    firstName: string;
    lastName: string;
    phone: string;
    price: number;
    channelType: 'direct' | 'other';
    notes: string;
}

export interface CreateBookingResult {
    success: boolean;
    partialSuccess?: boolean;
    status?: 'SUCCESS' | 'AMBIGUOUS' | 'FAILED';
    bookingId?: number;
    warning?: string;
    error?: string;
}

interface CreateBookingModalProps {
    allBookings: Booking[];
    onClose: () => void;
    onCreateBooking: (payload: CreateBookingPayload) => Promise<CreateBookingResult>;
}

export default function CreateBookingModal({
    allBookings,
    onClose,
    onCreateBooking,
}: CreateBookingModalProps) {
    const todayStr = useMemo(() => getKSTTodayStr(), []);
    const tomorrowStr = useMemo(() => getKSTTomorrowStr(), []);

    // 1. 숙소 지점 및 호실 선택 상태
    const [selectedPropertyName, setSelectedPropertyName] = useState<string>(PROPERTY_GROUPS[0].name);
    const currentPropertyGroup = useMemo(
        () => PROPERTY_GROUPS.find((g) => g.name === selectedPropertyName) || PROPERTY_GROUPS[0],
        [selectedPropertyName]
    );

    // 호실 키: `${roomId}-${unitId}` 또는 미배정 `${roomId}-0`
    const [selectedUnitOption, setSelectedUnitOption] = useState<string>(() => {
        const firstUnit = PROPERTY_GROUPS[0].units[0];
        return `${firstUnit.roomId}-${firstUnit.unitId || 1}`;
    });

    // 지점 변경 시 해당 지점의 첫 번째 호실로 기본 선택 전환
    const handlePropertyChange = (propName: string) => {
        setSelectedPropertyName(propName);
        const group = PROPERTY_GROUPS.find((g) => g.name === propName) || PROPERTY_GROUPS[0];
        const firstUnit = group.units[0];
        if (firstUnit) {
            setSelectedUnitOption(`${firstUnit.roomId}-${firstUnit.unitId || 1}`);
        }
    };

    // 2. 일정 및 인원 상태
    const [arrival, setArrival] = useState<string>(todayStr);
    const [departure, setDeparture] = useState<string>(tomorrowStr);
    const [numAdult, setNumAdult] = useState<number>(1);

    // 3. 게스트 정보 상태
    const [lastName, setLastName] = useState<string>('');
    const [firstName, setFirstName] = useState<string>('');
    const [phone, setPhone] = useState<string>('');

    // 4. 결제 및 채널 구분 상태
    const [priceInput, setPriceInput] = useState<string>('');
    const [channelType, setChannelType] = useState<'direct' | 'other'>('direct');

    // 5. 특이사항 메모
    const [notes, setNotes] = useState<string>('');

    // 6. 제출 및 응답 상태
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isAmbiguousWarning, setIsAmbiguousWarning] = useState<boolean>(false);
    const [partialSuccessInfo, setPartialSuccessInfo] = useState<{ bookingId: number; warning: string } | null>(null);

    // 파싱된 roomId / unitId (unitId === 0 이면 미배정 등록)
    const [targetRoomId, targetUnitId] = useMemo(() => {
        const parts = selectedUnitOption.split('-').map(Number);
        return [parts[0] || 0, parts[1] || 0];
    }, [selectedUnitOption]);

    // 투숙 박수 계산
    const stayNights = useMemo(() => {
        if (!arrival || !departure || departure <= arrival) return 0;
        const [ay, am, ad] = arrival.split('-').map(Number);
        const [dy, dm, dd] = departure.split('-').map(Number);
        if (!ay || !am || !ad || !dy || !dm || !dd) return 0;
        const diff = Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ay, am - 1, ad)) / (1000 * 60 * 60 * 24));
        return Math.max(0, diff);
    }, [arrival, departure]);

    // 가상 예약 객체로 기존 findConflictingBookings 재사용 (미배정 unitId === 0 은 충돌 검사 제외)
    const virtualBooking = useMemo<Booking>(
        () => ({
            id: -1,
            roomId: targetRoomId,
            unitId: targetUnitId,
            arrival,
            departure,
            status: 'confirmed',
        }),
        [targetRoomId, targetUnitId, arrival, departure]
    );

    const currentConflicts = useMemo(() => {
        if (targetUnitId <= 0 || targetRoomId <= 0 || !arrival || !departure || departure <= arrival) {
            return [];
        }
        return findConflictingBookings(virtualBooking, targetRoomId, targetUnitId, allBookings);
    }, [virtualBooking, targetRoomId, targetUnitId, arrival, departure, allBookings]);

    const hasConflict = currentConflicts.length > 0;

    // 지점 내 룸타입별 미배정 옵션 추출 (동일 roomId 중복 제거)
    const roomTypeUnallocatedOptions = useMemo(() => {
        const seen = new Set<number>();
        const list: { roomId: number; label: string }[] = [];
        for (const u of currentPropertyGroup.units) {
            if (!seen.has(u.roomId)) {
                seen.add(u.roomId);
                const sameRoomUnits = currentPropertyGroup.units.filter((item) => item.roomId === u.roomId);
                const unitNames = sameRoomUnits.map((item) => item.displayName).join('/');
                const typeLabel = u.subName ? `${u.subName} (${unitNames})` : unitNames;
                list.push({ roomId: u.roomId, label: typeLabel });
            }
        }
        return list;
    }, [currentPropertyGroup]);

    const numericPrice = useMemo(() => {
        const cleaned = priceInput.replace(/[^0-9]/g, '');
        return cleaned ? parseInt(cleaned, 10) : 0;
    }, [priceInput]);

    const estimatedNetPayout = useMemo(() => {
        if (channelType === 'other') {
            return Math.round(numericPrice * (1 - OTHER_CHANNEL_COMMISSION_RATE));
        }
        return numericPrice;
    }, [numericPrice, channelType]);

    const handleArrivalChange = (newArrival: string) => {
        setArrival(newArrival);
        if (departure <= newArrival) {
            setDeparture(addDaysToDateStr(newArrival, 1));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setIsAmbiguousWarning(false);

        if (arrival < todayStr) {
            setErrorMsg(`과거 날짜(${arrival})로는 신규 예약을 등록할 수 없습니다.`);
            return;
        }
        if (departure <= arrival) {
            setErrorMsg('체크아웃 날짜는 체크인 날짜보다 이후여야 합니다.');
            return;
        }
        if (numAdult < 1) {
            setErrorMsg('투숙 인원은 1명 이상이어야 합니다.');
            return;
        }
        if (!lastName.trim() && !firstName.trim()) {
            setErrorMsg('게스트 성(Last Name) 또는 이름(First Name)을 입력해 주세요.');
            return;
        }
        if (hasConflict) {
            setErrorMsg('선택한 호실에 이미 예약이 배정되어 있습니다. 다른 호실을 선택하거나 미배정으로 등록해 주세요.');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await onCreateBooking({
                roomId: targetRoomId,
                unitId: targetUnitId,
                arrival,
                departure,
                numAdult,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
                price: numericPrice,
                channelType,
                notes: notes.trim(),
            });

            if (result.success) {
                if (result.partialSuccess && result.warning) {
                    setPartialSuccessInfo({
                        bookingId: result.bookingId || 0,
                        warning: result.warning,
                    });
                } else {
                    onClose();
                }
            } else {
                if (result.status === 'AMBIGUOUS') {
                    setIsAmbiguousWarning(true);
                }
                setErrorMsg(result.error || '예약 생성에 실패했습니다.');
            }
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="modal-overlay"
            onClick={() => {
                if (!isSubmitting) onClose();
            }}
        >
            <div
                className="modal-box max-w-lg! w-[95%]! max-h-[90vh]! flex flex-col p-0! overflow-hidden bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 상단 헤더 */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/70 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-base">➕</span>
                        <div>
                            <h2 className="text-sm md:text-base font-black text-gray-900 dark:text-slate-100">
                                새 예약 등록 (Beds24 직접 연동)
                            </h2>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                                최고관리자 전용 · Beds24 원본 생성 후 대시보드에 즉시 반영됩니다
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onClose}
                        className="px-2.5 py-1 rounded-md text-xs font-bold bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 cursor-pointer"
                    >
                        닫기 ✖
                    </button>
                </div>

                {/* 부분 성공(Partial Success) 안내 화면 */}
                {partialSuccessInfo ? (
                    <div className="p-5 flex flex-col gap-4">
                        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs leading-relaxed font-bold">
                            <div className="text-sm font-black mb-1.5 flex items-center gap-1.5">
                                <span>⚠️</span>
                                <span>부분 성공 안내 (Beds24 등록 완료: #{partialSuccessInfo.bookingId})</span>
                            </div>
                            <p>{partialSuccessInfo.warning}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg cursor-pointer"
                        >
                            확인 및 닫기
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1 flex flex-col gap-3.5">
                        {/* 오류 또는 AMBIGUOUS 경고 배너 */}
                        {errorMsg && (
                            <div
                                className={`p-3 rounded-lg border text-xs font-bold leading-relaxed ${
                                    isAmbiguousWarning
                                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                                        : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                                }`}
                            >
                                {isAmbiguousWarning ? '⚠️ ' : '🚨 '}
                                {errorMsg}
                            </div>
                        )}

                        {/* 1. 일정 및 인원 */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-gray-200 dark:border-slate-700/80 flex flex-col gap-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-gray-800 dark:text-slate-200">
                                    📅 1. 투숙 일정 및 인원
                                </span>
                                {stayNights > 0 && (
                                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                        총 {stayNights}박
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1">
                                        체크인 (입실일)
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        min={todayStr}
                                        value={arrival}
                                        onChange={(e) => handleArrivalChange(e.target.value)}
                                        className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-bold rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1">
                                        체크아웃 (퇴실일)
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        min={addDaysToDateStr(arrival || todayStr, 1)}
                                        value={departure}
                                        onChange={(e) => setDeparture(e.target.value)}
                                        className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-bold rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1">
                                        투숙 인원 (성인)
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min={1}
                                        max={30}
                                        value={numAdult}
                                        onChange={(e) => setNumAdult(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                        className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-bold rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. 숙소 및 호실 선택 + 실시간 중복 검사 */}
                        <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800/60 flex flex-col gap-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-amber-950 dark:text-amber-200">
                                    🏠 2. 숙소 지점 및 호실 선택
                                </span>
                                <span
                                    className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${
                                        targetUnitId === 0
                                            ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                                            : hasConflict
                                              ? 'bg-rose-100 dark:bg-rose-900/70 text-rose-700 dark:text-rose-200'
                                              : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                                    }`}
                                >
                                    {targetUnitId === 0
                                        ? '⚠️ 미배정 등록 (unitId: 0)'
                                        : hasConflict
                                          ? '🚨 배정 중복 충돌'
                                          : '✅ 배정 가능'}
                                </span>
                            </div>

                            {/* 지점 탭 버튼 */}
                            <div className="grid grid-cols-4 gap-1.5">
                                {PROPERTY_GROUPS.map((group) => {
                                    const isSelected = group.name === selectedPropertyName;
                                    return (
                                        <button
                                            key={group.name}
                                            type="button"
                                            onClick={() => handlePropertyChange(group.name)}
                                            className={`py-1.5 px-2 rounded-md text-xs font-black transition cursor-pointer border ${
                                                isSelected
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {group.name}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* 호실 또는 미배정 선택 드롭다운 */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                                    배정 호실 선택 (또는 미배정 풀 등록)
                                </label>
                                <select
                                    value={selectedUnitOption}
                                    onChange={(e) => setSelectedUnitOption(e.target.value)}
                                    className={`w-full min-h-[38px] px-2.5 py-1.5 text-xs font-black rounded-md border bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 cursor-pointer ${
                                        hasConflict
                                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
                                            : 'border-gray-300 dark:border-slate-600'
                                    }`}
                                >
                                    <optgroup label={`🏠 ${selectedPropertyName} 호실 즉시 배정`}>
                                        {currentPropertyGroup.units.map((u) => {
                                            const uRoomId = u.roomId;
                                            const uUnitId = u.unitId || 1;
                                            const optVal = `${uRoomId}-${uUnitId}`;
                                            const conflicts =
                                                arrival && departure && departure > arrival
                                                    ? findConflictingBookings(
                                                          {
                                                              id: -1,
                                                              roomId: uRoomId,
                                                              unitId: uUnitId,
                                                              arrival,
                                                              departure,
                                                              status: 'confirmed',
                                                          },
                                                          uRoomId,
                                                          uUnitId,
                                                          allBookings
                                                      )
                                                    : [];
                                            return (
                                                <option key={u.key} value={optVal}>
                                                    🏠 {u.displayName} {u.subName ? `(${u.subName})` : ''}{' '}
                                                    {conflicts.length > 0 ? ' (⚠️ 예약 중복)' : ' (공실)'}
                                                </option>
                                            );
                                        })}
                                    </optgroup>
                                    <optgroup label="⚠️ 미배정 상태로 등록 (호실 나중에 배정)">
                                        {roomTypeUnallocatedOptions.map((rt) => (
                                            <option key={`unalloc-${rt.roomId}`} value={`${rt.roomId}-0`}>
                                                ⚠️ [미배정 상태로 등록] {selectedPropertyName} - {rt.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            {/* 실시간 더블 부킹 경고 배지 */}
                            {hasConflict && (
                                <div className="p-2.5 rounded-md bg-rose-100/90 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-[11px] font-bold leading-snug">
                                    🚨 선택한 호실의 해당 기간에 이미{' '}
                                    {currentConflicts
                                        .map((c) => {
                                            const cName =
                                                `${c.firstName || ''} ${c.lastName || ''}`.trim() || `#${c.id}`;
                                            return `[${cName} (${c.arrival}~${c.departure})]`;
                                        })
                                        .join(', ')}{' '}
                                    예약이 배정되어 있습니다. 다른 빈 호실을 선택하거나 아래 &apos;[미배정 상태로 등록]&apos;을 선택해 주세요.
                                </div>
                            )}
                        </div>

                        {/* 3. 게스트 정보 */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-gray-200 dark:border-slate-700/80 flex flex-col gap-2">
                            <span className="text-xs font-black text-gray-800 dark:text-slate-200">
                                👤 3. 게스트 정보
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1">
                                        성 (Last Name) *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="예: 홍"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-bold rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1">
                                        이름 (First Name) *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="예: 길동"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-bold rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1">
                                        연락처 (선택)
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="010-0000-0000"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-bold rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 4. 결제 금액 및 채널 구분 */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-gray-200 dark:border-slate-700/80 flex flex-col gap-2">
                            <span className="text-xs font-black text-gray-800 dark:text-slate-200">
                                💳 4. 결제 금액 및 예약 구분
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1">
                                        총 결제 금액 (KRW 정수)
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="예: 250000"
                                        value={priceInput}
                                        onChange={(e) => setPriceInput(e.target.value.replace(/[^0-9]/g, ''))}
                                        className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-black font-mono rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1">
                                        예약 구분
                                    </label>
                                    <select
                                        value={channelType}
                                        onChange={(e) => setChannelType(e.target.value as 'direct' | 'other')}
                                        className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-bold rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 cursor-pointer"
                                    >
                                        <option value="direct">직접 예약 (워크인 / 전화 / 계좌입금)</option>
                                        <option value="other">기타 채널 (기본 수수료 20% 적용)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-slate-400 pt-1">
                                <span>
                                    입력 금액:{' '}
                                    <strong className="text-gray-900 dark:text-slate-100 font-mono">
                                        ₩{numericPrice.toLocaleString()}
                                    </strong>
                                    {stayNights > 0 && numericPrice > 0 && (
                                        <span className="ml-1.5 text-blue-600 dark:text-blue-400 font-bold">
                                            (1박 평균 ₩{Math.round(numericPrice / stayNights).toLocaleString()})
                                        </span>
                                    )}
                                </span>
                                {channelType === 'other' && numericPrice > 0 && (
                                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                        20% 공제 후 정산 예상: ₩{estimatedNetPayout.toLocaleString()}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 5. 특이사항 메모 */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-gray-200 dark:border-slate-700/80 flex flex-col gap-1.5">
                            <label className="text-xs font-black text-gray-800 dark:text-slate-200">
                                📝 5. 특이사항 메모 (선택)
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Beds24 notes 및 대시보드 내부 메모에 동시에 저장됩니다."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 resize-none"
                            />
                        </div>

                        {/* 하단 액션 버튼 */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-slate-800 shrink-0">
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={onClose}
                                className="min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-200 cursor-pointer"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || hasConflict || stayNights <= 0}
                                className="min-h-[38px] px-5 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white shadow-sm transition cursor-pointer flex items-center gap-1.5"
                            >
                                {isSubmitting ? 'Beds24 등록 중...' : '➕ 예약 생성 및 동기화'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
