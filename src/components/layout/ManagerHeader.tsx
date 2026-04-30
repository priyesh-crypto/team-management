"use client";

import React from 'react';
import { Menu, Search, Bell } from 'lucide-react';

interface ManagerHeaderProps {
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
    activeTab: string;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    unreadCount: number;
    notifications: any[];
    showNotifications: boolean;
    setShowNotifications: (show: boolean) => void;
    notificationRef: React.RefObject<HTMLDivElement | null>;
    handleMarkAsRead: (n: any) => void;
    markAllNotificationsAsRead: (userId: string) => Promise<void>;
    userId: string;
    refreshData: () => void;
    setActiveTab: (tab: any) => void;
    setShowAssignModal: (show: boolean) => void;
}

export function ManagerHeader({
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    activeTab,
    searchQuery,
    setSearchQuery,
    unreadCount,
    notifications,
    showNotifications,
    setShowNotifications,
    notificationRef,
    handleMarkAsRead,
    markAllNotificationsAsRead,
    userId,
    refreshData,
    setActiveTab,
    setShowAssignModal
}: ManagerHeaderProps) {
    return (
        <header className="h-14 bg-white/80 backdrop-blur-md border-b border-[#e5e5ea] flex items-center justify-between px-6 lg:px-6 sticky top-0 z-[40]">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="lg:hidden p-2 hover:bg-[#f5f5f7] rounded-xl transition-colors"
                >
                    <Menu size={18} />
                </button>
                <div className="hidden lg:block">
                    <h1 className="text-xs font-black text-[#1d1d1f] tracking-tight uppercase mb-0.5">
                        {activeTab === 'board' ? 'Management Board' : 
                         activeTab === 'mine' ? 'Personal Workspace' : 
                         activeTab === 'reports' ? 'Performance Reports' :
                         activeTab === 'sprints' ? 'Sprint Planning' :
                         activeTab === 'gantt' ? 'Project Roadmap' :
                         activeTab === 'workload' ? 'Resource Capacity' :
                         activeTab === 'automations' ? 'Automations Center' :
                         activeTab === 'planning' ? 'Project Planning' : 
                         activeTab === 'team' ? 'Team Control' : 'System Settings'}
                    </h1>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse" />
                        <span className="text-[9px] font-black text-[#86868b] uppercase tracking-widest leading-none">Live System Active</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center gap-6 text-[10px] font-black tracking-[0.2em] text-[#86868b]">
                    <button className={`hover:text-[#1d1d1f] transition-colors ${activeTab === 'board' ? 'text-[#0c64ef]' : ''}`} onClick={() => setActiveTab('board')}>BOARD</button>
                    <span className="opacity-20">•</span>
                    <button className="hover:text-[#1d1d1f] transition-colors" onClick={() => setActiveTab('planning')}>DAILY TASKS ▾</button>
                </div>
                <div className="relative group hidden sm:block">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#86868b]">
                        <Search size={12} strokeWidth={3} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="System search..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-[#f5f5f7] border-none rounded-xl text-[10px] font-black text-[#1d1d1f] w-48 lg:w-64 focus:ring-2 focus:ring-[#0c64ef]/20 transition-all outline-none" 
                    />
                </div>

                <button 
                    className="rounded-xl h-9 px-5 bg-black text-white font-black text-[9px] tracking-[0.2em] shadow-lg shadow-black/10 hover:bg-[#1d1d1f] transition-all hover:-translate-y-0.5 active:scale-95 uppercase" 
                    onClick={() => setShowAssignModal(true)}
                >
                    + Create task
                </button>

                <div className="relative" ref={notificationRef}>
                    <button 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="p-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] rounded-xl transition-all relative group"
                    >
                        <Bell size={18} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ff3b30] rounded-full ring-2 ring-white animate-pulse" />
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-[#e5e5ea] z-50 overflow-hidden fade-in">
                            <div className="p-5 border-b border-[#f5f5f7] flex justify-between items-center bg-[#f5f5f7]/50">
                                <h3 className="font-black text-[10px] uppercase tracking-widest text-[#1d1d1f]">Notifications</h3>
                                <button 
                                    onClick={async () => {
                                        await markAllNotificationsAsRead(userId);
                                        refreshData();
                                    }}
                                    className="text-[9px] font-black text-[#0c64ef] uppercase tracking-widest hover:underline"
                                >
                                    Clear All
                                </button>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                {notifications.length === 0 ? (
                                    <div className="p-10 text-center">
                                        <p className="text-[10px] font-black text-[#86868b] uppercase tracking-widest">Everything Read</p>
                                    </div>
                                ) : (
                                    notifications.map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => handleMarkAsRead(n)}
                                            className={`p-4 border-b border-[#f5f5f7] hover:bg-[#f5f5f7] cursor-pointer transition-colors ${!n.is_read ? 'bg-[#0c64ef]/5 font-bold' : ''}`}
                                        >
                                            <div className="flex gap-3">
                                                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.type === 'urgent' ? 'bg-[#ff3b30]' : 'bg-[#0c64ef]'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] leading-relaxed text-[#1d1d1f] break-words">{n.message}</p>
                                                    <span className="text-[8px] font-black text-[#86868b] uppercase tracking-widest mt-1 block">
                                                        {new Date(n.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
