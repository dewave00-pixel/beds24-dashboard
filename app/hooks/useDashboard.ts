'use client';

import { useState, useEffect } from 'react';
import { Booking } from '../types';

export interface BookingNoteData {
    note: string;
    tags: string[];
}

export function useDashboard() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'vertical' | 'horizontal'>('vertical');
    const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 0.5 ~ 1.5

    // 모달 및 메모/태그 상태
    const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
    const [memoInput, setMemoInput] = useState<string>('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [bookingNotes, setBookingNotes] = useState<{ [bookingId: number]: BookingNoteData }>({});

    // 팝업 모달 상태
    const [dailyModalType, setDailyModalType] = useState<'today' | 'tomorrow' | null>(null);
    const [isTotalNotesOpen, setIsTotalNotesOpen] = useState<boolean>(false);
    const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

    // 날짜 계산 기준 (기본값: 오늘 기준 이틀 전부터)
    const [startDate, setStartDate] = useState<Date>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 2);
        return d;
    });

    const displayDaysCount = 14;

    // 1. Supabase 메모/태그 불러오기
    const fetchNotes = async () => {
        try {
            const res = await fetch('/api/notes');
            const data = await res.json();
            if (data.success && data.data) {
                setBookingNotes(data.data);
            }
        } catch (e) {
            console.error('메모/태그 불러오기 실패:', e);
        }
    };

    // 2. Beds24 실시간 예약 데이터 불러오기
    const fetchReservations = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/reservations');
            const data = await res.json();

            if (data.success) {
                setBookings(Array.isArray(data.data) ? data.data : []);
            } else {
                setError(data.error || '예약 데이터를 불러오지 못했습니다.');
            }
        } catch (err) {
            setError('서버 통신 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const reloadAll = async () => {
        await Promise.all([fetchReservations(), fetchNotes()]);
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

    // 오늘 / 내일 날짜 계산
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const todayCheckIns = bookings.filter((b) => b.arrival === todayStr);
    const todayCheckOuts = bookings.filter((b) => b.departure === todayStr);
    const tomorrowCheckIns = bookings.filter((b) => b.arrival === tomorrowStr);
    const tomorrowCheckOuts = bookings.filter((b) => b.departure === tomorrowStr);

    // 14일 날짜 배열 생성
    const timelineDates: string[] = [];
    for (let i = 0; i < displayDaysCount; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        timelineDates.push(d.toISOString().split('T')[0]);
    }

    const moveDays = (days: number) => {
        const next = new Date(startDate);
        next.setDate(next.getDate() + days);
        setStartDate(next);
    };

    const goToday = () => {
        const d = new Date();
        d.setDate(d.getDate() - 2);
        setStartDate(d);
    };

    const handleDateClick = (dStr: string) => {
        setSelectedDate((prev) => (prev === dStr ? null : dStr));
    };

    const openBookingDetail = (booking: Booking) => {
        setActiveBooking(booking);
        const existing = bookingNotes[booking.id];
        setMemoInput(existing ? existing.note : '');
        setSelectedTags(existing ? existing.tags || [] : []);
    };

    const handleBookingClick = (e: React.MouseEvent, booking: Booking) => {
        e.stopPropagation();
        openBookingDetail(booking);
    };

    const handleToggleTag = (tagKey: string) => {
        setSelectedTags((prev) =>
            prev.includes(tagKey) ? prev.filter((k) => k !== tagKey) : [...prev, tagKey]
        );
    };

    // 메모 & 태그 저장
    const handleSaveMemo = async () => {
        if (!activeBooking) return;
        try {
            const res = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: activeBooking.id,
                    note: memoInput,
                    tags: selectedTags,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setBookingNotes((prev) => ({
                    ...prev,
                    [activeBooking.id]: { note: memoInput, tags: selectedTags },
                }));
            }
        } catch (e) {
            console.error('메모/태그 저장 실패:', e);
        }
        setActiveBooking(null);
    };

    // 메모 & 태그 삭제
    const handleDeleteMemo = async () => {
        if (!activeBooking) return;
        try {
            const res = await fetch(`/api/notes?bookingId=${activeBooking.id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setBookingNotes((prev) => {
                    const updated = { ...prev };
                    delete updated[activeBooking.id];
                    return updated;
                });
            }
        } catch (e) {
            console.error('메모/태그 삭제 실패:', e);
        }
        setActiveBooking(null);
    };

    return {
        bookings,
        loading,
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
        displayDaysCount,
        todayStr,
        tomorrowStr,
        todayCheckIns,
        todayCheckOuts,
        tomorrowCheckIns,
        tomorrowCheckOuts,
        timelineDates,
        moveDays,
        goToday,
        reloadAll,
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
    };
}