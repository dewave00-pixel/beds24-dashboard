import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const DEFAULT_STAFF_MAP: Record<string, string> = {
    manager: '소영매니저님',
    staff_2: '가연영님',
    staff_3: '지명님',
    staff_4: 'ZEAL님',
};

// GET: Supabase DB에서 스태프 이름 맵(staffMap) 조회
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('role, name');

        if (error) {
            console.error('스태프 목록 조회 DB 오류:', error);
            return NextResponse.json({ success: true, data: DEFAULT_STAFF_MAP });
        }

        const staffMap: Record<string, string> = { ...DEFAULT_STAFF_MAP };

        if (data && data.length > 0) {
            data.forEach((row) => {
                if (row.role && row.name && row.name.trim() !== '') {
                    // 기본 계정 ID(예: 'staff_2')가 아닌 실제 변경된 이름이 저장되어 있으면 반영
                    if (row.name !== row.role) {
                        staffMap[row.role] = row.name;
                    }
                }
            });
        }

        return NextResponse.json({ success: true, data: staffMap });
    } catch (err: any) {
        console.error('스태프 GET 처리 오류:', err);
        return NextResponse.json({ success: true, data: DEFAULT_STAFF_MAP });
    }
}

// POST: Supabase DB에 스태프 이름 맵(staffMap) 업데이트
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { staffMap } = body;

        if (!staffMap || typeof staffMap !== 'object') {
            return NextResponse.json({ success: false, error: '유효한 staffMap 객체가 필요합니다.' }, { status: 400 });
        }

        const updatePromises = Object.entries(staffMap).map(async ([role, name]) => {
            if (!role || !name) return;
            const staffName = String(name).trim();

            const { error } = await supabase
                .from('user_profiles')
                .update({
                    name: staffName,
                    updated_at: new Date().toISOString(),
                })
                .eq('role', role);

            if (error) {
                console.error(`스태프(${role}) 이름 업데이트 오류:`, error);
            }
        });

        await Promise.all(updatePromises);

        return NextResponse.json({ success: true, message: '스태프 이름이 Supabase DB에 안전하게 저장되었습니다.' });
    } catch (err: any) {
        console.error('스태프 POST 처리 오류:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
