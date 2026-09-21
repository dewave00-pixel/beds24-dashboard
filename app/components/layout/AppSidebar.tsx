'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { getStaffNameById } from '../../config';

interface AppSidebarProps {
    isMobileOpen: boolean;
    onCloseMobile: () => void;
    onToggleCollapse?: (collapsed: boolean) => void;
}

interface MenuItem {
    name: string;
    href: string;
    icon: string;
    badge?: string;
    roles: ('admin' | 'manager' | 'staff')[];
}

const MENU_ITEMS: MenuItem[] = [
    {
        name: '대시보드',
        href: '/',
        icon: '📊',
        roles: ['admin', 'manager'],
    },
    {
        name: '매출/통계',
        href: '/analytics',
        icon: '📈',
        roles: ['admin'],
    },
    {
        name: '청소 배정',
        href: '/cleaning',
        icon: '🧹',
        roles: ['admin'],
    },
    {
        name: '나의 청소',
        href: '/cleaning/my',
        icon: '🧹',
        roles: ['manager', 'staff'],
    },
    {
        name: '숙소/비번',
        href: '/properties',
        icon: '🔑',
        roles: ['admin', 'manager'],
    },
    {
        name: '체크인 관리',
        href: '/checkin',
        icon: '📋',
        roles: ['admin'],
    },
];

