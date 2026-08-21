'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import '../dashboard.css';
import { PROPERTY_GROUPS } from '../config';
import { useAuth } from '../hooks/useAuth';
import AppSidebar from '../components/layout/AppSidebar';

interface UnitInfoData {
    doorPassword: string;
    maxGuests: number;
    repairNotes: string;
}

export default function PropertiesPage() {
    const auth = useAuth();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
    const [propertiesInfo, setPropertiesInfo] = useState<{ [id: string]: UnitInfoData }>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [editingId, setEditingId] = useState<string | null>(null);

    // 인라인 수정 상태
    const [editPassword, setEditPassword] = useState<string>('');
    const [editMaxGuests, setEditMaxGuests] = useState<number>(2);
    const [editRepairNotes, setEditRepairNotes] = useState<string>('');
    const [saving, setSaving] = useState<boolean>(false);

    // 복사 피드백 상태
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // 1. Supabase에서 숙소 정보 불러오기
    const fetchPropertiesInfo = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/properties-info', { cache: 'no-store' });
            const data = await res.json();
            if (data.success && data.data) {
                setPropertiesInfo(data.data);
            }
        } catch (e) {
            console.error('숙소 정보 불러오기 실패:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPropertiesInfo();
    }, []);

    // 2. 수정 모드 진입
    const handleStartEdit = (unitKey: string, currentData?: UnitInfoData) => {
        setEditingId(unitKey);
        setEditPassword(currentData?.doorPassword || '');
        setEditMaxGuests(currentData?.maxGuests || 2);
        setEditRepairNotes(currentData?.repairNotes || '');
    };

    // 3. 수정 취소
    const handleCancelEdit = () => {
        setEditingId(null);
    };

    // 4. 정보 저장하기
    const handleSave = async (unitKey: string, roomId: number, unitId?: number) => {
        setSaving(true);
        try {
            const res = await fetch('/api/properties-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unitKey,
                    roomId,
                    unitId: unitId || null,
                    doorPassword: editPassword,
                    maxGuests: editMaxGuests,
                    repairNotes: editRepairNotes,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setPropertiesInfo((prev) => ({
                    ...prev,
                    [unitKey]: {
                        doorPassword: editPassword,
                        maxGuests: editMaxGuests,
                        repairNotes: editRepairNotes,
                    },
                }));
                setEditingId(null);
            } else {
                alert('저장에 실패했습니다: ' + (data.error || ''));
            }
        } catch (e) {
            console.error('숙소 정보 저장 실패:', e);
            alert('서버 통신 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    // 5. 비밀번호 원클릭 복사
    const handleCopyPassword = (unitKey: string, password: string) => {
        if (!password) return;
        navigator.clipboard.writeText(password);
        setCopiedId(unitKey);
        setTimeout(() => {
            setCopiedId(null);
        }, 1500);
    };

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* 🧭 크롬 스타일 접이식 사이드바 */}
            <AppSidebar
                isMobileOpen={isMobileSidebarOpen}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />

            {/* 메인 본문 컨텐츠 */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* 상단 콤팩트 헤더 */}
                <header className="bg-white border-b border-gray-200 px-3 py-2 md:px-5 md:py-2.5 flex items-center justify-between shadow-xs shrink-0">
                    <div className="flex items-center gap-2.5">
                        {/* 📱 모바일 햄버거 버튼 */}
                        <button
                            type="button"
                            onClick={() => setIsMobileSidebarOpen(true)}
                            title="메뉴 열기"
                            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-base font-black transition cursor-pointer border border-gray-200"
                        >
                            ☰
                        </button>

                        <div className="flex items-center gap-2">
                            <span className="text-xl">🔑</span>
                            <div>
                                <h1 className="text-sm md:text-base font-black text-gray-900 leading-tight">
                                    숙소 비밀번호 & 호실 현황
                                </h1>
                                <span className="text-[10.5px] text-gray-500 font-bold hidden sm:inline">
                                    도어락 비밀번호 복사, 최대 인원 및 주요 수리사항 한눈에 관리
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={fetchPropertiesInfo}
                        disabled={loading}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs rounded-xl border border-gray-200 transition flex items-center gap-1 cursor-pointer"
                    >
                        <span className={loading ? 'animate-spin' : ''}>🔄</span>
                        <span className="hidden sm:inline">새로고침</span>
                    </button>
                </header>

                {/* 📌 한눈에 쏙 들어오는 숙소별 콤팩트 테이블 본문 패널 */}
                <div className="dashboard-panel p-2 md:p-3 flex flex-col gap-4">

                    {loading ? (
                        <div className="text-center py-12 text-gray-400 font-bold text-xs">
                            숙소 정보를 불러오는 중입니다...
                        </div>
                    ) : (
                        PROPERTY_GROUPS.map((group) => (
                            <div key={group.name} className="flex flex-col gap-1.5">

                                {/* 🎨 묵직하고 선명한 블랙(Black) 숙소 그룹 뱃지 */}
                                <div className="flex items-center gap-1.5 pt-1">
                                    <span className="text-[10.5px] md:text-xs font-black text-white bg-slate-900 px-2.5 py-0.5 rounded-md shadow-sm border border-black flex items-center gap-1">
                                        <span>🏢</span>
                                        <span>{group.name}</span>
                                    </span>
                                    <span className="text-[10.5px] text-gray-500 font-extrabold">
                                        ({group.units.length}개 호실)
                                    </span>
                                </div>

                                {/* 🖥️ PC 뷰: 한눈에 쏙 들어오는 콤팩트 테이블 (표 형태) */}
                                <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-300 shadow-sm bg-white">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 font-black text-[11px]">
                                                <th className="py-2 px-3 w-36">호실명</th>
                                                <th className="py-2 px-3 w-48">🔑 도어락 비밀번호</th>
                                                <th className="py-2 px-3 w-28">👥 최대 인원</th>
                                                <th className="py-2 px-3">🛠️ 주요 수리 / 점검 메모</th>
                                                <th className="py-2 px-3 w-24 text-center">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {group.units.map((unit) => {
                                                const info = propertiesInfo[unit.key] || {
                                                    doorPassword: '',
                                                    maxGuests: 2,
                                                    repairNotes: '',
                                                };
                                                const isEditing = editingId === unit.key;

                                                return (
                                                    <tr key={unit.key} className={`transition ${isEditing ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>

                                                        {/* 호실명 */}
                                                        <td className="py-2 px-3 font-black text-gray-900">
                                                            <span>🏠 {unit.displayName}</span>
                                                            {unit.subName && (
                                                                <span className="text-[10.5px] text-gray-400 font-bold ml-1">
                                                                    ({unit.subName})
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* 비밀번호 (원클릭 복사) */}
                                                        <td className="py-2 px-3 font-mono">
                                                            {!isEditing ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-xs">
                                                                        {info.doorPassword || '미등록'}
                                                                    </span>
                                                                    {info.doorPassword && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleCopyPassword(unit.key, info.doorPassword)}
                                                                            className="px-1.5 py-0.5 text-[9.5px] font-black text-white bg-slate-800 hover:bg-slate-900 rounded shadow-sm transition"
                                                                        >
                                                                            {copiedId === unit.key ? '복사됨! ✅' : '복사'}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    value={editPassword}
                                                                    onChange={(e) => setEditPassword(e.target.value)}
                                                                    placeholder="비밀번호 입력"
                                                                    className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-xs font-bold text-gray-900 focus:outline-none"
                                                                />
                                                            )}
                                                        </td>

                                                        {/* 최대 투숙 인원 */}
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
                                                                        onChange={(e) => setEditMaxGuests(Number(e.target.value))}
                                                                        className="w-14 px-1.5 py-1 bg-white border border-blue-400 rounded text-xs font-bold text-gray-900 focus:outline-none"
                                                                    />
                                                                    <span>명</span>
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* 수리 메모 */}
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
                                                                    onChange={(e) => setEditRepairNotes(e.target.value)}
                                                                    placeholder="수리/점검 메모 입력"
                                                                    className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-xs font-medium text-gray-900 focus:outline-none"
                                                                />
                                                            )}
                                                        </td>

                                                        {/* 관리 액션 버튼 */}
                                                        <td className="py-2 px-3 text-center">
                                                            {!isEditing ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartEdit(unit.key, info)}
                                                                    className="px-2 py-1 text-[10.5px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition"
                                                                >
                                                                    수정
                                                                </button>
                                                            ) : (
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSave(unit.key, unit.roomId, unit.unitId)}
                                                                        disabled={saving}
                                                                        className="px-2 py-1 text-[10.5px] font-black text-white bg-blue-600 hover:bg-blue-700 rounded transition"
                                                                    >
                                                                        저장
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleCancelEdit}
                                                                        disabled={saving}
                                                                        className="px-1.5 py-1 text-[10.5px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition"
                                                                    >
                                                                        취소
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>

                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* 📱 모바일 뷰: 한 손으로 쏙 들어오는 시원하고 선명한 카드 */}
                                <div className="grid grid-cols-1 gap-2 md:hidden">
                                    {group.units.map((unit) => {
                                        const info = propertiesInfo[unit.key] || {
                                            doorPassword: '',
                                            maxGuests: 2,
                                            repairNotes: '',
                                        };
                                        const isEditing = editingId === unit.key;

                                        return (
                                            <div
                                                key={unit.key}
                                                className={`rounded-xl transition shadow-2xs flex flex-col gap-2 p-2.5 ${
                                                    isEditing
                                                        ? 'bg-blue-50/80 border-2 border-blue-400'
                                                        : 'bg-white border border-gray-300'
                                                }`}
                                            >
                                                {/* 모바일 헤더줄: 호실명 + 액션 버튼 / 비번 복사 */}
                                                <div className="flex items-center justify-between gap-1.5">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="font-black text-xs text-gray-900 shrink-0">
                                                            🏠 {unit.displayName}
                                                        </span>
                                                        {unit.subName && (
                                                            <span className="text-[10px] text-gray-500 font-bold truncate">
                                                                ({unit.subName})
                                                            </span>
                                                        )}
                                                        {isEditing && (
                                                            <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">
                                                                수정 중
                                                            </span>
                                                        )}
                                                    </div>

                                                    {!isEditing ? (
                                                        <div className="flex items-center gap-1 min-w-0 shrink-0">
                                                            <span className="font-black text-xs font-mono text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                                                🔑 {info.doorPassword || '미등록'}
                                                            </span>
                                                            {info.doorPassword && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopyPassword(unit.key, info.doorPassword)}
                                                                    className="px-2 py-0.5 text-[10px] font-black text-white bg-slate-800 hover:bg-slate-900 rounded shadow-xs cursor-pointer"
                                                                >
                                                                    {copiedId === unit.key ? '복사됨! ✅' : '복사'}
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartEdit(unit.key, info)}
                                                                className="px-2 py-0.5 text-[11px] font-black text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded cursor-pointer ml-1"
                                                            >
                                                                수정
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSave(unit.key, unit.roomId, unit.unitId)}
                                                                disabled={saving}
                                                                className="px-3 py-1 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                                                            >
                                                                {saving ? '저장중...' : '저장'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleCancelEdit}
                                                                disabled={saving}
                                                                className="px-2.5 py-1 text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg cursor-pointer disabled:opacity-50"
                                                            >
                                                                취소
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 모바일 일반 뷰: 최대 인원 & 수리 메모 */}
                                                {!isEditing && (
                                                    <div className="flex items-center justify-between gap-2 text-xs pt-0.5 border-t border-gray-100">
                                                        <span className="text-[11px] text-gray-600 font-bold shrink-0">
                                                            👥 최대 <strong className="text-blue-600 font-black">{info.maxGuests}</strong>명
                                                        </span>
                                                        {info.repairNotes ? (
                                                            <span className="text-[11px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold truncate max-w-[200px]">
                                                                🛠️ {info.repairNotes}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10.5px] text-gray-400">수리 메모 없음</span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* 모바일 수정 모드: 큼직하고 선명한 고대비 입력 폼 */}
                                                {isEditing && (
                                                    <div className="flex flex-col gap-2 pt-1 border-t border-blue-200">
                                                        {/* 1행: 비밀번호 + 최대 인원 */}
                                                        <div className="flex items-end gap-2">
                                                            <div className="flex-1 flex flex-col gap-1">
                                                                <label className="text-[11px] font-black text-blue-900 flex items-center gap-1">
                                                                    <span>🔑</span> 도어락 비밀번호
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={editPassword}
                                                                    onChange={(e) => setEditPassword(e.target.value)}
                                                                    placeholder="비밀번호 입력"
                                                                    className="w-full px-3 py-1.5 bg-white border-2 border-blue-400 rounded-lg text-sm font-black text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 shadow-2xs font-mono"
                                                                />
                                                            </div>

                                                            <div className="w-24 flex flex-col gap-1">
                                                                <label className="text-[11px] font-black text-blue-900 flex items-center gap-1">
                                                                    <span>👥</span> 최대 인원
                                                                </label>
                                                                <div className="flex items-center gap-1">
                                                                    <input
                                                                        type="number"
                                                                        min={1}
                                                                        max={30}
                                                                        value={editMaxGuests}
                                                                        onChange={(e) => setEditMaxGuests(Number(e.target.value))}
                                                                        className="w-full px-2 py-1.5 bg-white border-2 border-blue-400 rounded-lg text-sm font-black text-gray-900 text-center focus:outline-none focus:border-blue-600 shadow-2xs"
                                                                    />
                                                                    <span className="text-xs font-bold text-gray-700 shrink-0">명</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 2행: 수리/점검 메모 */}
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                                                                <span>🛠️</span> 주요 수리 / 점검 메모
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={editRepairNotes}
                                                                onChange={(e) => setEditRepairNotes(e.target.value)}
                                                                placeholder="수리/점검 사항을 입력하세요 (없으면 공란)"
                                                                className="w-full px-3 py-1.5 bg-white border-2 border-blue-400 rounded-lg text-xs font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 shadow-2xs"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                            </div>
                        ))
                    )}

                </div>

            </div>
        </div>
    );
}