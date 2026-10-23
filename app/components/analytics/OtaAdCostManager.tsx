'use client';

import { useState } from 'react';
import type { OtaAdCharge, OtaAdSetting } from '../../types';
import { getKSTTodayStr } from '../../utils/dateUtils';

interface OtaAdCostManagerProps {
    settings: OtaAdSetting[];
    charges: OtaAdCharge[];
    startDate: string;
    endDate: string;
    settlementRevenue: number;
    revenueAfterAdSpend: number;
    tripSettlementRevenue: number;
    tripRevenueAfterAdSpend: number;
    tripAdSpend: number;
    loading: boolean;
    saving: boolean;
    error: string | null;
    onSaveSetting: (input: {
        apiSourceId: number;
        cpcAmount: number | null;
        cpbRate: number | null;
        note: string;
    }) => Promise<void>;
    onAddTripCharge: (input: { chargeDate: string; amount: number; note: string }) => Promise<void>;
    onDeleteTripCharge: (id: string) => Promise<void>;
}

const OTA_ACCENTS: Record<number, string> = {
    46: 'border-rose-200 dark:border-rose-900/70',
    19: 'border-blue-200 dark:border-blue-900/70',
    17: 'border-purple-200 dark:border-purple-900/70',
    53: 'border-amber-300 dark:border-amber-800',
    14: 'border-slate-300 dark:border-slate-700',
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
    isTripDetailsOpen = false,
    onToggleTripDetails,
}: {
    setting: OtaAdSetting;
    saving: boolean;
    onSave: OtaAdCostManagerProps['onSaveSetting'];
    isTripDetailsOpen?: boolean;
    onToggleTripDetails?: () => void;
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
            // 상위 오류 영역에서 API 오류를 표시한다.
        }
    };

    return (
        <div className={`rounded-xl border bg-white dark:bg-slate-900 p-3 flex flex-col gap-2 ${OTA_ACCENTS[setting.apiSourceId] || OTA_ACCENTS[14]}`}>
            <div className="flex items-center justify-between gap-2">
                {setting.apiSourceId === 53 ? (
                    <button
                        type="button"
                        aria-expanded={isTripDetailsOpen}
                        onClick={onToggleTripDetails}
                        className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-300 cursor-pointer"
                    >
                        <span>{setting.channelName}</span>
                        <span className="text-[10px]">{isTripDetailsOpen ? '▲ 접기' : '▼ 정산·충전 보기'}</span>
                    </button>
                ) : (
                    <strong className="text-xs text-gray-900 dark:text-slate-100">{setting.channelName}</strong>
                )}
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
                        className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-gray-900 dark:text-slate-100"
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
                        className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-gray-900 dark:text-slate-100"
                    />
                </label>
            </div>
            <input
                type="text"
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="광고 설정 메모"
                className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-gray-900 dark:text-slate-100"
            />
            <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="self-end rounded-lg bg-slate-900 dark:bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-white dark:text-slate-900 disabled:opacity-50 cursor-pointer"
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
    tripSettlementRevenue,
    tripRevenueAfterAdSpend,
    tripAdSpend,
    loading,
    saving,
    error,
    onSaveSetting,
    onAddTripCharge,
    onDeleteTripCharge,
}: OtaAdCostManagerProps) {
    const today = getKSTTodayStr();
    const initialChargeDate = today < startDate ? startDate : today > endDate ? endDate : today;
    const [chargeDate, setChargeDate] = useState(initialChargeDate);
    const [chargeAmount, setChargeAmount] = useState('');
    const [chargeNote, setChargeNote] = useState('');
    const [isTripDetailsOpen, setIsTripDetailsOpen] = useState(false);

    const handleAddCharge = async () => {
        const amount = Number(chargeAmount);
        if (!Number.isInteger(amount) || amount <= 0) return;

        try {
            await onAddTripCharge({ chargeDate, amount, note: chargeNote });
            setChargeAmount('');
            setChargeNote('');
        } catch {
            // 상위 오류 영역에서 API 오류를 표시한다.
        }
    };

    const handleDeleteCharge = async (id: string) => {
        if (!window.confirm('이 Trip.com 충전 내역을 삭제할까요?')) return;
        try {
            await onDeleteTripCharge(id);
        } catch {
            // 상위 오류 영역에서 API 오류를 표시한다.
        }
    };

    return (
        <section className="rounded-2xl border border-cyan-200 dark:border-cyan-900/70 bg-cyan-50/40 dark:bg-cyan-950/20 p-4 md:p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-slate-100">OTA 광고비 설정</h3>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                        CPC·CPB는 운영 참고값입니다. CPB는 기존 정산 수수료에 포함되어 추가 차감하지 않고, Trip.com 실제 충전액만 매출에서 차감합니다.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-right shrink-0">
                    <div>
                        <span className="block text-[10px] text-gray-400">전체 정산 매출</span>
                        <strong className="text-xs font-mono text-gray-800 dark:text-slate-200">₩{settlementRevenue.toLocaleString()}</strong>
                    </div>
                    <div>
                        <span className="block text-[10px] text-emerald-600">광고비 차감 후</span>
                        <strong className="text-xs font-mono text-emerald-700 dark:text-emerald-400">₩{revenueAfterAdSpend.toLocaleString()}</strong>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5">
                        {settings.map((setting) => (
                            <OtaSettingEditor
                                key={setting.apiSourceId}
                                setting={setting}
                                saving={saving}
                                onSave={onSaveSetting}
                                isTripDetailsOpen={setting.apiSourceId === 53 && isTripDetailsOpen}
                                onToggleTripDetails={setting.apiSourceId === 53
                                    ? () => setIsTripDetailsOpen((previous) => !previous)
                                    : undefined}
                            />
                        ))}
                    </div>

                    {isTripDetailsOpen && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white/80 dark:bg-slate-900/80 p-3 flex flex-col gap-3">
                        <div>
                            <strong className="text-xs text-amber-800 dark:text-amber-300">Trip.com CPC 선충전 내역</strong>
                            <p className="text-[10px] text-gray-400 mt-0.5">{startDate} ~ {endDate} 충전액만 현재 매출에서 차감됩니다.</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/60 p-2.5 text-right">
                            <div>
                                <span className="block text-[10px] text-amber-700 dark:text-amber-400">Trip 정산 매출</span>
                                <strong className="text-xs font-mono text-gray-900 dark:text-slate-100">₩{tripSettlementRevenue.toLocaleString()}</strong>
                            </div>
                            <div>
                                <span className="block text-[10px] text-rose-500">충전액</span>
                                <strong className="text-xs font-mono text-rose-600 dark:text-rose-400">-₩{tripAdSpend.toLocaleString()}</strong>
                            </div>
                            <div>
                                <span className="block text-[10px] text-emerald-600">차감 후 매출</span>
                                <strong className="text-xs font-mono text-emerald-700 dark:text-emerald-400">₩{tripRevenueAfterAdSpend.toLocaleString()}</strong>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[150px_180px_1fr_auto] gap-2">
                            <input
                                type="date"
                                min={startDate}
                                max={endDate}
                                value={chargeDate}
                                onChange={(event) => setChargeDate(event.target.value)}
                                className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs text-gray-900 dark:text-slate-100"
                            />
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={chargeAmount}
                                onChange={(event) => setChargeAmount(event.target.value)}
                                placeholder="충전액 (원)"
                                className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs text-gray-900 dark:text-slate-100"
                            />
                            <input
                                type="text"
                                maxLength={500}
                                value={chargeNote}
                                onChange={(event) => setChargeNote(event.target.value)}
                                placeholder="메모 (선택)"
                                className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs text-gray-900 dark:text-slate-100"
                            />
                            <button
                                type="button"
                                disabled={saving || !chargeDate || !chargeAmount}
                                onClick={handleAddCharge}
                                className="rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50 cursor-pointer whitespace-nowrap"
                            >
                                충전 등록
                            </button>
                        </div>

                        {charges.length === 0 ? (
                            <p className="py-3 text-center text-[11px] text-gray-400">조회 기간에 등록된 Trip.com 충전 내역이 없습니다.</p>
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
                                {charges.map((charge) => (
                                    <div key={charge.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                                        <div className="min-w-0">
                                            <span className="font-mono font-bold text-gray-800 dark:text-slate-200">{charge.chargeDate}</span>
                                            {charge.note && <span className="ml-2 text-gray-400 break-all">{charge.note}</span>}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <strong className="font-mono text-rose-600 dark:text-rose-400">₩{charge.amount.toLocaleString()}</strong>
                                            <button
                                                type="button"
                                                disabled={saving}
                                                onClick={() => handleDeleteCharge(charge.id)}
                                                className="rounded-md px-2 py-1 text-[10px] font-bold text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 cursor-pointer disabled:opacity-50"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    )}
                </>
            )}
        </section>
    );
}
