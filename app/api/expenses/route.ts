import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export type ExpenseCategory =
    | 'cleaning'
    | 'supplies'
    | 'utilities'
    | 'repair'
    | 'rent'
    | 'tax_fee'
    | 'other';

export type ExpensePaymentMethod =
    | 'card'
    | 'tax_invoice'
    | 'cash_receipt'
    | 'other';

export interface OperatingExpenseItem {
    id: string;
    expenseDate: string;
    propertyName: string; // 'all' | 'WAVE' | 'YEONNAM' | 'Green' | 'Horang'
    unitKey?: string | null;
    category: ExpenseCategory;
    amount: number;
    paymentMethod: ExpensePaymentMethod;
    isRecurring: boolean;
    description: string;
    createdAt: string;
}

const FALLBACK_BOOKING_ID = -999100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const MAX_KRW_AMOUNT = 2_147_483_647;

const ALLOWED_PROPERTIES = new Set(['all', 'WAVE', 'YEONNAM', 'Green', 'Horang']);
const ALLOWED_CATEGORIES = new Set<ExpenseCategory>([
    'cleaning',
    'supplies',
    'utilities',
    'repair',
    'rent',
    'tax_fee',
    'other',
]);
const ALLOWED_PAYMENT_METHODS = new Set<ExpensePaymentMethod>([
    'card',
    'tax_invoice',
    'cash_receipt',
    'other',
]);

async function isAdminRequest(): Promise<boolean> {
    const cookieStore = await cookies();
    return cookieStore.get('auth_role')?.value === 'admin';
}

function unauthorizedResponse() {
    return NextResponse.json(
        { success: false, error: '비용 관리는 최고관리자(admin)만 사용할 수 있습니다.' },
        { status: 403 }
    );
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    const code = error.code || '';
    const msg = (error.message || '').toLowerCase();
    return (
        code === '42P01' ||
        code === 'PGRST205' ||
        msg.includes('operating_expenses') ||
        msg.includes('does not exist') ||
        msg.includes('schema cache')
    );
}

async function readFallbackExpenses(): Promise<OperatingExpenseItem[]> {
    const { data, error } = await supabase
        .from('booking_notes')
        .select('note')
        .eq('booking_id', FALLBACK_BOOKING_ID)
        .maybeSingle();

    if (error || !data?.note) return [];
    try {
        const parsed = JSON.parse(data.note);
        return Array.isArray(parsed) ? (parsed as OperatingExpenseItem[]) : [];
    } catch {
        return [];
    }
}

