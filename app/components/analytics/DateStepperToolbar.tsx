'use client';

import React from 'react';
import { TimeFilterRange } from '../../utils/analyticsCalculations';

export type StepperMode = 'day' | 'week' | 'month' | 'custom';

interface DateStepperToolbarProps {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    onChangeRange: (start: string, end: string, filterMode: TimeFilterRange) => void;
    currentFilter: TimeFilterRange;
}

// 요일 한글 표기 (0: 일요일, 1: 월요일, ...)
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// 헬퍼: Date 객체를 YYYY-MM-DD 문자열로 변환 (로컬 타임존 기준)
function formatDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// 헬퍼: YYYY-MM-DD 문자열을 로컬 Date 객체로 파싱
function parseDateStr(str: string): Date {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export default function DateStepperToolbar({
    startDate,
    endDate,
    onChangeRange,
    currentFilter,
}: DateStepperToolbarProps) {
    // 현재 선택된 모드 파악
    const [mode, setMode] = React.useState<StepperMode>(() => {
        if (startDate === endDate) return 'day';
        if (currentFilter === 'custom') return 'custom';
        return 'month';
    });

    const todayStr = React.useMemo(() => formatDateStr(new Date()), []);
    const isSingleDay = startDate === endDate;
    const isToday = startDate === todayStr && endDate === todayStr;

    // 모드 전환 핸들러
    const handleSwitchMode = (newMode: StepperMode) => {
        setMode(newMode);
        const now = new Date();

        if (newMode === 'day') {
            const today = formatDateStr(now);
            onChangeRange(today, today, 'custom');
        } else if (newMode === 'week') {
            // 이번 주 (월요일 시작 ~ 일요일 종료)
            const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)
            const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const mon = new Date(now);
            mon.setDate(now.getDate() + diffToMon);
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);
            onChangeRange(formatDateStr(mon), formatDateStr(sun), 'last7');
        } else if (newMode === 'month') {
            // 이번 달 (1일 ~ 말일)
            const y = now.getFullYear();
            const m = now.getMonth();
            const first = new Date(y, m, 1);
            const last = new Date(y, m + 1, 0);
            onChangeRange(formatDateStr(first), formatDateStr(last), 'thisMonth');
        } else if (newMode === 'custom') {
            onChangeRange(startDate, endDate, 'custom');
        }
    };

    // 이전(◀) 이동
    const handlePrev = () => {
        if (mode === 'day') {
            const current = parseDateStr(startDate);
            current.setDate(current.getDate() - 1);
            const prevStr = formatDateStr(current);
            onChangeRange(prevStr, prevStr, 'custom');
        } else if (mode === 'week') {
            const s = parseDateStr(startDate);
            const e = parseDateStr(endDate);
            s.setDate(s.getDate() - 7);
            e.setDate(e.getDate() - 7);
            onChangeRange(formatDateStr(s), formatDateStr(e), 'custom');
        } else if (mode === 'month') {
            const s = parseDateStr(startDate);
            // 전달 1일 ~ 말일
            const y = s.getFullYear();
            const m = s.getMonth();
            const prevFirst = new Date(y, m - 1, 1);
            const prevLast = new Date(y, m, 0);
            onChangeRange(formatDateStr(prevFirst), formatDateStr(prevLast), 'custom');
        }
    };

    // 다음(▶) 이동
    const handleNext = () => {
        if (mode === 'day') {
            const current = parseDateStr(startDate);
            current.setDate(current.getDate() + 1);
            const nextStr = formatDateStr(current);
            onChangeRange(nextStr, nextStr, 'custom');
        } else if (mode === 'week') {
            const s = parseDateStr(startDate);
            const e = parseDateStr(endDate);
            s.setDate(s.getDate() + 7);
            e.setDate(e.getDate() + 7);
            onChangeRange(formatDateStr(s), formatDateStr(e), 'custom');
        } else if (mode === 'month') {
            const s = parseDateStr(startDate);
            const y = s.getFullYear();
            const m = s.getMonth();
            const nextFirst = new Date(y, m + 1, 1);
            const nextLast = new Date(y, m + 2, 0);
            onChangeRange(formatDateStr(nextFirst), formatDateStr(nextLast), 'custom');
        }
    };

    // 오늘로 즉시 복귀
    const handleGoToday = () => {
        const now = new Date();
        if (mode === 'day') {
            const today = formatDateStr(now);
            onChangeRange(today, today, 'custom');
        } else if (mode === 'week') {
            const dayOfWeek = now.getDay();
            const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const mon = new Date(now);
            mon.setDate(now.getDate() + diffToMon);
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);
            onChangeRange(formatDateStr(mon), formatDateStr(sun), 'last7');
        } else if (mode === 'month') {
            const y = now.getFullYear();
            const m = now.getMonth();
            const first = new Date(y, m, 1);
            const last = new Date(y, m + 1, 0);
            onChangeRange(formatDateStr(first), formatDateStr(last), 'thisMonth');
        } else {
            const today = formatDateStr(now);
            onChangeRange(today, today, 'custom');
        }
    };

    // 현재 선택된 날짜 레이블 생성
    const centerDateLabel = React.useMemo(() => {
        if (mode === 'day') {
            const d = parseDateStr(startDate);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const day = d.getDate();
            const dayName = DAY_NAMES[d.getDay()];
            const isTodayDate = startDate === todayStr;
            return {
                title: `${y}년 ${m}월 ${day}일 (${dayName})`,
                badge: isTodayDate ? '오늘' : undefined,
            };
        }
        if (mode === 'week') {
            const s = parseDateStr(startDate);
            const e = parseDateStr(endDate);
            return {
                title: `${s.getMonth() + 1}/${s.getDate()} ~ ${e.getMonth() + 1}/${e.getDate()}`,
                badge: '주간 (7일)',
            };
        }
        if (mode === 'month') {
            const s = parseDateStr(startDate);
            const y = s.getFullYear();
            const m = s.getMonth() + 1;
            return {
                title: `${y}년 ${m}월`,
                badge: '월간 전체',
            };
        }
        // custom
        return {
            title: `${startDate} ~ ${endDate}`,
            badge: '직접 선택',
        };
    }, [mode, startDate, endDate, todayStr]);

    // 이전/다음 버튼 레이블 힌트
    const prevButtonLabel = mode === 'day' ? '◀ 전날' : mode === 'week' ? '◀ 지난 주' : mode === 'month' ? '◀ 지난 달' : '◀ 이전';
    const nextButtonLabel = mode === 'day' ? '다음날 ▶' : mode === 'week' ? '다음 주 ▶' : mode === 'month' ? '다음 달 ▶' : '다음 ▶';

    return (
        <div className="bg-white p-3 md:p-3.5 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-2.5">
            {/* 상단 1열: 단위 선택 모드 탭 & 빠른 오늘 버튼 */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('day')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            mode === 'day'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        일간 (오늘/하루)
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('week')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            mode === 'week'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        주간 (7일)
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('month')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            mode === 'month'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        월간 (한달)
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('custom')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            mode === 'custom'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        직접 설정 (달력)
                    </button>
                </div>

                {/* 오늘 바로가기 버튼 */}
                <button
                    type="button"
                    onClick={handleGoToday}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                        isToday
                            ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    <span>오늘 기준</span>
                </button>
            </div>

            {/* 하단 2열: ◀ / ▶ 초고속 스텝퍼 내비게이션 컨트롤러 */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                {mode !== 'custom' ? (
                    <div className="flex items-center justify-between w-full sm:w-auto gap-2 bg-gray-50/80 p-1.5 rounded-xl border border-gray-200">
                        {/* 이전 이동 버튼 */}
                        <button
                            type="button"
                            onClick={handlePrev}
                            className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 font-bold text-xs rounded-lg border border-gray-200 shadow-2xs transition cursor-pointer active:scale-95 flex items-center gap-1"
                            title={prevButtonLabel}
                        >
                            <span>{prevButtonLabel}</span>
                        </button>

                        {/* 현재 선택 날짜 디스플레이 */}
                        <div className="px-3 py-1 flex items-center gap-2 text-center min-w-[160px] justify-center">
                            <span className="text-sm font-extrabold text-gray-900 font-mono tracking-tight">
                                {centerDateLabel.title}
                            </span>
                            {centerDateLabel.badge && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                    centerDateLabel.badge === '오늘'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                    {centerDateLabel.badge}
                                </span>
                            )}
                        </div>

                        {/* 다음 이동 버튼 */}
                        <button
                            type="button"
                            onClick={handleNext}
                            className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 font-bold text-xs rounded-lg border border-gray-200 shadow-2xs transition cursor-pointer active:scale-95 flex items-center gap-1"
                            title={nextButtonLabel}
                        >
                            <span>{nextButtonLabel}</span>
                        </button>
                    </div>
                ) : (
                    /* 직접 날짜 설정 모드 (달력 Input) */
                    <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-1.5 px-3 rounded-xl border border-gray-200 text-xs font-bold w-full sm:w-auto">
                        <span className="text-gray-600 font-bold">시작일:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => onChangeRange(e.target.value, endDate, 'custom')}
                            className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900 cursor-pointer font-mono shadow-2xs"
                        />
                        <span className="text-gray-400 font-bold">~</span>
                        <span className="text-gray-600 font-bold">종료일:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => onChangeRange(startDate, e.target.value, 'custom')}
                            className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900 cursor-pointer font-mono shadow-2xs"
                        />
                    </div>
                )}

                {/* 현재 적용된 기간 안내 뱃지 */}
                <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 ml-auto">
                    <span>조회 범위:</span>
                    <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">
                        {startDate} ~ {endDate}
                    </span>
                </div>
            </div>
        </div>
    );
}
