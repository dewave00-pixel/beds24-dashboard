# 프로젝트 컨텍스트

## 1. 목적

Beds24 Reservation Dashboard는 Beds24 API V2의 예약 데이터를 Supabase에 동기화하고, 숙소 운영자가 예약·청소·숙소 정보·매출 분석을 한 곳에서 확인하는 내부 운영 도구다.

대규모 PMS를 새로 만드는 것이 목적이 아니다. Beds24를 예약 원본으로 유지하면서 현재 운영에 필요한 조회와 제한된 수정 기능을 제공한다.

## 2. 기술 스택

- Next.js 16 App Router
- React 19
- TypeScript strict mode
- Tailwind CSS 4 및 `app/dashboard.css`
- Supabase Auth, Database, Realtime
- Beds24 API V2
- Vercel 배포 및 Vercel Cron

주요 명령:

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## 3. 현재 화면

| 경로 | 목적 | 현재 주요 사용자 |
|---|---|---|
| `/` | 예약 타임라인, 검색, 메모, 호실 배정, 연박 연장 | admin, manager |
| `/analytics` | 매출, 가동률, ADR, 공실, OTA 분석 | admin |
| `/cleaning` | 전체 청소 배정 | admin |
| `/cleaning/my` | 본인 청소 목록과 완료 처리 | manager, staff |
| `/properties` | 숙소 정보와 도어락 비밀번호 조회·관리 | admin, manager, staff |
| `/checkin` | 입실 현황, 체크인 로그, 게스트 케어 설문 관리 | admin |
| `/login` | 짧은 아이디 또는 이메일 기반 로그인 | 공개 |

역할별 최종 정책은 [AUTHORIZATION.md](AUTHORIZATION.md)를 따른다.

## 4. 체크인 용어 구분

### 내부 체크인 관리

- 현재 `/checkin` 화면이다.
- 운영자가 오늘 입실 현황, 인증 로그, 게스트 케어 설문을 확인한다.
- 외부 고객에게 공개하는 페이지가 아니다.

### 공개 고객 체크인

- 외부 고객이 예약을 인증하고 체크인 정보를 입력하거나 도어락 정보를 확인하는 기능이다.
- 현재 내부 `/checkin`과 별도 경로·API·보안 경계를 사용해야 한다.
- 예약번호만으로 접근을 허용하지 않는다.
- 구현 시 [SECURITY.md](SECURITY.md)의 공개 체크인 규칙을 따른다.

## 5. 주요 데이터 저장소

### Beds24 원본 데이터

- 예약 ID와 상태
- property, room, unit 배정
- 입실일과 퇴실일
- 투숙객과 인원 정보
- 예약 금액과 OTA 출처
- Beds24 notes 및 원본 응답

### Supabase 예약 read model

- `bookings`
- Beds24 데이터를 대시보드에서 빠르게 조회하기 위한 복제 데이터다.
- Beds24와 불일치할 수 있으므로 웹훅·증분·전체 동기화로 복구한다.

### 애플리케이션 소유 데이터

- `booking_notes`: 내부 메모와 태그
- `cleaning_assignments`: 날짜·호실별 청소 배정과 완료 상태
- `properties_info`: 도어락 비밀번호, 최대 인원, 수리 메모
- `user_profiles`: 사용자 이름, 역할, staff 연결
- `checkin_logs`: 체크인 관련 이벤트
- `guest_care_surveys`: 게스트 케어 설문

DB schema와 RLS는 현재 저장소에서 migration으로 충분히 확인되지 않는다. DB 변경 작업을 시작하기 전에 실제 Supabase schema, constraint, RLS, Realtime publication을 별도로 확인해야 한다.

## 6. 주요 코드 위치

```text
app/
├── api/                  Next.js Route Handlers
├── components/           화면 컴포넌트
├── hooks/                화면 상태와 데이터 호출
├── utils/                예약, 날짜, 분석, 동기화 로직
├── config.ts             숙소, 호실, 채널, 수수료, 공휴일 정책
└── types.ts              공통 UI/domain 타입

lib/
├── supabase.ts           서버 service-role 클라이언트
└── supabaseClient.ts     브라우저 Realtime용 anon 클라이언트
```

## 7. 현재 알려진 품질 기준선

- 프로덕션 build는 성공한다.
- lint에는 기존 오류와 경고가 존재한다.
- 자동화 테스트 파일과 Supabase migration은 현재 저장소에서 확인되지 않는다.
- Next.js 16은 `middleware.ts`에서 `proxy.ts`로의 전환을 권고한다.

작업 시 기존 기준선을 기록하고 신규 오류를 추가하지 않는다. 전체 lint 정리나 테스트 기반 구축은 기능 작업에 임의로 섞지 않는다.

## 8. 프로젝트에서 중요하게 보는 운영 경험

- 예약 데이터가 누락되지 않아야 한다.
- 일부 API 실패가 기존 정상 예약 삭제로 이어지면 안 된다.
- 모바일에서도 청소 직원이 빠르게 업무와 도어락 정보를 확인할 수 있어야 한다.
- admin, manager, staff의 권한과 화면 흐름을 유지해야 한다.
- 분석 결과의 매출·수수료·가동률 정의가 화면마다 달라지면 안 된다.
- 외부 시스템 실패가 사용자에게 완전 성공으로 오인되지 않아야 한다.
