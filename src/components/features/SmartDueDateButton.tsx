"use client";

import React, { useState } from "react";
import { CalendarDays, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Props {
    taskName: string;
    taskNotes?: string;
    priority?: string;
    estimatedHours?: number;
    startDate?: string;
    onSuggest: (date: string) => void;
}

export function SmartDueDateButton({
    taskName,
    taskNotes,
    priority,
    estimatedHours,
    startDate,
    onSuggest,
}: Props) {
    const [loading, setLoading] = useState(false);
    const [suggestion, setSuggestion] = useState<{ date: string; reasoning: string } | null>(null);

    async function getSuggestion() {
        if (!taskName.trim()) {
            toast.error("Enter a task name first");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/ai/due-date", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ taskName, taskNotes, priority, estimatedHours, startDate }),
            });
            const json = await res.json() as { suggested_date?: string; reasoning?: string; error?: string };
            if (!res.ok) throw new Error(json.error ?? "AI request failed");
            if (json.suggested_date) {
                setSuggestion({ date: json.suggested_date, reasoning: json.reasoning ?? "" });
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to get suggestion");
        } finally {
            setLoading(false);
        }
    }

    function apply() {
        if (!suggestion) return;
        onSuggest(suggestion.date);
        setSuggestion(null);
        toast.success("Due date applied");
    }

    return (
        <UpgradeGate feature="smart_due_dates">
            <div className="flex items-center gap-2">
                <button
                    onClick={getSuggestion}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#0c64ef]/20 bg-[#0c64ef]/5 text-[#0c64ef] text-[10px] font-black hover:bg-[#0c64ef]/10 transition-colors disabled:opacity-50"
                    title="AI-suggest due date"
                >
                    {loading ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                    Suggest date
                </button>

                {suggestion && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                        <CalendarDays size={11} className="text-emerald-600" />
                        <div>
                            <span className="text-[11px] font-black text-emerald-700">
                                {new Date(suggestion.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                            <span className="text-[10px] text-emerald-600 ml-1 hidden sm:inline">— {suggestion.reasoning}</span>
                        </div>
                        <button
                            onClick={apply}
                            className="text-[10px] font-black text-emerald-700 underline hover:no-underline ml-1"
                        >
                            Apply
                        </button>
                        <button onClick={() => setSuggestion(null)} className="text-emerald-400 hover:text-emerald-600 ml-1">×</button>
                    </div>
                )}
            </div>
        </UpgradeGate>
    );
}
