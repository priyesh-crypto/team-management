"use client";

import React, { useState } from "react";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface MemberLoad {
    user_id: string;
    role: string;
    name?: string;
    avatar_url?: string | null;
    tasks_by_date: Record<string, { count: number; hours: number }>;
}

interface Props {
    members: MemberLoad[];
    startDate?: Date;
}

function addDays(d: Date, n: number) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function fmtDate(d: Date) {
    return d.toISOString().split("T")[0];
}

function heatColor(count: number): string {
    if (count === 0) return "bg-slate-50 border-slate-100";
    if (count <= 2) return "bg-[#34c759]/20 border-[#34c759]/30";
    if (count <= 4) return "bg-[#ff9500]/20 border-[#ff9500]/30";
    return "bg-[#ff3b30]/20 border-[#ff3b30]/30";
}

function heatLabel(count: number): string {
    if (count === 0) return "text-slate-300";
    if (count <= 2) return "text-[#34c759]";
    if (count <= 4) return "text-[#ff9500]";
    return "text-[#ff3b30]";
}

const DAYS = 14;

export function WorkloadView({ members, startDate }: Props) {
    const [offset, setOffset] = useState(0);
    const base = addDays(startDate ?? new Date(), offset * DAYS);
    const dates = Array.from({ length: DAYS }, (_, i) => addDays(base, i));
    const today = fmtDate(new Date());

    return (
        <UpgradeGate feature="workload_view">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-black uppercase tracking-widest">
                            Capacity across {DAYS} days
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setOffset(o => o - 1)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                            <ChevronLeft size={14} />
                        </button>
                        <button onClick={() => setOffset(0)}
                            className="px-2 py-1 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-100 transition-colors">
                            Today
                        </button>
                        <button onClick={() => setOffset(o => o + 1)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-max">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="text-left px-5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider w-32 sticky left-0 bg-white">Member</th>
                                {dates.map(d => {
                                    const ds = fmtDate(d);
                                    const isToday = ds === today;
                                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                    return (
                                        <th key={ds} className={`px-1 py-2 text-center min-w-[44px] ${isWeekend ? "bg-slate-50" : ""}`}>
                                            <div className={`text-[9px] font-black ${isToday ? "text-[#0c64ef]" : "text-slate-400"}`}>
                                                {d.toLocaleDateString("en", { weekday: "short" })}
                                            </div>
                                            <div className={`text-[10px] font-black mt-0.5 ${isToday ? "text-[#0c64ef]" : "text-slate-500"}`}>
                                                {d.getDate()}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {members.length === 0 && (
                                <tr>
                                    <td colSpan={DAYS + 1} className="py-8 text-center text-sm text-slate-400">No members found.</td>
                                </tr>
                            )}
                            {members.map(member => {
                                const displayName = member.name ?? member.user_id.slice(0, 8);
                                const initials = (member.name ?? member.user_id)
                                    .split(/\s+/)
                                    .map(s => s[0])
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .join("")
                                    .toUpperCase();
                                return (
                                <tr key={member.user_id} className="hover:bg-slate-50/30 transition-colors">
                                    <td className="px-5 py-2 sticky left-0 bg-white">
                                        <div className="flex items-center gap-2">
                                            {member.avatar_url ? (
                                                <img
                                                    src={member.avatar_url}
                                                    alt={displayName}
                                                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-[#0c64ef]/10 flex items-center justify-center text-[9px] font-black text-[#0c64ef] flex-shrink-0">
                                                    {initials || member.user_id.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <div className="text-[11px] font-black text-[#1d1d1f]">{displayName}</div>
                                                <div className="text-[9px] text-slate-400 capitalize">{member.role}</div>
                                            </div>
                                        </div>
                                    </td>
                                    {dates.map(d => {
                                        const ds = fmtDate(d);
                                        const load = member.tasks_by_date[ds] ?? { count: 0, hours: 0 };
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                        const isToday = ds === today;
                                        return (
                                            <td key={ds} className={`px-1 py-1.5 text-center ${isWeekend ? "bg-slate-50/60" : ""}`}>
                                                <div className={`mx-auto w-8 h-8 rounded-lg border flex flex-col items-center justify-center transition-colors ${isToday ? "ring-1 ring-[#0c64ef]" : ""} ${heatColor(load.count)}`}
                                                    title={`${load.count} tasks, ${load.hours}h`}>
                                                    {load.count > 0 && (
                                                        <span className={`text-[10px] font-black ${heatLabel(load.count)}`}>{load.count}</span>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-50">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Load:</span>
                    {[["0", "bg-slate-50 border-slate-100"], ["1-2", "bg-[#34c759]/20 border-[#34c759]/30"], ["3-4", "bg-[#ff9500]/20 border-[#ff9500]/30"], ["5+", "bg-[#ff3b30]/20 border-[#ff3b30]/30"]].map(([label, cls]) => (
                        <div key={label} className="flex items-center gap-1">
                            <div className={`w-4 h-4 rounded border ${cls}`} />
                            <span className="text-[9px] text-slate-500 font-bold">{label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </UpgradeGate>
    );
}
