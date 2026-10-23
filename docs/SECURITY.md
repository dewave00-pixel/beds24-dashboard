# 보안 지침

## 1. 기본 원칙

- 모든 외부 입력을 신뢰하지 않는다.
- 인증과 인가를 분리한다.
- 클라이언트의 검증과 UI 권한 표시를 보안 경계로 보지 않는다.
- 권한 검증은 데이터 접근과 가까운 서버에서 수행한다.
- 최소 권한 원칙을 적용한다.
- 필요한 개인정보만 조회하고 필요한 정보만 응답한다.
- secret과 불필요한 개인정보를 로그에 남기지 않는다.
- 보안 기능은 설계 단계부터 적용한다.

인증·역할·API 권한 기준은 [AUTHORIZATION.md](AUTHORIZATION.md)를 함께 따른다.

## 2. 보호 대상

주요 민감정보:

- Beds24 access token, refresh token, invite code
- Supabase service role key
- 사용자 password와 Supabase session token
- 도어락 비밀번호
- 고객 이름, 전화번호, 이메일
- 예약 일정과 예약 ID
- 내부 메모와 수리 메모
- 체크인 로그와 게스트 케어 설문
- 금액·매출·정산 데이터

기능을 변경하기 전에 어떤 데이터가 누구에게 노출되는지 확인한다.

## 3. Secret 관리

- Beds24 credential과 Supabase service role key는 서버 환경변수 또는 승인된 secret 저장소에서 관리한다.
- 브라우저 번들, 응답, 로그, 오류 메시지에 secret을 포함하지 않는다.
- `.env`와 `.env.local`은 commit하지 않는다.
- `.env.example`에는 실제 값을 기록하지 않는다.
- `NEXT_PUBLIC_*`에는 공개 가능한 값만 둔다.
- placeholder 환경변수 fallback은 build 호환 목적과 운영 런타임을 구분한다.
- 운영 환경에서 필수 secret이 없으면 안전하게 실패하고 원인을 식별할 수 있어야 한다.

## 4. Beds24 Token과 Scope

- access/refresh token은 서버에서만 관리한다.
- access token은 만료 전까지 재사용한다.
- refresh 실패 재시도가 무한 반복되지 않게 한다.
- token 값을 로그에 남기지 않는다.
- 필요한 scope만 요청한다.
- 예약 조회만 필요한 기능에 write 또는 financial scope를 추가하지 않는다.
- `write/*`, `bookings-financial` 등 민감한 scope 추가는 기존 scope와 필요성을 설명하고 승인받는다.

## 5. Session과 Cookie

- 사용자 session은 서버가 유효성을 검증할 수 있어야 한다.
- 역할 문자열만 저장한 쿠키를 최종 인증 근거로 사용하지 않는다.
- 인증 token을 `localStorage` 또는 `sessionStorage`에 직접 저장하지 않는다.
- Cookie는 용도에 따라 `HttpOnly`, 운영 환경 `Secure`, `SameSite=Lax` 또는 `Strict`, `Path`, 만료를 설정한다.
- 로그아웃 시 서버와 브라우저의 세션을 무효화한다.
- 로그인 또는 권한 변경 시 session fixation 방지를 검토한다.
- 운영 환경 전체에서 HTTPS를 사용하고 HSTS 적용 여부를 검토한다.

Cookie 정책이나 세션 구조 변경은 사용자 승인을 받는다.

## 6. API 보안 경계

API를 다음 네 종류로 분류한다.

```text
Public API
User Session API
Internal Job API
Webhook API
```

- Public API에는 rate limit과 엄격한 입력 검증을 적용한다.
- User Session API는 서버 session, role, 객체 권한을 검증한다.
- Internal Job API는 Cron secret 또는 승인된 관리자 인증을 사용한다.
- Webhook API는 공급자 검증 방식 또는 별도 secret을 사용한다.
- service role을 사용하는 Route Handler는 인증 없이 공개하지 않는다.
- GET 요청으로 상태를 변경하는 endpoint는 특별한 호환 이유가 없다면 사용하지 않는다.

## 7. 공개 고객 체크인

현재 내부 `/checkin` 관리 화면과 향후 공개 고객 체크인을 구분한다.

공개 체크인에서는 다음을 지킨다.

```text
예약번호를 알고 있음
        ≠
해당 예약에 접근할 권한이 있음
```

접근 검증 예:

```text
Check-in Token 검증
    ↓
만료·폐기·사용 여부 확인
    ↓
Token과 reservation 관계 확인
    ↓
예약 상태와 체크인 가능 기간 확인
    ↓
필요한 최소 데이터만 응답
```

- 순차적 예약번호를 인증 token으로 사용하지 않는다.
- 암호학적으로 안전한 랜덤 token을 사용한다.
- token에 개인정보나 예약정보를 직접 넣지 않는다.
- 가능하면 원본 token 대신 hash를 저장한다.
- `tokenHash`, `reservationId`, `expiresAt`, `usedAt`, `status` 등을 서버에서 관리한다.
- 인증 후 URL token을 계속 사용하기보다 서버 세션 전환을 검토한다.
- 취소·삭제·문의·체크인 불가 예약 접근을 거부한다.
- 고객 응답에서 결제, 내부 메모, 다른 예약, API 내부정보를 제거한다.

## 8. Rate Limit과 Brute Force 방어

특히 다음 유형을 보호한다.

