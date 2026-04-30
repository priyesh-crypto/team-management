"use client";

import React from 'react';
import { X, LogOut, Zap, Activity } from 'lucide-react';
import { ProjectSwitcher } from '@/components/ProjectSwitcher';
import { Button } from '@/components/ui/components';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface ManagerSidebarProps {
    userName: string;
    userAvatarUrl?: string | null;
    activeTab: string;
    setActiveTab: (tab: any) => void;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
    projects: any[];
    userRole: 'employee' | 'manager' | undefined;
    logout: () => void;
}

function NavItem({ icon, label, active = false, onClick }: { icon: string, label: string, active?: boolean, onClick?: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${
                active 
                ? 'bg-[#0c64ef] text-white shadow-lg shadow-[#0c64ef]/20 font-bold translate-x-1' 
                : 'text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] font-bold'
            }`}
        >
            <span className={`text-lg transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
            <span className="text-[10px] uppercase tracking-widest">{label}</span>
            {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
        </button>
    );
}

function NavSection({ title }: { title: string }) {
    return <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#86868b] px-4 mt-6 mb-2">{title}</div>;
}

export function ManagerSidebar({
    userName,
    userAvatarUrl,
    activeTab,
    setActiveTab,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    projects,
    userRole,
    logout
}: ManagerSidebarProps) {
    return (
        <>
            {/* --- MOBILE SIDEBAR (DRAWER) --- */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[100] lg:hidden">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-72 bg-white p-6 shadow-2xl animate-in slide-in-from-left duration-300">
                        <div className="flex items-center justify-between mb-10 px-2">
                            <div className="flex items-center gap-3">
                                <img src="/logo.avif" alt="Mindbird Logo" className="w-10 h-10 rounded-xl object-cover shadow-sm" />
                                <span className="text-xl font-black tracking-tight text-[#1d1d1f]">Mindbird.ai</span>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-[#f5f5f7] rounded-xl">
                                <X size={20} />
                            </button>
                        </div>

                        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-2 -mr-2 mb-6">
                            <NavSection title="Workspace" />
                            <NavItem icon="📊" label="DASHBOARD" active={activeTab === 'board'} onClick={() => { setActiveTab('board'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="🎯" label="MY TASKS" active={activeTab === 'mine'} onClick={() => { setActiveTab('mine'); setIsMobileMenuOpen(false); }} />
                            
                            <NavSection title="Views" />
                            <NavItem icon="🏃" label="SPRINT BOARD" active={activeTab === 'sprints'} onClick={() => { setActiveTab('sprints'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="📉" label="GANTT CHART" active={activeTab === 'gantt'} onClick={() => { setActiveTab('gantt'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="🧠" label="WORKLOAD" active={activeTab === 'workload'} onClick={() => { setActiveTab('workload'); setIsMobileMenuOpen(false); }} />

                            <NavSection title="Tools" />
                            <NavItem icon="📈" label="REPORTS" active={activeTab === 'reports'} onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="🤖" label="AUTOMATIONS" active={activeTab === 'automations'} onClick={() => { setActiveTab('automations'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="🗓️" label="PLANNING" active={activeTab === 'planning'} onClick={() => { setActiveTab('planning'); setIsMobileMenuOpen(false); }} />
                            
                            <NavSection title="Admin" />
                            <NavItem icon="👥" label="TEAM MGT" active={activeTab === 'team'} onClick={() => { setActiveTab('team'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="⚙️" label="SETTINGS" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} />
                            
                            <div className="mt-4 border-t border-[#f5f5f7] pt-2">
                                <ProjectSwitcher projects={projects} userRole={userRole} />
                            </div>
                        </nav>

                        <div className="mt-10 p-4 bg-[#f5f5f7] rounded-[24px] border border-[#e5e5ea]">
                            <div className="flex items-center gap-3 mb-3">
                                <UserAvatar
                                    name={userName}
                                    avatarUrl={userAvatarUrl}
                                    className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1d1d1f] to-[#434343]"
                                    textClassName="text-xs text-white font-bold"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black truncate">{userName}</p>
                                    <p className="text-[10px] text-[#86868b] font-bold">Admin Privileges</p>
                                </div>
                            </div>
                            <Button variant="secondary" className="w-full text-[10px] font-black tracking-widest py-2 rounded-xl h-auto" onClick={() => logout()}>LOGOUT</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DESKTOP SIDEBAR --- */}
            <div className="w-64 bg-[#fafafa] border-r border-[#e5e5ea] flex flex-col p-5 hidden lg:flex">
                <div className="flex items-center gap-3 mb-6 px-1">
                    <img src="/logo.avif" alt="Mindbird Logo" className="w-8 h-8 rounded-lg object-cover shadow-sm" />
                    <div>
                        <span className="text-sm font-black tracking-tight text-[#1d1d1f] leading-none block">Mindbird.ai</span>
                        <span className="text-[10px] text-[#86868b] uppercase tracking-widest font-bold">Pro Edition</span>
                    </div>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                    <NavSection title="Workspace" />
                    <NavItem icon="📊" label="DASHBOARD" active={activeTab === 'board'} onClick={() => setActiveTab('board')} />
                    <NavItem icon="🎯" label="MY TASKS" active={activeTab === 'mine'} onClick={() => setActiveTab('mine')} />
                    
                    <NavSection title="Views" />
                    <NavItem icon="🏃" label="SPRINT BOARD" active={activeTab === 'sprints'} onClick={() => setActiveTab('sprints')} />
                    <NavItem icon="📉" label="GANTT CHART" active={activeTab === 'gantt'} onClick={() => setActiveTab('gantt')} />
                    <NavItem icon="🧠" label="WORKLOAD" active={activeTab === 'workload'} onClick={() => setActiveTab('workload')} />
                    
                    <NavSection title="Tools" />
                    <NavItem icon="📈" label="REPORTS" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
                    <NavItem icon="🤖" label="AUTOMATIONS" active={activeTab === 'automations'} onClick={() => setActiveTab('automations')} />
                    <NavItem icon="🗓️" label="PLANNING" active={activeTab === 'planning'} onClick={() => setActiveTab('planning')} />
                    
                    <NavSection title="Admin" />
                    <NavItem icon="👥" label="TEAM MGT" active={activeTab === 'team'} onClick={() => setActiveTab('team')} />
                    <NavItem icon="⚙️" label="SETTINGS" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />

                    
                    <div className="mt-4 border-t border-[#f5f5f7] pt-2">
                        <ProjectSwitcher projects={projects} userRole={userRole} />
                    </div>
                </nav>

                <div className="mt-auto p-5 bg-[#f5f5f7]/50 rounded-[32px] border border-[#e5e5ea]/50 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <UserAvatar
                            name={userName}
                            avatarUrl={userAvatarUrl}
                            className="w-10 h-10 rounded-2xl bg-[#0c64ef] shadow-lg shadow-[#0c64ef]/20"
                            textClassName="text-xs font-black text-white"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-[#1d1d1f] truncate leading-tight uppercase tracking-wider">{userName}</p>
                            <p className="text-[9px] text-[#86868b] font-black uppercase tracking-widest mt-0.5">Administrator</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => logout()} 
                        className="w-full py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#86868b] hover:text-[#ff3b30] transition-all border border-[#e5e5ea] rounded-xl bg-white hover:bg-[#fee2e2]/50 hover:border-[#fecaca] shadow-sm active:scale-95"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </>
    );
}
