# Beds24 Reservation Dashboard - Agent Guidelines

## 1. 프로젝트 목표

이 프로젝트는 Beds24 API V2를 이용한 간단한 숙박 예약 확인 웹사이트이다.

현재 목표는 큰 규모의 PMS 시스템을 만드는 것이 아니라,

* Beds24 예약 데이터를 API로 가져온다.
* 하나의 대시보드에서 예약을 편하게 확인한다.
* 예약 데이터를 검색/필터링할 수 있도록 한다.
* 모바일에서도 편하게 사용할 수 있도록 한다.

초기 목표에 필요하지 않은 과도한 기능이나 아키텍처를 임의로 추가하지 않는다.

---

# 2. 개발 역할

Agent는 시니어 풀스택 개발자의 관점에서 프로젝트를 지원한다.

사용자는 주니어 개발자이지만 일반적인 개발 언어와 개념은 이해할 수 있으므로 기술적인 설명을 지나치게 단순화하지 않는다.

코드 작성뿐 아니라 다음을 함께 고려한다.

* 유지보수성
* 확장성
* 모듈화
* 책임 분리
* 의존성 관리
* 타입 안정성
* 테스트 가능성
* 모바일 UX
* 향후 기능 추가 가능성

단, 미래의 가능성만을 이유로 현재 프로젝트를 과도하게 복잡하게 만들지 않는다.

---

# 3. 가장 중요한 개발 원칙

## 3.1 변경 전 반드시 현재 구조를 분석한다.

새로운 기능이나 구조를 추가하기 전에 반드시 다음을 확인한다.

1. 현재 프로젝트 구조
2. 관련 기존 모듈
3. 기존 함수 및 컴포넌트
4. 재사용 가능한 코드
5. 기존 의존성
6. 변경으로 인해 영향을 받을 수 있는 기능

기존 코드로 해결할 수 있다면 새로운 코드를 만들지 않는다.

---

## 3.2 구조 변경 전 반드시 사용자에게 설명하고 승인을 받는다.

다음 작업은 반드시 먼저 계획을 설명하고 사용자의 승인을 받은 후 진행한다.

* 폴더 구조 변경
* 모듈 구조 변경
* 파일 이동
* 파일 삭제
* 대규모 리팩토링
* 기존 API 변경
* 기존 컴포넌트의 역할 변경
* 기존 기능을 다른 구조로 교체
* 새로운 아키텍처 도입
* 여러 파일에 영향을 주는 구조 변경

단순한 버그 수정이나 명백한 소규모 수정은 현재 구조를 유지하는 범위에서 진행할 수 있다.

---

## 3.3 코드를 삭제할 때는 반드시 검사를 받는다.

다음 작업은 사용자 승인 없이 진행하지 않는다.

* 파일 삭제
* 함수 삭제
* 컴포넌트 삭제
* 기존 API 제거
* 기존 타입 제거
* 사용하지 않는 코드라고 판단하여 임의 삭제
* 기존 구현을 완전히 다른 방식으로 교체

삭제가 필요하다고 판단되면 먼저 다음을 설명한다.

* 삭제 대상
* 삭제 이유
* 현재 사용처
* 대체 코드가 있는지
* 삭제했을 때 예상되는 영향

사용자가 승인한 후 삭제한다.

---

# 4. 모듈화 원칙

## 4.1 코드의 길이보다 책임을 기준으로 분리한다.

파일이 300줄이라는 이유만으로 무조건 분리하지 않는다.

다음과 같이 판단한다.

> "이 파일이 몇 줄인가?"보다
> "이 파일이 몇 가지 책임을 가지고 있는가?"를 우선한다.

예를 들어 하나의 파일에서 다음을 모두 담당한다면 분리를 검토한다.

* UI 렌더링
* API 호출
* 데이터 변환
* 비즈니스 로직
* 필터링
* 상태 관리
* 에러 처리

반대로 하나의 명확한 책임을 가지고 있고 응집도가 높다면 코드가 길더라도 무조건 분리하지 않는다.

---

## 4.2 파일 개수를 늘리는 것을 모듈화의 목표로 삼지 않는다.

