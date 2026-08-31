import { NextResponse } from 'next/server';
import { updateBeds24Booking } from '../../../utils/beds24Client';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { bookingId, roomId, unitId, force } = body;

        if (!bookingId || !roomId || unitId === undefined || unitId === null) {
            return NextResponse.json(
                { success: false, error: '필수 파라미터(bookingId, roomId, unitId)가 누락되었습니다.' },
                { status: 400 }
            );
        }

        const bId = Number(bookingId);
        const rId = Number(roomId);
        const uId = Number(unitId);

        console.log(`🏠 [Assign Unit] 예약 #${bId} ➔ roomId: ${rId}, unitId: ${uId} 배정 요청 시작...`);

        // 🛡️ 1. uId > 0 인 경우에만 더블 부킹 충돌 검사 (uId === 0 은 미배정 상태이므로 충돌 없음)
        if (uId > 0 && !force) {
            const { data: currentBooking, error: fetchErr } = await supabase
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

        // 3. Beds24 본사 API로 배정 정보 전송
        const beds24Result = await updateBeds24Booking(bId, {
            roomId: rId,
            unitId: uId,
        });

        console.log(`✅ [Assign Unit] Beds24 API 응답 완료:`, JSON.stringify(beds24Result).slice(0, 200));

        // 4. Supabase DB bookings 테이블 동기 업데이트 (uId === 0 이면 unit_id를 null로 설정)
        const { error: dbError } = await supabase
            .from('bookings')
            .update({
                room_id: rId,
                unit_id: uId === 0 ? null : uId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', bId);

        if (dbError) {
            console.error('⚠️ [Assign Unit] Supabase DB 업데이트 실패 (Beds24는 성공):', dbError);
        }

        return NextResponse.json({
            success: true,
            message: `성공적으로 Beds24 및 DB에 호실 배정(Unit ${uId})을 완료했습니다.`,
            data: {
                bookingId: bId,
                roomId: rId,
                unitId: uId,
                beds24Result,
            },
        });
    } catch (err: any) {
        console.error('❌ [Assign Unit Error]:', err);
        return NextResponse.json(
            {
                success: false,
                error: err.message || '호실 배정 처리 중 오류가 발생했습니다.',
            },
            { status: 500 }
        );
    }
}
