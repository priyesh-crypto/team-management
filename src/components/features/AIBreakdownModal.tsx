"use client";

import React, { useState } from "react";
import { Sparkles, Plus, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Suggestion {
    name: string;
    estimated_hours: number;
}

interface Props {
    taskId: string;
    taskName: string;
    taskNotes?: string;
    onAccept: (subtasks: Suggestion[]) => Promise<void>;
}

function Modal({
    taskId,
    taskName,
    taskNotes,
    onAccept,
    onClose,
}: Props & { onClose: () => void }) {
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [accepting, setAccepting] = useState(false);
    const [generated, setGenerated] = useState(false);

    async function generate() {
        setLoading(true);
        try {
            const res = await fetch("/api/ai/breakdown", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ taskId, taskName, taskNotes }),
            });
            const json = await res.json() as { suggestions?: Suggestion[]; error?: string };
            if (!res.ok) throw new Error(json.error ?? "AI request failed");
            setSuggestions(json.suggestions ?? []);
            setSelected(new Set((json.suggestions ?? []).map((_, i) => i)));
            setGenerated(true);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to generate suggestions");
        } finally {
            setLoading(false);
        }
    }

    function toggleItem(i: number) {
        setSelected(s => {
            const n = new Set(s);
            n.has(i) ? n.delete(i) : n.add(i);
            return n;
        });
    }

    async function handleAccept() {
        const chosen = suggestions.filter((_, i) => selected.has(i));
        if (chosen.length === 0) return;
        setAccepting(true);
        try {
            await onAccept(chosen);
            toast.success(`${chosen.length} subtasks created`);
            onClose();
        } catch {
            toast.error("Failed to create subtasks");
        } finally {
            setAccepting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#0c64ef]/10 flex items-center justify-center">
                            <Sparkles size={16} className="text-[#0c64ef]" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">AI Assistant</div>
                            <div className="text-sm font-black text-[#1d1d1f]">Break down task into subtasks</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
                        <X size={16} />
                    </button>
                </div>

                {/* Task context */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Task</div>
                    <div className="text-sm font-bold text-[#1d1d1f]">{taskName}</div>
                    {taskNotes && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{taskNotes}</div>}
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    {!generated ? (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-3">✨</div>
                            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                                Claude will analyze your task and suggest concrete, actionable subtasks with time estimates.
                            </p>
                            <button
                                onClick={generate}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0c64ef] text-white text-sm font-black hover:bg-[#005bb7] disabled:opacity-50 transition-colors"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                {loading ? "Generating…" : "Generate subtasks"}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                    {suggestions.length} suggestions — select to create
                                </span>
                                <button
                                    onClick={generate}
                                    disabled={loading}
                                    className="text-[11px] font-black text-[#0c64ef] hover:underline disabled:opacity-50"
                                >
                                    Regenerate
                                </button>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => toggleItem(i)}
                                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-start gap-3 ${
                                            selected.has(i)
                                                ? "border-[#0c64ef] bg-[#0c64ef]/5"
                                                : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${
                                            selected.has(i) ? "bg-[#0c64ef] text-white" : "border border-slate-200"
                                        }`}>
                                            {selected.has(i) && <Check size={11} strokeWidth={3} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-[#1d1d1f]">{s.name}</div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">{s.estimated_hours}h estimated</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {generated && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400">{selected.size} of {suggestions.length} selected</span>
                        <div className="flex gap-2">
                            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50">
                                Cancel
                            </button>
                            <button
                                onClick={handleAccept}
                                disabled={selected.size === 0 || accepting}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0c64ef] text-white text-sm font-black disabled:opacity-50 hover:bg-[#005bb7] transition-colors"
                            >
                                {accepting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                Create {selected.size} subtask{selected.size !== 1 ? "s" : ""}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export function AIBreakdownButton({
    taskId,
    taskName,
    taskNotes,
    onAccept,
}: Props) {
    const [open, setOpen] = useState(false);
    return (
        <UpgradeGate feature="ai_breakdown">
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#0c64ef] to-[#7c3aed] text-white text-[11px] font-black hover:opacity-90 transition-opacity shadow-sm"
            >
                <Sparkles size={12} />
                AI breakdown
            </button>
            {open && (
                <Modal
                    taskId={taskId}
                    taskName={taskName}
                    taskNotes={taskNotes}
                    onAccept={onAccept}
                    onClose={() => setOpen(false)}
                />
            )}
        </UpgradeGate>
    );
}
