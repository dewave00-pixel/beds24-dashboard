// 📌 Beds24 API V2 통신 전담 모듈 (429 완전 방어 및 토큰 캐싱)

interface TokenCache {
    token: string | null;
    expiresAt: number;
}

// 서버 메모리에 토큰 보관
const tokenStore: TokenCache = {
    token: null,
    expiresAt: 0,
};

// 지연 대기 함수 (초과 요청 방지용)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 🔑 유효한 Beds24 액세스 토큰 가져오기
 */
export async function getValidBeds24Token(): Promise<string> {
    const now = Date.now();

    // 1. 기존 토큰이 유효하고 만료 5분 전이면 재사용 (Beds24 로그인 요청 0회)
    if (tokenStore.token && now < tokenStore.expiresAt - 5 * 60 * 1000) {
        return tokenStore.token;
    }

    const inviteCode = process.env.BEDS24_INVITE_CODE;
    const refreshToken = process.env.BEDS24_REFRESH_TOKEN;

    if (!inviteCode && !refreshToken) {
        throw new Error('❌ .env.local에 BEDS24_INVITE_CODE 또는 BEDS24_REFRESH_TOKEN이 설정되지 않았습니다.');
    }

    let res;

    if (refreshToken) {
        // Refresh Token 방식: GET 요청 및 header에 refreshToken 포함
        res = await fetch('https://api.beds24.com/v2/authentication/token', {
            method: 'GET',
            headers: {
                'refreshToken': refreshToken,
                'accept': 'application/json',
            },
            cache: 'no-store',
        });

        // 429 에러 방어
        if (res.status === 429) {
            console.warn('⚠️ [Beds24] 토큰 발급 429 감지 -> 2초 대기 후 1회 재시도합니다.');
            await sleep(2000);
            res = await fetch('https://api.beds24.com/v2/authentication/token', {
                method: 'GET',
                headers: {
                    'refreshToken': refreshToken,
                    'accept': 'application/json',
                },
                cache: 'no-store',
            });
        }
    } else {
        // Invite Code 방식: POST 요청 및 body에 code 포함
        res = await fetch('https://api.beds24.com/v2/authentication/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: inviteCode }),
            cache: 'no-store',
        });

        // 429 에러 방어
        if (res.status === 429) {
            console.warn('⚠️ [Beds24] 토큰 발급 429 감지 -> 2초 대기 후 1회 재시도합니다.');
            await sleep(2000);
            res = await fetch('https://api.beds24.com/v2/authentication/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: inviteCode }),
                cache: 'no-store',
            });
        }
    }

    if (res.status === 429) {
        throw new Error('Beds24 본사의 요청 한도(429)로 인해 일시적으로 잠겼습니다. 1~2분 후 자동으로 풀립니다.');
    }

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Beds24 토큰 발급 실패 (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const token = data.token || data.access_token;
    const expiresIn = data.expiresIn || data.expires_in || 3600;

    if (!token) {
        throw new Error('Beds24 응답에서 토큰을 찾을 수 없습니다.');
    }

    // 1시간 동안 메모리에 안전하게 재사용 보관
    tokenStore.token = token;
    tokenStore.expiresAt = now + expiresIn * 1000;

    return token;
}

/**
 * 📅 Beds24 예약 데이터 조회 함수
 */
export async function fetchBeds24Bookings(startDate?: string, endDate?: string) {
    const token = await getValidBeds24Token();

    const url = new URL('https://api.beds24.com/v2/bookings');
    if (startDate) url.searchParams.set('arrivalFrom', startDate);
    if (endDate) url.searchParams.set('departureTo', endDate);

    let res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            token: token,
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
    });

    // 예약 조회 중 429 발생 시 2초 대기 후 1회 재시도
    if (res.status === 429) {
        console.warn('⚠️ [Beds24] 예약 조회 429 감지 -> 2초 대기 후 1회 재시도합니다.');
        await sleep(2000);
        res = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                token: token,
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });
    }

    if (res.status === 429) {
        throw new Error('Beds24 본사의 예약 조회 한도(429)를 초과했습니다. 잠시 후 다시 시도해 주세요.');
    }

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Beds24 예약 조회 실패 (${res.status}): ${errText}`);
    }

    return await res.json();
}

/**
 * ✏️ Beds24 예약 정보 수정 함수 (호실/유닛 배정 변경 등)
 * - Beds24 API V2: POST https://api.beds24.com/v2/bookings 에 [{ id, roomId, unitId }] 전송
 */
export async function updateBeds24Booking(bookingId: number, updateFields: { roomId?: number; unitId?: number; notes?: string }) {
    const token = await getValidBeds24Token();

    const payload = [
        {
            id: Number(bookingId),
            ...updateFields,
        }
    ];

    let res = await fetch('https://api.beds24.com/v2/bookings', {
        method: 'POST',
        headers: {
            'token': token,
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    });

    if (res.status === 429) {
        console.warn('⚠️ [Beds24] 예약 수정 429 감지 -> 2초 대기 후 재시도');
        await sleep(2000);
        res = await fetch('https://api.beds24.com/v2/bookings', {
            method: 'POST',
            headers: {
                'token': token,
                'Content-Type': 'application/json',
                'accept': 'application/json',
            },
            body: JSON.stringify(payload),
            cache: 'no-store',
        });
    }

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Beds24 예약 수정 실패 (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data;
}