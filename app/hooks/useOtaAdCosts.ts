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

interface AddChargeInput {
    chargeDate: string;
    amount: number;
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

    const addTripCharge = async (input: AddChargeInput) => {
        setSaving(true);
        try {
            await postAction({ action: 'add-charge', apiSourceId: 53, ...input });
            await refresh();
        } catch (saveError: unknown) {
            const message = saveError instanceof Error ? saveError.message : 'Trip 충전 내역을 저장하지 못했습니다.';
            setError(message);
            throw saveError;
        } finally {
            setSaving(false);
        }
    };

    const deleteTripCharge = async (id: string) => {
        setSaving(true);
        try {
            const response = await fetch(`/api/analytics/ads?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            const result = await response.json() as AdsApiResponse;
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Trip 충전 내역을 삭제하지 못했습니다.');
            }
            await refresh();
        } catch (deleteError: unknown) {
            const message = deleteError instanceof Error ? deleteError.message : 'Trip 충전 내역을 삭제하지 못했습니다.';
            setError(message);
            throw deleteError;
        } finally {
            setSaving(false);
        }
    };

    return {
        settings,
        charges,
        loading,
        saving,
        error,
        saveSetting,
        addTripCharge,
        deleteTripCharge,
        refresh,
    };
}
