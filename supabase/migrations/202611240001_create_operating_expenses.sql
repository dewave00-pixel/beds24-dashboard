-- 숙소 운영 비용(지출) 관리 테이블
CREATE TABLE IF NOT EXISTS public.operating_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date DATE NOT NULL,
    property_name TEXT NOT NULL DEFAULT 'all', -- 'all'(공통), 'WAVE', 'YEONNAM', 'Green', 'Horang'
    unit_key TEXT,                             -- 특정 호실 지정 시 (선택)
    category TEXT NOT NULL DEFAULT 'other',    -- 'cleaning', 'supplies', 'utilities', 'repair', 'rent', 'tax_fee', 'other'
    amount INTEGER NOT NULL CHECK (amount >= 0),
    payment_method TEXT NOT NULL DEFAULT 'card', -- 'card'(사업자카드), 'tax_invoice'(세금계산서/이체), 'cash_receipt'(현금영수증), 'other'(기타/미증빙)
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE, -- 매월 고정비 여부
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operating_expenses_date
    ON public.operating_expenses (expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_operating_expenses_property
    ON public.operating_expenses (property_name, expense_date DESC);
