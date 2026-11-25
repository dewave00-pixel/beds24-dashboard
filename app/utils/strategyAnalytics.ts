import { Booking } from '../types';
import { ALL_UNITS } from '../config';
import {
    calculateNetPayout,
    getBookingDateKST,
    getUnitForBooking,
    isRevenueBooking,
} from './bookingUtils';
import { addDaysToDateStr, getKSTTodayStr } from './dateUtils';
import type { StrategyEventItem } from '../api/strategy/route';
import type { OperatingExpenseItem } from '../api/expenses/route';

export interface StrategyAdCharge {
    chargeDate: string;
    targetProperty: string;
    apiSourceId: number;
    amount: number;
}

export interface LeadWindowBucket {
    key: 'd29_plus' | 'd15_28' | 'd8_14' | 'd2_7' | 'd0_1';
    label: string;
    desc: string;
    bookingsCount: number;
    totalNights: number;
    oneNightCount: number;
    oneNightSharePct: number;
    weekendOneNightCount: number;
    avgAdr: number;
    avgStayNights: number;
    totalRevenue: number;
}

export interface Property28DaySummary {
    propName: string;
    d29PlusAdr: number;
    d28InsideAdr: number;
    adrDropPct: number;
    d28InsideNights: number;
    d28OneNightSharePct: number;
    weekendSplitCount: number;
}

export interface StrategyRecommendation {
    id: string;
    severity: 'high' | 'medium' | 'good';
    category: '1박 오픈 룰' | '28일 가격 인하' | '광고/프로모션' | '스냅샷 점검';
    propertyName: string;
    title: string;
    evidence: string;
    actionText: string;
    suggestedSourceType: StrategyEventItem['sourceType'];
    suggestedTitle: string;
}

export interface EventPerformanceComparison {
    beforeDays: number;
    afterDays: number;
    beforePickupPerDay: number;
    afterPickupPerDay: number;
    pickupDiffPct: number;
    beforeAdr: number;
    afterAdr: number;
    adrDiffPct: number;
    beforeRevPerDay: number;
    afterRevPerDay: number;
    beforeProfitPerDay: number;
    afterProfitPerDay: number;
    verdict: 'good' | 'caution' | 'bad' | 'pending';
    verdictLabel: string;
}

function diffDaysUTC(startStr: string, endStr: string): number {
    if (!startStr || !endStr) return 0;
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    if (!sy || !sm || !sd || !ey || !em || !ed) return 0;
    return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000);
}

