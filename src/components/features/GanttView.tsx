"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Task } from "@/app/actions/actions";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface GanttTask extends Task {
    depends_on?: string[];
}

interface Props {
    tasks: GanttTask[];
    onTaskClick?: (task: Task) => void;
}

const ZOOMS = {
    week:    { days: 7,  cellW: 96, label: "Week"  },
    biweek:  { days: 14, cellW: 64, label: "2 weeks" },
    month:   { days: 30, cellW: 40, label: "Month" },
} as const;
type Zoom = keyof typeof ZOOMS;

const PRIORITY_BG: Record<string, string> = {
    Urgent: "bg-rose-500",
    High:   "bg-orange-500",
    Medium: "bg-[#0c64ef]",
    Low:    "bg-emerald-500",
};

const PRIORITY_BG_SOFT: Record<string, string> = {
    Urgent: "bg-rose-50 border-rose-200 text-rose-700",
    High:   "bg-orange-50 border-orange-200 text-orange-700",
    Medium: "bg-blue-50 border-blue-200 text-blue-700",
    Low:    "bg-emerald-50 border-emerald-200 text-emerald-700",
};

function startOfDay(d: Date) {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
}

function addDays(d: Date, n: number) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function diffDays(a: Date, b: Date) {
    return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}

export function GanttView({ tasks, onTaskClick }: Props) {
    const [zoom, setZoom] = useState<Zoom>("biweek");
    const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));

    const { days, cellW } = ZOOMS[zoom];

    // Build the visible window starting from anchor (which is the first visible day)
    const window = useMemo(() => {
        return Array.from({ length: days }, (_, i) => addDays(anchor, i));
    }, [anchor, days]);

    // Filter tasks that overlap the visible window or have valid dates
    const scheduledTasks = useMemo(() => {
        return tasks.filter(t => t.start_date && t.deadline);
    }, [tasks]);

    const today = startOfDay(new Date());
    const todayIndex = diffDays(today, anchor);
    const todayInView = todayIndex >= 0 && todayIndex < days;

    function shift(direction: -1 | 1) {
        setAnchor(a => addDays(a, direction * Math.max(1, Math.floor(days / 2))));
    }

    function jumpToToday() {
        // Center "today" in the view
        setAnchor(addDays(today, -Math.floor(days / 2)));
    }

    const headerLabel = `${window[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${window[days - 1].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    return (
        <UpgradeGate feature="gantt_dependencies">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0c64ef]/10 text-[#0c64ef] font-black uppercase tracking-widest">
                            {scheduledTasks.length} scheduled
                        </span>
                        <span className="text-xs font-black text-[#1d1d1f]">{headerLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Date nav */}
                        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100">
                            <button onClick={() => shift(-1)}
                                className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors" title="Earlier">
                                <ChevronLeft size={14} />
                            </button>
                            <button onClick={jumpToToday}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-black text-slate-600 hover:bg-white transition-colors">
                                Today
                            </button>
                            <button onClick={() => shift(1)}
                                className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors" title="Later">
                                <ChevronRight size={14} />
                            </button>
                        </div>
                        {/* Zoom */}
                        <div className="p-0.5 rounded-xl bg-slate-100 flex">
                            {(Object.keys(ZOOMS) as Zoom[]).map(z => (
                                <button
                                    key={z}
                                    onClick={() => setZoom(z)}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black capitalize transition-all ${
                                        zoom === z ? "bg-white text-[#1d1d1f] shadow-sm" : "text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    {ZOOMS[z].label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {scheduledTasks.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="text-3xl mb-3">📅</div>
                        <p className="text-sm text-slate-400">Add start dates and deadlines to tasks to see them on the Gantt chart.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div style={{ minWidth: 240 + days * cellW }}>
                            {/* Date header row */}
                            <div className="flex border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                                <div className="w-60 flex-shrink-0 px-4 py-2.5 border-r border-slate-100 sticky left-0 bg-slate-50/50 z-20">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Task</span>
                                </div>
                                {window.map((d, i) => {
                                    const isToday = d.getTime() === today.getTime();
                                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                    return (
                                        <div key={i}
                                            style={{ width: cellW }}
                                            className={`flex-shrink-0 py-2 text-center border-r border-slate-100 last:border-r-0 ${
                                                isWeekend ? "bg-slate-100/30" : ""
                                            } ${isToday ? "bg-[#0c64ef]/5" : ""}`}>
                                            <div className={`text-[8px] font-black uppercase tracking-widest ${
                                                isToday ? "text-[#0c64ef]" : "text-slate-400"
                                            }`}>
                                                {d.toLocaleDateString("en-US", { weekday: "short" })}
                                            </div>
                                            <div className={`text-[11px] font-black mt-0.5 ${
                                                isToday ? "text-[#0c64ef]" : "text-slate-700"
                                            }`}>
                                                {d.getDate()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Task rows */}
                            {scheduledTasks.map(task => {
                                const start = startOfDay(new Date(task.start_date));
                                const end = startOfDay(new Date(task.deadline));
                                const startCol = diffDays(start, anchor);
                                const endCol = diffDays(end, anchor);

                                // Skip tasks completely outside visible window
                                if (endCol < 0 || startCol >= days) return null;

                                const visibleStart = Math.max(0, startCol);
                                const visibleEnd = Math.min(days - 1, endCol);
                                const span = visibleEnd - visibleStart + 1;
                                const truncatedLeft = startCol < 0;
                                const truncatedRight = endCol >= days;

                                const priority = task.priority ?? "Medium";
                                const isCompleted = task.status === "Completed";
                                const barColor = isCompleted
                                    ? "bg-emerald-400"
                                    : PRIORITY_BG[priority] ?? "bg-slate-400";

                                return (
                                    <div key={task.id}
                                        className="flex border-b border-slate-50 hover:bg-slate-50/40 transition-colors h-12 relative">
                                        {/* Task name (sticky) */}
                                        <div className="w-60 flex-shrink-0 px-4 flex items-center border-r border-slate-100 sticky left-0 bg-white z-10 group-hover:bg-slate-50/40">
                                            <div className={`w-1.5 h-6 rounded-full mr-2.5 flex-shrink-0 ${barColor}`} />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[11px] font-black text-[#1d1d1f] truncate">
                                                    {task.name}
                                                </div>
                                                <div className="text-[9px] text-slate-400 truncate">
                                                    {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} →{" "}
                                                    {end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Day cells (background grid) */}
                                        {window.map((d, i) => {
                                            const isToday = d.getTime() === today.getTime();
                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                            return (
                                                <div key={i}
                                                    style={{ width: cellW }}
                                                    className={`flex-shrink-0 border-r border-slate-50 last:border-r-0 ${
                                                        isWeekend ? "bg-slate-100/30" : ""
                                                    } ${isToday ? "bg-[#0c64ef]/5" : ""}`} />
                                            );
                                        })}

                                        {/* Bar overlay */}
                                        <div
                                            onClick={() => onTaskClick?.(task)}
                                            className={`absolute top-1/2 -translate-y-1/2 h-7 rounded-md border flex items-center px-2 cursor-pointer hover:brightness-105 hover:shadow-md transition-all ${PRIORITY_BG_SOFT[priority] ?? "bg-slate-50 border-slate-200"} ${isCompleted ? "opacity-60" : ""} ${truncatedLeft ? "rounded-l-none" : ""} ${truncatedRight ? "rounded-r-none" : ""}`}
                                            style={{
                                                left: 240 + visibleStart * cellW + 2,
                                                width: span * cellW - 4,
                                                minWidth: 18,
                                            }}
                                            title={`${task.name} · ${task.status} · ${priority}`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0 ${barColor}`} />
                                            <span className="text-[10px] font-black truncate">
                                                {task.name}
                                            </span>
                                            {isCompleted && (
                                                <span className="ml-auto text-[10px] font-black flex-shrink-0">✓</span>
                                            )}
                                        </div>

                                        {/* Today line on this row */}
                                        {todayInView && (
                                            <div
                                                className="absolute top-0 bottom-0 w-px bg-[#0c64ef]/30 pointer-events-none"
                                                style={{ left: 240 + todayIndex * cellW + cellW / 2 }}
                                            />
                                        )}
                                    </div>
                                );
                            })}

                            {/* Today marker on header row */}
                            {todayInView && (
                                <div
                                    className="absolute top-0 w-0.5 bg-[#0c64ef] pointer-events-none"
                                    style={{
                                        left: 240 + todayIndex * cellW + cellW / 2,
                                        height: "100%",
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Legend */}
                <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-100 flex-wrap">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority:</span>
                    {(["Urgent", "High", "Medium", "Low"] as const).map(p => (
                        <div key={p} className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${PRIORITY_BG[p]}`} />
                            <span className="text-[10px] text-slate-500 font-bold">{p}</span>
                        </div>
                    ))}
                    <span className="ml-auto text-[9px] text-slate-400 font-bold">Click a bar to open the task</span>
                </div>
            </div>
        </UpgradeGate>
    );
}