- 로그인
- 고객 체크인 token 검증
- 체크인 제출과 재전송
- webhook
- 전체·증분 동기화
- 비용이 큰 검색·분석 요청

검토 항목:

- IP 기반 제한
- 사용자·token·예약 기반 제한
- 실패 횟수 제한과 일시 잠금
- endpoint별 비용에 따른 다른 한도
- 비정상 반복 요청 모니터링
- 프록시 환경에서 신뢰할 client IP header

Rate Limit은 클라이언트가 아니라 서버에서 강제한다. 정책 변경은 사용자 승인을 받는다.

## 9. CSRF와 Origin

Cookie 기반 인증의 상태 변경 요청은 CSRF 방어를 검토한다.

- `POST`, `PUT`, `PATCH`, `DELETE`에 적용한다.
- SameSite Cookie만으로 모든 방어가 끝났다고 판단하지 않는다.
- Origin/Referer 검증 또는 CSRF token을 선택할 때 webhook과 Cron 요청을 구분한다.
- 외부 provider callback에 사용자용 CSRF 규칙을 그대로 적용하지 않는다.

## 10. 입력 검증

모든 외부 입력을 서버에서 검증한다.

검증 대상:

- URL과 query parameter
- JSON/form body
- header와 cookie
- 예약·숙소·room·unit ID
- 날짜와 날짜 범위
- 이름, 이메일, 전화번호
- 메모, 검색어, 설문, 태그
- 금액과 인원수
- pagination과 limit
- webhook payload

원칙:

- allowlist를 우선한다.
- 타입, 형식, 길이, 범위를 함께 검사한다.
- `Number()` 변환만으로 유효한 정수라고 판단하지 않는다.
- 날짜 문자열의 모양뿐 아니라 실제 날짜와 업무 범위를 확인한다.
- body 크기와 배열 항목 수를 제한한다.
- 클라이언트 validation은 UX 개선일 뿐 보안 검증이 아니다.

## 11. XSS와 출력

- 사용자 입력을 HTML로 직접 렌더링하지 않는다.
- 필요하지 않으면 `dangerouslySetInnerHTML`을 사용하지 않는다.
- HTML이 필요한 경우 context에 맞는 encoding 또는 sanitization을 사용한다.
- URL, 링크, 전화번호, 공유 문자열에 외부 입력을 넣을 때 scheme과 길이를 검증한다.
- CSP는 실제 외부 리소스와 Supabase 연결을 확인한 후 적용한다.

## 12. 개인정보 최소화

- 화면과 endpoint별 필요한 필드를 정의한다.
- `select('*')`는 실제로 모든 필드가 필요한지 검토한다.
- `raw_data`를 그대로 클라이언트에 반환하지 않는다.
- 내부 관리 화면이라도 역할별 필요 범위를 구분한다.
- 목록 응답에는 상세 화면에서만 필요한 개인정보를 포함하지 않는다.
- 공개 고객 응답에는 해당 고객의 해당 예약 정보만 포함한다.
- 보존기간이 지난 로그와 설문의 삭제·익명화 정책을 별도로 정한다.

## 13. Logging과 오류 응답

기록할 수 있는 보안 이벤트:

- 로그인 성공·실패
- 권한 거부
- 체크인 인증 성공·실패
- token 만료·폐기
- 세션 생성·종료
- 비정상 반복 요청
- 중요한 예약·숙소·청소 상태 변경
- webhook 검증 실패
- 동기화 부분 실패

로그에 직접 기록하지 않는 정보:

- Password
- Beds24 token과 Supabase service role key
- access/refresh/session token
- 도어락 비밀번호
- 카드·결제정보
- webhook 전체 원문
- 불필요한 고객 이름·전화번호·이메일

- 예약 추적이 필요하면 최소 식별자만 사용한다.
- 클라이언트에는 내부 DB 메시지나 외부 API 원문을 그대로 반환하지 않는다.
- 서버 로그에는 correlation ID와 안정적인 오류 코드를 사용할 수 있다.

## 14. Security Headers

운영 환경에서 다음을 검토한다.

- `Strict-Transport-Security`
- `Content-Security-Policy`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`

현재 사용 중인 Supabase Realtime, 외부 링크, 이미지, font와 호환되는지 확인하고 적용한다. 정책 변경은 사용자 승인을 받는다.

## 15. DB와 RLS

- Supabase service role은 RLS를 우회하므로 서버 전용으로 제한한다.
- anon Realtime 구독 테이블은 RLS와 publication payload를 확인한다.
- 사용자 session 클라이언트와 service-role 클라이언트의 책임을 구분한다.
- schema, constraint, index, RLS 변경은 migration으로 버전 관리한다.
- Dashboard에서만 수행한 변경을 저장소 상태로 간주하지 않는다.
- migration에는 적용 순서, 데이터 영향, 복구 방법을 기록한다.

## 16. 보안 변경 절차

1. 보호할 데이터 확인
2. 공격 가능한 endpoint 확인
3. 현재 코드와 Git 이력에서 기존 의도 확인
4. Authentication 요구사항 확인
5. Authorization과 객체 권한 확인
6. 세션과 Cookie 구조 확인
7. 개인정보 응답·로그 범위 확인
8. Rate Limit, CSRF, XSS, 입력 검증 확인
9. 최소 변경 계획과 호환 전략 제시
10. 사용자 승인
11. 별도 브랜치에서 구현
12. 401/403/성공 및 공격 케이스 테스트
13. 기존 운영 흐름 영향 확인
