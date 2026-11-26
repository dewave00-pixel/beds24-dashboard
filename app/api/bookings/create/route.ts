import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createBeds24Booking } from '../../../utils/beds24Client';
import { formatBeds24ToSupabaseRow } from '../../../utils/bookingSync';
import { ALL_UNITS } from '../../../config';
import { getKSTTodayStr } from '../../../utils/dateUtils';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        // 1. 최고관리자(admin) 권한 검증 (AGENTS.md 8조 & CREATE_BOOKING_SPEC 2.1)
        const cookieStore = await cookies();
        const role = cookieStore.get('auth_role')?.value;
        if (role !== 'admin') {
            return NextResponse.json(
                {
                    success: false,
                    error: '예약 생성 권한이 없습니다. 최고관리자(admin)만 실행할 수 있습니다.',
                },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            roomId,
            unitId,
            arrival,
            departure,
            numAdult = 1,
            firstName = '',
            lastName = '',
            phone = '',
            price = 0,
            channelType = 'direct',
            notes = '',
        } = body;

        // 2. 입력 파라미터 유효성 검증
        const rId = Number(roomId);
        const uId = unitId === undefined || unitId === null ? 0 : Number(unitId);

        if (!rId || !ALL_UNITS.some((u) => u.roomId === rId)) {
            return NextResponse.json(
                { success: false, error: '유효한 숙소/객실(roomId)을 선택해 주세요.' },
                { status: 400 }
            );
        }

        if (!Number.isInteger(uId) || uId < 0) {
            return NextResponse.json(
                { success: false, error: '유효하지 않은 호실(unitId) 값입니다.' },
                { status: 400 }
            );
        }

        if (uId > 0) {
            const isValidUnit = ALL_UNITS.some((u) => u.roomId === rId && (u.unitId || 1) === uId);
            if (!isValidUnit) {
                return NextResponse.json(
                    { success: false, error: '선택한 객실 타입에 존재하지 않는 호실입니다.' },
                    { status: 400 }
                );
            }
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (
            typeof arrival !== 'string' ||
            typeof departure !== 'string' ||
            !dateRegex.test(arrival) ||
            !dateRegex.test(departure)
        ) {
            return NextResponse.json(
                { success: false, error: '체크인 및 체크아웃 날짜 형식이 올바르지 않습니다 (YYYY-MM-DD).' },
                { status: 400 }
            );
        }

        const todayStr = getKSTTodayStr();
        if (arrival < todayStr) {
            return NextResponse.json(
                { success: false, error: `과거 날짜(${arrival})로는 신규 예약을 생성할 수 없습니다.` },
                { status: 400 }
            );
        }

        if (departure <= arrival) {
            return NextResponse.json(
                { success: false, error: '체크아웃 날짜는 체크인 날짜보다 이후여야 합니다.' },
                { status: 400 }
            );
        }

        const adults = Number(numAdult);
        if (!Number.isInteger(adults) || adults < 1 || adults > 30) {
            return NextResponse.json(
                { success: false, error: '투숙 인원은 1명 이상 30명 이하의 정수여야 합니다.' },
                { status: 400 }
            );
        }

        const cleanFirst = String(firstName || '').trim().slice(0, 100);
        const cleanLast = String(lastName || '').trim().slice(0, 100);
        if (!cleanFirst && !cleanLast) {
            return NextResponse.json(
                { success: false, error: '게스트 성(Last Name) 또는 이름(First Name)을 입력해 주세요.' },
                { status: 400 }
            );
        }

        const cleanPhone = String(phone || '').trim().slice(0, 50);
        const parsedPrice = Number(price);
        if (price === undefined || price === null || isNaN(parsedPrice) || parsedPrice < 0) {
            return NextResponse.json(
                { success: false, error: '총 결제 금액은 0원 이상의 숫자여야 합니다.' },
                { status: 400 }
            );
        }
        const finalPrice = Math.round(parsedPrice);
        const cleanNotes = String(notes || '').trim().slice(0, 1000);

        // 3. 서버 2차 더블 부킹 충돌 검사 (uId > 0 배정 시에만 수행, uId === 0 미배정은 제외)
        if (uId > 0) {
            const { data: conflicts, error: conflictErr } = await supabase
                .from('bookings')
                .select('id, first_name, last_name, arrival, departure, status')
                .eq('room_id', rId)
                .eq('unit_id', uId)
                .neq('status', 'cancelled')
                .neq('status', 'deleted')
                .neq('status', 'inquiry')
                .lt('arrival', departure)
                .gt('departure', arrival);

            if (conflictErr) {
                console.error('❌ [Create Booking] 충돌 조회 오류:', conflictErr);
                return NextResponse.json(
                    { success: false, error: '기존 예약 중복 검사 중 오류가 발생했습니다.' },
                    { status: 500 }
                );
            }

            if (conflicts && conflicts.length > 0) {
                const c = conflicts[0];
                const cName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || `#${c.id}`;
                console.warn(
                    `⚠️ [Create Booking] 더블 부킹 차단! roomId:${rId}, unitId:${uId} (${arrival}~${departure}) vs #${c.id} ${cName}`
                );
                return NextResponse.json(
                    {
                        success: false,
                        error: `더블 부킹 경고: 선택한 호실의 해당 기간(${c.arrival}~${c.departure})에 이미 [${cName}]님의 예약(#${c.id})이 배정되어 있습니다. 다른 호실을 선택하거나 미배정 상태로 등록해 주세요.`,
                        conflict: c,
                    },
                    { status: 409 }
                );
            }
        }

        // 4. 1단계: Beds24 API V2 신규 예약 단일 호출 (자동 재시도 없음)
        console.log(
            `➕ [Create Booking] Beds24 예약 생성 요청: roomId=${rId}, unitId=${uId}, ${arrival}~${departure}, price=${finalPrice}, channel=${channelType}`
        );

        const beds24Res = await createBeds24Booking({
            roomId: rId,
            unitId: uId, // 미배정 시 반드시 0 전달
            arrival,
            departure,
            numAdult: adults,
            status: 'confirmed',
            firstName: cleanFirst,
            lastName: cleanLast,
            mobile: cleanPhone || undefined,
            phone: cleanPhone || undefined,
            price: finalPrice,
            apiSourceId: 0,
            notes: cleanNotes || undefined,
        });

        if (beds24Res.status === 'AMBIGUOUS') {
            return NextResponse.json(
                {
                    success: false,
                    status: 'AMBIGUOUS',
                    error: beds24Res.error,
                },
                { status: 504 }
            );
        }

        if (beds24Res.status === 'FAILED') {
            return NextResponse.json(
                {
                    success: false,
                    status: 'FAILED',
                    error: beds24Res.error,
                },
                { status: 400 }
            );
        }

        const bookingId = beds24Res.bookingId;
        const nowIso = new Date().toISOString();

        const clientBooking = {
            id: bookingId,
            roomId: rId,
            unitId: uId > 0 ? uId : undefined,
            arrival,
            departure,
            numAdult: adults,
            numChild: 0,
            status: 'confirmed',
            firstName: cleanFirst,
            lastName: cleanLast,
            mobile: cleanPhone || '',
            phone: cleanPhone || '',
            price: finalPrice,
            apiSourceId: 0,
            notes: cleanNotes,
            bookingTime: (beds24Res.rawBooking?.bookingTime as string) || nowIso,
            modified: (beds24Res.rawBooking?.modified as string) || nowIso,
        };

        // 5. 2단계: Supabase bookings 테이블 Upsert (formatBeds24ToSupabaseRow 재사용)
        const supabaseRow = formatBeds24ToSupabaseRow({
            ...beds24Res.rawBooking,
            ...clientBooking,
            unitId: uId > 0 ? uId : null,
        });

        const { error: dbError } = await supabase
            .from('bookings')
            .upsert([supabaseRow], { onConflict: 'id' });

        if (dbError) {
            console.error(`⚠️ [Create Booking] Beds24 생성(#${bookingId}) 성공 후 Supabase 반영 실패:`, dbError);
            return NextResponse.json(
                {
                    success: true,
                    partialSuccess: true,
                    bookingId,
                    data: clientBooking,
                    warning: `Beds24 본사 등록(ID: #${bookingId})은 완료되었으나 대시보드 반영 중 일시 오류가 발생했습니다. 상단 '증분 동기화'를 실행하면 즉시 복구됩니다.`,
                },
                { status: 200 }
            );
        }

        // 특이사항 메모가 있는 경우 booking_notes 테이블에도 동시 보존
        if (cleanNotes) {
            const { error: noteError } = await supabase
                .from('booking_notes')
                .upsert(
                    {
                        booking_id: bookingId,
                        note: cleanNotes,
                        tags: [],
                        updated_at: nowIso,
                    },
                    { onConflict: 'booking_id' }
                );
            if (noteError) {
                console.warn(`⚠️ [Create Booking] booking_notes 보조 저장 실패 (#${bookingId}):`, noteError);
            }
        }

        return NextResponse.json({
            success: true,
            partialSuccess: false,
            bookingId,
            data: clientBooking,
            note: cleanNotes,
            message: `신규 예약(#${bookingId})이 Beds24 및 대시보드에 정상 등록되었습니다.`,
        });
    } catch (err: unknown) {
        console.error('❌ [Create Booking Error]:', err);
        const errorMessage = err instanceof Error ? err.message : '예약 생성 처리 중 오류가 발생했습니다.';
        return NextResponse.json(
            {
                success: false,
                error: errorMessage,
            },
            { status: 500 }
        );
    }
}
