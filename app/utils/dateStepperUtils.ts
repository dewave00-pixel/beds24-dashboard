// 📅 날짜 스텝퍼(일/주/월 전·후 이동) 및 기간 동기화 순수 유틸리티

export type StepperMode = 'day' | 'week' | 'month' | 'custom';
export type StepDirection = 'prev' | 'next';

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * Date 객체를 로컬 타임존(KST 등) 기준 YYYY-MM-DD 문자열로 변환
 */
export function formatDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * YYYY-MM-DD 문자열을 로컬 Date 객체로 파싱
 */
export function parseDateStr(str: string): Date {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/**
 * 프리셋 모드(일/주/월/오늘)에 해당하는 시작일과 종료일 계산
 */
export function getPresetPeriod(mode: StepperMode, baseDate: Date = new Date()): { start: string; end: string } {
    const now = new Date(baseDate);

    if (mode === 'day') {
        const todayStr = formatDateStr(now);
        return { start: todayStr, end: todayStr };
    }

    if (mode === 'week') {
        // 이번 주 (월요일 시작 ~ 일요일 종료)
        const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const mon = new Date(now);
        mon.setDate(now.getDate() + diffToMon);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return { start: formatDateStr(mon), end: formatDateStr(sun) };
    }

    if (mode === 'month') {
        // 이번 달 (1일 ~ 말일)
        const y = now.getFullYear();
        const m = now.getMonth();
        const first = new Date(y, m, 1);
        const last = new Date(y, m + 1, 0);
        return { start: formatDateStr(first), end: formatDateStr(last) };
    }

    const todayStr = formatDateStr(now);
    return { start: todayStr, end: todayStr };
}

/**
 * ◀ / ▶ 스텝퍼 이동: 현재 기간에서 mode(일/주/월) 및 direction(prev/next)에 맞춰 전/후 기간 반환
 */
export function stepPeriod(
    startStr: string,
    endStr: string,
    mode: StepperMode,
    direction: StepDirection
): { start: string; end: string } {
    const delta = direction === 'next' ? 1 : -1;

    if (mode === 'day') {
        const current = parseDateStr(startStr);
        current.setDate(current.getDate() + delta);
        const nextStr = formatDateStr(current);
        return { start: nextStr, end: nextStr };
    }

    if (mode === 'week') {
        const s = parseDateStr(startStr);
        const e = parseDateStr(endStr);
        s.setDate(s.getDate() + delta * 7);
        e.setDate(e.getDate() + delta * 7);
        return { start: formatDateStr(s), end: formatDateStr(e) };
    }

    if (mode === 'month') {
        const s = parseDateStr(startStr);
        const y = s.getFullYear();
        const m = s.getMonth();
        // 이전 달 또는 다음 달의 1일 ~ 말일
        const targetFirst = new Date(y, m + delta, 1);
        const targetLast = new Date(y, m + delta + 1, 0);
        return { start: formatDateStr(targetFirst), end: formatDateStr(targetLast) };
    }

    // custom 모드일 경우: 시작일과 종료일 간격(일수)만큼 통째로 이동
    const s = parseDateStr(startStr);
    const e = parseDateStr(endStr);
    const diffDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    s.setDate(s.getDate() + delta * diffDays);
    e.setDate(e.getDate() + delta * diffDays);
    return { start: formatDateStr(s), end: formatDateStr(e) };
}

/**
 * A기간에 상응하는 직전 비교 기간 B (동일한 일수만큼 직전 기간) 산출
 * 예:
 * - A가 10.08 ~ 10.14 (7일) -> B는 10.01 ~ 10.07 (7일)
 * - A가 10.01 ~ 10.31 (31일) -> B는 09.01 ~ 09.30 (30일 - 전월 말일 기준)
 */
export function getPreviousEquivalentPeriod(
    startStr: string,
    endStr: string,
    mode?: StepperMode
): { start: string; end: string } {
    const s = parseDateStr(startStr);
    const e = parseDateStr(endStr);

    // 1. 해당 월 1일 ~ 말일인 전체 월간 조회(Full Month) 감지 시: 정확한 직전 달 1일 ~ 말일 반환 (예: 10/01~10/31 -> 09/01~09/30)
    const isFirstDay = s.getDate() === 1;
    const isSameYearMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
    const lastDayOfMonth = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
    const isLastDay = e.getDate() === lastDayOfMonth;

    if (mode === 'month' || (isFirstDay && isSameYearMonth && isLastDay)) {
        const prevFirst = new Date(s.getFullYear(), s.getMonth() - 1, 1);
        const prevLast = new Date(s.getFullYear(), s.getMonth(), 0);
        return { start: formatDateStr(prevFirst), end: formatDateStr(prevLast) };
    }

    // 2. 그 외 일반 기간: 동일한 일수(N일)만큼 직전 기간 산출
    const diffDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const prevEnd = new Date(s);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (diffDays - 1));

    return { start: formatDateStr(prevStart), end: formatDateStr(prevEnd) };
}

