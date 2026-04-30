"use client";

import React, { useMemo, useState } from "react";
import { GitBranch } from "lucide-react";
import { Task } from "@/app/actions/actions";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface GanttTask extends Task {
    depends_on?: string[];
}

interface Props {
    tasks: GanttTask[];
    onTaskClick?: (task: Task) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
    Urgent: "#ff3b30",
    High: "#ff9500",
    Medium: "#0c64ef",
    Low: "#34c759",
};

const STATUS_OPACITY: Record<string, number> = {
    Completed: 0.4,
    Blocked: 0.6,
};

function GanttBar({ task, startDay, span, totalDays, onClick }: {
    task: GanttTask;
    startDay: number;
    span: number;
    totalDays: number;
    onClick?: () => void;
}) {
    const left = `${(startDay / totalDays) * 100}%`;
    const width = `${Math.max(1, span / totalDays) * 100}%`;
    const color = PRIORITY_COLORS[task.priority] ?? "#86868b";
    const opacity = STATUS_OPACITY[task.status] ?? 1;

    return (
        <div
            className="absolute top-1/2 -translate-y-1/2 h-6 rounded-full cursor-pointer hover:brightness-110 transition-all group flex items-center px-2 overflow-hidden"
            style={{ left, width, backgroundColor: color, opacity }}
            onClick={onClick}
            title={`${task.name} | ${task.status}`}
        >
            <span className="text-white text-[9px] font-black truncate whitespace-nowrap">
                {task.name}
            </span>
            {task.status === "Completed" && (
                <span className="ml-auto text-white text-[8px] font-black">✓</span>
            )}
        </div>
    );
}

export function GanttView({ tasks, onTaskClick }: Props) {
    const [zoom, setZoom] = useState<"week" | "month" | "quarter">("month");

    const { minDate, maxDate, totalDays } = useMemo(() => {
        const validTasks = tasks.filter(t => t.start_date && t.deadline);
        if (validTasks.length === 0) {
            const now = new Date();
            return { minDate: now, maxDate: new Date(now.getTime() + 30 * 86400000), totalDays: 30 };
        }
        const starts = validTasks.map(t => new Date(t.start_date).getTime());
        const ends = validTasks.map(t => new Date(t.deadline).getTime());
        const min = new Date(Math.min(...starts));
        const max = new Date(Math.max(...ends));
        // Add padding
        min.setDate(min.getDate() - 2);
        max.setDate(max.getDate() + 5);
        const days = Math.ceil((max.getTime() - min.getTime()) / 86400000);
        return { minDate: min, maxDate: max, totalDays: days };
    }, [tasks]);

    const zoomDays: Record<string, number> = { week: 7, month: 30, quarter: 90 };
    const visibleDays = zoomDays[zoom];

    // Generate column headers
    const headers = useMemo(() => {
        const cols: { label: string; day: number }[] = [];
        const step = Math.max(1, Math.floor(totalDays / 10));
        for (let d = 0; d < totalDays; d += step) {
            const dt = new Date(minDate.getTime() + d * 86400000);
            cols.push({ label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }), day: d });
        }
        return cols;
    }, [minDate, totalDays]);

    // Today marker
    const todayOffset = Math.floor((Date.now() - minDate.getTime()) / 86400000);
    const todayPct = `${(todayOffset / totalDays) * 100}%`;
    const showToday = todayOffset >= 0 && todayOffset <= totalDays;

    const filteredTasks = tasks.filter(t => t.start_date && t.deadline);

    return (
        <UpgradeGate feature="gantt_dependencies">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0c64ef]/10 text-[#0c64ef] font-black uppercase tracking-widest">
                            {filteredTasks.length} scheduled tasks
                        </span>
                    </div>
                    <div className="p-0.5 rounded-xl bg-slate-100 flex">
                        {(["week", "month", "quarter"] as const).map(z => (
                            <button
                                key={z}
                                onClick={() => setZoom(z)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-black capitalize transition-all ${
                                    zoom === z ? "bg-white text-[#1d1d1f] shadow-sm" : "text-slate-400 hover:text-slate-700"
                                }`}
                            >
                                {z}
                            </button>
                        ))}
                    </div>
                </div>

                {filteredTasks.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="text-3xl mb-3">📅</div>
                        <p className="text-sm text-slate-400">Add start dates and deadlines to tasks to see them on the Gantt chart.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div style={{ minWidth: `${Math.max(800, visibleDays * 20)}px` }}>
                            {/* Date headers */}
                            <div className="relative border-b border-slate-100 h-8 bg-slate-50">
                                {showToday && (
                                    <div className="absolute top-0 bottom-0 w-px bg-[#0c64ef]/50 z-10" style={{ left: todayPct }}>
                                        <div className="absolute -top-0 left-1 text-[8px] font-black text-[#0c64ef] whitespace-nowrap">Today</div>
                                    </div>
                                )}
                                {headers.map(h => (
                                    <div
                                        key={h.day}
                                        className="absolute top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 whitespace-nowrap -translate-x-1/2"
                                        style={{ left: `${(h.day / totalDays) * 100}%` }}
                                    >
                                        {h.label}
                                    </div>
                                ))}
                            </div>

                            {/* Task rows */}
                            {filteredTasks.map(task => {
                                const start = new Date(task.start_date);
                                const end = new Date(task.deadline);
                                const startDay = Math.max(0, Math.floor((start.getTime() - minDate.getTime()) / 86400000));
                                const span = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

                                return (
                                    <div key={task.id} className="flex border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors" style={{ height: "48px" }}>
                                        {/* Task label */}
                                        <div className="w-48 flex-shrink-0 px-4 flex items-center border-r border-slate-100">
                                            <span className="text-[11px] font-bold text-[#1d1d1f] truncate">{task.name}</span>
                                        </div>
                                        {/* Bar area */}
                                        <div className="flex-1 relative">
                                            {showToday && (
                                                <div className="absolute top-0 bottom-0 w-px bg-[#0c64ef]/20" style={{ left: todayPct }} />
                                            )}
                                            <GanttBar
                                                task={task}
                                                startDay={startDay}
                                                span={span}
                                                totalDays={totalDays}
                                                onClick={() => onTaskClick?.(task)}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </UpgradeGate>
    );
}
