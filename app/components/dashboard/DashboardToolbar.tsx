'use client';

interface DashboardToolbarProps {
    timelineDates: string[];
    selectedDate: string | null;
    onResetSelectedDate: () => void;
    onOpenSearch: () => void;
    onMoveDays: (days: number) => void;
    onGoToday: () => void;
    onOpenTotalNotes: () => void;
}

export default function DashboardToolbar({
    timelineDates,
    selectedDate,
    onResetSelectedDate,
    onOpenSearch,
    onMoveDays,
    onGoToday,
    onOpenTotalNotes,
}: DashboardToolbarProps) {
    return (
        <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-gray-200">
            {/* 좌측: 날짜 범위 + 강조 해제 + 🔍 검색 버튼 */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <div className="text-xs md:text-sm font-bold text-gray-700 flex items-center gap-1">
                    <span>📅 조회:</span>
                    <span className="text-blue-600 font-extrabold">{timelineDates[0]}</span>
                    <span>~</span>
                    <span className="text-blue-600 font-extrabold">{timelineDates[timelineDates.length - 1]}</span>
                </div>

                {selectedDate && (
                    <button onClick={onResetSelectedDate} className="btn-reset-highlight">
                        🔍 {selectedDate} 강조 해제 ✖
                    </button>
                )}

                <button
                    onClick={onOpenSearch}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm transition flex items-center gap-1"
                >
                    🔍 검색
                </button>
            </div>

            {/* 우측: 주간 이동 + 🔥 특이사항 모아보기 버튼 */}
            <div className="flex flex-wrap items-center gap-2 ml-auto">
                <div className="flex gap-1">
                    <button onClick={() => onMoveDays(-7)} className="btn-secondary">◀ 지난주</button>
                    <button onClick={onGoToday} className="btn-secondary btn-secondary-blue">오늘 기준</button>
                    <button onClick={() => onMoveDays(7)} className="btn-secondary">다음주 ▶</button>
                </div>

                <button
                    onClick={onOpenTotalNotes}
                    className="btn-highlight-notes"
                    title="전체 특이사항 및 빠른 태그 모아보기"
                >
                    <span>🔥</span>
                    <span>특이사항 모아보기</span>
                </button>
            </div>
        </div>
    );
}