다음과 같은 과도한 분리를 피한다.

```text
getReservationById.ts
getReservationByDate.ts
getReservationByStatus.ts
getReservationByRoom.ts
```

이 기능들이 하나의 예약 조회 기능에 속한다면 하나의 UseCase에서 처리할 수 있는지 먼저 검토한다.

예:

```ts
getReservations({
  dateFrom,
  dateTo,
  status,
  roomId,
})
```

---

## 4.3 새로운 abstraction은 실제 필요성이 있을 때만 추가한다.

다음과 같은 abstraction을 미래의 가능성만을 이유로 미리 만들지 않는다.

* interface
* abstract class
* factory
* service
* provider
* adapter
* manager

실제로 구현 교체가 필요하거나 의존성 분리가 필요한 상황이 발생했을 때 도입한다.

즉,

> "언젠가 필요할 것 같다"보다
> "현재 실제로 필요한가?"를 우선한다.

---

# 5. 권장 아키텍처

프로젝트는 복잡한 Clean Architecture나 Hexagonal Architecture를 처음부터 적용하지 않는다.

기본적으로 다음 정도의 구조를 지향한다.

```text
UI
 ↓
Feature Hook / State
 ↓
UseCase
 ↓
Repository
 ↓
External API / Infrastructure
```

Beds24 예약 기능을 예로 들면:

```text
Reservation UI
      ↓
useReservations
      ↓
getReservations
      ↓
reservationRepository
      ↓
Beds24 Client
      ↓
Beds24 API V2
```

이 구조를 기본 방향으로 사용하되, 실제 코드 규모에 따라 필요한 계층만 만든다.

---

# 6. Feature 중심으로 모듈화한다.

기능별로 하나의 독립적인 영역을 만들 수 있도록 한다.

예:

```text
src/
├── features/
│   └── reservations/
│       ├── components/
│       ├── hooks/
│       ├── useCases/
│       ├── repository/
│       └── model/
│
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── types/
│
└── infrastructure/
    └── beds24/
        ├── client/
        ├── api/
        └── dto/
```

단, 실제 필요가 생기기 전까지 모든 폴더와 파일을 미리 생성하지 않는다.

작은 기능은 다음처럼 시작할 수 있다.

```text
reservations/
├── ReservationDashboard.tsx
├── useReservations.ts
└── reservationRepository.ts
```

코드의 책임이 커졌을 때 필요한 부분만 분리한다.

---

# 7. MVI의 장점을 유지하되 그대로 복제하지 않는다.

MVI를 웹 프로젝트에 그대로 구현하기보다는 MVI의 명확한 책임 분리 개념을 활용한다.

기본적인 흐름은 다음과 같다.

```text
User Action
    ↓
Hook / State
    ↓
UseCase
    ↓
Repository
    ↓
Beds24 API
    ↓
State Update
    ↓
UI
```

예:

```text
예약 새로고침
    ↓
refreshReservations()
    ↓
GetReservationsUseCase
    ↓
ReservationRepository
    ↓
Beds24 API
    ↓
Loading → Success / Error
```

UI가 Beds24 API의 세부 구현을 직접 알지 않도록 한다.

---

# 8. UseCase 설계 원칙

UseCase는 하나의 의미 있는 사용자 행동 또는 비즈니스 기능을 기준으로 만든다.

예:

```text
getReservations
getReservation
syncReservations
filterReservations
```

다음처럼 지나치게 잘게 나누지 않는다.

```text
getReservationById
getReservationByDate
getReservationByStatus
getReservationByRoomId
```

여러 조회 조건이 하나의 예약 조회 기능에 속한다면 하나의 UseCase에서 조건을 전달받아 처리할 수 있는지 먼저 검토한다.

---

# 9. Repository 원칙

외부 API에 대한 접근은 Repository 또는 적절한 Infrastructure 계층으로 분리한다.

UI에서 직접 Beds24 API를 호출하지 않는다.

잘못된 예:

```text
Component
  ↓
fetch(Beds24 API)
```

권장:

```text
Component
  ↓
UseCase
  ↓
Repository
  ↓
Beds24 Client
  ↓
Beds24 API
```

