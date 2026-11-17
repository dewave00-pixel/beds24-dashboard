'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './dashboard.css';
import { useAuth } from './hooks/useAuth';
import AdminDashboardView from './components/home/AdminDashboardView';

export default function HomePage() {
  const router = useRouter();
  const { isAdmin, isManager, isStaff, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (isManager) {
      router.replace('/schedule');
    } else if (isStaff) {
      router.replace('/cleaning/my');
    } else if (!isAdmin) {
      router.replace('/login');
    }
  }, [loading, isAdmin, isManager, isStaff, router]);

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-xs font-bold text-gray-500 dark:text-slate-400">
          권한 확인 중...
        </div>
      </div>
    );
  }

  return <AdminDashboardView />;
}
