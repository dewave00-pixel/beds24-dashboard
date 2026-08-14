'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import './dashboard.css';
import { Booking } from './types';
import BookingModal from './components/BookingModal';
import TotalNotesModal from './components/TotalNotesModal';
import DailyStatusModal from './components/DailyStatusModal';
import SearchModal from './components/SearchModal';
import VerticalTimeline from './components/VerticalTimeline';
import HorizontalTimeline from './components/HorizontalTimeline';

const ROW_HEIGHT = 65;
const COL_WIDTH_HORIZ = 110;

export interface BookingNoteData {
  note: string;
  tags: string[];
}

export default function Dashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'vertical' | 'horizontal'>('vertical');

  // 모달 및 메모/태그 상태 관리
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [memoInput, setMemoInput] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [bookingNotes, setBookingNotes] = useState<{ [bookingId: number]: BookingNoteData }>({});

  // 팝업 모달 상태들
  const [dailyModalType, setDailyModalType] = useState<'today' | 'tomorrow' | null>(null);
  const [isTotalNotesOpen, setIsTotalNotesOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d;
  });

  const displayDaysCount = 14;

  // 1. Supabase 중앙 DB에서 메모 및 태그 목록 불러오기
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

  // 통합 새로고침
  const reloadAll = async () => {
    await Promise.all([fetchReservations(), fetchNotes()]);
  };

  useEffect(() => {
    reloadAll();

    const savedMode = localStorage.getItem('beds24_view_mode');
    if (savedMode === 'horizontal' || savedMode === 'vertical') {
      setViewMode(savedMode);
    }
  }, []);

  const toggleViewMode = (mode: 'vertical' | 'horizontal') => {
    setViewMode(mode);
    localStorage.setItem('beds24_view_mode', mode);
  };

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const todayCheckIns = bookings.filter((b) => b.arrival === todayStr);
  const todayCheckOuts = bookings.filter((b) => b.departure === todayStr);
  const tomorrowCheckIns = bookings.filter((b) => b.arrival === tomorrowStr);
  const tomorrowCheckOuts = bookings.filter((b) => b.departure === tomorrowStr);

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
    if (selectedDate === dStr) {
      setSelectedDate(null);
    } else {
      setSelectedDate(dStr);
    }
  };

  // 예약 카드 클릭 시 상세 모달 열기
  const handleBookingClick = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    openBookingDetail(booking);
  };

  const openBookingDetail = (booking: Booking) => {
    setActiveBooking(booking);
    const existing = bookingNotes[booking.id];
    setMemoInput(existing ? existing.note : '');
    setSelectedTags(existing ? existing.tags || [] : []);
  };

  // 태그 토글
  const handleToggleTag = (tagKey: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagKey) ? prev.filter((k) => k !== tagKey) : [...prev, tagKey]
    );
  };

  // 메모 및 태그 저장
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

  // 메모 및 태그 삭제
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

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">

        {/* 상단 헤더 카드 */}
        <div className="dashboard-header-card">
          <div className="flex flex-wrap items-center justify-between gap-2">

            {/* 좌측: 타이틀 + 채널 색상 안내 */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base md:text-lg font-extrabold text-gray-900 shrink-0">숙소 예약 현황</h1>

              <div className="text-[10px] text-gray-500 flex flex-wrap items-center gap-1">
                <span className="px-1 py-0.5 rounded text-white font-bold" style={{ backgroundColor: 'rgb(255,17,0)' }}>Airbnb</span>
                <span className="px-1 py-0.5 rounded text-black font-bold" style={{ backgroundColor: 'rgb(255,243,13)' }}>Trip.com</span>
                <span className="px-1 py-0.5 rounded text-white font-bold" style={{ backgroundColor: 'rgb(0,42,255)' }}>Booking.com</span>
                <span className="px-1 py-0.5 rounded text-black font-bold" style={{ backgroundColor: 'rgb(0,255,225)' }}>Agoda</span>
                <span className="px-1 py-0.5 rounded text-black font-bold" style={{ backgroundColor: 'rgb(0,255,26)' }}>Expedia</span>
              </div>
            </div>

            {/* 📌 우측 상단: [📊 대시보드] <-> [🔑 숙소/비번 관리] 네비게이션 탭 */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg border border-gray-300">
              <div className="px-3 py-1.5 rounded-md text-xs font-black bg-white text-blue-600 shadow-sm flex items-center gap-1">
                <span>📊</span> 대시보드
              </div>
              <Link
                href="/properties"
                className="px-3 py-1.5 rounded-md text-xs font-black text-gray-600 hover:text-gray-900 transition flex items-center gap-1"
              >
                <span>🔑</span> 숙소/비번 관리
              </Link>
            </div>

          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-200">

            {/* 오늘 현황 / 내일 현황 버튼 */}
            <div className="flex items-center gap-1.5 py-0.5">

              {/* 오늘 현황 */}
              <button
                type="button"
                onClick={() => setDailyModalType('today')}
                className="px-2.5 py-1 rounded-lg border border-blue-300 bg-blue-50/90 hover:bg-blue-100 transition shadow-sm flex flex-col text-left cursor-pointer"
              >
                <div className="text-[10px] font-black text-blue-900 flex items-center gap-1">
                  <span>📅</span> 오늘 현황
                </div>
                <div className="text-[11px] font-extrabold text-gray-800 flex items-center gap-1.5">
                  <span className="text-blue-700">입 <strong className="text-xs">{todayCheckIns.length}</strong></span>
                  <span className="text-gray-300">|</span>
                  <span className="text-orange-700">퇴 <strong className="text-xs">{todayCheckOuts.length}</strong></span>
                </div>
              </button>

              {/* 내일 현황 */}
              <button
                type="button"
                onClick={() => setDailyModalType('tomorrow')}
                className="px-2.5 py-1 rounded-lg border border-indigo-300 bg-indigo-50/90 hover:bg-indigo-100 transition shadow-sm flex flex-col text-left cursor-pointer"
              >
                <div className="text-[10px] font-black text-indigo-900 flex items-center gap-1">
                  <span>📅</span> 내일 현황
                </div>
                <div className="text-[11px] font-extrabold text-gray-800 flex items-center gap-1.5">
                  <span className="text-blue-700">입 <strong className="text-xs">{tomorrowCheckIns.length}</strong></span>
                  <span className="text-gray-300">|</span>
                  <span className="text-orange-700">퇴 <strong className="text-xs">{tomorrowCheckOuts.length}</strong></span>
                </div>
              </button>

            </div>

            {/* 세로/가로 토글 및 새로고침 */}
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="bg-gray-100 p-0.5 rounded-md border border-gray-300 flex gap-0.5">
                <button
                  onClick={() => toggleViewMode('vertical')}
                  className={`px-2 py-1 text-xs font-extrabold rounded transition ${viewMode === 'vertical'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                  📱 세로
                </button>
                <button
                  onClick={() => toggleViewMode('horizontal')}
                  className={`px-2 py-1 text-xs font-extrabold rounded transition ${viewMode === 'horizontal'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                  🖥️ 가로
                </button>
              </div>

              <button onClick={reloadAll} disabled={loading} className="btn-primary">
                {loading ? '...' : '새로고침'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            🚨 {error}
          </div>
        )}

        {/* 대시보드 메인 패널 */}
        <div className="dashboard-panel">

          <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-gray-200">

            {/* 좌측: 날짜 범위 + 🔍 검색 버튼 */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <div className="text-xs md:text-sm font-bold text-gray-700 flex items-center gap-1">
                <span>📅 조회:</span>
                <span className="text-blue-600 font-extrabold">{timelineDates[0]}</span>
                <span>~</span>
                <span className="text-blue-600 font-extrabold">{timelineDates[timelineDates.length - 1]}</span>
              </div>

              {selectedDate && (
                <button onClick={() => setSelectedDate(null)} className="btn-reset-highlight">
                  🔍 {selectedDate} 강조 해제 ✖
                </button>
              )}

              <button
                onClick={() => setIsSearchOpen(true)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm transition flex items-center gap-1"
              >
                🔍 검색
              </button>
            </div>

            {/* 우측: 주간 이동 + 🔥 특이사항 모아보기 버튼 */}
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <div className="flex gap-1">
                <button onClick={() => moveDays(-7)} className="btn-secondary">◀ 지난주</button>
                <button onClick={goToday} className="btn-secondary btn-secondary-blue">오늘 기준</button>
                <button onClick={() => moveDays(7)} className="btn-secondary">다음주 ▶</button>
              </div>

              <button
                onClick={() => setIsTotalNotesOpen(true)}
                className="btn-highlight-notes"
                title="전체 특이사항 및 빠른 태그 모아보기"
              >
                <span>🔥</span>
                <span>특이사항 모아보기</span>
              </button>
            </div>

          </div>

          {viewMode === 'vertical' ? (
            <VerticalTimeline
              timelineDates={timelineDates}
              todayStr={todayStr}
              selectedDate={selectedDate}
              bookings={bookings}
              bookingNotes={bookingNotes}
              ROW_HEIGHT={ROW_HEIGHT}
              displayDaysCount={displayDaysCount}
              onDateClick={handleDateClick}
              onBookingClick={handleBookingClick}
            />
          ) : (
            <HorizontalTimeline
              timelineDates={timelineDates}
              todayStr={todayStr}
              selectedDate={selectedDate}
              bookings={bookings}
              bookingNotes={bookingNotes}
              COL_WIDTH={COL_WIDTH_HORIZ}
              ROW_HEIGHT={ROW_HEIGHT}
              onDateClick={handleDateClick}
              onBookingClick={handleBookingClick}
            />
          )}
        </div>

      </div>

      {/* 모달 1: 개별 예약 상세 모달 */}
      {activeBooking && (
        <BookingModal
          booking={activeBooking}
          memoInput={memoInput}
          setMemoInput={setMemoInput}
          selectedTags={selectedTags}
          onToggleTag={handleToggleTag}
          onSave={handleSaveMemo}
          onDelete={handleDeleteMemo}
          onClose={() => setActiveBooking(null)}
        />
      )}

      {/* 모달 2: 일일 입/퇴실 현황 통합 모달 */}
      {dailyModalType && (
        <DailyStatusModal
          title={dailyModalType === 'today' ? '오늘 입/퇴실 현황' : '내일 입/퇴실 현황'}
          dateStr={dailyModalType === 'today' ? todayStr : tomorrowStr}
          checkInBookings={dailyModalType === 'today' ? todayCheckIns : tomorrowCheckIns}
          checkOutBookings={dailyModalType === 'today' ? todayCheckOuts : tomorrowCheckOuts}
          bookingNotes={bookingNotes}
          onClose={() => setDailyModalType(null)}
          onSelectBooking={(booking) => {
            setDailyModalType(null);
            openBookingDetail(booking);
          }}
        />
      )}

      {/* 모달 3: 총 특이사항 모아보기 모달 */}
      {isTotalNotesOpen && (
        <TotalNotesModal
          bookings={bookings}
          bookingNotes={bookingNotes}
          onClose={() => setIsTotalNotesOpen(false)}
          onSelectBooking={(booking) => {
            setIsTotalNotesOpen(false);
            openBookingDetail(booking);
          }}
        />
      )}

      {/* 모달 4: 통합 검색 모달 */}
      {isSearchOpen && (
        <SearchModal
          bookings={bookings}
          onClose={() => setIsSearchOpen(false)}
          onSelectBooking={(booking) => {
            setIsSearchOpen(false);
            openBookingDetail(booking);
          }}
        />
      )}
    </div>
  );
}