Beds24 API의 세부 구현이 UI 전체에 퍼지지 않도록 한다.

---

# 10. Interface 사용 원칙

Interface는 무조건 사용하지 않는다.

다음과 같은 실제 요구가 생겼을 때 도입을 검토한다.

* Repository 구현을 교체해야 하는 경우
* Mock 구현이 필요한 경우
* 여러 데이터 공급원을 지원해야 하는 경우
* 외부 API 구현과 비즈니스 로직의 결합을 분리해야 하는 경우
* 테스트를 위해 실제 구현을 대체해야 하는 경우

예를 들어 현재 Beds24 하나만 사용한다면 단순한 구현으로 시작할 수 있다.

```ts
export const reservationRepository = {
  async getReservations() {
    // Beds24 API 호출
  }
}
```

향후 필요성이 생기면 다음과 같이 추상화할 수 있다.

```ts
interface ReservationRepository {
  getReservations(): Promise<Reservation[]>
}
```

미래의 가능성만을 이유로 interface와 구현체를 무조건 분리하지 않는다.

---

# 11. API 경계

Beds24 API와 애플리케이션 내부 로직 사이에는 명확한 경계를 유지한다.

기본 구조:

```text
Feature
  ↓
Repository
  ↓
Beds24 Client
  ↓
Beds24 API V2
```

Beds24 API 관련 코드가 UI 컴포넌트나 여러 Feature에 직접 퍼지지 않도록 한다.

Beds24 API 변경 시 영향 범위를 최대한 제한할 수 있는 구조를 지향한다.

---

# 12. DTO와 내부 Model

API 응답 구조와 애플리케이션 내부 Model을 처음부터 과도하게 분리하지 않는다.

작은 프로젝트에서는 필요한 경우 API 응답을 바로 사용할 수 있다.

하지만 다음 상황에서는 DTO와 내부 Model 분리를 검토한다.

* Beds24 API 응답 구조가 UI에 그대로 노출되기 시작하는 경우
* API 응답과 UI에서 사용하는 데이터 구조가 달라지는 경우
* Beds24 API 변경으로부터 내부 로직을 보호해야 하는 경우
* 여러 외부 데이터 소스를 통합해야 하는 경우

불필요하게 다음과 같은 계층을 미리 만들지 않는다.

```text
Beds24ReservationDTO
ReservationEntity
ReservationResponse
ReservationViewModel
ReservationState
```

현재 요구사항에 필요한 만큼만 만든다.

---

# 13. 의존성 방향

기본적인 의존성 방향은 다음을 따른다.

```text
UI
 ↓
Feature Hook / State
 ↓
UseCase
 ↓
Repository
 ↓
Infrastructure
 ↓
External API
```

원칙:

* UI는 Beds24 API를 직접 호출하지 않는다.
* UseCase는 UI 구현에 의존하지 않는다.
* Beds24 API 구현 세부사항이 UI까지 노출되지 않도록 한다.
* 외부 API의 변경이 Feature 전체로 전파되지 않도록 한다.
* 가능한 한 의존성 방향을 단순하게 유지한다.

---

# 14. UI / 모바일 최적화

모든 UI는 모바일 환경을 기본 기준으로 설계한다.

데스크톱 UI를 먼저 만들고 단순히 축소하는 방식으로 구현하지 않는다.

새로운 UI를 추가할 때 항상 다음을 확인한다.

* 모바일 화면에서 정상적으로 표시되는가?
* 가로 스크롤이 발생하지 않는가?
* 버튼과 인터랙션 요소를 터치하기 편한가?
* 긴 텍스트가 레이아웃을 깨뜨리지 않는가?
* 예약 데이터가 작은 화면에서도 읽기 쉬운가?
* 로딩/에러/빈 데이터 상태가 모바일에서도 적절한가?

특히 예약 데이터 테이블은 모바일 사용성을 고려한다.

데스크톱에서는 테이블을 사용하더라도 모바일에서는 필요하면 Card/List 형태로 표현하는 방식을 검토한다.

예:

```text
Desktop

ID | Guest | Arrival | Departure | Status
------------------------------------------

Mobile

┌─────────────────────┐
│ 홍길동               │
│ 9/10 → 9/12          │
│ Confirmed            │
└─────────────────────┘
```

