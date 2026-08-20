import type { UnitConfig, PropertyGroup } from './types';


// 4대 실제 숙소 건물(Property) 및 세부 호실 매핑 표
export const PROPERTY_GROUPS: PropertyGroup[] = [
    {
        name: 'WAVE',
        themeClass: 'group-theme-wave',
        units: [
            { key: '563864-1', roomId: 563864, unitId: 1, displayName: '401호', subName: 'A' },
            { key: '563864-2', roomId: 563864, unitId: 2, displayName: '501호', subName: 'A' },
            { key: '563881-1', roomId: 563881, unitId: 1, displayName: '402호', subName: 'B' },
            { key: '563881-2', roomId: 563881, unitId: 2, displayName: '502호', subName: 'B' },
            { key: '563954-1', roomId: 563954, unitId: 1, displayName: '403호', subName: 'C' },
            { key: '563954-2', roomId: 563954, unitId: 2, displayName: '503호', subName: 'C' },
            { key: '564027-1', roomId: 564027, unitId: 1, displayName: '404호', subName: 'D' },
            { key: '564027-2', roomId: 564027, unitId: 2, displayName: '504호', subName: 'D' },
        ],
    },
    {
        name: 'YEONNAM',
        themeClass: 'group-theme-yeonnam',
        units: [
            { key: '560113-2', roomId: 560113, unitId: 2, displayName: '102호', subName: '투룸' },
            { key: '560113-1', roomId: 560113, unitId: 1, displayName: '202호', subName: '투룸' },
            { key: '559985-1', roomId: 559985, unitId: 1, displayName: '101호', subName: '쓰리룸' },
            { key: '559985-2', roomId: 559985, unitId: 2, displayName: '201호', subName: '쓰리룸' },
            { key: '560115-1', roomId: 560115, unitId: 1, displayName: '301호', subName: '포룸' },
        ],
    },
    {
        name: 'Green',
        themeClass: 'group-theme-green',
        units: [
            { key: '560093', roomId: 560093, displayName: '3층' },
            { key: '560097', roomId: 560097, displayName: '4층' },
        ],
    },
    {
        name: 'Namsun',
        themeClass: 'group-theme-namsan',
        units: [
            { key: '560162-1', roomId: 560162, unitId: 1, displayName: '1호', subName: 'mini 1' },
            { key: '560162-2', roomId: 560162, unitId: 2, displayName: '4호', subName: 'mini 1' },
            { key: '560163-1', roomId: 560163, unitId: 1, displayName: '2호', subName: 'mini 2' },
            { key: '560163-2', roomId: 560163, unitId: 2, displayName: '3호', subName: 'mini 2' },
            { key: '560157', roomId: 560157, displayName: '5호' },
            { key: '557426', roomId: 557426, displayName: '6호' },
        ],
    },
];

// 화면에 나열할 전체 호실 목록 평탄화
export const ALL_UNITS: UnitConfig[] = PROPERTY_GROUPS.flatMap((group) =>
    group.units.map((unit) => ({
        ...unit,
        propName: group.name,
        themeClass: group.themeClass,
    }))
);

// 🏢 세로 타임라인 Grid Template Columns (건물 사이 16px 독립 구분 기둥 포함)
export const VERTICAL_GRID_COLUMNS = [
    '120px',
    ...PROPERTY_GROUPS.map((g, idx) =>
        `repeat(${g.units.length}, minmax(110px, 1fr))` +
        (idx < PROPERTY_GROUPS.length - 1 ? ' 16px' : '')
    ),
].join(' ');

// 플랫폼별 apiSourceId RGB 색상 매핑 함수
export const getChannelStyle = (apiSourceId?: number) => {
    switch (Number(apiSourceId)) {
        case 46:
            return { name: 'Airbnb', bg: 'rgb(255, 17, 0)', text: '#ffffff' };
        case 53:
            return { name: 'Trip.com', bg: 'rgb(255, 243, 13)', text: '#000000' };
        case 19:
            return { name: 'Booking.com', bg: 'rgb(0, 42, 255)', text: '#ffffff' };
        case 17:
            return { name: 'Agoda', bg: 'rgb(0, 255, 225)', text: '#000000' };
        case 14:
            return { name: 'Expedia', bg: 'rgb(0, 255, 26)', text: '#000000' };
        default:
            return { name: '기타', bg: 'rgb(120, 120, 120)', text: '#ffffff' };
    }
};

// 🇰🇷 주요 공휴일 지정 (YYYY-MM-DD)
export const HOLIDAYS: { [key: string]: string } = {
    '2026-01-01': '신정',
    '2026-02-16': '설날 연휴',
    '2026-02-17': '설날',
    '2026-02-18': '설날 연휴',
    '2026-03-01': '삼일절',
    '2026-05-05': '어린이날',
    '2026-05-24': '부처님오신날',
    '2026-06-06': '현충일',
    '2026-08-15': '광복절',
    '2026-09-24': '추석 연휴',
    '2026-09-25': '추석',
    '2026-09-26': '추석 연휴',
    '2026-10-03': '개천절',
    '2026-10-09': '한글날',
    '2026-12-25': '크리스마스',
};

export type DayType = 'weekday' | 'saturday' | 'sunday' | 'holiday';

