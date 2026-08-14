import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 연결 모듈
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. GET: 숙소 호실별 비밀번호, 최대인원, 큰 수리 메모 목록 조회
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('properties_info')
            .select('*');

        if (error) {
            console.error('숙소 정보 불러오기 실패:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // 화면에서 쓰기 편하게 { [id]: { doorPassword, maxGuests, repairNotes } } 객체 형태로 변환
        const infoMap: { [id: string]: { doorPassword: string; maxGuests: number; repairNotes: string } } = {};
        if (data) {
            data.forEach((item) => {
                infoMap[item.id] = {
                    doorPassword: item.door_password || '',
                    maxGuests: item.max_guests || 2,
                    repairNotes: item.repair_notes || '',
                };
            });
        }

        return NextResponse.json({ success: true, data: infoMap });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message || '서버 오류' }, { status: 500 });
    }
}

// 2. POST: 숙소 호실별 비밀번호, 최대인원, 큰 수리 메모 실시간 저장/수정
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, roomId, unitId, doorPassword, maxGuests, repairNotes } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: '호실 고유 식별자(id)가 필요합니다.' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('properties_info')
            .upsert(
                {
                    id,
                    room_id: roomId ? Number(roomId) : null,
                    unit_id: unitId ? Number(unitId) : null,
                    door_password: doorPassword || '',
                    max_guests: Number(maxGuests) || 2,
                    repair_notes: repairNotes || '',
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'id' }
            )
            .select()
            .single();

        if (error) {
            console.error('숙소 정보 저장 실패:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message || '서버 오류' }, { status: 500 });
    }
}