---

# 15. 상태 관리

상태는 필요한 범위에서만 관리한다.

예약 기능의 대표적인 상태는 다음과 같이 생각할 수 있다.

```text
idle
loading
success
error
```

필요하다면:

```text
data
filters
selectedReservation
error
loading
```

등을 관리한다.

상태 관리 라이브러리나 복잡한 전역 상태 구조는 실제 필요성이 생겼을 때 도입한다.

단순한 로컬 상태를 전역 상태로 만들지 않는다.

---

# 16. 에러 처리

외부 API 호출은 항상 실패할 가능성을 고려한다.

최소한 다음 상태를 고려한다.

```text
Loading
Success
Empty
Error
```

사용자에게 보여주는 에러와 개발자가 확인해야 하는 기술적인 에러를 적절히 구분한다.

Beds24 API의 원본 오류 메시지가 중요한 경우 원문을 보존하고, 사용자에게는 이해하기 쉬운 형태로 표시할 수 있도록 한다.

---

# 17. 테스트 및 검증

기능 구현 후 가능한 범위에서 다음을 확인한다.

* TypeScript 타입 오류
* Lint
* 테스트
* Build
* API 호출 오류
* 빈 데이터
* 네트워크 오류
* 모바일 레이아웃
* 기존 기능 동작 여부

새로운 기능을 추가할 때 기존 기능에 영향을 줄 가능성이 있다면 그 영향 범위를 설명한다.

---

# 18. 작업 진행 프로세스

새로운 기능이나 구조 변경은 기본적으로 다음 순서로 진행한다.

### Step 1. 분석

현재 구조와 관련 코드를 확인한다.

### Step 2. 재사용성 확인

기존 모듈, 함수, 컴포넌트를 재사용할 수 있는지 확인한다.

### Step 3. 모듈화 검토

새 기능을 기존 모듈에 추가할지 새로운 Feature/UseCase/Repository로 분리할지 판단한다.

### Step 4. 변경 계획 제시

다음 내용을 사용자에게 설명한다.

```text
- 변경 이유
- 변경할 파일
- 새로 만들 파일
- 수정할 파일
- 삭제할 파일
- 모듈화 방법
- 예상되는 영향
```

### Step 5. 사용자 승인

구조 변경, 파일 삭제, 대규모 리팩토링이 포함되는 경우 반드시 사용자의 승인을 받는다.

### Step 6. 구현

승인받은 범위 안에서만 구현한다.

승인받지 않은 추가 리팩토링은 하지 않는다.

### Step 7. 검증

가능한 범위에서 타입체크, 린트, 테스트, 빌드 등을 수행한다.

### Step 8. 결과 보고

구현 후 다음을 간략하게 보고한다.

```text
- 변경된 파일
- 주요 변경 내용
- 추가된 기능
- 테스트/검증 결과
- 기존 기능 영향 여부
- 추가로 개선할 수 있는 부분
```

---

# 19. 범위 통제

"더 좋은 구조"라는 이유만으로 현재 동작하는 코드를 임의로 재작성하지 않는다.

현재 요청과 직접 관련 없는 다음 작업은 사용자 승인 없이 진행하지 않는다.

* 전체 프로젝트 리팩토링
* 폴더 구조 전면 변경
* 상태 관리 방식 교체
* 라이브러리 교체
* 프레임워크 구조 변경
* 불필요한 디자인 패턴 추가
* 전체 코드 스타일 변경
* 사용하지 않는다고 판단한 코드 대량 삭제

필요하다고 판단되면 별도의 개선 사항으로 제안한다.

---

# 20. 설명 원칙

코드를 제안할 때 단순히 코드만 제공하지 않는다.

필요한 경우 다음을 설명한다.

* 왜 이 위치에 코드를 넣는지
* 왜 이 모듈로 분리하는지
* 기존 코드와 어떤 관계인지
* UseCase가 필요한 이유
* Repository가 필요한 이유
* Interface가 필요한지 여부
* 현재 구조에서 더 이상 복잡하게 만들지 않는 이유

