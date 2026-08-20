import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getValidBeds24Token } from '../../utils/beds24Client';
import { upsertBookingsToSupabase } from '../../utils/bookingSync';

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

    // Supabase에 저장
    if (allBookings.length > 0) {
        await upsertBookingsToSupabase(allBookings);
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

        // 2. 평상시: Supabase bookings 테이블에서 0.05초 초고속 조회!
        const { data: dbBookings, error } = await supabase
            .from('bookings')
            .select('*')
            .order('arrival', { ascending: true });

        // 만약 DB 조회가 성공했고 데이터가 있으면 바로 반환
        if (!error && dbBookings && dbBookings.length > 0) {
            // raw_data가 있으면 프론트엔드가 요구하는 전체 포맷을 유지하고, 없을 시 row 자체 매핑
            const formatted = dbBookings.map((row) => {
                if (row.raw_data && typeof row.raw_data === 'object') {
                    return {
                        ...row.raw_data,
                        id: row.id,
                        arrival: row.arrival,
                        departure: row.departure,
                        roomId: row.room_id,
                        unitId: row.unit_id,
                        propertyId: row.property_id,
                        propId: row.property_id,
                        price: row.price,
                        status: row.status,
                    };
                }
                return {
                    id: row.id,
                    propertyId: row.property_id,
                    propId: row.property_id,
                    roomId: row.room_id,
                    unitId: row.unit_id,
                    arrival: row.arrival,
                    departure: row.departure,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    numAdult: row.num_guests || 1,
                    numChild: 0,
                    status: row.status,
                    apiSourceId: row.api_source_id,
                    price: row.price,
                    notes: row.notes,
                };
            });

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