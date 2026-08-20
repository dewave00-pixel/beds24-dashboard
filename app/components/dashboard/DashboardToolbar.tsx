'use client';

interface DashboardToolbarProps {
    timelineDates: string[];
    selectedDate: string | null;
    zoomLevel?: number;
    onChangeZoom?: (delta: number) => void;
    onUpdateZoomLevel?: (level: number) => void;
    onResetZoom?: () => void;
    onResetSelectedDate: () => void;
    onOpenSearch: () => void;
    onMoveDays: (days: number) => void;
    onGoToday: () => void;
    onOpenTotalNotes: () => void;
}

export default function DashboardToolbar({
    timelineDates,
    selectedDate,
    zoomLevel = 1.0,
    onChangeZoom,
    onUpdateZoomLevel,
    onResetZoom,
    onResetSelectedDate,
    onOpenSearch,
    onMoveDays,
    onGoToday,
    onOpenTotalNotes,
}: DashboardToolbarProps) {
    return (
        <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-gray-200">
            {/* 좌측: 날짜 범위 + 강조 해제 + 🔍 검색 버튼 + 🔍 배율 조절 */}
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

                {/* 🔍 구글 시트형 배율 조절 컨트롤러 */}
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-300 text-xs font-bold shadow-2xs">
                    <button
                        type="button"
                        onClick={() => onChangeZoom?.(-0.15)}
                        disabled={zoomLevel <= 0.45}
                        className="px-1.5 py-0.5 rounded bg-white hover:bg-gray-200 text-gray-700 font-black disabled:opacity-30 cursor-pointer text-xs"
                        title="축소 (작게 보기)"
                    >
                        ➖
                    </button>
                    
                    <button
                        type="button"
                        onClick={() => onUpdateZoomLevel?.(0.5)}
                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-black transition cursor-pointer ${
                            zoomLevel <= 0.6 ? 'bg-blue-600 text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title="50% 축소 (전체 한눈에 보기)"
                    >
                        50%
                    </button>
                    <button
                        type="button"
                        onClick={() => onUpdateZoomLevel?.(0.75)}
                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-black transition cursor-pointer ${
                            zoomLevel > 0.6 && zoomLevel <= 0.85 ? 'bg-blue-600 text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title="75% 축소"
                    >
                        75%
                    </button>
                    <button
                        type="button"
                        onClick={() => onResetZoom?.()}
                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-black transition cursor-pointer ${
                            zoomLevel > 0.85 && zoomLevel < 1.15 ? 'bg-blue-600 text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title="100% 기본 크기"
                    >
                        100%
                    </button>

                    <button
                        type="button"
                        onClick={() => onChangeZoom?.(0.15)}
                        disabled={zoomLevel >= 1.8}
                        className="px-1.5 py-0.5 rounded bg-white hover:bg-gray-200 text-gray-700 font-black disabled:opacity-30 cursor-pointer text-xs"
                        title="확대 (크게 보기)"
                    >
                        ➕
                    </button>
                </div>
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