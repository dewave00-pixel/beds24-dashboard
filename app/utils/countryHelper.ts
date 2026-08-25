// 🌍 게스트 국적 & 언어 식별 전담 헬퍼 모듈

import { Booking } from '../types';

export interface CountryInfo {
    code: string;
    name: string;
    flag: string;
    color: string;
}

// 국가별 마스터 매핑 테이블
const COUNTRY_MAP: Record<string, { name: string; flag: string; color: string }> = {
    // 동아시아
    'TW': { name: '대만', flag: '🇹🇼', color: '#E11D48' },
    'JP': { name: '일본', flag: '🇯🇵', color: '#EF4444' },
    'KR': { name: '한국', flag: '🇰🇷', color: '#2563EB' },
    'HK': { name: '홍콩', flag: '🇭🇰', color: '#F59E0B' },
    'CN': { name: '중국', flag: '🇨🇳', color: '#DC2626' },
    'MO': { name: '마카오', flag: '🇲🇴', color: '#D97706' },

    // 동남아시아
    'SG': { name: '싱가포르', flag: '🇸🇬', color: '#059669' },
    'MY': { name: '말레이시아', flag: '🇲🇾', color: '#0D9488' },
    'TH': { name: '태국', flag: '🇹🇭', color: '#CA8A04' },
    'ID': { name: '인도네시아', flag: '🇮🇩', color: '#EA580C' },
    'PH': { name: '필리핀', flag: '🇵🇭', color: '#0284C7' },
    'VN': { name: '베트남', flag: '🇻🇳', color: '#EAB308' },

    // 북미 & 오세아니아
    'US': { name: '미국', flag: '🇺🇸', color: '#4F46E5' },
    'CA': { name: '캐나다', flag: '🇨🇦', color: '#E02424' },
    'AU': { name: '호주', flag: '🇦🇺', color: '#0284C7' },
    'NZ': { name: '뉴질랜드', flag: '🇳🇿', color: '#0369A1' },

    // 유럽
    'GB': { name: '영국', flag: '🇬🇧', color: '#4338CA' },
    'FR': { name: '프랑스', flag: '🇫🇷', color: '#6366F1' },
    'DE': { name: '독일', flag: '🇩🇪', color: '#7C3AED' },
    'IT': { name: '이탈리아', flag: '🇮🇹', color: '#16A34A' },
    'ES': { name: '스페인', flag: '🇪🇸', color: '#F97316' },
    'NL': { name: '네덜란드', flag: '🇳🇱', color: '#FB923C' },
    'PL': { name: '폴란드', flag: '🇵🇱', color: '#E11D48' },
    'CZ': { name: '체코', flag: '🇨🇿', color: '#3B82F6' },
    'HU': { name: '헝가리', flag: '🇭🇺', color: '#10B981' },
    'LT': { name: '리투아니아', flag: '🇱🇹', color: '#EAB308' },

    // 기타
    'IN': { name: '인도', flag: '🇮🇳', color: '#F97316' },
    'QA': { name: '카타르', flag: '🇶🇦', color: '#881337' },
    'CL': { name: '칠레', flag: '🇨🇱', color: '#DC2626' },
};

/**
 * 예약 객체를 분석하여 가장 정확한 게스트 국적 정보를 반환
 */
