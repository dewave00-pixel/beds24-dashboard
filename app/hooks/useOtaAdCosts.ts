'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OtaAdCharge, OtaAdSetting } from '../types';

interface AdsApiResponse {
    success: boolean;
    error?: string;
    settings?: OtaAdSetting[];
    charges?: OtaAdCharge[];
}

interface SaveSettingInput {
    apiSourceId: number;
    cpcAmount: number | null;
    cpbRate: number | null;
    note: string;
}

export interface AddChargeInput {
    apiSourceId: number;
    chargeDate: string;
    amount: number;
    paymentMethod: 'settlement_deduction' | 'card';
    targetProperty: string;
    note: string;
}

export function useOtaAdCosts(startDate: string, endDate: string) {
    const [settings, setSettings] = useState<OtaAdSetting[]>([]);
    const [charges, setCharges] = useState<OtaAdCharge[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async (signal?: AbortSignal) => {
        const response = await fetch(
            `/api/analytics/ads?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
            { cache: 'no-store', signal }
        );
        const result = await response.json() as AdsApiResponse;
        if (!response.ok || !result.success) {
            throw new Error(result.error || '광고비 데이터를 불러오지 못했습니다.');
        }
        return result;
    }, [startDate, endDate]);

    const refresh = useCallback(async () => {
        const result = await fetchData();
        setSettings(result.settings || []);
        setCharges(result.charges || []);
        setError(null);
    }, [fetchData]);

    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            setLoading(true);
            try {
                const result = await fetchData(controller.signal);
                if (controller.signal.aborted) return;
                setSettings(result.settings || []);
                setCharges(result.charges || []);
                setError(null);
            } catch (loadError: unknown) {
                if (controller.signal.aborted) return;
                setError(loadError instanceof Error ? loadError.message : '광고비 데이터를 불러오지 못했습니다.');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        load();
        return () => controller.abort();
    }, [fetchData]);

    const postAction = async (payload: Record<string, unknown>) => {
        const response = await fetch('/api/analytics/ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await response.json() as AdsApiResponse;
        if (!response.ok || !result.success) {
            throw new Error(result.error || '광고비 데이터를 저장하지 못했습니다.');
        }
    };

    const saveSetting = async (input: SaveSettingInput) => {
        setSaving(true);
        try {
            await postAction({ action: 'save-setting', ...input });
            await refresh();
        } catch (saveError: unknown) {
            const message = saveError instanceof Error ? saveError.message : '광고 설정을 저장하지 못했습니다.';
            setError(message);
            throw saveError;
        } finally {
            setSaving(false);
        }
    };

    const addCharge = async (input: AddChargeInput) => {
        setSaving(true);
        try {
            await postAction({ action: 'add-charge', ...input });
            await refresh();
        } catch (saveError: unknown) {
            const message = saveError instanceof Error ? saveError.message : '광고 충전 내역을 저장하지 못했습니다.';
            setError(message);
            throw saveError;
        } finally {
            setSaving(false);
        }
    };

    const deleteCharge = async (id: string) => {
        setSaving(true);
        try {
            const response = await fetch(`/api/analytics/ads?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            const result = await response.json() as AdsApiResponse;
            if (!response.ok || !result.success) {
                throw new Error(result.error || '광고 충전 내역을 삭제하지 못했습니다.');
            }
            await refresh();
        } catch (deleteError: unknown) {
            const message = deleteError instanceof Error ? deleteError.message : '광고 충전 내역을 삭제하지 못했습니다.';
            setError(message);
            throw deleteError;
        } finally {
            setSaving(false);
        }
    };

    // 하위 호환성 래퍼
    const addTripCharge = (input: { chargeDate: string; amount: number; note: string }) =>
        addCharge({
            apiSourceId: 53,
            chargeDate: input.chargeDate,
            amount: input.amount,
            paymentMethod: 'settlement_deduction',
            targetProperty: 'all',
            note: input.note,
        });
    const deleteTripCharge = (id: string) => deleteCharge(id);

    return {
        settings,
        charges,
        loading,
        saving,
        error,
        saveSetting,
        addCharge,
        deleteCharge,
        addTripCharge,
        deleteTripCharge,
        refresh,
    };
}
