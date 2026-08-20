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

        // 아이디 형식 지원: @가 없으면 기본 도메인(@dewave.local) 자동 추가
        const loginEmail = inputId.includes('@') ? inputId : `${inputId.toLowerCase()}@dewave.local`;

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

        // 2. user_profiles 테이블에서 사용자 역할(Role) 및 스태프 ID 조회
        let role = 'staff_1';
        let userName = user.email ? user.email.split('@')[0] : '사용자';
        let redirectTo = '/cleaning/my';

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
            } else {
                // 스태프일 경우 profile.staff_id (e.g. 'staff_1', 'staff_2') 또는 'staff_1'
                role = profile.staff_id || 'staff_1';
                redirectTo = '/cleaning/my';
            }
        } else {
            // 프로필이 아직 생성 안 된 경우 이메일 메타데이터 확인
            const metaRole = user.user_metadata?.role;
            const metaStaffId = user.user_metadata?.staff_id;
            if (metaRole === 'admin') {
                role = 'admin';
                redirectTo = '/';
            } else if (metaRole === 'manager') {
                role = 'manager';
                redirectTo = '/';
            } else if (metaStaffId) {
                role = metaStaffId;
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