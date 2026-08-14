'use client';

import { useAuth } from '../../hooks/useAuth';
import { useCleaningBoard } from '../../hooks/useCleaningBoard';
import CleaningRoomCard from '../../components/cleaning/CleaningRoomCard';
import '../../dashboard.css';

export default function MyCleaningPage() {
    const auth = useAuth();
    const c = useCleaningBoard();

    // 내게 배정된 호실만 필터링
    const myUnits = c.cleaningTargetUnits.filter(unit => {
        const assignment = c.assignments[unit.key];
        return assignment && assignment.staffId === auth.role;
    });

    if (auth.loading || c.loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center font-bold text-gray-500 flex flex-col items-center gap-2">
                    <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                    <span>나의 청소 배정 목록을 불러오는 중입니다...</span>
                </div>
            </div>
        );
    }

    if (!auth.isStaff) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center font-bold text-red-500 flex flex-col gap-3">
                    <p>청소 스태프 권한으로 로그인해야 접근할 수 있습니다.</p>
                    <button onClick={() => window.location.href = '/'} className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer">대시보드로 돌아가기</button>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-wrapper flex flex-col gap-3">
                {/* 상단 헤더 */}
                <div className="dashboard-header-card py-2.5 px-3 md:px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🧹</span>
                        <div>
                            <h1 className="text-sm md:text-base font-black text-gray-900 leading-tight">
                                나의 청소 배정 목록
                            </h1>
                            <span className="text-[10.5px] text-gray-500 font-bold">
                                {c.selectedDate} 기준 ({myUnits.length}곳)
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={async () => {
                            if (!confirm('로그아웃 하시겠습니까?')) return;
                            await fetch('/api/auth', { method: 'DELETE' });
                            window.location.href = '/login';
                        }}
                        className="text-xs font-bold text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition cursor-pointer"
                    >
                        로그아웃
                    </button>
                </div>

                {/* 내 배정 목록 (그리드) */}
                <div className="dashboard-panel p-3 flex flex-col gap-3">
                    {myUnits.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 font-bold text-xs bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            오늘은 배정된 청소가 없습니다. 수고하셨습니다! 😊
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                            {myUnits.map((unit) => (
                                <div key={unit.key}>
                                    <CleaningRoomCard
                                        unit={unit}
                                        dateStr={c.selectedDate}
                                        assignment={c.assignments[unit.key]}
                                        staffList={c.staffList}
                                        bookings={c.bookings}
                                        bookingNotes={c.bookingNotes}
                                        readonly={true}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
