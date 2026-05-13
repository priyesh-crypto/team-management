"use client";

import dynamic from 'next/dynamic';
import { DashboardStoreProvider } from '@/lib/dashboard-store';
import { GlobalBanner } from '@/components/GlobalBanner';

const EmployeeDashboard = dynamic(() => import('@/components/EmployeeDashboard'), {
  loading: () => <div className="fixed inset-0 bg-white flex items-center justify-center font-bold text-slate-400">Loading Dashboard...</div>,
});

const ManagerDashboard = dynamic(() => import('@/components/ManagerDashboard'), {
  loading: () => <div className="fixed inset-0 bg-white flex items-center justify-center font-bold text-slate-400">Initializing Management...</div>,
});

interface DashboardContainerProps {
  userId: string;
  userName: string;
  userRole: 'employee' | 'manager';
  userAvatarUrl?: string | null;
  orgName: string;
  orgId: string;
  projectId?: string;
  initialData?: any;
  initialBanner?: { id: string; title: string; body: string } | null;
}

export default function DashboardContainer({
  userId,
  userName,
  userRole,
  userAvatarUrl,
  orgId,
  projectId,
  initialData,
  initialBanner = null,
}: DashboardContainerProps) {
  return (
    <DashboardStoreProvider initialData={initialData} projectId={projectId}>
      <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
        <GlobalBanner banner={initialBanner} />
        <div className="flex-1">
          {userRole === 'employee' ? (
            <EmployeeDashboard
              userId={userId}
              userName={userName}
              userRole={userRole}
              userAvatarUrl={userAvatarUrl}
              projectId={projectId}
              orgId={orgId}
              initialData={initialData}
            />
          ) : (
            <ManagerDashboard
              userId={userId}
              userName={userName}
              userRole={userRole}
              userAvatarUrl={userAvatarUrl}
              projectId={projectId}
              orgId={orgId}
              initialData={initialData}
            />
          )}
        </div>
      </div>
    </DashboardStoreProvider>
  );
}