// 날짜 문자열(YYYY-MM-DD)을 받아 평일/토요일/일요일/공휴일 구분을 반환하는 함수
export function getDayType(dateStr: string): { type: DayType; label?: string } {
    if (HOLIDAYS[dateStr]) {
        return { type: 'holiday', label: HOLIDAYS[dateStr] };
    }
    const d = new Date(dateStr);
    const day = d.getDay(); // 0: 일, 6: 토
    if (day === 0) return { type: 'sunday' };
    if (day === 6) return { type: 'saturday' };
    return { type: 'weekday' };
}

// 🏷️ 4대 예약 옵션 태그 마스터 정의 (추후 추가/수정 용이)
export interface BookingTagDef {
    key: string;
    label: string;
    shortLabel: string;
    icon: string;
    bgClass: string;
    textClass: string;
}

// 🏷️ 예약 상태 태그 설정 및 시간 옵션 마스터
export const EARLY_CHECKIN_HOURS = ['오후 1시', '오후 2시', '오후 3시', '오후 4시'];
export const LATE_CHECKOUT_HOURS = ['오후 1시', '오후 2시', '오후 3시'];

// 태그 키 문자열을 받아서 대시보드 카드에 노출할 뱃지 정보를 반환하는 모듈 함수
export function parseBookingTag(tagKey: string): { label: string; icon: string } | null {
    // 1. 얼리체크인 (예: early_오후 2시)
    if (tagKey.startsWith('early_')) {
        const timeStr = tagKey.replace('early_', '');
        const simpleTime = timeStr.replace('오후 ', '');
        return { icon: '🕒', label: `${simpleTime} 인` };
    }

    // 2. 레이트체크아웃 (예: late_오후 1시)
    if (tagKey.startsWith('late_')) {
        const timeStr = tagKey.replace('late_', '');
        const simpleTime = timeStr.replace('오후 ', '');
        return { icon: '⏱️', label: `${simpleTime} 아웃` };
    }

    // 3. 청소안함
    if (tagKey === 'no_cleaning') {
        return { icon: '🧹', label: '청소안함' };
    }

    // 4. 수리/점검
    if (tagKey === 'repair') {
        return { icon: '🛠️', label: '수리' };
    }

    return null;
}

// 🏠 표준 호실 및 숙소 그룹 정보 검색 모듈 함수 (고대비 선명 컬러 주입)
export function getUnitDisplayInfo(booking: {
    roomId?: number | string;
    unitId?: number | string;
    propertyId?: number | string;
}): {
    propertyName: string;
    unitDisplayName: string;
    subName?: string;
    themeClass: string;
    badgeStyle: { backgroundColor: string; color: string };
} {
    const bRoomId = Number(booking.roomId);
    const bUnitId = booking.unitId ? Number(booking.unitId) : null;

    // 숙소 그룹별 선명한 고대비 전용 배경색 맵
    const colorMap: { [key: string]: { backgroundColor: string; color: string } } = {
        'group-theme-green': { backgroundColor: '#047857', color: '#000000' }, // 진한 에메랄드 그린
        'group-theme-wave': { backgroundColor: '#0369a1', color: '#000000' },  // 진한 웨이브 블루
        'group-theme-yeonnam': { backgroundColor: '#6d28d9', color: '#000000' }, // 진한 연남 퍼플
        'group-theme-namsan': { backgroundColor: '#b45309', color: '#000000' }, // 진한 남산 앰버
        'group-theme-default': { backgroundColor: '#78aaf1ff', color: '#000000' }, // 다크 슬레이트
    };

    // 1. PROPERTY_GROUPS 순회 매칭
    for (const group of PROPERTY_GROUPS) {
        const matched = group.units.find((u) => {
            const isRoomMatch = u.roomId === bRoomId;
            const isUnitMatch = u.unitId ? (bUnitId !== null ? u.unitId === bUnitId : true) : true;
            return isRoomMatch && isUnitMatch;
        });

        if (matched) {
            return {
                propertyName: group.name,
                unitDisplayName: matched.displayName,
                subName: matched.subName,
                themeClass: group.themeClass,
                badgeStyle: colorMap[group.themeClass] || colorMap['group-theme-default'],
            };
        }
    }

    // 2. 안전 폴백: ALL_UNITS 전체에서 roomId로 재탐색
    const fallback = ALL_UNITS.find((u) => u.roomId === bRoomId);
    if (fallback) {
        const parentGroup = PROPERTY_GROUPS.find((g) => g.units.some((u) => u.key === fallback.key));
        const theme = parentGroup ? parentGroup.themeClass : 'group-theme-default';
        return {
            propertyName: parentGroup ? parentGroup.name : '숙소',
            unitDisplayName: fallback.displayName,
            subName: fallback.subName,
            themeClass: theme,
            badgeStyle: colorMap[theme] || colorMap['group-theme-default'],
        };
    }

    return {
        propertyName: '숙소',
        unitDisplayName: `호실(${bRoomId || '미정'})`,
        themeClass: 'group-theme-default',
        badgeStyle: colorMap['group-theme-default'],
    };
}

// 스태프 4인 계정 및 담당자 이름 매핑 설정
export interface StaffAccount {
    id: string;        // 'staff_1' ~ 'staff_4'
    name: string;      // '이모님A', '이모님B', '삼촌C', '매니저'
}

export const STAFF_ACCOUNTS: StaffAccount[] = [
    { id: 'staff_1', name: '소영매니저님' },
    { id: 'staff_2', name: '가연영님' },
    { id: 'staff_3', name: '지명님' },
    { id: 'staff_4', name: 'ZEAL님' },
];

export function getStaffNameById(staffId: string): string {
    const staff = STAFF_ACCOUNTS.find((s) => s.id === staffId);
    return staff ? staff.name : staffId;
}