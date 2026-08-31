import { Booking } from '../types';
import { ALL_UNITS, parseBookingTag } from '../config';
import { isValidBooking } from './bookingUtils';

export interface CleaningAssignment {
    unitKey: string;
    staffName: string;
}

export function generateCleaningShareText(
    dateStr: string,
    staffName: string,
    assignedUnits: string[],
    bookings: Booking[],
    bookingNotes: { [bookingId: number | string]: { note: string; tags: string[] } }
): string {
    if (assignedUnits.length === 0) return '';

    let text = `🧹 [청소 배정 안내 - ${staffName}님]\n📅 청소 일자: ${dateStr}\n배정 호실 수: 총 ${assignedUnits.length}개\n`;
    text += `---------------------------\n`;

    assignedUnits.forEach((key, index) => {
        const unit = ALL_UNITS.find((u) => u.key === key);
        const unitName = unit ? `${unit.propName} ${unit.displayName}` : key;

        // 1. 해당 세부 호실(roomId + unitId)의 오늘 체크아웃 / 체크인 예약 정확한 매칭
        const checkoutBooking = bookings.find((b) => {
            if (!isValidBooking(b) || b.departure !== dateStr) return false;
            const isRoomMatch = Number(b.roomId) === unit?.roomId;
            const isUnitMatch = unit?.unitId ? Number(b.unitId) === unit.unitId : true;
            return isRoomMatch && isUnitMatch;
        });

        const checkinBooking = bookings.find((b) => {
            if (!isValidBooking(b) || b.arrival !== dateStr) return false;
            const isRoomMatch = Number(b.roomId) === unit?.roomId;
            const isUnitMatch = unit?.unitId ? Number(b.unitId) === unit.unitId : true;
            return isRoomMatch && isUnitMatch;
        });

        // 2. 체크아웃 시간 계산 (레이트체크아웃 태그 반영)
        const checkoutNoteData = checkoutBooking
            ? bookingNotes[checkoutBooking.id] || bookingNotes[Number(checkoutBooking.id)] || bookingNotes[String(checkoutBooking.id)]
            : null;
        const lateTag = checkoutNoteData?.tags?.find((t) => t.startsWith('late_'));
        const checkoutTime = lateTag
            ? `${lateTag.replace('late_', '')} (레이트 체크아웃 ⏰)`
            : '11:00 (체크아웃)';

        // 3. 체크인 시간 계산 (얼리체크인 태그 반영)
        const checkinNoteData = checkinBooking
            ? bookingNotes[checkinBooking.id] || bookingNotes[Number(checkinBooking.id)] || bookingNotes[String(checkinBooking.id)]
            : null;
        const earlyTag = checkinNoteData?.tags?.find((t) => t.startsWith('early_'));
        const checkinTime = earlyTag
            ? `${earlyTag.replace('early_', '')} (얼리 체크인 ⚡)`
            : '17:00 (체크인 예정)';

        // 4. 특이사항 태그 취합
        const allTags: string[] = [];
        [checkoutNoteData?.tags, checkinNoteData?.tags].forEach((tags) => {
            if (tags) {
                tags.forEach((t) => {
                    const info = parseBookingTag(t);
                    if (info) allTags.push(`${info.icon}${info.label}`);
                });
            }
        });
        const uniqueTags = Array.from(new Set(allTags)).join(' ');

        // 5. 메모 취합
        const notes: string[] = [];
        if (checkoutNoteData?.note?.trim()) {
            notes.push(`[체크아웃] ${checkoutNoteData.note.trim()}`);
        }
        if (checkinNoteData?.note?.trim()) {
            notes.push(`[체크인] ${checkinNoteData.note.trim()}`);
        }

        // 6. 호실별 텍스트 조립
        text += `${index + 1}. 🏠 ${unitName}\n`;
        text += `   • 체크아웃: ${checkoutBooking ? checkoutTime : '없음 (전일 공실)'}\n`;
        text += `   • 체크인: ${checkinBooking ? checkinTime : '없음 (당일 공실)'}\n`;
        if (uniqueTags) text += `   • 특이사항: ${uniqueTags}\n`;
        if (notes.length > 0) text += `   • 메모: ${notes.join(' / ')}\n`;
        text += `\n`;
    });

    text += `깨끗하고 안전한 청소 부탁드립니다! 감사합니다. 🙏`;
    return text;
}