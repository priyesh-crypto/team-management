"use client";

import React, { useState, useTransition } from "react";
import { Webhook, Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

const ALL_EVENTS = [
    "task.created", "task.updated", "task.status_changed", "task.deleted",
    "member.invited", "member.joined", "comment.added",
];

interface OrgWebhook {
    id: string;
    url: string;
    events: string[];
    is_active: boolean;
    failure_count: number;
    last_triggered_at: string | null;
    created_at: string;
}

interface Props {
    orgId: string;
    webhooks: OrgWebhook[];
}

export function WebhooksManager({ orgId, webhooks: initialWebhooks }: Props) {
    const [webhooks, setWebhooks] = useState(initialWebhooks);
    const [showNew, setShowNew] = useState(false);
    const [newUrl, setNewUrl] = useState("");
    const [newEvents, setNewEvents] = useState<string[]>(["task.created", "task.status_changed"]);
    const [pending, startTransition] = useTransition();

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (newEvents.length === 0) { toast.error("Select at least one event"); return; }
        startTransition(async () => {
            try {
                const res = await fetch("/api/v1/webhooks", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: newUrl, events: newEvents, orgId }),
                });
                const json = await res.json() as { data?: OrgWebhook; error?: string };
                if (!res.ok) throw new Error(json.error ?? "Failed");
                if (json.data) setWebhooks(w => [json.data!, ...w]);
                setShowNew(false);
                setNewUrl("");
                setNewEvents(["task.created", "task.status_changed"]);
                toast.success("Webhook registered");
            } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Failed to create webhook");
            }
        });
    }

    function handleDelete(id: string) {
        startTransition(async () => {
            try {
                await fetch(`/api/v1/webhooks?id=${id}`, { method: "DELETE" });
                setWebhooks(w => w.filter(wh => wh.id !== id));
                toast.success("Webhook removed");
            } catch {
                toast.error("Failed to remove webhook");
            }
        });
    }

    return (
        <UpgradeGate feature="webhooks_api">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                            <Webhook size={18} className="text-slate-600" />
                        </div>
                        <div>
                            <div className="text-sm font-black text-[#1d1d1f]">Webhooks</div>
                            <div className="text-xs text-slate-400">Receive real-time event notifications via HTTP</div>
                        </div>
                    </div>
                    <button onClick={() => setShowNew(s => !s)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0051e6] text-white text-[11px] font-black hover:bg-[#005bb7] transition-colors">
                        <Plus size={12} /> Add endpoint
                    </button>
                </div>

                {showNew && (
                    <form onSubmit={handleCreate} className="px-6 py-4 border-b border-slate-100 space-y-3">
                        <input
                            value={newUrl}
                            onChange={e => setNewUrl(e.target.value)}
                            placeholder="https://your-server.com/webhook"
                            type="url"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none"
                            required
                        />
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Events to send</div>
                            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                                {ALL_EVENTS.map(ev => (
                                    <label key={ev} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newEvents.includes(ev)}
                                            onChange={e => setNewEvents(s => e.target.checked ? [...s, ev] : s.filter(x => x !== ev))}
                                            className="rounded"
                                        />
                                        <span className="text-xs font-bold text-slate-700">{ev}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={pending}
                                className="flex-1 px-3 py-2 rounded-xl bg-[#0051e6] text-white text-sm font-black disabled:opacity-50">
                                {pending ? "Saving…" : "Register webhook"}
                            </button>
                            <button type="button" onClick={() => setShowNew(false)}
                                className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                <div className="divide-y divide-slate-50">
                    {webhooks.length === 0 && (
                        <div className="py-8 text-center text-sm text-slate-400">No webhooks yet.</div>
                    )}
                    {webhooks.map(wh => (
                        <div key={wh.id} className="flex items-start gap-4 px-6 py-4">
                            <div className="mt-0.5">
                                {wh.failure_count > 3
                                    ? <AlertCircle size={16} className="text-[#ff3b30]" />
                                    : <CheckCircle2 size={16} className="text-[#34c759]" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-black text-[#1d1d1f] truncate">{wh.url}</div>
                                <div className="text-[10px] font-bold text-slate-400 mt-0.5 flex flex-wrap gap-1 mt-1">
                                    {wh.events.map(ev => (
                                        <span key={ev} className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">{ev}</span>
                                    ))}
                                </div>
                                {wh.failure_count > 0 && (
                                    <div className="text-[10px] font-bold text-[#ff3b30] mt-1">{wh.failure_count} recent failures</div>
                                )}
                                {wh.last_triggered_at && (
                                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                        Last triggered {new Date(wh.last_triggered_at).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => handleDelete(wh.id)} disabled={pending}
                                className="p-2 rounded-lg text-slate-300 hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </UpgradeGate>
    );
}