export function getGuestCountryInfo(booking: Booking): CountryInfo {
    const rawCountry = (booking.country || '').trim().toUpperCase();
    const phone = (booking.phone || booking.mobile || '').trim();
    const lang = (booking.lang || '').trim().toLowerCase();

    // 1. 직접 국가 코드 매핑 (예: TW, KR, JP, US 등)
    if (rawCountry && COUNTRY_MAP[rawCountry]) {
        const info = COUNTRY_MAP[rawCountry];
        return { code: rawCountry, name: info.name, flag: info.flag, color: info.color };
    }

    // 영문 전체 국가명 매핑
    if (rawCountry.includes('KOREA') || rawCountry === 'KO' || rawCountry === 'KOR') {
        return { code: 'KR', name: '한국', flag: '🇰🇷', color: '#2563EB' };
    }
    if (rawCountry.includes('TAIWAN')) {
        return { code: 'TW', name: '대만', flag: '🇹🇼', color: '#E11D48' };
    }
    if (rawCountry.includes('JAPAN')) {
        return { code: 'JP', name: '일본', flag: '🇯🇵', color: '#EF4444' };
    }
    if (rawCountry.includes('UNITED STATES') || rawCountry === 'USA') {
        return { code: 'US', name: '미국', flag: '🇺🇸', color: '#4F46E5' };
    }
    if (rawCountry.includes('CHINA') || rawCountry === 'ZH') {
        return { code: 'CN', name: '중국/중화권', flag: '🇨🇳', color: '#DC2626' };
    }
    if (rawCountry.includes('SINGAPORE')) {
        return { code: 'SG', name: '싱가포르', flag: '🇸🇬', color: '#059669' };
    }
    if (rawCountry.includes('MALAYSIA')) {
        return { code: 'MY', name: '말레이시아', flag: '🇲🇾', color: '#0D9488' };
    }
    if (rawCountry.includes('THAILAND')) {
        return { code: 'TH', name: '태국', flag: '🇹🇭', color: '#CA8A04' };
    }
    if (rawCountry.includes('AUSTRALIA')) {
        return { code: 'AU', name: '호주', flag: '🇦🇺', color: '#0284C7' };
    }

    // 2. 전화번호 국가번호(Calling Code) 분석
    if (phone.startsWith('+886')) return { code: 'TW', name: '대만', flag: '🇹🇼', color: '#E11D48' };
    if (phone.startsWith('+82')) return { code: 'KR', name: '한국', flag: '🇰🇷', color: '#2563EB' };
    if (phone.startsWith('+81')) return { code: 'JP', name: '일본', flag: '🇯🇵', color: '#EF4444' };
    if (phone.startsWith('+852')) return { code: 'HK', name: '홍콩', flag: '🇭🇰', color: '#F59E0B' };
    if (phone.startsWith('+86')) return { code: 'CN', name: '중국', flag: '🇨🇳', color: '#DC2626' };
    if (phone.startsWith('+65')) return { code: 'SG', name: '싱가포르', flag: '🇸🇬', color: '#059669' };
    if (phone.startsWith('+60')) return { code: 'MY', name: '말레이시아', flag: '🇲🇾', color: '#0D9488' };
    if (phone.startsWith('+66')) return { code: 'TH', name: '태국', flag: '🇹🇭', color: '#CA8A04' };
    if (phone.startsWith('+62')) return { code: 'ID', name: '인도네시아', flag: '🇮🇩', color: '#EA580C' };
    if (phone.startsWith('+1')) return { code: 'US', name: '미국/캐나다', flag: '🇺🇸', color: '#4F46E5' };
    if (phone.startsWith('+61')) return { code: 'AU', name: '호주', flag: '🇦🇺', color: '#0284C7' };
    if (phone.startsWith('+33')) return { code: 'FR', name: '프랑스', flag: '🇫🇷', color: '#6366F1' };

    // 3. 사용 언어(lang) 분석
    if (lang === 'zh') return { code: 'TW', name: '중화권/대만', flag: '🇹🇼', color: '#E11D48' };
    if (lang === 'ko') return { code: 'KR', name: '한국', flag: '🇰🇷', color: '#2563EB' };
    if (lang === 'ja') return { code: 'JP', name: '일본', flag: '🇯🇵', color: '#EF4444' };
    if (lang === 'th') return { code: 'TH', name: '태국', flag: '🇹🇭', color: '#CA8A04' };

    // 4. 식별 불가 시 기타/미기재
    return {
        code: 'OTHER',
        name: '기타/미기재',
        flag: '🌐',
        color: '#64748B',
    };
}
