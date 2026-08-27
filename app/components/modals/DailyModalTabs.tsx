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
                className={`flex-1 py-2 font-black text-xs flex items-center justify-center gap-1.5 transition border-b-2 cursor-pointer ${activeTab === 'checkIn'
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
            >
                <span>📥 체크인 목록</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'checkIn' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                    {checkInCount}
                </span>
            </button>

            {/* 모바일 체크아웃 탭 */}
            <button
                type="button"
                onClick={() => onTabChange('checkOut')}
                className={`flex-1 py-2 font-black text-xs flex items-center justify-center gap-1.5 transition border-b-2 cursor-pointer ${activeTab === 'checkOut'
                    ? 'border-red-600 text-red-700 bg-red-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
            >
                <span>📤 체크아웃 목록</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'checkOut' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                    {checkOutCount}
                </span>
            </button>
        </div>
    );
}