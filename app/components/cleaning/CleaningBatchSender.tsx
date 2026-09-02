'use client';

import { useState } from 'react';
import { Booking, CleaningAssignment } from '../../types';
import { generateCleaningShareText } from '../../utils/cleaningFormatter';

interface CleaningBatchSenderProps {
    dateStr: string;
    assignments: { [unitKey: string]: CleaningAssignment };
    bookings?: Booking[];
    bookingNotes?: { [bookingId: number]: { note: string; tags: string[] } };
}

export default function CleaningBatchSender({
    dateStr,
    assignments,
    bookings = [],
    bookingNotes = {},
}: CleaningBatchSenderProps) {
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // 현재 배정된 고유 스태프 명단 추출
    const assignedStaffs = Array.from(
        new Set(Object.values(assignments).map((a) => a.staffName).filter(Boolean))
    );

    const totalAssignedRooms = Object.keys(assignments).length;

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // 텍스트 공유 / 복사 공통 함수 (모바일/PC 스마트 분기)
    const executeShareOrCopy = async (title: string, text: string, successMsg: string) => {
        // 모바일 기기 여부 감지 (스마트폰/태블릿)
        const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile && navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: text,
                });
                return;
            } catch (err) {
                // 사용자가 공유창 취소했거나 미지원 시 클립보드 복사로 fallback
            }
        }

        // PC 환경이거나 navigator.share 실패 시 클립보드 복사
        try {
            await navigator.clipboard.writeText(text);
            showToast(successMsg);
        } catch (err) {
            // 폴백 프롬프트
            prompt('아래 텍스트를 복사(Ctrl+C)하여 카카오톡에 붙여넣으세요:', text);
        }
    };

    // 1. 전체 단체 공지 발송/복사
    const handleShareGeneralNotice = () => {
        if (totalAssignedRooms === 0) {
            alert('배정된 호실이 없습니다. 먼저 담당자를 배정해 주세요.');
            return;
        }

        const shareText = `[숙소 청소 배정 안내]
일자: ${dateStr}

오늘 청소 배정이 완료되었습니다.
청소 관리 페이지에 로그인하여 본인 담당 호실과 특이사항(체크인·체크아웃/얼리/메모)을 확인해 주세요!

청소 목록 확인: ${typeof window !== 'undefined' ? window.location.origin : ''}/cleaning
깨끗하고 안전한 청소 부탁드립니다. 감사합니다.`;

        executeShareOrCopy(
            '[청소 배정 전체 공지]',
            shareText,
            '📋 전체 공지 문구가 복사되었습니다! 카톡 대화방에 붙여넣기(Ctrl+V) 하세요.'
        );
    };

    // 2. 스태프 개인별 상세 배정표 발송/복사
    const handleShareStaffDetail = (staffName: string) => {
        const staffUnitKeys = Object.entries(assignments)
            .filter(([_, a]) => a.staffName === staffName)
            .map(([unitKey, _]) => unitKey);

        if (staffUnitKeys.length === 0) {
            alert(`${staffName}님에게 배정된 호실이 없습니다.`);
            return;
        }

        const shareText = generateCleaningShareText(
            dateStr,
            staffName,
            staffUnitKeys,
            bookings,
            bookingNotes
        );

        executeShareOrCopy(
            `[${staffName}님 청소 배정표]`,
            shareText,
            `📋 [${staffName}님] 상세 배정표가 복사되었습니다! 카톡에 붙여넣기(Ctrl+V) 하세요.`
        );
    };

    return (
        <div className="relative p-3.5 bg-slate-900 text-white rounded-xl shadow-md flex flex-col gap-3 shrink-0">
            {/* 1. 상단 안내 및 전체 공지 버튼 */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <span className="text-xl">💬</span>
                    <div className="flex flex-col">
                        <h3 className="text-xs md:text-sm font-black text-yellow-400">
                            청소 배정 카톡 알림 전송
                        </h3>
                        <span className="text-[11px] text-slate-300 font-bold">
                            {assignedStaffs.length > 0 ? (
                                <>배정 인원: <strong className="text-white">{assignedStaffs.join(', ')}</strong> (총 {totalAssignedRooms}곳)</>
                            ) : (
                                '호실에 담당자를 배정하면 원터치로 카톡 알림을 보낼 수 있습니다.'
                            )}
                        </span>
                    </div>
                </div>

                {/* 단체방 전체 공지 버튼 */}
                <button
                    type="button"
                    onClick={handleShareGeneralNotice}
                    disabled={totalAssignedRooms === 0}
                    className={`w-full md:w-auto px-3.5 py-2 rounded-lg font-black text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${totalAssignedRooms > 0
                        ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-900 active:scale-95'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    <span>📢</span>
                    <span>단톡방 전체 공지 복사/전송</span>
                </button>
            </div>

            {/* 2. 스태프 개인별 맞춤 배정표 발송 버튼 목록 (배정된 스태프가 있을 때) */}
            {assignedStaffs.length > 0 && (
                <div className="pt-2.5 border-t border-slate-800 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10.5px] font-bold text-slate-400 mr-1">
                        👤 개인톡 전송:
                    </span>
                    {assignedStaffs.map((staffName) => {
                        const count = Object.values(assignments).filter((a) => a.staffName === staffName).length;
                        return (
                            <button
                                key={staffName}
                                type="button"
                                onClick={() => handleShareStaffDetail(staffName)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white rounded-md text-xs font-black transition flex items-center gap-1 border border-slate-700 cursor-pointer"
                                title={`${staffName}님 배정 호실 ${count}곳 상세 복사`}
                            >
                                <span>📋</span>
                                <span>{staffName} ({count}곳)</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 3. 복사 성공 알림 Toast 배너 */}
            {toastMessage && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 font-black text-xs px-4 py-2 rounded-lg shadow-xl animate-bounce flex items-center gap-1.5 z-50 whitespace-nowrap">
                    <span>✅</span>
                    <span>{toastMessage}</span>
                </div>
            )}
        </div>
    );
}