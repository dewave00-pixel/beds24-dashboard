import type { OtaAdCharge } from '../types';

export const TRIP_API_SOURCE_ID = 53;

export interface AdSpendBreakdown {
    settlementDeductedSpend: number; // OTA 정산금에서 차감되는 광고비 (매출 차감 대상)
    cardSpend: number;               // 카드로 직접 결제/충전한 광고비 (별도 비용 집계)
    totalSpend: number;              // 전체 광고 충전액
    byChannel: Record<
        number,
        {
            channelName: string;
            settlementDeductedSpend: number;
            cardSpend: number;
            totalSpend: number;
        }
    >;
}

/**
 * 조회 기간 및 대상 숙소에 해당하는 광고 충전액을 계산한다.
 * - payment_method === 'settlement_deduction' (기본값): OTA 정산금에서 차감
 * - payment_method === 'card': 법인/개인 카드 직접 결제 (정산 매출에서 미차감, 별도 비용 집계)
 * - targetProperty: 'all' 또는 특정 숙소명 (YEONNAM, WAVE, Green, Namsun)
 */
export function calculateAdSpendBreakdown(
    charges: OtaAdCharge[],
    startDate: string,
    endDate: string,
    filterProperty?: string
): AdSpendBreakdown {
    let settlementDeductedSpend = 0;
    let cardSpend = 0;
    const byChannel: AdSpendBreakdown['byChannel'] = {};

    charges.forEach((charge) => {
        if (charge.chargeDate < startDate || charge.chargeDate > endDate) {
            return;
        }

        // 숙소 필터링: 특정 숙소 조회 시, 해당 숙소 전용이거나 'all(전체)'인 충전액만 반영
        if (filterProperty && filterProperty !== 'all') {
            const chargeProp = charge.targetProperty || 'all';
            if (chargeProp !== 'all' && chargeProp !== filterProperty) {
                return;
            }
        }

        const amount = Math.max(0, Number(charge.amount) || 0);
        const isCard = charge.paymentMethod === 'card';

        if (isCard) {
            cardSpend += amount;
        } else {
            settlementDeductedSpend += amount;
        }

        if (!byChannel[charge.apiSourceId]) {
            byChannel[charge.apiSourceId] = {
                channelName: charge.channelName,
                settlementDeductedSpend: 0,
                cardSpend: 0,
                totalSpend: 0,
            };
        }

        if (isCard) {
            byChannel[charge.apiSourceId].cardSpend += amount;
        } else {
            byChannel[charge.apiSourceId].settlementDeductedSpend += amount;
        }
        byChannel[charge.apiSourceId].totalSpend += amount;
    });

    return {
        settlementDeductedSpend,
        cardSpend,
        totalSpend: settlementDeductedSpend + cardSpend,
        byChannel,
    };
}

/**
 * 하위 호환성을 위한 Trip.com 광고비 합산 (정산금 차감분 기준)
 */
export function calculateTripAdSpend(
    charges: OtaAdCharge[],
    startDate: string,
    endDate: string
): number {
    const breakdown = calculateAdSpendBreakdown(charges, startDate, endDate);
    return breakdown.byChannel[TRIP_API_SOURCE_ID]?.settlementDeductedSpend || 0;
}

/**
 * 정산 매출에서 광고비(정산금 차감분)를 차감한 실수령액을 계산한다.
 * 카드 결제 광고비는 통장 입금 정산금을 줄이지 않으므로 여기서 차감하지 않는다.
 */
export function calculateRevenueAfterAdSpend(
    settlementRevenue: number,
    settlementDeductedAdSpend: number
): number {
    return settlementRevenue - Math.max(0, settlementDeductedAdSpend);
}
