'use client';

interface DailyModalTabsProps {
    activeTab: 'checkIn' | 'checkOut';
    checkInCount: number;
    checkOutCount: number;
    onTabChange: (tab: 'checkIn' | 'checkOut') => void;
}

export default function DailyModalTabs({
    activeTab,
    checkInCount,
    checkOutCount,
    onTabChange,
}: DailyModalTabsProps) {
    return (
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl md:hidden">
            {/* 모바일 체크인 탭 */}
            <button
                type="button"
                onClick={() => onTabChange('checkIn')}
                className={`py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'checkIn'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                    }`}
            >
                <span>📥 체크인 목록</span>
                <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeTab === 'checkIn' ? 'bg-white text-blue-600' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                        }`}
                >
                    {checkInCount}
                </span>
            </button>

            {/* 모바일 체크아웃 탭 */}
            <button
                type="button"
                onClick={() => onTabChange('checkOut')}
                className={`py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'checkOut'
                        ? 'bg-orange-600 text-white shadow-md'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                    }`}
            >
                <span>📤 체크아웃 목록</span>
                <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeTab === 'checkOut' ? 'bg-white text-orange-600' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                        }`}
                >
                    {checkOutCount}
                </span>
            </button>
        </div>
    );
}