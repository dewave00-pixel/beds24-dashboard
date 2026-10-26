import { NextResponse } from 'next/server';
import { upsertBookingsToSupabase, deleteBookingFromSupabase } from '../../../utils/bookingSync';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        console.log('🔔 [Beds24 Webhook] 웹훅 수신!');
        let body: any = null;

        // 1. 안전하게 본문(rawText) 추출
        const rawText = await request.text();

        if (!rawText || rawText.trim() === '') {
            // 본문이 비어있는 경우 URL 쿼리 파라미터 확인 (GET/POST searchParams 대응)
            const { searchParams } = new URL(request.url);
            const queryParams = Object.fromEntries(searchParams.entries());

            if (Object.keys(queryParams).length > 0) {
                body = queryParams;
            } else {
                // Beds24의 연결 테스트 Ping 또는 빈 헬스체크 요청일 경우 에러 없이 200 OK 반환
                console.log('ℹ️ [Beds24 Webhook] 빈 페이로드 수신 (테스트 Ping 또는 헬스체크)');
                return NextResponse.json({
                    success: true,
                    message: 'Empty webhook payload received (Ping/HealthCheck handled successfully)',
                });
            }
        } else {
            // 본문이 있는 경우: JSON 파싱 우선 시도 -> 실패 시 폼 데이터(URLSearchParams) 변환
            try {
                body = JSON.parse(rawText);
            } catch {
                try {
                    const parsedForm = Object.fromEntries(new URLSearchParams(rawText));
                    body = Object.keys(parsedForm).length > 0 ? parsedForm : { raw: rawText };
                } catch {
                    body = { raw: rawText };
                }
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
            const status = (item.status || '').toLowerCase().trim();
            const price = Number(item.price) || 0;
            const isDeleteAction = item.action === 'delete';

            // 삭제(deleted), 문의(inquiry)이거나 금액이 0원 이하인 무료 취소 건은 DB에서 삭제
            if (isDeleteAction || status === 'deleted' || status === 'inquiry' || (status === 'cancelled' && price <= 0)) {
                if (bookingId) {
                    console.log(`🗑️ [Beds24 Webhook] 예약 삭제/문의/무료취소 감지 -> DB에서 삭제: ID ${bookingId}`);
                    await deleteBookingFromSupabase(bookingId);
                }
            } else {
                // 활성 예약 및 위약금이 발생한 취소 건(price > 0)은 Supabase에 upsert 보존
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
