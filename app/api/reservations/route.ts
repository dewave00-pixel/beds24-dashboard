import { NextResponse } from 'next/server';
import { getValidBeds24Token } from '../../utils/beds24Client';

export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET() {
    try {
        // 1. 공통 모듈을 통해 토큰을 안전하게 가져옴 (메모리 캐싱 및 429 방어 적용)
        const accessToken = await getValidBeds24Token();

        // 2. 관리 중인 7개 숙소 ID 배열
        const propertyIds = [267332, 265909, 269337, 269340, 269386, 269419, 267335];

        // 3. 오늘 기준 과거 3일 전 ~ 미래 365일 후 기간 설정
        const today = new Date();
        const fromDate = new Date(today);
        fromDate.setDate(today.getDate() - 3);
        const toDate = new Date(today);
        toDate.setDate(today.getDate() + 365);

        const arrivalFrom = fromDate.toISOString().split('T')[0];
        const arrivalTo = toDate.toISOString().split('T')[0];

        let allBookings: any[] = [];

        // 4. 429 에러 방어를 위해 Promise.all(동시 요청) 대신 for...of 직렬(순차) 요청 사용
        for (const propId of propertyIds) {
            let page = 1;
            let hasNextPage = true;

            while (hasNextPage) {
                const url = `https://api.beds24.com/v2/bookings?propertyId=${propId}&arrivalFrom=${arrivalFrom}&arrivalTo=${arrivalTo}&limit=100&page=${page}&includeInfoItems=true`;

                let res = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'token': accessToken,
                        'accept': 'application/json',
                    },
                    cache: 'no-store',
                });

                // 개별 요청 중 429 발생 시 2초 대기 후 한 번 더 시도
                if (res.status === 429) {
                    console.warn(`⚠️ [Beds24] 숙소 ${propId} 조회 429 감지 -> 2초 대기 후 재시도`);
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
                        // 다음 페이지가 있는지 확인
                        hasNextPage = data.pages && data.pages.nextPageExists === true;
                        page++;
                    } else if (Array.isArray(data)) {
                        allBookings = allBookings.concat(data);
                        hasNextPage = false;
                    } else {
                        hasNextPage = false;
                    }
                } else {
                    const errText = await res.text();
                    console.error(`❌ [Beds24 API Error] 숙소 ${propId} 조회 실패 - Status: ${res.status}, Body: ${errText}, URL: ${url}`);
                    hasNextPage = false;
                }

                // 다음 숙소 또는 다음 페이지 요청 전 300ms 대기 (Beds24 API 초당 요청 제한 방어)
                await sleep(300);
            }
        }

        return NextResponse.json({
            success: true,
            count: allBookings.length,
            data: allBookings
        });

    } catch (error) {
        return NextResponse.json({
            error: '서버 통신 중 에러가 발생했습니다.',
            details: String(error)
        }, { status: 500 });
    }
}