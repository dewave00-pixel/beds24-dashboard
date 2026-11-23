import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updateBeds24Booking, deleteBeds24Booking } from '../../../utils/beds24Client';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        // 🔒 관리자 권한 검증 (AGENTS.md 8조 준수)
        const cookieStore = await cookies();
        const role = cookieStore.get('auth_role')?.value;
        if (role !== 'admin') {
            return NextResponse.json(
                { success: false, error: '예약 취소/삭제 권한이 없습니다. 최고관리자(admin)만 실행할 수 있습니다.' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { bookingId, action = 'noshow_cancel', newDeparture, newPrice } = body;

        if (!bookingId) {
            return NextResponse.json(
                { success: false, error: '필수 파라미터(bookingId)가 누락되었습니다.' },
                { status: 400 }
            );
        }

        const bId = Number(bookingId);
        const isPermanentDelete = action === 'permanent_delete';
        const isEarlyDeparture = action === 'early_departure';
        console.log(`🚫 [Cancel/Delete Booking] 관리자 요청 접수: ID #${bId}, 모드: ${action}`);

        if (isEarlyDeparture) {
            // =========================================================================
            // 모드 3: 중도 퇴실 및 부분 환불 (퇴실일 단축 -> 이전은 매출·가동률 유지, 이후는 공실·제외)
            // =========================================================================
            if (!newDeparture || typeof newDeparture !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(newDeparture)) {
                return NextResponse.json(
                    { success: false, error: '유효한 중도 퇴실일(YYYY-MM-DD)을 선택해 주세요.' },
                    { status: 400 }
                );
            }

            const parsedNewPrice = Number(newPrice);
            if (newPrice === undefined || newPrice === null || isNaN(parsedNewPrice) || parsedNewPrice < 0) {
                return NextResponse.json(
                    { success: false, error: '부분환불 후 최종 결제금액은 0원 이상의 숫자여야 합니다.' },
                    { status: 400 }
                );
            }
            const finalPrice = Math.round(parsedNewPrice);

            const { data: currentBooking, error: fetchErr } = await supabase
                .from('bookings')
                .select('id, arrival, departure, price, notes, status')
                .eq('id', bId)
                .single();

            if (fetchErr || !currentBooking) {
                return NextResponse.json(
                    { success: false, error: '해당 예약 정보를 찾을 수 없습니다.' },
                    { status: 404 }
                );
            }

            const currentArrival = currentBooking.arrival;
            const currentDeparture = currentBooking.departure;
            const currentPrice = Number(currentBooking.price) || 0;

            if (newDeparture <= currentArrival || newDeparture >= currentDeparture) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `중도 퇴실일(${newDeparture})은 입실일(${currentArrival}) 이후이고 기존 퇴실일(${currentDeparture}) 이전이어야 합니다.`,
                    },
                    { status: 400 }
                );
            }

            const existingNotes = (currentBooking.notes || '').replace(/\s*\[중도퇴실:[^\]]+\]/g, '').trim();
            const earlyTag = `[중도퇴실:${currentDeparture}->${newDeparture},${currentPrice}->${finalPrice}]`;
            const updatedNotes = existingNotes ? `${existingNotes} ${earlyTag}` : earlyTag;

            let beds24Result;
            try {
                beds24Result = await updateBeds24Booking(bId, {
                    departure: newDeparture,
                    price: finalPrice,
                    notes: updatedNotes,
                });
            } catch (apiErr: unknown) {
                const errorMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
                console.error(`❌ [Early Departure] Beds24 API 통신 실패:`, apiErr);
                return NextResponse.json(
                    { success: false, error: `Beds24 통신 실패: ${errorMsg}` },
                    { status: 502 }
                );
            }

            const itemResult = Array.isArray(beds24Result) ? beds24Result[0] : beds24Result;
            if (itemResult && (itemResult.success === false || (itemResult.errors && itemResult.errors.length > 0))) {
                const errMsg = itemResult.error || itemResult.message || JSON.stringify(itemResult.errors || 'Beds24 거부');
                console.error(`❌ [Early Departure] Beds24 거부 응답:`, beds24Result);
                return NextResponse.json(
                    { success: false, error: `Beds24 중도 퇴실 반영 실패: ${errMsg}` },
                    { status: 400 }
                );
            }

            const { error: updateErr } = await supabase
                .from('bookings')
                .update({
                    departure: newDeparture,
                    price: finalPrice,
                    notes: updatedNotes,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', bId);

            if (updateErr) {
                console.error(`⚠️ [Early Departure] Supabase DB 갱신 실패:`, updateErr);
                return NextResponse.json(
                    {
                        success: true,
                        partialSuccess: true,
                        action: 'early_departure',
                        bookingId: bId,
                        newDeparture,
                        newPrice: finalPrice,
                        notes: updatedNotes,
                        warning: 'Beds24 반영은 완료되었으나 DB 갱신 중 오류가 발생했습니다. 잠시 후 자동 동기화됩니다.',
                    },
                    { status: 200 }
                );
            }

            return NextResponse.json({
                success: true,
                action: 'early_departure',
                bookingId: bId,
                newDeparture,
                newPrice: finalPrice,
                notes: updatedNotes,
                message: '중도 퇴실일 및 부분 환불 금액이 반영되었으며, 남은 일정은 공실로 반환되었습니다.',
            });
        }

        if (isPermanentDelete) {
            // =========================================================================
            // 모드 1: 영구 삭제 (테스트 예약, 오등록, 전액 환불 - 매출 및 시스템 완전 영구 제거)
            // =========================================================================
            try {
                const deleteResult = await deleteBeds24Booking(bId);
                console.log(`✅ [Permanent Delete] Beds24 영구 삭제 완료: ID #${bId}`, deleteResult);
            } catch (apiErr: unknown) {
                const errorMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
                console.error(`❌ [Permanent Delete] Beds24 통신 실패:`, apiErr);
                return NextResponse.json(
                    { success: false, error: `Beds24 영구 삭제 실패: ${errorMsg}` },
                    { status: 502 }
                );
            }

            // Supabase bookings 및 관련 메모/태그 완전 삭제
            const { error: dbDeleteErr } = await supabase.from('bookings').delete().eq('id', bId);
            if (dbDeleteErr) {
                console.error(`⚠️ [Permanent Delete] Supabase bookings 삭제 실패:`, dbDeleteErr);
            }
            await supabase.from('booking_notes').delete().eq('booking_id', bId);

            return NextResponse.json({
                success: true,
                action: 'permanent_delete',
                bookingId: bId,
                message: '예약이 Beds24 및 데이터베이스에서 완전히 영구 삭제되었습니다.',
            });
        } else {
            // =========================================================================
            // 모드 2: 노쇼 / 취소 처리 (위약금 매출 보존 - 방은 공실 전환, 매출 통계는 보존)
            // =========================================================================
            let beds24Result;
            try {
                beds24Result = await updateBeds24Booking(bId, { status: 'cancelled' });
            } catch (apiErr: unknown) {
                const errorMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
                console.error(`❌ [Noshow Cancel] Beds24 API 통신 실패:`, apiErr);
                return NextResponse.json(
                    { success: false, error: `Beds24 통신 실패: ${errorMsg}` },
                    { status: 502 }
                );
            }

            if (Array.isArray(beds24Result) && beds24Result[0]?.success === false) {
                const errMsg = beds24Result[0]?.error || beds24Result[0]?.message || 'Beds24에서 취소를 거부했습니다.';
                console.error(`❌ [Noshow Cancel] Beds24 거부 응답:`, beds24Result);
                return NextResponse.json(
                    { success: false, error: `Beds24 예약 취소 실패: ${errMsg}` },
                    { status: 400 }
                );
            }

            console.log(`✅ [Noshow Cancel] Beds24 취소 성공: ID #${bId}`);

            // 위약금(price > 0)이 발생한 취소 건은 매출 보존을 위해 status: 'cancelled'로 업데이트
            const { error: updateErr } = await supabase
                .from('bookings')
                .update({
                    status: 'cancelled',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', bId);

            if (updateErr) {
                console.error(`⚠️ [Noshow Cancel] Supabase DB 상태 갱신 실패:`, updateErr);
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
                action: 'noshow_cancel',
                bookingId: bId,
                status: 'cancelled',
                message: 'Beds24 취소 완료 및 위약금 매출이 안전하게 보존되었습니다.',
            });
        }
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : '서버 내부 오류가 발생했습니다.';
        console.error('❌ [Cancel Booking API Handler Error]:', err);
        return NextResponse.json(
            { success: false, error: errorMsg },
            { status: 500 }
        );
    }
}
