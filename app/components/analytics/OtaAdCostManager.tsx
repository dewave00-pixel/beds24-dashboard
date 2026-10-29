'use client';

import { useMemo, useState } from 'react';
import type { OtaAdCharge, OtaAdSetting } from '../../types';
import { getKSTTodayStr } from '../../utils/dateUtils';
import { calculateAdSpendBreakdown } from '../../utils/adCostCalculations';

export interface OtaAdCostManagerProps {
    settings: OtaAdSetting[];
    charges: OtaAdCharge[];
    startDate: string;
    endDate: string;
    settlementRevenue: number;
    revenueAfterAdSpend: number;
    loading: boolean;
    saving: boolean;
    error: string | null;
    onSaveSetting: (input: {
        apiSourceId: number;
        cpcAmount: number | null;
        cpbRate: number | null;
        note: string;
    }) => Promise<void>;
    onAddCharge: (input: {
        apiSourceId: number;
        chargeDate: string;
        amount: number;
        paymentMethod: 'settlement_deduction' | 'card';
        targetProperty: string;
        note: string;
    }) => Promise<void>;
    onDeleteCharge: (id: string) => Promise<void>;
    // 하위 호환성 props (선택 사항)
    selectedProperty?: string;
    tripSettlementRevenue?: number;
    tripRevenueAfterAdSpend?: number;
    tripAdSpend?: number;
    onAddTripCharge?: (input: { chargeDate: string; amount: number; note: string }) => Promise<void>;
    onDeleteTripCharge?: (id: string) => Promise<void>;
}

