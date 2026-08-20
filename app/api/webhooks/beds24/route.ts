import { NextResponse } from 'next/server';
import { upsertBookingsToSupabase, deleteBookingFromSupabase } from '../../../utils/bookingSync';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        console.log('🔔 [Beds24 Webhook] 웹훅 수신!');
        let body: any;

        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            body = await request.json();
        } else {
            // x-www-form-urlencoded 등 텍스트 또는 폼 데이터 대응
            const rawText = await request.text();
            try {
                body = JSON.parse(rawText);
            } catch {
                body = Object.fromEntries(new URLSearchParams(rawText));
            }
        }

        console.log('📦 [Beds24 Webhook Payload]:', JSON.stringify(body).slice(0, 300));

        // 1. 단일 또는 복수 예약 데이터 추출
        let bookingsToSave: any[] = [];

        if (Array.isArray(body)) {
            bookingsToSave = body;
        } else if (body.bookings && Array.isArray(body.bookings)) {
            bookingsToSave = body.bookings;
        } else if (body.booking) {
            bookingsToSave = Array.isArray(body.booking) ? body.booking : [body.booking];
        } else if (body.id || body.bookId) {
            bookingsToSave = [body];
        }

        // 2. 취소/삭제 및 유효 예약 분리 처리
        const activeBookings: any[] = [];

        for (const item of bookingsToSave) {
            const bookingId = Number(item.id || item.bookId);
            const isCancelledOrDeleted =
                item.status === 'cancelled' ||
                item.status === 'deleted' ||
                item.status === 'inquiry' ||
                item.action === 'delete';

            if (isCancelledOrDeleted && bookingId) {
                console.log(`🗑️ [Beds24 Webhook] 예약 취소/삭제/문의 감지 -> DB에서 삭제: ID ${bookingId}`);
                await deleteBookingFromSupabase(bookingId);
            } else {
                activeBookings.push(item);
            }
        }

        // 3. 유효한 예약만 Supabase bookings 테이블에 upsert
        if (activeBookings.length > 0) {
            const result = await upsertBookingsToSupabase(activeBookings);
            if (!result.success) {
                console.error('❌ [Beds24 Webhook] Supabase 저장 실패:', result.error);
                return NextResponse.json({ success: false, error: result.error }, { status: 500 });
            }
            console.log(`✅ [Beds24 Webhook] ${result.count}건 실시간 동기화 완료`);
        }

        return NextResponse.json({ success: true, processedCount: bookingsToSave.length });

    } catch (err: any) {
        console.error('❌ [Beds24 Webhook Error]:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// Beds24 웹훅 URL 검증 및 GET 테스트 지원
export async function GET() {
    return NextResponse.json({
        success: true,
        message: 'Beds24 Webhook endpoint is active and listening.',
    });
}