export function analyze28DayWindowAndOneNight(
    bookings: Booking[],
    propertyFilter: string = 'all'
): {
    buckets: LeadWindowBucket[];
    propertySummaries: Property28DaySummary[];
    totalAnalyzed: number;
} {
    const bucketDefs: {
        key: LeadWindowBucket['key'];
        label: string;
        desc: string;
        minLead: number;
        maxLead: number;
    }[] = [
        { key: 'd29_plus', label: 'D-29 이전', desc: '정상가 · 2박+ 구간', minLead: 29, maxLead: 9999 },
        { key: 'd15_28', label: 'D-15 ~ D-28', desc: '28일 룰 시작 구간', minLead: 15, maxLead: 28 },
        { key: 'd8_14', label: 'D-8 ~ D-14', desc: '중단기 할인 구간', minLead: 8, maxLead: 14 },
        { key: 'd2_7', label: 'D-2 ~ D-7', desc: '직전 임박 구간', minLead: 2, maxLead: 7 },
        { key: 'd0_1', label: 'D-0 ~ D-1', desc: '당일 · 전일 임박', minLead: 0, maxLead: 1 },
    ];

    const accum = new Map<
        LeadWindowBucket['key'],
        { count: number; nights: number; oneNight: number; weekendOneNight: number; rev: number }
    >();
    for (const def of bucketDefs) {
        accum.set(def.key, { count: 0, nights: 0, oneNight: 0, weekendOneNight: 0, rev: 0 });
    }

    const propAccum = new Map<
        string,
        {
            d29Nights: number;
            d29Rev: number;
            d28Nights: number;
            d28Rev: number;
            d28Count: number;
            d28OneNight: number;
            weekendSplit: number;
        }
    >();
    for (const prop of ['WAVE', 'YEONNAM', 'Green', 'Horang']) {
        propAccum.set(prop, {
            d29Nights: 0,
            d29Rev: 0,
            d28Nights: 0,
            d28Rev: 0,
            d28Count: 0,
            d28OneNight: 0,
            weekendSplit: 0,
        });
    }

    let totalAnalyzed = 0;

    for (const b of bookings) {
        if (!isRevenueBooking(b)) continue;
        if ((b.status || '').toLowerCase().trim() === 'cancelled') continue;

        const unit = getUnitForBooking(b);
        if (!unit) continue;
        const propName = unit.propName || '기타';
        if (propertyFilter !== 'all' && propName !== propertyFilter) continue;

        const bookedDate = getBookingDateKST(b.bookingTime, b.arrival);
        if (!bookedDate || !b.arrival || !b.departure) continue;

        const leadDays = Math.max(0, diffDaysUTC(bookedDate, b.arrival));
        const nights = Math.max(1, diffDaysUTC(b.arrival, b.departure));
        const net = calculateNetPayout(
            Number(b.price) || 0,
            b.apiSourceId,
            0,
            b.bookingTime,
            b.roomId,
            Boolean(b.isChicken)
        );

        totalAnalyzed++;

        const matchedDef =
            bucketDefs.find((d) => leadDays >= d.minLead && leadDays <= d.maxLead) || bucketDefs[0];
        const bucket = accum.get(matchedDef.key)!;

        const [ay, am, ad] = b.arrival.split('-').map(Number);
        const arrivalDow = new Date(Date.UTC(ay, am - 1, ad)).getUTCDay(); // 5: 금, 6: 토
        const isWeekendOneNight = nights === 1 && (arrivalDow === 5 || arrivalDow === 6);

        bucket.count += 1;
        bucket.nights += nights;
        if (nights === 1) bucket.oneNight += 1;
        if (isWeekendOneNight) bucket.weekendOneNight += 1;
        bucket.rev += net;

        const pStat = propAccum.get(propName);
        if (pStat) {
            if (leadDays >= 29) {
                pStat.d29Nights += nights;
                pStat.d29Rev += net;
            } else {
                pStat.d28Nights += nights;
                pStat.d28Rev += net;
                pStat.d28Count += 1;
                if (nights === 1) pStat.d28OneNight += 1;
                if (isWeekendOneNight && leadDays >= 15) pStat.weekendSplit += 1;
            }
        }
    }

    const buckets: LeadWindowBucket[] = bucketDefs.map((def) => {
        const a = accum.get(def.key)!;
        return {
            key: def.key,
            label: def.label,
            desc: def.desc,
            bookingsCount: a.count,
            totalNights: a.nights,
            oneNightCount: a.oneNight,
            oneNightSharePct: a.count > 0 ? Math.round((a.oneNight / a.count) * 1000) / 10 : 0,
            weekendOneNightCount: a.weekendOneNight,
            avgAdr: a.nights > 0 ? Math.round(a.rev / a.nights) : 0,
            avgStayNights: a.count > 0 ? Math.round((a.nights / a.count) * 10) / 10 : 0,
            totalRevenue: Math.round(a.rev),
        };
    });

    const propertySummaries: Property28DaySummary[] = Array.from(propAccum.entries()).map(([propName, p]) => {
        const d29PlusAdr = p.d29Nights > 0 ? Math.round(p.d29Rev / p.d29Nights) : 0;
        const d28InsideAdr = p.d28Nights > 0 ? Math.round(p.d28Rev / p.d28Nights) : 0;
        const adrDropPct =
            d29PlusAdr > 0 && d28InsideAdr > 0
                ? Math.round(((d28InsideAdr - d29PlusAdr) / d29PlusAdr) * 1000) / 10
                : 0;
        return {
            propName,
            d29PlusAdr,
            d28InsideAdr,
            adrDropPct,
            d28InsideNights: p.d28Nights,
            d28OneNightSharePct: p.d28Count > 0 ? Math.round((p.d28OneNight / p.d28Count) * 1000) / 10 : 0,
            weekendSplitCount: p.weekendSplit,
        };
    });

    return { buckets, propertySummaries, totalAnalyzed };
}

