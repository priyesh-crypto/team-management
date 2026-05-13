"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
    AutomationRule, TRIGGER_TYPES, ACTION_TYPES,
} from "@/app/actions/automations-shared";
import {
    createAutomationRule, toggleAutomationRule, deleteAutomationRule, getAutomationRules,
} from "@/app/actions/automations";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Props {
    rules: AutomationRule[];
}

type Recipe = {
    id: string;
    name: string;
    description: string;
    icon: string;
    rule: {
        name: string;
        trigger_type: string;
        action_type: string;
        conditions: AutomationRule['conditions'];
    };
};

const RECIPES: Recipe[] = [
    {
        id: "notify-high-priority",
        name: "Alert on high-priority tasks",
        description: "Send in-app notification when a Critical or High priority task is created.",
        icon: "🚨",
        rule: {
            name: "Notify on high-priority task",
            trigger_type: "task_created",
            action_type: "send_notification",
            conditions: [{ field: "priority", operator: "eq", value: "High" }],
        },
    },
    {
        id: "slack-on-block",
        name: "Slack the team when blocked",
        description: "Post to Slack the moment a task status flips to Blocked.",
        icon: "💬",
        rule: {
            name: "Slack on Blocked status",
            trigger_type: "task_status_changed",
            action_type: "send_slack",
            conditions: [{ field: "status", operator: "eq", value: "Blocked" }],
        },
    },
    {
        id: "flag-overdue",
        name: "Flag overdue critical work",
        description: "Notify everyone the instant a Critical task slips past its deadline.",
        icon: "⏰",
        rule: {
            name: "Critical overdue alert",
            trigger_type: "task_overdue",
            action_type: "send_notification",
            conditions: [{ field: "priority", operator: "eq", value: "Critical" }],
        },
    },
    {
        id: "review-handoff",
        name: "Hand off to review automatically",
        description: "Move tasks to In Review when status changes to Completed by the assignee.",
        icon: "🤝",
        rule: {
            name: "Auto handoff to review",
            trigger_type: "task_status_changed",
            action_type: "change_status",
            conditions: [{ field: "status", operator: "eq", value: "Completed" }],
        },
    },
    {
        id: "due-soon-nudge",
        name: "Nudge before the deadline",
        description: "Notify the assignee when a task's due date is within 2 days.",
        icon: "🔔",
        rule: {
            name: "Due-date nudge",
            trigger_type: "due_date_approaching",
            action_type: "send_notification",
            conditions: [],
        },
    },
    {
        id: "comment-watch",
        name: "Watch for blockers in comments",
        description: "Send a Slack alert when a comment contains the word 'blocked'.",
        icon: "🔍",
        rule: {
            name: "Blocker mention watcher",
            trigger_type: "comment_added",
            action_type: "send_slack",
            conditions: [{ field: "name", operator: "contains", value: "blocked" }],
        },
    },
];

const TRIGGER_LABEL = Object.fromEntries(TRIGGER_TYPES.map(t => [t.id, t.label]));
const ACTION_LABEL = Object.fromEntries(ACTION_TYPES.map(a => [a.id, a.label]));

function NewRuleForm({ onDone }: { onDone: () => void }) {
    const [pending, startTransition] = useTransition();
    const [form, setForm] = useState<{
        name: string;
        trigger_type: string;
        action_type: string;
        conditions: Array<{ field: string; operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt'; value: string; }>;
    }>({
        name: "",
        trigger_type: "task_created",
        action_type: "send_notification",
        conditions: [],
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
                    conditions: form.conditions,
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
            <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Conditions (Optional)</label>
                {form.conditions.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                        <select value={c.field} onChange={e => {
                            const newC = [...form.conditions];
                            newC[i].field = e.target.value;
                            setForm(f => ({ ...f, conditions: newC }));
                        }} className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                            <option value="priority">Priority</option>
                            <option value="status">Status</option>
                            <option value="name">Task Name</option>
                        </select>
                        <select value={c.operator} onChange={e => {
                            const newC = [...form.conditions];
                            newC[i].operator = e.target.value as any;
                            setForm(f => ({ ...f, conditions: newC }));
                        }} className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                            <option value="eq">is</option>
                            <option value="neq">is not</option>
                            <option value="contains">contains</option>
                        </select>
                        <input value={c.value} onChange={e => {
                            const newC = [...form.conditions];
                            newC[i].value = e.target.value;
                            setForm(f => ({ ...f, conditions: newC }));
                        }} placeholder="Value" className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold" />
                        <button type="button" onClick={() => setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }))} className="text-slate-300 hover:text-red-500">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                <button type="button" onClick={() => setForm(f => ({ ...f, conditions: [...f.conditions, { field: 'priority', operator: 'eq', value: '' }] }))}
                    className="text-[10px] font-black text-[#0051e6] uppercase tracking-widest hover:underline flex items-center gap-1">
                    <Plus size={10} /> Add condition
                </button>
            </div>
            <div className="flex gap-2">
                <button type="submit" disabled={pending}
                    className="flex-1 px-4 py-2 rounded-xl bg-[#0051e6] text-white text-sm font-black disabled:opacity-50">
                    {pending ? "Saving…" : "Create rule"}
                </button>
                <button type="button" onClick={onDone} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">Cancel</button>
            </div>
        </form>
    );
}

