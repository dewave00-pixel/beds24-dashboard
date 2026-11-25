import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { captureDailyInventorySnapshot, isMissingStrategyTableError } from '@/app/utils/inventorySnapshot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function isAdminOrCron(request: Request): Promise<boolean> {
    if (request.headers.get('x-vercel-cron') !== null) return true;
    const cookieStore = await cookies();
    return cookieStore.get('auth_role')?.value === 'admin';
}

export async function GET(request: Request) {
    if (!(await isAdminOrCron(request))) {
        return NextResponse.json({ success: false, error: '관리자만 조회할 수 있습니다.' }, { status: 403 });
    }

    try {
        const { data, error } = await supabase
            .from('daily_inventory_snapshots')
            .select('snapshot_date, target_date, lead_days, property_id, room_id, price, min_stay, num_avail, override_type')
            .order('snapshot_date', { ascending: false })
            .order('target_date', { ascending: true })
            .limit(3000);

        if (error) {
            if (isMissingStrategyTableError(error)) {
                return NextResponse.json({
                    success: true,
                    tableReady: false,
                    dates: [],
                    latestRows: [],
                });
            }
            throw error;
        }

        const rows = (data || []) as Array<{ snapshot_date: string } & Record<string, unknown>>;
        const dateCounts = new Map<string, number>();
        for (const r of rows) {
            dateCounts.set(r.snapshot_date, (dateCounts.get(r.snapshot_date) || 0) + 1);
        }

        const latestDate = rows[0]?.snapshot_date || null;
        const latestRows = latestDate ? rows.filter((r) => r.snapshot_date === latestDate) : [];

        return NextResponse.json({
            success: true,
            tableReady: true,
            latestDate,
            dates: Array.from(dateCounts.entries()).map(([date, count]) => ({ date, count })),
            latestRows,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '스냅샷 조회 실패';
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

export async function POST(request: Request) {
    if (!(await isAdminOrCron(request))) {
        return NextResponse.json({ success: false, error: '관리자만 실행할 수 있습니다.' }, { status: 403 });
    }

    const result = await captureDailyInventorySnapshot(90);
    return NextResponse.json(result, { status: result.success ? 200 : result.tableReady ? 500 : 400 });
}