export function evaluateStrategyEvent(
    event: StrategyEventItem,
    bookings: Booking[],
    adCharges: StrategyAdCharge[],
    expenses: OperatingExpenseItem[]
): EventPerformanceComparison {
    const todayStr = getKSTTodayStr();
    const compareDays = Math.max(7, event.compareDays || 14);
    const beforeStart = addDaysToDateStr(event.eventDate, -compareDays);
    const beforeEnd = addDaysToDateStr(event.eventDate, -1);

    const maxAfterEnd = addDaysToDateStr(event.eventDate, compareDays - 1);
    const rawAfterEnd = event.endDate && event.endDate < maxAfterEnd ? event.endDate : maxAfterEnd;
    const afterEnd = rawAfterEnd > todayStr ? todayStr : rawAfterEnd;
    const actualAfterDays = Math.max(0, diffDaysUTC(event.eventDate, afterEnd) + 1);

    if (event.eventDate > todayStr || actualAfterDays < 3) {
        return {
            beforeDays: compareDays,
            afterDays: actualAfterDays,
            beforePickupPerDay: 0,
            afterPickupPerDay: 0,
            pickupDiffPct: 0,
            beforeAdr: 0,
            afterAdr: 0,
            adrDiffPct: 0,
            beforeRevPerDay: 0,
            afterRevPerDay: 0,
            beforeProfitPerDay: 0,
            afterProfitPerDay: 0,
            verdict: 'pending',
            verdictLabel: `⏳ 데이터 수집 중 (${actualAfterDays}/${compareDays}일)`,
        };
    }

    const calcWindow = (winStart: string, winEnd: string, numDays: number) => {
        let nights = 0;
        let rev = 0;

        for (const b of bookings) {
            if (!isRevenueBooking(b)) continue;
            if ((b.status || '').toLowerCase().trim() === 'cancelled') continue;
            const unit = getUnitForBooking(b);
            if (!unit) continue;
            if (event.propertyName !== 'all' && unit.propName !== event.propertyName) continue;
            if (event.channelId && Number(b.apiSourceId) !== Number(event.channelId)) continue;

            const bookedDate = getBookingDateKST(b.bookingTime, b.arrival);
            if (bookedDate < winStart || bookedDate > winEnd) continue;

            const stayNights = Math.max(1, diffDaysUTC(b.arrival, b.departure));
            const net = calculateNetPayout(
                Number(b.price) || 0,
                b.apiSourceId,
                0,
                b.bookingTime,
                b.roomId,
                Boolean(b.isChicken)
            );
            nights += stayNights;
            rev += net;
        }

        let adCost = 0;
        for (const c of adCharges) {
            if (c.chargeDate < winStart || c.chargeDate > winEnd) continue;
            if (event.propertyName !== 'all' && c.targetProperty !== 'all' && c.targetProperty !== event.propertyName) {
                continue;
            }
            if (event.channelId && Number(c.apiSourceId) !== Number(event.channelId)) continue;
            adCost += Number(c.amount) || 0;
        }

        let opCost = 0;
        const propUnitsCount =
            event.propertyName === 'all'
                ? ALL_UNITS.length
                : ALL_UNITS.filter((u) => u.propName === event.propertyName).length;

        for (const e of expenses) {
            if (e.expenseDate < winStart || e.expenseDate > winEnd) continue;
            if (e.propertyName === 'all') {
                opCost += Math.round(((Number(e.amount) || 0) * propUnitsCount) / Math.max(1, ALL_UNITS.length));
            } else if (event.propertyName === 'all' || e.propertyName === event.propertyName) {
                opCost += Number(e.amount) || 0;
            }
        }

        const pickupPerDay = Math.round((nights / numDays) * 10) / 10;
        const adr = nights > 0 ? Math.round(rev / nights) : 0;
        const revPerDay = Math.round(rev / numDays);
        const profitPerDay = Math.round((rev - adCost - opCost) / numDays);

        return { pickupPerDay, adr, revPerDay, profitPerDay };
    };

    const before = calcWindow(beforeStart, beforeEnd, compareDays);
    const after = calcWindow(event.eventDate, afterEnd, actualAfterDays);

    const pickupDiffPct =
        before.pickupPerDay > 0
            ? Math.round(((after.pickupPerDay - before.pickupPerDay) / before.pickupPerDay) * 1000) / 10
            : 0;
    const adrDiffPct =
        before.adr > 0 ? Math.round(((after.adr - before.adr) / before.adr) * 1000) / 10 : 0;

    let verdict: EventPerformanceComparison['verdict'] = 'caution';
    let verdictLabel = '🟡 보합 / 관찰 필요';

    if (after.profitPerDay > before.profitPerDay && after.pickupPerDay >= before.pickupPerDay) {
        verdict = 'good';
        verdictLabel = '🟢 성과 우수 (유지 권장)';
    } else if (after.profitPerDay < before.profitPerDay * 0.9 && after.pickupPerDay <= before.pickupPerDay) {
        verdict = 'bad';
        verdictLabel = '🔴 역효과 (롤백/조정 권장)';
    } else if (adrDiffPct <= -10 && after.revPerDay <= before.revPerDay) {
        verdict = 'caution';
        verdictLabel = '🟡 ADR 하락 주의';
    }

    return {
        beforeDays: compareDays,
        afterDays: actualAfterDays,
        beforePickupPerDay: before.pickupPerDay,
        afterPickupPerDay: after.pickupPerDay,
        pickupDiffPct,
        beforeAdr: before.adr,
        afterAdr: after.adr,
        adrDiffPct,
        beforeRevPerDay: before.revPerDay,
        afterRevPerDay: after.revPerDay,
        beforeProfitPerDay: before.profitPerDay,
        afterProfitPerDay: after.profitPerDay,
        verdict,
        verdictLabel,
    };
}

