"use client";

import React from 'react';
import dynamic from 'next/dynamic';

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
  orgName: string;
  orgId: string;
  projectId?: string;
  initialData?: any;
}

export default function DashboardContainer({ 
  userId, 
  userName, 
  userRole, 
  orgId,
  projectId,
  initialData
}: DashboardContainerProps) {
  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {userRole === 'employee' ? (
        <EmployeeDashboard 
          userId={userId} 
          userName={userName} 
          userRole={userRole}
          projectId={projectId} 
          orgId={orgId}
          initialData={initialData}
        />
      ) : (
        <ManagerDashboard 
          userId={userId} 
          userName={userName} 
          userRole={userRole}
          projectId={projectId} 
          orgId={orgId}
          initialData={initialData}
        />
      )}
    </div>
  );
}
