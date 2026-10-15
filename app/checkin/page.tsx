'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../dashboard.css';
import { useAuth } from '../hooks/useAuth';
import AppSidebar from '../components/layout/AppSidebar';

export interface CareSurveyInfo {
    id: string;
    createdAt: string;
    cleanliness: string[];
    facility: string[];
    environment: string[];
    comment: string;
}

export interface GuestCareItem {
    id: string;
    booking_id: number;
    property_name: string;
    room_name: string;
    unit_key?: string;
    guest_name: string;
    check_in: string;
    check_out: string;
    q1_cleanliness?: string[];
    q2_facility?: string[];
    q3_environment?: string[];
    q4_comment?: string;
    created_at: string;
}

export interface CareStats {
    totalCount: number;
    propertyCounts: Record<string, number>;
    cleanlinessIssues: number;
    facilityIssues: number;
    environmentIssues: number;
}

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
    careSurvey?: CareSurveyInfo | null;
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

    // 게스트 케어 데이터 상태
    const [careSurveys, setCareSurveys] = useState<GuestCareItem[]>([]);
    const [careStats, setCareStats] = useState<CareStats | null>(null);
    const [careLoading, setCareLoading] = useState<boolean>(false);
    const [selectedCareSurvey, setSelectedCareSurvey] = useState<GuestCareItem | null>(null);
    const [careCategoryFilter, setCareCategoryFilter] = useState<string>('ALL'); // 'ALL' | 'cleanliness' | 'facility' | 'environment' | 'comment'

    // 필터 및 탭 상태
    const [activeTab, setActiveTab] = useState<'today' | 'logs' | 'care'>('today');
    const [propertyFilter, setPropertyFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL'); // 오늘 현황 필터
    const [eventFilter, setEventFilter] = useState<string>('ALL'); // 전체 로그 필터
    const [logDateFilter, setLogDateFilter] = useState<string>('ALL'); // 로그 날짜 필터 ('ALL' | 'YYYY-MM-DD')
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [autoRefreshSec, setAutoRefreshSec] = useState<number>(15); // 15s 기본
    const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

    // 상세 모달 및 피드백 상태
    const [selectedLog, setSelectedLog] = useState<CheckinLogItem | null>(null);
    const [copiedText, setCopiedText] = useState<string | null>(null);

    // 날짜 아코디언 토글 핸들러
    const toggleDateCollapse = (dateKey: string) => {
        setCollapsedDates((prev) => {
            const next = new Set(prev);
            if (next.has(dateKey)) next.delete(dateKey);
            else next.add(dateKey);
            return next;
        });
    };

    // 케어 설문 코드 한국어 매핑
    const CARE_LABEL_MAP: Record<string, string> = {
        // 청결도 (q1)
        floor: '바닥/청결',
        bedding: '침구류',
        bathroom: '욕실/화장실',
        kitchen: '주방/식기',
        trash: '쓰레기/정리',
        // 시설/비품 (q2)
        ac: '에어컨/난방',
        water: '온수/수압',
        tv: 'TV/OTT',
        wifi: '와이파이',
        towel: '수건/어메니티',
        appliance: '가전제품',
        // 환경 (q3)
        noise: '소음',
        odor: '냄새/환기',
        bugs: '벌레',
        light: '조명/채광',
    };

    const getCareLabel = (code: string) => CARE_LABEL_MAP[code] || code;

    // 1. API 데이터 페칭 (체크인 로그 및 오늘 현황)
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (propertyFilter !== 'ALL') params.set('property', propertyFilter);
            if (activeTab === 'logs' && eventFilter !== 'ALL') params.set('eventType', eventFilter);
            if (activeTab === 'logs' && logDateFilter !== 'ALL') params.set('date', logDateFilter);
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
    }, [propertyFilter, activeTab, eventFilter, logDateFilter, searchQuery]);

    // 2. 게스트 케어 전용 데이터 페칭
    const fetchCareData = useCallback(async () => {
        try {
            setCareLoading(true);
            const params = new URLSearchParams();
            if (propertyFilter !== 'ALL') params.set('property', propertyFilter);
            if (searchQuery.trim()) params.set('search', searchQuery.trim());
            params.set('limit', '100');

            const res = await fetch(`/api/checkin/care?${params.toString()}`, { cache: 'no-store' });
            const json = await res.json();

            if (json.success) {
                setCareSurveys(json.surveys || []);
                setCareStats(json.stats || null);
            }
        } catch (e) {
            console.error('게스트 케어 데이터 로딩 실패:', e);
        } finally {
            setCareLoading(false);
        }
    }, [propertyFilter, searchQuery]);

    useEffect(() => {
        fetchData();
        fetchCareData();
    }, [fetchData, fetchCareData]);

    // 3. 자동 새로고침 타이머
    useEffect(() => {
        if (autoRefreshSec <= 0) return;
        const timer = setInterval(() => {
            fetchData();
            if (activeTab === 'care') {
                fetchCareData();
            }
        }, autoRefreshSec * 1000);
        return () => clearInterval(timer);
    }, [autoRefreshSec, fetchData, fetchCareData, activeTab]);

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

    // KST 날짜 키 추출 (YYYY-MM-DD)
    const getKstDateKey = (isoStr: string): string => {
        try {
            const d = new Date(isoStr);
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).formatToParts(d);
            const getVal = (type: string) => parts.find((p) => p.type === type)?.value || '00';
            return `${getVal('year')}-${getVal('month')}-${getVal('day')}`;
        } catch {
            return (isoStr || '').slice(0, 10);
        }
    };

    // KST 요일 포함 전체 날짜 레이블 (예: 2026년 10월 1일 (목))
    const getKstFullDateLabel = (dateKey: string): string => {
        try {
            const d = new Date(`${dateKey}T12:00:00+09:00`);
            return new Intl.DateTimeFormat('ko-KR', {
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
            }).format(d);
        } catch {
            return dateKey;
        }
    };

    // 오늘 및 어제 KST 기준 날짜 문자열
    const todayKst = useMemo(() => {
        if (todayDate) return todayDate;
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(new Date());
        const getVal = (type: string) => parts.find((p) => p.type === type)?.value || '00';
        return `${getVal('year')}-${getVal('month')}-${getVal('day')}`;
    }, [todayDate]);

    const yesterdayKst = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(d);
        const getVal = (type: string) => parts.find((p) => p.type === type)?.value || '00';
        return `${getVal('year')}-${getVal('month')}-${getVal('day')}`;
    }, []);

    // 5. 실시간 로그 날짜별 그룹핑
    const groupedLogs = useMemo(() => {
        const map = new Map<string, CheckinLogItem[]>();
        logs.forEach((log) => {
            const dKey = getKstDateKey(log.created_at);
            if (!map.has(dKey)) {
                map.set(dKey, []);
            }
            map.get(dKey)!.push(log);
        });

        const sections = Array.from(map.entries()).map(([dateKey, items]) => {
            items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const failureCount = items.filter((l) => l.event_type === 'LOOKUP_FAILED').length;
            const successCount = items.filter((l) => l.event_type === 'LOOKUP_SUCCESS').length;
            const rulesAgreedCount = items.filter((l) => l.event_type === 'HOUSE_RULES_AGREED').length;
            const passwordViewedCount = items.filter((l) => l.event_type === 'DOORLOCK_ACCESSED').length;

            return {
                dateKey,
                dateLabel: getKstFullDateLabel(dateKey),
                isToday: dateKey === todayKst,
                isYesterday: dateKey === yesterdayKst,
                totalCount: items.length,
                failureCount,
                successCount,
                rulesAgreedCount,
                passwordViewedCount,
                logs: items,
            };
        });

        sections.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
        return sections;
    }, [logs, todayKst, yesterdayKst]);

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

    // 4-1. 게스트 케어 설문 피드백 필터링
    const filteredCareSurveys = useMemo(() => {
        return careSurveys.filter((item) => {
            if (propertyFilter !== 'ALL') {
                const prop = (item.property_name || '').toLowerCase();
                const filter = propertyFilter.toLowerCase();
                if (filter === '웨이브' && !prop.includes('wave') && !prop.includes('웨이브')) return false;
                else if (filter === '호랑' && !prop.includes('horang') && !prop.includes('호랑')) return false;
                else if (filter === '연남' && !prop.includes('yeonnam') && !prop.includes('연남')) return false;
                else if (filter === '그린' && !prop.includes('green') && !prop.includes('그린')) return false;
                else if (filter === '남선' && !prop.includes('namsun') && !prop.includes('남선')) return false;
                else if (!prop.includes(filter)) return false;
            }

            if (careCategoryFilter === 'cleanliness') {
                if (!item.q1_cleanliness || item.q1_cleanliness.length === 0) return false;
            } else if (careCategoryFilter === 'facility') {
                if (!item.q2_facility || item.q2_facility.length === 0) return false;
            } else if (careCategoryFilter === 'environment') {
                if (!item.q3_environment || item.q3_environment.length === 0) return false;
            } else if (careCategoryFilter === 'comment') {
                if (!item.q4_comment || !item.q4_comment.trim()) return false;
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = (item.guest_name || '').toLowerCase().includes(q);
                const matchBookId = String(item.booking_id || '').includes(q);
                const matchRoom = (item.room_name || '').toLowerCase().includes(q);
                const matchComment = (item.q4_comment || '').toLowerCase().includes(q);
                if (!matchName && !matchBookId && !matchRoom && !matchComment) return false;
            }

            return true;
        });
    }, [careSurveys, propertyFilter, careCategoryFilter, searchQuery]);

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
                            {/* 3단 탭 전환 버튼 */}
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
                                    <span>오늘 체크인</span>
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

                                <button
                                    type="button"
                                    onClick={() => setActiveTab('care')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                        activeTab === 'care'
                                            ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-200 dark:ring-purple-800'
                                            : 'text-gray-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
                                    }`}
                                >
                                    <span>게스트 케어</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                        activeTab === 'care'
                                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                            : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                                    }`}>
                                        {careSurveys.length}
                                    </span>
                                </button>
                            </div>

                            {/* 숙소(지점) 필터 */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                                {['ALL', '웨이브', '호랑', '연남', '그린', '남선'].map((prop) => (
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
                            ) : activeTab === 'logs' ? (
                                <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
                                    {[
                                        { id: 'ALL', label: '전체 이벤트' },
                                        { id: 'LOOKUP_FAILED', label: '실패만' },
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
                            ) : (
                                <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
                                    {[
                                        { id: 'ALL', label: '전체 피드백' },
                                        { id: 'cleanliness', label: '청결 이슈' },
                                        { id: 'facility', label: '시설 이슈' },
                                        { id: 'environment', label: '환경 이슈' },
                                        { id: 'comment', label: '의견(코멘트) 있음' },
                                    ].map((cat) => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setCareCategoryFilter(cat.id)}
                                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                                careCategoryFilter === cat.id
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {cat.label}
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

                        {/* 실시간 로그 전용 날짜 선택 툴바 */}
                        {activeTab === 'logs' && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-slate-800 text-xs">
                                <span className="text-gray-500 dark:text-slate-400 font-extrabold text-[11px] shrink-0">📅 날짜:</span>
                                <button
                                    type="button"
                                    onClick={() => setLogDateFilter('ALL')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                        logDateFilter === 'ALL'
                                            ? 'bg-gray-900 dark:bg-blue-600 text-white shadow-2xs'
                                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    전체 날짜
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLogDateFilter(todayKst)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                        logDateFilter === todayKst
                                            ? 'bg-blue-600 text-white shadow-2xs'
                                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    오늘
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLogDateFilter(yesterdayKst)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                        logDateFilter === yesterdayKst
                                            ? 'bg-blue-600 text-white shadow-2xs'
                                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    어제
                                </button>

                                <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800 p-0.5 px-2 rounded-lg border border-gray-200 dark:border-slate-700">
                                    <span className="text-[11px] text-gray-400 font-medium">직접선택:</span>
                                    <input
                                        type="date"
                                        value={logDateFilter === 'ALL' || logDateFilter === todayKst || logDateFilter === yesterdayKst ? '' : logDateFilter}
                                        onChange={(e) => {
                                            if (e.target.value) setLogDateFilter(e.target.value);
                                        }}
                                        className="bg-transparent text-xs font-bold text-gray-800 dark:text-slate-200 outline-none cursor-pointer"
                                    />
                                </div>

                                <div className="ml-auto hidden sm:flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-slate-400">
                                    <button
                                        type="button"
                                        onClick={() => setCollapsedDates(new Set())}
                                        className="hover:text-blue-600 dark:hover:text-blue-400 font-bold transition cursor-pointer"
                                    >
                                        모두 펼치기
                                    </button>
                                    <span>·</span>
                                    <button
                                        type="button"
                                        onClick={() => setCollapsedDates(new Set(groupedLogs.map((g) => g.dateKey)))}
                                        className="hover:text-blue-600 dark:hover:text-blue-400 font-bold transition cursor-pointer"
                                    >
                                        모두 접기
                                    </button>
                                </div>
                            </div>
                        )}
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
                                                            <div className="flex flex-col gap-1 items-start">
                                                                {renderTodayStatusBadge(item.status)}
                                                                {item.careSurvey && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedCareSurvey({
                                                                                id: item.careSurvey!.id,
                                                                                booking_id: item.bookingId,
                                                                                property_name: item.propertyName,
                                                                                room_name: item.unitName || item.subName || '',
                                                                                guest_name: item.guestName,
                                                                                check_in: todayDate,
                                                                                check_out: '',
                                                                                q1_cleanliness: item.careSurvey!.cleanliness,
                                                                                q2_facility: item.careSurvey!.facility,
                                                                                q3_environment: item.careSurvey!.environment,
                                                                                q4_comment: item.careSurvey!.comment,
                                                                                created_at: item.careSurvey!.createdAt,
                                                                            });
                                                                        }}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-black bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/70 dark:hover:bg-purple-900/80 text-purple-700 dark:text-purple-300 transition cursor-pointer border border-purple-200 dark:border-purple-800"
                                                                        title="클릭하여 케어 설문 피드백 확인"
                                                                    >
                                                                        <span>💬 케어 설문 제출됨</span>
                                                                    </button>
                                                                )}
                                                            </div>
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

                                                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                        {renderTodayStatusBadge(item.status)}
                                                        {item.careSurvey && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedCareSurvey({
                                                                        id: item.careSurvey!.id,
                                                                        booking_id: item.bookingId,
                                                                        property_name: item.propertyName,
                                                                        room_name: item.unitName || item.subName || '',
                                                                        guest_name: item.guestName,
                                                                        check_in: todayDate,
                                                                        check_out: '',
                                                                        q1_cleanliness: item.careSurvey!.cleanliness,
                                                                        q2_facility: item.careSurvey!.facility,
                                                                        q3_environment: item.careSurvey!.environment,
                                                                        q4_comment: item.careSurvey!.comment,
                                                                        created_at: item.careSurvey!.createdAt,
                                                                    });
                                                                }}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                                            >
                                                                <span>💬 케어 제출됨</span>
                                                            </button>
                                                        )}
                                                        {item.lastEventAt && (
                                                            <div className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-0.5">
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

                    {/* 탭 2: 실시간 전체 로그 타임라인 (날짜별 그룹화 뷰) */}
                    {activeTab === 'logs' && (
                        <div className="space-y-4">
                            {/* 상단 로그 건수 & 안내 바 */}
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs md:text-sm font-black text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                                        <span>체크인 이벤트 감사 로그</span>
                                        <span className="text-gray-400 dark:text-slate-500 text-xs font-bold">
                                            (총 {logs.length}건 / {groupedLogs.length}개 일자)
                                        </span>
                                    </h3>
                                </div>
                                <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium hidden sm:inline">
                                    날짜별 그룹핑 및 최신순 정렬
                                </span>
                            </div>

                            {logs.length === 0 ? (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-12 text-center shadow-xs">
                                    <p className="text-sm font-black text-gray-700 dark:text-slate-300">
                                        기록된 체크인 로그가 없습니다.
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                        필터 조건을 변경하거나 새로고침을 실행해 보세요.
                                    </p>
                                </div>
                            ) : (
                                groupedLogs.map((section) => {
                                    const isCollapsed = collapsedDates.has(section.dateKey);

                                    return (
                                        <div
                                            key={section.dateKey}
                                            className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-200"
                                        >
                                            {/* 일자별 섹션 헤더 (클릭 시 아코디언 토글) */}
                                            <div
                                                onClick={() => toggleDateCollapse(section.dateKey)}
                                                className="px-4 py-3 bg-gray-50/80 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-gray-100/70 dark:hover:bg-slate-800 transition select-none"
                                            >
                                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                    <span className="text-gray-400 dark:text-slate-500 text-xs font-bold transition-transform">
                                                        {isCollapsed ? '▶' : '▼'}
                                                    </span>
                                                    <span className="text-sm font-black text-gray-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                                                        <span>📅 {section.dateLabel}</span>
                                                        {section.isToday && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                                                                오늘
                                                            </span>
                                                        )}
                                                        {section.isYesterday && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-300">
                                                                어제
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                                                        총 {section.totalCount}건
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    {section.failureCount > 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                                            조회 실패 {section.failureCount}건
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hidden sm:inline-flex">
                                                            실패 없음
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-blue-600 dark:text-blue-400 font-bold hidden sm:inline">
                                                        {isCollapsed ? '펼치기' : '접기'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 해당 일자의 로그 테이블 및 카드 목록 */}
                                            {!isCollapsed && (
                                                <>
                                                    {/* 데스크톱 로그 테이블 */}
                                                    <div className="hidden md:block overflow-x-auto">
                                                        <table className="w-full text-left border-collapse">
                                                            <thead>
                                                                <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 text-[11px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                                                    <th className="py-2.5 px-4 w-28">시각 (KST)</th>
                                                                    <th className="py-2.5 px-4 w-28">이벤트</th>
                                                                    <th className="py-2.5 px-4">게스트 / 입력 성함</th>
                                                                    <th className="py-2.5 px-4">숙소 / 호실</th>
                                                                    <th className="py-2.5 px-4">결과 및 사유</th>
                                                                    <th className="py-2.5 px-4">기기 및 IP</th>
                                                                    <th className="py-2.5 px-4 text-right w-20">상세</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs font-bold text-gray-700 dark:text-slate-300">
                                                                {section.logs.map((log) => (
                                                                    <tr
                                                                        key={log.id}
                                                                        className={`hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition ${
                                                                            log.event_type === 'LOOKUP_FAILED' ? 'bg-rose-50/25 dark:bg-rose-950/25' : ''
                                                                        }`}
                                                                    >
                                                                        {/* 시각 (헤더에 날짜가 있으므로 시:분:초만 깔끔하게) */}
                                                                        <td className="py-2.5 px-4 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                                                                            <span className="font-mono font-black text-gray-900 dark:text-slate-100 text-xs">
                                                                                {formatTimeKst(log.created_at)}
                                                                            </span>
                                                                        </td>

                                                                        {/* 이벤트 뱃지 */}
                                                                        <td className="py-2.5 px-4">
                                                                            {renderEventBadge(log.event_type)}
                                                                        </td>

                                                                        {/* 게스트 / 입력 성함 */}
                                                                        <td className="py-2.5 px-4">
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
                                                                        <td className="py-2.5 px-4">
                                                                            <div className="text-gray-900 dark:text-slate-100 font-bold">
                                                                                {log.property_name || '-'}
                                                                            </div>
                                                                            {log.unit_key && (
                                                                                <div className="text-[11px] text-gray-400 dark:text-slate-500">
                                                                                    {log.unit_key}
                                                                                </div>
                                                                            )}
                                                                        </td>

                                                                        {/* 결과 및 사유 */}
                                                                        <td className="py-2.5 px-4">
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
                                                                        <td className="py-2.5 px-4 text-gray-500 dark:text-slate-400 text-[11px]">
                                                                            <div>{log.ip_address || 'unknown'}</div>
                                                                            <div className="text-gray-400 dark:text-slate-500 truncate max-w-[120px]" title={log.user_agent || ''}>
                                                                                {log.user_agent ? (log.user_agent.includes('Mobile') ? '모바일' : 'PC/웹') : '-'}
                                                                            </div>
                                                                        </td>

                                                                        {/* 상세 보기 */}
                                                                        <td className="py-2.5 px-4 text-right">
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
                                                        {section.logs.map((log) => (
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
                                                                    <span className="text-[11px] text-gray-400 dark:text-slate-500 font-bold font-mono">
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
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* 탭 3: 게스트 케어 피드백 현황판 */}
                    {activeTab === 'care' && (
                        <div className="space-y-4">
                            {/* 게스트 케어 KPI 통계 카드 */}
                            {careStats && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-3.5">
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 md:p-4 border border-gray-200 dark:border-slate-800 shadow-xs">
                                        <div className="text-gray-400 dark:text-slate-500 text-xs font-bold">
                                            전체 접수 피드백
                                        </div>
                                        <div className="text-xl md:text-2xl font-black text-gray-900 dark:text-slate-100 mt-1 flex items-baseline gap-1">
                                            <span>{careStats.totalCount}</span>
                                            <span className="text-xs font-bold text-gray-400">건</span>
                                        </div>
                                        <div className="text-[10.5px] text-purple-600 dark:text-purple-400 font-bold mt-1 truncate">
                                            {Object.entries(careStats.propertyCounts)
                                                .map(([p, c]) => `${p} ${c}건`)
                                                .join(' · ') || '기록 없음'}
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 md:p-4 border border-gray-200 dark:border-slate-800 shadow-xs">
                                        <div className="text-gray-400 dark:text-slate-500 text-xs font-bold flex items-center gap-1">
                                            <span>청결 이슈</span>
                                        </div>
                                        <div className="text-xl md:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 flex items-baseline gap-1">
                                            <span>{careStats.cleanlinessIssues}</span>
                                            <span className="text-xs font-bold text-gray-400">건</span>
                                        </div>
                                        <div className="text-[10.5px] text-gray-400 dark:text-slate-500 font-medium mt-1">
                                            바닥, 침구, 욕실, 주방 등
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 md:p-4 border border-gray-200 dark:border-slate-800 shadow-xs">
                                        <div className="text-gray-400 dark:text-slate-500 text-xs font-bold flex items-center gap-1">
                                            <span>시설/비품 이슈</span>
                                        </div>
                                        <div className="text-xl md:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 flex items-baseline gap-1">
                                            <span>{careStats.facilityIssues}</span>
                                            <span className="text-xs font-bold text-gray-400">건</span>
                                        </div>
                                        <div className="text-[10.5px] text-gray-400 dark:text-slate-500 font-medium mt-1">
                                            에어컨, 온수, TV, 와이파이 등
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 md:p-4 border border-gray-200 dark:border-slate-800 shadow-xs">
                                        <div className="text-gray-400 dark:text-slate-500 text-xs font-bold flex items-center gap-1">
                                            <span>환경/소음 이슈</span>
                                        </div>
                                        <div className="text-xl md:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 flex items-baseline gap-1">
                                            <span>{careStats.environmentIssues}</span>
                                            <span className="text-xs font-bold text-gray-400">건</span>
                                        </div>
                                        <div className="text-[10.5px] text-gray-400 dark:text-slate-500 font-medium mt-1">
                                            소음, 냄새, 벌레, 조명 등
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 게스트 케어 피드백 목록 카드 그리드 */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                                    <h3 className="text-xs md:text-sm font-black text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                                        <span>게스트 케어 접수 목록</span>
                                        <span className="text-purple-600 dark:text-purple-400 text-xs font-bold">
                                            ({filteredCareSurveys.length}건)
                                        </span>
                                    </h3>
                                    <div className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                                        체크인 페이지에서 게스트가 직접 작성한 피드백
                                    </div>
                                </div>

                                {careLoading ? (
                                    <div className="py-16 text-center">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent mb-3"></div>
                                        <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
                                            게스트 케어 데이터를 불러오는 중...
                                        </p>
                                    </div>
                                ) : filteredCareSurveys.length === 0 ? (
                                    <div className="py-16 text-center">
                                        <p className="text-sm font-black text-gray-700 dark:text-slate-300">
                                            해당 조건의 게스트 케어 설문 데이터가 없습니다.
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                            숙소 필터나 카테고리 필터를 변경해 보세요.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {filteredCareSurveys.map((care) => {
                                            const hasCleanliness = care.q1_cleanliness && care.q1_cleanliness.length > 0;
                                            const hasFacility = care.q2_facility && care.q2_facility.length > 0;
                                            const hasEnv = care.q3_environment && care.q3_environment.length > 0;
                                            const isClean = !hasCleanliness && !hasFacility && !hasEnv;

                                            return (
                                                <div
                                                    key={care.id}
                                                    className="bg-gray-50/75 dark:bg-slate-800/60 rounded-xl p-3.5 border border-gray-200/75 dark:border-slate-700/60 hover:border-purple-300 dark:hover:border-purple-600 transition flex flex-col justify-between space-y-3"
                                                >
                                                    <div>
                                                        {/* 상단: 숙소/호실/게스트명 및 작성시간 */}
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                                        {care.property_name}
                                                                    </span>
                                                                    <span className="font-black text-gray-900 dark:text-slate-100 text-xs">
                                                                        {care.room_name}
                                                                    </span>
                                                                </div>
                                                                <h4 className="font-black text-gray-900 dark:text-slate-100 text-sm">
                                                                    {care.guest_name}
                                                                </h4>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono font-bold block">
                                                                    {formatDateKst(care.created_at)}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono block">
                                                                    {formatTimeKst(care.created_at)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* 예약 정보 */}
                                                        <div className="mt-2 text-[11px] text-gray-500 dark:text-slate-400 flex items-center justify-between">
                                                            <span>
                                                                투숙: {care.check_in} ~ {care.check_out}
                                                            </span>
                                                            <a
                                                                href={`https://beds24.com/control2.php?pagetype=bookingedit&bookid=${care.booking_id}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 dark:text-blue-400 hover:underline font-mono font-bold"
                                                            >
                                                                #{care.booking_id} ↗
                                                            </a>
                                                        </div>

                                                        {/* 이슈 태그 뱃지들 */}
                                                        <div className="mt-2.5 flex flex-wrap gap-1">
                                                            {isClean && (
                                                                <span className="px-2 py-0.5 rounded-md text-[10.5px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                    특이사항 없음 (만족)
                                                                </span>
                                                            )}
                                                            {hasCleanliness &&
                                                                care.q1_cleanliness!.map((c) => (
                                                                    <span
                                                                        key={`clean_${c}`}
                                                                        className="px-2 py-0.5 rounded-md text-[10.5px] font-black bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                                                    >
                                                                        청결: {getCareLabel(c)}
                                                                    </span>
                                                                ))}
                                                            {hasFacility &&
                                                                care.q2_facility!.map((f) => (
                                                                    <span
                                                                        key={`fac_${f}`}
                                                                        className="px-2 py-0.5 rounded-md text-[10.5px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                                                    >
                                                                        시설: {getCareLabel(f)}
                                                                    </span>
                                                                ))}
                                                            {hasEnv &&
                                                                care.q3_environment!.map((e) => (
                                                                    <span
                                                                        key={`env_${e}`}
                                                                        className="px-2 py-0.5 rounded-md text-[10.5px] font-black bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                                                    >
                                                                        환경: {getCareLabel(e)}
                                                                    </span>
                                                                ))}
                                                        </div>

                                                        {/* 게스트 의견/코멘트 */}
                                                        {care.q4_comment ? (
                                                            <div className="mt-3 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs text-gray-800 dark:text-slate-200">
                                                                <span className="text-gray-400 dark:text-slate-500 font-bold mr-1">💬 의견:</span>
                                                                <span className="font-bold">"{care.q4_comment}"</span>
                                                            </div>
                                                        ) : (
                                                            <div className="mt-3 text-[11px] text-gray-400 dark:text-slate-500 italic">
                                                                별도 코멘트 없음
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 카드 하단 액션 */}
                                                    <div className="pt-2 border-t border-gray-100 dark:border-slate-750 flex items-center justify-between">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedCareSurvey(care)}
                                                            className="text-xs font-black text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 cursor-pointer flex items-center gap-1"
                                                        >
                                                            <span>상세 보기</span>
                                                            <span>→</span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const shareText = `[게스트 케어 접수]\n- 숙소: ${care.property_name} ${care.room_name}\n- 게스트: ${care.guest_name} (#${care.booking_id})\n- 투숙: ${care.check_in} ~ ${care.check_out}\n- 청결: ${hasCleanliness ? care.q1_cleanliness!.map(getCareLabel).join(', ') : '이상없음'}\n- 시설: ${hasFacility ? care.q2_facility!.map(getCareLabel).join(', ') : '이상없음'}\n- 환경: ${hasEnv ? care.q3_environment!.map(getCareLabel).join(', ') : '이상없음'}\n- 코멘트: "${care.q4_comment || '없음'}"`;
                                                                handleCopy(shareText, `share_${care.id}`);
                                                            }}
                                                            className="px-2 py-1 bg-white hover:bg-gray-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-md text-[11px] font-bold border border-gray-200 dark:border-slate-700 transition cursor-pointer"
                                                        >
                                                            {copiedText === `share_${care.id}` ? '복사됨!' : '공유 텍스트 복사'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
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

            {/* 게스트 케어 피드백 상세 보기 팝업 모달 */}
            {selectedCareSurvey && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md text-xs font-black bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                    게스트 케어
                                </span>
                                <h3 className="font-black text-gray-900 dark:text-slate-100 text-sm">
                                    설문 피드백 상세 내역
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedCareSurvey(null)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 font-black text-sm cursor-pointer p-1"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="space-y-3 text-xs text-gray-700 dark:text-slate-300">
                            {/* 게스트 및 예약 기본 정보 */}
                            <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-slate-800 p-3 rounded-xl">
                                <span className="font-bold text-gray-400 dark:text-slate-400">게스트 성함:</span>
                                <span className="col-span-2 font-black text-purple-700 dark:text-purple-300 text-sm">
                                    {selectedCareSurvey.guest_name}
                                </span>

                                <span className="font-bold text-gray-400 dark:text-slate-400">숙소 / 호실:</span>
                                <span className="col-span-2 font-bold">
                                    {selectedCareSurvey.property_name} {selectedCareSurvey.room_name}
                                </span>

                                <span className="font-bold text-gray-400 dark:text-slate-400">투숙 일정:</span>
                                <span className="col-span-2 font-bold">
                                    {selectedCareSurvey.check_in || '-'} ~ {selectedCareSurvey.check_out || '-'}
                                </span>

                                <span className="font-bold text-gray-400 dark:text-slate-400">예약 ID:</span>
                                <span className="col-span-2 font-bold font-mono">
                                    <a
                                        href={`https://beds24.com/control2.php?pagetype=bookingedit&bookid=${selectedCareSurvey.booking_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        #{selectedCareSurvey.booking_id} ↗
                                    </a>
                                </span>

                                <span className="font-bold text-gray-400 dark:text-slate-400">작성 일시:</span>
                                <span className="col-span-2 font-bold font-mono">
                                    {new Date(selectedCareSurvey.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                                </span>
                            </div>

                            {/* 카테고리별 설문 응답 내용 */}
                            <div className="space-y-2.5">
                                {/* 1. 청결도 */}
                                <div className="p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl space-y-1">
                                    <span className="font-bold text-gray-500 dark:text-slate-400 block text-[11px]">
                                        1. 객실 청결도 이슈
                                    </span>
                                    {selectedCareSurvey.q1_cleanliness && selectedCareSurvey.q1_cleanliness.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {selectedCareSurvey.q1_cleanliness.map((c) => (
                                                <span
                                                    key={c}
                                                    className="px-2 py-0.5 rounded-md text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                                                >
                                                    {getCareLabel(c)}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                            이상 없음 (청결 만족)
                                        </span>
                                    )}
                                </div>

                                {/* 2. 시설/비품 */}
                                <div className="p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl space-y-1">
                                    <span className="font-bold text-gray-500 dark:text-slate-400 block text-[11px]">
                                        2. 시설 및 비품 이슈
                                    </span>
                                    {selectedCareSurvey.q2_facility && selectedCareSurvey.q2_facility.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {selectedCareSurvey.q2_facility.map((f) => (
                                                <span
                                                    key={f}
                                                    className="px-2 py-0.5 rounded-md text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
                                                >
                                                    {getCareLabel(f)}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                            이상 없음 (시설 만족)
                                        </span>
                                    )}
                                </div>

                                {/* 3. 환경/소음 */}
                                <div className="p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl space-y-1">
                                    <span className="font-bold text-gray-500 dark:text-slate-400 block text-[11px]">
                                        3. 주변 환경 및 소음 이슈
                                    </span>
                                    {selectedCareSurvey.q3_environment && selectedCareSurvey.q3_environment.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {selectedCareSurvey.q3_environment.map((e) => (
                                                <span
                                                    key={e}
                                                    className="px-2 py-0.5 rounded-md text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900"
                                                >
                                                    {getCareLabel(e)}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                            이상 없음 (환경 만족)
                                        </span>
                                    )}
                                </div>

                                {/* 4. 게스트 의견 원문 */}
                                <div className="p-3 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800 space-y-1">
                                    <span className="font-bold text-purple-800 dark:text-purple-300 block text-[11px]">
                                        💬 게스트 남긴 말씀 (원문)
                                    </span>
                                    <p className="font-bold text-sm text-gray-900 dark:text-slate-100 whitespace-pre-wrap">
                                        {selectedCareSurvey.q4_comment ? `"${selectedCareSurvey.q4_comment}"` : '별도 코멘트가 없습니다.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 모달 하단 버튼 */}
                        <div className="pt-2 flex items-center justify-between border-t border-gray-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    const shareText = `[게스트 케어 접수 알림]\n- 숙소: ${selectedCareSurvey.property_name} ${selectedCareSurvey.room_name}\n- 게스트: ${selectedCareSurvey.guest_name} (#${selectedCareSurvey.booking_id})\n- 투숙: ${selectedCareSurvey.check_in} ~ ${selectedCareSurvey.check_out}\n- 청결: ${selectedCareSurvey.q1_cleanliness && selectedCareSurvey.q1_cleanliness.length > 0 ? selectedCareSurvey.q1_cleanliness.map(getCareLabel).join(', ') : '이상없음'}\n- 시설: ${selectedCareSurvey.q2_facility && selectedCareSurvey.q2_facility.length > 0 ? selectedCareSurvey.q2_facility.map(getCareLabel).join(', ') : '이상없음'}\n- 환경: ${selectedCareSurvey.q3_environment && selectedCareSurvey.q3_environment.length > 0 ? selectedCareSurvey.q3_environment.map(getCareLabel).join(', ') : '이상없음'}\n- 코멘트: "${selectedCareSurvey.q4_comment || '없음'}"`;
                                    handleCopy(shareText, 'modal_share');
                                }}
                                className="px-3 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/60 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                {copiedText === 'modal_share' ? '공유 텍스트 복사됨!' : '팀 공유 텍스트 복사'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedCareSurvey(null)}
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
