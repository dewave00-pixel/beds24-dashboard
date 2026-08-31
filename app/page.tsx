'use client';

import React, { useState } from 'react';
import './dashboard.css';
import { useDashboard } from './hooks/useDashboard';
import { useAuth } from './hooks/useAuth';
import AppSidebar from './components/layout/AppSidebar';
import DashboardHeader from './components/dashboard/DashboardHeader';
import DashboardToolbar from './components/dashboard/DashboardToolbar';
import VerticalTimeline from './components/timeline/VerticalTimeline';
import HorizontalTimeline from './components/timeline/HorizontalTimeline';
import BookingModal from './components/modals/BookingModal';
import DailyStatusModal from './components/modals/DailyStatusModal';
import TotalNotesModal from './components/modals/TotalNotesModal';
import SearchModal from './components/modals/SearchModal';
import UnallocatedBookingsModal from './components/modals/UnallocatedBookingsModal';
import ZoomableTimelineWrapper from './components/timeline/ZoomableTimelineWrapper';

const ROW_HEIGHT = 65;
const COL_WIDTH_HORIZ = 110;

export default function DashboardPage() {
  const d = useDashboard();
  const auth = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* 🧭 크롬 스타일 접이식 사이드바 */}
      <AppSidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 우측 메인 대시보드 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 1. 상단 헤더 모듈 */}
        <DashboardHeader
          userRole={auth.role}
          todayCheckIns={d.todayCheckIns}
          todayCheckOuts={d.todayCheckOuts}
          tomorrowCheckIns={d.tomorrowCheckIns}
          tomorrowCheckOuts={d.tomorrowCheckOuts}
          unallocatedCount={d.unallocatedBookings.length}
          viewMode={d.viewMode}
          loading={d.loading}
          isSyncing={d.isSyncing}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onOpenDailyModal={d.setDailyModalType}
          onOpenUnallocatedModal={() => d.setIsUnallocatedModalOpen(true)}
          onToggleViewMode={d.toggleViewMode}
          onReload={d.reloadAll}
          onSyncWithBeds24={d.syncWithBeds24}
        />

        <div className="p-2 md:p-3 flex-1 flex flex-col gap-3">
          {d.error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-bold">
              🚨 {d.error}
            </div>
          )}

          {/* 2. 대시보드 본문 패널 */}
          <div className="dashboard-panel">
          {/* 툴바 모듈 */}
          <DashboardToolbar
            timelineDates={d.timelineDates}
            selectedDate={d.selectedDate}
            zoomLevel={d.zoomLevel}
            onChangeZoom={d.changeZoom}
            onUpdateZoomLevel={d.updateZoomLevel}
            onResetZoom={d.resetZoom}
            onResetSelectedDate={() => d.setSelectedDate(null)}
            onOpenSearch={() => d.setIsSearchOpen(true)}
            onMoveDays={d.moveDays}
            onGoToday={d.goToday}
            onOpenTotalNotes={() => d.setIsTotalNotesOpen(true)}
          />

          {/* 타임라인 렌더링 (구글 시트형 줌 배율 제어 래퍼) */}
          <ZoomableTimelineWrapper
            zoomLevel={d.zoomLevel}
            onUpdateZoomLevel={d.updateZoomLevel}
          >
            {d.viewMode === 'vertical' ? (
              <VerticalTimeline
                timelineDates={d.timelineDates}
                todayStr={d.todayStr}
                selectedDate={d.selectedDate}
                bookings={d.bookings}
                bookingNotes={d.bookingNotes}
                ROW_HEIGHT={ROW_HEIGHT}
                displayDaysCount={d.displayDaysCount}
                onDateClick={d.handleDateClick}
                onBookingClick={d.handleBookingClick}
              />
            ) : (
              <HorizontalTimeline
                timelineDates={d.timelineDates}
                todayStr={d.todayStr}
                selectedDate={d.selectedDate}
                bookings={d.bookings}
                bookingNotes={d.bookingNotes}
                COL_WIDTH={COL_WIDTH_HORIZ}
                ROW_HEIGHT={ROW_HEIGHT}
                onDateClick={d.handleDateClick}
                onBookingClick={d.handleBookingClick}
              />
            )}
          </ZoomableTimelineWrapper>
        </div>
      </div>
      </div>

      {/* 3. 모달 레이어들 */}
      {d.activeBooking && (
        <BookingModal
          booking={d.activeBooking}
          allBookings={d.bookings}
          memoInput={d.memoInput}
          setMemoInput={d.setMemoInput}
          selectedTags={d.selectedTags}
          onToggleTag={d.handleToggleTag}
          onSave={() => d.handleSaveMemo()}
          onDelete={() => d.handleDeleteMemo()}
          onClose={() => d.setActiveBooking(null)}
          onAssignUnit={d.handleAssignUnit}
        />
      )}

      {d.dailyModalType && (
        <DailyStatusModal
          title={d.dailyModalType === 'today' ? '오늘 체크인/체크아웃 현황' : '내일 체크인/체크아웃 현황'}
          dateStr={d.dailyModalType === 'today' ? d.todayStr : d.tomorrowStr}
          checkInBookings={d.dailyModalType === 'today' ? d.todayCheckIns : d.tomorrowCheckIns}
          checkOutBookings={d.dailyModalType === 'today' ? d.todayCheckOuts : d.tomorrowCheckOuts}
          bookingNotes={d.bookingNotes}
          onClose={() => d.setDailyModalType(null)}
          onSelectBooking={(b) => {
            d.setDailyModalType(null);
            d.openBookingDetail(b);
          }}
        />
      )}

      {d.isTotalNotesOpen && (
        <TotalNotesModal
          bookings={d.bookings}
          bookingNotes={d.bookingNotes}
          onClose={() => d.setIsTotalNotesOpen(false)}
          onSelectBooking={(b) => {
            d.setIsTotalNotesOpen(false);
            d.openBookingDetail(b);
          }}
        />
      )}

      {d.isSearchOpen && (
        <SearchModal
          bookings={d.bookings}
          onClose={() => d.setIsSearchOpen(false)}
          onSelectBooking={(b) => {
            d.setIsSearchOpen(false);
            d.openBookingDetail(b);
          }}
        />
      )}

      {d.isUnallocatedModalOpen && (
        <UnallocatedBookingsModal
          bookings={d.unallocatedBookings}
          allBookings={d.bookings}
          bookingNotes={d.bookingNotes}
          onClose={() => d.setIsUnallocatedModalOpen(false)}
          onAssignUnit={d.handleAssignUnit}
          onSelectBooking={(b) => {
            d.openBookingDetail(b);
          }}
        />
      )}
    </div>
  );
}