"use client";

import React from "react";
import { BarChart3, CheckCircle2, AlertTriangle, Clock, Users, FolderOpen } from "lucide-react";

interface Props {
    stats: {
        total: number;
        completed: number;
        overdue: number;
        totalHours: number;
        memberCount: number;
        workspaceCount: number;
    };
    byStatus: { status: string; count: number }[];
    byPriority: { priority: string; count: number }[];
    byMember: { user_id: string; role: string; count: number; hours: number }[];
    weeklyTrend: { label: string; completed: number }[];
}

const STATUS_COLORS: Record<string, string> = {
    "To Do": "#86868b",
    "In Progress": "#ff9500",
    "In Review": "#0c64ef",
    "Blocked": "#ff3b30",
    "Completed": "#34c759",
};

const PRIORITY_COLORS: Record<string, string> = {
    Urgent: "#ff3b30",
    High: "#ff9500",
    Medium: "#0c64ef",
    Low: "#34c759",
};

function StatCard({ icon, label, value, sub, color }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sub?: string;
    color?: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color ?? "bg-[#0c64ef]/10"}`}>
                {icon}
            </div>
            <div className="text-2xl font-black text-[#1d1d1f] tabular-nums">{value}</div>
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mt-1">{label}</div>
            {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        </div>
    );
}

function HBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
    const pct = max > 0 ? (count / max) * 100 : 0;
    return (
        <div className="flex items-center gap-3">
            <div className="w-24 text-[11px] font-bold text-slate-600 text-right flex-shrink-0">{label}</div>
            <div className="flex-1 h-6 bg-slate-50 rounded-full overflow-hidden">
                <div className="h-full rounded-full flex items-center px-3 transition-all duration-1000"
                    style={{ width: `${Math.max(8, pct)}%`, backgroundColor: color }}>
                    <span className="text-white text-[9px] font-black">{count}</span>
                </div>
            </div>
        </div>
    );
}

export function ReportsDashboard({ stats, byStatus, byPriority, byMember, weeklyTrend }: Props) {
    const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    const maxStatusCount = Math.max(...byStatus.map(s => s.count), 1);
    const maxPriorityCount = Math.max(...byPriority.map(p => p.count), 1);
    const maxWeeklyCount = Math.max(...weeklyTrend.map(w => w.completed), 1);

    return (
        <div className="p-8 space-y-8 max-w-5xl">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <BarChart3 size={20} className="text-[#0c64ef]" />
                    <h1 className="text-2xl font-black text-[#1d1d1f]">Reports & Dashboards</h1>
                </div>
                <p className="text-sm text-slate-400">Live insights across your organization.</p>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard icon={<CheckCircle2 size={18} className="text-[#34c759]" />} label="Completed" value={stats.completed} color="bg-[#34c759]/10" />
                <StatCard icon={<BarChart3 size={18} className="text-[#0c64ef]" />} label="Total tasks" value={stats.total} color="bg-[#0c64ef]/10" />
                <StatCard icon={<AlertTriangle size={18} className="text-[#ff3b30]" />} label="Overdue" value={stats.overdue} color="bg-[#ff3b30]/10" />
                <StatCard icon={<Clock size={18} className="text-[#ff9500]" />} label="Hours logged" value={`${Math.round(stats.totalHours)}h`} color="bg-[#ff9500]/10" />
                <StatCard icon={<Users size={18} className="text-[#af52de]" />} label="Members" value={stats.memberCount} color="bg-[#af52de]/10" />
                <StatCard icon={<FolderOpen size={18} className="text-[#5ac8fa]" />} label="Workspaces" value={stats.workspaceCount} color="bg-[#5ac8fa]/10" />
            </div>

            {/* Completion rate ring */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col items-center justify-center">
                    <div className="relative w-32 h-32">
                        <svg className="w-full h-full -rotate-90">
                            <circle cx="64" cy="64" r="56" className="stroke-slate-100 stroke-[10] fill-none" />
                            <circle cx="64" cy="64" r="56"
                                className="stroke-[#34c759] stroke-[10] fill-none transition-all duration-1000"
                                style={{ strokeDasharray: "352", strokeDashoffset: 352 - (352 * completionRate / 100) }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black text-[#1d1d1f]">{completionRate}%</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Done</span>
                        </div>
                    </div>
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mt-4">Completion rate</div>
                </div>

                {/* Status breakdown */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm lg:col-span-2">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-4">By status</h3>
                    <div className="space-y-2.5">
                        {byStatus.map(s => (
                            <HBar key={s.status} label={s.status} count={s.count} max={maxStatusCount} color={STATUS_COLORS[s.status] ?? "#86868b"} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Priority + Weekly trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-4">By priority</h3>
                    <div className="space-y-2.5">
                        {byPriority.map(p => (
                            <HBar key={p.priority} label={p.priority} count={p.count} max={maxPriorityCount} color={PRIORITY_COLORS[p.priority] ?? "#86868b"} />
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-4">Completions by week</h3>
                    <div className="flex items-end gap-3 h-36">
                        {weeklyTrend.map(w => {
                            const h = maxWeeklyCount > 0 ? (w.completed / maxWeeklyCount) * 100 : 0;
                            return (
                                <div key={w.label} className="flex-1 flex flex-col items-center gap-1.5">
                                    <span className="text-[10px] font-black text-slate-500">{w.completed}</span>
                                    <div className="w-full bg-[#0c64ef] rounded-t-lg transition-all duration-700" style={{ height: `${Math.max(4, h)}%` }} />
                                    <span className="text-[9px] font-bold text-slate-400">{w.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Member leaderboard */}
            {byMember.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-4">Member workload</h3>
                    <div className="space-y-2">
                        {byMember.map((m, i) => (
                            <div key={m.user_id} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0">
                                <div className="w-6 text-[11px] font-black text-slate-300 text-right">{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-black text-[#1d1d1f] truncate">{m.user_id.slice(0, 8)}…</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase">{m.role}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-[#1d1d1f]">{m.count} tasks</div>
                                    <div className="text-[10px] font-bold text-slate-400">{Math.round(m.hours * 10) / 10}h</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
