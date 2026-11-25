'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import '../dashboard.css';
import { Booking } from '../types';
import { ALL_UNITS } from '../config';
import { useAuth } from '../hooks/useAuth';
import { useOtaAdCosts } from '../hooks/useOtaAdCosts';
import { getKSTTodayStr } from '../utils/dateUtils';
import { isRevenueBooking } from '../utils/bookingUtils';
import {
    calculateOverallSummary,
    calculatePropertyStats,
    formatLocalDate,
} from '../utils/analyticsCalculations';
import {
    calculateAdSpendBreakdown,
    calculateRevenueAfterAdSpend,
} from '../utils/adCostCalculations';
import AppSidebar from '../components/layout/AppSidebar';
import type {
    ExpenseCategory,
    ExpensePaymentMethod,
    OperatingExpenseItem,
} from '../api/expenses/route';

type QuickPeriod = 'this_month' | 'last_month' | 'this_year';

export const EXPENSE_CATEGORIES: {
    key: ExpenseCategory;
    label: string;
    icon: string;
    badgeClass: string;
    barColor: string;
}[] = [
    {
        key: 'cleaning',
        label: '청소 / 세탁 / 인건비',
        icon: '🧹',
        badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
        barColor: '#2563EB',
    },
    {
        key: 'supplies',
        label: '비품 / 소모품',
        icon: '🧻',
        badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        barColor: '#059669',
    },
    {
        key: 'utilities',
        label: '공과금 / 통신비',
        icon: '💡',
        badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
        barColor: '#D97706',
    },
    {
        key: 'repair',
        label: '수리 / 시설유지',
        icon: '🛠️',
        badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
        barColor: '#EA580C',
    },
    {
        key: 'rent',
        label: '임대료 / 관리비',
        icon: '🏢',
        badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
        barColor: '#7C3AED',
    },
    {
        key: 'tax_fee',
        label: '세무 / 수수료 / 대행',
        icon: '📑',
        badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
        barColor: '#4F46E5',
    },
    {
        key: 'other',
        label: '기타 운영비',
        icon: '📦',
        badgeClass: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300',
        barColor: '#64748B',
    },
];

export const PAYMENT_METHODS: { key: ExpensePaymentMethod; label: string }[] = [
    { key: 'card', label: '💳 사업자카드' },
    { key: 'tax_invoice', label: '🧾 세금계산서(이체)' },
    { key: 'cash_receipt', label: '💵 현금영수증' },
    { key: 'other', label: '📝 기타(미증빙)' },
];

