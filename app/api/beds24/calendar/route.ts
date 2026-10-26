import { NextResponse } from 'next/server';
import { fetchBeds24RoomCalendar, ALL_BEDS24_PROPERTY_IDS } from '../../../utils/beds24Client';

export const dynamic = 'force-dynamic';

// ⏱️ 초고속 응답을 위한 서버 인메모리 단기 캐시 (5분)
interface CalendarCache {
    startDate: string;
    endDate: string;
    data: Record<string, { numAvail: number; price: number }>;
    timestamp: number;
}

let memoryCache: CalendarCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const today = new Date();
        const defaultStart = today.toISOString().split('T')[0];
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + 35);
        const defaultEnd = futureDate.toISOString().split('T')[0];

        const startDate = searchParams.get('startDate') || defaultStart;
        const endDate = searchParams.get('endDate') || defaultEnd;
        const forceRefresh = searchParams.get('refresh') === 'true';

        const now = Date.now();

        // 캐시 유효성 검사 (범위 포함 및 5분 이내)
        if (
            !forceRefresh &&
            memoryCache &&
            now - memoryCache.timestamp < CACHE_TTL_MS &&
            startDate >= memoryCache.startDate &&
            endDate <= memoryCache.endDate
        ) {
            return NextResponse.json({
                success: true,
                source: 'memory_cache',
                count: Object.keys(memoryCache.data).length,
                data: memoryCache.data,
            });
        }

        console.log(`📅 [Beds24 Calendar] 일자별 재고/요금 조회 실행: ${startDate} ~ ${endDate}`);
        const inventoryMap = await fetchBeds24RoomCalendar(ALL_BEDS24_PROPERTY_IDS, startDate, endDate);

        const combinedData = forceRefresh || !memoryCache
            ? inventoryMap
            : { ...memoryCache.data, ...inventoryMap };
        const combinedStart = forceRefresh || !memoryCache
            ? startDate
            : (startDate < memoryCache.startDate ? startDate : memoryCache.startDate);
        const combinedEnd = forceRefresh || !memoryCache
            ? endDate
            : (endDate > memoryCache.endDate ? endDate : memoryCache.endDate);

        memoryCache = {
            startDate: combinedStart,
            endDate: combinedEnd,
            data: combinedData,
            timestamp: now,
        };

        return NextResponse.json({
            success: true,
            source: 'beds24_api',
            count: Object.keys(inventoryMap).length,
            data: inventoryMap,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : '서버 내부 오류가 발생했습니다.';
        console.error('❌ [Beds24 Calendar Route Error]:', err);
        return NextResponse.json(
            { success: false, error: errorMsg },
            { status: 500 }
        );
    }
}
