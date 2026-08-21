import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 📌 캐싱 방지: 항상 실시간으로 최신 메모/태그 조회
export const dynamic = 'force-dynamic';

// 1. 모든 예약의 메모 및 태그 목록 불러오기 (GET)
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('booking_notes')
            .select('booking_id, note, tags, updated_at');

        if (error) {
            console.error('메모/태그 조회 DB 오류:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // 화면에서 쓰기 편하게 { [예약ID]: { note: string, tags: string[] } } 형태로 변환
        const notesMap: { [bookingId: number]: { note: string; tags: string[] } } = {};
        if (data) {
            data.forEach((row: { booking_id: number; note: string; tags: string[] | null }) => {
                notesMap[row.booking_id] = {
                    note: row.note || '',
                    tags: Array.isArray(row.tags) ? row.tags : [],
                };
            });
        }

        return NextResponse.json({ success: true, data: notesMap });
    } catch (err: any) {
        console.error('메모/태그 GET 처리 중 오류:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// 2. 특이사항 메모 및 태그 저장/수정하기 (POST)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { bookingId, note, tags } = body;

        if (!bookingId) {
            return NextResponse.json({ success: false, error: '예약 ID가 필요합니다.' }, { status: 400 });
        }

        const { error } = await supabase
            .from('booking_notes')
            .upsert(
                {
                    booking_id: Number(bookingId),
                    note: note || '',
                    tags: Array.isArray(tags) ? tags : [],
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'booking_id' }
            );

        if (error) {
            console.error('메모/태그 저장 DB 오류:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('메모/태그 POST 처리 중 오류:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// 3. 특이사항 메모 및 태그 삭제하기 (DELETE)
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const bookingId = searchParams.get('bookingId');

        if (!bookingId) {
            return NextResponse.json({ success: false, error: '삭제할 예약 ID가 필요합니다.' }, { status: 400 });
        }

        const { error } = await supabase
            .from('booking_notes')
            .delete()
            .eq('booking_id', Number(bookingId));

        if (error) {
            console.error('메모/태그 삭제 DB 오류:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('메모/태그 DELETE 처리 중 오류:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}