export default function AppSidebar({
    isMobileOpen,
    onCloseMobile,
    onToggleCollapse,
}: AppSidebarProps) {
    const pathname = usePathname();
    const { role, isAdmin, isManager, isStaff } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

    // 💾 사이드바 접힘 상태 localStorage에서 불러오기
    useEffect(() => {
        const saved = localStorage.getItem('sidebar_collapsed');
        if (saved !== null) {
            const collapsed = saved === 'true';
            setIsCollapsed(collapsed);
            onToggleCollapse?.(collapsed);
        }
    }, [onToggleCollapse]);

    const handleToggleCollapse = () => {
        const nextState = !isCollapsed;
        setIsCollapsed(nextState);
        localStorage.setItem('sidebar_collapsed', String(nextState));
        onToggleCollapse?.(nextState);
    };

    const handleLogout = async () => {
        if (!confirm('로그아웃 하시겠습니까?')) return;
        await fetch('/api/auth', { method: 'DELETE' });
        window.location.href = '/login';
    };

    // 현재 사용자 권한에 맞는 메뉴만 필터링
    const visibleMenuItems = MENU_ITEMS.filter((item) => {
        if (isAdmin && item.roles.includes('admin')) return true;
        if (isManager && item.roles.includes('manager')) return true;
        if (isStaff && item.roles.includes('staff')) return true;
        return false;
    });

    const currentStaffName = role ? getStaffNameById(role) : null;

    const getRoleBadge = () => {
        if (isAdmin) return { label: '👑 최고관리자', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
        if (isManager) return { label: `👔 ${currentStaffName || '소영매니저님'}`, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        if (isStaff) return { label: `🧹 ${currentStaffName || '청소 스태프'}`, color: 'bg-amber-100 text-amber-800 border-amber-200' };
        return { label: '게스트', color: 'bg-gray-100 text-gray-600 border-gray-200' };
    };

    const roleBadge = getRoleBadge();

    return (
        <>
            {/* 📱 모바일 배경 오버레이 (사이드바 열렸을 때) */}
            {isMobileOpen && (
                <div
                    onClick={onCloseMobile}
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden transition-opacity"
                />
            )}

            {/* 🧭 사이드바 메인 컨테이너 */}
            <aside
                className={`
                    fixed md:sticky top-0 left-0 z-50 h-screen bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 shadow-sm
                    flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0
                    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    ${isCollapsed ? 'md:w-16' : 'w-56'}
                `}
            >
                {/* 1. 상단: 로고 & 접기/펼치기 토글 버튼 */}
                <div className="p-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between min-h-[58px]">
                    {!isCollapsed ? (
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xl">🏨</span>
                            <div className="flex flex-col min-w-0">
                                <span className="font-black text-sm text-gray-900 dark:text-slate-100 tracking-tight truncate">
                                    숙소 운영 관리
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">
                                    Beds24 Dashboard
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full flex justify-center">
                            <span className="text-xl" title="숙소 운영 관리">🏨</span>
                        </div>
                    )}

                    {/* PC 전용 접기/펼치기 버튼 */}
                    <button
                        type="button"
                        onClick={handleToggleCollapse}
                        title={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                        className={`
                            hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold text-gray-500 dark:text-slate-400
                            hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white transition cursor-pointer
                            ${isCollapsed ? 'mx-auto' : ''}
                        `}
                    >
                        {isCollapsed ? '▶' : '◀'}
                    </button>

                    {/* 모바일 닫기 버튼 */}
                    <button
                        type="button"
                        onClick={onCloseMobile}
                        className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 font-black text-sm"
                    >
                        ✕
                    </button>
                </div>

                {/* 2. 중앙: 메뉴 목록 네비게이션 */}
                <nav className="p-2 flex-1 flex flex-col gap-1.5 overflow-y-auto">
                    {visibleMenuItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onCloseMobile}
                                title={isCollapsed ? item.name : undefined}
                                className={`
                                    flex items-center gap-3 rounded-xl transition duration-150 relative group
                                    ${isCollapsed ? 'justify-center p-2.5' : 'px-3.5 py-2.5'}
                                    ${isActive
                                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-black border border-blue-200 dark:border-blue-800 shadow-2xs'
                                        : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 font-bold'
                                    }
                                `}
                            >
                                <span className="text-lg shrink-0">{item.icon}</span>

                                {!isCollapsed && (
                                    <span className="text-xs tracking-tight truncate flex-1">
                                        {item.name}
                                    </span>
                                )}

                                {/* 접혔을 때 마우스 호버 시 툴팁(Tooltip) */}
                                {isCollapsed && (
                                    <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-900 text-white text-xs font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                                        {item.name}
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* 3. 하단: 사용자 권한 뱃지 & 테마 토글 & 로그아웃 버튼 */}
                <div className="p-2 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-1.5">
                    {!isCollapsed ? (
                        <div className="px-2 py-1.5 bg-gray-50 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700 flex items-center justify-between">
                            <span className={`text-[10.5px] font-black px-2 py-0.5 rounded-md border ${roleBadge.color}`}>
                                {roleBadge.label}
                            </span>
                        </div>
                    ) : (
                        <div className="flex justify-center py-1">
                            <span
                                className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs"
                                title={roleBadge.label}
                            />
                        </div>
                    )}

                    {/* 🌓 다크 / 라이트 모드 전환 토글 스위치 */}
                    <button
                        type="button"
                        onClick={toggleTheme}
                        role="switch"
                        aria-checked={theme === 'dark'}
                        title={isCollapsed ? (theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환') : undefined}
                        className={`
                            flex items-center rounded-xl transition cursor-pointer relative group select-none w-full
                            ${theme === 'dark'
                                ? 'text-slate-200 hover:bg-slate-800'
                                : 'text-gray-700 hover:bg-gray-100'
                            }
                            ${isCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2 text-xs font-bold'}
                        `}
                    >
                        {!isCollapsed ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-base">{theme === 'dark' ? '🌙' : '☀️'}</span>
                                    <span>{theme === 'dark' ? '다크 모드' : '라이트 모드'}</span>
                                </div>
                                <div
                                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out relative shrink-0 ${
                                        theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-300'
                                    }`}
                                >
                                    <div
                                        className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out flex items-center justify-center text-[9px] ${
                                            theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                                        }`}
                                    >
                                        {theme === 'dark' ? '🌙' : '☀️'}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="relative group/toggle flex items-center justify-center">
                                <div
                                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out relative shrink-0 ${
                                        theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-300'
                                    }`}
                                >
                                    <div
                                        className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out flex items-center justify-center text-[9px] ${
                                            theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                                        }`}
                                    >
                                        {theme === 'dark' ? '🌙' : '☀️'}
                                    </div>
                                </div>
                                <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-900 text-white text-xs font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover/toggle:opacity-100 transition-opacity z-50">
                                    {theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
                                </div>
                            </div>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handleLogout}
                        title={isCollapsed ? '로그아웃' : undefined}
                        className={`
                            flex items-center gap-3 rounded-xl text-gray-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer relative group
                            ${isCollapsed ? 'justify-center p-2.5' : 'px-3.5 py-2 text-xs font-bold'}
                        `}
                    >
                        <span className="text-base shrink-0">🚪</span>
                        {!isCollapsed && <span>로그아웃</span>}

                        {isCollapsed && (
                            <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-red-600 text-white text-xs font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                                로그아웃
                            </div>
                        )}
                    </button>
                </div>
            </aside>
        </>
    );
}
