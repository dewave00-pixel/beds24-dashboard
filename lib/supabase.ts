import { createClient } from '@supabase/supabase-js';

let _client: any = null;

function getClient() {
    if (!_client) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';
        _client = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
    }
    return _client;
}

// 중앙 DB 안전 통신 클라이언트 (서버 사이드 전용 - 지연 평가 Proxy로 env 로드 지연 완전 방어)
export const supabase = new Proxy({} as any, {
    get(_target, prop) {
        const client = getClient();
        const value = client[prop];
        return typeof value === 'function' ? value.bind(client) : value;
    },
});