다만 설명을 위해 불필요하게 복잡한 이론을 추가하지 않는다.

---

# 21. 최우선 원칙

이 프로젝트에서 가장 중요한 것은 다음 순서이다.

```text
정상 동작
    ↓
명확한 책임 분리
    ↓
적절한 모듈화
    ↓
유지보수성
    ↓
확장성
```

확장성을 위해 현재 기능을 불필요하게 복잡하게 만들지 않는다.

"미래를 위한 구조"보다 "현재 이해하기 쉬운 구조"를 우선한다.

---

# 22. 작업 시 항상 기억할 질문

새로운 코드를 추가하기 전에 다음을 확인한다.

1. 기존 코드로 해결할 수 있는가?
2. 기존 모듈을 재사용할 수 있는가?
3. 이 기능은 어느 Feature에 속하는가?
4. UI와 비즈니스 로직이 섞여 있지는 않은가?
5. UseCase가 필요한가?
6. Repository가 필요한가?
7. Interface가 실제로 필요한가?
8. 파일을 분리해야 하는 실제 이유가 있는가?
9. 모바일에서도 동작하는가?
10. 기존 기능에 영향을 주는가?
11. 구조 변경이나 코드 삭제가 필요한가?
12. 승인이 필요한 변경인가?

필요한 변경이라도 먼저 사용자에게 계획을 설명하고 승인을 받은 후 진행한다.

# 23. 보안 원칙

체크인 페이지는 외부 고객에게 공개되는 기능이므로 보안을 기능 구현과 동시에 고려한다.

보안은 기능 구현 이후 추가하는 것이 아니라 설계 단계부터 적용한다.

---

## 23.1 기본 보안 원칙

* 모든 외부 입력은 신뢰하지 않는다.
* 인증(Authentication)과 인가(Authorization)를 분리한다.
* 클라이언트에서 수행한 보안 검증을 신뢰하지 않는다.
* 모든 권한 검증은 서버에서 수행한다.
* 최소 권한 원칙(Principle of Least Privilege)을 적용한다.
* 필요한 개인정보만 조회하고 필요한 정보만 클라이언트에 전달한다.
* 민감한 정보는 로그에 남기지 않는다.
* API Token, Refresh Token, Session Token, Password 등의 secret을 클라이언트에 노출하지 않는다.
* 보안상 중요한 기능은 구현 전에 위협 가능성을 먼저 검토한다.

---

# 24. 체크인 페이지 보안

체크인 페이지는 공개 웹페이지이므로 예약번호 등의 단순 식별자만으로 예약 정보를 조회할 수 있도록 만들지 않는다.

다음 원칙을 따른다.

```text
예약번호를 알고 있음
        ≠
해당 예약에 접근할 권한이 있음
```

모든 예약 조회는 서버에서 해당 고객이 해당 예약에 접근할 권한이 있는지 확인한다.

IDOR/BOLA와 같은 객체 수준 권한 우회가 발생하지 않도록 한다.

---

# 25. Authentication / Authorization

Authentication:

> 사용자가 유효한 인증 정보를 가지고 있는가?

Authorization:

> 인증된 사용자가 해당 예약과 기능에 접근할 권한이 있는가?

두 가지를 반드시 별도로 검증한다.

예:

```text
Check-in Token 검증
        ↓
Token 만료 여부 확인
        ↓
Token과 Reservation의 관계 확인
        ↓
Reservation 상태 확인
        ↓
Check-in 가능 여부 확인
        ↓
접근 허용
```

클라이언트가 전달한 reservationId만으로 권한을 판단하지 않는다.

---

# 26. Check-in Token

체크인 인증에 토큰을 사용할 경우 예측하기 어려운 암호학적으로 안전한 랜덤 값을 사용한다.

다음과 같이 순차적인 예약번호를 인증 토큰으로 사용하지 않는다.

```text
❌ /checkin/100001
❌ /checkin/100002
```

가능하면:

```text
⭕ /checkin/<random-token>
```

형태를 사용한다.

토큰에는 개인정보나 예약 정보를 직접 포함하지 않는다.

토큰은 다음 정보를 서버에서 관리할 수 있다.

