'use client';

import { useState, useMemo, useEffect } from 'react';
import { useDashboard } from './useDashboard';
import { ALL_UNITS } from '../config';
import { CleaningAssignment } from '../types';

export const DEFAULT_STAFF_LIST = ['소영매니저님', '가연영님', '지명님', 'ZEAL님'];

export function useCleaningBoard() {
    const dash = useDashboard();
    const [selectedDate, setSelectedDate] = useState<string>(dash.todayStr);
    const [staffList, setStaffList] = useState<string[]>(DEFAULT_STAFF_LIST);

    // 호실별 배정 객체: { 'yeonnam_101': { staffName: '이모님A', assignedAt: '14:25' } }
    const [assignments, setAssignments] = useState<{ [unitKey: string]: CleaningAssignment }>({});

    const cleaningTargetUnits = useMemo(() => {
        return ALL_UNITS.filter((unit) => {
            const hasCheckout = dash.bookings.some(
                (b) => b.roomId === unit.roomId && b.departure === selectedDate
            );
            const hasCheckin = dash.bookings.some(
                (b) => b.roomId === unit.roomId && b.arrival === selectedDate
            );
            return hasCheckout || hasCheckin;
        });
    }, [dash.bookings, selectedDate]);

    const getStaffIdByName = (name: string) => {
        if (name === '소영매니저님') return 'staff_1';
        if (name === '가연영님') return 'staff_2';
        if (name === '지명님') return 'staff_3';
        if (name === 'ZEAL님') return 'staff_4';
        return 'staff_unknown';
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

    return {
        ...dash,
        selectedDate,
        setSelectedDate,
        staffList,
        setStaffList,
        assignments,
        cleaningTargetUnits,
        assignStaff,
        unassignStaff,
    };
}