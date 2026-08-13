// 예약 데이터 구조 정의
export interface Booking {
    id: number;
    firstName?: string;
    lastName?: string;
    arrival: string;
    departure: string;
    numAdult?: number;
    numChild?: number;
    status?: string;
    propId?: number;
    propertyId?: number;
    roomId?: number;
    unitId?: number;
    apiSourceId?: number;
    notes?: string;
}

// 세부 호실/유닛 정보 구조 정의
export interface UnitConfig {
    key: string;
    roomId: number;
    unitId?: number;
    displayName: string;
    subName?: string;
}

// 숙소 그룹 구조 정의
export interface PropertyGroup {
    name: string;
    themeClass: string;
    units: UnitConfig[];
}