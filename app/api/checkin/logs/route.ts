import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUnitDisplayInfo } from '@/app/config';

export const dynamic = 'force-dynamic';

function getKstDateString(date: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const getVal = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    return `${getVal('year')}-${getVal('month')}-${getVal('day')}`;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const eventType = searchParams.get('eventType');
        const property = searchParams.get('property');
        const search = searchParams.get('search');
        const date = searchParams.get('date'); // 'YYYY-MM-DD' 또는 null
        const defaultLimit = (date && date !== 'ALL') ? '500' : '150';
        const limit = parseInt(searchParams.get('limit') || defaultLimit, 10);

        const todayKst = getKstDateString();
        const arrivalDateParam = searchParams.get('arrivalDate');
        const targetArrivalDate = (arrivalDateParam && /^\d{4}-\d{2}-\d{2}$/.test(arrivalDateParam))
            ? arrivalDateParam
            : todayKst;

        const targetStartIso = new Date(`${targetArrivalDate}T00:00:00+09:00`).toISOString();
        const targetEndIso = new Date(`${targetArrivalDate}T23:59:59.999+09:00`).toISOString();

        // 1. 지정 날짜 입실(arrival = targetArrivalDate) 활성 예약 조회
        const { data: todayBookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('id, first_name, last_name, arrival, departure, status, room_id, unit_id, raw_data')
            .eq('arrival', targetArrivalDate);

        if (bookingsError) {
            console.error('Failed to fetch target arrivals bookings:', bookingsError);
        }

        const validTodayBookings = (todayBookings || []).filter((b: any) => {
            const st = (b.status || '').toLowerCase();
            return st !== 'cancelled' && st !== 'deleted' && st !== 'inquiry';
        });

        const todayBookingIds = validTodayBookings.map((b: any) => b.id);

        // 2. 지정 날짜 입실 예약들과 관련된 로그 및 게스트 케어 조회 (booking_id 매칭)
        let matchedLogs: any[] = [];
        let matchedCareSurveys: any[] = [];
        if (todayBookingIds.length > 0) {
            const [logsRes, careRes] = await Promise.all([
                supabase.from('checkin_logs').select('*').in('booking_id', todayBookingIds),
                supabase.from('guest_care_surveys').select('*').in('booking_id', todayBookingIds),
            ]);
            matchedLogs = logsRes.data || [];
            matchedCareSurveys = careRes.data || [];
        }

        const careSurveyMap: Record<number, any> = {};
        matchedCareSurveys.forEach((care) => {
            if (care.booking_id) {
                careSurveyMap[care.booking_id] = care;
            }
        });

        // 게스트 여정 / 체크인 세부 정보 매핑
        const checkinDetailsMap: Record<number, any> = {};
        matchedLogs.forEach((l) => {
            if (l.booking_id && l.event_type === 'CHECKIN_INFO_SUBMITTED') {
                if (!checkinDetailsMap[l.booking_id] || new Date(l.created_at) > new Date(checkinDetailsMap[l.booking_id].submittedAt || 0)) {
                    checkinDetailsMap[l.booking_id] = {
                        ...l.metadata,
                        submittedAt: l.created_at,
                    };
                }
            }
        });

        // 3. 해당 날짜에 발생한 'LOOKUP_FAILED' 로그 건수 조회
        const { count: todayFailuresCount } = await supabase
            .from('checkin_logs')
            .select('id', { count: 'exact', head: true })
            .eq('event_type', 'LOOKUP_FAILED')
            .gte('created_at', targetStartIso)
            .lte('created_at', targetEndIso);

        // 4. 지정 날짜 입실 게스트별 상태 매핑
        const bookingStatusMap: Record<
            number,
            {
                status: 'PASSWORD_VIEWED' | 'RULES_AGREED' | 'LOOKED_UP' | 'UNCHECKED';
                lastEventAt: string | null;
            }
        > = {};

        validTodayBookings.forEach((b: any) => {
            const logs = matchedLogs.filter((l) => l.booking_id === b.id);
            if (logs.length === 0) {
                bookingStatusMap[b.id] = { status: 'UNCHECKED', lastEventAt: null };
            } else {
                // 최신순 정렬
                logs.sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());
                const hasPasswordView = logs.some((l) => l.event_type === 'DOORLOCK_ACCESSED');
                const hasRulesAgreed = logs.some((l) => l.event_type === 'HOUSE_RULES_AGREED');
                const hasLookup = logs.some((l) => l.event_type === 'LOOKUP_SUCCESS');

                let status: 'PASSWORD_VIEWED' | 'RULES_AGREED' | 'LOOKED_UP' | 'UNCHECKED' = 'LOOKED_UP';
                if (hasPasswordView) {
                    status = 'PASSWORD_VIEWED';
                } else if (hasRulesAgreed) {
                    status = 'RULES_AGREED';
                } else if (hasLookup) {
                    status = 'LOOKED_UP';
                } else {
                    status = 'UNCHECKED';
                }

                bookingStatusMap[b.id] = {
                    status,
                    lastEventAt: logs[0]?.created_at || null,
                };
            }
        });

        // 5. 오늘 KPI 통계 산출
        const totalArrivals = validTodayBookings.length;
        let rulesAgreedCount = 0;
        let passwordViewedCount = 0;
        let uncheckedCount = 0;

        validTodayBookings.forEach((b: any) => {
            const st = bookingStatusMap[b.id]?.status;
            if (st === 'PASSWORD_VIEWED') {
                passwordViewedCount++;
                rulesAgreedCount++; // 비번 열람자는 당연히 규칙 동의 완료
            } else if (st === 'RULES_AGREED') {
                rulesAgreedCount++;
            } else if (st === 'UNCHECKED') {
                uncheckedCount++;
            }
        });

        const rulesAgreedPercent = totalArrivals > 0 ? Math.round((rulesAgreedCount / totalArrivals) * 100) : 0;

        // 오늘 입실 명단 데이터 가공
        const todayArrivalsList = validTodayBookings.map((b: any) => {
            const unitInfo = getUnitDisplayInfo({
                roomId: b.room_id,
                unitId: b.unit_id,
            });

            const raw = b.raw_data || {};
            const channel = raw.apiSource || raw.channel || raw.referer || 'Direct';
            const phone = raw.mobile || raw.phone || '';
            const statusInfo = bookingStatusMap[b.id] || { status: 'UNCHECKED', lastEventAt: null };
            const careSurvey = careSurveyMap[b.id] || null;
            const checkinDetails = checkinDetailsMap[b.id] || null;

            return {
                bookingId: b.id,
                guestName: `${b.first_name || ''} ${b.last_name || ''}`.trim() || '게스트',
                propertyName: unitInfo.propertyName,
                unitName: unitInfo.unitDisplayName,
                subName: unitInfo.subName,
                badgeStyle: unitInfo.badgeStyle,
                channel,
                phone,
                status: statusInfo.status,
                lastEventAt: statusInfo.lastEventAt,
                numGuests: raw.numAdult ? Number(raw.numAdult) + Number(raw.numChild || 0) : 1,
                careSurvey: careSurvey
                    ? {
                          id: careSurvey.id,
                          createdAt: careSurvey.created_at,
                          cleanliness: careSurvey.q1_cleanliness || [],
                          facility: careSurvey.q2_facility || [],
                          environment: careSurvey.q3_environment || [],
                          comment: careSurvey.q4_comment || '',
                      }
                    : null,
                checkinDetails,
            };
        });

        // 6. 실시간 전체 로그 타임라인 조회 (필터 및 검색)
        let query = supabase
            .from('checkin_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (eventType && eventType !== 'ALL') {
            query = query.eq('event_type', eventType);
        }

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
            // booking_id 숫자인 경우와 텍스트인 경우 대응
            if (!isNaN(Number(term))) {
                query = query.or(`input_guest_name.ilike.%${term}%,booking_id.eq.${Number(term)}`);
            } else {
                query = query.or(`input_guest_name.ilike.%${term}%,property_name.ilike.%${term}%,unit_key.ilike.%${term}%`);
            }
        }

        const { data: logs, error: logsError } = await query;

        if (logsError) {
            console.error('Failed to query checkin_logs:', logsError);
            return NextResponse.json({ success: false, error: logsError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            todayDate: todayKst,
            targetDate: targetArrivalDate,
            todayStats: {
                totalArrivals,
                rulesAgreedCount,
                rulesAgreedPercent,
                uncheckedCount,
                passwordViewedCount,
                todayFailuresCount: todayFailuresCount || 0,
                careSubmittedCount: matchedCareSurveys.length,
            },
            todayArrivalsList,
            logs: logs || [],
        });
    } catch (err: any) {
        console.error('[/api/checkin/logs] Server Error:', err);
        return NextResponse.json({ success: false, error: err.message || '서버 오류' }, { status: 500 });
    }
}
