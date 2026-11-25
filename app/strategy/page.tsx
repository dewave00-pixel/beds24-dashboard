'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import '../dashboard.css';
import { Booking } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useOtaAdCosts } from '../hooks/useOtaAdCosts';
import { getKSTTodayStr } from '../utils/dateUtils';
import {
    analyze28DayWindowAndOneNight,
    evaluateStrategyEvent,
    generateStrategyRecommendations,
    StrategyRecommendation,
} from '../utils/strategyAnalytics';
import AppSidebar from '../components/layout/AppSidebar';
import type { StrategyEventItem, StrategySourceType } from '../api/strategy/route';
import type { OperatingExpenseItem } from '../api/expenses/route';

interface SnapshotSummaryRow {
    snapshot_date: string;
    target_date: string;
    lead_days: number;
    property_id: number;
    room_id: number;
    price: number;
    min_stay: number;
    num_avail: number;
    override_type: string;
}

const SOURCE_OPTIONS: { key: StrategySourceType; label: string; badgeClass: string }[] = [
    { key: 'pricelabs', label: '⚡ PriceLabs 룰', badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
    { key: 'beds24', label: '🏨 Beds24 설정', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
    { key: 'ota_promo', label: '🏷️ OTA 프로모션', badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
    { key: 'ota_ads', label: '🎯 OTA 광고 설정', badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
    { key: 'operation', label: '⚙️ 운영 정책', badgeClass: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300' },
];

const PROPERTY_OPTIONS = [
    { key: 'all', label: '전체 건물' },
    { key: 'WAVE', label: '웨이브 (WAVE)' },
    { key: 'YEONNAM', label: '연남 (YEONNAM)' },
    { key: 'Green', label: '그린 (Green)' },
    { key: 'Horang', label: '호랑 (Horang)' },
];

const CHANNEL_OPTIONS = [
    { id: '', label: '전체 채널' },
    { id: '46', label: 'Airbnb' },
    { id: '19', label: 'Booking.com' },
    { id: '17', label: 'Agoda' },
    { id: '53', label: 'Trip.com' },
];

export default function StrategyPage() {
    const router = useRouter();
    const { isAdmin, loading: authLoading } = useAuth();
    const todayStr = useMemo(() => getKSTTodayStr(), []);

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [events, setEvents] = useState<StrategyEventItem[]>([]);
    const [expenses, setExpenses] = useState<OperatingExpenseItem[]>([]);
    const [snapshotDates, setSnapshotDates] = useState<{ date: string; count: number }[]>([]);
    const [latestSnapshots, setLatestSnapshots] = useState<SnapshotSummaryRow[]>([]);
    const [snapshotTableReady, setSnapshotTableReady] = useState<boolean>(true);

    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [capturingSnapshot, setCapturingSnapshot] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [selectedProperty, setSelectedProperty] = useState<string>('all');

    // 전략 변경 등록 폼 상태
    const [eventDate, setEventDate] = useState<string>(todayStr);
    const [sourceType, setSourceType] = useState<StrategySourceType>('pricelabs');
    const [formProperty, setFormProperty] = useState<string>('all');
    const [channelId, setChannelId] = useState<string>('');
    const [compareDays, setCompareDays] = useState<number>(14);
    const [title, setTitle] = useState<string>('');
    const [ruleDetail, setRuleDetail] = useState<string>('');

    // 광고비 데이터 (전후 순이익 계산용 - 최근 1년)
    const adCosts = useOtaAdCosts('2025-01-01', '2027-12-31');

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.replace('/');
        }
    }, [authLoading, isAdmin, router]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [bookRes, stgRes, expRes, snapRes] = await Promise.all([
                fetch('/api/reservations?scope=analytics', { cache: 'no-store' }),
                fetch('/api/strategy', { cache: 'no-store' }),
                fetch('/api/expenses', { cache: 'no-store' }),
                fetch('/api/strategy/snapshot', { cache: 'no-store' }),
            ]);

            const [bookData, stgData, expData, snapData] = await Promise.all([
                bookRes.json(),
                stgRes.json(),
                expRes.json().catch(() => ({ success: false })),
                snapRes.json().catch(() => ({ success: false })),
            ]);

            if (bookData.success && Array.isArray(bookData.data)) setBookings(bookData.data);
            if (stgData.success && Array.isArray(stgData.data)) setEvents(stgData.data);
            if (expData.success && Array.isArray(expData.data)) setExpenses(expData.data);

            if (snapData.success) {
                setSnapshotTableReady(Boolean(snapData.tableReady));
                setSnapshotDates(Array.isArray(snapData.dates) ? snapData.dates : []);
                setLatestSnapshots(Array.isArray(snapData.latestRows) ? snapData.latestRows : []);
            }
        } catch (err) {
            console.error('전략 분석 데이터 조회 실패:', err);
            setError('데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading && isAdmin) {
            const timer = setTimeout(() => {
                void fetchAll();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [authLoading, isAdmin, fetchAll]);

    const handleCaptureSnapshot = async () => {
        setCapturingSnapshot(true);
        setError(null);
        setNotice(null);
        try {
            const res = await fetch('/api/strategy/snapshot', { method: 'POST' });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || '스냅샷 수집에 실패했습니다.');
            } else {
                setNotice(data.message || '스냅샷 수집 완료');
                await fetchAll();
            }
        } catch {
            setError('스냅샷 수집 중 네트워크 오류가 발생했습니다.');
        } finally {
            setCapturingSnapshot(false);
        }
    };

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError('변경 제목을 입력해 주세요.');
            return;
        }
        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            const res = await fetch('/api/strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventDate,
                    sourceType,
                    propertyName: formProperty,
                    channelId: channelId || null,
                    compareDays,
                    title: title.trim(),
                    ruleDetail: ruleDetail.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || '저장에 실패했습니다.');
            } else {
                setNotice('전략/설정 변경 이력이 기록되었습니다.');
                setTitle('');
                setRuleDetail('');
                await fetchAll();
            }
        } catch {
            setError('저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEvent = async (id: string) => {
        if (!confirm('이 전략 변경 기록을 삭제하시겠습니까?')) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/strategy?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setNotice('기록이 삭제되었습니다.');
                await fetchAll();
            } else {
                setError(data.error || '삭제 실패');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleApplyRecommendation = (rec: StrategyRecommendation) => {
        setEventDate(todayStr);
        setSourceType(rec.suggestedSourceType);
        setFormProperty(rec.propertyName);
        setTitle(rec.suggestedTitle);
        setRuleDetail(`[개선 제안 반영] ${rec.evidence} -> ${rec.actionText}`);
        const el = document.getElementById('strategy-event-form');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const analysis = useMemo(
        () => analyze28DayWindowAndOneNight(bookings, selectedProperty),
        [bookings, selectedProperty]
    );

    const recommendations = useMemo(
        () => generateStrategyRecommendations(analysis, snapshotDates.length),
        [analysis, snapshotDates.length]
    );

    const evaluatedEvents = useMemo(
        () =>
            events.map((ev) => ({
                event: ev,
                perf: evaluateStrategyEvent(ev, bookings, adCosts.charges, expenses),
            })),
        [events, bookings, adCosts.charges, expenses]
    );

    const snapshotInsight = useMemo(() => {
        if (latestSnapshots.length === 0) return null;
        const within28 = latestSnapshots.filter((r) => r.lead_days <= 28);
        const after28 = latestSnapshots.filter((r) => r.lead_days > 28);
        const avgPrice28 = within28.length > 0
            ? Math.round(within28.reduce((a, b) => a + b.price, 0) / within28.length)
            : 0;
        const avgPriceAfter = after28.length > 0
            ? Math.round(after28.reduce((a, b) => a + b.price, 0) / after28.length)
            : 0;
        const minStay1Within28Pct = within28.length > 0
            ? Math.round((within28.filter((r) => r.min_stay === 1).length / within28.length) * 1000) / 10
            : 0;
        const minStay1AfterPct = after28.length > 0
            ? Math.round((after28.filter((r) => r.min_stay === 1).length / after28.length) * 1000) / 10
            : 0;

        return {
            avgPrice28,
            avgPriceAfter,
            minStay1Within28Pct,
            minStay1AfterPct,
        };
    }, [latestSnapshots]);

    if (!authLoading && !isAdmin) return null;

    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-slate-950 transition-colors duration-200">
            <AppSidebar
                isMobileOpen={isMobileSidebarOpen}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col min-w-0">
                {/* 헤더 */}
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
                                🧠 가격·1박룰·광고 전략 및 개선 제안
                            </h1>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium hidden sm:inline">
                                Beds24 90일 판매가·최소박수 스냅샷 · 28일 룰 효율 · 변경 전후 성적표
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={capturingSnapshot}
                            onClick={handleCaptureSnapshot}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                        >
                            {capturingSnapshot ? '수집 중...' : '📸 지금 90일 스냅샷 수집'}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={fetchAll}
                            className="px-2.5 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-gray-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
                        >
                            ↻ 새로고침
                        </button>
                    </div>
                </header>

                {loading && (
                    <div className="w-full h-1 bg-blue-100 dark:bg-slate-800 overflow-hidden shrink-0">
                        <div className="h-full w-1/2 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500 animate-pulse rounded-r-full" />
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
                    {!snapshotTableReady && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold">
                            ℹ️ 일별 가격·최소박수 스냅샷 자동 축적을 위해 Supabase SQL Editor에서{' '}
                            <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/60 rounded">
                                supabase/migrations/202611250001_create_strategy_and_snapshots.sql
                            </code>
                            을 실행해 주세요. *(전략 변경 이력 기록은 테이블 생성 전에도 즉시 동작합니다.)*
                        </div>
                    )}

                    {/* 1. 데이터 기반 자동 개선 제안 */}
                    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">💡</span>
                                <h2 className="text-sm md:text-base font-extrabold text-gray-900 dark:text-slate-100">
                                    현재 데이터 기반 개선 제안 ({recommendations.length}건)
                                </h2>
                            </div>
                            <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                                분석 모수: 유효 예약 {analysis.totalAnalyzed}건 · 스냅샷 {snapshotDates.length}일치
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {recommendations.map((rec) => (
                                <div
                                    key={rec.id}
                                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                                        rec.severity === 'high'
                                            ? 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800/70'
                                            : rec.severity === 'medium'
                                                ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/70'
                                                : 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/70'
                                    }`}
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/80 dark:bg-slate-900/80 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700">
                                                {rec.category} · {rec.propertyName === 'all' ? '전체' : rec.propertyName}
                                            </span>
                                            <span className="text-[10px] font-extrabold">
                                                {rec.severity === 'high' ? '🔴 우선 검토' : rec.severity === 'medium' ? '🟡 개선 여지' : '🟢 안내'}
                                            </span>
                                        </div>
                                        <h3 className="text-xs md:text-sm font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">
                                            {rec.title}
                                        </h3>
                                        <p className="text-[11px] text-gray-600 dark:text-slate-300">{rec.evidence}</p>
                                        <p className="text-[11px] font-bold text-gray-800 dark:text-slate-100 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-black/5 dark:border-white/10">
                                            👉 {rec.actionText}
                                        </p>
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => handleApplyRecommendation(rec)}
                                            className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 cursor-pointer"
                                        >
                                            이 제안 적용 기록하기 ↓
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 2. 28일 기준 Last-minute 가격 & 1박 오픈 분석 */}
                    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-100 dark:border-slate-800">
                            <div>
                                <h2 className="text-sm md:text-base font-extrabold text-gray-900 dark:text-slate-100">
                                    ⏱️ 28일 기준 Last-minute 가격 인하 & 1박 오픈 패턴 분석
                                </h2>
                                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                                    28일 이전(정상·연박) 대비 28일 이내 구간별 ADR 변화와 1박 예약의 주말 연박 단절 여부를 확인합니다.
                                </p>
                            </div>
                            <select
                                value={selectedProperty}
                                onChange={(e) => setSelectedProperty(e.target.value)}
                                className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-800 dark:text-slate-100"
                            >
                                {PROPERTY_OPTIONS.map((p) => (
                                    <option key={p.key} value={p.key}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 리드타임 구간 표 */}
                        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-600 dark:text-slate-300 font-extrabold border-b border-gray-200 dark:border-slate-800">
                                    <tr>
                                        <th className="py-2.5 px-3">리드타임 구간</th>
                                        <th className="py-2.5 px-3 text-right">예약 건수</th>
                                        <th className="py-2.5 px-3 text-right">판매 박수</th>
                                        <th className="py-2.5 px-3 text-right">평균 ADR</th>
                                        <th className="py-2.5 px-3 text-right">평균 투숙</th>
                                        <th className="py-2.5 px-3 text-right">1박 비중</th>
                                        <th className="py-2.5 px-3 text-right">금/토 1박 단절</th>
                                        <th className="py-2.5 px-3 text-right">정산 매출</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                                    {analysis.buckets.map((b) => (
                                        <tr key={b.key} className="hover:bg-gray-50/70 dark:hover:bg-slate-800/40">
                                            <td className="py-2.5 px-3 font-sans">
                                                <div className="font-extrabold text-gray-900 dark:text-slate-100">{b.label}</div>
                                                <div className="text-[10px] text-gray-500 dark:text-slate-400">{b.desc}</div>
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-bold">{b.bookingsCount}건</td>
                                            <td className="py-2.5 px-3 text-right font-bold">{b.totalNights}박</td>
                                            <td className="py-2.5 px-3 text-right font-black text-blue-700 dark:text-blue-400">
                                                ₩{b.avgAdr.toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">{b.avgStayNights}박</td>
                                            <td className="py-2.5 px-3 text-right font-bold">
                                                {b.oneNightSharePct}% ({b.oneNightCount}건)
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                                                {b.weekendOneNightCount}건
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700 dark:text-emerald-400">
                                                ₩{b.totalRevenue.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 건물별 28일 비교 카드 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {analysis.propertySummaries.map((p) => (
                                <div
                                    key={p.propName}
                                    className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 flex flex-col gap-1 text-xs font-mono"
                                >
                                    <div className="flex items-center justify-between font-sans">
                                        <span className="font-extrabold text-gray-900 dark:text-slate-100">{p.propName}</span>
                                        <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                                p.adrDropPct <= -15
                                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                            }`}
                                        >
                                            28일 ADR {p.adrDropPct > 0 ? `+${p.adrDropPct}%` : `${p.adrDropPct}%`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-gray-600 dark:text-slate-400">
                                        <span>D-29+ ADR</span>
                                        <span className="font-bold text-gray-900 dark:text-slate-200">
                                            ₩{p.d29PlusAdr.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-gray-600 dark:text-slate-400">
                                        <span>D-28 이내 ADR</span>
                                        <span className="font-bold text-gray-900 dark:text-slate-200">
                                            ₩{p.d28InsideAdr.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-gray-600 dark:text-slate-400 pt-1 border-t border-gray-200/70 dark:border-slate-700/70">
                                        <span>28일 내 1박 비율</span>
                                        <span className="font-bold">
                                            {p.d28OneNightSharePct}% (주말단절 {p.weekendSplitCount}건)
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 3. 설정·광고 변경 이력 & Before/After 성적표 */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* 좌측 4칸: 등록 폼 */}
                        <form
                            id="strategy-event-form"
                            onSubmit={handleCreateEvent}
                            className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3 h-fit"
                        >
                            <h3 className="text-sm font-extrabold text-gray-900 dark:text-slate-100 pb-2 border-b border-gray-100 dark:border-slate-800">
                                📝 설정 · 프로모션 · 광고 변경 기록
                            </h3>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                        적용 시작일
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={eventDate}
                                        onChange={(e) => setEventDate(e.target.value)}
                                        className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold font-mono"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                        전후 비교 기간
                                    </label>
                                    <select
                                        value={compareDays}
                                        onChange={(e) => setCompareDays(Number(e.target.value))}
                                        className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold"
                                    >
                                        <option value={7}>전후 7일 비교</option>
                                        <option value={14}>전후 14일 비교</option>
                                        <option value={28}>전후 28일 비교</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                        변경 구분
                                    </label>
                                    <select
                                        value={sourceType}
                                        onChange={(e) => setSourceType(e.target.value as StrategySourceType)}
                                        className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold"
                                    >
                                        {SOURCE_OPTIONS.map((s) => (
                                            <option key={s.key} value={s.key}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                        대상 건물
                                    </label>
                                    <select
                                        value={formProperty}
                                        onChange={(e) => setFormProperty(e.target.value)}
                                        className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold"
                                    >
                                        {PROPERTY_OPTIONS.map((p) => (
                                            <option key={p.key} value={p.key}>
                                                {p.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                    대상 OTA 채널
                                </label>
                                <select
                                    value={channelId}
                                    onChange={(e) => setChannelId(e.target.value)}
                                    className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold"
                                >
                                    {CHANNEL_OPTIONS.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                    변경 제목
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={150}
                                    placeholder="예: PriceLabs 28일 1박 오픈 -> 14일로 축소"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-extrabold text-gray-700 dark:text-slate-300">
                                    세부 규칙 / 메모
                                </label>
                                <textarea
                                    rows={3}
                                    maxLength={1000}
                                    placeholder="변경 전/후 설정 수치, 이유, 목표를 기록해 두면 성적표와 함께 추적됩니다."
                                    value={ruleDetail}
                                    onChange={(e) => setRuleDetail(e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs cursor-pointer disabled:opacity-50"
                            >
                                {saving ? '저장 중...' : '➕ 변경 이력 저장 및 성과 추적 시작'}
                            </button>
                        </form>

                        {/* 우측 8칸: Before/After 성적표 타임라인 */}
                        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                                <h3 className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                                    📊 설정·광고 변경 Before / After 성적표 ({evaluatedEvents.length}건)
                                </h3>
                                <span className="text-[11px] text-gray-500 dark:text-slate-400">
                                    유입(박/일) · ADR · 순이익 자동 비교
                                </span>
                            </div>

                            {evaluatedEvents.length === 0 ? (
                                <div className="py-14 text-center text-xs font-bold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                                    아직 기록된 설정/광고 변경 이력이 없습니다. 좌측 폼이나 위 개선 제안의 버튼을 눌러 첫 이력을 남겨보세요.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2.5 max-h-[540px] overflow-y-auto pr-0.5">
                                    {evaluatedEvents.map(({ event, perf }) => {
                                        const src =
                                            SOURCE_OPTIONS.find((s) => s.key === event.sourceType) || SOURCE_OPTIONS[0];
                                        return (
                                            <div
                                                key={event.id}
                                                className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/80 flex flex-col gap-2"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="text-xs font-mono font-extrabold text-gray-700 dark:text-slate-200">
                                                            {event.eventDate}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${src.badgeClass}`}>
                                                            {src.label}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700">
                                                            {event.propertyName === 'all' ? '전체' : event.propertyName}
                                                        </span>
                                                        <span className="text-xs font-extrabold text-gray-900 dark:text-slate-100">
                                                            {event.title}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                                perf.verdict === 'good'
                                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                                                    : perf.verdict === 'bad'
                                                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                                                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                                            }`}
                                                        >
                                                            {perf.verdictLabel}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteEvent(event.id)}
                                                            className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                                                        >
                                                            삭제
                                                        </button>
                                                    </div>
                                                </div>

                                                {event.ruleDetail && (
                                                    <p className="text-[11px] text-gray-600 dark:text-slate-300">
                                                        {event.ruleDetail}
                                                    </p>
                                                )}

                                                {perf.verdict !== 'pending' && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-200/70 dark:border-slate-700/70 text-[11px] font-mono">
                                                        <div>
                                                            <span className="text-gray-400 block">유입 속도 (박/일)</span>
                                                            <span className="font-bold">
                                                                {perf.beforePickupPerDay} →{' '}
                                                                <strong className="text-blue-600 dark:text-blue-400">
                                                                    {perf.afterPickupPerDay}
                                                                </strong>{' '}
                                                                ({perf.pickupDiffPct > 0 ? `+${perf.pickupDiffPct}%` : `${perf.pickupDiffPct}%`})
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 block">ADR 변화</span>
                                                            <span className="font-bold">
                                                                ₩{perf.beforeAdr.toLocaleString()} →{' '}
                                                                <strong>₩{perf.afterAdr.toLocaleString()}</strong> (
                                                                {perf.adrDiffPct > 0 ? `+${perf.adrDiffPct}%` : `${perf.adrDiffPct}%`})
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 block">일평균 매출</span>
                                                            <span className="font-bold">
                                                                ₩{perf.beforeRevPerDay.toLocaleString()} →{' '}
                                                                <strong>₩{perf.afterRevPerDay.toLocaleString()}</strong>
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 block">일평균 순이익</span>
                                                            <span className="font-bold">
                                                                ₩{perf.beforeProfitPerDay.toLocaleString()} →{' '}
                                                                <strong
                                                                    className={
                                                                        perf.afterProfitPerDay >= perf.beforeProfitPerDay
                                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                                            : 'text-rose-600 dark:text-rose-400'
                                                                    }
                                                                >
                                                                    ₩{perf.afterProfitPerDay.toLocaleString()}
                                                                </strong>
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 4. Beds24 스냅샷 현황 요약 */}
                    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 md:p-5 shadow-xs flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                                📸 Beds24 일별 가격 · 최소박수(minStay) 스냅샷 적재 현황
                            </h3>
                            <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 font-mono">
                                누적 {snapshotDates.length}일치 (매일 새벽 자동 수집)
                            </span>
                        </div>

                        {snapshotInsight ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
                                    <span className="text-[11px] text-gray-500 font-sans block">D-28 이내 평균 판매가</span>
                                    <strong className="text-base text-blue-600 dark:text-blue-400">
                                        ₩{snapshotInsight.avgPrice28.toLocaleString()}
                                    </strong>
                                </div>
                                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
                                    <span className="text-[11px] text-gray-500 font-sans block">D-29 이후 평균 판매가</span>
                                    <strong className="text-base text-gray-900 dark:text-slate-100">
                                        ₩{snapshotInsight.avgPriceAfter.toLocaleString()}
                                    </strong>
                                </div>
                                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
                                    <span className="text-[11px] text-gray-500 font-sans block">D-28 이내 1박 오픈 비율</span>
                                    <strong className="text-base text-emerald-600 dark:text-emerald-400">
                                        {snapshotInsight.minStay1Within28Pct}%
                                    </strong>
                                </div>
                                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
                                    <span className="text-[11px] text-gray-500 font-sans block">D-29 이후 1박 오픈 비율</span>
                                    <strong className="text-base text-purple-600 dark:text-purple-400">
                                        {snapshotInsight.minStay1AfterPct}%
                                    </strong>
                                </div>
                            </div>
                        ) : (
                            <div className="py-6 text-center text-xs font-bold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                                아직 저장된 스냅샷이 없습니다. 상단 [📸 지금 90일 스냅샷 수집] 버튼을 눌러 첫 스냅샷을 저장해 보세요.
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </div>
    );
}
