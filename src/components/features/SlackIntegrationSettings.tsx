"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, Check, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

const SLACK_EVENTS = [
    { id: "task.created", label: "Task created" },
    { id: "task.completed", label: "Task completed" },
    { id: "task.overdue", label: "Task overdue" },
    { id: "task.status_changed", label: "Status changed" },
    { id: "comment.added", label: "Comment added" },
];

interface Integration {
    id: string;
    is_active: boolean;
    config: {
        webhook_url: string;
        channel_name: string;
        events: string[];
    };
    connected_at: string;
}

export function SlackIntegrationSettings() {
    const [integration, setIntegration] = useState<Integration | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState("");
    const [channelName, setChannelName] = useState("#general");
    const [events, setEvents] = useState<string[]>(["task.created", "task.completed", "task.overdue"]);

    useEffect(() => {
        fetch("/api/integrations/slack")
            .then(r => r.json() as Promise<{ integration: Integration | null }>)
            .then(({ integration: data }) => {
                setIntegration(data);
                if (data?.config) {
                    setWebhookUrl(data.config.webhook_url ?? "");
                    setChannelName(data.config.channel_name ?? "#general");
                    setEvents(data.config.events ?? []);
                }
            })
            .finally(() => setLoading(false));
    }, []);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/integrations/slack", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ webhookUrl, channelName, events }),
            });
            const json = await res.json() as { error?: string };
            if (!res.ok) throw new Error(json.error ?? "Failed");
            toast.success("Slack integration saved");
            // Refresh
            const r2 = await fetch("/api/integrations/slack");
            const { integration: updated } = await r2.json() as { integration: Integration | null };
            setIntegration(updated);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    async function handleDisconnect() {
        const res = await fetch("/api/integrations/slack", { method: "DELETE" });
        if (res.ok) {
            setIntegration(null);
            setWebhookUrl("");
            toast.success("Slack disconnected");
        }
    }

    function toggleEvent(id: string) {
        setEvents(ev => ev.includes(id) ? ev.filter(e => e !== id) : [...ev, id]);
    }

    return (
        <UpgradeGate feature="slack_integration">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-[#4A154B]/10 flex items-center justify-center">
                        <MessageSquare size={18} className="text-[#4A154B]" />
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-black text-[#1d1d1f]">Slack</div>
                        <div className="text-xs text-slate-400">Get task notifications in your Slack channels</div>
                    </div>
                    {integration?.is_active && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-700">Connected</span>
                        </div>
                    )}
                </div>

                <div className="px-6 py-5">
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 size={20} className="animate-spin text-slate-300" />
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                    Incoming Webhook URL
                                    <a
                                        href="https://api.slack.com/messaging/webhooks"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-1.5 text-[#0c64ef] inline-flex items-center gap-0.5"
                                    >
                                        How to get one <ExternalLink size={9} />
                                    </a>
                                </label>
                                <input
                                    type="url"
                                    value={webhookUrl}
                                    onChange={e => setWebhookUrl(e.target.value)}
                                    placeholder="https://hooks.slack.com/services/..."
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c64ef]/20"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                    Channel name
                                </label>
                                <input
                                    value={channelName}
                                    onChange={e => setChannelName(e.target.value)}
                                    placeholder="#general"
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c64ef]/20"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-2">
                                    Notify me when
                                </label>
                                <div className="space-y-2">
                                    {SLACK_EVENTS.map(ev => (
                                        <label key={ev.id} className="flex items-center gap-3 cursor-pointer group">
                                            <button
                                                type="button"
                                                onClick={() => toggleEvent(ev.id)}
                                                className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border transition-colors ${
                                                    events.includes(ev.id)
                                                        ? "bg-[#0c64ef] border-[#0c64ef] text-white"
                                                        : "border-slate-200 hover:border-[#0c64ef]/50"
                                                }`}
                                            >
                                                {events.includes(ev.id) && <Check size={11} strokeWidth={3} />}
                                            </button>
                                            <span className="text-sm font-bold text-slate-700 group-hover:text-[#1d1d1f]">{ev.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0c64ef] text-white text-sm font-black hover:bg-[#005bb7] disabled:opacity-50 transition-colors"
                                >
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                                    {saving ? "Saving…" : integration ? "Update" : "Connect Slack"}
                                </button>
                                {integration && (
                                    <button
                                        type="button"
                                        onClick={handleDisconnect}
                                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#ff3b30]/20 text-[#ff3b30] text-sm font-black hover:bg-[#ff3b30]/10 transition-colors"
                                    >
                                        <Trash2 size={14} /> Disconnect
                                    </button>
                                )}
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </UpgradeGate>
    );
}