const PROPERTY_OPTIONS: { key: string; label: string; badgeClass: string }[] = [
    { key: 'all', label: '공통 (전체 건물 안분)', badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
    { key: 'WAVE', label: '웨이브 (WAVE)', badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300' },
    { key: 'YEONNAM', label: '연남 (YEONNAM)', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
    { key: 'Green', label: '그린 (Green)', badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
    { key: 'Horang', label: '호랑 (Horang)', badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' },
];

function getMonthRange(offsetMonths: number): { start: string; end: string } {
    const todayStr = getKSTTodayStr();
    const [y, m] = todayStr.split('-').map(Number);
    const first = new Date(y, m - 1 + offsetMonths, 1);
    const last = new Date(y, m + offsetMonths, 0);
    return {
        start: formatLocalDate(first),
        end: formatLocalDate(last),
    };
}

function getPreviousMonthKey(dateStr: string): string {
    const [y, m] = dateStr.slice(0, 7).split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    return formatLocalDate(prev).slice(0, 7);
}

export default function ExpensesPage() {
    const router = useRouter();
    const { isAdmin, loading: authLoading } = useAuth();
    const todayStr = useMemo(() => getKSTTodayStr(), []);
    const initialRange = useMemo(() => getMonthRange(0), []);

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
    const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('this_month');
    const [startDate, setStartDate] = useState<string>(initialRange.start);
    const [endDate, setEndDate] = useState<string>(initialRange.end);

    const [expenses, setExpenses] = useState<OperatingExpenseItem[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    // 폼 상태
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expenseDate, setExpenseDate] = useState<string>(todayStr);
    const [propertyName, setPropertyName] = useState<string>('all');
    const [unitKey, setUnitKey] = useState<string>('');
    const [category, setCategory] = useState<ExpenseCategory>('cleaning');
    const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('card');
    const [amountInput, setAmountInput] = useState<string>('');
    const [isRecurring, setIsRecurring] = useState<boolean>(false);
    const [description, setDescription] = useState<string>('');

    // 리스트 필터 상태
    const [filterProperty, setFilterProperty] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterPayment, setFilterPayment] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const adCosts = useOtaAdCosts(startDate, endDate);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.replace('/');
        }
    }, [authLoading, isAdmin, router]);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [expRes, bookRes] = await Promise.all([
                fetch(`/api/expenses?startDate=${startDate}&endDate=${endDate}`, { cache: 'no-store' }),
                fetch('/api/reservations?scope=analytics', { cache: 'no-store' }),
            ]);
            const [expData, bookData] = await Promise.all([
                expRes.json(),
                bookRes.json().catch(() => ({ success: false })),
            ]);

            if (expData.success && Array.isArray(expData.data)) {
                setExpenses(expData.data);
            } else {
                setError(expData.error || '비용 내역을 불러오지 못했습니다.');
            }

            if (bookData.success && Array.isArray(bookData.data)) {
                setBookings(bookData.data);
            }
        } catch (err) {
            console.error('비용 페이지 데이터 조회 실패:', err);
            setError('데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        if (!authLoading && isAdmin) {
            const timer = setTimeout(() => {
                void fetchAllData();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [authLoading, isAdmin, fetchAllData]);

    const handleSelectQuickPeriod = (period: QuickPeriod) => {
        setQuickPeriod(period);
        if (period === 'this_month') {
            const r = getMonthRange(0);
            setStartDate(r.start);
            setEndDate(r.end);
        } else if (period === 'last_month') {
            const r = getMonthRange(-1);
            setStartDate(r.start);
            setEndDate(r.end);
        } else {
            const y = todayStr.slice(0, 4);
            setStartDate(`${y}-01-01`);
            setEndDate(`${y}-12-31`);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setExpenseDate(todayStr);
        setPropertyName('all');
        setUnitKey('');
        setCategory('cleaning');
        setPaymentMethod('card');
        setAmountInput('');
        setIsRecurring(false);
        setDescription('');
    };

    const handleStartEdit = (item: OperatingExpenseItem) => {
        setEditingId(item.id);
        setExpenseDate(item.expenseDate);
        setPropertyName(item.propertyName);
        setUnitKey(item.unitKey || '');
        setCategory(item.category);
        setPaymentMethod(item.paymentMethod);
        setAmountInput(String(item.amount));
        setIsRecurring(item.isRecurring);
        setDescription(item.description);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsedAmount = Math.round(Number(amountInput.replace(/,/g, '')));
        if (!parsedAmount || parsedAmount <= 0) {
            setError('0원보다 큰 지출 금액을 입력해 주세요.');
            return;
        }

        setSaving(true);
        setError(null);
        setNotice(null);

        try {
            const res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: editingId ? 'update' : 'add',
                    id: editingId || undefined,
                    expenseDate,
                    propertyName,
                    unitKey: propertyName !== 'all' && unitKey ? unitKey : null,
                    category,
                    amount: parsedAmount,
                    paymentMethod,
                    isRecurring,
                    description,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || '비용 저장에 실패했습니다.');
            } else {
                setNotice(editingId ? '비용 내역이 수정되었습니다.' : '새 비용 내역이 등록되었습니다.');
                resetForm();
                await fetchAllData();
            }
        } catch {
            setError('네트워크 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('이 비용 내역을 삭제하시겠습니까?')) return;
        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || '삭제에 실패했습니다.');
            } else {
                if (editingId === id) resetForm();
                setNotice('비용 내역이 삭제되었습니다.');
                await fetchAllData();
            }
        } catch {
            setError('삭제 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleCopyPrevMonthRecurring = async () => {
        const targetMonth = startDate.slice(0, 7);
        const sourceMonth = getPreviousMonthKey(startDate);
        if (!confirm(`${sourceMonth}에 등록된 [매월 고정비] 항목들을 ${targetMonth}로 일괄 복사할까요?`)) return;

        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            const res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'copy-recurring',
                    sourceMonth,
                    targetMonth,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || '고정비 복사에 실패했습니다.');
            } else {
                setNotice(data.message || '고정비 복사가 완료되었습니다.');
                await fetchAllData();
            }
        } catch {
            setError('고정비 복사 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    // 매출·광고비·비용·순이익 계산
    const revenueBookings = useMemo(() => bookings.filter((b) => isRevenueBooking(b)), [bookings]);

    const overallSummary = useMemo(
        () => calculateOverallSummary(revenueBookings, 'custom', startDate, endDate, 'stay', 'all', 'all'),
        [revenueBookings, startDate, endDate]
    );

    const adSpendBreakdown = useMemo(
        () => calculateAdSpendBreakdown(adCosts.charges, startDate, endDate),
        [adCosts.charges, startDate, endDate]
    );

    const netRevenueAfterAd = useMemo(
        () => calculateRevenueAfterAdSpend(overallSummary.totalRevenue, adSpendBreakdown.settlementDeductedSpend),
        [overallSummary.totalRevenue, adSpendBreakdown.settlementDeductedSpend]
    );

    const propertyStats = useMemo(
        () => calculatePropertyStats(revenueBookings, 'custom', startDate, endDate, 'stay'),
        [revenueBookings, startDate, endDate]
    );

    const expenseSummary = useMemo(() => {
        let totalExpense = 0;
        let recurringExpense = 0;
        let commonExpense = 0;
        const byProperty: Record<string, number> = { WAVE: 0, YEONNAM: 0, Green: 0, Horang: 0 };
        const byCategory: Record<ExpenseCategory, number> = {
            cleaning: 0,
            supplies: 0,
            utilities: 0,
            repair: 0,
            rent: 0,
            tax_fee: 0,
            other: 0,
        };

        for (const item of expenses) {
            const amt = Number(item.amount) || 0;
            totalExpense += amt;
            if (item.isRecurring) recurringExpense += amt;
            if (item.propertyName === 'all') {
                commonExpense += amt;
            } else if (byProperty[item.propertyName] !== undefined) {
                byProperty[item.propertyName] += amt;
            }
            if (byCategory[item.category] !== undefined) {
                byCategory[item.category] += amt;
            } else {
                byCategory.other += amt;
            }
        }

        const operatingProfit = netRevenueAfterAd - totalExpense;
        const profitMarginPct = netRevenueAfterAd > 0
            ? Math.round((operatingProfit / netRevenueAfterAd) * 1000) / 10
            : 0;

        return {
            totalExpense,
            recurringExpense,
            variableExpense: totalExpense - recurringExpense,
            commonExpense,
            byProperty,
            byCategory,
            operatingProfit,
            profitMarginPct,
        };
    }, [expenses, netRevenueAfterAd]);

    const filteredExpenses = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return expenses.filter((item) => {
            if (filterProperty !== 'all' && item.propertyName !== filterProperty) return false;
            if (filterCategory !== 'all' && item.category !== filterCategory) return false;
            if (filterPayment !== 'all' && item.paymentMethod !== filterPayment) return false;
            if (q) {
                const desc = (item.description || '').toLowerCase();
                const unit = (item.unitKey || '').toLowerCase();
                if (!desc.includes(q) && !unit.includes(q)) return false;
            }
            return true;
        });
    }, [expenses, filterProperty, filterCategory, filterPayment, searchQuery]);

    const availableUnitsForProp = useMemo(() => {
        if (propertyName === 'all') return [];
        return ALL_UNITS.filter((u) => u.propName === propertyName);
    }, [propertyName]);

    if (!authLoading && !isAdmin) return null;

    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-slate-950 transition-colors duration-200">
            <AppSidebar
                isMobileOpen={isMobileSidebarOpen}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col min-w-0">
                {/* 1. 상단 헤더 */}
                <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-3 py-2.5 md:px-5 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-base font-bold border border-gray-200 dark:border-slate-700 cursor-pointer"
                        >
                            ☰
                        </button>
                        <div>
                            <h1 className="text-sm md:text-base font-extrabold text-gray-900 dark:text-slate-100">
                                💸 운영 비용 처리 및 순이익 관리
                            </h1>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium hidden sm:inline">
                                건물별·카테고리별 지출 기입 및 비용 차감 후 실제 영업이익 분석
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={saving || loading}
                            onClick={handleCopyPrevMonthRecurring}
                            className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition cursor-pointer disabled:opacity-50"
                        >
                            ⚡ 전월 고정비 불러오기
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={fetchAllData}
                            className="px-2.5 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-gray-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
                        >
                            ↻ 새로고침
                        </button>
                    </div>
                </header>

                {loading && (
                    <div className="w-full h-1 bg-blue-100 dark:bg-slate-800 overflow-hidden shrink-0">
                        <div className="h-full w-1/2 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 animate-pulse rounded-r-full" />
                    </div>
                )}

                <main className="p-3 md:p-5 flex-1 flex flex-col gap-4 max-w-[1600px] w-full mx-auto">
                    {error && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold">
                            🚨 {error}
                        </div>
                    )}
                    {notice && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold">
                            ✅ {notice}
                        </div>
                    )}

                    {/* 2. 기간 선택 바 */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {(
                                [
                                    { key: 'this_month', label: '이번 달' },
                                    { key: 'last_month', label: '지난 달' },
                                    { key: 'this_year', label: '올해 전체' },
                                ] as { key: QuickPeriod; label: string }[]
                            ).map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => handleSelectQuickPeriod(item.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer border ${
                                        quickPeriod === item.key
                                            ? 'bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900 border-gray-900 dark:border-slate-100'
                                            : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-slate-300">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 font-mono text-xs"
                            />
                            <span>~</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 font-mono text-xs"
                            />
                        </div>
                    </div>

                    {/* 3. 상단 4대 손익 KPI 카드 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                                    정산 매출 (광고비 차감 후)
                                </span>
                                <span>💰</span>
                            </div>
                            <div className="text-xl md:text-2xl font-black text-gray-900 dark:text-slate-100 font-mono">
                                {netRevenueAfterAd.toLocaleString()}원
                            </div>
                            <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 font-mono">
                                광고 차감 전: {overallSummary.totalRevenue.toLocaleString()}원
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 p-4 shadow-xs flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                    총 운영 비용 ({expenses.length}건)
                                </span>
                                <span>💸</span>
                            </div>
                            <div className="text-xl md:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                                -{expenseSummary.totalExpense.toLocaleString()}원
                            </div>
                            <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 font-mono">
                                고정비 {expenseSummary.recurringExpense.toLocaleString()}원 · 변동비 {expenseSummary.variableExpense.toLocaleString()}원
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 p-4 shadow-xs flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                    최종 순이익 (영업이익)
                                </span>
                                <span>📈</span>
                            </div>
                            <div
                                className={`text-xl md:text-2xl font-black font-mono ${
                                    expenseSummary.operatingProfit >= 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                }`}
                            >
                                {expenseSummary.operatingProfit.toLocaleString()}원
                            </div>
                            <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                                매출 - 광고비 - 운영비용 실제 잔액
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                                    순이익률 (Margin)
                                </span>
                                <span>🎯</span>
                            </div>
                            <div className="text-xl md:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                {expenseSummary.profitMarginPct}%
                            </div>
                            <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 font-mono">
                                공통 지출: {expenseSummary.commonExpense.toLocaleString()}원
                            </div>
                        </div>
                    </div>

                    {/* 4. 건물별 매출 · 비용 · 순이익 비교 */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span>🏢</span>
                                <h3 className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                                    건물별 매출 · 비용 · 순이익 현황
                                </h3>
                            </div>
                            <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                                공통 지출({expenseSummary.commonExpense.toLocaleString()}원)은 객실 수 비율로 안분 반영
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {propertyStats.map((prop) => {
                                const propOpt = PROPERTY_OPTIONS.find((p) => p.key === prop.propName) || PROPERTY_OPTIONS[0];
                                const directCost = expenseSummary.byProperty[prop.propName] || 0;
                                const allocatedCommon = Math.round(
                                    (expenseSummary.commonExpense * prop.roomCount) / Math.max(1, ALL_UNITS.length)
                                );
                                const totalPropCost = directCost + allocatedCommon;
                                const propProfit = prop.totalRevenue - totalPropCost;
                                const propMargin = prop.totalRevenue > 0
                                    ? Math.round((propProfit / prop.totalRevenue) * 1000) / 10
                                    : 0;

                                return (
                                    <div
                                        key={prop.propName}
                                        className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 flex flex-col gap-1.5"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${propOpt.badgeClass}`}>
                                                {propOpt.label}
                                            </span>
                                            <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 font-mono">
                                                이익률 {propMargin}%
                                            </span>
                                        </div>
                                        <div className="flex items-baseline justify-between font-mono">
                                            <span className="text-xs text-gray-500 dark:text-slate-400">순이익</span>
                                            <span
                                                className={`text-base font-black ${
                                                    propProfit >= 0
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-rose-600 dark:text-rose-400'
                                                }`}
                                            >
                                                {propProfit.toLocaleString()}원
                                            </span>
                                        </div>
                                        <div className="pt-1 border-t border-gray-200/70 dark:border-slate-700/70 flex flex-col gap-0.5 text-[11px] font-mono text-gray-600 dark:text-slate-400">
                                            <div className="flex justify-between">
                                                <span>매출</span>
                                                <span className="font-bold text-gray-900 dark:text-slate-200">
                                                    {prop.totalRevenue.toLocaleString()}원
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>직접비용 (+공통안분)</span>
                                                <span className="font-bold text-rose-600 dark:text-rose-400">
                                                    -{directCost.toLocaleString()}원 (+{allocatedCommon.toLocaleString()})
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 5. 메인 2열: 좌측 비용 기입 폼 & 카테고리 비중 / 우측 지출 내역 리스트 */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* 좌측 5칸: 비용 기입 폼 + 카테고리별 비중 */}
                        <div className="lg:col-span-5 flex flex-col gap-4">
                            <form
                                onSubmit={handleSubmit}
                                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3.5"
                            >
                                <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-slate-800">
                                    <h3 className="text-sm md:text-base font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                                        <span>{editingId ? '✏️' : '➕'}</span>
                                        <span>{editingId ? '비용 내역 수정' : '새 비용 기입'}</span>
                                    </h3>
                                    {editingId && (
                                        <button
                                            type="button"
                                            onClick={resetForm}
                                            className="text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-slate-200 cursor-pointer"
                                        >
                                            수정 취소
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                            지출 일자
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={expenseDate}
                                            onChange={(e) => setExpenseDate(e.target.value)}
                                            className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold font-mono text-gray-900 dark:text-slate-100"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                            귀속 건물
                                        </label>
                                        <select
                                            value={propertyName}
                                            onChange={(e) => {
                                                setPropertyName(e.target.value);
                                                setUnitKey('');
                                            }}
                                            className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-900 dark:text-slate-100"
                                        >
                                            {PROPERTY_OPTIONS.map((p) => (
                                                <option key={p.key} value={p.key}>
                                                    {p.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {propertyName !== 'all' && availableUnitsForProp.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                            세부 호실 (선택사항)
                                        </label>
                                        <select
                                            value={unitKey}
                                            onChange={(e) => setUnitKey(e.target.value)}
                                            className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-900 dark:text-slate-100"
                                        >
                                            <option value="">건물 전체 공통 ({propertyName})</option>
                                            {availableUnitsForProp.map((u) => (
                                                <option key={u.key} value={`${u.propName} ${u.displayName}`}>
                                                    {u.displayName} {u.subName ? `(${u.subName})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                            비용 카테고리
                                        </label>
                                        <select
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                                            className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-900 dark:text-slate-100"
                                        >
                                            {EXPENSE_CATEGORIES.map((c) => (
                                                <option key={c.key} value={c.key}>
                                                    {c.icon} {c.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                            결제 / 증빙 구분
                                        </label>
                                        <select
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
                                            className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-900 dark:text-slate-100"
                                        >
                                            {PAYMENT_METHODS.map((m) => (
                                                <option key={m.key} value={m.key}>
                                                    {m.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                            지출 금액 (원)
                                        </label>
                                        <div className="flex items-center gap-1">
                                            {[10000, 50000, 100000, 500000].map((addAmt) => (
                                                <button
                                                    key={addAmt}
                                                    type="button"
                                                    onClick={() =>
                                                        setAmountInput(
                                                            String((Number(amountInput) || 0) + addAmt)
                                                        )
                                                    }
                                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 cursor-pointer"
                                                >
                                                    +{addAmt >= 10000 ? `${addAmt / 10000}만` : addAmt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <input
                                        type="number"
                                        min={1}
                                        step={100}
                                        required
                                        placeholder="예: 45000"
                                        value={amountInput}
                                        onChange={(e) => setAmountInput(e.target.value)}
                                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm font-black font-mono text-gray-900 dark:text-slate-100"
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                        상세 내역 / 거래처 메모
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={300}
                                        placeholder="예: 웨이브 생수·화장지 대량 구매 (쿠팡)"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-900 dark:text-slate-100"
                                    />
                                </div>

                                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={isRecurring}
                                        onChange={(e) => setIsRecurring(e.target.checked)}
                                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200">
                                            🔁 매월 반복되는 고정비 항목으로 지정
                                        </span>
                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                                            월세·인터넷·정기관리비 등은 다음 달에 [전월 고정비 불러오기]로 자동 복사됩니다.
                                        </span>
                                    </div>
                                </label>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-sm transition cursor-pointer disabled:opacity-50"
                                >
                                    {saving ? '저장 중...' : editingId ? '💾 수정 내용 저장' : '➕ 비용 내역 등록'}
                                </button>
                            </form>

                            {/* 카테고리별 지출 비중 */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3">
                                <h3 className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                                    📊 카테고리별 비용 비중
                                </h3>
                                <div className="flex flex-col gap-2">
                                    {EXPENSE_CATEGORIES.map((cat) => {
                                        const amt = expenseSummary.byCategory[cat.key] || 0;
                                        const pct = expenseSummary.totalExpense > 0
                                            ? Math.round((amt / expenseSummary.totalExpense) * 1000) / 10
                                            : 0;
                                        return (
                                            <div key={cat.key} className="flex flex-col gap-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-bold text-gray-700 dark:text-slate-200">
                                                        {cat.icon} {cat.label}
                                                    </span>
                                                    <span className="font-mono font-extrabold text-gray-900 dark:text-slate-100">
                                                        {amt.toLocaleString()}원 ({pct}%)
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-300"
                                                        style={{ width: `${pct}%`, backgroundColor: cat.barColor }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 우측 7칸: 지출 내역 리스트 */}
                        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-100 dark:border-slate-800">
                                <div>
                                    <h3 className="text-sm md:text-base font-extrabold text-gray-900 dark:text-slate-100">
                                        📋 지출 내역 목록 ({filteredExpenses.length}건)
                                    </h3>
                                    <span className="text-[11px] text-gray-500 dark:text-slate-400">
                                        필터 조건 합계:{' '}
                                        <strong className="text-rose-600 dark:text-rose-400 font-mono">
                                            {filteredExpenses.reduce((acc, i) => acc + i.amount, 0).toLocaleString()}원
                                        </strong>
                                    </span>
                                </div>

                                <input
                                    type="text"
                                    placeholder="내역/호실 검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-800 dark:text-slate-100 w-44"
                                />
                            </div>

                            {/* 필터 바 */}
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={filterProperty}
                                    onChange={(e) => setFilterProperty(e.target.value)}
                                    className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-700 dark:text-slate-200"
                                >
                                    <option value="all">전체 건물</option>
                                    {PROPERTY_OPTIONS.map((p) => (
                                        <option key={p.key} value={p.key}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-700 dark:text-slate-200"
                                >
                                    <option value="all">전체 카테고리</option>
                                    {EXPENSE_CATEGORIES.map((c) => (
                                        <option key={c.key} value={c.key}>
                                            {c.icon} {c.label}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={filterPayment}
                                    onChange={(e) => setFilterPayment(e.target.value)}
                                    className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-700 dark:text-slate-200"
                                >
                                    <option value="all">전체 결제/증빙</option>
                                    {PAYMENT_METHODS.map((m) => (
                                        <option key={m.key} value={m.key}>
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 내역 리스트 */}
                            <div className="flex flex-col gap-2 max-h-[640px] overflow-y-auto pr-0.5">
                                {filteredExpenses.length === 0 ? (
                                    <div className="py-16 text-center text-xs font-bold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                                        선택한 기간/조건에 등록된 비용 내역이 없습니다.
                                    </div>
                                ) : (
                                    filteredExpenses.map((item) => {
                                        const catInfo =
                                            EXPENSE_CATEGORIES.find((c) => c.key === item.category) ||
                                            EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
                                        const propInfo =
                                            PROPERTY_OPTIONS.find((p) => p.key === item.propertyName) ||
                                            PROPERTY_OPTIONS[0];
                                        const payInfo =
                                            PAYMENT_METHODS.find((m) => m.key === item.paymentMethod) ||
                                            PAYMENT_METHODS[0];

                                        return (
                                            <div
                                                key={item.id}
                                                className="p-3 rounded-xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2.5"
                                            >
                                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="text-xs font-mono font-extrabold text-gray-700 dark:text-slate-200">
                                                            {item.expenseDate}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${propInfo.badgeClass}`}>
                                                            {item.unitKey ? item.unitKey : propInfo.label.split(' ')[0]}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${catInfo.badgeClass}`}>
                                                            {catInfo.icon} {catInfo.label}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                                                            {payInfo.label}
                                                        </span>
                                                        {item.isRecurring && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
                                                                🔁 고정비
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-bold text-gray-900 dark:text-slate-100 truncate">
                                                        {item.description || `${catInfo.label} 지출`}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono">
                                                        -{item.amount.toLocaleString()}원
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartEdit(item)}
                                                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 cursor-pointer"
                                                    >
                                                        수정
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(item.id)}
                                                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/70 cursor-pointer"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
