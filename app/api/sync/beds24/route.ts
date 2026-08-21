import { NextResponse } from 'next/server';
import { getValidBeds24Token } from '../../../utils/beds24Client';
import { upsertBookingsToSupabase, syncAllBookingsWithSupabase } from '../../../utils/bookingSync';

export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST() {
    try {
        console.log('🔄 [Beds24 Sync] 전체 예약 동기화 시작...');
        const accessToken = await getValidBeds24Token();

        // 7개 숙소 ID 목록
        const propertyIds = [267332, 265909, 269337, 269340, 269386, 269419, 267335];

        // 과거 60일 전 ~ 미래 365일 후 범위 설정
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
                    console.warn(`⚠️ [Beds24 Sync] 숙소 ${propId} 429 감지 -> 2초 대기 후 재시도`);
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
                    console.error(`❌ [Beds24 Sync] 숙소 ${propId} 조회 실패: ${res.status}`);
                    hasNextPage = false;
                }

                await sleep(250);
            }
        }

        console.log(`📥 [Beds24 Sync] Beds24에서 총 ${allBookings.length}건 예약 조회 완료. Supabase 완전 동기화 및 유령 예약 정리 중...`);

        // Supabase DB에 일괄 저장 및 삭제된 유령 예약 자동 청소 (Reconciliation)
        const saveResult = await syncAllBookingsWithSupabase(allBookings, arrivalFrom, arrivalTo);

        if (!saveResult.success) {
            return NextResponse.json({
                success: false,
                error: saveResult.error || 'Supabase 저장 실패',
                fetchedCount: allBookings.length,
            }, { status: 500 });
        }

        console.log(`✅ [Beds24 Sync] 동기화 성공! 저장: ${saveResult.savedCount}건, 삭제된 유령 예약: ${saveResult.deletedGhostCount}건`);

        return NextResponse.json({
            success: true,
            message: `성공적으로 ${saveResult.savedCount}건 동기화 및 ${saveResult.deletedGhostCount}건의 삭제된 유령 예약을 정리했습니다.`,
            syncedCount: saveResult.savedCount,
            deletedGhostCount: saveResult.deletedGhostCount,
            totalFetched: allBookings.length,
        });

    } catch (err: any) {
        console.error('❌ [Beds24 Sync Error]:', err);
        return NextResponse.json({
            success: false,
            error: err.message || '동기화 중 오류 발생',
        }, { status: 500 });
    }
}

// GET 요청으로도 브라우저나 간단한 테스트에서 호출 가능하도록 지원
export async function GET() {
    return POST();
}
