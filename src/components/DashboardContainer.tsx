"use client";

import React, { useState } from 'react';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import ManagerDashboard from '@/components/ManagerDashboard';
import Logo from '@/components/ui/Logo';
import { Button } from '@/components/ui/components';
import { logout } from '@/app/actions/actions';

interface DashboardContainerProps {
  userId: string;
  userName: string;
  userRole: 'employee' | 'manager';
  orgName: string;
  projectId?: string;
}

export default function DashboardContainer({ 
  userId, 
  userName, 
  userRole, 
  orgName,
  projectId 
}: DashboardContainerProps) {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <header className="max-w-7xl mx-auto mb-8 flex justify-between items-center bg-white/80 backdrop-blur-md rounded-2xl p-4 sticky top-4 z-50 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#e5e5ea]">
        <div className="flex items-center gap-4">
          <Logo showText={false} className="w-8 h-8" />
          <div className="h-8 w-px bg-[#e5e5ea]" />
          <div>
            <h1 className="text-lg font-bold leading-none text-[#1d1d1f]">
              {orgName}
            </h1>
            <span className="text-[10px] text-[#86868b] uppercase tracking-widest font-bold">
              {userRole} portal
            </span>
          </div>
        </div>

        <form action={logout}>
          <Button variant="secondary" type="submit" className="text-sm">
            Sign Out
          </Button>
        </form>
      </header>

      <main className="max-w-7xl mx-auto pb-20 fade-in">
        {userRole === 'employee' ? (
          <EmployeeDashboard 
            userId={userId} 
            userName={userName} 
            userRole={userRole}
            projectId={projectId} 
          />
        ) : (
          <ManagerDashboard 
            userId={userId} 
            userName={userName} 
            userRole={userRole}
            projectId={projectId} 
          />
        )}
      </main>
    </div>
  );
}
