'use client';

import { useEffect, useState, useRef } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';

export interface RealtimeChangeInfo {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    oldRecord: any;
    newRecord: any;
    timestamp: string;
}

interface UseRealtimeBookingsOptions {
    enabled?: boolean;
    onBookingChange?: (change: RealtimeChangeInfo) => void;
}

/**
 * ⚡ Supabase bookings 테이블의 실시간 변경(INSERT/UPDATE/DELETE)을 감지하는 커스텀 훅
 * 웹소켓(WebSocket)을 통해 화면 새로고침 없이 즉각 콜백을 실행합니다.
 */
export function useRealtimeBookings({
    enabled = true,
    onBookingChange,
}: UseRealtimeBookingsOptions = {}) {
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [lastChange, setLastChange] = useState<RealtimeChangeInfo | null>(null);
    const callbackRef = useRef(onBookingChange);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 최신 콜백 참조 유지
    useEffect(() => {
        callbackRef.current = onBookingChange;
    }, [onBookingChange]);

    useEffect(() => {
        if (!enabled) return;

        console.log('🔌 [Realtime] bookings 테이블 WebSocket 채널 연결 시도...');

        const channel = supabaseClient
            .channel('public:bookings')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bookings',
                },
                (payload) => {
                    const changeInfo: RealtimeChangeInfo = {
                        eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
                        table: payload.table,
                        oldRecord: payload.old,
                        newRecord: payload.new,
                        timestamp: new Date().toISOString(),
                    };

                    setLastChange(changeInfo);

                    // 🛡️ 디바운스: 연속으로 이벤트가 쏟아져 들어올 때 800ms 동안 모아서 마지막 1번만 실행
                    if (debounceTimerRef.current) {
                        clearTimeout(debounceTimerRef.current);
                    }

                    debounceTimerRef.current = setTimeout(() => {
                        console.log(`⚡ [Realtime 디바운스 실행] 최신 예약 변경 반영 (${changeInfo.eventType})`);
                        if (callbackRef.current) {
                            callbackRef.current(changeInfo);
                        }
                    }, 800);
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ [Realtime] bookings 테이블 WebSocket 연결 성공! (실시간 구독 중)');
                    setIsConnected(true);
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    console.warn(`⚠️ [Realtime] WebSocket 상태 변경: ${status}`, err || '');
                    setIsConnected(false);
                }
            });

        return () => {
            console.log('🔌 [Realtime] bookings 테이블 WebSocket 채널 해제');
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            supabaseClient.removeChannel(channel);
            setIsConnected(false);
        };
    }, [enabled]);

    return {
        isConnected,
        lastChange,
    };
}
