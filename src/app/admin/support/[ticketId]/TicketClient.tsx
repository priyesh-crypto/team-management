"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addSupportMessage, updateTicketStatus } from "../../actions-tier3";
import { Button, Select } from "../../_components/ui";

interface Message {
    id: string;
    author_id: string;
    body: string;
    is_internal: boolean;
    created_at: string;
}

const STATUSES = ["open", "in_progress", "resolved", "closed"];

const STATUS_STYLES: Record<string, string> = {
    open:        "bg-emerald-50 text-emerald-700 border-emerald-200",
    in_progress: "bg-[#0051e6]/10 text-[#0051e6] border-[#0051e6]/20",
    resolved:    "bg-slate-100 text-slate-500 border-slate-200",
    closed:      "bg-[#f5f5f7] text-[#86868b] border-[#e5e5ea]",
};

export function TicketClient({
    ticketId,
    currentStatus,
    initialMessages,
}: {
    ticketId: string;
    currentStatus: string;
    initialMessages: Message[];
}) {
    const [messages, setMessages] = useState(initialMessages);
    const [body, setBody] = useState("");
    const [isInternal, setIsInternal] = useState(false);
    const [status, setStatus] = useState(currentStatus);
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    function handleReply(e: React.FormEvent) {
        e.preventDefault();
        if (!body.trim()) return;
        startTransition(async () => {
            try {
                await addSupportMessage(ticketId, body, isInternal);
                setMessages(prev => [...prev, {
                    id: `opt-${Date.now()}`,
                    author_id: "admin",
                    body: body.trim(),
                    is_internal: isInternal,
                    created_at: new Date().toISOString(),
                }]);
                setBody("");
                toast.success(isInternal ? "Internal note added" : "Reply sent");
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
            }
        });
    }

    function handleStatusChange(newStatus: string) {
        setStatus(newStatus);
        startTransition(async () => {
            try {
                await updateTicketStatus(ticketId, newStatus);
                toast.success(`Status → ${newStatus.replace("_", " ")}`);
                router.refresh();
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
            }
        });
    }

    return (
        <div className="space-y-5">
            {/* Status control */}
            <div className="bg-white rounded-2xl border border-[#e5e5ea] p-4 flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#86868b]">Status</span>
                <div className="flex gap-2">
                    {STATUSES.map(s => (
                        <button
                            key={s}
                            disabled={pending}
                            onClick={() => handleStatusChange(s)}
                            className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-colors ${
                                status === s
                                    ? STATUS_STYLES[s]
                                    : "bg-[#f5f5f7] text-[#86868b] border-transparent hover:border-[#e5e5ea]"
                            }`}
                        >
                            {s.replace("_", " ")}
                        </button>
                    ))}
                </div>
            </div>

            {/* Thread */}
            <div className="space-y-3">
                {messages.map(msg => (
                    <div key={msg.id}
                        className={`rounded-2xl border p-4 ${
                            msg.is_internal
                                ? "bg-amber-50 border-amber-100"
                                : "bg-white border-[#e5e5ea]"
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[#0051e6]/10 text-[#0051e6] text-[9px] font-black flex items-center justify-center">
                                    A
                                </div>
                                <span className="text-[10px] font-black text-[#86868b]">Admin</span>
                                {msg.is_internal && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 font-black uppercase">
                                        Internal note
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] text-[#86868b]">
                                {new Date(msg.created_at).toLocaleString()}
                            </span>
                        </div>
                        <p className="text-sm text-[#1d1d1f] whitespace-pre-wrap">{msg.body}</p>
                    </div>
                ))}
            </div>

            {/* Reply form */}
            {status !== "closed" && (
                <form onSubmit={handleReply} className="bg-white rounded-2xl border border-[#e5e5ea] p-5 space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-wider text-[#86868b]">Reply</div>
                    <textarea
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        rows={4}
                        placeholder="Write your response…"
                        className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5ea] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0051e6]/20 resize-none bg-white"
                    />
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isInternal}
                                onChange={e => setIsInternal(e.target.checked)}
                                className="w-4 h-4 rounded accent-amber-500"
                            />
                            <span className="text-xs font-bold text-[#86868b]">Internal note (admin only)</span>
                        </label>
                        <Button type="submit" disabled={pending || !body.trim()}>
                            {pending ? "Sending…" : isInternal ? "Add note" : "Send reply"}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}
