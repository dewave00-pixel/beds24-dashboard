import { Booking } from '../types';
import { ALL_UNITS, parseBookingTag } from '../config';

export interface CleaningAssignment {
    unitKey: string;
    staffName: string;
}

export function generateCleaningShareText(
    dateStr: string,
    staffName: string,
    assignedUnits: string[],
    bookings: Booking[],
    bookingNotes: { [bookingId: number]: { note: string; tags: string[] } }
): string {
    if (assignedUnits.length === 0) return '';

    let text = `🧹 [청소 배정 안내 - ${staffName}님]\n📅 청소 일자: ${dateStr}\n배정 호실 수: 총 ${assignedUnits.length}개\n`;
    text += `---------------------------\n`;

    assignedUnits.forEach((key, index) => {
        const unit = ALL_UNITS.find((u) => u.key === key);
        const unitName = unit ? `${unit.propName} ${unit.displayName}` : key;

        // 해당 호실의 오늘 퇴실/입실 예약 찾기
        const checkoutBooking = bookings.find(
            (b) => b.roomId === unit?.roomId && b.departure === dateStr
        );
        const checkinBooking = bookings.find(
            (b) => b.roomId === unit?.roomId && b.arrival === dateStr
        );

        const noteData = checkinBooking
            ? bookingNotes[checkinBooking.id]
            : checkoutBooking
                ? bookingNotes[checkoutBooking.id]
                : null;

        const tags = (noteData?.tags || [])
            .map((t) => {
                const info = parseBookingTag(t);
                return info ? `${info.icon}${info.label}` : '';
            })
            .filter(Boolean)
            .join(' ');

        text += `${index + 1}. 🏠 ${unitName}\n`;
        if (checkoutBooking) text += `   • 퇴실: 11:00 (체크아웃)\n`;
        if (checkinBooking) text += `   • 입실: 15:00 (체크인 예정)\n`;
        if (tags) text += `   • 특이사항: ${tags}\n`;
        if (noteData?.note) text += `   • 메모: ${noteData.note}\n`;
        text += `\n`;
    });

    text += `깨끗하고 안전한 청소 부탁드립니다! 감사합니다. 🙏`;
    return text;
}