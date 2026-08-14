'use client';

import { useEffect, useState } from 'react';
import './dashboard.css';
import { Booking } from './types';
import BookingModal from './components/BookingModal';
import TotalNotesModal from './components/TotalNotesModal';
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

  // 예약 카드 클릭 시 모달 열기
  const handleBookingClick = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    setActiveBooking(booking);
    const existing = bookingNotes[booking.id];
    setMemoInput(existing ? existing.note : '');
    setSelectedTags(existing ? existing.tags || [] : []);
  };

  // 태그 토글 핸들러
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

  // 모아보기 호환용 맵
  const plainMemosMap: { [bookingId: number]: string } = {};
  Object.keys(bookingNotes).forEach((idStr) => {
    const id = Number(idStr);
    plainMemosMap[id] = bookingNotes[id]?.note || '';
  });

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">

        {/* 상단 헤더 카드 */}
        <div className="dashboard-header-card">
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

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              <div className="stat-badge-mini stat-badge-blue">
                <span>오늘 입실</span>
                <span className="text-sm font-extrabold">{todayCheckIns.length}</span>
              </div>
              <div className="stat-badge-mini stat-badge-orange">
                <span>오늘 퇴실</span>
                <span className="text-sm font-extrabold">{todayCheckOuts.length}</span>
              </div>
              <div className="stat-badge-mini stat-badge-sky">
                <span>내일 입실</span>
                <span className="text-sm font-extrabold">{tomorrowCheckIns.length}</span>
              </div>
              <div className="stat-badge-mini stat-badge-amber">
                <span>내일 퇴실</span>
                <span className="text-sm font-extrabold">{tomorrowCheckOuts.length}</span>
              </div>
            </div>

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

              <div className="flex items-center gap-1.5 ml-1">
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm transition flex items-center gap-1"
                >
                  🔍 검색
                </button>

                <button
                  onClick={() => setIsTotalNotesOpen(true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-md shadow-sm transition flex items-center gap-1"
                >
                  🔥 특이사항
                </button>
              </div>
            </div>

            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => moveDays(-7)} className="btn-secondary">◀ 지난주</button>
              <button onClick={goToday} className="btn-secondary btn-secondary-blue">오늘 기준</button>
              <button onClick={() => moveDays(7)} className="btn-secondary">다음주 ▶</button>
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

      {/* 모달 1: 개별 예약 상세 및 체크박스/메모 모달 */}
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

      {/* 모달 2: 총 특이사항 모아보기 모달 */}
      {isTotalNotesOpen && (
        <TotalNotesModal
          bookings={bookings}
          bookingMemos={plainMemosMap}
          onClose={() => setIsTotalNotesOpen(false)}
          onSelectBooking={(booking) => {
            setActiveBooking(booking);
            const existing = bookingNotes[booking.id];
            setMemoInput(existing ? existing.note : '');
            setSelectedTags(existing ? existing.tags || [] : []);
          }}
        />
      )}

      {/* 모달 3: 통합 검색 모달 */}
      {isSearchOpen && (
        <SearchModal
          bookings={bookings}
          onClose={() => setIsSearchOpen(false)}
          onSelectBooking={(booking) => {
            setActiveBooking(booking);
            const existing = bookingNotes[booking.id];
            setMemoInput(existing ? existing.note : '');
            setSelectedTags(existing ? existing.tags || [] : []);
          }}
        />
      )}
    </div>
  );
}