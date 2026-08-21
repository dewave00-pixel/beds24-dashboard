'use client';

import React, { useState } from 'react';
import AppSidebar from './AppSidebar';

interface AppLayoutProps {
    children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* 좌측 사이드바 */}
            <AppSidebar
                isMobileOpen={isMobileSidebarOpen}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />

            {/* 우측 메인 컨텐츠 영역 */}
            <div className="flex-1 flex flex-col min-w-0">
                {children}
            </div>
        </div>
    );
}
