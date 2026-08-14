import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 1. 모든 예약의 특이사항 메모 불러오기 (GET)
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('booking_notes')
            .select('booking_id, note, updated_at');

        if (error) {
            console.error('메모 조회 DB 오류:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // 화면에서 쓰기 편하게 { [예약ID]: "메모내용" } 형태로 변환하여 응답
        const memosMap: { [bookingId: number]: string } = {};
        if (data) {
            data.forEach((row: { booking_id: number; note: string }) => {
                memosMap[row.booking_id] = row.note;
            });
        }

        return NextResponse.json({ success: true, data: memosMap });
    } catch (err: any) {
        console.error('메모 GET 처리 중 오류:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// 2. 특이사항 메모 저장 또는 수정하기 (POST)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { bookingId, note } = body;

        if (!bookingId) {
            return NextResponse.json({ success: false, error: '예약 ID가 필요합니다.' }, { status: 400 });
        }

        // upsert: 이미 있으면 수정, 없으면 신규 생성
        const { error } = await supabase
            .from('booking_notes')
            .upsert(
                {
                    booking_id: Number(bookingId),
                    note: note || '',
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'booking_id' }
            );

        if (error) {
            console.error('메모 저장 DB 오류:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('메모 POST 처리 중 오류:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// 3. 특이사항 메모 삭제하기 (DELETE)
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
            console.error('메모 삭제 DB 오류:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('메모 DELETE 처리 중 오류:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}