```text
tokenHash
reservationId
expiresAt
usedAt
status
```

가능하면 원본 토큰 대신 안전한 방식으로 저장한다.

---

# 27. Check-in Token 만료

체크인 토큰은 무기한 유효하게 만들지 않는다.

다음 상황에서 접근을 거부한다.

* 토큰 만료
* 토큰 폐기
* 이미 사용된 토큰
* 존재하지 않는 예약
* 취소된 예약
* 체크인 불가능한 예약
* 해당 예약과 토큰의 관계가 일치하지 않는 경우

---

# 28. Session Management

인증이 완료된 후에는 URL의 토큰을 계속 사용하는 대신 서버 세션으로 전환하는 것을 우선 검토한다.

Session Cookie는 최소한 다음 보안 속성을 검토한다.

```text
HttpOnly
Secure
SameSite=Lax 또는 Strict
```

인증 토큰, 세션 토큰, refresh token을 localStorage 또는 sessionStorage에 저장하지 않는다.

로그아웃 시 서버에서 세션을 무효화한다.

세션 만료 시간을 설정한다.

인증 상태가 변경되거나 권한이 변경되는 경우 session fixation을 방지하기 위해 session identifier를 재생성한다.

---

# 29. HTTPS

운영 환경에서는 전체 서비스에 HTTPS를 사용한다.

```text
❌ http://example.com
⭕ https://example.com
```

로그인/체크인 페이지뿐 아니라 인증된 전체 세션을 HTTPS로 유지한다.

운영 환경에서는 HSTS 적용을 검토한다.

---

# 30. Rate Limiting / Brute Force Protection

공개된 체크인 API에는 Rate Limit을 적용한다.

특히 다음 API는 공격 대상이 될 수 있으므로 보호한다.

```text
POST /api/checkin/verify
POST /api/checkin
POST /api/checkin/resend
```

다음을 검토한다.

* IP 기반 rate limit
* 토큰 기반 rate limit
* 예약 기반 rate limit
* 인증 실패 횟수 제한
* 일정 횟수 이상 실패 시 일시적인 잠금
* 비정상적인 반복 요청 모니터링

Rate limit은 클라이언트에서 구현하지 않고 서버에서 강제한다.

---

# 31. CSRF

Cookie 기반 인증을 사용하는 경우 CSRF 공격을 방어한다.

특히 상태를 변경하는 API는 CSRF 방어를 검토한다.

```text
POST
PUT
PATCH
DELETE
```

SameSite Cookie 설정만으로 모든 CSRF 방어가 완료되었다고 판단하지 않는다.

---

# 32. Input Validation

모든 외부 입력은 서버에서 검증한다.

검증 대상 예:

```text
예약번호
이름
이메일
전화번호
체크인 정보
특별 요청사항
URL parameter
query parameter
request body
header
cookie
```

가능하면 허용 목록(allowlist)을 기준으로 검증한다.

입력 길이 제한을 적용한다.

클라이언트 validation은 UX 개선을 위한 것이며 보안 검증으로 간주하지 않는다.

---

# 33. XSS

사용자가 입력한 문자열을 HTML로 직접 렌더링하지 않는다.

필요하지 않은 HTML rendering을 사용하지 않는다.

HTML을 렌더링해야 하는 경우 context에 맞는 output encoding 또는 sanitization을 적용한다.

Content Security Policy(CSP) 적용을 검토한다.

---

# 34. API Secret 관리

Beds24 API Token과 Refresh Token은 절대로 브라우저에 노출하지 않는다.

잘못된 구조:

```text
Browser
   ↓
Beds24 API
```

권장 구조:

```text
Browser
   ↓
Application Backend / BFF
   ↓
Beds24 API
```

Beds24 API credential은 서버 환경변수 또는 적절한 Secret Management 시스템에서 관리한다.

Git repository에 secret을 commit하지 않는다.

`.env` 파일은 repository에 포함하지 않는다.

`.env.example`에는 실제 secret을 기록하지 않는다.

---

# 35. Beds24 API Scope

Beds24 API V2를 사용할 때 최소 권한 원칙을 적용한다.

현재 기능에 필요한 scope만 요청한다.

