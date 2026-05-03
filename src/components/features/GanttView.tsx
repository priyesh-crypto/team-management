"use client";

import { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, MoreHorizontal, CheckCircle2, Circle, Clock, User, Calendar, Flag } from "lucide-react";
import { Task, Subtask, Profile, getSubtasks } from "@/app/actions/actions";

interface GanttTask extends Task {
    depends_on?: string[];
}

interface Props {
    tasks: GanttTask[];
    profiles: Profile[];
    onTaskClick?: (task: Task) => void;
}

const ZOOMS = {
    week:    { days: 7,  cellW: 120, label: "Week"  },
    biweek:  { days: 14, cellW: 80,  label: "2 weeks" },
    month:   { days: 30, cellW: 48,  label: "Month" },
} as const;
type Zoom = keyof typeof ZOOMS;

const TASK_COLORS = [
    "bg-emerald-400 text-white",
    "bg-rose-400 text-white",
    "bg-amber-400 text-white",
    "bg-blue-400 text-white",
    "bg-purple-500 text-white",
    "bg-orange-400 text-white",
];

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

function getInitials(name: string): string {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
}

function Avatar({ name, avatarUrl, className }: { name: string; avatarUrl?: string | null; className?: string }) {
    const initials = getInitials(name);
    if (avatarUrl) {
        return (
            <img
                src={avatarUrl}
                alt={name}
                className={`rounded-full object-cover ${className || "w-6 h-6"}`}
            />
        );
    }
    return (
        <div className={`rounded-full bg-white text-[#1d1d1f] flex items-center justify-center text-[9px] font-black border-2 border-transparent shadow-sm ${className || "w-6 h-6"}`}>
            {initials}
        </div>
    );
}

const PRIORITY_COLORS: Record<string, string> = {
    Urgent: "border-red-500",
    High: "border-orange-500",
    Medium: "border-blue-500",
    Low: "border-emerald-500",
};

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
    "To Do": { bg: "bg-slate-100", text: "text-slate-600" },
    "In Progress": { bg: "bg-blue-50", text: "text-blue-700" },
    "In Review": { bg: "bg-amber-50", text: "text-amber-700" },
    "Completed": { bg: "bg-emerald-50", text: "text-emerald-700" },
    "Blocked": { bg: "bg-red-50", text: "text-red-700" },
    "Overdue": { bg: "bg-red-50", text: "text-red-700" },
};

