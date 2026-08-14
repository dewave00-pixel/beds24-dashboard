'use client';

import { CleaningAssignment } from '../../types';

interface CleaningBatchSenderProps {
    dateStr: string;
    assignments: { [unitKey: string]: CleaningAssignment };
}

export default function CleaningBatchSender({
    dateStr,
    assignments,
}: CleaningBatchSenderProps) {
    // 현재 배정된 고유 스태프 명단 추출
    const assignedStaffs = Array.from(
        new Set(Object.values(assignments).map((a) => a.staffName).filter(Boolean))
    );

    const totalAssignedRooms = Object.keys(assignments).length;

    const handleShareNotice = () => {
        if (totalAssignedRooms === 0) {
            alert('배정된 호실이 없습니다. 먼저 담당자를 배정해 주세요.');
            return;
        }

        const shareText = `[숙소 청소 배정 안내]
📅 일자: ${dateStr}

오늘 청소 배정이 완료되었습니다.
청소 관리 페이지에 로그인하여 본인 담당 호실과 특이사항(입퇴실/얼리/메모)을 확인해 주세요!

🔗 청소 목록 확인: ${typeof window !== 'undefined' ? window.location.origin : ''}/cleaning
깨끗하고 안전한 청소 부탁드립니다. 감사합니다. 🙏`;

        if (navigator.share) {
            navigator.share({
                title: '[청소 배정 안내]',
                text: shareText,
            }).catch(() => { });
        } else {
            navigator.clipboard.writeText(shareText);
            alert('청소 배정 안내 텍스트가 복사되었습니다! 카카오톡에 붙여넣기(Ctrl+V)하세요.');
        }
    };

    return (
        <div className="p-3.5 bg-slate-900 text-white rounded-xl shadow-md flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
            {/* 1. 좌측 안내 문구 */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
                <span className="text-xl">💬</span>
                <div className="flex flex-col">
                    <h3 className="text-xs md:text-sm font-black text-yellow-400">
                        청소 배정 완료 알림 전송
                    </h3>
                    <span className="text-[11px] text-slate-300 font-bold">
                        {assignedStaffs.length > 0 ? (
                            <>배정된 스태프: <strong className="text-white">{assignedStaffs.join(', ')}</strong> (총 {totalAssignedRooms}곳)</>
                        ) : (
                            '호실에 담당자를 배정하면 원터치로 카톡 알림을 보낼 수 있습니다.'
                        )}
                    </span>
                </div>
            </div>

            {/* 2. 우측 단일 원터치 전송 버튼 */}
            <button
                type="button"
                onClick={handleShareNotice}
                disabled={totalAssignedRooms === 0}
                className={`w-full md:w-auto px-4 py-2.5 rounded-lg font-black text-xs md:text-sm transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${totalAssignedRooms > 0
                    ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-900 active:scale-95'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
            >
                <span>💬</span>
                <span>청소 배정 알림 카톡 보내기</span>
            </button>
        </div>
    );
}