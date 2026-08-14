'use client';

import { useState } from 'react';

interface CleaningStaffPoolProps {
    staffList: string[];
    staffMap: Record<string, string>;
    updateStaffMap: (newMap: Record<string, string>) => void;
    selectedStaffForMobile: string;
    onSelectStaffForMobile: (staff: string) => void;
}

export default function CleaningStaffPool({
    staffList,
    staffMap,
    updateStaffMap,
    selectedStaffForMobile,
    onSelectStaffForMobile,
}: CleaningStaffPoolProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempMap, setTempMap] = useState<Record<string, string>>({});

    const handleDragStart = (e: React.DragEvent, staffName: string) => {
        e.dataTransfer.setData('text/plain', staffName);
    };

    const startEditing = () => {
        setTempMap({ ...staffMap });
        setIsEditing(true);
    };

    const handleSave = () => {
        updateStaffMap(tempMap);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    return (
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="font-black text-xs md:text-sm text-gray-900 flex items-center gap-1">
                    <span>👥</span> 청소 담당자 명단
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500 font-bold hidden md:inline">
                        💡 담당자를 마우스로 잡아 아래 숙소 카드로 끌어다 놓으세요 (Drag & Drop)
                    </span>
                    {!isEditing ? (
                        <button
                            onClick={startEditing}
                            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md font-bold transition flex items-center gap-1"
                        >
                            <span>⚙️</span>
                            <span>설정</span>
                        </button>
                    ) : (
                        <div className="flex gap-1">
                            <button
                                onClick={handleCancel}
                                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md font-bold transition"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-bold transition"
                            >
                                저장
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 담당자 뱃지 목록 (PC: 드래그 / 모바일: 원터치 탭 선택) */}
            <div className="flex flex-wrap gap-2 pt-1">
                {isEditing ? (
                    Object.entries(tempMap).map(([id, name]) => (
                        <div key={id} className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                            <span className="text-xs">👤</span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setTempMap({ ...tempMap, [id]: e.target.value })}
                                className="px-2 py-1 text-xs font-bold text-gray-800 border border-gray-300 rounded-md w-28 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                            />
                        </div>
                    ))
                ) : (
                    staffList.map((staff) => {
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
                    })
                )}
            </div>
        </div>
    );
}