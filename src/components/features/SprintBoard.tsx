"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Zap, Plus, Play, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { createSprint, updateSprintStatus, assignTaskToSprint, getSprints, getSprintTasks, type Sprint, type SprintTask } from "@/app/actions/sprints";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

const STATUS_COLORS: Record<string, string> = {
    "To Do": "#86868b",
    "In Progress": "#ff9500",
    "In Review": "#0c64ef",
    "Blocked": "#ff3b30",
    "Completed": "#34c759",
};

const SPRINT_STATUS = {
    planning: { label: "Planning", color: "text-slate-500", bg: "bg-slate-100" },
    active:   { label: "Active",   color: "text-[#34c759]", bg: "bg-[#34c759]/10" },
    completed:{ label: "Done",     color: "text-slate-400", bg: "bg-slate-50" },
};

interface Props {
    orgId: string;
    workspaceId: string;
    sprints: Sprint[];
    sprintTasks: Record<string, SprintTask[]>;
    backlogTasks: SprintTask[];
}

export function SprintBoard({ orgId, workspaceId, sprints: initialSprints, sprintTasks: initialSprintTasks, backlogTasks: initialBacklog }: Props) {
    const [sprints, setSprints] = useState(initialSprints);
    const [sprintTasks, setSprintTasks] = useState(initialSprintTasks);
    const [backlog, setBacklog] = useState(initialBacklog);
    const [showNew, setShowNew] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: "", goal: "", start_date: "", end_date: "" });
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        getSprints(orgId, workspaceId || undefined).then(async ss => {
            setSprints(ss);
            setExpandedId(ss.find(s => s.status === "active")?.id ?? null);
            const taskMap: Record<string, SprintTask[]> = {};
            await Promise.all(ss.map(async s => {
                taskMap[s.id] = await getSprintTasks(s.id);
            }));
            setSprintTasks(taskMap);
        });
    }, [orgId, workspaceId]);

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            const result = await createSprint(orgId, workspaceId, form.name, form.goal, form.start_date, form.end_date);
            if (result.error) { toast.error(result.error); return; }
            const sprint = result.data as Sprint;
            setSprints(ss => [sprint, ...ss]);
            setSprintTasks(st => ({ ...st, [sprint.id]: [] }));
            setShowNew(false);
            setForm({ name: "", goal: "", start_date: "", end_date: "" });
            toast.success("Sprint created");
        });
    }

    function handleSprintStatus(sprintId: string, status: string) {
        startTransition(async () => {
            const result = await updateSprintStatus(sprintId, status);
            if (result.error) { toast.error(result.error); return; }
            setSprints(ss => ss.map(s => s.id === sprintId ? { ...s, status } : s));
        });
    }

    function handleMoveToSprint(task: SprintTask, sprintId: string) {
        startTransition(async () => {
            const result = await assignTaskToSprint(task.id, sprintId);
            if (result.error) { toast.error(result.error); return; }
            setBacklog(b => b.filter(t => t.id !== task.id));
            setSprintTasks(st => ({ ...st, [sprintId]: [...(st[sprintId] ?? []), task] }));
        });
    }

    function handleMoveToBacklog(task: SprintTask, sprintId: string) {
        startTransition(async () => {
            const result = await assignTaskToSprint(task.id, null);
            if (result.error) { toast.error(result.error); return; }
            setSprintTasks(st => ({ ...st, [sprintId]: (st[sprintId] ?? []).filter(t => t.id !== task.id) }));
            setBacklog(b => [...b, task]);
        });
    }

    function sprintVelocity(tasks: SprintTask[]) {
        const total = tasks.reduce((s, t) => s + (t.story_points ?? 0), 0);
        const done = tasks.filter(t => t.status === "Completed").reduce((s, t) => s + (t.story_points ?? 0), 0);
        return { total, done };
    }

    const activeSprint = sprints.find(s => s.status === "active");

    return (
        <UpgradeGate feature="sprints">
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap size={16} className="text-[#ff9500]" />
                        <span className="text-sm font-black text-[#1d1d1f]">Sprints</span>
                    </div>
                    <button onClick={() => setShowNew(s => !s)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0c64ef] text-white text-[11px] font-black hover:bg-[#005bb7] transition-colors">
                        <Plus size={11} /> New sprint
                    </button>
                </div>

                {showNew && (
                    <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                                placeholder="Sprint name" className="col-span-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none" />
                            <input value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                                placeholder="Sprint goal (optional)" className="col-span-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none" />
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Start</label>
                                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">End</label>
                                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} required
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={pending} className="flex-1 px-3 py-2 rounded-xl bg-[#0c64ef] text-white text-sm font-black disabled:opacity-50">
                                {pending ? "Creating…" : "Create sprint"}
                            </button>
                            <button type="button" onClick={() => setShowNew(false)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">Cancel</button>
                        </div>
                    </form>
                )}

                {/* Sprint list */}
                {sprints.map(sprint => {
                    const tasks = sprintTasks[sprint.id] ?? [];
                    const { total, done } = sprintVelocity(tasks);
                    const cfg = SPRINT_STATUS[sprint.status as keyof typeof SPRINT_STATUS] ?? SPRINT_STATUS.planning;
                    const expanded = expandedId === sprint.id;
                    const daysLeft = Math.ceil((new Date(sprint.end_date).getTime() - Date.now()) / 86400000);

                    return (
                        <div key={sprint.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                onClick={() => setExpandedId(id => id === sprint.id ? null : sprint.id)}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-[#1d1d1f]">{sprint.name}</span>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                                    </div>
                                    {sprint.goal && <div className="text-xs text-slate-400 mt-0.5 truncate">{sprint.goal}</div>}
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(sprint.start_date).toLocaleDateString()} – {new Date(sprint.end_date).toLocaleDateString()}
                                        </span>
                                        {sprint.status === "active" && daysLeft >= 0 && (
                                            <span className="text-[10px] font-bold text-[#ff9500]">{daysLeft}d left</span>
                                        )}
                                        {total > 0 && (
                                            <span className="text-[10px] font-bold text-slate-500">{done}/{total} pts</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {sprint.status === "planning" && !activeSprint && (
                                        <button onClick={e => { e.stopPropagation(); handleSprintStatus(sprint.id, "active"); }} disabled={pending}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#34c759]/10 text-[#34c759] text-[11px] font-black hover:bg-[#34c759]/20 transition-colors">
                                            <Play size={11} /> Start
                                        </button>
                                    )}
                                    {sprint.status === "active" && (
                                        <button onClick={e => { e.stopPropagation(); handleSprintStatus(sprint.id, "completed"); }} disabled={pending}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-black hover:bg-slate-200 transition-colors">
                                            <CheckCircle2 size={11} /> Complete
                                        </button>
                                    )}
                                    {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                </div>
                            </div>

                            {expanded && (
                                <div className="border-t border-slate-100">
                                    {/* Progress bar */}
                                    {total > 0 && (
                                        <div className="px-5 pt-3">
                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-[#34c759] rounded-full transition-all duration-500"
                                                    style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="divide-y divide-slate-50">
                                        {tasks.map(task => (
                                            <div key={task.id} className="flex items-center gap-3 px-5 py-3 group">
                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[task.status] ?? "#86868b" }} />
                                                <span className="flex-1 text-sm font-bold text-[#1d1d1f] truncate">{task.name}</span>
                                                {task.story_points != null && (
                                                    <span className="text-[10px] font-black px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{task.story_points}pt</span>
                                                )}
                                                <button onClick={() => handleMoveToBacklog(task, sprint.id)} disabled={pending}
                                                    className="text-[10px] font-bold text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    → Backlog
                                                </button>
                                            </div>
                                        ))}
                                        {tasks.length === 0 && (
                                            <div className="py-4 text-center text-xs text-slate-400">No tasks in this sprint.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Backlog */}
                {backlog.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Backlog ({backlog.length})</span>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {backlog.map(task => {
                                const planningSprint = sprints.find(s => s.status === "planning");
                                return (
                                    <div key={task.id} className="flex items-center gap-3 px-5 py-3 group">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[task.status] ?? "#86868b" }} />
                                        <span className="flex-1 text-sm font-bold text-[#1d1d1f] truncate">{task.name}</span>
                                        {planningSprint && (
                                            <button onClick={() => handleMoveToSprint(task, planningSprint.id)} disabled={pending}
                                                className="text-[10px] font-bold text-[#0c64ef] hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                                                + Add to {planningSprint.name}
                                            </button>
                                        )}
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
