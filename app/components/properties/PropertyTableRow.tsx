'use client';

import { UnitConfig } from '../../types';
import { UnitInfoData } from '../../hooks/usePropertiesInfo';

interface PropertyTableRowProps {
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

export default function PropertyTableRow({
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
}: PropertyTableRowProps) {
    return (
        <tr className={`transition ${isEditing ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
            {/* 1. 호실명 */}
            <td className="py-2 px-3 font-black text-gray-900">
                <span>🏠 {unit.displayName}</span>
                {unit.subName && (
                    <span className="text-[10.5px] text-gray-400 font-bold ml-1">
                        ({unit.subName})
                    </span>
                )}
            </td>

            {/* 2. 비밀번호 */}
            <td className="py-2 px-3 font-mono">
                {!isEditing ? (
                    <div className="flex items-center gap-1.5">
                        <span className="font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-xs">
                            {info.doorPassword || '미등록'}
                        </span>
                        {info.doorPassword && (
                            <button
                                type="button"
                                onClick={() => onCopyPassword(info.doorPassword)}
                                className="px-1.5 py-0.5 text-[9.5px] font-black text-white bg-slate-800 hover:bg-slate-900 rounded shadow-sm transition cursor-pointer"
                            >
                                {copiedId === unit.key ? '복사됨! ✅' : '복사'}
                            </button>
                        )}
                    </div>
                ) : (
                    <input
                        type="text"
                        value={editPassword}
                        onChange={(e) => onEditPasswordChange(e.target.value)}
                        placeholder="비밀번호 입력"
                        className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-xs font-bold text-gray-900 focus:outline-none"
                    />
                )}
            </td>

            {/* 3. 최대 인원 */}
            <td className="py-2 px-3 font-bold text-gray-800">
                {!isEditing ? (
                    <span>최대 <strong className="text-blue-600 font-black">{info.maxGuests}</strong>명</span>
                ) : (
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            min={1}
                            max={30}
                            value={editMaxGuests}
                            onChange={(e) => onEditMaxGuestsChange(Number(e.target.value))}
                            className="w-14 px-1.5 py-1 bg-white border border-blue-400 rounded text-xs font-bold text-gray-900 focus:outline-none"
                        />
                        <span>명</span>
                    </div>
                )}
            </td>

            {/* 4. 수리 메모 */}
            <td className="py-2 px-3">
                {!isEditing ? (
                    info.repairNotes ? (
                        <span className="text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold text-[11px] inline-block max-w-md truncate">
                            🛠️ {info.repairNotes}
                        </span>
                    ) : (
                        <span className="text-gray-300 font-normal text-[11px]">-</span>
                    )
                ) : (
                    <input
                        type="text"
                        value={editRepairNotes}
                        onChange={(e) => onEditRepairNotesChange(e.target.value)}
                        placeholder="수리/점검 메모 입력"
                        className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-xs font-medium text-gray-900 focus:outline-none"
                    />
                )}
            </td>

            {/* 5. 관리 액션 버튼 */}
            <td className="py-2 px-3 text-center">
                {!isEditing ? (
                    <button
                        type="button"
                        onClick={onStartEdit}
                        className="px-2 py-1 text-[10.5px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition cursor-pointer"
                    >
                        수정
                    </button>
                ) : (
                    <div className="flex items-center justify-center gap-1">
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={saving}
                            className="px-2 py-1 text-[10.5px] font-black text-white bg-blue-600 hover:bg-blue-700 rounded transition cursor-pointer"
                        >
                            저장
                        </button>
                        <button
                            type="button"
                            onClick={onCancelEdit}
                            disabled={saving}
                            className="px-1.5 py-1 text-[10.5px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition cursor-pointer"
                        >
                            취소
                        </button>
                    </div>
                )}
            </td>
        </tr>
    );
}