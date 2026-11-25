import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isMissingStrategyTableError } from '@/app/utils/inventorySnapshot';

export const dynamic = 'force-dynamic';

export type StrategySourceType = 'pricelabs' | 'beds24' | 'ota_promo' | 'ota_ads' | 'operation';

export interface StrategyEventItem {
    id: string;
    eventDate: string;
    endDate?: string | null;
    sourceType: StrategySourceType;
    propertyName: string;
    unitKey?: string | null;
    channelId?: number | null;
    title: string;
    ruleDetail: string;
    compareDays: number;
    createdAt: string;
}

const FALLBACK_BOOKING_ID = -999300;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_SOURCES = new Set<StrategySourceType>([
    'pricelabs',
    'beds24',
    'ota_promo',
    'ota_ads',
    'operation',
]);
const ALLOWED_PROPERTIES = new Set(['all', 'WAVE', 'YEONNAM', 'Green', 'Horang']);
const ALLOWED_COMPARE_DAYS = new Set([7, 14, 28, 30]);

async function isAdminRequest(): Promise<boolean> {
    const cookieStore = await cookies();
    return cookieStore.get('auth_role')?.value === 'admin';
}

function unauthorizedResponse() {
    return NextResponse.json(
        { success: false, error: '전략/제안 관리는 최고관리자(admin)만 사용할 수 있습니다.' },
        { status: 403 }
    );
}

async function readFallbackEvents(): Promise<StrategyEventItem[]> {
    const { data, error } = await supabase
        .from('booking_notes')
        .select('note')
        .eq('booking_id', FALLBACK_BOOKING_ID)
        .maybeSingle();

    if (error || !data?.note) return [];
    try {
        const parsed = JSON.parse(data.note);
        return Array.isArray(parsed) ? (parsed as StrategyEventItem[]) : [];
    } catch {
        return [];
    }
}

async function writeFallbackEvents(list: StrategyEventItem[]): Promise<void> {
    const sorted = [...list].sort(
        (a, b) => b.eventDate.localeCompare(a.eventDate) || b.createdAt.localeCompare(a.createdAt)
    );
    const { error } = await supabase
        .from('booking_notes')
        .upsert(
            {
                booking_id: FALLBACK_BOOKING_ID,
                note: JSON.stringify(sorted),
                tags: ['system_strategy_events'],
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'booking_id' }
        );
    if (error) throw error;
}

interface DbStrategyRow {
    id: string;
    event_date: string;
    end_date?: string | null;
    source_type: StrategySourceType;
    property_name: string;
    unit_key?: string | null;
    channel_id?: number | null;
    title: string;
    rule_detail: string;
    compare_days: number;
    created_at: string;
}

function mapDbRow(row: DbStrategyRow): StrategyEventItem {
    return {
        id: String(row.id),
        eventDate: row.event_date,
        endDate: row.end_date || null,
        sourceType: ALLOWED_SOURCES.has(row.source_type) ? row.source_type : 'pricelabs',
        propertyName: row.property_name || 'all',
        unitKey: row.unit_key || null,
        channelId: row.channel_id ?? null,
        title: row.title || '',
        ruleDetail: row.rule_detail || '',
        compareDays: ALLOWED_COMPARE_DAYS.has(Number(row.compare_days)) ? Number(row.compare_days) : 14,
        createdAt: row.created_at || new Date().toISOString(),
    };
}

export async function GET() {
    if (!(await isAdminRequest())) return unauthorizedResponse();

    try {
        const { data, error } = await supabase
            .from('strategy_events')
            .select('id, event_date, end_date, source_type, property_name, unit_key, channel_id, title, rule_detail, compare_days, created_at')
            .order('event_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            if (isMissingStrategyTableError(error)) {
                const fallback = await readFallbackEvents();
                return NextResponse.json({
                    success: true,
                    storage: 'fallback_store',
                    data: fallback,
                });
            }
            throw error;
        }

        return NextResponse.json({
            success: true,
            storage: 'strategy_events',
            data: ((data || []) as DbStrategyRow[]).map(mapDbRow),
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '전략 이력 조회 실패';
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

export async function POST(request: Request) {
    if (!(await isAdminRequest())) return unauthorizedResponse();

    try {
        const body = await request.json();
        const eventDate = typeof body.eventDate === 'string' ? body.eventDate.trim() : '';
        const endDate = typeof body.endDate === 'string' && DATE_PATTERN.test(body.endDate.trim())
            ? body.endDate.trim()
            : null;
        const sourceType: StrategySourceType = ALLOWED_SOURCES.has(body.sourceType) ? body.sourceType : 'pricelabs';
        const propertyName = typeof body.propertyName === 'string' && ALLOWED_PROPERTIES.has(body.propertyName)
            ? body.propertyName
            : 'all';
        const unitKey = typeof body.unitKey === 'string' && body.unitKey.trim() ? body.unitKey.trim() : null;
        const channelId = body.channelId !== undefined && body.channelId !== null && body.channelId !== ''
            ? Number(body.channelId)
            : null;
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        const ruleDetail = typeof body.ruleDetail === 'string' ? body.ruleDetail.trim() : '';
        const compareDays = ALLOWED_COMPARE_DAYS.has(Number(body.compareDays)) ? Number(body.compareDays) : 14;

        if (!DATE_PATTERN.test(eventDate)) {
            return NextResponse.json({ success: false, error: '유효한 적용 시작일(YYYY-MM-DD)을 입력해 주세요.' }, { status: 400 });
        }
        if (!title || title.length > 150) {
            return NextResponse.json({ success: false, error: '변경 제목을 1~150자 이내로 입력해 주세요.' }, { status: 400 });
        }
        if (ruleDetail.length > 1000) {
            return NextResponse.json({ success: false, error: '상세 내용은 1000자 이하로 입력해 주세요.' }, { status: 400 });
        }

        const { error } = await supabase.from('strategy_events').insert({
            event_date: eventDate,
            end_date: endDate,
            source_type: sourceType,
            property_name: propertyName,
            unit_key: unitKey,
            channel_id: channelId,
            title,
            rule_detail: ruleDetail,
            compare_days: compareDays,
        });

        if (error) {
            if (isMissingStrategyTableError(error)) {
                const all = await readFallbackEvents();
                const item: StrategyEventItem = {
                    id: `stg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    eventDate,
                    endDate,
                    sourceType,
                    propertyName,
                    unitKey,
                    channelId,
                    title,
                    ruleDetail,
                    compareDays,
                    createdAt: new Date().toISOString(),
                };
                await writeFallbackEvents([item, ...all]);
                return NextResponse.json({ success: true, item });
            }
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '전략 이력 저장 실패';
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    if (!(await isAdminRequest())) return unauthorizedResponse();

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ success: false, error: '삭제할 ID가 필요합니다.' }, { status: 400 });
        }

        const { error } = await supabase.from('strategy_events').delete().eq('id', id);
        if (error) {
            if (isMissingStrategyTableError(error)) {
                const all = await readFallbackEvents();
                await writeFallbackEvents(all.filter((i) => i.id !== id));
                return NextResponse.json({ success: true });
            }
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '전략 이력 삭제 실패';
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