예약 조회만 필요한 경우 write 권한이나 financial scope를 불필요하게 부여하지 않는다.

특히 다음 권한은 실제 필요성이 생겼을 때만 추가한다.

```text
write/*
bookings-financial
기타 민감한 scope
```

Beds24 API scope 변경이 필요한 경우 기존 scope와 추가 이유를 먼저 확인한다.

---

# 36. Beds24 API Token 관리

Beds24 API V2의 access token과 refresh token은 서버에서만 관리한다.

Access Token을 매 요청마다 새로 발급하지 않는다.

기존 access token의 유효기간을 확인하여 재사용한다.

Refresh Token을 이용한 token 갱신은 서버에서 수행한다.

Token 발급/갱신 실패 시 재시도 로직이 무한 반복되지 않도록 한다.

Token 자체를 로그에 기록하지 않는다.

---

# 37. 개인정보 최소화

Beds24에서 데이터를 가져오더라도 고객에게 필요한 정보만 반환한다.

예:

```text
Reservation
    ↓
Backend
    ↓
Public Check-in Response
```

Backend에서 다음과 같은 민감하거나 불필요한 데이터를 제거한다.

```text
결제 정보
금융 정보
내부 메모
불필요한 고객 개인정보
다른 예약 데이터
내부 시스템 정보
API credential
```

Beds24 API에서 사용할 수 있는 scope도 실제 필요한 개인정보 범위로 제한한다.

---

# 38. Authorization은 서버에서 수행

다음과 같은 클라이언트 코드만으로 접근을 허용하지 않는다.

```ts
if (reservationId === userReservationId) {
  showReservation()
}
```

실제 권한 검증은 서버에서 수행한다.

```text
Request
 ↓
Authentication
 ↓
Authorization
 ↓
Business Rule Validation
 ↓
Data Access
```

---

# 39. Logging

보안 이벤트는 필요한 범위에서 기록한다.

기록을 검토할 수 있는 예:

```text
로그인 성공/실패
체크인 인증 성공/실패
토큰 만료
세션 생성/종료
비정상적인 반복 요청
권한 거부
중요한 체크인 상태 변경
```

다음 정보는 로그에 직접 기록하지 않는다.

```text
Password
Beds24 Access Token
Beds24 Refresh Token
Session Token
Payment/Card Information
불필요한 전체 개인정보
```

세션 추적이 필요한 경우 원본 session ID 대신 안전한 식별자를 사용한다.

---

# 40. Security Headers

운영 환경에서 다음 보안 헤더 적용을 검토한다.

```text
Strict-Transport-Security
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
```

현재 프로젝트에서 실제 사용되는 외부 리소스와 호환되는지 확인한 후 적용한다.

---

# 41. Security 변경 승인

다음 작업은 반드시 사용자에게 먼저 설명하고 승인을 받는다.

* 인증 방식 변경
* 세션 구조 변경
* Cookie 정책 변경
* API credential 변경
* Beds24 API scope 변경
* 개인정보 저장 구조 변경
* 체크인 토큰 구조 변경
* 권한 정책 변경
* Rate Limit 정책 변경
* 보안 관련 middleware 변경
* Security Header 정책 변경

보안 개선을 이유로 기존 인증/권한 코드를 임의로 삭제하거나 전체 교체하지 않는다.

먼저 현재 구조와 위험 요소를 분석한 후 변경 계획을 제시한다.

---

# 42. 보안 작업 순서

보안 관련 기능은 다음 순서로 진행한다.

1. 보호해야 하는 데이터 확인
2. 공격 가능한 endpoint 확인
3. Authentication 요구사항 확인
4. Authorization 요구사항 확인
5. 세션 구조 확인
6. 개인정보 노출 범위 확인
7. API credential 노출 여부 확인
8. Rate Limit 필요 여부 확인
9. CSRF/XSS/Input Validation 확인
10. 로그에 민감정보가 포함되는지 확인
11. 변경 계획 제시
12. 사용자 승인
13. 구현
14. 보안 관련 테스트
15. 기존 기능 영향 확인

보안 관련 변경은 기능 구현보다 우선해서 검토한다.
