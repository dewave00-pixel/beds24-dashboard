'use client';

import { useState, useMemo, useEffect } from 'react';
import { useDashboard } from './useDashboard';
import { ALL_UNITS } from '../config';
import { CleaningAssignment } from '../types';

export const DEFAULT_STAFF_MAP: Record<string, string> = {
    manager: '소영매니저님',
    staff_2: '가연영님',
    staff_3: '지명님',
    staff_4: 'ZEAL님',
};

export function useCleaningBoard() {
    const dash = useDashboard();
    const [selectedDate, setSelectedDate] = useState<string>(dash.todayStr);
    
    // 상태 기반 담당자 맵
    const [staffMap, setStaffMap] = useState<Record<string, string>>(DEFAULT_STAFF_MAP);

    // 호실별 배정 객체: { 'yeonnam_101': { staffName: '이모님A', staffId: 'staff_1', assignedAt: '14:25' } }
    const [assignments, setAssignments] = useState<{ [unitKey: string]: CleaningAssignment }>({});

    const cleaningTargetUnits = useMemo(() => {
        return ALL_UNITS.filter((unit) => {
            const hasCheckout = dash.bookings.some((b) => {
                const isRoomMatch = Number(b.roomId) === Number(unit.roomId);
                const isUnitMatch = unit.unitId ? Number(b.unitId) === Number(unit.unitId) : true;
                return isRoomMatch && isUnitMatch && b.departure === selectedDate;
            });
            const hasCheckin = dash.bookings.some((b) => {
                const isRoomMatch = Number(b.roomId) === Number(unit.roomId);
                const isUnitMatch = unit.unitId ? Number(b.unitId) === Number(unit.unitId) : true;
                return isRoomMatch && isUnitMatch && b.arrival === selectedDate;
            });
            return hasCheckout || hasCheckin;
        });
    }, [dash.bookings, selectedDate]);

    // 스태프 이름 맵 DB 불러오기
    useEffect(() => {
        // 1. 빠른 초기 렌더링을 위해 로컬 캐시 우선 적용
        const saved = localStorage.getItem('beds24_staff_map');
        if (saved) {
            try {
                setStaffMap(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse cached staff map');
            }
        }

        // 2. Supabase DB에서 최신 스태프 명단 동기화
        const fetchStaffMapFromDB = async () => {
            try {
                const res = await fetch('/api/staff');
                const result = await res.json();
                if (result.success && result.data) {
                    setStaffMap(result.data);
                    localStorage.setItem('beds24_staff_map', JSON.stringify(result.data));
                }
            } catch (err) {
                console.error('스태프 목록 DB 불러오기 실패:', err);
            }
        };

        fetchStaffMapFromDB();
    }, []);

    // 스태프 이름 맵 업데이트 (화면 즉시 반영 + DB 영구 저장)
    const updateStaffMap = async (newMap: Record<string, string>) => {
        setStaffMap(newMap);
        localStorage.setItem('beds24_staff_map', JSON.stringify(newMap));

        try {
            await fetch('/api/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffMap: newMap }),
            });
        } catch (err) {
            console.error('스태프 목록 DB 저장 실패:', err);
        }
    };

    const staffList = useMemo(() => Object.values(staffMap), [staffMap]);

    const getStaffIdByName = (name: string) => {
        if (name === 'manager' || name === 'staff_1') {
            return 'manager';
        }
        if (name === 'staff_2' || name === 'staff_3' || name === 'staff_4') {
            return name;
        }
        for (const [id, staffName] of Object.entries(staffMap)) {
            if (staffName === name) return id === 'staff_1' ? 'manager' : id;
        }
        for (const [id, staffName] of Object.entries(DEFAULT_STAFF_MAP)) {
            if (staffName === name) return id;
        }
        return 'manager';
    };

    // 배정 내역 불러오기
    useEffect(() => {
        const fetchAssignments = async () => {
            try {
                const res = await fetch(`/api/assignments?targetDate=${selectedDate}`);
                const result = await res.json();
                if (result.success && result.data) {
                    setAssignments(result.data);
                } else {
                    setAssignments({});
                }
            } catch (error) {
                console.error('배정 내역 불러오기 실패:', error);
            }
        };

        fetchAssignments();
    }, [selectedDate]);

    // 배정 함수 (unitKey, staffName, assignedAt 3가지를 완벽히 주입 및 DB 저장)
    const assignStaff = async (unitKey: string, staffName: string) => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;
        const staffId = getStaffIdByName(staffName);

        const newAssignment = {
            unitKey,
            staffName,
            staffId,
            assignedAt: timeStr,
        };

        // 화면 즉각 반영 (Optimistic UI)
        setAssignments((prev) => ({
            ...prev,
            [unitKey]: newAssignment,
        }));

        // DB 저장 (비동기)
        try {
            await fetch('/api/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unitKey: newAssignment.unitKey,
                    targetDate: selectedDate,
                    staffName: newAssignment.staffName,
                    staffId: newAssignment.staffId,
                    assignedAt: newAssignment.assignedAt,
                }),
            });
        } catch (err) {
            console.error('배정 저장 실패:', err);
        }
    };

    // 배정 해제 함수 (DB 삭제 포함)
    const unassignStaff = async (unitKey: string) => {
        // 화면 즉각 반영
        setAssignments((prev) => {
            const updated = { ...prev };
            delete updated[unitKey];
            return updated;
        });

        // DB 삭제 (비동기)
        try {
            await fetch(`/api/assignments?unitKey=${unitKey}&targetDate=${selectedDate}`, {
                method: 'DELETE',
            });
        } catch (err) {
            console.error('배정 해제 실패:', err);
        }
    };

    // 청소 완료 상태 토글 함수 (DB 비동기 저장 포함)
    const toggleComplete = async (unitKey: string) => {
        const current = assignments[unitKey];
        if (!current) return;

        const nextCompleted = !current.isCompleted;
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const completedAt = nextCompleted ? `${hours}:${minutes}` : '';

        const updatedAssignment: CleaningAssignment = {
            ...current,
            isCompleted: nextCompleted,
            completedAt,
        };

        // 화면 즉각 반영 (Optimistic UI)
        setAssignments((prev) => ({
            ...prev,
            [unitKey]: updatedAssignment,
        }));

        // DB 저장 (비동기)
        try {
            await fetch('/api/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unitKey: updatedAssignment.unitKey,
                    targetDate: selectedDate,
                    staffName: updatedAssignment.staffName,
                    staffId: updatedAssignment.staffId,
                    assignedAt: updatedAssignment.assignedAt,
                    isCompleted: updatedAssignment.isCompleted,
                    completedAt: updatedAssignment.completedAt,
                }),
            });
        } catch (err) {
            console.error('청소 완료 상태 저장 실패:', err);
        }
    };

    return {
        ...dash,
        selectedDate,
        setSelectedDate,
        staffList,
        staffMap,
        updateStaffMap,
        assignments,
        cleaningTargetUnits,
        assignStaff,
        unassignStaff,
        toggleComplete,
    };
}