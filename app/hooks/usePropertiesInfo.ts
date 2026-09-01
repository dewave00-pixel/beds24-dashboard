'use client';

import { useState, useEffect } from 'react';

export interface UnitInfoData {
    doorPassword: string;
    maxGuests: number;
    repairNotes: string;
}

export function usePropertiesInfo() {
    const [propertiesInfo, setPropertiesInfo] = useState<{ [id: string]: UnitInfoData }>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [editingId, setEditingId] = useState<string | null>(null);

    // 인라인 수정 상태
    const [editPassword, setEditPassword] = useState<string>('');
    const [editMaxGuests, setEditMaxGuests] = useState<number>(2);
    const [editRepairNotes, setEditRepairNotes] = useState<string>('');
    const [saving, setSaving] = useState<boolean>(false);

    // 복사 피드백 상태
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // 1. Supabase에서 숙소 정보 불러오기
    const fetchPropertiesInfo = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/properties-info');
            const data = await res.json();
            if (data.success && data.data) {
                setPropertiesInfo(data.data);
            }
        } catch (e) {
            console.error('숙소 정보 불러오기 실패:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPropertiesInfo();
    }, []);

    // 2. 수정 모드 진입
    const handleStartEdit = (unitKey: string, currentData?: UnitInfoData) => {
        setEditingId(unitKey);
        setEditPassword(currentData?.doorPassword || '');
        setEditMaxGuests(currentData?.maxGuests || 2);
        setEditRepairNotes(currentData?.repairNotes || '');
    };

    // 3. 수정 취소
    const handleCancelEdit = () => {
        setEditingId(null);
    };

    // 4. 정보 저장하기
    const handleSave = async (unitKey: string, roomId: number, unitId?: number) => {
        setSaving(true);
        try {
            const res = await fetch('/api/properties-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unitKey,
                    id: unitKey,
                    roomId,
                    unitId: unitId || null,
                    doorPassword: editPassword,
                    maxGuests: editMaxGuests,
                    repairNotes: editRepairNotes,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setPropertiesInfo((prev) => ({
                    ...prev,
                    [unitKey]: {
                        doorPassword: editPassword,
                        maxGuests: editMaxGuests,
                        repairNotes: editRepairNotes,
                    },
                }));
                setEditingId(null);
            } else {
                alert('저장에 실패했습니다: ' + (data.error || ''));
            }
        } catch (e) {
            console.error('숙소 정보 저장 실패:', e);
            alert('서버 통신 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    // 5. 비밀번호 원클릭 복사
    const handleCopyPassword = (unitKey: string, password: string) => {
        if (!password) return;
        navigator.clipboard.writeText(password);
        setCopiedId(unitKey);
        setTimeout(() => {
            setCopiedId(null);
        }, 1500);
    };

    return {
        propertiesInfo,
        loading,
        editingId,
        editPassword,
        setEditPassword,
        editMaxGuests,
        setEditMaxGuests,
        editRepairNotes,
        setEditRepairNotes,
        saving,
        copiedId,
        handleStartEdit,
        handleCancelEdit,
        handleSave,
        handleCopyPassword,
    };
}