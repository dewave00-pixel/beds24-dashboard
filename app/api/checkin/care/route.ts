import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const property = searchParams.get('property');
        const search = searchParams.get('search');
        const date = searchParams.get('date');
        const limit = parseInt(searchParams.get('limit') || '100', 10);

        let query = supabase
            .from('guest_care_surveys')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (property && property !== 'ALL') {
            query = query.ilike('property_name', `%${property}%`);
        }

        if (date && date !== 'ALL') {
            const dayStartIso = new Date(`${date}T00:00:00+09:00`).toISOString();
            const dayEndIso = new Date(`${date}T23:59:59.999+09:00`).toISOString();
            query = query.gte('created_at', dayStartIso).lte('created_at', dayEndIso);
        }

        if (search && search.trim()) {
            const term = search.trim();
            if (!isNaN(Number(term))) {
                query = query.or(`guest_name.ilike.%${term}%,room_name.ilike.%${term}%,booking_id.eq.${Number(term)}`);
            } else {
                query = query.or(`guest_name.ilike.%${term}%,room_name.ilike.%${term}%,property_name.ilike.%${term}%`);
            }
        }

        const { data: surveys, error: surveyError } = await query;

        if (surveyError) {
            console.error('Failed to query guest_care_surveys:', surveyError);
            return NextResponse.json({ success: false, error: surveyError.message }, { status: 500 });
        }

        // 전체 설문 기반 통계 산출 (숙소별, 카테고리별)
        const { data: allSurveys, error: allStatsError } = await supabase
            .from('guest_care_surveys')
            .select('property_name, q1_cleanliness, q2_facility, q3_environment');

        const propertyCounts: Record<string, number> = {};
        let cleanlinessIssues = 0;
        let facilityIssues = 0;
        let environmentIssues = 0;

        (allSurveys || []).forEach((row) => {
            const prop = row.property_name || '기타';
            propertyCounts[prop] = (propertyCounts[prop] || 0) + 1;

            if (row.q1_cleanliness && row.q1_cleanliness.length > 0) cleanlinessIssues++;
            if (row.q2_facility && row.q2_facility.length > 0) facilityIssues++;
            if (row.q3_environment && row.q3_environment.length > 0) environmentIssues++;
        });

        return NextResponse.json({
            success: true,
            surveys: surveys || [],
            stats: {
                totalCount: allSurveys ? allSurveys.length : (surveys ? surveys.length : 0),
                propertyCounts,
                cleanlinessIssues,
                facilityIssues,
                environmentIssues,
            },
        });
    } catch (err: any) {
        console.error('[/api/checkin/care] Server Error:', err);
        return NextResponse.json({ success: false, error: err.message || '서버 오류' }, { status: 500 });
    }
}
