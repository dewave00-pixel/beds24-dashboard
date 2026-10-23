# Beds24 동기화 Runbook

## 1. 목적

Beds24 예약이 Supabase와 대시보드에 누락 없이 반영되도록 여러 동기화 수단의 역할과 데이터 안전 규칙을 정의한다.

Beds24가 예약 원본이고 Supabase `bookings`는 read model이다.

## 2. 동기화 계층

```text
Beds24 Webhook
    ↓ 실시간 변경 반영
Incremental Sync
    ↓ 웹훅 누락 및 최근 변경 보완
Daily Cron
    ↓ 장시간 누락 보완
Manual Full Sync
    ↓ 운영자 복구와 전체 정합성 확인
Reconciliation
    ↓ Beds24에 없는 캐시 데이터 정리
```

각 계층은 다른 장애를 보완한다. 하나가 존재한다는 이유로 다른 계층을 제거하지 않는다.

## 3. Webhook

목적:

- 예약 생성·수정·취소를 가능한 빠르게 반영
- 전체 조회 없이 변경된 예약만 처리

현재 호환 요구:

- Beds24 연결 테스트의 빈 payload가 있을 수 있다.
- JSON 외 form/query 형태가 들어올 가능성을 기존 코드가 고려한다.
- 취소, 삭제, inquiry와 `action=delete`를 구분한다.

보안과 안정성:

- provider 검증 또는 별도 webhook secret을 사용한다.
- 먼저 인증하고 그다음 payload를 파싱·처리한다.
- body 크기와 허용 필드를 제한한다.
- property ID가 관리 대상인지 확인한다.
- 재전송과 중복 처리에 대해 멱등해야 한다.
- 전체 payload와 개인정보를 로그에 남기지 않는다.
- 검증 실패와 처리 실패를 구분한다.

## 4. Incremental Sync

목적:

- 최근 수정된 예약만 `modifiedFrom`으로 조회
- 웹훅 누락 보완
- 전체 동기화보다 Beds24 호출량 절감

현재 고려사항:

- 시간 경계 누락을 피하기 위한 overlap buffer가 있다.
- Supabase upsert가 멱등하다는 전제로 일부 구간을 다시 조회한다.
- property별 호출 사이에 짧은 지연과 429 재시도가 있다.
- 대시보드 진입 시 최근 변경을 보완하는 흐름이 있다.
- Vercel Cron이 정기적으로 실행한다.

변경 시 확인:

- `modifiedFrom` timezone과 Beds24 형식
- overlap 크기
- pagination 필요 여부
- 모든 property의 성공 여부
- 취소·삭제 반영
- 429와 timeout
- 같은 예약 중복 upsert

## 5. Full Sync

목적:

- 지정된 과거·미래 범위의 전체 예약 재조회
- 초기 DB 구성
- 누락 복구
- reconciliation에 필요한 원본 목록 확보

위험:

- 호출량과 서버리스 실행 시간
- pagination 누락
- 일부 property 실패
- 불완전한 목록을 기준으로 한 오삭제
- 동시에 실행되는 여러 sync

수동 실행은 admin으로 제한하고, GET 상태 변경 대신 명시적인 mutation 요청을 우선한다. 브라우저 테스트 호환이 필요하면 인증과 용도를 분리한다.

## 6. Reconciliation 안전장치

기본 순서:

```text
Beds24 전체 조회
    ↓
유효 예약 upsert
    ↓
모든 property 조회 성공 여부 확인
    ↓
동일 조회 범위의 DB 예약과 비교
    ↓
비정상 대량 삭제 여부 확인
    ↓
안전한 범위만 삭제
```

불변조건:

- 한 property라도 조회 실패하면 ghost 삭제를 수행하지 않는다.
- Beds24 결과가 비어 있다는 이유만으로 DB 예약을 전부 삭제하지 않는다.
- 현재 코드의 대량 삭제 임계값을 변경하거나 제거하려면 승인받는다.
- 삭제 비교는 같은 날짜 범위와 같은 관리 property를 사용한다.
- 유효하지 않은 상태 정리와 ghost 정리를 구분한다.
- 삭제 대상 ID와 개수는 민감정보 없이 감사 가능하게 기록한다.
- chunk 삭제 중 일부 실패를 전체 성공으로 보고하지 않는다.

