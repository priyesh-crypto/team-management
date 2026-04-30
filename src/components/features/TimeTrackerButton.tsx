"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Play, Square } from "lucide-react";
import { toast } from "sonner";
import { TimeEntry, startTimer, stopTimer } from "@/app/actions/time-tracker";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Props {
    taskId: string;
    runningEntry: TimeEntry | null;
    totalHours: number;
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimeTrackerButton({ taskId, runningEntry, totalHours }: Props) {
    const [entry, setEntry] = useState<TimeEntry | null>(runningEntry);
    const [elapsed, setElapsed] = useState(0);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        if (!entry) { setElapsed(0); return; }
        const base = Math.floor((Date.now() - new Date(entry.started_at).getTime()) / 1000);
        setElapsed(base);
        const id = setInterval(() => setElapsed(s => s + 1), 1000);
        return () => clearInterval(id);
    }, [entry]);

    function handleStart() {
        startTransition(async () => {
            try {
                const newEntry = await startTimer(taskId);
                setEntry(newEntry);
                toast.success("Timer started");
            } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Failed to start timer");
            }
        });
    }

    function handleStop() {
        if (!entry) return;
        startTransition(async () => {
            try {
                await stopTimer(entry.id);
                setEntry(null);
                toast.success("Timer stopped");
            } catch {
                toast.error("Failed to stop timer");
            }
        });
    }

    const isRunning = Boolean(entry);

    return (
        <UpgradeGate feature="time_tracker" mode="disable">
            <div className="flex items-center gap-2">
                <button
                    onClick={isRunning ? handleStop : handleStart}
                    disabled={pending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all disabled:opacity-50 ${
                        isRunning
                            ? "bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/20 border border-[#ff3b30]/20"
                            : "bg-[#34c759]/10 text-[#34c759] hover:bg-[#34c759]/20 border border-[#34c759]/20"
                    }`}
                >
                    {isRunning ? (
                        <><Square size={11} fill="currentColor" />{formatDuration(elapsed)}</>
                    ) : (
                        <><Play size={11} fill="currentColor" />Track time</>
                    )}
                </button>

                {totalHours > 0 && (
                    <span className="text-[10px] font-bold text-slate-400">
                        {totalHours}h logged
                    </span>
                )}
            </div>
        </UpgradeGate>
    );
}
