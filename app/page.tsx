'use client';

import { useEffect, useState } from 'react';
import './dashboard.css';
import { Booking } from './types';
import { PROPERTY_GROUPS, ALL_UNITS, getChannelStyle } from './config';
import BookingModal from './components/BookingModal';
import TotalNotesModal from './components/TotalNotesModal';
import SearchModal from './components/SearchModal';

const ROW_HEIGHT = 65;

export default function Dashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 모달 상태 관리
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [memoInput, setMemoInput] = useState<string>('');
  const [bookingMemos, setBookingMemos] = useState<{ [bookingId: number]: string }>({});

  const [isTotalNotesOpen, setIsTotalNotesOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d;
  });

  const displayDaysCount = 14;

  useEffect(() => {
    const savedMemos = localStorage.getItem('beds24_booking_memos');
    if (savedMemos) {
      try {
        setBookingMemos(JSON.parse(savedMemos));
      } catch (e) {
        console.error('메모 불러오기 실패:', e);
      }
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reservations');
      const data = await res.json();

      if (data.success) {
        setBookings(Array.isArray(data.data) ? data.data : []);
      } else {
        setError(data.error || '데이터를 불러오지 못했습니다.');
      }
    } catch (err) {
      setError('서버 통신 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleBookingClick = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    setActiveBooking(booking);
    setMemoInput(bookingMemos[booking.id] || '');
  };

  const handleSaveMemo = () => {
    if (!activeBooking) return;
    const updatedMemos = { ...bookingMemos, [activeBooking.id]: memoInput };
    setBookingMemos(updatedMemos);
    localStorage.setItem('beds24_booking_memos', JSON.stringify(updatedMemos));
    setActiveBooking(null);
  };

  const handleDeleteMemo = () => {
    if (!activeBooking) return;
    const updatedMemos = { ...bookingMemos };
    delete updatedMemos[activeBooking.id];
    setBookingMemos(updatedMemos);
    localStorage.setItem('beds24_booking_memos', JSON.stringify(updatedMemos));
    setActiveBooking(null);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">

        {/* 상단 헤더 */}
        <div className="dashboard-header-card">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">숙소 예약 현황 대시보드</h1>
            <p className="text-sm text-gray-500 mt-1">플랫폼 범례:
              <span className="ml-2 px-2 py-0.5 rounded text-xs text-white font-bold" style={{ backgroundColor: 'rgb(255,17,0)' }}>Airbnb</span>
              <span className="ml-1 px-2 py-0.5 rounded text-xs text-black font-bold" style={{ backgroundColor: 'rgb(255,243,13)' }}>Trip.com</span>
              <span className="ml-1 px-2 py-0.5 rounded text-xs text-white font-bold" style={{ backgroundColor: 'rgb(0,42,255)' }}>Booking.com</span>
              <span className="ml-1 px-2 py-0.5 rounded text-xs text-black font-bold" style={{ backgroundColor: 'rgb(0,255,225)' }}>Agoda</span>
              <span className="ml-1 px-2 py-0.5 rounded text-xs text-black font-bold" style={{ backgroundColor: 'rgb(0,255,26)' }}>Expedia</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="stat-badge stat-badge-blue">
              <span className="stat-badge-title-blue">오늘 체크인</span>
              <span className="stat-badge-value-blue">{todayCheckIns.length}건</span>
            </div>
            <div className="stat-badge stat-badge-orange">
              <span className="stat-badge-title-orange">오늘 체크아웃</span>
              <span className="stat-badge-value-orange">{todayCheckOuts.length}건</span>
            </div>

            <div className="stat-badge bg-sky-50 border border-sky-100">
              <span className="text-xs text-sky-600 font-semibold block">내일 체크인</span>
              <span className="text-lg font-bold text-sky-700">{tomorrowCheckIns.length}건</span>
            </div>
            <div className="stat-badge bg-amber-50 border border-amber-100">
              <span className="text-xs text-amber-600 font-semibold block">내일 체크아웃</span>
              <span className="text-lg font-bold text-amber-700">{tomorrowCheckOuts.length}건</span>
            </div>

            {/* 🔍 통합 검색 버튼 */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow transition flex items-center gap-1 ml-1"
            >
              🔍 예약 검색
            </button>

            {/* 🔥 총 특이사항 모아보기 버튼 */}
            <button
              onClick={() => setIsTotalNotesOpen(true)}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg shadow transition flex items-center gap-1"
            >
              🔥 총 특이사항 모아보기
            </button>

            <button onClick={fetchData} disabled={loading} className="btn-primary">
              {loading ? '갱신 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            🚨 {error}
          </div>
        )}

        {/* 대시보드 메인 패널 */}
        <div className="dashboard-panel">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="text-sm font-bold text-gray-700">
                📅 조회 기간: <span className="text-blue-600">{timelineDates[0]}</span> ~ <span className="text-blue-600">{timelineDates[timelineDates.length - 1]}</span>
              </div>
              {selectedDate && (
                <button onClick={() => setSelectedDate(null)} className="btn-reset-highlight">
                  🔍 {selectedDate} 강조 해제 ✖
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => moveDays(-7)} className="btn-secondary">◀ 지난주</button>
              <button onClick={goToday} className="btn-secondary btn-secondary-blue">오늘 기준</button>
              <button onClick={() => moveDays(7)} className="btn-secondary">다음주 ▶</button>
            </div>
          </div>

          <div className="grid-table-container">
            <div className="min-w-max">

              {/* 1단: 숙소 그룹 헤더 */}
              <div
                className="grid-row-header-1 divide-x divide-gray-300"
                style={{ gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))` }}
              >
                <div className="cell-corner">숙소명</div>
                {PROPERTY_GROUPS.map((group) => (
                  <div
                    key={group.name}
                    className={`p-2 flex items-center justify-center font-extrabold text-sm ${group.themeClass}`}
                    style={{ gridColumn: `span ${group.units.length}` }}
                  >
                    {group.name}
                  </div>
                ))}
              </div>

              {/* 2단: 세부 호실 헤더 */}
              <div
                className="grid-row-header-2 divide-x divide-gray-300"
                style={{ gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))` }}
              >
                <div className="p-2 flex items-center justify-center bg-gray-200 text-gray-600">날짜 / 호실</div>
                {ALL_UNITS.map((col) => (
                  <div key={col.key} className="p-2 flex flex-col justify-center min-h-[45px]">
                    {col.subName && <span className="text-[10px] text-gray-400 font-normal">{col.subName}</span>}
                    <span className="text-sm text-gray-900 font-bold">{col.displayName}</span>
                  </div>
                ))}
              </div>

              {/* Y축 타임라인 레이어 */}
              <div className="relative w-full">
                {/* 1. 배경 날짜 셀 */}
                {timelineDates.map((dStr) => {
                  const dObj = new Date(dStr);
                  const month = dObj.getMonth() + 1;
                  const dayNum = dObj.getDate();
                  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dObj.getDay()];
                  const isToday = dStr === todayStr;
                  const isSelected = selectedDate === dStr;
                  const isOtherSelected = selectedDate !== null && !isSelected;

                  return (
                    <div
                      key={dStr}
                      onClick={() => handleDateClick(dStr)}
                      className={`grid divide-x divide-gray-300 border-b border-gray-300 transition-all duration-200 cursor-pointer ${isSelected
                          ? 'row-selected'
                          : isOtherSelected
                            ? 'row-dimmed'
                            : 'bg-white hover:bg-gray-50/80'
                        }`}
                      style={{
                        gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))`,
                        height: `${ROW_HEIGHT}px`
                      }}
                    >
                      <div className={`p-2 flex flex-col items-center justify-center font-bold text-xs transition-colors ${isSelected
                          ? 'bg-amber-500 text-white font-extrabold'
                          : isToday
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-50 text-gray-700'
                        }`}>
                        <div>{month}/{dayNum}</div>
                        <div className="text-[10px] opacity-80">({dayOfWeek})</div>
                      </div>

                      {ALL_UNITS.map((col) => (
                        <div key={`${dStr}-${col.key}`} className={`h-full ${isToday && !isSelected ? 'bg-blue-50/20' : ''}`} />
                      ))}
                    </div>
                  );
                })}

                {/* 2. 예약 박스 레이어 */}
                <div
                  className="absolute top-0 left-0 w-full h-full pointer-events-none grid z-10"
                  style={{ gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))` }}
                >
                  <div />

                  {ALL_UNITS.map((col) => {
                    const unitBookings = bookings.filter((b) => {
                      const isRoomMatch = Number(b.roomId) === col.roomId;
                      const isUnitMatch = col.unitId ? Number(b.unitId) === col.unitId : true;
                      return isRoomMatch && isUnitMatch;
                    });

                    return (
                      <div key={`overlay-${col.key}`} className="relative w-full h-full">
                        {unitBookings.map((b) => {
                          const startIndex = timelineDates.indexOf(b.arrival);
                          const depDateObj = new Date(b.departure);
                          depDateObj.setDate(depDateObj.getDate() - 1);
                          const lastNightStr = depDateObj.toISOString().split('T')[0];
                          const lastNightIndex = timelineDates.indexOf(lastNightStr);

                          if (startIndex === -1 && lastNightIndex === -1) return null;

                          const startRow = startIndex === -1 ? 0 : startIndex;
                          const endRow = lastNightIndex === -1 ? displayDaysCount - 1 : lastNightIndex;
                          const nightsCount = Math.max(1, endRow - startRow + 1);

                          const topPos = startRow * ROW_HEIGHT + 3;
                          const barHeight = nightsCount * ROW_HEIGHT - 6;

                          const ch = getChannelStyle(b.apiSourceId);
                          const guestName = b.firstName || b.lastName ? `${b.firstName || ''} ${b.lastName || ''}`.trim() : `예약 #${b.id}`;

                          const isBookingInSelectedDate = selectedDate !== null && selectedDate >= b.arrival && selectedDate <= lastNightStr;
                          const isBookingDimmed = selectedDate !== null && !isBookingInSelectedDate;
                          const hasMemo = Boolean(bookingMemos[b.id]);

                          return (
                            <div
                              key={b.id}
                              onClick={(e) => handleBookingClick(e, b)}
                              className={`absolute left-1 right-1 rounded-lg shadow-md p-1.5 flex flex-col justify-between font-bold text-xs pointer-events-auto transition-all duration-200 hover:brightness-105 hover:z-30 cursor-pointer border border-black/10 ${isBookingDimmed ? 'booking-card-dimmed' : 'opacity-100'
                                } ${hasMemo ? 'animate-pulse-memo' : ''}`}
                              style={{
                                top: `${topPos}px`,
                                height: `${barHeight}px`,
                                backgroundColor: ch.bg,
                                color: ch.text,
                              }}
                              title={`${ch.name} | ${guestName} (${b.arrival} 체크인 ~ ${b.departure} 체크아웃, ${nightsCount}박)`}
                            >
                              <div className="flex flex-col gap-0.5 leading-tight">
                                <div className="text-[11px] font-extrabold truncate">
                                  📥 {guestName}
                                </div>
                                <div className="text-[9px] opacity-85 font-medium truncate">
                                  {ch.name}
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] font-extrabold mt-auto pt-0.5">
                                <div>
                                  {hasMemo && (
                                    <span className="text-[9px] font-extrabold text-amber-900 bg-amber-300/90 px-1 py-0.5 rounded shadow-sm">
                                      특이사항🔥
                                    </span>
                                  )}
                                </div>
                                <span>{nightsCount}박</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* 3. 최상단 셀 격자선 레이어 */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
                  {timelineDates.map((dStr) => (
                    <div
                      key={`grid-line-${dStr}`}
                      className="grid divide-x divide-gray-300/60 border-b border-gray-300/60"
                      style={{
                        gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))`,
                        height: `${ROW_HEIGHT}px`
                      }}
                    >
                      <div />
                      {ALL_UNITS.map((col) => (
                        <div key={`grid-cell-${dStr}-${col.key}`} className="h-full" />
                      ))}
                    </div>
                  ))}
                </div>

              </div>

            </div>
          </div>
        </div>

      </div>

      {/* 모달 1: 개별 예약 상세 및 메모 수정 모달 */}
      {activeBooking && (
        <BookingModal
          booking={activeBooking}
          memoInput={memoInput}
          setMemoInput={setMemoInput}
          onSave={handleSaveMemo}
          onDelete={handleDeleteMemo}
          onClose={() => setActiveBooking(null)}
        />
      )}

      {/* 모달 2: 총 특이사항 모아보기 모달 */}
      {isTotalNotesOpen && (
        <TotalNotesModal
          bookings={bookings}
          bookingMemos={bookingMemos}
          onClose={() => setIsTotalNotesOpen(false)}
          onSelectBooking={(booking) => {
            setActiveBooking(booking);
            setMemoInput(bookingMemos[booking.id] || '');
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
            setMemoInput(bookingMemos[booking.id] || '');
          }}
        />
      )}
    </div>
  );
}