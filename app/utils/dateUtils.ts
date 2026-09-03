/**
 * 🕒 한국 표준시 (KST, Asia/Seoul) 전용 날짜 유틸리티 모듈
 * 
 * Vercel(UTC 환경) 및 클라이언트 브라우저 환경에 관계없이
 * 항상 정확한 대한민국(KST, UTC+9) 기준 날짜를 계산하고 포맷팅합니다.
 */

// 캐시된 KST 날짜 포맷터 (en-CA 로케일은 'YYYY-MM-DD' 표준 형식을 반환)
const kstFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/**
 * 📌 임의의 Date 객체를 한국 시간(KST) 기준 'YYYY-MM-DD' 문자열로 변환
 */
export function formatKSTDate(date: Date = new Date()): string {
    return kstFormatter.format(date);
}

/**
 * 📌 오늘 날짜를 한국 시간(KST) 기준 'YYYY-MM-DD' 문자열로 반환
 */
export function getKSTTodayStr(): string {
    return formatKSTDate(new Date());
}

/**
 * 📌 내일 날짜를 한국 시간(KST) 기준 'YYYY-MM-DD' 문자열로 반환
 */
export function getKSTTomorrowStr(): string {
    const d = new Date();
    // 현재 KST 시각 기준 하루 추가
    d.setDate(d.getDate() + 1);
    return formatKSTDate(d);
}

/**
 * 📌 특정 날짜 문자열(YYYY-MM-DD)에 일수를 더하거나 빼기
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return formatKSTDate(date);
}

/**
 * 📌 오늘 KST 기준 n일 전/후의 Date 객체 생성 (기본값: 이틀 전)
 */
export function getKSTDateOffset(offsetDays: number): Date {
    const todayStr = getKSTTodayStr();
    const [y, m, d] = todayStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + offsetDays);
    return date;
}

/**
 * ⏰ 다음 자정(00:00:01 KST)까지 남은 밀리초(ms) 계산
 * 
 * 23:59 ➔ 00:00으로 넘어갈 때 정밀하게 갱신 타이머를 구동하기 위해 사용
 */
export function getMsUntilNextMidnightKST(): number {
    const now = new Date();
    // 한국 시간 기준 현재 시/분/초 구하기
    const kstTimeParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    }).formatToParts(now);

    let hour = 0, minute = 0, second = 0;
    for (const part of kstTimeParts) {
        if (part.type === 'hour') hour = Number(part.value) % 24;
        if (part.type === 'minute') minute = Number(part.value);
        if (part.type === 'second') second = Number(part.value);
    }

    const secondsPassedToday = hour * 3600 + minute * 60 + second;
    const secondsInDay = 86400; // 24 * 3600
    const secondsUntilMidnight = secondsInDay - secondsPassedToday;

    // 자정 정각 직후 1초(00:00:01)에 안전하게 트리거되도록 1500ms 버퍼 추가
    return Math.max(1000, secondsUntilMidnight * 1000 + 1500);
}

/**
 * 📌 ISO 문자열 또는 날짜 문자열을 한국 시간(KST, UTC+9) 기준 'YYYY.MM.DD HH:mm' 형식으로 변환
 * 예: '2026-09-01T08:39:14Z' ➔ '2026.09.01 17:39'
 */
export function formatKSTDateTime(dateTimeStr?: string | null): string {
    if (!dateTimeStr) return '';
    try {
        const date = new Date(dateTimeStr);
        if (isNaN(date.getTime())) {
            return dateTimeStr;
        }

        const parts = new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(date);

        let y = '', m = '', d = '', h = '', min = '';
        for (const p of parts) {
            if (p.type === 'year') y = p.value;
            if (p.type === 'month') m = p.value;
            if (p.type === 'day') d = p.value;
            if (p.type === 'hour') h = p.value;
            if (p.type === 'minute') min = p.value;
        }

        if (!y || !m || !d) return dateTimeStr;
        return `${y}.${m}.${d} ${h}:${min}`;
    } catch {
        return dateTimeStr;
    }
}
