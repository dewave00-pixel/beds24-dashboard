import { supabase } from '@/lib/supabase';
import { Booking } from '../types';

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
 */
export async function upsertBookingsToSupabase(beds24Bookings: any[]): Promise<{ success: boolean; count: number; error?: string }> {
    if (!beds24Bookings || beds24Bookings.length === 0) {
        return { success: true, count: 0 };
    }

    const rows = beds24Bookings.map(formatBeds24ToSupabaseRow);

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
