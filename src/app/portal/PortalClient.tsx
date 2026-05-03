"use client";

import React from "react";
import { CalendarDays, Flag, CheckCircle2 } from "lucide-react";

type PortalTask = {
    id: string;
    name: string;
    status: string;
    priority: string;
    deadline: string | null;
    notes: string | null;
    start_date: string | null;
};

const PRIORITY_COLORS: Record<string, string> = {
    Urgent: "bg-[#ff3b30]/10 text-[#ff3b30]",
    High: "bg-[#ff9500]/10 text-[#ff9500]",
    Medium: "bg-[#0051e6]/10 text-[#0051e6]",
    Low: "bg-[#34c759]/10 text-[#34c759]",
};

const STATUS_COLORS: Record<string, string> = {
    "To Do": "text-slate-500",
    "In Progress": "text-[#0051e6]",
    "In Review": "text-[#ff9500]",
    Blocked: "text-[#ff3b30]",
    Completed: "text-[#34c759]",
};

interface Props {
    orgName: string;
    tasks: PortalTask[];
}

export function PortalClient({ orgName, tasks }: Props) {
    const overdue = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== "Completed");
    const active = tasks.filter(t => !overdue.find(o => o.id === t.id));

    return (
        <div className="min-h-screen bg-[#f5f5f7]">
            <header className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-black text-[#0051e6] uppercase tracking-wider">Client Portal</div>
                        <div className="text-lg font-black text-[#1d1d1f]">{orgName}</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-[11px] font-bold text-slate-400">
                            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
                {overdue.length > 0 && (
                    <section>
                        <h2 className="text-[11px] font-black text-[#ff3b30] uppercase tracking-wider mb-3">
                            Overdue ({overdue.length})
                        </h2>
                        <div className="space-y-3">
                            {overdue.map(task => <TaskCard key={task.id} task={task} />)}
                        </div>
                    </section>
                )}

                <section>
                    <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-3">
                        Active tasks ({active.length})
                    </h2>
                    {active.length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                            <CheckCircle2 size={32} className="text-[#34c759] mx-auto mb-3" />
                            <p className="text-sm text-slate-400">No active tasks assigned to you.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {active.map(task => <TaskCard key={task.id} task={task} />)}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

function TaskCard({ task }: { task: PortalTask }) {
    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "Completed";

    return (
        <div className={`bg-white rounded-2xl border p-5 ${isOverdue ? "border-[#ff3b30]/20" : "border-slate-100"}`}>
            <div className="flex items-start gap-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${PRIORITY_COLORS[task.priority] ?? "bg-slate-100 text-slate-500"}`}>
                            <Flag size={9} className="inline mr-0.5" />
                            {task.priority}
                        </span>
                        <span className={`text-[11px] font-black ${STATUS_COLORS[task.status] ?? "text-slate-500"}`}>
                            {task.status}
                        </span>
                        {isOverdue && (
                            <span className="text-[10px] font-black text-[#ff3b30] px-2 py-0.5 rounded-lg bg-[#ff3b30]/10">
                                OVERDUE
                            </span>
                        )}
                    </div>
                    <h3 className="text-sm font-black text-[#1d1d1f] leading-snug">{task.name}</h3>
                    {task.notes && (
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-3">{task.notes}</p>
                    )}
                    {task.deadline && (
                        <div className={`flex items-center gap-1.5 mt-3 text-[11px] font-bold ${isOverdue ? "text-[#ff3b30]" : "text-slate-400"}`}>
                            <CalendarDays size={11} />
                            Due {new Date(task.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
