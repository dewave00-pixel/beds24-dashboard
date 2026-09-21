'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../dashboard.css';
import { useAuth } from '../hooks/useAuth';
import AppSidebar from '../components/layout/AppSidebar';

interface TodayArrivalItem {
    bookingId: number;
    guestName: string;
    propertyName: string;
    unitName: string;
    subName?: string;
    badgeStyle?: { bg: string; text: string };
    channel: string;
    phone: string;
    status: 'PASSWORD_VIEWED' | 'RULES_AGREED' | 'LOOKED_UP' | 'UNCHECKED';
    lastEventAt: string | null;
    numGuests: number;
}

interface CheckinLogItem {
    id: string;
    created_at: string;
    event_type: string;
    booking_id: number | null;
    property_name: string | null;
    unit_key: string | null;
    input_guest_name: string | null;
    input_checkin: string | null;
    input_checkout: string | null;
    failure_reason: string | null;
    status_code: string;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, any>;
}

export default function CheckinManagementPage() {
    const { isAdmin, loading: authLoading } = useAuth();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // 데이터 상태
    const [todayDate, setTodayDate] = useState<string>('');
    const [todayArrivals, setTodayArrivals] = useState<TodayArrivalItem[]>([]);
    const [logs, setLogs] = useState<CheckinLogItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // 필터 및 탭 상태
    const [activeTab, setActiveTab] = useState<'today' | 'logs'>('today');
    const [propertyFilter, setPropertyFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL'); // 오늘 현황 필터
    const [eventFilter, setEventFilter] = useState<string>('ALL'); // 전체 로그 필터
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [autoRefreshSec, setAutoRefreshSec] = useState<number>(15); // 15s 기본

    // 상세 모달 및 피드백 상태
    const [selectedLog, setSelectedLog] = useState<CheckinLogItem | null>(null);
    const [copiedText, setCopiedText] = useState<string | null>(null);

    // 1. API 데이터 페칭
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (propertyFilter !== 'ALL') params.set('property', propertyFilter);
            if (activeTab === 'logs' && eventFilter !== 'ALL') params.set('eventType', eventFilter);
            if (searchQuery.trim()) params.set('search', searchQuery.trim());

            const res = await fetch(`/api/checkin/logs?${params.toString()}`, { cache: 'no-store' });
            const json = await res.json();

            if (json.success) {
                setTodayDate(json.todayDate || '');
                setTodayArrivals(json.todayArrivalsList || []);
                setLogs(json.logs || []);
            }
        } catch (e) {
            console.error('체크인 데이터 로딩 실패:', e);
        } finally {
            setLoading(false);
        }
    }, [propertyFilter, activeTab, eventFilter, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 2. 자동 새로고침 타이머
    useEffect(() => {
        if (autoRefreshSec <= 0) return;
        const timer = setInterval(() => {
            fetchData();
        }, autoRefreshSec * 1000);
        return () => clearInterval(timer);
    }, [autoRefreshSec, fetchData]);

    // 3. 복사 피드백 헬퍼
    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedText(label);
        setTimeout(() => setCopiedText(null), 2000);
    };

    // 시간 포맷터 (KST 시:분:초)
    const formatTimeKst = (isoStr?: string | null) => {
        if (!isoStr) return '-';
        try {
            const d = new Date(isoStr);
            return new Intl.DateTimeFormat('ko-KR', {
                timeZone: 'Asia/Seoul',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            }).format(d);
        } catch {
            return isoStr;
        }
    };

    const formatDateKst = (isoStr?: string | null) => {
        if (!isoStr) return '-';
        try {
            const d = new Date(isoStr);
            return new Intl.DateTimeFormat('ko-KR', {
                timeZone: 'Asia/Seoul',
                month: 'short',
                day: 'numeric',
                weekday: 'short',
            }).format(d);
        } catch {
            return isoStr;
        }
    };

    // 4. 오늘 체크인 게스트 필터링
    const filteredTodayArrivals = useMemo(() => {
        return todayArrivals.filter((item) => {
            if (propertyFilter !== 'ALL' && !item.propertyName.includes(propertyFilter)) return false;
            if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = item.guestName.toLowerCase().includes(q);
                const matchBookId = String(item.bookingId).includes(q);
                const matchRoom = (item.unitName || '').toLowerCase().includes(q);
                if (!matchName && !matchBookId && !matchRoom) return false;
            }
            return true;
        });
    }, [todayArrivals, propertyFilter, statusFilter, searchQuery]);

    // 이벤트 뱃지 렌더러 (이모지 제거)
    const renderEventBadge = (eventType: string) => {
        switch (eventType) {
            case 'LOOKUP_FAILED':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                        조회 실패
                    </span>
                );
            case 'LOOKUP_SUCCESS':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
                        조회 성공
                    </span>
                );
            case 'HOUSE_RULES_AGREED':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        규칙 동의
                    </span>
                );
            case 'DOORLOCK_ACCESSED':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                        비번 열람
                    </span>
                );
            case 'DOORLOCK_BLOCKED':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        17시 전 차단
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                        {eventType}
                    </span>
                );
        }
    };

    // 오늘 체크인 게스트 상태 뱃지 렌더러 (이모지 제거)
    const renderTodayStatusBadge = (status: TodayArrivalItem['status']) => {
        switch (status) {
            case 'PASSWORD_VIEWED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                        비번 열람 완료
                    </span>
                );
            case 'RULES_AGREED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        규칙 동의 완료
                    </span>
                );
            case 'LOOKED_UP':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
                        조회 완료 (미동의)
                    </span>
                );
            case 'UNCHECKED':
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                        미확인 (수동 연락 필요)
                    </span>
                );
        }
    };

    // 관리자 권한 가드
    if (!authLoading && !isAdmin) {
        return (
            <div className="flex min-h-screen bg-gray-100 items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg border border-gray-200">
                    <h2 className="text-lg font-black text-gray-900 mt-1">관리자 전용 페이지</h2>
                    <p className="text-sm text-gray-500 mt-2">
                        체크인 관리 페이지는 관리자(admin) 계정으로만 접근할 수 있습니다.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-slate-950 transition-colors duration-200">
            {/* 사이드바 */}
            <AppSidebar
                isMobileOpen={isMobileSidebarOpen}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />

            {/* 메인 본문 컨텐츠 */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* 상단 콤팩트 헤더 */}
                <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-3 py-2.5 md:px-6 md:py-3 flex items-center justify-between shadow-xs shrink-0">
                    <div className="flex items-center gap-3">
                        {/* 모바일 햄버거 버튼 */}
                        <button
                            type="button"
                            onClick={() => setIsMobileSidebarOpen(true)}
                            title="메뉴 열기"
                            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-base font-black transition cursor-pointer border border-gray-200 dark:border-slate-700"
                        >
                            ☰
                        </button>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-base md:text-lg font-black text-gray-900 dark:text-slate-100 leading-tight">
                                    체크인 관리
                                </h1>
                                {todayDate && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800 hidden sm:inline-block">
                                        {formatDateKst(todayDate)} 기준
                                    </span>
                                )}
                            </div>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-bold hidden sm:inline">
                                오늘 체크인 게스트 열람 현황 및 실시간 체크인 로그 모니터링
                            </span>
                        </div>
                    </div>

                    {/* 우측 컨트롤: 자동 새로고침 & 수동 새로고침 */}
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-xl border border-gray-200 dark:border-slate-700 text-xs">
                            <span className="text-gray-500 dark:text-slate-400 font-bold">자동 갱신:</span>
                            <select
                                value={autoRefreshSec}
                                onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
                                className="bg-transparent font-black text-gray-700 dark:text-slate-200 outline-hidden cursor-pointer"
                            >
                                <option value={15} className="dark:bg-slate-900">15초</option>
                                <option value={30} className="dark:bg-slate-900">30초</option>
                                <option value={60} className="dark:bg-slate-900">1분</option>
                                <option value={0} className="dark:bg-slate-900">OFF</option>
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={fetchData}
                            disabled={loading}
                            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <span className={loading ? 'animate-spin' : ''}>↻</span>
                            <span>새로고침</span>
                        </button>
                    </div>
                </header>

                {/* 메인 스크롤 영역 */}
                <main className="flex-1 p-3 md:p-6 overflow-y-auto space-y-4 md:space-y-5">
                    {/* 탭 전환 및 필터 컨트롤 바 */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-3 md:p-4 shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            {/* 듀얼 탭 전환 버튼 */}
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('today')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                        activeTab === 'today'
                                            ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-xs'
                                            : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                                    }`}
                                >
                                    <span>오늘 체크인 현황</span>
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300">
                                        {todayArrivals.length}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveTab('logs')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                        activeTab === 'logs'
                                            ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-xs'
                                            : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                                    }`}
                                >
                                    <span>실시간 로그</span>
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300">
                                        {logs.length}
                                    </span>
                                </button>
                            </div>

                            {/* 숙소(지점) 필터 */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                                {['ALL', '연남', '웨이브', '그린', '남선'].map((prop) => (
                                    <button
                                        key={prop}
                                        type="button"
                                        onClick={() => setPropertyFilter(prop)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                            propertyFilter === prop
                                                ? 'bg-gray-900 dark:bg-blue-600 text-white'
                                                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {prop === 'ALL' ? '전체 지점' : prop}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 세부 필터 & 검색창 */}
                        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-gray-100 dark:border-slate-800">
                            {/* 탭별 서브 필터 */}
                            {activeTab === 'today' ? (
                                <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
                                    {[
                                        { id: 'ALL', label: '전체 상태' },
                                        { id: 'UNCHECKED', label: '미확인만' },
                                        { id: 'RULES_AGREED', label: '동의완료' },
                                        { id: 'PASSWORD_VIEWED', label: '비번열람' },
                                    ].map((st) => (
                                        <button
                                            key={st.id}
                                            type="button"
                                            onClick={() => setStatusFilter(st.id)}
                                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                                statusFilter === st.id
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {st.label}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
                                    {[
                                        { id: 'ALL', label: '전체 이벤트' },
                                        { id: 'LOOKUP_FAILED', label: '실패' },
                                        { id: 'LOOKUP_SUCCESS', label: '성공' },
                                        { id: 'HOUSE_RULES_AGREED', label: '규칙동의' },
                                        { id: 'DOORLOCK_ACCESSED', label: '비번열람' },
                                    ].map((ev) => (
                                        <button
                                            key={ev.id}
                                            type="button"
                                            onClick={() => setEventFilter(ev.id)}
                                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                                eventFilter === ev.id
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {ev.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* 검색창 */}
                            <div className="relative w-full sm:w-72 sm:ml-auto">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="게스트 성함 또는 예약번호 검색..."
                                    className="w-full px-3 py-1.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100/80 dark:hover:bg-slate-700/80 focus:bg-white dark:focus:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-hidden transition focus:ring-2 focus:ring-blue-500"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white text-xs cursor-pointer font-bold"
                                    >
                                        &times;
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 탭 1: 오늘 체크인 게스트 현황판 */}
                    {activeTab === 'today' && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
                            {/* 테이블 헤더 안내 */}
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                                <h3 className="text-xs md:text-sm font-black text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                                    <span>오늘 입실 게스트 목록</span>
                                    <span className="text-gray-400 dark:text-slate-500 text-xs font-bold">
                                        ({filteredTodayArrivals.length}팀)
                                    </span>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleCopy('https://checkin.maisondewave.com', 'checkinUrl')}
                                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-bold rounded-lg transition cursor-pointer"
                                    >
                                        {copiedText === 'checkinUrl' ? '링크 복사됨!' : '체크인 링크 복사'}
                                    </button>
                                </div>
                            </div>

                            {/* 데이터 없음 상태 */}
                            {filteredTodayArrivals.length === 0 ? (
                                <div className="py-12 text-center">
                                    <p className="text-sm font-black text-gray-700 dark:text-slate-300">
                                        해당 조건의 입실 게스트가 없습니다.
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                        필터 조건을 변경하거나 새로고침을 실행해 보세요.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* 데스크톱 테이블 뷰 */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/75 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-800 text-[11px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                                    <th className="py-3 px-4">숙소 / 호실</th>
                                                    <th className="py-3 px-4">게스트 정보</th>
                                                    <th className="py-3 px-4">채널 / 인원</th>
                                                    <th className="py-3 px-4">진행 상태</th>
                                                    <th className="py-3 px-4">최근 활동</th>
                                                    <th className="py-3 px-4 text-right">작업</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs font-bold text-gray-700 dark:text-slate-300">
                                                {filteredTodayArrivals.map((item) => (
                                                    <tr
                                                        key={item.bookingId}
                                                        className={`hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition ${
                                                            item.status === 'UNCHECKED' ? 'bg-rose-50/20 dark:bg-rose-950/20' : ''
                                                        }`}
                                                    >
                                                        {/* 숙소 / 호실 */}
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className="px-2 py-0.5 rounded-md text-[11px] font-black"
                                                                    style={{
                                                                        backgroundColor: item.badgeStyle?.bg || '#f3f4f6',
                                                                        color: item.badgeStyle?.text || '#1f2937',
                                                                    }}
                                                                >
                                                                    {item.propertyName}
                                                                </span>
                                                                <span className="font-black text-gray-900 dark:text-slate-100">
                                                                    {item.unitName || item.subName || '-'}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* 게스트 정보 */}
                                                        <td className="py-3 px-4">
                                                            <div className="font-black text-gray-900 dark:text-slate-100 text-sm">
                                                                {item.guestName}
                                                            </div>
                                                            <div className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                                                                예약 ID: #{item.bookingId}
                                                            </div>
                                                        </td>

                                                        {/* 채널 / 인원 */}
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded text-[11px] font-bold">
                                                                    {item.channel}
                                                                </span>
                                                                <span className="text-gray-500 dark:text-slate-400 text-[11px]">
                                                                    {item.numGuests}인
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* 진행 상태 */}
                                                        <td className="py-3 px-4">
                                                            {renderTodayStatusBadge(item.status)}
                                                        </td>

                                                        {/* 최근 활동 */}
                                                        <td className="py-3 px-4">
                                                            {item.lastEventAt ? (
                                                                <span className="text-gray-600 dark:text-slate-300 font-bold">
                                                                    {formatTimeKst(item.lastEventAt)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300 dark:text-slate-600 font-medium">-</span>
                                                            )}
                                                        </td>

                                                        {/* 빠른 액션 */}
                                                        <td className="py-3 px-4 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                {item.phone && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleCopy(item.phone, `phone_${item.bookingId}`)}
                                                                        title={`전화번호: ${item.phone}`}
                                                                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-md text-xs font-bold transition cursor-pointer"
                                                                    >
                                                                        {copiedText === `phone_${item.bookingId}` ? '복사됨' : '전화번호'}
                                                                    </button>
                                                                )}

                                                                <a
                                                                    href={`https://beds24.com/control2.php?pagetype=bookingedit&bookid=${item.bookingId}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-400 rounded-md text-xs font-bold transition cursor-pointer border border-blue-200 dark:border-blue-800"
                                                                >
                                                                    Beds24 ↗
                                                                </a>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* 모바일 카드 뷰 (가로 스크롤 방지 & 터치 친화적) */}
                                    <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-800">
                                        {filteredTodayArrivals.map((item) => (
                                            <div
                                                key={item.bookingId}
                                                className={`p-3.5 space-y-2.5 ${
                                                    item.status === 'UNCHECKED' ? 'bg-rose-50/30 dark:bg-rose-950/30' : ''
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span
                                                                className="px-1.5 py-0.5 rounded text-[10.5px] font-black"
                                                                style={{
                                                                    backgroundColor: item.badgeStyle?.bg || '#f3f4f6',
                                                                    color: item.badgeStyle?.text || '#1f2937',
                                                                }}
                                                            >
                                                                {item.propertyName}
                                                            </span>
                                                            <span className="font-black text-gray-900 dark:text-slate-100 text-xs">
                                                                {item.unitName || item.subName}
                                                            </span>
                                                        </div>
                                                        <h4 className="font-black text-gray-900 dark:text-slate-100 text-sm mt-1">
                                                            {item.guestName}
                                                        </h4>
                                                        <span className="text-[11px] text-gray-400 dark:text-slate-500">
                                                            #{item.bookingId} · {item.channel} · {item.numGuests}인
                                                        </span>
                                                    </div>

                                                    <div className="text-right shrink-0">
                                                        {renderTodayStatusBadge(item.status)}
                                                        {item.lastEventAt && (
                                                            <div className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-1">
                                                                {formatTimeKst(item.lastEventAt)} 접속
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-50 dark:border-slate-800">
                                                    {item.phone && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(item.phone, `m_phone_${item.bookingId}`)}
                                                            className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-xs font-bold cursor-pointer"
                                                        >
                                                            {copiedText === `m_phone_${item.bookingId}` ? '복사됨' : item.phone}
                                                        </button>
                                                    )}
                                                    <a
                                                        href={`https://beds24.com/control2.php?pagetype=bookingedit&bookid=${item.bookingId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold"
                                                    >
                                                        Beds24 ↗
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* 탭 2: 실시간 전체 로그 타임라인 */}
                    {activeTab === 'logs' && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                                <h3 className="text-xs md:text-sm font-black text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                                    <span>체크인 이벤트 감사 로그</span>
                                    <span className="text-gray-400 dark:text-slate-500 text-xs font-bold">
                                        ({logs.length}건)
                                    </span>
                                </h3>
                                <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                                    최신순 실시간 기록
                                </span>
                            </div>

                            {logs.length === 0 ? (
                                <div className="py-12 text-center">
                                    <p className="text-sm font-black text-gray-700 dark:text-slate-300">
                                        기록된 체크인 로그가 없습니다.
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                        체크인 포털에서 조회가 발생하면 여기에 실시간으로 기록됩니다.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* 데스크톱 로그 테이블 */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/75 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-800 text-[11px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                                    <th className="py-3 px-4">시각 (KST)</th>
                                                    <th className="py-3 px-4">이벤트</th>
                                                    <th className="py-3 px-4">게스트 / 입력 성함</th>
                                                    <th className="py-3 px-4">숙소 / 호실</th>
                                                    <th className="py-3 px-4">결과 및 사유</th>
                                                    <th className="py-3 px-4">기기 및 IP</th>
                                                    <th className="py-3 px-4 text-right">상세</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs font-bold text-gray-700 dark:text-slate-300">
                                                {logs.map((log) => (
                                                    <tr
                                                        key={log.id}
                                                        className={`hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition ${
                                                            log.event_type === 'LOOKUP_FAILED' ? 'bg-rose-50/25 dark:bg-rose-950/25' : ''
                                                        }`}
                                                    >
                                                        {/* 시각 */}
                                                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                                                            <div className="font-black text-gray-900 dark:text-slate-100">
                                                                {formatTimeKst(log.created_at)}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 dark:text-slate-500">
                                                                {formatDateKst(log.created_at)}
                                                            </div>
                                                        </td>

                                                        {/* 이벤트 뱃지 */}
                                                        <td className="py-3 px-4">
                                                            {renderEventBadge(log.event_type)}
                                                        </td>

                                                        {/* 게스트 / 입력 성함 */}
                                                        <td className="py-3 px-4">
                                                            <div className="font-black text-gray-900 dark:text-slate-100">
                                                                {log.input_guest_name || '미입력'}
                                                            </div>
                                                            {log.booking_id && (
                                                                <div className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                                                                    #{log.booking_id}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* 숙소 / 호실 */}
                                                        <td className="py-3 px-4">
                                                            <div className="text-gray-900 dark:text-slate-100 font-bold">
                                                                {log.property_name || '-'}
                                                            </div>
                                                            {log.unit_key && (
                                                                <div className="text-[11px] text-gray-400 dark:text-slate-500">
                                                                    {log.unit_key}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* 결과 및 사유 (오타 디버깅 핵심) */}
                                                        <td className="py-3 px-4">
                                                            {log.failure_reason ? (
                                                                <span className="text-rose-700 dark:text-rose-300 font-black bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                                                                    {log.failure_reason}
                                                                </span>
                                                            ) : (
                                                                <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                                                                    정상 처리 ({log.status_code})
                                                                </span>
                                                            )}
                                                            {log.input_checkin && (
                                                                <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                                                                    일정: {log.input_checkin} ~ {log.input_checkout || ''}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* 기기 및 IP */}
                                                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400 text-[11px]">
                                                            <div>{log.ip_address || 'unknown'}</div>
                                                            <div className="text-gray-400 dark:text-slate-500 truncate max-w-[120px]" title={log.user_agent || ''}>
                                                                {log.user_agent ? (log.user_agent.includes('Mobile') ? '모바일' : 'PC/웹') : '-'}
                                                            </div>
                                                        </td>

                                                        {/* 상세 보기 */}
                                                        <td className="py-3 px-4 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedLog(log)}
                                                                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
                                                            >
                                                                상세보기
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* 모바일 로그 카드 뷰 */}
                                    <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-800">
                                        {logs.map((log) => (
                                            <div
                                                key={log.id}
                                                onClick={() => setSelectedLog(log)}
                                                className={`p-3.5 space-y-2 cursor-pointer transition active:bg-gray-100 dark:active:bg-slate-800 ${
                                                    log.event_type === 'LOOKUP_FAILED' ? 'bg-rose-50/30 dark:bg-rose-950/30' : ''
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        {renderEventBadge(log.event_type)}
                                                        <span className="text-xs font-black text-gray-900 dark:text-slate-100">
                                                            {log.input_guest_name || '미입력'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] text-gray-400 dark:text-slate-500 font-bold">
                                                        {formatTimeKst(log.created_at)}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-300">
                                                    <span>
                                                        {log.property_name || '지점 미지정'}{' '}
                                                        {log.unit_key ? `(${log.unit_key})` : ''}
                                                    </span>
                                                    {log.booking_id && (
                                                        <span className="text-blue-600 dark:text-blue-400 font-bold">
                                                            #{log.booking_id}
                                                        </span>
                                                    )}
                                                </div>

                                                {log.failure_reason && (
                                                    <div className="text-xs text-rose-700 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded border border-rose-200 dark:border-rose-900">
                                                        사유: {log.failure_reason}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* 로그 상세 보기 팝업 모달 */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                {renderEventBadge(selectedLog.event_type)}
                                <h3 className="font-black text-gray-900 dark:text-slate-100 text-sm">
                                    체크인 이벤트 상세 로그
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedLog(null)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 font-black text-sm cursor-pointer p-1"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="space-y-2.5 text-xs text-gray-700 dark:text-slate-300">
                            <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-slate-800 p-2.5 rounded-xl">
                                <span className="font-bold text-gray-400 dark:text-slate-400">발생 시각:</span>
                                <span className="col-span-2 font-black">
                                    {new Date(selectedLog.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                                </span>

                                <span className="font-bold text-gray-400 dark:text-slate-400">입력 성함:</span>
                                <span className="col-span-2 font-black text-blue-700 dark:text-blue-400">
                                    {selectedLog.input_guest_name || '-'}
                                </span>

                                <span className="font-bold text-gray-400 dark:text-slate-400">입퇴실 일정:</span>
                                <span className="col-span-2 font-bold">
                                    {selectedLog.input_checkin || '-'} ~ {selectedLog.input_checkout || '-'}
                                </span>

                                <span className="font-bold text-gray-400 dark:text-slate-400">매칭 예약 ID:</span>
                                <span className="col-span-2 font-bold">
                                    {selectedLog.booking_id ? `#${selectedLog.booking_id}` : '없음'}
                                </span>

                                <span className="font-bold text-gray-400 dark:text-slate-400">숙소 / 호실:</span>
                                <span className="col-span-2 font-bold">
                                    {selectedLog.property_name || '-'} {selectedLog.unit_key || ''}
                                </span>

                                <span className="font-bold text-gray-400 dark:text-slate-400">실패 사유:</span>
                                <span className="col-span-2 font-bold text-rose-600 dark:text-rose-400">
                                    {selectedLog.failure_reason || '정상 완료'}
                                </span>

                                <span className="font-bold text-gray-400 dark:text-slate-400">접속 IP:</span>
                                <span className="col-span-2 font-mono text-[11px]">
                                    {selectedLog.ip_address || '-'}
                                </span>
                            </div>

                            {/* 브라우저 User-Agent */}
                            <div>
                                <span className="font-bold text-gray-400 dark:text-slate-400 block mb-1">접속 기기 (User-Agent):</span>
                                <div className="bg-gray-50 dark:bg-slate-800 p-2 rounded-lg font-mono text-[10.5px] break-all text-gray-600 dark:text-slate-300 border border-gray-100 dark:border-slate-700">
                                    {selectedLog.user_agent || '-'}
                                </div>
                            </div>

                            {/* 메타데이터 JSON */}
                            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                                <div>
                                    <span className="font-bold text-gray-400 dark:text-slate-400 block mb-1">추가 메타데이터:</span>
                                    <pre className="bg-gray-900 text-emerald-400 p-2.5 rounded-lg text-[11px] overflow-x-auto font-mono">
                                        {JSON.stringify(selectedLog.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white dark:text-slate-200 border border-transparent dark:border-slate-700 rounded-xl text-xs font-black transition cursor-pointer"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
