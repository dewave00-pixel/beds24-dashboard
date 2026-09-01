'use client';

import { useState, useEffect } from 'react';
import { Booking } from '../types';
import { isValidBooking, isUnallocatedBooking } from '../utils/bookingUtils';
import {
    getKSTTodayStr,
    getKSTTomorrowStr,
    getKSTDateOffset,
    formatKSTDate,
    getMsUntilNextMidnightKST,
} from '../utils/dateUtils';

export interface BookingNoteData {
    note: string;
    tags: string[];
}

export function useDashboard() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'vertical' | 'horizontal'>('vertical');
    const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 0.5 ~ 1.5

    // 모달 및 메모/태그 상태
    const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
    const [memoInput, setMemoInput] = useState<string>('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [bookingNotes, setBookingNotes] = useState<Record<string | number, BookingNoteData>>({});

    // 팝업 모달 상태
    const [dailyModalType, setDailyModalType] = useState<'today' | 'tomorrow' | null>(null);
    const [isTotalNotesOpen, setIsTotalNotesOpen] = useState<boolean>(false);
    const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
    const [isUnallocatedModalOpen, setIsUnallocatedModalOpen] = useState<boolean>(false);

    // 날짜 계산 기준 (기본값: 한국 시간 오늘 기준 이틀 전부터)
    const [startDate, setStartDate] = useState<Date>(() => getKSTDateOffset(-2));

    const displayDaysCount = 14;

    // 1. Supabase 메모/태그 불러오기
    const fetchNotes = async () => {
        try {
            const res = await fetch('/api/notes', { cache: 'no-store' });
            const data = await res.json();
            if (data.success && data.data) {
                setBookingNotes(data.data);
            }
        } catch (e) {
            console.error('메모/태그 불러오기 실패:', e);
        }
    };

    // 2. Beds24 실시간 예약 데이터 불러오기 (forceSync=true 시 Beds24 본사 직접 긁어오기)
    const fetchReservations = async (forceSync: boolean = false) => {
        if (!forceSync) setLoading(true);
        setError(null);
        try {
            const url = forceSync ? '/api/reservations?sync=true' : '/api/reservations';
            const res = await fetch(url, { cache: 'no-store' });
            const data = await res.json();

            if (data.success) {
                const list = Array.isArray(data.data) ? data.data : [];
                setBookings(list.filter((b: Booking) => isValidBooking(b)));
            } else {
                setError(data.error || '예약 데이터를 불러오지 못했습니다.');
            }
        } catch (err) {
            setError('서버 통신 오류가 발생했습니다.');
        } finally {
            if (!forceSync) setLoading(false);
        }
    };

    // 일반 새로고침 (DB 캐시 기반 빠른 재조회)
    const reloadAll = async () => {
        await Promise.all([fetchReservations(false), fetchNotes()]);
    };

    // 🔄 Beds24 실시간 강제 동기화 (버튼 클릭 시 Beds24 본사 직접 긁어와 Supabase 정합성 맞추기)
    const syncWithBeds24 = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            await Promise.all([fetchReservations(true), fetchNotes()]);
        } catch (e) {
            console.error('Beds24 실시간 동기화 오류:', e);
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        reloadAll();
        const savedMode = localStorage.getItem('beds24_view_mode');
        if (savedMode === 'horizontal' || savedMode === 'vertical') {
            setViewMode(savedMode);
        }
        const savedZoom = localStorage.getItem('beds24_timeline_zoom');
        if (savedZoom) {
            const z = parseFloat(savedZoom);
            if (!isNaN(z) && z >= 0.4 && z <= 2.0) {
                setZoomLevel(z);
            }
        }
    }, []);

    const toggleViewMode = (mode: 'vertical' | 'horizontal') => {
        setViewMode(mode);
        localStorage.setItem('beds24_view_mode', mode);
    };

    const updateZoomLevel = (newZoom: number) => {
        const clamped = Math.min(Math.max(Number(newZoom.toFixed(2)), 0.4), 2.0);
        setZoomLevel(clamped);
        localStorage.setItem('beds24_timeline_zoom', String(clamped));
    };

    const changeZoom = (delta: number) => {
        updateZoomLevel(zoomLevel + delta);
    };

    const resetZoom = () => {
        updateZoomLevel(1.0);
    };

    // 🕒 한국 시간(KST) 기준 오늘 / 내일 날짜 (자정 자동 갱신을 위해 상태로 관리)
    const [todayStr, setTodayStr] = useState<string>(() => getKSTTodayStr());
    const [tomorrowStr, setTomorrowStr] = useState<string>(() => getKSTTomorrowStr());

    // ⏰ 자정(00:00:01) 감지 타이머 & 탭 활성화 시 자동 날짜 갱신
    useEffect(() => {
        let timerId: NodeJS.Timeout;

        const scheduleMidnightCheck = () => {
            const msUntilMidnight = getMsUntilNextMidnightKST();
            timerId = setTimeout(() => {
                // 자정 도달 시 새로운 날짜로 갱신
                const newToday = getKSTTodayStr();
                const newTomorrow = getKSTTomorrowStr();
                setTodayStr(newToday);
                setTomorrowStr(newTomorrow);
                setStartDate(getKSTDateOffset(-2));
                reloadAll();

                // 다음 자정 예약
                scheduleMidnightCheck();
            }, msUntilMidnight);
        };

        scheduleMidnightCheck();

        // 📱 브라우저 탭 복귀 / 절전 모드 해제 시 날짜 변경 감지
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const currentToday = getKSTTodayStr();
                if (currentToday !== todayStr) {
                    setTodayStr(currentToday);
                    setTomorrowStr(getKSTTomorrowStr());
                    setStartDate(getKSTDateOffset(-2));
                    reloadAll();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimeout(timerId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [todayStr]);

    // 🛡️ 유효한 예약만 입/퇴실 목록에 포함 (inquiry, cancelled 등 제외)
    const activeBookings = bookings.filter((b) => isValidBooking(b));
    const todayCheckIns = activeBookings.filter((b) => b.arrival === todayStr);
    const todayCheckOuts = activeBookings.filter((b) => b.departure === todayStr);
    const tomorrowCheckIns = activeBookings.filter((b) => b.arrival === tomorrowStr);
    const tomorrowCheckOuts = activeBookings.filter((b) => b.departure === tomorrowStr);

    // ⚠️ 미배정 예약 목록 추출 (unitId가 지정되지 않은 예약)
    const unallocatedBookings = activeBookings.filter((b) => isUnallocatedBooking(b));

    // 14일 날짜 배열 생성 (한국 시간 기준 정확한 포맷팅)
    const timelineDates: string[] = [];
    for (let i = 0; i < displayDaysCount; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        timelineDates.push(formatKSTDate(d));
    }

    const moveDays = (days: number) => {
        const next = new Date(startDate);
        next.setDate(next.getDate() + days);
        setStartDate(next);
    };

    const goToday = () => {
        setStartDate(getKSTDateOffset(-2));
    };

    const handleDateClick = (dStr: string) => {
        setSelectedDate((prev) => (prev === dStr ? null : dStr));
    };

    const handleBookingClick = (e?: React.MouseEvent, booking?: Booking) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        if (booking) {
            openBookingDetail(booking);
        }
    };

    const openBookingDetail = (booking: Booking) => {
        setActiveBooking(booking);
        const data = bookingNotes[booking.id] || { note: '', tags: [] };
        setMemoInput(data.note || '');
        setSelectedTags(data.tags || []);
    };

    const handleToggleTag = (tag: string) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    };

    const handleSaveMemo = async (bookingId?: number | any) => {
        const targetId = typeof bookingId === 'number' ? bookingId : activeBooking?.id;
        if (!targetId || typeof targetId !== 'number') return;

        try {
            const res = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: Number(targetId),
                    note: memoInput,
                    tags: selectedTags,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setBookingNotes((prev) => ({
                    ...prev,
                    [targetId]: { note: memoInput, tags: selectedTags },
                }));
                setActiveBooking(null);
            }
        } catch (e) {
            console.error('메모 저장 실패:', e);
        }
    };

    const handleDeleteMemo = async (bookingId?: number | any) => {
        const targetId = typeof bookingId === 'number' ? bookingId : activeBooking?.id;
        if (!targetId || typeof targetId !== 'number') return;

        try {
            const res = await fetch(`/api/notes?bookingId=${Number(targetId)}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setBookingNotes((prev) => {
                    const next = { ...prev };
                    delete next[targetId];
                    return next;
                });
                setMemoInput('');
                setSelectedTags([]);
                setActiveBooking(null);
            }
        } catch (e) {
            console.error('메모 삭제 실패:', e);
        }
    };

    // 🏠 호실 배정 변경 (Beds24 API + Supabase DB + 로컬 상태 즉시 동기화)
    const handleAssignUnit = async (bookingId: number, roomId: number, unitId: number): Promise<{ success: boolean; error?: string }> => {
        try {
            const res = await fetch('/api/bookings/assign-unit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId, roomId, unitId }),
            });
            const result = await res.json();

            if (result.success) {
                // 로컬 예약 목록 상태 즉시 업데이트
                setBookings((prev) =>
                    prev.map((b) => (b.id === bookingId ? { ...b, roomId, unitId } : b))
                );
                // 모달 내 activeBooking도 업데이트
                if (activeBooking && activeBooking.id === bookingId) {
                    setActiveBooking((prev) => (prev ? { ...prev, roomId, unitId } : null));
                }
                return { success: true };
            } else {
                return { success: false, error: result.error || '호실 배정 실패' };
            }
        } catch (err: any) {
            console.error('호실 배정 API 호출 에러:', err);
            return { success: false, error: err.message || '네트워크 오류가 발생했습니다.' };
        }
    };

    return {
        bookings,
        loading,
        isSyncing,
        error,
        selectedDate,
        setSelectedDate,
        viewMode,
        toggleViewMode,
        activeBooking,
        setActiveBooking,
        memoInput,
        setMemoInput,
        selectedTags,
        bookingNotes,
        dailyModalType,
        setDailyModalType,
        isTotalNotesOpen,
        setIsTotalNotesOpen,
        isSearchOpen,
        setIsSearchOpen,
        isUnallocatedModalOpen,
        setIsUnallocatedModalOpen,
        displayDaysCount,
        todayStr,
        tomorrowStr,
        todayCheckIns,
        todayCheckOuts,
        tomorrowCheckIns,
        tomorrowCheckOuts,
        unallocatedBookings,
        timelineDates,
        moveDays,
        goToday,
        reloadAll,
        syncWithBeds24,
        zoomLevel,
        updateZoomLevel,
        changeZoom,
        resetZoom,
        handleDateClick,
        handleBookingClick,
        openBookingDetail,
        handleToggleTag,
        handleSaveMemo,
        handleDeleteMemo,
        handleAssignUnit,
    };
}