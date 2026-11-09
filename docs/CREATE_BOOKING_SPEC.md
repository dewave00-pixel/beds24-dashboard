# 예약 생성 기능 상세 명세 및 구현 계획 (CREATE_BOOKING_SPEC)

## 1. 개요 및 목적

대시보드 운영자(최고관리자)가 플랫폼(OTA)을 거치지 않는 직접 예약(워크인, 전화/문자, 계좌입금 등) 또는 수동 예약 건을 대시보드 화면에서 즉시 Beds24 본사 시스템에 등록하고, Supabase 캐시 DB에 반영하여 타임라인에 실시간으로 표시할 수 있도록 하는 기능이다.

---

## 2. 핵심 운영 정책 및 권한

### 2.1 접근 권한 (Authorization)
- **최고관리자(`admin`) 전용 기능**: 예약 생성 권한은 최고관리자(`admin`)에게만 부여한다.
- **운영매니저(`manager`, `staff_1`) 및 청소 스태프(`staff_2`~`staff_4`) 생성 불가**: 
  - UI 상에서 `admin` 계정일 때만 `+ 새 예약` 버튼을 노출한다.
  - 서버 Route Handler(`/api/bookings/create`)에서도 `auth_role === 'admin'`이 아닌 모든 요청은 즉시 `403 Forbidden`으로 차단한다.

### 2.2 채널 및 수수료율 정책
- **기타 예약건 수수료율 20% 적용**:
  - 기존 `OTHER_CHANNEL_COMMISSION_RATE = 0.20` 정책을 준수한다.
  - 직접 예약(Direct/Manual)을 제외한 기타 비OTA 예약건은 기본 수수료율 20%를 적용하여 정산금 및 매출 통계에 반영한다.
  - OTA 채널(Airbnb 46, Booking.com 19, Trip.com 53 등)의 ID나 수수료율은 임의로 신설하거나 변조하지 않는다.

---

## 3. 사용자 인터페이스 (UI) 및 운영 흐름

### 3.1 모달 진입
- **대시보드 상단 툴바([`DashboardToolbar.tsx`](../app/components/dashboard/DashboardToolbar.tsx))**:
  - `+ 새 예약` 버튼 배치 (admin 전용)
  - **제외 범위**: 빈 타임라인 셀 클릭을 통한 생성은 모바일 터치 및 기존 스크롤/클릭 동작 간섭 방지를 위해 이번 범위에서 제외한다.

### 3.2 입력 폼 필드
1. **숙소 및 호실 선택**:
   - `PROPERTY_GROUPS` 기준 호실 선택 (지점 ➔ 호실 선택)
   - `[미배정 상태로 등록 (호실 나중에 배정)]` 옵션 제공
2. **일정 및 인원**:
   - 체크인 날짜(`arrival`, YYYY-MM-DD)
   - 체크아웃 날짜(`departure`, YYYY-MM-DD)
   - 투숙 인원수(`numAdult`, 기본 1명)
3. **실시간 더블 부킹 충돌 검사**:
   - 배정 호실 선택 시 기존 `findConflictingBookings` 함수를 재사용하여 동일 기간 배정 충돌 시 실시간 경고 배지 노출
   - 미배정 선택 시 특정 호실 점유가 없으므로 충돌 검사 대상에서 제외
4. **게스트 정보**:
   - 게스트 성(Last Name), 이름(First Name), 연락처(Mobile/Phone)
5. **결제 및 채널**:
   - 총 결제 금액(Price, KRW 정수)
   - 예약 구분(직접 예약 / 기타 채널)
6. **특이사항 메모**:
   - 내부 관리자 메모 (`notes`)

---

## 4. Beds24 API V2 신규 생성 계약 및 안전성

### 4.1 Beds24 API 호출 규격
- **엔드포인트**: `POST https://api.beds24.com/v2/bookings`
- **헤더**: `token: {Beds24_Token}`, `Content-Type: application/json`
- **본문**: JSON 배열 형태 `[{ ... }]`
  ```json
  [
    {
      "roomId": 563864,
      "unitId": 1,
      "arrival": "2026-11-10",
      "departure": "2026-11-12",
      "numAdult": 2,
      "status": "confirmed",
      "firstName": "길동",
      "lastName": "홍",
      "price": 250000,
      "apiSourceId": 0,
      "notes": "직접 예약 손님"
    }
  ]
  ```

### 4.2 미배정 `unitId` 계약
- 호실 배정 시: 해당 호실의 고유 `unitId` (예: 1, 2)
- **미배정 등록 시**: 반드시 **`unitId: 0`**을 전달 (Beds24 API V2 규칙상 0을 넘겨야 특정 유닛에 들어가지 않고 해당 룸타입의 미배정 풀로 안전하게 등록됨)

