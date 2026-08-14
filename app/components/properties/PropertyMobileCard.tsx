'use client';

import { UnitConfig } from '../../types';
import { UnitInfoData } from '../../hooks/usePropertiesInfo';

interface PropertyMobileCardProps {
    unit: UnitConfig;
    info: UnitInfoData;
    isEditing: boolean;
    editPassword: string;
    editMaxGuests: number;
    editRepairNotes: string;
    saving: boolean;
    copiedId: string | null;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onSave: () => void;
    onCopyPassword: (password: string) => void;
    onEditPasswordChange: (val: string) => void;
    onEditMaxGuestsChange: (val: number) => void;
    onEditRepairNotesChange: (val: string) => void;
}

export default function PropertyMobileCard({
    unit,
    info,
    isEditing,
    editPassword,
    editMaxGuests,
    editRepairNotes,
    saving,
    copiedId,
    onStartEdit,
    onCancelEdit,
    onSave,
    onCopyPassword,
    onEditPasswordChange,
    onEditMaxGuestsChange,
    onEditRepairNotesChange,
}: PropertyMobileCardProps) {
    return (
        <div className="bg-white rounded-lg border border-gray-300 p-2 shadow-sm flex flex-col gap-1.5">
            {/* 1줄: 호실명 + 비번(원터치 복사) + 수정 버튼 */}
            <div className="flex items-center justify-between gap-1">
                <span className="font-black text-xs text-gray-900 shrink-0">
                    🏠 {unit.displayName}
                </span>

                {!isEditing ? (
                    <div className="flex items-center gap-1 min-w-0">
                        <span className="font-black text-[11px] font-mono text-gray-900 bg-gray-100 px-1.5 py-0.2 rounded border border-gray-200 truncate">
                            🔑 {info.doorPassword || '미등록'}
                        </span>
                        {info.doorPassword && (
                            <button
                                type="button"
                                onClick={() => onCopyPassword(info.doorPassword)}
                                className="px-1.5 py-0.5 text-[9px] font-black text-white bg-slate-800 rounded shrink-0 cursor-pointer"
                            >
                                {copiedId === unit.key ? '복사됨!' : '복사'}
                            </button>
                        )}
                        <span className="text-[10px] text-gray-500 font-bold shrink-0 ml-1">
                            (최대 {info.maxGuests}명)
                        </span>
                        <button
                            type="button"
                            onClick={onStartEdit}
                            className="px-1.5 py-0.5 text-[9.5px] font-black text-blue-600 bg-blue-50 border border-blue-200 rounded shrink-0 ml-0.5 cursor-pointer"
                        >
                            수정
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={saving}
                            className="px-2 py-0.5 text-[10px] font-black text-white bg-blue-600 rounded cursor-pointer"
                        >
                            저장
                        </button>
                        <button
                            type="button"
                            onClick={onCancelEdit}
                            disabled={saving}
                            className="px-1.5 py-0.5 text-[10px] font-bold text-gray-600 bg-gray-100 border border-gray-300 rounded cursor-pointer"
                        >
                            취소
                        </button>
                    </div>
                )}
            </div>

            {/* 수정 모드일 때의 인라인 폼 */}
            {isEditing && (
                <div className="flex flex-col gap-1 pt-1 border-t border-gray-100 text-xs">
                    <div className="flex items-center gap-1.5">
                        <input
                            type="text"
                            value={editPassword}
                            onChange={(e) => onEditPasswordChange(e.target.value)}
                            placeholder="비밀번호"
                            className="flex-1 px-2 py-1 bg-white border border-blue-400 rounded text-[11px] font-bold"
                        />
                        <input
                            type="number"
                            min={1}
                            max={30}
                            value={editMaxGuests}
                            onChange={(e) => onEditMaxGuestsChange(Number(e.target.value))}
                            className="w-14 px-2 py-1 bg-white border border-blue-400 rounded text-[11px] font-bold text-center"
                        />
                        <span className="text-[10px] text-gray-500 font-bold shrink-0">명</span>
                    </div>
                    <input
                        type="text"
                        value={editRepairNotes}
                        onChange={(e) => onEditRepairNotesChange(e.target.value)}
                        placeholder="수리/점검 메모"
                        className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-[11px] font-medium"
                    />
                </div>
            )}

            {/* 평상시 수리 메모 노출 */}
            {!isEditing && info.repairNotes && (
                <div className="text-[10px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold truncate">
                    🛠️ {info.repairNotes}
                </div>
            )}
        </div>
    );
}