const OTA_ACCENTS: Record<number, { border: string; badge: string }> = {
    46: { border: 'border-rose-200 dark:border-rose-900/70', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300' },
    19: { border: 'border-blue-200 dark:border-blue-900/70', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    17: { border: 'border-purple-200 dark:border-purple-900/70', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
    53: { border: 'border-amber-300 dark:border-amber-800', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' },
    14: { border: 'border-slate-300 dark:border-slate-700', badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
};

function nullableNumber(value: string): number | null {
    if (value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function OtaSettingEditor({
    setting,
    saving,
    onSave,
}: {
    setting: OtaAdSetting;
    saving: boolean;
    onSave: OtaAdCostManagerProps['onSaveSetting'];
}) {
    const [cpcAmount, setCpcAmount] = useState(setting.cpcAmount?.toString() || '');
    const [cpbRate, setCpbRate] = useState(setting.cpbRate?.toString() || '');
    const [note, setNote] = useState(setting.note);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        setSaved(false);
        try {
            await onSave({
                apiSourceId: setting.apiSourceId,
                cpcAmount: nullableNumber(cpcAmount),
                cpbRate: nullableNumber(cpbRate),
                note,
            });
            setSaved(true);
        } catch {
            // 상위 오류 영역에서 표시
        }
    };

    const style = OTA_ACCENTS[setting.apiSourceId] || OTA_ACCENTS[14];

    return (
        <div className={`rounded-xl border bg-white dark:bg-slate-900 p-3 flex flex-col gap-2 ${style.border}`}>
            <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-black px-2 py-0.5 rounded-md ${style.badge}`}>
                    {setting.channelName}
                </span>
                {saved && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">저장됨</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400">
                    CPC (원/클릭)
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={cpcAmount}
                        onChange={(event) => setCpcAmount(event.target.value)}
                        placeholder="미설정"
                        className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </label>
                <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400">
                    CPB (%)
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={cpbRate}
                        onChange={(event) => setCpbRate(event.target.value)}
                        placeholder="미설정"
                        className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </label>
            </div>
            <input
                type="text"
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="광고 설정 메모"
                className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="self-end rounded-lg bg-slate-900 dark:bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-white dark:text-slate-900 disabled:opacity-50 cursor-pointer transition hover:opacity-90"
            >
                설정 저장
            </button>
        </div>
    );
}

export default function OtaAdCostManager({
    settings,
    charges,
    startDate,
    endDate,
    settlementRevenue,
    revenueAfterAdSpend,
    loading,
    saving,
    error,
    onSaveSetting,
    onAddCharge,
    onDeleteCharge,
    onAddTripCharge,
    onDeleteTripCharge,
}: OtaAdCostManagerProps) {
    const today = getKSTTodayStr();
    const initialChargeDate = today < startDate ? startDate : today > endDate ? endDate : today;

    // 폼 상태 (적용 숙소는 운영 단순화를 위해 제거하고 전체 공통 'all'로 기본 처리)
    const [selectedOtaId, setSelectedOtaId] = useState<number>(53); // 기본 Trip.com
    const [paymentMethod, setPaymentMethod] = useState<'settlement_deduction' | 'card'>('settlement_deduction');
    const [chargeDate, setChargeDate] = useState(initialChargeDate);
    const [chargeAmount, setChargeAmount] = useState('');
    const [chargeNote, setChargeNote] = useState('');

    // 충전 토글 섹션 열림/닫힘 (기본 열림)
    const [isChargesOpen, setIsChargesOpen] = useState(true);

    // 충전액 계산 (숙소 구분 없이 통합 집계)
    const breakdown = useMemo(
        () => calculateAdSpendBreakdown(charges, startDate, endDate),
        [charges, startDate, endDate]
    );

    const handleAdd = async () => {
        const amount = Number(chargeAmount);
        if (!Number.isInteger(amount) || amount <= 0) return;

        try {
            if (onAddCharge) {
                await onAddCharge({
                    apiSourceId: selectedOtaId,
                    chargeDate,
                    amount,
                    paymentMethod,
                    targetProperty: 'all',
                    note: chargeNote,
                });
            } else if (onAddTripCharge) {
                await onAddTripCharge({ chargeDate, amount, note: chargeNote });
            }
            setChargeAmount('');
            setChargeNote('');
        } catch {
            // 상위 에러 영역에서 표시
        }
    };

    const handleDelete = async (id: string, channelName: string, amount: number) => {
        if (!window.confirm(`${channelName} ₩${amount.toLocaleString()} 충전 내역을 삭제할까요?`)) return;
        try {
            if (onDeleteCharge) {
                await onDeleteCharge(id);
            } else if (onDeleteTripCharge) {
                await onDeleteTripCharge(id);
            }
        } catch {
            // 상위 에러 영역에서 표시
        }
    };

    return (
        <section className="rounded-2xl border border-cyan-200 dark:border-cyan-900/70 bg-cyan-50/40 dark:bg-cyan-950/20 p-4 md:p-5 shadow-xs flex flex-col gap-4">
            {/* 상단 헤더 & KPI */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-gray-900 dark:text-slate-100">OTA 광고비 설정 & 충전 관리</h3>
                        <button
                            type="button"
                            onClick={() => setIsChargesOpen((prev) => !prev)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/70 dark:hover:bg-amber-900/80 dark:text-amber-300 transition cursor-pointer border border-amber-300 dark:border-amber-700 shadow-2xs"
                        >
                            <span>💳 광고 충전 내역 ({charges.length}건)</span>
                            <span className="text-[10px]">{isChargesOpen ? '▲ 접기' : '▼ 열기'}</span>
                        </button>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                        CPC·CPB는 운영 참고값입니다. 광고 충전금은 <strong>정산금 차감(매출 공제)</strong> 또는 <strong>카드 직접 결제(별도 지출)</strong>로 구분하여 관리됩니다.
                    </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-right shrink-0">
                    <div>
                        <span className="block text-[10px] text-gray-400">전체 정산 매출</span>
                        <strong className="text-xs font-mono text-gray-800 dark:text-slate-200">
                            ₩{settlementRevenue.toLocaleString()}
                        </strong>
                    </div>
                    <div>
                        <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-bold">광고 정산차감</span>
                        <strong className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">
                            -₩{breakdown.settlementDeductedSpend.toLocaleString()}
                        </strong>
                    </div>
                    <div>
                        <span className="block text-[10px] text-emerald-600 font-bold">광고비 차감 후</span>
                        <strong className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                            ₩{revenueAfterAdSpend.toLocaleString()}
                        </strong>
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="py-6 text-center text-xs font-bold text-gray-400">광고 설정을 불러오는 중입니다…</div>
            ) : (
                <>
                    {/* 5개 OTA CPC/CPB 기본 설정 카드 그리드 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5">
                        {settings.map((setting) => (
                            <OtaSettingEditor
                                key={setting.apiSourceId}
                                setting={setting}
                                saving={saving}
                                onSave={onSaveSetting}
                            />
                        ))}
                    </div>

                    {/* 💳 통합 다중 OTA 광고 충전 관리 섹션 (토글 패널) */}
                    {isChargesOpen && (
                        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/80 bg-white/90 dark:bg-slate-900/90 p-4 flex flex-col gap-4 shadow-2xs">
                            {/* 헤더 & 통계 요약 바 (충전금 색상 통일) */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <strong className="text-xs text-amber-900 dark:text-amber-200 font-black">
                                            OTA 광고 충전 및 집행 원장
                                        </strong>
                                        <span className="text-[10px] font-mono text-gray-400">
                                            {startDate} ~ {endDate}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                        모든 OTA(트립닷컴, 아고다, 부킹닷컴 등)의 충전금을 등록하고, 정산금 차감 또는 카드 결제 방식을 선택합니다.
                                    </p>
                                </div>

                                {/* 충전금 색상 통일: amber 계열로 일원화하여 빨강/파랑 혼선 제거 */}
                                <div className="grid grid-cols-3 gap-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 p-2.5 text-right shrink-0">
                                    <div>
                                        <span className="block text-[10px] text-gray-500 dark:text-slate-400 font-bold">총 충전합계</span>
                                        <strong className="text-xs font-mono text-gray-900 dark:text-slate-100 font-black">
                                            ₩{breakdown.totalSpend.toLocaleString()}
                                        </strong>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-amber-700 dark:text-amber-400 font-bold">정산금 차감(공제)</span>
                                        <strong className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">
                                            -₩{breakdown.settlementDeductedSpend.toLocaleString()}
                                        </strong>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-amber-700 dark:text-amber-400 font-bold">카드 직접결제</span>
                                        <strong className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">
                                            ₩{breakdown.cardSpend.toLocaleString()}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* 신규 충전 등록 폼 (적용 숙소 제거, 4개 컬럼으로 단순화) */}
                            <div className="rounded-xl bg-gray-50/80 dark:bg-slate-800/60 p-3.5 border border-gray-200/80 dark:border-slate-700/80 flex flex-col gap-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-gray-700 dark:text-slate-200">
                                        새 광고 충전 내역 등록
                                    </span>
                                    {/* 결제 방식 선택: 동일한 앰버/블랙 톤으로 색상 통일 */}
                                    <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className="text-gray-400 font-bold">결제 방식:</span>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('settlement_deduction')}
                                            className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition ${
                                                paymentMethod === 'settlement_deduction'
                                                    ? 'bg-amber-500 text-white shadow-2xs'
                                                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600'
                                            }`}
                                        >
                                            정산금 차감 (매출 공제)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('card')}
                                            className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition ${
                                                paymentMethod === 'card'
                                                    ? 'bg-amber-500 text-white shadow-2xs'
                                                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600'
                                            }`}
                                        >
                                            카드 직접 결제 (별도 비용)
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                                    {/* OTA 선택 */}
                                    <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 flex flex-col gap-1">
                                        OTA 채널
                                        <select
                                            value={selectedOtaId}
                                            onChange={(e) => setSelectedOtaId(Number(e.target.value))}
                                            className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs font-bold text-gray-900 dark:text-slate-100 cursor-pointer focus:outline-none"
                                        >
                                            <option value={53}>Trip.com (트립닷컴)</option>
                                            <option value={17}>Agoda (아고다)</option>
                                            <option value={19}>Booking.com (부킹닷컴)</option>
                                            <option value={46}>Airbnb (에어비앤비)</option>
                                            <option value={14}>Expedia (익스피디아)</option>
                                        </select>
                                    </label>

                                    {/* 충전일자 */}
                                    <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 flex flex-col gap-1">
                                        충전일자
                                        <input
                                            type="date"
                                            value={chargeDate}
                                            onChange={(e) => setChargeDate(e.target.value)}
                                            className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs text-gray-900 dark:text-slate-100 focus:outline-none"
                                        />
                                    </label>

                                    {/* 충전금액 */}
                                    <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 flex flex-col gap-1">
                                        충전 금액 (원)
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={chargeAmount}
                                            onChange={(e) => setChargeAmount(e.target.value)}
                                            placeholder="예: 500000"
                                            className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs font-mono font-bold text-gray-900 dark:text-slate-100 focus:outline-none"
                                        />
                                    </label>

                                    {/* 메모 및 등록 버튼 */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400">
                                            메모 & 등록
                                        </label>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="text"
                                                maxLength={500}
                                                value={chargeNote}
                                                onChange={(e) => setChargeNote(e.target.value)}
                                                placeholder="프로모션, 비고"
                                                className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs text-gray-900 dark:text-slate-100 focus:outline-none"
                                            />
                                            <button
                                                type="button"
                                                disabled={saving || !chargeDate || !chargeAmount}
                                                onClick={handleAdd}
                                                className="shrink-0 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black px-3.5 py-2 text-xs transition cursor-pointer disabled:opacity-40 whitespace-nowrap shadow-2xs"
                                            >
                                                등록
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 충전 내역 목록 (적용 숙소 배지 제거, 색상 일원화) */}
                            {charges.length === 0 ? (
                                <p className="py-4 text-center text-xs text-gray-400">
                                    조회 기간({startDate} ~ {endDate})에 등록된 광고 충전 내역이 없습니다.
                                </p>
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800 max-h-80 overflow-y-auto pr-1">
                                    {charges.map((charge) => {
                                        const isCard = charge.paymentMethod === 'card';
                                        const accent = OTA_ACCENTS[charge.apiSourceId] || OTA_ACCENTS[14];

                                        return (
                                            <div
                                                key={charge.id}
                                                className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 py-2.5 text-xs hover:bg-gray-50/50 dark:hover:bg-slate-800/40 rounded-lg px-2 transition"
                                            >
                                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                    <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                                                        {charge.chargeDate}
                                                    </span>

                                                    {/* OTA 채널 배지 */}
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${accent.badge}`}>
                                                        {charge.channelName}
                                                    </span>

                                                    {/* 결제 방식 태그 (색상 통일) */}
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
                                                        {isCard ? '💳 카드결제' : '📉 정산차감'}
                                                    </span>

                                                    {charge.note && (
                                                        <span className="text-gray-400 text-[11px] truncate max-w-xs break-all">
                                                            {charge.note}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0 ml-auto">
                                                    {/* 금액 폰트 색상 통일: 동일한 앰버/골드 톤 */}
                                                    <strong className="font-mono text-xs font-black text-amber-600 dark:text-amber-400">
                                                        {isCard ? `₩${charge.amount.toLocaleString()}` : `-₩${charge.amount.toLocaleString()}`}
                                                    </strong>
                                                    <button
                                                        type="button"
                                                        disabled={saving}
                                                        onClick={() => handleDelete(charge.id, charge.channelName, charge.amount)}
                                                        className="rounded-md px-2 py-1 text-[11px] font-bold text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 cursor-pointer disabled:opacity-40 transition"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