export function GanttView({ tasks, profiles, onTaskClick }: Props) {
    const [zoom, setZoom] = useState<Zoom>("biweek");
    const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
    const [activeTask, setActiveTask] = useState<GanttTask | null>(null);
    const [activeSubtasks, setActiveSubtasks] = useState<Subtask[]>([]);
    const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Helper: look up a profile by ID
    const getProfile = (id: string | undefined): Profile | undefined => {
        if (!id) return undefined;
        return profiles.find(p => p.id === id);
    };

    const { days, cellW } = ZOOMS[zoom];

    const dateWindow = useMemo(() => {
        return Array.from({ length: days }, (_, i) => addDays(anchor, i));
    }, [anchor, days]);

    const scheduledTasks = useMemo(() => {
        return tasks.filter(t => t.start_date && t.deadline).sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime());
    }, [tasks]);

    const today = startOfDay(currentTime);
    const todayIndex = diffDays(today, anchor);
    const todayInView = todayIndex >= 0 && todayIndex < days;
    
    const timeRatio = (currentTime.getHours() * 60 + currentTime.getMinutes()) / (24 * 60);
    const todayLineOffset = todayInView ? (todayIndex + timeRatio) * cellW : -1;

    function shift(direction: -1 | 1) {
        setAnchor(a => addDays(a, direction * Math.max(1, Math.floor(days / 2))));
    }

    const headerMonth = dateWindow[0].toLocaleDateString("en-US", { month: "long", year: "numeric" });
    
    const handleTaskClick = async (task: GanttTask) => {
        setActiveTask(task);
        onTaskClick?.(task);
        setIsLoadingSubtasks(true);
        try {
            const data = await getSubtasks(task.id);
            setActiveSubtasks(data);
        } catch (e) {
            console.error("Failed to load subtasks", e);
            setActiveSubtasks([]);
        } finally {
            setIsLoadingSubtasks(false);
        }
    };

    const completedCount = tasks.filter(t => t.status === "Completed").length;
    const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

    // Build participants list for active task
    const activeTaskParticipants = useMemo(() => {
        if (!activeTask) return [];
        const ids = new Set<string>();
        if (activeTask.employee_id) ids.add(activeTask.employee_id);
        if (activeTask.assignee_ids) activeTask.assignee_ids.forEach(id => ids.add(id));
        return Array.from(ids).map(id => getProfile(id)).filter(Boolean) as Profile[];
    }, [activeTask, profiles]);

    return (
        <div className="flex h-[800px] bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden font-sans">
            {/* Main Gantt Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 z-20">
                    <h2 className="text-2xl font-black text-[#1d1d1f] tracking-tight">Project Tasks</h2>
                    <div className="flex items-center gap-6">
                        {/* Team members (real data) */}
                        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl">
                            <span className="text-[10px] font-black uppercase text-slate-400">Team:</span>
                            <div className="flex -space-x-2">
                                {profiles.slice(0, 4).map(p => (
                                    <Avatar key={p.id} name={p.name} avatarUrl={p.avatar_url} className="w-6 h-6 border-2 border-slate-50" />
                                ))}
                                {profiles.length > 4 && (
                                    <div className="w-6 h-6 rounded-full bg-white text-slate-500 flex items-center justify-center border-2 border-slate-50 text-[9px] font-black">
                                        +{profiles.length - 4}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 bg-slate-50 rounded-2xl p-1 shadow-inner">
                            <button onClick={() => shift(-1)} className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-400 transition-all">
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-xs font-black text-[#1d1d1f] min-w-[100px] text-center">{headerMonth}</span>
                            <button onClick={() => shift(1)} className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-400 transition-all">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Gantt Grid & Bars */}
                <div className="flex-1 overflow-x-auto overflow-y-auto relative px-8 pb-8">
                    <div className="relative" style={{ minWidth: days * cellW, height: Math.max(scheduledTasks.length * 70 + 60, 500) }}>
                        
                        {/* Background Grid */}
                        <div className="absolute inset-0 flex">
                            {dateWindow.map((d, i) => {
                                const isToday = d.getTime() === today.getTime();
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return (
                                    <div key={i} style={{ width: cellW }} className={`h-full border-r border-slate-100 flex flex-col items-center pt-2 ${isWeekend ? "bg-slate-50/50" : ""}`}>
                                        <div className={`text-[10px] font-black tracking-widest uppercase mb-1 ${isToday ? "text-[#0051e6]" : "text-slate-400"}`}>
                                            {d.toLocaleDateString("en-US", { weekday: "short" })}
                                        </div>
                                        <div className={`text-sm font-black ${isToday ? "text-[#0051e6]" : "text-[#1d1d1f]"}`}>
                                            {String(d.getDate()).padStart(2, '0')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Current Time Line */}
                        {todayInView && (
                            <div className="absolute top-0 bottom-0 z-30 w-px bg-red-400" style={{ left: todayLineOffset }}>
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-50 text-red-500 text-[9px] font-black px-2 py-1 rounded-full whitespace-nowrap shadow-sm">
                                    {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                                <div className="absolute top-12 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
                            </div>
                        )}

                        {/* Task Bars */}
                        <div className="absolute top-20 left-0 right-0">
                            {scheduledTasks.map((task, i) => {
                                const start = startOfDay(new Date(task.start_date!));
                                const end = startOfDay(new Date(task.deadline!));
                                const startCol = diffDays(start, anchor);
                                const endCol = diffDays(end, anchor);

                                if (endCol < 0 || startCol >= days) return null;

                                const visibleStart = Math.max(0, startCol);
                                const visibleEnd = Math.min(days, endCol + 1);
                                const span = visibleEnd - visibleStart;
                                const isTruncatedRight = endCol >= days;
                                
                                const colorClass = TASK_COLORS[i % TASK_COLORS.length];
                                const isActive = activeTask?.id === task.id;

                                // Use the assigned employee's name for the avatar
                                const ownerProfile = getProfile(task.employee_id);
                                const ownerName = ownerProfile?.name || "??";

                                return (
                                    <div key={task.id} className="relative h-[60px] mb-3 group cursor-pointer" onClick={() => handleTaskClick(task)}>
                                        <div
                                            className={`absolute top-1/2 -translate-y-1/2 h-10 rounded-full flex items-center px-2 transition-all duration-300 overflow-hidden
                                                ${colorClass} 
                                                ${isActive ? "ring-4 ring-offset-2 ring-[#0051e6]/20 shadow-lg scale-[1.02] z-20" : "shadow-sm hover:shadow-md hover:brightness-105 z-10"}`}
                                            style={{
                                                left: visibleStart * cellW,
                                                width: Math.max(span * cellW - 8, 40),
                                            }}
                                        >
                                            <div className="flex -space-x-2 mr-3 ml-1 flex-shrink-0">
                                                <Avatar name={ownerName} avatarUrl={ownerProfile?.avatar_url} className="w-6 h-6 border-transparent opacity-90" />
                                            </div>
                                            <span className="text-[11px] font-black truncate drop-shadow-sm pr-2 flex-1">
                                                {task.name}
                                            </span>
                                            {!isTruncatedRight && (
                                                <div className="flex-shrink-0 ml-auto w-5 h-5 rounded-full bg-white/20 flex items-center justify-center mr-1">
                                                    <ChevronRight size={12} strokeWidth={3} className="text-white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                
                {/* FAB */}
                <button className="absolute bottom-8 right-8 w-14 h-14 bg-[#0051e6] rounded-full flex items-center justify-center shadow-xl shadow-[#0051e6]/30 hover:scale-105 transition-transform z-30 group">
                    <Plus className="text-white group-hover:rotate-90 transition-transform duration-300" size={24} />
                    <span className="absolute -top-6 text-[10px] font-black text-[#0051e6] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Add new</span>
                </button>
            </div>

            {/* Right Sidebar */}
            <div className="w-[320px] bg-slate-50/50 border-l border-slate-100 p-6 flex flex-col gap-6 overflow-y-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-[#1d1d1f]">Task Details</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                            {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        </p>
                    </div>
                    <button className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-700 transition-colors bg-white">
                        <MoreHorizontal size={14} />
                    </button>
                </div>

                {activeTask ? (() => {
                    const ownerProfile = getProfile(activeTask.employee_id);
                    const statusStyle = STATUS_BADGES[activeTask.status] || STATUS_BADGES["To Do"];
                    const priorityBorder = PRIORITY_COLORS[activeTask.priority] || PRIORITY_COLORS["Medium"];

                    return (
                        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-5">
                            {/* Task name + priority */}
                            <div className={`border-l-[3px] ${priorityBorder} pl-3`}>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeTask.priority} Priority</div>
                                <div className="text-sm font-black text-[#1d1d1f] mt-0.5 leading-tight">{activeTask.name}</div>
                            </div>

                            {/* Status badge */}
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${statusStyle.bg} ${statusStyle.text}`}>
                                    {activeTask.status}
                                </span>
                                {activeTask.hours_spent > 0 && (
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-lg">
                                        {activeTask.hours_spent}h logged
                                    </span>
                                )}
                            </div>

                            {/* Assigned to (owner) */}
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assigned to:</div>
                                {ownerProfile ? (
                                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                        <Avatar name={ownerProfile.name} avatarUrl={ownerProfile.avatar_url} className="w-8 h-8 text-xs border border-slate-100 bg-white" />
                                        <div>
                                            <div className="text-[11px] font-black text-[#1d1d1f]">{ownerProfile.name}</div>
                                            <div className="text-[9px] text-slate-400 font-medium">{ownerProfile.role}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                        <User size={14} className="text-slate-400" />
                                        <span className="text-[11px] font-bold text-slate-400">Unassigned</span>
                                    </div>
                                )}
                            </div>

                            {/* Collaborators */}
                            {activeTaskParticipants.length > 1 && (
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Collaborators:</div>
                                    <div className="flex flex-wrap gap-2">
                                        {activeTaskParticipants.filter(p => p.id !== activeTask.employee_id).map(p => (
                                            <div key={p.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-100">
                                                <Avatar name={p.name} avatarUrl={p.avatar_url} className="w-5 h-5 text-[8px] border border-slate-100 bg-white" />
                                                <span className="text-[10px] font-bold text-slate-600">{p.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Dates */}
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Schedule:</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50/50 border border-emerald-100">
                                        <Calendar size={12} className="text-emerald-500" />
                                        <div>
                                            <div className="text-[8px] font-black text-emerald-500 uppercase">Start</div>
                                            <div className="text-[10px] font-bold text-emerald-700">
                                                {new Date(activeTask.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50/50 border border-rose-100">
                                        <Flag size={12} className="text-rose-500" />
                                        <div>
                                            <div className="text-[8px] font-black text-rose-500 uppercase">Deadline</div>
                                            <div className="text-[10px] font-bold text-rose-700">
                                                {new Date(activeTask.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Subtasks */}
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Subtasks:</div>
                                <div className="space-y-2">
                                    {isLoadingSubtasks ? (
                                        <div className="text-xs font-bold text-slate-400 text-center py-4">Loading...</div>
                                    ) : activeSubtasks.length === 0 ? (
                                        <div className="text-xs font-bold text-slate-400 text-center py-4">No subtasks</div>
                                    ) : (
                                        activeSubtasks.map(st => (
                                            <div key={st.id} className={`flex items-center justify-between p-2.5 rounded-xl ${st.is_completed ? 'bg-blue-50/50 border-blue-100' : 'hover:bg-slate-50'} transition-colors group cursor-pointer border border-transparent`}>
                                                <span className={`text-[11px] font-black ${st.is_completed ? 'text-blue-700' : 'text-slate-600'}`}>{st.name}</span>
                                                {st.is_completed ? (
                                                    <CheckCircle2 size={16} className="text-blue-500" />
                                                ) : (
                                                    <Circle size={16} className="text-slate-300 group-hover:text-slate-400" />
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })() : (
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center flex flex-col items-center justify-center h-[300px]">
                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 text-slate-300">
                            <Clock size={24} />
                        </div>
                        <p className="text-sm font-black text-[#1d1d1f]">No task selected</p>
                        <p className="text-xs text-slate-400 mt-2 font-medium">Click on a task in the Gantt chart to view details</p>
                    </div>
                )}

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mt-auto relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl opacity-50 -mr-10 -mt-10 pointer-events-none" />
                    <h4 className="text-[11px] font-black text-[#1d1d1f] tracking-widest uppercase mb-4 text-center">Project Status</h4>
                    <div className="text-center mb-4">
                        <div className="text-4xl font-black text-[#0051e6] tracking-tighter">
                            {completedCount}<span className="text-2xl text-slate-300">/{tasks.length}</span>
                        </div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Tasks completed</div>
                    </div>
                    
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden relative">
                        <div 
                            className="absolute top-0 bottom-0 left-0 bg-[#0051e6] rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="text-right mt-2 text-[9px] font-black text-[#0051e6]">{Math.round(progress)}%</div>
                </div>
            </div>
        </div>
    );
}
