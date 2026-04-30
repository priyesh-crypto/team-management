"use client";

import React, { useState, useTransition } from "react";
import { RefreshCw, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import {
    RecurringTemplate,
    createRecurringTemplate,
    toggleRecurringTemplate,
    deleteRecurringTemplate,
} from "@/app/actions/recurring-tasks";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Props {
    templates: RecurringTemplate[];
    workspaceId?: string;
    projectId?: string;
}

const FREQ_LABELS: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
};

function NewTemplateForm({
    workspaceId,
    projectId,
    onDone,
}: {
    workspaceId?: string;
    projectId?: string;
    onDone: () => void;
}) {
    const [pending, startTransition] = useTransition();
    const [form, setForm] = useState({
        name: "",
        frequency: "weekly" as "daily" | "weekly" | "monthly",
        interval: 1,
        priority: "Medium",
        notes: "",
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) return;
        startTransition(async () => {
            try {
                await createRecurringTemplate({
                    ...form,
                    workspace_id: workspaceId,
                    project_id: projectId,
                });
                toast.success("Recurring template created");
                onDone();
            } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Failed to create template");
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Task name</label>
                <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Weekly status report"
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c64ef]/20"
                    required
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Frequency</label>
                    <select
                        value={form.frequency}
                        onChange={e => setForm(f => ({ ...f, frequency: e.target.value as "daily" | "weekly" | "monthly" }))}
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none"
                    >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Every N</label>
                    <input
                        type="number"
                        min={1}
                        max={30}
                        value={form.interval}
                        onChange={e => setForm(f => ({ ...f, interval: Number(e.target.value) }))}
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none"
                    />
                </div>
            </div>
            <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Priority</label>
                <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none"
                >
                    {["Urgent", "High", "Medium", "Low"].map(p => <option key={p}>{p}</option>)}
                </select>
            </div>
            <div className="flex gap-2 pt-1">
                <button
                    type="submit"
                    disabled={pending}
                    className="flex-1 px-4 py-2 rounded-xl bg-[#0c64ef] text-white text-sm font-black disabled:opacity-50"
                >
                    {pending ? "Saving…" : "Create template"}
                </button>
                <button type="button" onClick={onDone} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">
                    Cancel
                </button>
            </div>
        </form>
    );
}

export function RecurringTasksManager({ templates, workspaceId, projectId }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [, startTransition] = useTransition();

    function handleToggle(id: string, current: boolean) {
        startTransition(async () => {
            try {
                await toggleRecurringTemplate(id, !current);
                toast.success(`Template ${!current ? "activated" : "paused"}`);
            } catch {
                toast.error("Failed to update template");
            }
        });
    }

    function handleDelete(id: string) {
        startTransition(async () => {
            try {
                await deleteRecurringTemplate(id);
                toast.success("Template deleted");
            } catch {
                toast.error("Failed to delete template");
            }
        });
    }

    return (
        <UpgradeGate feature="recurring_tasks">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <RefreshCw size={16} className="text-[#0c64ef]" />
                        <h3 className="text-sm font-black text-[#1d1d1f]">Recurring Tasks</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0c64ef]/10 text-[#0c64ef] font-black">{templates.length}</span>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0c64ef] text-white text-[11px] font-black hover:bg-[#005bb7] transition-colors"
                    >
                        <Plus size={12} />
                        New template
                    </button>
                </div>

                {showForm && (
                    <NewTemplateForm
                        workspaceId={workspaceId}
                        projectId={projectId}
                        onDone={() => setShowForm(false)}
                    />
                )}

                {templates.length === 0 && !showForm && (
                    <div className="text-center py-8 text-sm text-slate-400">
                        No recurring templates yet. Create one to auto-generate tasks on a schedule.
                    </div>
                )}

                <div className="space-y-2">
                    {templates.map(t => (
                        <div
                            key={t.id}
                            className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm"
                        >
                            <div>
                                <div className="text-sm font-black text-[#1d1d1f]">{t.name}</div>
                                <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                    Every {t.interval} {FREQ_LABELS[t.frequency].toLowerCase()}{t.interval > 1 ? "s" : ""} · {t.priority}
                                    {t.next_run_at && ` · Next: ${new Date(t.next_run_at).toLocaleDateString()}`}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleToggle(t.id, t.is_active)}
                                    className={`transition-colors ${t.is_active ? "text-[#34c759]" : "text-slate-300"}`}
                                    title={t.is_active ? "Pause" : "Activate"}
                                >
                                    {t.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                                </button>
                                <button
                                    onClick={() => handleDelete(t.id)}
                                    className="p-1.5 rounded-lg text-slate-300 hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </UpgradeGate>
    );
}
