import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const roleCookie = req.cookies.get('auth_role');
    const role = roleCookie?.value;

    // 1. 정적 리소스, Next.js 내부 파일, 로그인 관련 API 및 로그인 페이지는 검사 없이 무조건 통과!
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.startsWith('/login') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // 2. 비로그인 사용자(쿠키 없음) -> 로그인 페이지로 이동
    if (!role) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    // 3. 스태프 계정 (staff_1 ~ staff_4): 오직 본인 청소 목록(/cleaning/my)만 허용
    if (role.startsWith('staff_')) {
        if (pathname !== '/cleaning/my') {
            return NextResponse.redirect(new URL('/cleaning/my', req.url));
        }
        return NextResponse.next();
    }

    // 4. 매니저 (manager): 청소 배정(/cleaning)만 접근 차단 -> 메인 대시보드로 이동
    if (role === 'manager' && pathname.startsWith('/cleaning')) {
        return NextResponse.redirect(new URL('/', req.url));
    }

    // 5. 최고관리자(admin) 및 매니저(manager)의 일반 페이지 접근 허용
    return NextResponse.next();
}

export const config = {
    // 모든 경로를 감시하되 정적 에셋은 제외
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};