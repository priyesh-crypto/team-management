"use client";

import React from 'react';
import { Menu, Search, Bell } from 'lucide-react';

interface EmployeeHeaderProps {
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
    refreshData: () => void;
    userId: string;
}

export function EmployeeHeader({
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
    refreshData,
    userId
}: EmployeeHeaderProps) {
    return (
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-[#e5e5ea] flex items-center justify-between px-6 lg:px-8 sticky top-0 z-[40] shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 hover:bg-[#f5f5f7] rounded-xl transition-colors"><Menu size={20} /></button>
                <div>
                    <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
                        <span className="hidden sm:inline text-[#1d1d1f] tracking-tight">{activeTab.toUpperCase()}</span>
                    </div>
                    <h1 className="text-lg lg:text-xl font-black text-[#1d1d1f] tracking-tight capitalize truncate">
                        {activeTab === 'mine' ? 'My Workspace' : 
                         activeTab === 'team' ? 'Team Hub' : 
                         activeTab === 'schedule' ? 'Timeline' : 'Account Settings'}
                    </h1>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="relative group hidden sm:block">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#86868b]"><Search size={14} strokeWidth={3} /></div>
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        className="pl-10 pr-4 py-2 bg-[#f5f5f7] border-none rounded-2xl text-[11px] font-bold text-[#1d1d1f] w-40 lg:w-64 focus:ring-2 focus:ring-[#0c64ef]/20 transition-all outline-none" 
                    />
                </div>
                <div className="relative" ref={notificationRef}>
                    <button onClick={() => setShowNotifications(!showNotifications)} className="p-2.5 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] rounded-2xl transition-all relative">
                        <Bell size={18} strokeWidth={2.5} />
                        {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-[#ff3b30] rounded-full ring-2 ring-white animate-pulse" />}
                    </button>
                    {showNotifications && (
                        <div className="absolute right-0 mt-3 w-[calc(100vw-32px)] sm:w-80 bg-white rounded-3xl shadow-2xl border border-[#e5e5ea] z-50 overflow-hidden fade-in">
                            <div className="p-5 border-b border-[#f5f5f7] flex justify-between items-center bg-[#f5f5f7]/50">
                                <h3 className="font-black text-xs uppercase tracking-widest text-[#1d1d1f]">Notifications</h3>
                                <button 
                                    onClick={async () => { 
                                        await markAllNotificationsAsRead(userId); 
                                        refreshData(); 
                                    }} 
                                    className="text-[10px] font-bold text-[#0c64ef] uppercase tracking-tighter"
                                >
                                    Mark all read
                                </button>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-10 text-center text-[#86868b] text-xs font-bold italic">No notifications yet</div>
                                ) : (
                                    notifications.map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => handleMarkAsRead(n)} 
                                            className={`p-4 border-b border-[#f5f5f7] hover:bg-[#f5f5f7] cursor-pointer transition-colors ${!n.is_read ? 'bg-[#0c64ef]/5' : ''}`}
                                        >
                                            <div className="flex gap-3">
                                                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.type === 'urgent' ? 'bg-[#ff3b30]' : 'bg-[#0c64ef]'}`} />
                                                <div className="flex-1">
                                                    <p className="text-[11px] font-bold text-[#1d1d1f]">{n.message ?? n.title ?? "Notification"}</p>
                                                    <span className="text-[9px] text-[#86868b]">{new Date(n.created_at).toLocaleDateString()}</span>
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
