"use client";

import React, { useState } from "react";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface AISummary {
    id: string;
    week_start: string;
    summary_text: string;
    stats_snapshot: {
        new_tasks: number;
        completed_tasks: number;
        overdue_tasks: number;
        high_priority: number;
    };
    created_at: string;
}

interface Props {
    initialSummaries: AISummary[];
}

export function AISummaryWidget({ initialSummaries }: Props) {
    const [summaries, setSummaries] = useState<AISummary[]>(initialSummaries);
    const [generating, setGenerating] = useState(false);
    const [expanded, setExpanded] = useState(true);

    const latest = summaries[0];

    async function generateSummary() {
        setGenerating(true);
        try {
            const res = await fetch("/api/ai/weekly-summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            });
            const json = await res.json() as { summary?: AISummary; error?: string };
            if (!res.ok) throw new Error(json.error ?? "Failed");
            if (json.summary) {
                setSummaries(s => [json.summary!, ...s.filter(x => x.id !== json.summary!.id)]);
                toast.success("Weekly summary generated");
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to generate summary");
        } finally {
            setGenerating(false);
        }
    }

    return (
        <UpgradeGate feature="ai_weekly_summary">
            <div className="bg-gradient-to-br from-[#0051e6]/5 to-[#7c3aed]/5 rounded-2xl border border-[#0051e6]/10 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0051e6] to-[#7c3aed] flex items-center justify-center">
                            <Sparkles size={14} className="text-white" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">AI Weekly Summary</div>
                            {latest && (
                                <div className="text-[11px] font-bold text-slate-500">
                                    Week of {new Date(latest.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={generateSummary}
                            disabled={generating}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0051e6] text-white text-[10px] font-black disabled:opacity-50 hover:bg-[#005bb7] transition-colors"
                        >
                            <RefreshCw size={10} className={generating ? "animate-spin" : ""} />
                            {generating ? "Generating…" : "Generate"}
                        </button>
                        <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-600">
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>
                </div>

                {expanded && latest && (
                    <div className="px-5 pb-5">
                        {/* Stats */}
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            {[
                                { label: "New", value: latest.stats_snapshot.new_tasks, color: "text-[#0051e6]" },
                                { label: "Done", value: latest.stats_snapshot.completed_tasks, color: "text-[#34c759]" },
                                { label: "Overdue", value: latest.stats_snapshot.overdue_tasks, color: "text-[#ff3b30]" },
                                { label: "Urgent", value: latest.stats_snapshot.high_priority, color: "text-[#ff9500]" },
                            ].map(s => (
                                <div key={s.label} className="bg-white/60 rounded-xl p-3 text-center">
                                    <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">{s.label}</div>
                                </div>
                            ))}
                        </div>
                        {/* Summary text */}
                        <p className="text-sm text-slate-700 leading-relaxed">{latest.summary_text}</p>
                    </div>
                )}

                {expanded && !latest && (
                    <div className="px-5 pb-5 text-center">
                        <p className="text-sm text-slate-400">No summary yet. Click "Generate" to create this week's AI summary.</p>
                    </div>
                )}
            </div>
        </UpgradeGate>
    );
}
