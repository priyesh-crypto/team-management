"use client";

import React, { useState, useTransition } from "react";
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import {
    AutomationRule, TRIGGER_TYPES, ACTION_TYPES,
    createAutomationRule, toggleAutomationRule, deleteAutomationRule,
} from "@/app/actions/automations";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Props {
    rules: AutomationRule[];
}

const TRIGGER_LABEL = Object.fromEntries(TRIGGER_TYPES.map(t => [t.id, t.label]));
const ACTION_LABEL = Object.fromEntries(ACTION_TYPES.map(a => [a.id, a.label]));

function NewRuleForm({ onDone }: { onDone: () => void }) {
    const [pending, startTransition] = useTransition();
    const [form, setForm] = useState({
        name: "",
        trigger_type: "task_created",
        action_type: "send_notification",
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) return;
        startTransition(async () => {
            try {
                await createAutomationRule({
                    name: form.name,
                    trigger_type: form.trigger_type,
                    action_type: form.action_type,
                });
                toast.success("Automation rule created");
                onDone();
            } catch {
                toast.error("Failed to create rule");
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rule name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Notify manager on task creation"
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">When (trigger)</label>
                    <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none">
                        {TRIGGER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Then (action)</label>
                    <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none">
                        {ACTION_TYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                </div>
            </div>
            <p className="text-[10px] text-slate-400">Advanced conditions (filters, user targets, channel) can be configured after creation.</p>
            <div className="flex gap-2">
                <button type="submit" disabled={pending}
                    className="flex-1 px-4 py-2 rounded-xl bg-[#0c64ef] text-white text-sm font-black disabled:opacity-50">
                    {pending ? "Saving…" : "Create rule"}
                </button>
                <button type="button" onClick={onDone} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">Cancel</button>
            </div>
        </form>
    );
}

export function AutomationsManager({ rules }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [, startTransition] = useTransition();

    function handleToggle(id: string, current: boolean) {
        startTransition(async () => {
            try {
                await toggleAutomationRule(id, !current);
                toast.success(`Rule ${!current ? "enabled" : "paused"}`);
            } catch { toast.error("Failed to update rule"); }
        });
    }

    function handleDelete(id: string) {
        startTransition(async () => {
            try {
                await deleteAutomationRule(id);
                toast.success("Rule deleted");
            } catch { toast.error("Failed to delete rule"); }
        });
    }

    return (
        <UpgradeGate feature="automations">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap size={16} className="text-[#ff9500]" />
                        <h3 className="text-sm font-black text-[#1d1d1f]">Automations</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ff9500]/10 text-[#ff9500] font-black">{rules.length}</span>
                    </div>
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff9500] text-white text-[11px] font-black hover:bg-[#e08600] transition-colors">
                        <Plus size={12} /> New rule
                    </button>
                </div>

                {showForm && <NewRuleForm onDone={() => setShowForm(false)} />}

                {rules.length === 0 && !showForm && (
                    <div className="text-center py-8 text-sm text-slate-400">
                        No automation rules yet. Create one to auto-respond to task events.
                    </div>
                )}

                <div className="space-y-2">
                    {rules.map(rule => (
                        <div key={rule.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-black text-[#1d1d1f]">{rule.name}</div>
                                <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                    <span className="text-[#0c64ef]">{TRIGGER_LABEL[rule.trigger_type] ?? rule.trigger_type}</span>
                                    {" → "}
                                    <span className="text-[#ff9500]">{ACTION_LABEL[rule.action_type] ?? rule.action_type}</span>
                                    {rule.run_count > 0 && ` · ran ${rule.run_count}×`}
                                </div>
                            </div>
                            <button onClick={() => handleToggle(rule.id, rule.is_active)}
                                className={`transition-colors flex-shrink-0 ${rule.is_active ? "text-[#34c759]" : "text-slate-300"}`}>
                                {rule.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                            </button>
                            <button onClick={() => handleDelete(rule.id)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 flex-shrink-0 transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </UpgradeGate>
    );
}
