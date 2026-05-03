"use client";

import React from 'react';
import { Menu, Search, Bell, Check, Trash2, X } from 'lucide-react';

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
    clearNotifications: () => Promise<void>;
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
    clearNotifications,
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
                    <button className={`hover:text-[#1d1d1f] transition-colors ${activeTab === 'board' ? 'text-[#0051e6]' : ''}`} onClick={() => setActiveTab('board')}>BOARD</button>
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
                        className="pl-9 pr-4 py-2 bg-[#f5f5f7] border-none rounded-xl text-[10px] font-black text-[#1d1d1f] w-48 lg:w-64 focus:ring-2 focus:ring-[#0051e6]/20 transition-all outline-none" 
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
                            <div className="p-4 border-b border-[#f5f5f7] flex justify-between items-center bg-[#f5f5f7]/50">
                                <h3 className="font-black text-[10px] uppercase tracking-widest text-[#1d1d1f]">Notifications</h3>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await markAllNotificationsAsRead(userId);
                                            refreshData();
                                        }}
                                        className="text-[9px] font-black text-[#0051e6] uppercase tracking-widest hover:underline"
                                    >
                                        Mark All Read
                                    </button>
                                    <button 
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await clearNotifications();
                                        }}
                                        className="text-[9px] font-black text-[#ff3b30] uppercase tracking-widest hover:underline"
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <div className="w-12 h-12 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Bell size={20} className="text-[#86868b] opacity-20" />
                                        </div>
                                        <p className="text-[11px] font-bold text-[#86868b] italic">No notifications yet</p>
                                    </div>
                                ) : (
                                    notifications.map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => handleMarkAsRead(n)}
                                            className={`p-4 border-b border-[#f5f5f7] hover:bg-[#f5f5f7] cursor-pointer group transition-colors relative ${!n.is_read ? 'bg-[#0051e6]/5' : ''}`}
                                        >
                                            <div className="flex gap-3 pr-8">
                                                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.type === 'urgent' ? 'bg-[#ff3b30]' : 'bg-[#0051e6]'} ${n.is_read ? 'opacity-20' : 'animate-pulse'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[11px] leading-snug ${!n.is_read ? 'font-bold text-[#1d1d1f]' : 'text-[#86868b]'}`}>
                                                        {n.message || n.title}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[9px] font-medium text-[#86868b] opacity-60">
                                                            {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {n.task_id && (
                                                            <span className="text-[8px] font-black text-[#0051e6] uppercase tracking-tighter bg-[#0051e6]/5 px-1.5 py-0.5 rounded-md">
                                                                Task Link
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick Action Button for Individual Notification */}
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!n.is_read ? (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMarkAsRead(n);
                                                        }}
                                                        className="p-2 hover:bg-white rounded-full shadow-sm text-[#0051e6] transition-all"
                                                        title="Mark as read"
                                                    >
                                                        <Check size={14} strokeWidth={3} />
                                                    </button>
                                                ) : (
                                                    <div className="p-2 text-[#86868b] opacity-40">
                                                        <Check size={14} strokeWidth={3} />
                                                    </div>
                                                )}
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
