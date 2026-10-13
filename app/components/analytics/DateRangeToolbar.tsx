'use client';

import React from 'react';
import { TimeFilterRange } from '../../utils/analyticsCalculations';

export type StepperMode = 'day' | 'week' | 'month' | '3months' | '6months' | 'custom';

interface DateRangeToolbarProps {
    startDate: string;
    endDate: string;
    onChangeRange: (start: string, end: string, filterMode: TimeFilterRange) => void;
    currentFilter?: TimeFilterRange;
    title?: string;
    embedded?: boolean;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseDateStr(str: string): Date {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export default function DateRangeToolbar({
    startDate,
    endDate,
    onChangeRange,
    title,
    embedded = false,
}: DateRangeToolbarProps) {
    const [mode, setMode] = React.useState<StepperMode>(() => {
        if (startDate === endDate) return 'day';
        return 'month';
    });

    const todayStr = React.useMemo(() => formatDateStr(new Date()), []);
    const isToday = startDate === todayStr && endDate === todayStr;

    const handleSwitchMode = (newMode: StepperMode) => {
        setMode(newMode);
        const now = new Date();

        if (newMode === 'day') {
            const today = formatDateStr(now);
            onChangeRange(today, today, 'custom');
        } else if (newMode === 'week') {
            const dayOfWeek = now.getDay();
            const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const mon = new Date(now);
            mon.setDate(now.getDate() + diffToMon);
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);
            onChangeRange(formatDateStr(mon), formatDateStr(sun), 'last7');
        } else if (newMode === 'month') {
            const y = now.getFullYear();
            const m = now.getMonth();
            const first = new Date(y, m, 1);
            const last = new Date(y, m + 1, 0);
            onChangeRange(formatDateStr(first), formatDateStr(last), 'thisMonth');
        } else if (newMode === '3months') {
            // 📅 3개월: 기준 월 포함 직전 3개월 (m-2월 1일 ~ m월 말일)
            const y = now.getFullYear();
            const m = now.getMonth();
            const first = new Date(y, m - 2, 1);
            const last = new Date(y, m + 1, 0);
            onChangeRange(formatDateStr(first), formatDateStr(last), 'custom');
        } else if (newMode === '6months') {
            // 📅 6개월: 기준 월 포함 직전 6개월 (m-5월 1일 ~ m월 말일)
            const y = now.getFullYear();
            const m = now.getMonth();
            const first = new Date(y, m - 5, 1);
            const last = new Date(y, m + 1, 0);
            onChangeRange(formatDateStr(first), formatDateStr(last), 'custom');
        } else if (newMode === 'custom') {
            onChangeRange(startDate, endDate, 'custom');
        }
    };

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
            const y = s.getFullYear();
            const m = s.getMonth();
            const prevFirst = new Date(y, m - 1, 1);
            const prevLast = new Date(y, m, 0);
            onChangeRange(formatDateStr(prevFirst), formatDateStr(prevLast), 'custom');
        } else if (mode === '3months') {
            const s = parseDateStr(startDate);
            const y = s.getFullYear();
            const m = s.getMonth();
            const prevFirst = new Date(y, m - 3, 1);
            const prevLast = new Date(y, m, 0);
            onChangeRange(formatDateStr(prevFirst), formatDateStr(prevLast), 'custom');
        } else if (mode === '6months') {
            const s = parseDateStr(startDate);
            const y = s.getFullYear();
            const m = s.getMonth();
            const prevFirst = new Date(y, m - 6, 1);
            const prevLast = new Date(y, m, 0);
            onChangeRange(formatDateStr(prevFirst), formatDateStr(prevLast), 'custom');
        }
    };

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
        } else if (mode === '3months') {
            const s = parseDateStr(startDate);
            const y = s.getFullYear();
            const m = s.getMonth();
            const nextFirst = new Date(y, m + 3, 1);
            const nextLast = new Date(y, m + 6, 0);
            onChangeRange(formatDateStr(nextFirst), formatDateStr(nextLast), 'custom');
        } else if (mode === '6months') {
            const s = parseDateStr(startDate);
            const y = s.getFullYear();
            const m = s.getMonth();
            const nextFirst = new Date(y, m + 6, 1);
            const nextLast = new Date(y, m + 12, 0);
            onChangeRange(formatDateStr(nextFirst), formatDateStr(nextLast), 'custom');
        }
    };

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
        } else if (mode === '3months') {
            const y = now.getFullYear();
            const m = now.getMonth();
            const first = new Date(y, m - 2, 1);
            const last = new Date(y, m + 1, 0);
            onChangeRange(formatDateStr(first), formatDateStr(last), 'custom');
        } else if (mode === '6months') {
            const y = now.getFullYear();
            const m = now.getMonth();
            const first = new Date(y, m - 5, 1);
            const last = new Date(y, m + 1, 0);
            onChangeRange(formatDateStr(first), formatDateStr(last), 'custom');
        } else {
            const today = formatDateStr(now);
            onChangeRange(today, today, 'custom');
        }
    };

    const centerDateLabel = React.useMemo(() => {
        if (mode === 'day') {
            const d = parseDateStr(startDate);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const day = d.getDate();
            const dayName = DAY_NAMES[d.getDay()];
            return `${y}년 ${m}월 ${day}일 (${dayName})`;
        }
        if (mode === 'week') {
            const s = parseDateStr(startDate);
            const e = parseDateStr(endDate);
            return `${s.getMonth() + 1}/${s.getDate()} ~ ${e.getMonth() + 1}/${e.getDate()} (주간)`;
        }
        if (mode === 'month') {
            const s = parseDateStr(startDate);
            return `${s.getFullYear()}년 ${s.getMonth() + 1}월`;
        }
        if (mode === '3months') {
            const s = parseDateStr(startDate);
            const e = parseDateStr(endDate);
            return `${s.getFullYear()}년 ${s.getMonth() + 1}월 ~ ${e.getMonth() + 1}월 (3개월)`;
        }
        if (mode === '6months') {
            const s = parseDateStr(startDate);
            const e = parseDateStr(endDate);
            return `${s.getFullYear()}년 ${s.getMonth() + 1}월 ~ ${e.getMonth() + 1}월 (6개월)`;
        }
        return `${startDate} ~ ${endDate}`;
    }, [mode, startDate, endDate]);

    return (
        <div
            className={
                embedded
                    ? 'flex flex-wrap items-center justify-between gap-2.5 w-full'
                    : 'bg-white dark:bg-slate-900 p-2.5 md:p-3 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-2.5 w-full'
            }
        >
            {/* 좌측: 타이틀(선택 시) 및 모드 전환 버튼들 */}
            <div className="flex items-center gap-2 flex-wrap">
                {title && (
                    <span className="text-xs font-extrabold text-gray-800 dark:text-slate-200 mr-1 hidden sm:inline">
                        {title}
                    </span>
                )}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('day')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            mode === 'day' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        일간
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('week')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            mode === 'week' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        주간
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('month')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            mode === 'month' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        월간
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('3months')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            mode === '3months' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        3개월
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('6months')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            mode === '6months' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        6개월
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('custom')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            mode === 'custom' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        직접 설정
                    </button>
                </div>
            </div>

            {/* 우측: 빠른 스텝퍼(◀ / 날짜 / ▶) 또는 달력 인풋 */}
            <div className="flex items-center gap-2 flex-wrap ml-auto">
                {mode !== 'custom' ? (
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={handlePrev}
                            className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 font-bold text-xs rounded-lg border border-gray-200 dark:border-slate-700 shadow-2xs transition cursor-pointer active:scale-95"
                        >
                            ◀ 이전
                        </button>
                        <span className="px-2 text-xs font-extrabold text-gray-900 dark:text-slate-100 font-mono tracking-tight text-center min-w-[130px]">
                            {centerDateLabel}
                        </span>
                        <button
                            type="button"
                            onClick={handleNext}
                            className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 font-bold text-xs rounded-lg border border-gray-200 dark:border-slate-700 shadow-2xs transition cursor-pointer active:scale-95"
                        >
                            다음 ▶
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800 p-1 px-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => onChangeRange(e.target.value, endDate, 'custom')}
                            className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-md text-xs font-bold text-gray-900 dark:text-slate-100 cursor-pointer font-mono"
                        />
                        <span className="text-gray-400 dark:text-slate-500">~</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => onChangeRange(startDate, e.target.value, 'custom')}
                            className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-md text-xs font-bold text-gray-900 dark:text-slate-100 cursor-pointer font-mono"
                        />
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleGoToday}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        isToday
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-extrabold'
                            : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                >
                    오늘
                </button>
            </div>
        </div>
    );
}
