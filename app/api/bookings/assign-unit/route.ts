import { NextResponse } from 'next/server';
import { updateBeds24Booking } from '../../../utils/beds24Client';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { bookingId, roomId, unitId, force } = body;

        if (!bookingId || unitId === undefined || unitId === null) {
            return NextResponse.json(
                { success: false, error: '필수 파라미터(bookingId, unitId)가 누락되었습니다.' },
                { status: 400 }
            );
        }

        const bId = Number(bookingId);
        let rId = Number(roomId) || 0;
        const uId = Number(unitId);

        // 🛡️ roomId가 누락되거나 0인 경우 기존 DB 예약에서 room_id fallback 조회
        if (rId <= 0) {
            const { data: cur } = await supabase
                .from('bookings')
                .select('room_id')
                .eq('id', bId)
                .single();
            if (cur?.room_id) {
                rId = Number(cur.room_id);
            }
        }

        if (rId <= 0) {
            return NextResponse.json(
                { success: false, error: '유효한 roomId(객실 타입)를 찾을 수 없습니다.' },
                { status: 400 }
            );
        }

        const actionText = uId > 0 ? `호실 배정 (Unit ${uId})` : '호실 배정 해제 (미배정 상태)';
        console.log(`🏠 [Assign Unit] 예약 #${bId} ➔ roomId: ${rId}, unitId: ${uId} (${actionText}) 요청 시작...`);

        // 🛡️ 1. uId > 0 인 경우에만 더블 부킹 충돌 검사 (uId === 0 은 미배정 상태이므로 충돌 없음)
        if (uId > 0 && !force) {
            const { data: currentBooking } = await supabase
                .from('bookings')
                .select('id, arrival, departure, first_name, last_name')
                .eq('id', bId)
                .single();

            if (currentBooking && currentBooking.arrival && currentBooking.departure) {
                const arr = currentBooking.arrival;
                const dep = currentBooking.departure;

                // 🛡️ 2. 대상 호실(roomId + unitId)에 날짜가 겹치는 다른 활성 예약 조회 (더블 부킹 방지)
                const { data: conflicts } = await supabase
                    .from('bookings')
                    .select('id, first_name, last_name, arrival, departure, status')
                    .eq('room_id', rId)
                    .eq('unit_id', uId)
                    .neq('id', bId)
                    .neq('status', 'cancelled')
                    .neq('status', 'deleted')
                    .neq('status', 'inquiry')
                    .lt('arrival', dep)
                    .gt('departure', arr);

                if (conflicts && conflicts.length > 0) {
                    const c = conflicts[0];
                    const cName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || `#${c.id}`;
                    console.warn(`⚠️ [Assign Unit] 더블 부킹 감지! #${bId} (${arr}~${dep}) vs #${c.id} ${cName} (${c.arrival}~${c.departure})`);
                    return NextResponse.json(
                        {
                            success: false,
                            error: `더블 부킹 경고: 해당 호실의 해당 기간(${c.arrival}~${c.departure})에 이미 [${cName}]님의 예약이 배정되어 있습니다. 먼저 해당 예약을 다른 호실로 이동해 주세요.`,
                            conflict: c,
                        },
                        { status: 409 }
                    );
                }
            }
        }

        // 3. Beds24 본사 API로 배정/미배정 정보 전송
        // ⚠️ Beds24 API V2 스펙: unitId 미배정 해제 시 null 전송
        const targetUnitIdForBeds24 = uId > 0 ? uId : null;
        const beds24Payload: { roomId?: number; unitId: number | null } = {
            unitId: targetUnitIdForBeds24,
        };
        if (rId > 0) {
            beds24Payload.roomId = rId;
        }

        const beds24Result = await updateBeds24Booking(bId, beds24Payload);
        console.log(`✅ [Assign Unit] Beds24 API 응답 완료:`, JSON.stringify(beds24Result).slice(0, 300));

        // 🛡️ Beds24 API 응답 검증 (AGENTS.md 4.1 불변조건: Beds24 성공 확인 후 Supabase 반영)
        const itemResult = Array.isArray(beds24Result) ? beds24Result[0] : beds24Result;
        if (itemResult && (itemResult.success === false || (itemResult.errors && itemResult.errors.length > 0))) {
            const errMsg = itemResult.errors && itemResult.errors.length > 0
                ? (typeof itemResult.errors[0] === 'string' ? itemResult.errors.join(', ') : JSON.stringify(itemResult.errors))
                : 'Beds24 본사에서 배정 변경 처리를 거부했습니다.';
            console.error(`❌ [Assign Unit] Beds24 배정 처리 실패:`, errMsg, beds24Result);
            return NextResponse.json(
                {
                    success: false,
                    error: `Beds24 배정 실패: ${errMsg}`,
                    details: beds24Result,
                },
                { status: 400 }
            );
        }

        // 4. Supabase DB bookings 테이블 동기 업데이트 (uId === 0 이면 unit_id를 null로 설정)
        const { error: dbError } = await supabase
            .from('bookings')
            .update({
                room_id: rId,
                unit_id: targetUnitIdForBeds24,
                updated_at: new Date().toISOString(),
            })
            .eq('id', bId);

        if (dbError) {
            console.error('⚠️ [Assign Unit] Supabase DB 업데이트 실패 (Beds24는 성공):', dbError);
            return NextResponse.json(
                {
                    success: false,
                    error: 'Beds24에는 반영되었으나 대시보드 DB 갱신 중 오류가 발생했습니다. 잠시 후 새로고침해 주세요.',
                    details: dbError.message,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `성공적으로 Beds24 및 DB에 ${actionText}을(를) 완료했습니다.`,
            data: {
                bookingId: bId,
                roomId: rId,
                unitId: uId,
                beds24Result,
            },
        });
    } catch (err: unknown) {
        console.error('❌ [Assign Unit Error]:', err);
        const errorMessage = err instanceof Error ? err.message : '호실 배정 처리 중 오류가 발생했습니다.';
        return NextResponse.json(
            {
                success: false,
                error: errorMessage,
            },
            { status: 500 }
        );
    }
}
