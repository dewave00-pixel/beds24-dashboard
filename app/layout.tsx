import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '숙소 예약 현황 대시보드',
  description: 'Beds24 실시간 숙박 예약 확인 및 관리 시스템',
};

// 📱 모바일 두 손가락 자유 축소(Zoom-out)/확대 완전 개방 모듈
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 0.3, // 스마트폰에서 두 손가락으로 최대 30%까지 시원하게 축소 허용
  maximumScale: 3.5, // 필요 시 최대 3.5배까지 확대 허용
  userScalable: true, // 축소/확대 잠금 완전 해제
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased bg-gray-100 text-gray-900">{children}</body>
    </html>
  );
}