import { NextResponse } from 'next/server';
import { getValidBeds24Token } from '@/app/utils/beds24Client';
import { upsertBookingsToSupabase, deleteBookingFromSupabase } from '@/app/utils/bookingSync';

export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PROPERTY_IDS = [267332, 265909, 269337, 269340, 269386, 269419, 267335];

/**
 * ⚡ Beds24 초경량 증분 동기화 API (Incremental Sync)
 * 전체 예약을 전수조사하지 않고, 최근 N분 이내에 생성/수정/취소된 예약만 조회하여 Supabase에 반영합니다.
 * 호출 부하가 극소화되어 429 에러 위험이 없습니다.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        // 기본값: 최근 15분 전부터 변경된 내역 (분 단위 커스텀 지원: ?minutes=30)
        const minutes = Math.max(1, Math.min(1440, Number(searchParams.get('minutes')) || 15));

        const now = new Date();
        const sinceDate = new Date(now.getTime() - minutes * 60 * 1000);
        
        // Beds24 V2 공식 스펙: modifiedFrom=YYYY-MM-DDTHH:MM:SS (UTC 기준)
        const pad = (n: number) => String(n).padStart(2, '0');
        const modifiedFrom = `${sinceDate.getUTCFullYear()}-${pad(sinceDate.getUTCMonth() + 1)}-${pad(sinceDate.getUTCDate())}T${pad(sinceDate.getUTCHours())}:${pad(sinceDate.getUTCMinutes())}:${pad(sinceDate.getUTCSeconds())}`;
        console.log(`🔍 [Incremental Sync] Beds24 modifiedFrom 쿼리: "${modifiedFrom}" (UTC)`);

        const accessToken = await getValidBeds24Token();

        let modifiedBookings: any[] = [];
        let errors: any[] = [];

        for (const propId of PROPERTY_IDS) {
            const url = `https://api.beds24.com/v2/bookings?propertyId=${propId}&modifiedFrom=${encodeURIComponent(modifiedFrom)}&includeInfoItems=true&includeInvoice=true`;

            let res = await fetch(url, {
                method: 'GET',
                headers: {
                    'token': accessToken,
                    'accept': 'application/json',
                },
                cache: 'no-store',
            });

            // 429 감지 시 2초 대기 후 1회 재시도
            if (res.status === 429) {
                console.warn(`⚠️ [Incremental Sync] 숙소 ${propId} 429 감지 -> 2초 대기 후 재시도`);
                await sleep(2000);
                res = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'token': accessToken,
                        'accept': 'application/json',
                    },
                    cache: 'no-store',
                });
            }

            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
                if (list.length > 0) {
                    console.log(`🔎 [Beds24 Debug] 숙소 ${propId} 첫번째 아이템 날짜필드:`, {
                        id: list[0]?.id,
                        arrival: list[0]?.arrival,
                        departure: list[0]?.departure,
                        bookingTime: list[0]?.bookingTime,
                        modified: list[0]?.modified,
                        masterId: list[0]?.masterId,
                        status: list[0]?.status,
                    });
                    modifiedBookings = modifiedBookings.concat(list);
                }
            } else {
                errors.push({ propertyId: propId, status: res.status });
            }

            // API 부하 방지를 위한 미세 딜레이
            await sleep(150);
        }

        console.log(`⚡ [Incremental Sync] 최근 ${minutes}분간 변경된 예약 감지: ${modifiedBookings.length}건`);

        // 변경된 예약 분류 (취소/삭제 건 vs 활성 예약 건)
        let upsertCount = 0;
        let deleteCount = 0;

        const activeToUpsert: any[] = [];

        for (const item of modifiedBookings) {
            const bookingId = Number(item.id || item.bookId);
            const isCancelledOrDeleted =
                item.status === 'cancelled' ||
                item.status === 'deleted' ||
                item.status === 'inquiry' ||
                item.action === 'delete';

            if (isCancelledOrDeleted && bookingId) {
                await deleteBookingFromSupabase(bookingId);
                deleteCount++;
            } else {
                activeToUpsert.push(item);
            }
        }

        if (activeToUpsert.length > 0) {
            const upsertRes = await upsertBookingsToSupabase(activeToUpsert);
            if (upsertRes.success) {
                upsertCount = upsertRes.count;
            }
        }

        return NextResponse.json({
            success: true,
            syncedAt: now.toISOString(),
            windowMinutes: minutes,
            modifiedFromQuery: modifiedFrom,
            totalDetected: modifiedBookings.length,
            upsertCount,
            deleteCount,
            sample: modifiedBookings[0] ? {
                id: modifiedBookings[0].id,
                arrival: modifiedBookings[0].arrival,
                departure: modifiedBookings[0].departure,
                bookingTime: modifiedBookings[0].bookingTime,
                modified: modifiedBookings[0].modified,
                status: modifiedBookings[0].status,
            } : null,
            errors: errors.length > 0 ? errors : undefined,
        });

    } catch (err: any) {
        console.error('❌ [Incremental Sync Error]:', err);
        return NextResponse.json(
            { success: false, error: err.message || '증분 동기화 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
