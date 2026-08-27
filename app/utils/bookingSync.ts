import { supabase } from '@/lib/supabase';
import { Booking } from '../types';
import { isValidBooking } from './bookingUtils';

export interface SupabaseBookingRow {
    id: number;
    property_id: number | null;
    room_id: number | null;
    unit_id: number | null;
    arrival: string;
    departure: string;
    first_name: string | null;
    last_name: string | null;
    num_guests: number;
    status: string;
    api_source_id: number | null;
    price: number;
    notes: string | null;
    raw_data: any;
    updated_at: string;
}

/**
 * Beds24 예약 객체를 Supabase bookings 테이블 Row 형식으로 변환
 */
export function formatBeds24ToSupabaseRow(b: any): SupabaseBookingRow {
    const numAdult = Number(b.numAdult) || 0;
    const numChild = Number(b.numChild) || 0;
    const totalGuests = (numAdult + numChild) > 0 ? (numAdult + numChild) : (Number(b.numGuests) || 1);

    return {
        id: Number(b.id || b.bookId),
        property_id: b.propertyId ? Number(b.propertyId) : (b.propId ? Number(b.propId) : null),
        room_id: b.roomId ? Number(b.roomId) : null,
        unit_id: b.unitId ? Number(b.unitId) : null,
        arrival: b.arrival || '',
        departure: b.departure || '',
        first_name: b.firstName || '',
        last_name: b.lastName || '',
        num_guests: totalGuests,
        status: b.status || 'confirmed',
        api_source_id: b.apiSourceId ? Number(b.apiSourceId) : null,
        price: Number(b.price) || 0,
        notes: b.notes || '',
        raw_data: b,
        updated_at: new Date().toISOString(),
    };
}

/**
 * 여러 예약 데이터를 Supabase bookings 테이블에 일괄 upsert (중복 시 최신으로 갱신)
 * 🛡️ inquiry(단순 문의), cancelled(취소), deleted(삭제) 건은 DB 저장 자체를 원천 차단
 */
export async function upsertBookingsToSupabase(beds24Bookings: any[]): Promise<{ success: boolean; count: number; error?: string }> {
    if (!beds24Bookings || beds24Bookings.length === 0) {
        return { success: true, count: 0 };
    }

    // 🛡️ 유효한 활성 예약만 필터링 (단순 문의 inquiry, 취소, 삭제 제외)
    const validBookings = beds24Bookings.filter((b) => isValidBooking(b));
    if (validBookings.length === 0) {
        return { success: true, count: 0 };
    }

    const rows = validBookings.map(formatBeds24ToSupabaseRow);

    // Supabase 대량 upsert (500개씩 청크 분할하여 안전하게 저장)
    const chunkSize = 500;
    let savedCount = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase
            .from('bookings')
            .upsert(chunk, { onConflict: 'id' });

        if (error) {
            console.error('❌ [Supabase Bookings Upsert Error]:', error);
            return { success: false, count: savedCount, error: error.message };
        }
        savedCount += chunk.length;
    }

    return { success: true, count: savedCount };
}

/**
 * 단일 예약 삭제 처리 (Beds24 예약 취소/삭제 시)
 */
export async function deleteBookingFromSupabase(bookingId: number): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

    if (error) {
        console.error(`❌ [Supabase Bookings Delete Error] ID ${bookingId}:`, error);
        return { success: false, error: error.message };
    }
    return { success: true };
}

/**
 * 🔄 Beds24 전체 예약 완전 동기화 및 삭제된 유령 예약 자동 청소 (Reconciliation)
 * - Beds24에 존재하는 예약: Supabase에 일괄 Upsert
 * - Beds24에서 삭제된 예약: Supabase DB에서도 감지 후 일괄 Delete
 */
export async function syncAllBookingsWithSupabase(
    beds24Bookings: any[],
    arrivalFrom?: string,
    arrivalTo?: string
): Promise<{ success: boolean; savedCount: number; deletedGhostCount: number; error?: string }> {
    try {
        // 1. 유효한 예약 upsert 저장
        const upsertResult = await upsertBookingsToSupabase(beds24Bookings);
        if (!upsertResult.success) {
            return {
                success: false,
                savedCount: 0,
                deletedGhostCount: 0,
                error: upsertResult.error,
            };
        }

        // 2. 동기화 날짜 범위가 주어진 경우, 삭제된 유령 예약(Ghost Bookings) 및 취소/문의 데이터 청소
        let deletedGhostCount = 0;

        // DB에 혹시 남아있는 inquiry / cancelled / deleted 상태 데이터 선제적 정리
        const { data: invalidDbRows } = await supabase
            .from('bookings')
            .select('id')
            .or('status.eq.inquiry,status.eq.cancelled,status.eq.deleted');

        if (invalidDbRows && invalidDbRows.length > 0) {
            const invalidIds = invalidDbRows.map((r) => Number(r.id));
            const chunkSize = 500;
            for (let i = 0; i < invalidIds.length; i += chunkSize) {
                const chunk = invalidIds.slice(i, i + chunkSize);
                await supabase.from('bookings').delete().in('id', chunk);
                deletedGhostCount += chunk.length;
            }
            console.log(`🧹 [Reconciliation] DB 내 문의/취소/삭제 잔여 데이터 ${invalidIds.length}건 자동 청소 완료`);
        }

        if (arrivalFrom && arrivalTo) {
            // Beds24 API에 존재하는 유효한 예약 ID 목록 (Set) - inquiry, 취소 건 제외
            const beds24ValidIds = new Set(
                beds24Bookings
                    .filter((b) => isValidBooking(b))
                    .map((b) => Number(b.id || b.bookId))
                    .filter((id) => id > 0)
            );

            // 해당 기간 동안 Supabase DB에 저장되어 있는 모든 예약 ID 조회
            let query = supabase
                .from('bookings')
                .select('id')
                .gte('arrival', arrivalFrom)
                .lte('arrival', arrivalTo);

            const { data: dbRows, error: dbQueryError } = await query;

            if (dbQueryError) {
                console.error('⚠️ [Reconciliation DB Query Error]:', dbQueryError);
            } else if (dbRows && dbRows.length > 0) {
                // DB에는 있지만 유효 예약 목록에는 없는 유령 ID 추출
                const ghostIds = dbRows
                    .map((r) => Number(r.id))
                    .filter((id) => !beds24ValidIds.has(id));

                if (ghostIds.length > 0) {
                    console.log(`🧹 [Reconciliation] Beds24에서 삭제/문의/취소된 예약 ${ghostIds.length}건 감지 -> DB 삭제 진행:`, ghostIds);

                    // 500개씩 청크 분할 삭제
                    const chunkSize = 500;
                    for (let i = 0; i < ghostIds.length; i += chunkSize) {
                        const chunk = ghostIds.slice(i, i + chunkSize);
                        const { error: deleteErr } = await supabase
                            .from('bookings')
                            .delete()
                            .in('id', chunk);

                        if (deleteErr) {
                            console.error('❌ [Reconciliation Delete Error]:', deleteErr);
                        } else {
                            deletedGhostCount += chunk.length;
                        }
                    }
                    console.log(`✅ [Reconciliation] 유령 예약 ${deletedGhostCount}건 DB 삭제 완료`);
                }
            }
        }

        return {
            success: true,
            savedCount: upsertResult.count,
            deletedGhostCount,
        };
    } catch (err: any) {
        console.error('❌ [syncAllBookingsWithSupabase Exception]:', err);
        return {
            success: false,
            savedCount: 0,
            deletedGhostCount: 0,
            error: err.message || String(err),
        };
    }
}
