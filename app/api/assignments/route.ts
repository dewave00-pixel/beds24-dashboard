import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: 특정 날짜의 배정 내역 조회
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetDate = searchParams.get('targetDate');
        const historyDatesStr = searchParams.get('historyDates');

        if (!targetDate) {
            return NextResponse.json({ success: false, error: 'targetDate 파라미터가 필요합니다.' }, { status: 400 });
        }

        const historyDates = historyDatesStr ? historyDatesStr.split(',').filter(Boolean) : [];
        const allDatesToQuery = Array.from(new Set([targetDate, ...historyDates]));

        let query = supabase.from('cleaning_assignments').select('*');
        if (allDatesToQuery.length === 1) {
            query = query.eq('target_date', targetDate);
        } else {
            query = query.in('target_date', allDatesToQuery);
        }

        const { data, error } = await query;

        if (error) {
            console.error('배정 조회 DB 오류:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        const assignmentsMap: Record<string, any> = {};
        // historyMap: { [dateStr]: { [unitKey]: { unitKey, staffName, staffId, isCompleted, completedAt } } }
        const historyMap: Record<string, Record<string, any>> = {};

        if (data) {
            data.forEach((row) => {
                const item = {
                    unitKey: row.unit_key,
                    staffName: row.staff_name,
                    staffId: row.staff_id,
                    assignedAt: row.assigned_at,
                    isCompleted: !!row.is_completed,
                    completedAt: row.completed_at || '',
                };

                if (row.target_date === targetDate) {
                    assignmentsMap[row.unit_key] = item;
                } else {
                    if (!historyMap[row.target_date]) {
                        historyMap[row.target_date] = {};
                    }
                    historyMap[row.target_date][row.unit_key] = item;
                }
            });
        }

        return NextResponse.json({ success: true, data: assignmentsMap, history: historyMap });
    } catch (err: any) {
        console.error('배정 GET 처리 중 오류:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST: 배정 내역 추가/수정 (완료 상태 토글 포함)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { unitKey, targetDate, staffName, staffId, assignedAt, isCompleted, completedAt } = body;

        if (!unitKey || !targetDate || !staffName || !staffId) {
            return NextResponse.json({ success: false, error: '필수 파라미터 누락' }, { status: 400 });
        }

        const upsertPayload: Record<string, any> = {
            unit_key: unitKey,
            target_date: targetDate,
            staff_name: staffName,
            staff_id: staffId,
            assigned_at: assignedAt || '',
        };

        if (typeof isCompleted === 'boolean') {
            upsertPayload.is_completed = isCompleted;
            upsertPayload.completed_at = completedAt || null;
        }

        const { error } = await supabase
            .from('cleaning_assignments')
            .upsert(
                upsertPayload,
                { onConflict: 'unit_key, target_date' }
            );

        if (error) {
            console.error('배정 추가 DB 오류:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('배정 POST 처리 중 오류:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// DELETE: 배정 해제
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const unitKey = searchParams.get('unitKey');
        const targetDate = searchParams.get('targetDate');

        if (!unitKey || !targetDate) {
            return NextResponse.json({ success: false, error: '삭제할 unitKey와 targetDate가 필요합니다.' }, { status: 400 });
        }

        const { error } = await supabase
            .from('cleaning_assignments')
            .delete()
            .eq('unit_key', unitKey)
            .eq('target_date', targetDate);

        if (error) {
            console.error('배정 삭제 DB 오류:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('배정 DELETE 처리 중 오류:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
