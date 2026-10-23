import type { OtaAdCharge } from '../types';

export const TRIP_API_SOURCE_ID = 53;

/**
 * 조회 기간에 실제 충전된 Trip.com CPC 광고비를 합산한다.
 * CPB 설정값은 기존 OTA 정산 수수료에 이미 반영되므로 여기서 차감하지 않는다.
 */
export function calculateTripAdSpend(
    charges: OtaAdCharge[],
    startDate: string,
    endDate: string
): number {
    return charges.reduce((total, charge) => {
        if (
            charge.apiSourceId !== TRIP_API_SOURCE_ID ||
            charge.chargeDate < startDate ||
            charge.chargeDate > endDate
        ) {
            return total;
        }

        return total + Math.max(0, Number(charge.amount) || 0);
    }, 0);
}

export function calculateRevenueAfterAdSpend(settlementRevenue: number, adSpend: number): number {
    return settlementRevenue - Math.max(0, adSpend);
}