/**
 * 📅 전년 동기(YoY, 1년 전 동일 기간) 산출
 * - A가 2026-10-01 ~ 2026-10-31 (10월 전체) -> B는 2025-10-01 ~ 2025-10-31
 * - 만약 윤년 2월 29일인 경우 전년도 2월 28일로 안전하게 보정
 */
export function getPreviousYearEquivalentPeriod(
    startStr: string,
    endStr: string
): { start: string; end: string } {
    const s = parseDateStr(startStr);
    const e = parseDateStr(endStr);

    const isFirstDay = s.getDate() === 1;
    const isSameYearMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
    const lastDayOfMonth = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
    const isLastDay = e.getDate() === lastDayOfMonth;

    // 월간 전체 조회인 경우 말일 보정 (예: 윤년 2/29 -> 평년 2/28)
    if (isFirstDay && isSameYearMonth && isLastDay) {
        const pyLastDay = new Date(s.getFullYear() - 1, s.getMonth() + 1, 0);
        return {
            start: formatDateStr(new Date(s.getFullYear() - 1, s.getMonth(), 1)),
            end: formatDateStr(pyLastDay),
        };
    }

    const prevYearStart = new Date(s.getFullYear() - 1, s.getMonth(), s.getDate());
    const prevYearEnd = new Date(e.getFullYear() - 1, e.getMonth(), e.getDate());

    return { start: formatDateStr(prevYearStart), end: formatDateStr(prevYearEnd) };
}


/**
 * 상단 툴바에 표시할 친절한 날짜 및 뱃지 레이블 생성
 */
export function formatPeriodDisplayLabel(
    startStr: string,
    endStr: string,
    mode: StepperMode
): { title: string; badge?: string } {
    const todayStr = formatDateStr(new Date());

    if (mode === 'day') {
        const d = parseDateStr(startStr);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const dayName = DAY_NAMES[d.getDay()];
        const isTodayDate = startStr === todayStr;
        return {
            title: `${y}년 ${m}월 ${day}일 (${dayName})`,
            badge: isTodayDate ? '오늘' : undefined,
        };
    }

    if (mode === 'week') {
        const s = parseDateStr(startStr);
        const e = parseDateStr(endStr);
        return {
            title: `${s.getFullYear()}.${s.getMonth() + 1}.${s.getDate()} ~ ${e.getMonth() + 1}.${e.getDate()}`,
            badge: '주간 (7일)',
        };
    }

    if (mode === 'month') {
        const s = parseDateStr(startStr);
        return {
            title: `${s.getFullYear()}년 ${s.getMonth() + 1}월`,
            badge: '월간 전체',
        };
    }

    return {
        title: `${startStr} ~ ${endStr}`,
        badge: '직접 선택',
    };
}