async function writeFallbackExpenses(list: OperatingExpenseItem[]): Promise<void> {
    const sorted = [...list].sort(
        (a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.createdAt.localeCompare(a.createdAt)
    );
    const { error } = await supabase
        .from('booking_notes')
        .upsert(
            {
                booking_id: FALLBACK_BOOKING_ID,
                note: JSON.stringify(sorted),
                tags: ['system_operating_expenses'],
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'booking_id' }
        );
    if (error) throw error;
}

interface DbExpenseRow {
    id: string;
    expense_date: string;
    property_name: string;
    unit_key?: string | null;
    category: ExpenseCategory;
    amount: number;
    payment_method: ExpensePaymentMethod;
    is_recurring: boolean;
    description: string;
    created_at: string;
}

function mapDbRowToItem(row: DbExpenseRow): OperatingExpenseItem {
    return {
        id: String(row.id),
        expenseDate: row.expense_date,
        propertyName: row.property_name || 'all',
        unitKey: row.unit_key || null,
        category: ALLOWED_CATEGORIES.has(row.category) ? row.category : 'other',
        amount: Number(row.amount) || 0,
        paymentMethod: ALLOWED_PAYMENT_METHODS.has(row.payment_method) ? row.payment_method : 'card',
        isRecurring: Boolean(row.is_recurring),
        description: row.description || '',
        createdAt: row.created_at || new Date().toISOString(),
    };
}

export async function GET(request: Request) {
    if (!(await isAdminRequest())) return unauthorizedResponse();

    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let query = supabase
            .from('operating_expenses')
            .select('id, expense_date, property_name, unit_key, category, amount, payment_method, is_recurring, description, created_at')
            .order('expense_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (startDate && DATE_PATTERN.test(startDate)) {
            query = query.gte('expense_date', startDate);
        }
        if (endDate && DATE_PATTERN.test(endDate)) {
            query = query.lte('expense_date', endDate);
        }

        const { data, error } = await query;

        if (error) {
            if (isMissingTableError(error)) {
                const allFallback = await readFallbackExpenses();
                const filtered = allFallback.filter((item) => {
                    if (startDate && DATE_PATTERN.test(startDate) && item.expenseDate < startDate) return false;
                    if (endDate && DATE_PATTERN.test(endDate) && item.expenseDate > endDate) return false;
                    return true;
                });
                return NextResponse.json({
                    success: true,
                    storage: 'fallback_store',
                    data: filtered,
                });
            }
            throw error;
        }

        const items = ((data || []) as DbExpenseRow[]).map(mapDbRowToItem);
        return NextResponse.json({
            success: true,
            storage: 'operating_expenses',
            data: items,
        });
    } catch (error: unknown) {
        console.error('운영 비용 조회 오류:', error);
        const message = error instanceof Error ? error.message : '비용 데이터를 불러오지 못했습니다.';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    if (!(await isAdminRequest())) return unauthorizedResponse();

    try {
        const body = await request.json();
        const action = body.action || 'add';

        // 1) 전월 고정비 일괄 복사
        if (action === 'copy-recurring') {
            const sourceMonth = typeof body.sourceMonth === 'string' ? body.sourceMonth : '';
            const targetMonth = typeof body.targetMonth === 'string' ? body.targetMonth : '';

            if (!MONTH_PATTERN.test(sourceMonth) || !MONTH_PATTERN.test(targetMonth)) {
                return NextResponse.json(
                    { success: false, error: '유효한 기준 월(YYYY-MM)과 대상 월(YYYY-MM)이 필요합니다.' },
                    { status: 400 }
                );
            }

            const sourceStart = `${sourceMonth}-01`;
            const sourceEnd = `${sourceMonth}-31`;
            const [ty, tm] = targetMonth.split('-').map(Number);
            const targetLastDay = new Date(ty, tm, 0).getDate();

            const toTargetDate = (srcDate: string) => {
                const dayNum = Math.min(targetLastDay, Math.max(1, Number(srcDate.slice(8, 10)) || 1));
                return `${targetMonth}-${String(dayNum).padStart(2, '0')}`;
            };

            const { data: dbRows, error: dbErr } = await supabase
                .from('operating_expenses')
                .select('id, expense_date, property_name, unit_key, category, amount, payment_method, is_recurring, description, created_at')
                .eq('is_recurring', true)
                .gte('expense_date', sourceStart)
                .lte('expense_date', sourceEnd);

            if (dbErr) {
                if (isMissingTableError(dbErr)) {
                    const allFallback = await readFallbackExpenses();
                    const recurringList = allFallback.filter(
                        (item) =>
                            item.isRecurring &&
                            item.expenseDate >= sourceStart &&
                            item.expenseDate <= sourceEnd
                    );
                    if (recurringList.length === 0) {
                        return NextResponse.json({
                            success: true,
                            copiedCount: 0,
                            message: `${sourceMonth}에 등록된 고정비 항목이 없습니다.`,
                        });
                    }
                    const nowIso = new Date().toISOString();
                    const copiedItems: OperatingExpenseItem[] = recurringList.map((item, idx) => ({
                        ...item,
                        id: `exp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
                        expenseDate: toTargetDate(item.expenseDate),
                        createdAt: nowIso,
                    }));
                    await writeFallbackExpenses([...copiedItems, ...allFallback]);
                    return NextResponse.json({
                        success: true,
                        copiedCount: copiedItems.length,
                        message: `${sourceMonth} 고정비 ${copiedItems.length}건을 ${targetMonth}로 복사했습니다.`,
                    });
                }
                throw dbErr;
            }

            const rows = (dbRows || []) as DbExpenseRow[];
            if (rows.length === 0) {
                return NextResponse.json({
                    success: true,
                    copiedCount: 0,
                    message: `${sourceMonth}에 등록된 고정비 항목이 없습니다.`,
                });
            }

            const insertPayload = rows.map((r) => ({
                expense_date: toTargetDate(r.expense_date),
                property_name: r.property_name,
                unit_key: r.unit_key || null,
                category: r.category,
                amount: r.amount,
                payment_method: r.payment_method,
                is_recurring: true,
                description: r.description,
            }));

            const { error: insertErr } = await supabase.from('operating_expenses').insert(insertPayload);
            if (insertErr) throw insertErr;

            return NextResponse.json({
                success: true,
                copiedCount: insertPayload.length,
                message: `${sourceMonth} 고정비 ${insertPayload.length}건을 ${targetMonth}로 복사했습니다.`,
            });
        }

        // 2) 일반 비용 등록(add) 또는 수정(update)
        const expenseDate = typeof body.expenseDate === 'string' ? body.expenseDate.trim() : '';
        const propertyName = typeof body.propertyName === 'string' && ALLOWED_PROPERTIES.has(body.propertyName)
            ? body.propertyName
            : 'all';
        const unitKey = typeof body.unitKey === 'string' && body.unitKey.trim() ? body.unitKey.trim() : null;
        const category: ExpenseCategory = ALLOWED_CATEGORIES.has(body.category) ? body.category : 'other';
        const amount = Math.round(Number(body.amount));
        const paymentMethod: ExpensePaymentMethod = ALLOWED_PAYMENT_METHODS.has(body.paymentMethod)
            ? body.paymentMethod
            : 'card';
        const isRecurring = Boolean(body.isRecurring);
        const description = typeof body.description === 'string' ? body.description.trim() : '';

        if (!DATE_PATTERN.test(expenseDate)) {
            return NextResponse.json({ success: false, error: '유효한 지출 일자(YYYY-MM-DD)를 입력해 주세요.' }, { status: 400 });
        }
        if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_KRW_AMOUNT) {
            return NextResponse.json({ success: false, error: '금액은 0원보다 큰 정수여야 합니다.' }, { status: 400 });
        }
        if (description.length > 300) {
            return NextResponse.json({ success: false, error: '상세 내역은 300자 이하로 입력해 주세요.' }, { status: 400 });
        }

        if (action === 'update') {
            const id = typeof body.id === 'string' ? body.id.trim() : '';
            if (!id) {
                return NextResponse.json({ success: false, error: '수정할 비용 ID가 필요합니다.' }, { status: 400 });
            }

            const { error: updateErr } = await supabase
                .from('operating_expenses')
                .update({
                    expense_date: expenseDate,
                    property_name: propertyName,
                    unit_key: unitKey,
                    category,
                    amount,
                    payment_method: paymentMethod,
                    is_recurring: isRecurring,
                    description,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);

            if (updateErr) {
                if (isMissingTableError(updateErr)) {
                    const allFallback = await readFallbackExpenses();
                    const nextList = allFallback.map((item) =>
                        item.id === id
                            ? {
                                  ...item,
                                  expenseDate,
                                  propertyName,
                                  unitKey,
                                  category,
                                  amount,
                                  paymentMethod,
                                  isRecurring,
                                  description,
                              }
                            : item
                    );
                    await writeFallbackExpenses(nextList);
                    return NextResponse.json({ success: true });
                }
                throw updateErr;
            }
            return NextResponse.json({ success: true });
        }

        // 신규 추가
        const { error: insertErr } = await supabase.from('operating_expenses').insert({
            expense_date: expenseDate,
            property_name: propertyName,
            unit_key: unitKey,
            category,
            amount,
            payment_method: paymentMethod,
            is_recurring: isRecurring,
            description,
        });

        if (insertErr) {
            if (isMissingTableError(insertErr)) {
                const allFallback = await readFallbackExpenses();
                const newItem: OperatingExpenseItem = {
                    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    expenseDate,
                    propertyName,
                    unitKey,
                    category,
                    amount,
                    paymentMethod,
                    isRecurring,
                    description,
                    createdAt: new Date().toISOString(),
                };
                await writeFallbackExpenses([newItem, ...allFallback]);
                return NextResponse.json({ success: true, item: newItem });
            }
            throw insertErr;
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('운영 비용 저장 오류:', error);
        const message = error instanceof Error ? error.message : '비용 저장 중 오류가 발생했습니다.';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    if (!(await isAdminRequest())) return unauthorizedResponse();

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ success: false, error: '삭제할 비용 ID가 필요합니다.' }, { status: 400 });
        }

        const { error } = await supabase.from('operating_expenses').delete().eq('id', id);
        if (error) {
            if (isMissingTableError(error)) {
                const allFallback = await readFallbackExpenses();
                await writeFallbackExpenses(allFallback.filter((item) => item.id !== id));
                return NextResponse.json({ success: true });
            }
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('운영 비용 삭제 오류:', error);
        const message = error instanceof Error ? error.message : '비용 삭제 중 오류가 발생했습니다.';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
