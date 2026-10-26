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
    price?: number;
    notes?: string;
    bookingTime?: string;
    country?: string;
    lang?: string;
    phone?: string;
    mobile?: string;
}

// 세부 호실/유닛 정보 구조 정의
export interface UnitConfig {
    key: string;
    unitKey?: string; // 📌 호실 고유 식별자 표준 키 (key와 동일한 값 보장)
    roomId: number;
    unitId?: number;
    propName?: string;
    themeClass?: string;
    displayName: string;
    subName?: string;
}
// 숙소 그룹 구조 정의
export interface PropertyGroup {
    name: string;
    themeClass: string;
    units: UnitConfig[];
}

//  배정 데이터 모델
export interface CleaningAssignment {
    unitKey: string;     // 📌 호실 고유 키 (예: 'yeonnam_101')
    staffName: string;   // 👤 담당자 이름 (예: '이모님A')
    staffId: string;     // 🔑 계정 매칭용 권한 아이디 (예: 'staff_1')
    assignedAt: string;  // 🕒 배정 시각 (예: '14:25')
    isCompleted?: boolean; // ✅ 청소 완료 여부
    completedAt?: string;  // 🕒 청소 완료 시각 (예: '14:50')
}

// OTA별 현재 광고 책정값 (참고용이며 매출 자동 차감 대상이 아님)
export interface OtaAdSetting {
    apiSourceId: number;
    channelName: string;
    cpcAmount: number | null;
    cpbRate: number | null;
    note: string;
    updatedAt: string;
}

// 실제 결제된 OTA 광고비 원장 (현재는 Trip.com 선충전 내역)
export interface OtaAdCharge {
    id: string;
    apiSourceId: number;
    channelName: string;
    chargeDate: string;
    amount: number;
    note: string;
    createdAt: string;
}

// 🔒 Beds24 재고 마감/초과 점검 항목 인터페이스
export interface InventoryIssueItem {
    id: string; // `${unit.key}_${dStr}`
    dateStr: string;
    unitKey: string;
    propName: string;
    displayName: string;
    subName?: string;
    roomId: number;
    unitId?: number;
    themeClass: string;
    numAvail: number;
    price: number;
    issueType: 'overbooked' | 'zero_inventory' | 'reduced_inventory';
    vacantIndex: number;
    vacantCount: number;
    totalUnits: number;
}
