import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from './context/ThemeContext';

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
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var t = localStorage.getItem('theme');
                if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch(e) {}
            })();`,
          }}
        />
      </head>
      <body className="antialiased bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors duration-200">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}