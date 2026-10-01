import { NextResponse } from 'next/server';
import { updateBeds24Booking } from '../../../utils/beds24Client';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { bookingId, newDeparture, additionalPrice = 0, note = '' } = body;

        if (!bookingId || !newDeparture) {
            return NextResponse.json(
                { success: false, error: '필수 파라미터(bookingId, newDeparture)가 누락되었습니다.' },
                { status: 400 }
            );
        }

        const bId = Number(bookingId);
        const addPrice = Number(additionalPrice) || 0;

        console.log(`📅 [Extend Stay] 예약 #${bId} 연박 연장 요청 시작... newDeparture: ${newDeparture}, addPrice: ${addPrice}`);

        // 1. 현재 예약 정보 조회
        const { data: currentBooking, error: fetchErr } = await supabase
            .from('bookings')
            .select('id, arrival, departure, price, room_id, unit_id, first_name, last_name, status, notes')
            .eq('id', bId)
            .single();

        if (fetchErr || !currentBooking) {
            return NextResponse.json(
                { success: false, error: '예약 정보를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        const currentArrival = currentBooking.arrival;
        const currentDeparture = currentBooking.departure;
        const currentPrice = Number(currentBooking.price) || 0;
        const roomId = currentBooking.room_id ? Number(currentBooking.room_id) : null;
        const unitId = currentBooking.unit_id ? Number(currentBooking.unit_id) : null;

        // 2. 날짜 유효성 검사 (기존 체크아웃보다 늦어야 함)
        if (newDeparture <= currentDeparture) {
            return NextResponse.json(
                { success: false, error: `새 체크아웃 날짜(${newDeparture})는 기존 체크아웃 날짜(${currentDeparture})보다 이후여야 합니다.` },
                { status: 400 }
            );
        }

        // 3. 호실 배정 상태인 경우, 연장 구간(currentDeparture ~ newDeparture)에 대한 더블 부킹 충돌 철저 검증
        if (roomId && unitId && unitId > 0) {
            const { data: conflicts } = await supabase
                .from('bookings')
                .select('id, first_name, last_name, arrival, departure, status')
                .eq('room_id', roomId)
                .eq('unit_id', unitId)
                .neq('id', bId)
                .neq('status', 'cancelled')
                .neq('status', 'deleted')
                .neq('status', 'inquiry')
                .lt('arrival', newDeparture)
                .gt('departure', currentDeparture); // 연장된 구간과 겹치는 예약이 있는지 확인

            if (conflicts && conflicts.length > 0) {
                const c = conflicts[0];
                const cName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || `#${c.id}`;
                console.warn(`⚠️ [Extend Stay] 연장 기간 더블 부킹 감지! #${bId} 연장(${currentDeparture}~${newDeparture}) vs #${c.id} ${cName} (${c.arrival}~${c.departure})`);
                return NextResponse.json(
                    {
                        success: false,
                        error: `더블 부킹 충돌: 해당 호실의 연장 기간에 이미 [${cName}]님의 예약(#${c.id}, ${c.arrival}~${c.departure})이 배정되어 있어 연장할 수 없습니다. 먼저 해당 예약을 다른 방으로 이동하거나 이 예약을 빈 호실로 변경해 주세요.`,
                        conflict: c,
                    },
                    { status: 409 }
                );
            }
        }

        // 4. 총 금액 계산
        const newTotalPrice = Math.max(0, currentPrice + addPrice);

        // 5. 연박 직접 수령 추가 금액 태그 생성 (Beds24 notes 및 DB bookings.notes에 영구 보존)
        const existingNotes = currentBooking.notes || '';
        const updatedNotes = addPrice > 0
            ? (existingNotes ? `${existingNotes} [연박직접수령:${addPrice}]` : `[연박직접수령:${addPrice}]`)
            : existingNotes;

        // 6. Beds24 본사 API로 퇴실일, 총금액, notes 전송 (Beds24가 연동된 OTA 캘린더 자동 블록)
        const beds24Result = await updateBeds24Booking(bId, {
            departure: newDeparture,
            price: newTotalPrice,
            notes: updatedNotes,
        });

        console.log(`✅ [Extend Stay] Beds24 API 연장 완료:`, JSON.stringify(beds24Result).slice(0, 200));

        // 7. Supabase DB bookings 테이블 업데이트 (notes 포함)
        const { error: dbError } = await supabase
            .from('bookings')
            .update({
                departure: newDeparture,
                price: newTotalPrice,
                notes: updatedNotes,
                updated_at: new Date().toISOString(),
            })
            .eq('id', bId);

        if (dbError) {
            console.error('⚠️ [Extend Stay] Supabase DB 업데이트 실패 (Beds24는 성공):', dbError);
        }

        return NextResponse.json({
            success: true,
            message: `성공적으로 연박 연장(${newDeparture}까지) 및 금액 수정이 완료되었습니다.`,
            data: {
                bookingId: bId,
                previousDeparture: currentDeparture,
                newDeparture,
                previousPrice: currentPrice,
                additionalPrice: addPrice,
                newTotalPrice,
                notes: updatedNotes,
                beds24Result,
            },
        });
    } catch (err: any) {
        console.error('❌ [Extend Stay Error]:', err);
        return NextResponse.json(
            {
                success: false,
                error: err.message || '연박 연장 처리 중 오류가 발생했습니다.',
            },
            { status: 500 }
        );
    }
}
