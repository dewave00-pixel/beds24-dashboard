import { NextRequest, NextResponse } from 'next/server';
import { fetchBeds24Bookings } from '../../utils/beds24Client';
import { isValidBooking } from '../../utils/bookingUtils';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;

        const data = await fetchBeds24Bookings(startDate, endDate);
        const rawList = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
        const validList = rawList.filter((b: any) => isValidBooking(b));

        return NextResponse.json({
            success: true,
            data: validList,
        });
    } catch (error: any) {
        console.error('Beds24 API Error:', error.message);

        // 429 에러일 경우 클라이언트가 알기 쉽게 상태 코드 전달
        const is429 = error.message.includes('429');
        return NextResponse.json(
            {
                success: false,
                message: error.message || 'Beds24 예약 데이터를 가져오지 못했습니다.',
            },
            { status: is429 ? 429 : 500 }
        );
    }
}