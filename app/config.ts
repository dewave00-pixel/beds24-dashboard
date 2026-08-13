import { PropertyGroup } from './types';

// 7개 숙소 및 세부 호실 매핑 표
export const PROPERTY_GROUPS: PropertyGroup[] = [
    {
        name: 'Green',
        themeClass: 'bg-theme-green',
        units: [
            { key: '560097', roomId: 560097, displayName: '4층' },
            { key: '560093', roomId: 560093, displayName: '3층' },
        ],
    },
    {
        name: 'Namsun',
        themeClass: 'bg-theme-namsun',
        units: [
            { key: '560157', roomId: 560157, displayName: '1층' },
            { key: '557426', roomId: 557426, displayName: '2층' },
            { key: '560162-1', roomId: 560162, unitId: 1, displayName: '1호', subName: 'mini 1' },
            { key: '560162-2', roomId: 560162, unitId: 2, displayName: '4호', subName: 'mini 1' },
            { key: '560163-1', roomId: 560163, unitId: 1, displayName: '2호', subName: 'mini 2' },
            { key: '560163-2', roomId: 560163, unitId: 2, displayName: '3호', subName: 'mini 2' },
        ],
    },
    {
        name: 'WAVE A',
        themeClass: 'bg-theme-wavea',
        units: [
            { key: '563864-1', roomId: 563864, unitId: 1, displayName: '401호' },
            { key: '563864-2', roomId: 563864, unitId: 2, displayName: '501호' },
        ],
    },
    {
        name: 'WAVE B',
        themeClass: 'bg-theme-waveb',
        units: [
            { key: '563881-1', roomId: 563881, unitId: 1, displayName: '402호' },
            { key: '563881-2', roomId: 563881, unitId: 2, displayName: '502호' },
        ],
    },
    {
        name: 'WAVE C',
        themeClass: 'bg-theme-wavec',
        units: [
            { key: '563954-1', roomId: 563954, unitId: 1, displayName: '403호' },
            { key: '563954-2', roomId: 563954, unitId: 2, displayName: '503호' },
        ],
    },
    {
        name: 'WAVE D',
        themeClass: 'bg-theme-waved',
        units: [
            { key: '564027-1', roomId: 564027, unitId: 1, displayName: '404호' },
            { key: '564027-2', roomId: 564027, unitId: 2, displayName: '504호' },
        ],
    },
    {
        name: 'YEONNAM (쓰리룸)',
        themeClass: 'bg-theme-yeonnam',
        units: [
            { key: '559985-1', roomId: 559985, unitId: 1, displayName: '101호' },
            { key: '559985-2', roomId: 559985, unitId: 2, displayName: '201호' },
        ],
    },
    {
        name: 'YEONNAM (투룸)',
        themeClass: 'bg-theme-yeonnam',
        units: [
            { key: '560113-1', roomId: 560113, unitId: 1, displayName: '202호' },
            { key: '560113-2', roomId: 560113, unitId: 2, displayName: '102호' },
        ],
    },
    {
        name: 'YEONNAM (포룸)',
        themeClass: 'bg-theme-yeonnam',
        units: [
            { key: '560115-1', roomId: 560115, unitId: 1, displayName: '301호' },
        ],
    },
];

// 화면에 나열할 전체 호실 목록 평탄화
export const ALL_UNITS = PROPERTY_GROUPS.flatMap((group) =>
    group.units.map((unit) => ({
        ...unit,
        propName: group.name,
        themeClass: group.themeClass,
    }))
);

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