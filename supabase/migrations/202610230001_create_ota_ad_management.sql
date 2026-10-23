create table if not exists public.ota_ad_settings (
    api_source_id integer primary key check (api_source_id in (46, 19, 17, 53, 14)),
    channel_name text not null,
    cpc_amount integer check (cpc_amount is null or cpc_amount >= 0),
    cpb_rate numeric(5, 2) check (cpb_rate is null or (cpb_rate >= 0 and cpb_rate <= 100)),
    note text not null default '',
    updated_at timestamptz not null default now()
);

create table if not exists public.ota_ad_charges (
    id uuid primary key default gen_random_uuid(),
    api_source_id integer not null check (api_source_id = 53),
    channel_name text not null,
    charge_date date not null,
    amount integer not null check (amount > 0),
    note text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists ota_ad_charges_source_date_idx
    on public.ota_ad_charges (api_source_id, charge_date desc);

alter table public.ota_ad_settings enable row level security;
alter table public.ota_ad_charges enable row level security;

insert into public.ota_ad_settings (api_source_id, channel_name)
values
    (46, 'Airbnb'),
    (19, 'Booking.com'),
    (17, 'Agoda'),
    (53, 'Trip.com'),
    (14, 'Expedia')
on conflict (api_source_id) do nothing;

comment on table public.ota_ad_settings is
    'OTA별 현재 CPC/CPB 책정값. CPB는 참고용이며 매출에서 중복 차감하지 않는다.';

comment on table public.ota_ad_charges is
    '실제로 결제된 OTA 광고비 원장. Trip.com CPC 선충전액을 충전일 기준으로 매출에서 차감한다.';
