"use client";

import React, { useState, useTransition } from "react";
import { Flag, Plus, Trash2, CheckCircle2, Circle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { createMilestone, updateMilestoneStatus, deleteMilestone, type Milestone } from "@/app/actions/milestones";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

const STATUS_CONFIG = {
    active: { label: "Active", icon: Circle, color: "text-[#0051e6]", bg: "bg-[#0051e6]/10" },
    completed: { label: "Completed", icon: CheckCircle2, color: "text-[#34c759]", bg: "bg-[#34c759]/10" },
    cancelled: { label: "Cancelled", icon: XCircle, color: "text-slate-400", bg: "bg-slate-100" },
};

const PRESET_COLORS = ["#0051e6", "#34c759", "#ff9500", "#ff3b30", "#af52de", "#5ac8fa"];

interface Props {
    orgId: string;
    workspaceId: string;
    milestones: Milestone[];
}

export function MilestonesPanel({ orgId, workspaceId, milestones: initialMilestones }: Props) {
    const [milestones, setMilestones] = useState(initialMilestones);
    const [showNew, setShowNew] = useState(false);
    const [form, setForm] = useState({ name: "", description: "", due_date: "", color: "#0051e6" });
    const [pending, startTransition] = useTransition();

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            const result = await createMilestone(orgId, workspaceId, form.name, form.description, form.due_date || null, form.color);
            if (result.error) { toast.error(result.error); return; }
            setMilestones(ms => [...ms, result.data as Milestone]);
            setShowNew(false);
            setForm({ name: "", description: "", due_date: "", color: "#0051e6" });
            toast.success("Milestone created");
        });
    }

    function handleStatus(id: string, status: string) {
        startTransition(async () => {
            const result = await updateMilestoneStatus(id, status);
            if (result.error) { toast.error(result.error); return; }
            setMilestones(ms => ms.map(m => m.id === id ? { ...m, status } : m));
        });
    }

    function handleDelete(id: string) {
        startTransition(async () => {
            const result = await deleteMilestone(id);
            if (result.error) { toast.error(result.error); return; }
            setMilestones(ms => ms.filter(m => m.id !== id));
            toast.success("Milestone deleted");
        });
    }

    const now = new Date();

    return (
        <UpgradeGate feature="milestones">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                            <Flag size={18} className="text-slate-600" />
                        </div>
                        <div>
                            <div className="text-sm font-black text-[#1d1d1f]">Milestones</div>
                            <div className="text-xs text-slate-400">{milestones.filter(m => m.status === "active").length} active</div>
                        </div>
                    </div>
                    <button onClick={() => setShowNew(s => !s)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0051e6] text-white text-[11px] font-black hover:bg-[#005bb7] transition-colors">
                        <Plus size={12} /> New
                    </button>
                </div>

                {showNew && (
                    <form onSubmit={handleCreate} className="px-6 py-4 border-b border-slate-100 space-y-3">
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                            placeholder="Milestone name" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none" />
                        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Description (optional)" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none" />
                        <div className="flex gap-3">
                            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none" />
                            <div className="flex gap-1.5 items-center">
                                {PRESET_COLORS.map(c => (
                                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? "border-slate-500 scale-110" : "border-transparent hover:scale-105"}`}
                                        style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={pending} className="flex-1 px-3 py-2 rounded-xl bg-[#0051e6] text-white text-sm font-black disabled:opacity-50">
                                {pending ? "Creating…" : "Create milestone"}
                            </button>
                            <button type="button" onClick={() => setShowNew(false)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">Cancel</button>
                        </div>
                    </form>
                )}

                <div className="divide-y divide-slate-50">
                    {milestones.length === 0 && !showNew && (
                        <div className="py-8 text-center text-sm text-slate-400">No milestones yet.</div>
                    )}
                    {milestones.map(m => {
                        const cfg = STATUS_CONFIG[m.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;
                        const Icon = cfg.icon;
                        const isOverdue = m.due_date && m.status === "active" && new Date(m.due_date) < now;

                        return (
                            <div key={m.id} className="flex items-start gap-3 px-6 py-4 hover:bg-slate-50/50 transition-colors group">
                                <div className="w-1 h-full rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: m.color, minHeight: "40px" }} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-[#1d1d1f]">{m.name}</span>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                                            {cfg.label}
                                        </span>
                                        {isOverdue && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#ff3b30]/10 text-[#ff3b30]">Overdue</span>}
                                    </div>
                                    {m.description && <div className="text-xs text-slate-400 mt-0.5">{m.description}</div>}
                                    {m.due_date && (
                                        <div className="text-[10px] text-slate-400 mt-1">
                                            Due {new Date(m.due_date).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {m.status === "active" && (
                                        <button onClick={() => handleStatus(m.id, "completed")} disabled={pending}
                                            className="p-1.5 rounded-lg text-slate-300 hover:text-[#34c759] hover:bg-[#34c759]/10 transition-colors" title="Mark complete">
                                            <CheckCircle2 size={13} />
                                        </button>
                                    )}
                                    {m.status === "completed" && (
                                        <button onClick={() => handleStatus(m.id, "active")} disabled={pending}
                                            className="p-1.5 rounded-lg text-slate-300 hover:text-[#0051e6] hover:bg-[#0051e6]/10 transition-colors" title="Reopen">
                                            <Circle size={13} />
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(m.id)} disabled={pending}
                                        className="p-1.5 rounded-lg text-slate-300 hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </UpgradeGate>
    );
}
