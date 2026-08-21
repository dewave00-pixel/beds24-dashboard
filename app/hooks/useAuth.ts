'use client';

import { useState, useEffect } from 'react';

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

export function useAuth() {
    const [role, setRole] = useState<string | null>(() => getCookie('auth_role'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 클라이언트 쿠키 즉시 동기화
        const initialCookieRole = getCookie('auth_role');
        if (initialCookieRole) {
            setRole(initialCookieRole);
        }

        console.log('🚀 [useAuth] 1. 서버에 로그인 권한 확인 요청 중...');

        fetch('/api/auth', { cache: 'no-store' })
            .then(async (res) => {
                const data = await res.json();
                console.log('📡 [useAuth] 2. 서버 응답 결과:', res.status, data);

                if (res.ok && data.isAuthenticated && data.role) {
                    console.log('🔑 [useAuth] 3. 확인된 최종 권한:', data.role);
                    setRole(data.role);
                } else {
                    console.log('⚠️ [useAuth] 3. 로그인 권한 없음 (비로그인 상태)');
                    setRole(null);
                }
            })
            .catch((err) => {
                console.error('❌ [useAuth] 서버 통신 에러:', err);
                setRole(null);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    return {
        role,
        isAdmin: role === 'admin',
        isManager: role === 'manager',
        isStaff: role ? role.startsWith('staff_') : false,
        canViewMyCleaning: role === 'manager' || (role ? role.startsWith('staff_') : false),
        loading,
    };
}