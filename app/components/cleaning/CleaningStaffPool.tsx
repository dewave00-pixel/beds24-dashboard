'use client';

interface CleaningStaffPoolProps {
    staffList: string[];
    selectedStaffForMobile: string;
    onSelectStaffForMobile: (staff: string) => void;
}

export default function CleaningStaffPool({
    staffList,
    selectedStaffForMobile,
    onSelectStaffForMobile,
}: CleaningStaffPoolProps) {
    const handleDragStart = (e: React.DragEvent, staffName: string) => {
        e.dataTransfer.setData('text/plain', staffName);
    };

    return (
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="font-black text-xs md:text-sm text-gray-900 flex items-center gap-1">
                    <span>👥</span> 청소 담당자 명단
                </span>
                <span className="text-[11px] text-gray-500 font-bold hidden md:inline">
                    💡 담당자를 마우스로 잡아 아래 숙소 카드로 끌어다 놓으세요 (Drag & Drop)
                </span>
            </div>

            {/* 담당자 뱃지 목록 (PC: 드래그 / 모바일: 원터치 탭 선택) */}
            <div className="flex flex-wrap gap-2 pt-1">
                {staffList.map((staff) => {
                    const isSelected = selectedStaffForMobile === staff;
                    return (
                        <div
                            key={staff}
                            draggable
                            onDragStart={(e) => handleDragStart(e, staff)}
                            onClick={() => onSelectStaffForMobile(staff)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-grab active:cursor-grabbing transition shadow-sm border select-none flex items-center gap-1.5 ${isSelected
                                    ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                                }`}
                        >
                            <span>👤</span>
                            <span>{staff}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}