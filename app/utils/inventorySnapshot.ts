import { supabase } from '@/lib/supabase';
import { ALL_BEDS24_PROPERTY_IDS, getValidBeds24Token } from './beds24Client';
import { addDaysToDateStr, getKSTTodayStr } from './dateUtils';

export interface SnapshotRow {
    snapshot_date: string;
    target_date: string;
    lead_days: number;
    property_id: number;
    room_id: number;
    price: number;
    min_stay: number;
    num_avail: number;
    override_type: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isMissingStrategyTableError(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    const code = error.code || '';
    const msg = (error.message || '').toLowerCase();
    return (
        code === '42P01' ||
        code === 'PGRST205' ||
        msg.includes('does not exist') ||
        msg.includes('schema cache')
    );
}

/**
 * Beds24 V2 inventory/rooms/calendar에서 오늘(KST) ~ +90일치
 * 실제 판매가(price1), 최소박수(minStay), 재고(numAvail), 오버라이드를 수집해
 * daily_inventory_snapshots 테이블에 하루 1회 스냅샷으로 저장합니다.
 */
export async function captureDailyInventorySnapshot(
    daysAhead: number = 90
): Promise<{
    success: boolean;
    snapshotDate: string;
    rowCount: number;
    tableReady: boolean;
    message?: string;
    error?: string;
}> {
    const snapshotDate = getKSTTodayStr();
    const endDate = addDaysToDateStr(snapshotDate, daysAhead);

    try {
        const token = await getValidBeds24Token();
        const rowsMap = new Map<string, SnapshotRow>();

        const snapshotMs = Date.parse(`${snapshotDate}T00:00:00Z`);

        await Promise.all(
            ALL_BEDS24_PROPERTY_IDS.map(async (propId) => {
                const url = `https://api.beds24.com/v2/inventory/rooms/calendar?propertyId=${propId}&startDate=${snapshotDate}&endDate=${endDate}&includeNumAvail=true&includePrices=true&includeMinStay=true&includeOverride=true`;

                let res = await fetch(url, {
                    headers: { token, accept: 'application/json' },
                    cache: 'no-store',
                });

                if (res.status === 429) {
                    await sleep(2000);
                    res = await fetch(url, {
                        headers: { token, accept: 'application/json' },
                        cache: 'no-store',
                    });
                }

                if (!res.ok) {
                    console.warn(`⚠️ [Snapshot] 숙소 ${propId} 조회 실패 (${res.status})`);
                    return;
                }

                const json = await res.json();
                const rooms = Array.isArray(json?.data) ? json.data : [];

                for (const r of rooms) {
                    const roomId = Number(r.roomId);
                    if (!roomId || !Array.isArray(r.calendar)) continue;

                    for (const cal of r.calendar) {
                        const fromStr: string = cal.from;
                        const toStr: string = cal.to;
                        if (!fromStr || !toStr) continue;

                        const price = Math.round(Number(cal.price1 ?? cal.price ?? 0) || 0);
                        const minStay = Math.max(1, Number(cal.minStay ?? 1) || 1);
                        const numAvail = Number(cal.numAvail ?? 0) || 0;
                        const overrideType = typeof cal.override === 'string' ? cal.override : 'none';

                        let cur = fromStr;
                        let guard = 0;
                        while (cur <= toStr && guard < 120) {
                            guard++;
                            const targetMs = Date.parse(`${cur}T00:00:00Z`);
                            const leadDays = Math.round((targetMs - snapshotMs) / 86400000);

                            if (leadDays >= 0) {
                                rowsMap.set(`${roomId}_${cur}`, {
                                    snapshot_date: snapshotDate,
                                    target_date: cur,
                                    lead_days: leadDays,
                                    property_id: propId,
                                    room_id: roomId,
                                    price,
                                    min_stay: minStay,
                                    num_avail: numAvail,
                                    override_type: overrideType,
                                });
                            }
                            cur = addDaysToDateStr(cur, 1);
                        }
                    }
                }
            })
        );

        const rows = Array.from(rowsMap.values());
        if (rows.length === 0) {
            return {
                success: true,
                snapshotDate,
                rowCount: 0,
                tableReady: true,
                message: '수집된 캘린더 스냅샷 데이터가 없습니다.',
            };
        }

        const chunkSize = 500;
        for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const { error } = await supabase
                .from('daily_inventory_snapshots')
                .upsert(chunk, { onConflict: 'snapshot_date,room_id,target_date' });

            if (error) {
                if (isMissingStrategyTableError(error)) {
                    return {
                        success: false,
                        snapshotDate,
                        rowCount: rows.length,
                        tableReady: false,
                        error: 'daily_inventory_snapshots 테이블이 아직 생성되지 않았습니다. Supabase SQL Editor에서 202611250001 마이그레이션을 실행해 주세요.',
                    };
                }
                throw error;
            }
        }

        return {
            success: true,
            snapshotDate,
            rowCount: rows.length,
            tableReady: true,
            message: `${snapshotDate} 기준 향후 ${daysAhead}일 스냅샷 ${rows.length}건 저장 완료`,
        };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('❌ [Inventory Snapshot Error]:', err);
        return {
            success: false,
            snapshotDate,
            rowCount: 0,
            tableReady: true,
            error: msg,
        };
    }
}
