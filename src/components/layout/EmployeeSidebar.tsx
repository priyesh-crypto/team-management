"use client";

import React from 'react';
import { X, LogOut, Zap, Activity, Clock, CheckCircle2 } from 'lucide-react';
import { ProjectSwitcher } from '@/components/ProjectSwitcher';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface EmployeeSidebarProps {
    userName: string;
    userAvatarUrl?: string | null;
    activeTab: string;
    setActiveTab: (tab: any) => void;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
    projects: any[];
    userRole: 'employee' | 'manager' | undefined;
    handleSignOut: () => void;
}

const NavItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${
            active 
            ? 'bg-[#0c64ef] text-white shadow-lg shadow-[#0c64ef]/20 font-bold translate-x-1' 
            : 'text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] font-medium'
        }`}
    >
        <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
            {icon}
        </div>
        <span className="text-xs uppercase tracking-widest">{label}</span>
        {active && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        )}
    </button>
);

export function EmployeeSidebar({
    userName,
    userAvatarUrl,
    activeTab,
    setActiveTab,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    projects,
    userRole,
    handleSignOut
}: EmployeeSidebarProps) {
    return (
        <>
            {/* MOBILE SIDEBAR */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[100] lg:hidden">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-72 bg-white p-6 shadow-2xl animate-in slide-in-from-left duration-300 flex flex-col">
                        <div className="flex items-center justify-between mb-10 px-2 shrink-0">
                            <div className="flex items-center gap-3">
                                <img src="/logo.avif" alt="Mindbird Logo" className="w-10 h-10 rounded-xl object-cover shadow-sm" />
                                <span className="text-xl font-black tracking-tight text-[#1d1d1f]">Mindbird.ai</span>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-[#f5f5f7] rounded-xl transition-colors"><X size={20} /></button>
                        </div>
                        <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-2 pb-6">
                            <NavItem icon="🏠" label="MY TASKS" active={activeTab === 'mine'} onClick={() => { setActiveTab('mine'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="👥" label="TEAM STATUS" active={activeTab === 'team'} onClick={() => { setActiveTab('team'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="⚙️" label="SETTINGS" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} />
                            <div className="mt-4 border-t border-[#f5f5f7] pt-2">
                                <ProjectSwitcher projects={projects} userRole={userRole} />
                            </div>
                        </nav>
                        <div className="mt-auto pt-6 border-t border-[#f5f5f7]">
                            <button 
                                onClick={handleSignOut}
                                className="flex items-center gap-3 w-full px-4 py-3 text-[#ff3b30] hover:bg-[#ff3b30]/5 rounded-2xl transition-all duration-300 font-bold text-xs uppercase tracking-widest group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-[#ff3b30]/10 flex items-center justify-center group-hover:bg-[#ff3b30] group-hover:text-white transition-all duration-300">
                                    <LogOut size={18} strokeWidth={2.5} />
                                </div>
                                SIGN OUT
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DESKTOP SIDEBAR */}
            <aside className="w-56 bg-white border-r border-[#e5e5ea] flex flex-col p-5 hidden lg:flex shrink-0">
                <div className="flex items-center gap-3 mb-8 px-1">
                    <img src="/logo.avif" alt="Mindbird Logo" className="w-8 h-8 rounded-lg object-cover shadow-sm" />
                    <div>
                        <span className="text-sm font-black tracking-tight text-[#1d1d1f] leading-none block">Mindbird.ai</span>
                        <span className="text-[10px] text-[#86868b] uppercase tracking-widest font-bold">Pro Edition</span>
                    </div>
                </div>
                
                <nav className="flex-1 space-y-1.5">
                    <NavItem label="Dashboard" icon={<Zap size={16} strokeWidth={2.5} />} active={activeTab === 'mine'} onClick={() => setActiveTab('mine')} />
                    <NavItem label="Team" icon={<Activity size={16} strokeWidth={2.5} />} active={activeTab === 'team'} onClick={() => setActiveTab('team')} />
                    <NavItem label="Schedule" icon={<Clock size={16} strokeWidth={2.5} />} active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} />
                    <NavItem label="Settings" icon={<CheckCircle2 size={16} strokeWidth={2.5} />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                    
                    <div className="mt-8 pt-4 border-t border-slate-100">
                        <div className="px-4 mb-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Projects</div>
                        <ProjectSwitcher projects={projects} userRole={userRole} />
                    </div>
                </nav>

                <div className="mt-auto pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-3 px-2 py-3 rounded-2xl border border-transparent hover:border-slate-100 transition-all cursor-pointer group">
                        <UserAvatar
                            name={userName}
                            avatarUrl={userAvatarUrl}
                            className="w-9 h-9 rounded-xl bg-slate-100 ring-2 ring-white"
                            textClassName="text-[11px] font-bold text-slate-500"
                        />
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xs font-bold text-[#1d1d1f] truncate">{userName}</h2>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Pro Account</p>
                        </div>
                        <button 
                            onClick={handleSignOut}
                            className="p-2 hover:bg-[#ff3b30]/10 text-slate-400 hover:text-[#ff3b30] rounded-lg transition-all"
                            title="Sign Out"
                        >
                            <LogOut size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
