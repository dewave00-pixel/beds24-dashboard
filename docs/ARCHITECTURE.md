# 아키텍처와 모듈화 지침

## 1. 현재 의존 흐름

일반적인 화면 흐름:

```text
Page / Component
    ↓
Feature Hook
    ↓
Next.js Route Handler
    ↓
Supabase 또는 Beds24 Client
```

예약 동기화 흐름:

```text
Webhook / Cron / 사용자 동기화 요청
    ↓
Beds24 조회
    ↓
예약 정규화
    ↓
Supabase bookings upsert / reconciliation
    ↓
Realtime 알림
    ↓
화면 재조회
```

현재 예외:

- `useRealtimeBookings`는 브라우저 anon 클라이언트로 Supabase Realtime을 직접 구독한다.
- 이 예외는 RLS와 Realtime publication이 안전하다는 전제가 필요하다.
- 브라우저에서 service-role 클라이언트나 Beds24 API를 직접 사용해서는 안 된다.

## 2. 목표 의존 방향

```text
UI
 ↓
Feature Hook / State
 ↓
UseCase 또는 의미 있는 도메인 함수
 ↓
Repository / Route Handler
 ↓
Infrastructure Client
 ↓
External API / Database
```

모든 작업에 모든 계층을 만들 필요는 없다. 현재 복잡도에 필요한 계층만 둔다.

예:

```text
Reservation UI
    ↓
useDashboard
    ↓
/api/reservations
    ↓
Beds24 client / Supabase
```

## 3. 책임 분리 기준

파일 줄 수만으로 분리하지 않는다. 다음 책임이 독립적으로 변경되거나 테스트될 필요가 있는지 확인한다.

- UI 렌더링
- 사용자 상호작용과 화면 상태
- API 호출
- 외부 응답 변환
- 예약·정산·분석 규칙
- 필터링과 정렬
- 인증·인가
- 오류와 재시도

하나의 명확한 책임을 가진 긴 계산 파일은 테스트를 먼저 추가한 후 분리를 판단한다. UI, 네트워크, 계산이 함께 있는 파일은 책임 분리 후보다.

## 4. Feature 중심 구성

새 기능은 먼저 기존 feature에 속하는지 확인한다.

```text
reservations
analytics
cleaning
properties
checkin-management
guest-checkin (향후 공개 기능)
```

작은 기능은 기존 page, hook, utility에 추가할 수 있다. 다음 조건이 생겼을 때 별도 feature 디렉터리를 검토한다.

- 독립된 사용자 흐름이 있다.
- 상태와 API가 다른 화면과 분리된다.
- 도메인 규칙을 독립적으로 테스트해야 한다.
- 기존 파일에 UI·네트워크·계산 책임이 동시에 누적된다.

폴더 구조를 미리 완성하지 않는다.

## 5. UseCase 원칙

UseCase는 하나의 의미 있는 사용자 행동이나 운영 기능을 기준으로 한다.

적절한 예:

```text
getReservations(filters)
assignBookingUnit(input)
extendBookingStay(input)
syncReservations(mode)
```

피할 예:

```text
getReservationById
getReservationByDate
getReservationByStatus
getReservationByRoomId
```

동일한 조회 기능의 조건 차이는 입력으로 처리할 수 있는지 먼저 검토한다.

## 6. Repository와 Infrastructure

- UI에서 Beds24 API를 직접 호출하지 않는다.
- Beds24 token 발급·재사용·재시도는 infrastructure 경계에 둔다.
- service-role Supabase 접근은 서버 전용 모듈에서 수행한다.
- Repository interface는 구현 교체, 여러 데이터 공급원, mock 대체가 실제로 필요할 때 도입한다.
- 하나의 구현만 존재하고 테스트에서 함수 주입으로 충분하면 객체 또는 함수 모듈로 시작한다.

## 7. DTO와 내부 Model

외부 응답을 무조건 여러 계층으로 복제하지 않는다. 다음 상황에서는 DTO와 내부 Model을 분리한다.

- Beds24 필드명이 UI 전역에 퍼진다.
- API 응답과 UI가 필요한 구조가 다르다.
- 개인정보를 제거한 응답이 필요하다.
- 여러 데이터 공급원을 합친다.
- 외부 API 변경으로부터 계산 로직을 보호해야 한다.

외부 JSON은 경계에서 `unknown`으로 받고 검증·정규화한 뒤 내부 타입으로 전달하는 방향을 우선한다.

## 8. 상태 관리

기본 비동기 상태:

```text
idle
loading
success
empty
error
```

- 화면에만 필요한 선택·모달 상태는 로컬에 둔다.
- 여러 컴포넌트가 같은 서버 데이터를 사용하면 feature hook에서 조정한다.
- 전역 상태 라이브러리는 실제 공유 범위와 동기화 문제가 확인될 때만 도입한다.
- 서버 데이터 캐시 라이브러리를 추가할 경우 기존 Realtime과 재조회 흐름의 중복을 먼저 분석한다.

## 9. 오류 처리

- 외부 API 오류 원문은 서버에서 진단 가능하게 보존하되 secret과 개인정보는 제거한다.
- 클라이언트에는 안정적인 에러 코드와 이해하기 쉬운 메시지를 제공한다.
- Beds24 성공 후 Supabase 실패처럼 부분 성공이 가능한 작업은 별도 상태로 표현한다.
- 재시도 가능한 오류와 사용자 입력 오류를 구분한다.
- 빈 배열과 조회 실패를 같은 상태로 처리하지 않는다.

## 10. 모바일 UI

- 모바일 화면을 기본 기준으로 확인한다.
- 터치 대상은 충분한 크기와 간격을 갖는다.
- 예약과 청소 데이터는 작은 화면에서 Card/List 표현을 우선 검토한다.
- 긴 고객명, 메모, 숙소명, 채널명이 레이아웃을 깨뜨리지 않게 한다.
- 중요한 작업은 hover에만 의존하지 않는다.
- 로딩·빈 데이터·오류·권한 없음 상태를 모바일에서도 확인한다.

## 11. 구조 변경 판단

구조 변경 전 다음을 설명하고 승인받는다.

- 현재 파일의 책임
- 분리하려는 실제 이유
- 새 경계와 의존 방향
- 이동·삭제되는 public API
- 기존 import와 호출자 영향
- 점진적 변경 가능 여부
- 검증 및 되돌리기 방법

“더 좋은 구조” 또는 파일 길이만으로 동작하는 코드를 전면 재작성하지 않는다.
