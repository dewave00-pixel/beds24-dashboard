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
}

// 세부 호실/유닛 정보 구조 정의
export interface UnitConfig {
    key: string;
    unitKey?: string; // 📌 호실 고유 식별자 표준 키 (key와 동일한 값 보장)
    roomId: number;
    unitId?: number;
    propName?: string;
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