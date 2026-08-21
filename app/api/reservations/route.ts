import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getValidBeds24Token } from '../../utils/beds24Client';
import { upsertBookingsToSupabase, syncAllBookingsWithSupabase } from '../../utils/bookingSync';

export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Beds24 API에서 전체 예약을 긁어와 Supabase에 동기화하는 헬퍼 함수
async function syncFromBeds24(): Promise<any[]> {
    const accessToken = await getValidBeds24Token();
    const propertyIds = [267332, 265909, 269337, 269340, 269386, 269419, 267335];

    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 60);
    const toDate = new Date(today);
    toDate.setDate(today.getDate() + 365);

    const arrivalFrom = fromDate.toISOString().split('T')[0];
    const arrivalTo = toDate.toISOString().split('T')[0];

    let allBookings: any[] = [];

    for (const propId of propertyIds) {
        let page = 1;
        let hasNextPage = true;

        while (hasNextPage) {
            const url = `https://api.beds24.com/v2/bookings?propertyId=${propId}&arrivalFrom=${arrivalFrom}&arrivalTo=${arrivalTo}&limit=100&page=${page}&includeInfoItems=true&includeInvoice=true`;

            let res = await fetch(url, {
                method: 'GET',
                headers: {
                    'token': accessToken,
                    'accept': 'application/json',
                },
                cache: 'no-store',
            });

            if (res.status === 429) {
                console.warn(`⚠️ [Beds24] 숙소 ${propId} 429 감지 -> 2초 대기 후 재시도`);
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
                if (data && data.data && Array.isArray(data.data)) {
                    allBookings = allBookings.concat(data.data);
                    hasNextPage = data.pages && data.pages.nextPageExists === true;
                    page++;
                } else if (Array.isArray(data)) {
                    allBookings = allBookings.concat(data);
                    hasNextPage = false;
                } else {
                    hasNextPage = false;
                }
            } else {
                console.error(`❌ [Beds24 API Error] 숙소 ${propId} 조회 실패: ${res.status}`);
                hasNextPage = false;
            }

            await sleep(250);
        }
    }

    // Supabase에 완전 동기화 및 삭제된 유령 예약 자동 청소 (Reconciliation)
    if (allBookings.length > 0) {
        await syncAllBookingsWithSupabase(allBookings, arrivalFrom, arrivalTo);
    }

    return allBookings;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const forceSync = searchParams.get('sync') === 'true';

        // 1. 강제 동기화 요청(?sync=true)인 경우 Beds24에서 직접 긁어와 동기화
        if (forceSync) {
            console.log('🔄 [Reservations] 수동 동기화 요청 감지 -> Beds24 직접 동기화 실행');
            const syncedData = await syncFromBeds24();
            return NextResponse.json({
                success: true,
                count: syncedData.length,
                data: syncedData,
                source: 'beds24_synced',
            });
        }

        // 2. 평상시: Supabase bookings 테이블에서 슬림 컬럼 초고속 조회! (60KB 초경량)
        const today = new Date();
        const pastDate = new Date(today);
        pastDate.setDate(today.getDate() - 45);
        const pastDateStr = pastDate.toISOString().split('T')[0];

        const { data: dbBookings, error } = await supabase
            .from('bookings')
            .select('id, property_id, room_id, unit_id, arrival, departure, first_name, last_name, num_guests, status, api_source_id, price, notes')
            .gte('departure', pastDateStr)
            .neq('status', 'cancelled')
            .neq('status', 'deleted')
            .neq('status', 'inquiry')
            .order('arrival', { ascending: true });

        // 만약 DB 조회가 성공했고 데이터가 있으면 즉시 반환
        if (!error && dbBookings && dbBookings.length > 0) {
            const formatted = dbBookings.map((row) => ({
                id: row.id,
                propertyId: row.property_id,
                propId: row.property_id,
                roomId: row.room_id,
                unitId: row.unit_id,
                arrival: row.arrival,
                departure: row.departure,
                firstName: row.first_name || '',
                lastName: row.last_name || '',
                numAdult: row.num_guests || 1,
                numChild: 0,
                status: row.status || 'confirmed',
                apiSourceId: row.api_source_id,
                price: row.price || 0,
                notes: row.notes || '',
            }));

            return NextResponse.json({
                success: true,
                count: formatted.length,
                data: formatted,
                source: 'supabase_cache',
            });
        }

        // 3. Supabase DB가 비어있는 경우(초기 상태) 자동 동기화 실행 (Fallback)
        console.log('⚠️ [Reservations] Supabase DB가 비어있음 -> 최초 자동 동기화 실행');
        const fallbackData = await syncFromBeds24();

        return NextResponse.json({
            success: true,
            count: fallbackData.length,
            data: fallbackData,
            source: 'beds24_initial_sync',
        });

    } catch (error) {
        console.error('❌ [Reservations Error]:', error);
        return NextResponse.json({
            error: '예약 데이터 조회 중 에러가 발생했습니다.',
            details: String(error),
        }, { status: 500 });
    }
}