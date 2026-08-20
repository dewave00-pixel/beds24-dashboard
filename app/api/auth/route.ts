import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';

// 📌 캐싱 방지: 항상 실시간으로 브라우저 쿠키 확인
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { username, email, password } = await req.json();
        const inputId = (username || email || '').trim();

        if (!inputId || !password) {
            return NextResponse.json(
                { success: false, message: '아이디와 비밀번호를 모두 입력해 주세요.' },
                { status: 400 }
            );
        }

        // 아이디 형식 지원: @가 없으면 기본 도메인(@dewave.com) 자동 추가
        const loginEmail = inputId.includes('@') ? inputId : `${inputId.toLowerCase()}@dewave.com`;

        // 1. Supabase Auth로 로그인 시도
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password: password.trim(),
        });

        if (authError || !authData.user) {
            console.error('❌ [Supabase Auth Error]:', authError?.message);
            return NextResponse.json(
                { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
                { status: 401 }
            );
        }

        const user = authData.user;

        // 2. 기본 권한 및 목적지 결정 (아이디 접두사 기반 스마트 기본값)
        const cleanInputId = inputId.toLowerCase().split('@')[0];
        let role = 'staff_1';
        let userName = user.email ? user.email.split('@')[0] : '사용자';
        let redirectTo = '/cleaning/my';

        if (cleanInputId === 'admin') {
            role = 'admin';
            redirectTo = '/';
        } else if (cleanInputId === 'manager') {
            role = 'manager';
            redirectTo = '/';
        } else if (cleanInputId === 'staff1' || cleanInputId === 'staff_1') {
            role = 'staff_1';
            redirectTo = '/cleaning/my';
        } else if (cleanInputId === 'staff2' || cleanInputId === 'staff_2') {
            role = 'staff_2';
            redirectTo = '/cleaning/my';
        } else if (cleanInputId === 'staff3' || cleanInputId === 'staff_3') {
            role = 'staff_3';
            redirectTo = '/cleaning/my';
        } else if (cleanInputId === 'staff4' || cleanInputId === 'staff_4') {
            role = 'staff_4';
            redirectTo = '/cleaning/my';
        }

        // 3. user_profiles 테이블에 커스텀 설정이 있으면 최우선 적용
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('name, role, staff_id')
            .eq('id', user.id)
            .maybeSingle();

        if (profile) {
            userName = profile.name || userName;
            if (profile.role === 'admin') {
                role = 'admin';
                redirectTo = '/';
            } else if (profile.role === 'manager') {
                role = 'manager';
                redirectTo = '/';
            } else if (profile.staff_id) {
                role = profile.staff_id;
                redirectTo = '/cleaning/my';
            } else if (profile.role.startsWith('staff_')) {
                role = profile.role;
                redirectTo = '/cleaning/my';
            }
        }

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: userName,
                role,
            },
            role,
            redirectTo,
        });

        // 3. Next.js 표준 방식으로 권한 쿠키 발급
        response.cookies.set({
            name: 'auth_role',
            value: role,
            httpOnly: true,
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7일 유지
            sameSite: 'lax',
        });

        return response;
    } catch (error) {
        console.error('❌ [Auth POST Exception]:', error);
        return NextResponse.json(
            { success: false, message: '서버 인증 처리 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}

// 📌 현재 로그인 상태 및 권한 조회
export async function GET() {
    try {
        const cookieStore = await cookies();
        const roleCookie = cookieStore.get('auth_role');
        const role = roleCookie?.value;

        if (!role) {
            return NextResponse.json({ isAuthenticated: false, role: null }, { status: 401 });
        }

        return NextResponse.json({ isAuthenticated: true, role });
    } catch (error) {
        return NextResponse.json({ isAuthenticated: false, role: null }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        await supabase.auth.signOut();
    } catch (err) {
        // 무시
    }
    const response = NextResponse.json({ success: true, message: '로그아웃 되었습니다.' });
    response.cookies.delete('auth_role');
    return response;
}
