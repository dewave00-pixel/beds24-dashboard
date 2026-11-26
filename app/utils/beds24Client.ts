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
export async function updateBeds24Booking(
    bookingId: number,
    updateFields: {
        roomId?: number;
        unitId?: number | null;
        notes?: string;
        departure?: string;
        arrival?: string;
        price?: number;
        status?: string;
    }
) {
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

/**
 * 🗑️ Beds24 예약 영구 삭제 함수
 * - Beds24 규칙: 활성 예약은 직접 삭제할 수 없으므로, 먼저 status: 'cancelled', price: 0 으로 전환 후 DELETE 호출
 */
export async function deleteBeds24Booking(bookingId: number) {
    const token = await getValidBeds24Token();

    // 1. 선 취소 및 금액 0원 처리 (Beds24 필수 요구조건)
    await updateBeds24Booking(bookingId, { status: 'cancelled', price: 0 });

    // 2. Beds24 API V2 DELETE 호출
    const url = `https://api.beds24.com/v2/bookings?id=${Number(bookingId)}`;
    let res = await fetch(url, {
        method: 'DELETE',
        headers: {
            token: token,
            accept: 'application/json',
        },
        cache: 'no-store',
    });

    if (res.status === 429) {
        console.warn('⚠️ [Beds24] 예약 삭제 429 감지 -> 2초 대기 후 재시도');
        await sleep(2000);
        res = await fetch(url, {
            method: 'DELETE',
            headers: {
                token: token,
                accept: 'application/json',
            },
            cache: 'no-store',
        });
    }

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Beds24 예약 삭제 실패 (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data;
}

export interface CreateBeds24BookingInput {
    roomId: number;
    unitId: number; // 호실 배정 시 고유 unitId(1, 2...), 미배정 등록 시 반드시 0
    arrival: string;
    departure: string;
    numAdult: number;
    status?: 'confirmed';
    firstName: string;
    lastName: string;
    mobile?: string;
    phone?: string;
    price: number;
    apiSourceId?: number;
    notes?: string;
}

export type CreateBeds24BookingResult =
    | {
          status: 'SUCCESS';
          bookingId: number;
          rawBooking: Record<string, unknown>;
          rawResponse: unknown;
      }
    | {
          status: 'AMBIGUOUS';
          error: string;
      }
    | {
          status: 'FAILED';
          error: string;
          details?: unknown;
      };

/**
 * ➕ Beds24 신규 예약 단일 안전 생성 함수 (중복 생성 방어를 위해 자동 재시도 금지)
 * - Beds24 API V2: POST https://api.beds24.com/v2/bookings
 * - 미배정 등록 시 unitId: 0 전달 필수
 * - 타임아웃/429/5xx 응답 시 자동 재호출하지 않고 status: 'AMBIGUOUS' 반환
 */
export async function createBeds24Booking(
    input: CreateBeds24BookingInput
): Promise<CreateBeds24BookingResult> {
    const token = await getValidBeds24Token();

    const payloadItem: Record<string, unknown> = {
        roomId: Number(input.roomId),
        unitId: Number(input.unitId),
        arrival: input.arrival,
        departure: input.departure,
        numAdult: Number(input.numAdult) || 1,
        status: input.status || 'confirmed',
        firstName: input.firstName,
        lastName: input.lastName,
        price: Math.round(Number(input.price) || 0),
        apiSourceId: input.apiSourceId ?? 0,
    };

    if (input.mobile) payloadItem.mobile = input.mobile;
    if (input.phone) payloadItem.phone = input.phone;
    if (input.notes) payloadItem.notes = input.notes;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
        res = await fetch('https://api.beds24.com/v2/bookings', {
            method: 'POST',
            headers: {
                token: token,
                'Content-Type': 'application/json',
                accept: 'application/json',
            },
            body: JSON.stringify([payloadItem]),
            cache: 'no-store',
            signal: controller.signal,
        });
    } catch (netErr: unknown) {
        clearTimeout(timeoutId);
        console.warn('⚠️ [createBeds24Booking] 통신 타임아웃/네트워크 오류 (중복 방지를 위해 재시도 중단):', netErr);
        return {
            status: 'AMBIGUOUS',
            error: 'Beds24 응답 지연으로 인해 중복 등록을 방지하고자 자동 재시도하지 않았습니다. Beds24 원본 캘린더를 먼저 확인해 주세요.',
        };
    } finally {
        clearTimeout(timeoutId);
    }

    if (res.status === 429 || res.status >= 500) {
        console.warn(`⚠️ [createBeds24Booking] HTTP ${res.status} 감지 (중복 방지를 위해 재시도 중단)`);
        return {
            status: 'AMBIGUOUS',
            error: 'Beds24 응답 지연으로 인해 중복 등록을 방지하고자 자동 재시도하지 않았습니다. Beds24 원본 캘린더를 먼저 확인해 주세요.',
        };
    }

    if (!res.ok) {
        const errText = await res.text();
        return {
            status: 'FAILED',
            error: `Beds24 예약 생성 실패 (HTTP ${res.status}): ${errText}`,
        };
    }

    let data: unknown;
    try {
        data = await res.json();
    } catch {
        return {
            status: 'AMBIGUOUS',
            error: 'Beds24 응답 파싱 중 오류가 발생했습니다. 중복 등록 방지를 위해 Beds24 원본 캘린더를 먼저 확인해 주세요.',
        };
    }

    const item = Array.isArray(data)
        ? (data[0] as Record<string, unknown> | undefined)
        : (data as { data?: Record<string, unknown>[] } | null)?.data?.[0] ?? (data as Record<string, unknown> | undefined);

    const errors = item?.errors as unknown[] | undefined;
    if (!item || item.success === false || (Array.isArray(errors) && errors.length > 0)) {
        const errMsg = Array.isArray(errors) && errors.length > 0
            ? errors.map((e) => (typeof e === 'string' ? e : JSON.stringify(e))).join(', ')
            : 'Beds24 본사에서 예약 생성을 거부했습니다.';
        return {
            status: 'FAILED',
            error: `Beds24 예약 생성 거부: ${errMsg}`,
            details: data,
        };
    }

    const newObj = (item.new as Record<string, unknown> | undefined)
        || (item.modified as Record<string, unknown> | undefined)
        || item;
    const bookingId = Number(newObj?.id || item.id || item.bookId || 0);

    if (!bookingId || bookingId <= 0) {
        return {
            status: 'FAILED',
            error: 'Beds24 응답에서 발급된 예약 ID(bookingId)를 확인할 수 없습니다.',
            details: data,
        };
    }

    return {
        status: 'SUCCESS',
        bookingId,
        rawBooking: newObj,
        rawResponse: data,
    };
}

export const ALL_BEDS24_PROPERTY_IDS = [267332, 265909, 269337, 269340, 269386, 269419, 267335];

/**
 * 📅 Beds24 일자별 객실 재고(Availability) 및 최저 요금(Price) 조회
 * - GET https://api.beds24.com/v2/inventory/rooms/calendar?propertyId={propId}&startDate={start}&endDate={end}&includeNumAvail=true&includePrices=true
 * - 반환 형식: Record<`${roomId}_${dateStr}`, { numAvail: number; price: number }>
 */
export async function fetchBeds24RoomCalendar(
    propertyIds: number[],
    startDate: string,
    endDate: string
): Promise<Record<string, { numAvail: number; price: number }>> {
    const token = await getValidBeds24Token();
    const inventoryMap: Record<string, { numAvail: number; price: number }> = {};

    const promises = propertyIds.map(async (propId) => {
        try {
            const url = `https://api.beds24.com/v2/inventory/rooms/calendar?propertyId=${propId}&startDate=${startDate}&endDate=${endDate}&includeNumAvail=true&includePrices=true`;
            let res = await fetch(url, {
                headers: { token, accept: 'application/json' },
                cache: 'no-store',
            });

            if (res.status === 429) {
                console.warn(`⚠️ [Beds24 Calendar] 숙소 ${propId} 429 감지 -> 2초 대기 후 재시도`);
                await sleep(2000);
                res = await fetch(url, {
                    headers: { token, accept: 'application/json' },
                    cache: 'no-store',
                });
            }

            if (!res.ok) {
                console.error(`⚠️ [Beds24 Calendar] 숙소 ${propId} 조회 실패 (${res.status})`);
                return;
            }

            interface CalendarEntry {
                from: string;
                to: string;
                numAvail?: number;
                price1?: number;
                price?: number;
            }
            interface RoomCalendarEntry {
                roomId: number;
                calendar?: CalendarEntry[];
            }

            const json = await res.json();
            if (json.data && Array.isArray(json.data)) {
                (json.data as RoomCalendarEntry[]).forEach((r) => {
                    const roomId = Number(r.roomId);
                    if (r.calendar && Array.isArray(r.calendar)) {
                        r.calendar.forEach((cal) => {
                            const numAvail = cal.numAvail !== undefined ? Number(cal.numAvail) : 1;
                            const price = Number(cal.price1 || cal.price || 0);

                            // cal.from부터 cal.to까지의 일자별로 매핑 (from~to 범위 전개)
                            const cur = new Date(cal.from);
                            const end = new Date(cal.to);
                            while (cur <= end) {
                                const dStr = cur.toISOString().split('T')[0];
                                inventoryMap[`${roomId}_${dStr}`] = { numAvail, price };
                                cur.setDate(cur.getDate() + 1);
                            }
                        });
                    }
                });
            }
        } catch (err: unknown) {
            console.error(`❌ [Beds24 Calendar Error] 숙소 ${propId}:`, err);
        }
    });

    await Promise.all(promises);
    return inventoryMap;
}