### 4.3 429 재시도 및 응답 유실(Timeout) 안전성 (중복 생성 방어)
- 신규 생성(POST)은 단순 조회(GET)와 달리 **자동 재시도를 절대 수행하지 않는다.**
- 통신 타임아웃 또는 429 한도 초과 시:
  - 중복 결제/중복 예약 발급 방지를 위해 자동 재호출을 중단하고 `status: 'AMBIGUOUS'`를 반환한다.
  - 사용자에게 **"Beds24 응답 지연으로 인해 중복 등록을 방지하고자 자동 재시도하지 않았습니다. Beds24 원본 캘린더를 먼저 확인해 주세요"** 안내를 제공한다.

---

## 5. 데이터 정합성 및 부분 성공 복구

### 5.1 불변조건 준수 (Beds24 First)
1. 클라이언트 요청 ➔ 서버 Route Handler 검증
2. **1단계: Beds24 API 신규 생성 호출** ➔ 고유 `bookingId` 발급 성공 확인
3. **2단계: Supabase `bookings` 테이블 Upsert**
   - Beds24 반환 데이터를 기존 검증 함수인 `formatBeds24ToSupabaseRow`로 변환하여 저장
   - 메모가 있는 경우 `booking_notes` 테이블에도 동시 보존
4. **3단계: 대시보드 로컬 state 즉시 반영** ➔ 타임라인에 실시간 렌더링

### 5.2 부분 성공(Partial Success) 복구 안내
- Beds24에서는 신규 생성이 성공하여 `bookingId`가 발급되었으나, 네트워크 장애 등으로 Supabase DB 반영에 실패한 경우:
  - 실패를 숨기지 않고 발급된 `bookingId`와 함께 **"Beds24 본사 등록(ID: #xxxx)은 완료되었으나 대시보드 반영 중 일시 오류가 발생했습니다. 상단 '증분 동기화'를 실행하면 즉시 복구됩니다"** 안내 팝업을 표시한다.

---

## 6. 서버 충돌 검증 및 안전장치

- **서버 2차 충돌 검사**:
  - 클라이언트 검증과 별개로 Route Handler에서 대상 호실(`unitId > 0`)에 대해 Supabase DB 캐시를 조회하여 날짜가 겹치는 활성 예약이 있는지 확인한다.
  - 충돌 발견 시 즉시 `409 Conflict`로 차단한다.
  - 이번 최소 범위에서는 운영 실수 방지를 위해 **강제 생성(Force Assign) 옵션을 제외**한다.

---

## 7. 필요한 변경 파일 목록

| 구분 | 파일 경로 | 변경 내용 및 역할 |
|---|---|---|
| **신규** | `app/components/modals/CreateBookingModal.tsx` | 신규 예약 등록 모달 UI (실시간 중복 검사, 모바일 반응형) |
| **신규** | `app/api/bookings/create/route.ts` | 신규 생성 API 엔드포인트 (admin 세션 검증, 충돌 검증, Beds24 ➔ Supabase 트랜잭션) |
| **수정** | `app/utils/beds24Client.ts` | `createBeds24Booking` 함수 추가 (재시도 없는 단일 안전 호출) |
| **수정** | `app/hooks/useDashboard.ts` | `isCreateModalOpen` 모달 상태 및 `handleCreateBooking` 핸들러 추가 |
| **수정** | `app/components/dashboard/DashboardToolbar.tsx` | admin 계정 전용 `+ 새 예약` 버튼 UI 추가 |
| **수정** | `app/page.tsx` | `CreateBookingModal` 마운트 및 핸들러 연동 |

---

## 8. 검증 및 롤백 계획

1. **테스트 항목**:
   - 권한 검증: admin 정상 허용, manager/staff 및 비로그인 접근 시 403 차단
   - 유효성 검증: 과거 날짜, 퇴실일이 입실일보다 앞선 경우, 인원 0명 이하 차단
   - 충돌 검증: 이미 예약이 있는 호실 선택 시 409 차단, 미배정 선택 시 정상 허용
   - Beds24 실패 시뮬레이션: Beds24 거절 시 DB에 저장되지 않는지 확인
   - 부분 성공 시뮬레이션: Beds24 생성 후 DB 실패 시 bookingId 안내 및 증분 동기화로 복구 여부 확인
2. **롤백 방안**:
   - 신규 모달 및 API 파일 제거, 툴바 버튼 제거로 즉시 배포 전 상태로 원상 복구 가능
   - 이미 Beds24에 생성된 예약은 Beds24 원본 콘솔 또는 대시보드 취소 기능으로 정리