export function AutomationsManager({ rules: initialRules }: Props) {
    const [rules, setRules] = useState<AutomationRule[]>(initialRules);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showRecipes, setShowRecipes] = useState(false);
    const [, startTransition] = useTransition();

    async function refresh() {
        try {
            const next = await getAutomationRules();
            setRules(next);
        } catch {
            // swallow — toast surfaces will be triggered by mutating calls
        }
    }

    useEffect(() => {
        (async () => {
            await refresh();
            setLoading(false);
        })();
    }, []);

    function handleToggle(id: string, current: boolean) {
        startTransition(async () => {
            try {
                await toggleAutomationRule(id, !current);
                toast.success(`Rule ${!current ? "enabled" : "paused"}`);
                await refresh();
            } catch { toast.error("Failed to update rule"); }
        });
    }

    function handleDelete(id: string) {
        startTransition(async () => {
            try {
                await deleteAutomationRule(id);
                toast.success("Rule deleted");
                await refresh();
            } catch { toast.error("Failed to delete rule"); }
        });
    }

    function handleApplyRecipe(recipe: Recipe) {
        startTransition(async () => {
            try {
                await createAutomationRule(recipe.rule);
                toast.success(`Recipe applied: ${recipe.name}`);
                await refresh();
            } catch { toast.error("Failed to apply recipe"); }
        });
    }

    const installedTriggers = new Set(rules.map(r => `${r.trigger_type}::${r.action_type}`));

    return (
        <UpgradeGate feature="automations">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ff9500]/10 text-[#ff9500] font-black uppercase tracking-widest">{rules.length} Active Rules</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowRecipes(s => !s)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0051e6]/10 text-[#0051e6] text-[11px] font-black hover:bg-[#0051e6]/20 transition-colors">
                            <Sparkles size={12} /> {showRecipes ? "Hide recipes" : "Recipe library"}
                        </button>
                        <button onClick={() => setShowForm(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff9500] text-white text-[11px] font-black hover:bg-[#e08600] transition-colors">
                            <Plus size={12} /> New rule
                        </button>
                    </div>
                </div>

                {showRecipes && (
                    <div className="bg-gradient-to-br from-[#0051e6]/5 to-[#ff9500]/5 rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Wand2 size={14} className="text-[#0051e6]" />
                            <span className="text-xs font-black text-[#1d1d1f]">One-click Recipes</span>
                            <span className="text-[10px] font-bold text-slate-400">Curated automations, ready to apply</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {RECIPES.map(recipe => {
                                const installed = installedTriggers.has(`${recipe.rule.trigger_type}::${recipe.rule.action_type}`);
                                return (
                                    <div key={recipe.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-[#0051e6]/30 transition-colors">
                                        <div className="text-xl leading-none" aria-hidden>{recipe.icon}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-black text-[#1d1d1f]">{recipe.name}</div>
                                            <div className="text-[10px] font-bold text-slate-400 mt-0.5 line-clamp-2">{recipe.description}</div>
                                        </div>
                                        <button onClick={() => handleApplyRecipe(recipe)} disabled={installed}
                                            className={`flex-shrink-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg transition-colors ${installed ? "bg-slate-100 text-slate-400" : "bg-[#0051e6] text-white hover:bg-[#005bb7]"}`}>
                                            {installed ? "Installed" : "Apply"}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {showForm && <NewRuleForm onDone={async () => { setShowForm(false); await refresh(); }} />}

                {loading && rules.length === 0 && (
                    <div className="text-center py-8 text-sm text-slate-400">Loading rules…</div>
                )}

                {!loading && rules.length === 0 && !showForm && (
                    <div className="text-center py-8 text-sm text-slate-400">
                        No automation rules yet. Try the <button onClick={() => setShowRecipes(true)} className="text-[#0051e6] font-black hover:underline">Recipe library</button> or create one manually.
                    </div>
                )}

                <div className="space-y-2">
                    {rules.map(rule => (
                        <div key={rule.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-black text-[#1d1d1f]">{rule.name}</div>
                                <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                    <span className="text-[#0051e6]">{TRIGGER_LABEL[rule.trigger_type] ?? rule.trigger_type}</span>
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
