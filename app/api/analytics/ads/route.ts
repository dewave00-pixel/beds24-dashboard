import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const OTA_NAMES: Record<number, string> = {
    46: 'Airbnb',
    19: 'Booking.com',
    17: 'Agoda',
    53: 'Trip.com',
    14: 'Expedia',
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_KRW_AMOUNT = 2_147_483_647;

async function isAdminRequest(): Promise<boolean> {
    const cookieStore = await cookies();
    return cookieStore.get('auth_role')?.value === 'admin';
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : '알 수 없는 서버 오류가 발생했습니다.';
}

function parseNullableNumber(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isAllowedSourceId(value: unknown): value is number {
    return Number.isInteger(value) && OTA_NAMES[Number(value)] !== undefined;
}

function isValidDateString(value: string): boolean {
    if (!DATE_PATTERN.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function unauthorizedResponse() {
    return NextResponse.json(
        { success: false, error: '광고비 설정은 관리자만 사용할 수 있습니다.' },
        { status: 403 }
    );
}

export async function GET(request: Request) {
    if (!(await isAdminRequest())) return unauthorizedResponse();

    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (
            !startDate ||
            !endDate ||
            !isValidDateString(startDate) ||
            !isValidDateString(endDate) ||
            startDate > endDate
        ) {
            return NextResponse.json(
                { success: false, error: '유효한 조회 시작일과 종료일이 필요합니다.' },
                { status: 400 }
            );
        }

        const [settingsResult, chargesResult] = await Promise.all([
            supabase
                .from('ota_ad_settings')
                .select('api_source_id, channel_name, cpc_amount, cpb_rate, note, updated_at')
                .order('api_source_id'),
            supabase
                .from('ota_ad_charges')
                .select('id, api_source_id, channel_name, charge_date, amount, note, created_at')
                .gte('charge_date', startDate)
                .lte('charge_date', endDate)
                .order('charge_date', { ascending: false })
                .order('created_at', { ascending: false }),
        ]);

        if (settingsResult.error) throw settingsResult.error;
        if (chargesResult.error) throw chargesResult.error;

        const settings = (settingsResult.data || []).map((row) => ({
            apiSourceId: row.api_source_id,
            channelName: row.channel_name,
            cpcAmount: row.cpc_amount === null ? null : Number(row.cpc_amount),
            cpbRate: row.cpb_rate === null ? null : Number(row.cpb_rate),
            note: row.note || '',
            updatedAt: row.updated_at,
        }));
        const charges = (chargesResult.data || []).map((row) => ({
            id: row.id,
            apiSourceId: row.api_source_id,
            channelName: row.channel_name,
            chargeDate: row.charge_date,
            amount: Number(row.amount) || 0,
            note: row.note || '',
            createdAt: row.created_at,
        }));

        return NextResponse.json({ success: true, settings, charges });
    } catch (error: unknown) {
        console.error('광고비 설정 조회 오류:', error);
        return NextResponse.json(
            { success: false, error: getErrorMessage(error) },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    if (!(await isAdminRequest())) return unauthorizedResponse();

    try {
        const body = await request.json();

        if (body.action === 'save-setting') {
            const apiSourceId = Number(body.apiSourceId);
            const cpcAmount = parseNullableNumber(body.cpcAmount);
            const cpbRate = parseNullableNumber(body.cpbRate);
            const note = typeof body.note === 'string' ? body.note.trim() : '';

            if (!isAllowedSourceId(apiSourceId)) {
                return NextResponse.json({ success: false, error: '지원하지 않는 OTA입니다.' }, { status: 400 });
            }
            if (
                Number.isNaN(cpcAmount) ||
                (cpcAmount !== null && (!Number.isInteger(cpcAmount) || cpcAmount < 0 || cpcAmount > MAX_KRW_AMOUNT))
            ) {
                return NextResponse.json({ success: false, error: 'CPC는 0 이상의 원 단위 정수여야 합니다.' }, { status: 400 });
            }
            if (Number.isNaN(cpbRate) || (cpbRate !== null && (cpbRate < 0 || cpbRate > 100))) {
                return NextResponse.json({ success: false, error: 'CPB는 0~100 사이의 비율이어야 합니다.' }, { status: 400 });
            }
            if (note.length > 500) {
                return NextResponse.json({ success: false, error: '메모는 500자 이하로 입력해 주세요.' }, { status: 400 });
            }

            const { error } = await supabase.from('ota_ad_settings').upsert(
                {
                    api_source_id: apiSourceId,
                    channel_name: OTA_NAMES[apiSourceId],
                    cpc_amount: cpcAmount,
                    cpb_rate: cpbRate,
                    note,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'api_source_id' }
            );
            if (error) throw error;

            return NextResponse.json({ success: true });
        }

        if (body.action === 'add-charge') {
            const apiSourceId = Number(body.apiSourceId);
            const chargeDate = typeof body.chargeDate === 'string' ? body.chargeDate : '';
            const amount = Number(body.amount);
            const note = typeof body.note === 'string' ? body.note.trim() : '';

            if (apiSourceId !== 53) {
                return NextResponse.json({ success: false, error: '현재 충전액 차감은 Trip.com만 지원합니다.' }, { status: 400 });
            }
            if (!isValidDateString(chargeDate)) {
                return NextResponse.json({ success: false, error: '유효한 충전일을 입력해 주세요.' }, { status: 400 });
            }
            if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_KRW_AMOUNT) {
                return NextResponse.json({ success: false, error: '충전액은 0보다 큰 원 단위 정수여야 합니다.' }, { status: 400 });
            }
            if (note.length > 500) {
                return NextResponse.json({ success: false, error: '메모는 500자 이하로 입력해 주세요.' }, { status: 400 });
            }

            const { error } = await supabase.from('ota_ad_charges').insert({
                api_source_id: apiSourceId,
                channel_name: OTA_NAMES[apiSourceId],
                charge_date: chargeDate,
                amount,
                note,
            });
            if (error) throw error;

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, error: '지원하지 않는 요청입니다.' }, { status: 400 });
    } catch (error: unknown) {
        console.error('광고비 설정 저장 오류:', error);
        return NextResponse.json(
            { success: false, error: getErrorMessage(error) },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    if (!(await isAdminRequest())) return unauthorizedResponse();

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ success: false, error: '삭제할 충전 내역 ID가 필요합니다.' }, { status: 400 });
        }

        const { error } = await supabase
            .from('ota_ad_charges')
            .delete()
            .eq('id', id)
            .eq('api_source_id', 53);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('광고 충전 내역 삭제 오류:', error);
        return NextResponse.json(
            { success: false, error: getErrorMessage(error) },
            { status: 500 }
        );
    }
}
