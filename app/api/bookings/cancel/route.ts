import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updateBeds24Booking } from '../../../utils/beds24Client';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        // 🔒 관리자 권한 검증 (AGENTS.md 8조 준수)
        const cookieStore = await cookies();
        const role = cookieStore.get('auth_role')?.value;
        if (role !== 'admin') {
            return NextResponse.json(
                { success: false, error: '예약 취소 권한이 없습니다. 최고관리자(admin)만 실행할 수 있습니다.' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { bookingId } = body;

        if (!bookingId) {
            return NextResponse.json(
                { success: false, error: '필수 파라미터(bookingId)가 누락되었습니다.' },
                { status: 400 }
            );
        }

        const bId = Number(bookingId);
        console.log(`🚫 [Cancel Booking] 관리자 예약 취소 요청 접수: ID #${bId}`);

        // 1. 기존 DB 예약 정보 확인
        const { data: curBooking, error: fetchErr } = await supabase
            .from('bookings')
            .select('id, price, status, first_name, last_name, arrival, departure, room_id, unit_id')
            .eq('id', bId)
            .single();

        if (fetchErr && !curBooking) {
            console.warn(`⚠️ [Cancel Booking] DB에서 ID #${bId} 조회 실패, 계속 Beds24 취소를 시도합니다.`);
        }

        // 2. Beds24 API V2 호출하여 예약 취소 (status: 'cancelled')
        let beds24Result;
        try {
            beds24Result = await updateBeds24Booking(bId, { status: 'cancelled' });
        } catch (apiErr: unknown) {
            const errorMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
            console.error(`❌ [Cancel Booking] Beds24 API 통신 실패:`, apiErr);
            return NextResponse.json(
                { success: false, error: `Beds24 통신 실패: ${errorMsg}` },
                { status: 502 }
            );
        }

        // 3. Beds24 응답 검증 (AGENTS.md 4.1 데이터 소유권 불변조건)
        if (Array.isArray(beds24Result) && beds24Result[0]?.success === false) {
            const errMsg = beds24Result[0]?.error || beds24Result[0]?.message || 'Beds24에서 취소를 거부했습니다.';
            console.error(`❌ [Cancel Booking] Beds24 거부 응답:`, beds24Result);
            return NextResponse.json(
                { success: false, error: `Beds24 예약 취소 실패: ${errMsg}` },
                { status: 400 }
            );
        }

        console.log(`✅ [Cancel Booking] Beds24 취소 성공: ID #${bId}`);

        // 4. Supabase DB 반영
        // 위약금(price > 0)이 발생한 취소 건은 매출 보존을 위해 status: 'cancelled'로 업데이트
        const { error: updateErr } = await supabase
            .from('bookings')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString(),
            })
            .eq('id', bId);

        if (updateErr) {
            console.error(`⚠️ [Cancel Booking] Supabase DB 상태 갱신 실패 (Beds24는 취소됨):`, updateErr);
            return NextResponse.json(
                {
                    success: true,
                    partialSuccess: true,
                    warning: 'Beds24 취소는 완료되었으나 DB 반영 중 오류가 발생했습니다. 잠시 후 자동 동기화됩니다.',
                    bookingId: bId,
                    status: 'cancelled',
                },
                { status: 200 }
            );
        }

        return NextResponse.json({
            success: true,
            bookingId: bId,
            status: 'cancelled',
            message: 'Beds24 및 대시보드에서 성공적으로 취소되었습니다.',
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : '서버 내부 오류가 발생했습니다.';
        console.error('❌ [Cancel Booking API Handler Error]:', err);
        return NextResponse.json(
            { success: false, error: errorMsg },
            { status: 500 }
        );
    }
}
