-- 202610280001_expand_ota_ad_charges.sql
-- OTA 광고 충전금 다중 OTA 지원, 결제 방식(정산금 차감 vs 카드 결제) 및 적용 숙소 컬럼 추가

-- 1. api_source_id 체크 제약조건 완화 (기존 Trip.com(53) 전용 -> 5대 OTA 지원)
alter table public.ota_ad_charges drop constraint if exists ota_ad_charges_api_source_id_check;
alter table public.ota_ad_charges add constraint ota_ad_charges_api_source_id_check 
    check (api_source_id in (46, 19, 17, 53, 14));

-- 2. 결제 방식 컬럼 추가 (settlement_deduction: 정산금 차감 / card: 카드 직접 결제)
alter table public.ota_ad_charges 
    add column if not exists payment_method text not null default 'settlement_deduction'
        check (payment_method in ('settlement_deduction', 'card'));

-- 3. 적용 대상 숙소 컬럼 추가 (all: 전체 공통 / YEONNAM / WAVE / Green / Namsun)
alter table public.ota_ad_charges 
    add column if not exists target_property text not null default 'all';

-- 4. 조회 인덱스 추가
create index if not exists ota_ad_charges_target_prop_idx
    on public.ota_ad_charges (target_property, charge_date desc);

-- 5. 코멘트 추가
comment on column public.ota_ad_charges.payment_method is
    '결제 방식: settlement_deduction(OTA 정산금 차감 - 매출 차감 반영), card(카드 직접 결제 - 별도 비용 집계)';

comment on column public.ota_ad_charges.target_property is
    '적용 숙소: all(전체 공통), YEONNAM(연남), WAVE(웨이브), Green(그린), Namsun(남선)';
