import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 📌 캐싱 방지: 항상 실시간으로 브라우저 쿠키 확인
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { password } = await req.json();

        const adminPw = process.env.ADMIN_PASSWORD || '1234';
        const managerPw = process.env.MANAGER_PASSWORD || '5678';
        const staff1Pw = process.env.STAFF_1_PASSWORD || '1313';
        const staff2Pw = process.env.STAFF_2_PASSWORD || '4646';
        const staff3Pw = process.env.STAFF_3_PASSWORD || '7979';
        const staff4Pw = process.env.STAFF_4_PASSWORD || '0101';

        let role: string | null = null;
        let redirectTo = '/';

        if (password === adminPw) {
            role = 'admin';
            redirectTo = '/';
        } else if (password === managerPw) {
            role = 'manager';
            redirectTo = '/';
        } else if (password === staff1Pw) {
            role = 'staff_1';
            redirectTo = '/cleaning/my';
        } else if (password === staff2Pw) {
            role = 'staff_2';
            redirectTo = '/cleaning/my';
        } else if (password === staff3Pw) {
            role = 'staff_3';
            redirectTo = '/cleaning/my';
        } else if (password === staff4Pw) {
            role = 'staff_4';
            redirectTo = '/cleaning/my';
        }

        if (!role) {
            return NextResponse.json(
                { success: false, message: '비밀번호가 올바르지 않습니다.' },
                { status: 401 }
            );
        }

        const response = NextResponse.json({
            success: true,
            role,
            redirectTo,
        });

        // 🍪 Next.js 표준 방식으로 쿠키 굽기
        response.cookies.set({
            name: 'auth_role',
            value: role,
            httpOnly: true,
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
            sameSite: 'lax',
        });

        return response;
    } catch (error) {
        return NextResponse.json(
            { success: false, message: '서버 인증 처리 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}

// 📌 [핵심 수정 타겟]: Next.js headers의 cookies()를 직접 읽어 완벽한 권한 반환
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
    const response = NextResponse.json({ success: true, message: '로그아웃 되었습니다.' });
    response.cookies.delete('auth_role');
    return response;
}