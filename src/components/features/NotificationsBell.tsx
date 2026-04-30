"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { getNotificationsAlt, markAsRead, markAllReadAlt } from "@/app/actions/notifications";

// Matches the actual DB schema: type, message, is_read, task_id
type NotificationItem = {
    id: string;
    type: string;
    message: string;
    is_read: boolean;
    task_id: string | null;
    created_at: string;
};

const TYPE_ICONS: Record<string, string> = {
    urgent: "🔴",
    overdue: "⏰",
    comment: "💬",
    system: "⚡",
    task_assigned: "📋",
    comment_mention: "💬",
    task_due: "⏰",
    approval_needed: "✅",
    task_status_changed: "🔄",
    member_joined: "👋",
};

interface Props {
    initialCount: number;
    orgId: string;
}

export function NotificationsBell({ initialCount, orgId }: Props) {
    const [open, setOpen] = useState(false);
    const [unread, setUnread] = useState(initialCount);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [pending, startTransition] = useTransition();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    function handleOpen() {
        setOpen(o => !o);
        if (!loaded) {
            startTransition(async () => {
                const data = await getNotificationsAlt(30);
                setNotifications(data as NotificationItem[]);
                setLoaded(true);
            });
        }
    }

    function handleRead(id: string) {
        startTransition(async () => {
            await markAsRead(id);
            setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnread(c => Math.max(0, c - 1));
        });
    }

    function handleMarkAll() {
        startTransition(async () => {
            await markAllReadAlt(orgId);
            setNotifications(ns => ns.map(n => ({ ...n, is_read: true })));
            setUnread(0);
        });
    }

    return (
        <div ref={ref} className="relative">
            <button onClick={handleOpen}
                className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800">
                <Bell size={18} />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-[#ff3b30] text-white text-[9px] font-black flex items-center justify-center px-1">
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <span className="text-sm font-black text-[#1d1d1f]">Notifications</span>
                        {unread > 0 && (
                            <button onClick={handleMarkAll} disabled={pending}
                                className="text-[10px] font-black text-[#0c64ef] hover:underline disabled:opacity-50">
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                        {!loaded && (
                            <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
                        )}
                        {loaded && notifications.length === 0 && (
                            <div className="py-10 text-center">
                                <div className="text-2xl mb-2">🔔</div>
                                <p className="text-sm text-slate-400">You're all caught up!</p>
                            </div>
                        )}
                        {notifications.map(n => (
                            <div key={n.id}
                                onClick={() => !n.is_read && handleRead(n.id)}
                                className={`flex items-start gap-3 px-4 py-3 transition-colors ${!n.is_read ? "bg-[#0c64ef]/3 hover:bg-[#0c64ef]/5 cursor-pointer" : "hover:bg-slate-50/50"}`}>
                                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-base">
                                    {TYPE_ICONS[n.type] ?? "⚡"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-xs ${!n.is_read ? "font-black text-[#1d1d1f]" : "font-bold text-slate-600"}`}>
                                        {n.message}
                                    </div>
                                    <div className="text-[9px] text-slate-400 mt-1">
                                        {new Date(n.created_at).toLocaleString()}
                                    </div>
                                </div>
                                {!n.is_read && (
                                    <div className="w-2 h-2 rounded-full bg-[#0c64ef] flex-shrink-0 mt-1.5" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
