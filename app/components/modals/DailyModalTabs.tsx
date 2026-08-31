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
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-xl md:hidden">
            {/* 모바일 체크인 탭 */}
            <button
                type="button"
                onClick={() => onTabChange('checkIn')}
                className={`py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${activeTab === 'checkIn'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
            >
                <span>📥 체크인 목록</span>
                <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeTab === 'checkIn' ? 'bg-white text-blue-600' : 'bg-gray-200 text-gray-700'
                        }`}
                >
                    {checkInCount}
                </span>
            </button>

            {/* 모바일 체크아웃 탭 */}
            <button
                type="button"
                onClick={() => onTabChange('checkOut')}
                className={`py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${activeTab === 'checkOut'
                        ? 'bg-orange-600 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
            >
                <span>📤 체크아웃 목록</span>
                <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeTab === 'checkOut' ? 'bg-white text-orange-600' : 'bg-gray-200 text-gray-700'
                        }`}
                >
                    {checkOutCount}
                </span>
            </button>
        </div>
    );
}