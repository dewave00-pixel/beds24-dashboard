import { NextResponse } from 'next/server';

export async function GET() {
    const refreshToken = process.env.BEDS24_REFRESH_TOKEN;

    if (!refreshToken) {
        return NextResponse.json({ error: 'BEDS24_REFRESH_TOKEN이 설정되지 않았습니다.' }, { status: 400 });
    }

    try {
        // 1. Access Token 발급
        const authResponse = await fetch('https://beds24.com/api/v2/authentication/token', {
            method: 'GET',
            headers: {
                'refreshToken': refreshToken,
                'accept': 'application/json',
            },
        });

        const authData = await authResponse.json();

        if (!authResponse.ok || !authData.token) {
            return NextResponse.json({
                error: 'Access Token 발급 실패',
                details: authData
            }, { status: authResponse.status });
        }

        const accessToken = authData.token;

        // 2. 관리 중인 7개 숙소 ID 배열
        const propertyIds = [267332, 265909, 269337, 269340, 269386, 269419, 267335];

        // 3. 오늘 기준 과거 10일 전 ~ 미래 365일 후 기간 설정
        const today = new Date();
        const fromDate = new Date(today);
        fromDate.setDate(today.getDate() - 10);
        const toDate = new Date(today);
        toDate.setDate(today.getDate() + 365);

        const arrivalFrom = fromDate.toISOString().split('T')[0];
        const arrivalTo = toDate.toISOString().split('T')[0];

        // 4. 7개 숙소 각각 개별 동시 요청 (100건 제한 완전 우회)
        const requests = propertyIds.map((propId) => {
            const url = `https://beds24.com/api/v2/bookings?propertyId=${propId}&arrivalFrom=${arrivalFrom}&arrivalTo=${arrivalTo}&limit=100&includeInfo=true`;
            return fetch(url, {
                method: 'GET',
                headers: {
                    'token': accessToken,
                    'accept': 'application/json',
                },
            }).then(res => res.json());
        });

        const results = await Promise.all(requests);

        // 5. 7개 숙소에서 받아온 예약 데이터들을 하나로 병합
        let allBookings: any[] = [];
        results.forEach((resData) => {
            if (resData && resData.data && Array.isArray(resData.data)) {
                allBookings = allBookings.concat(resData.data);
            } else if (Array.isArray(resData)) {
                allBookings = allBookings.concat(resData);
            }
        });

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