## 7. 외부 API 재시도

- 429, 5xx, network timeout을 구분한다.
- 재시도 횟수는 제한한다.
- `Retry-After`가 있으면 우선 고려한다.
- 여러 property 요청에 jitter/backoff를 검토한다.
- 인증 오류를 일반 rate limit처럼 재시도하지 않는다.
- mutation 재시도 전 멱등성을 확인한다.
- 실패 후 token 값이나 외부 응답의 개인정보를 로그에 남기지 않는다.

## 8. 예약 Mutation과 캐시 반영

호실 배정과 연박 연장 같은 예약 변경:

```text
입력·권한 검증
    ↓
현재 예약 조회
    ↓
충돌·업무 규칙 검증
    ↓
Beds24 mutation
    ↓
Supabase 캐시 반영
```

Beds24 성공 후 Supabase 실패 시:

- 원본 변경은 성공했으므로 무조건 rollback됐다고 가정하지 않는다.
- 응답을 완전 성공으로만 표시하지 않는다.
- 부분 성공 상태와 운영자 안내를 제공한다.
- 즉시 단건 재조회 또는 증분 동기화로 복구한다.
- 반복 실패를 추적한다.

## 9. 동시 실행과 멱등성

- 웹훅과 증분 동기화가 같은 예약을 동시에 처리할 수 있다.
- upsert 기준 key와 `updated_at` 의미를 확인한다.
- 오래된 응답이 최신 데이터를 덮어쓰지 않도록 Beds24 modified timestamp 사용을 검토한다.
- 전체 sync가 중복 실행되지 않도록 실행 lock 또는 job 상태가 필요한지 검토한다.
- 예약 mutation의 중복 제출이 금액을 두 번 더하지 않도록 한다.

## 10. 모니터링

최소 관찰 항목:

- 실행 시작·종료 시각
- 동기화 방식
- 조회한 property 수와 실패 수
- 감지, upsert, 취소·삭제, ghost 삭제 건수
- Beds24 429와 오류 상태
- 부분 성공 여부
- 실행 시간과 timeout
- 마지막 성공 동기화 시각

고객 이름, 전화번호, token, 전체 payload는 지표와 로그에 포함하지 않는다.

## 11. 장애 대응

### 웹훅 누락 의심

1. 마지막 webhook 처리 시각 확인
2. incremental sync 실행 결과 확인
3. 특정 예약의 Beds24 modified timestamp 확인
4. 필요한 경우 admin 수동 sync

### Beds24 일부 property 실패

1. ghost 삭제가 중단됐는지 확인
2. 성공 property의 upsert 결과 확인
3. 429 또는 인증 오류 구분
4. 제한된 재시도 후 다음 incremental/full sync로 복구

### Beds24 성공, Supabase 실패

1. 사용자에게 부분 성공 상태 표시
2. Beds24 원본 예약 확인
3. 단건 또는 증분 재동기화
4. 반복 실패 시 DB schema/RLS/constraint 확인

### 비정상 대량 삭제 감지

1. 자동 삭제 중단 유지
2. property별 API 응답과 pagination 확인
3. 조회 날짜 범위 확인
4. 사용자 승인 없이 안전 임계값을 우회하지 않음

## 12. 변경 체크리스트

- 기존 동기화 수단의 목적을 확인했는가?
- Beds24 API scope 변경이 필요한가?
- 실패한 property가 있을 때 삭제가 차단되는가?
- 빈 결과가 정상 empty인지 오류인지 구분되는가?
- pagination을 끝까지 처리하는가?
- 429 재시도가 제한되는가?
- mutation이 멱등한가?
- 부분 성공을 표현하는가?
- 민감정보를 로그에 남기지 않는가?
- 기존 누락 복구 흐름을 유지하는가?