export function generateStrategyRecommendations(
    analysis: { buckets: LeadWindowBucket[]; propertySummaries: Property28DaySummary[] },
    snapshotCount: number
): StrategyRecommendation[] {
    const recs: StrategyRecommendation[] = [];

    const d15_28 = analysis.buckets.find((b) => b.key === 'd15_28');
    const d29Plus = analysis.buckets.find((b) => b.key === 'd29_plus');

    // 1. 건물별 28일 이내 1박 오픈 & 주말 단절 점검
    for (const p of analysis.propertySummaries) {
        if (p.weekendSplitCount >= 2) {
            recs.push({
                id: `split-${p.propName}`,
                severity: 'high',
                category: '1박 오픈 룰',
                propertyName: p.propName,
                title: `${p.propName}: 28일 기준 1박 오픈이 주말 연박을 끊고 있음`,
                evidence: `D-15~28 구간에 들어온 금/토 1박 예약이 ${p.weekendSplitCount}건 감지되었습니다 (28일 이내 1박 비중 ${p.d28OneNightSharePct}%).`,
                actionText:
                    'PriceLabs에서 1박 전면 오픈 시점을 28일 → 14일(또는 7일)로 늦추고, 15~28일 구간은 연박 사이 빈 날(Orphan day)만 1박 허용으로 변경 테스트를 권장합니다.',
                suggestedSourceType: 'pricelabs',
                suggestedTitle: `${p.propName} 1박 전면 오픈 D-28 → D-14 축소 (고아데이만 1박)`,
            });
        }

        if (p.adrDropPct <= -18 && p.d28InsideNights >= 10) {
            recs.push({
                id: `drop-${p.propName}`,
                severity: 'medium',
                category: '28일 가격 인하',
                propertyName: p.propName,
                title: `${p.propName}: 28일 이내 Last-minute ADR 하락폭 큼 (${p.adrDropPct}%)`,
                evidence: `D-29 이전 평균 ADR ₩${p.d29PlusAdr.toLocaleString()} → D-28 이내 ₩${p.d28InsideAdr.toLocaleString()}로 하락했습니다.`,
                actionText:
                    '초기 Last-minute 할인(D-28~15) 폭을 줄이거나 최저가(Min Price)를 +5~10% 상향해 공실 방어와 객단가 균형을 테스트해 보세요.',
                suggestedSourceType: 'pricelabs',
                suggestedTitle: `${p.propName} Last-minute 할인율 완화 및 Min Price 상향`,
            });
        }
    }

    // 2. 전체 D-15~28 1박 비중 점검
    if (d15_28 && d29Plus && d15_28.oneNightSharePct >= 40 && d15_28.bookingsCount >= 5) {
        recs.push({
            id: 'global-1night-ratio',
            severity: 'medium',
            category: '1박 오픈 룰',
            propertyName: 'all',
            title: `전체 D-15~28 구간 1박 예약 비중이 ${d15_28.oneNightSharePct}%로 높음`,
            evidence: `해당 구간 ${d15_28.bookingsCount}건 중 ${d15_28.oneNightCount}건이 1박 예약이며, 평균 ADR은 ₩${d15_28.avgAdr.toLocaleString()}입니다.`,
            actionText:
                '청소·세탁 회전 비용을 고려해 D-15~28 구간은 2박 이상 우선 받고, 1박 예약에는 소폭 할증(또는 청소비 반영) 또는 D-10 이후 오픈을 검토하세요.',
            suggestedSourceType: 'pricelabs',
            suggestedTitle: '전체 숙소 1박 오픈 시점 D-28 → D-10~14 조정',
        });
    }

    // 3. 스냅샷 수집 안내
    if (snapshotCount === 0) {
        recs.push({
            id: 'snapshot-init',
            severity: 'good',
            category: '스냅샷 점검',
            propertyName: 'all',
            title: 'Beds24 90일 판매가·최소박수(minStay) 스냅샷 첫 수집 권장',
            evidence: '아직 적재된 일별 가격/최소박수 스냅샷이 없어 가격 탄력성 추적을 시작할 시점입니다.',
            actionText:
                '아래 [지금 스냅샷 수동 수집] 버튼을 한 번 눌러 오늘 기준 향후 90일 가격·최소박수를 저장하면, 이후 매일 새벽 자동 누적됩니다.',
            suggestedSourceType: 'beds24',
            suggestedTitle: 'Beds24 90일 판매가·최소박수 스냅샷 추적 시작',
        });
    }

    if (recs.length === 0) {
        recs.push({
            id: 'healthy',
            severity: 'good',
            category: '28일 가격 인하',
            propertyName: 'all',
            title: '현재 28일 기준 가격 인하 및 1박 오픈 흐름이 안정적입니다',
            evidence: `총 ${d29Plus?.bookingsCount || 0}건의 사전 예약과 28일 이내 예약 간 급격한 단절·과다 할인 징후가 없습니다.`,
            actionText: '새로운 프로모션이나 가격 정책을 변경할 때마다 아래 이력장에 기록해 전후 성적표를 비교해 보세요.',
            suggestedSourceType: 'pricelabs',
            suggestedTitle: '정기 가격/프로모션 성과 점검',
        });
    }

    return recs;
}
