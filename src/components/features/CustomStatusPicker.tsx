"use client";

import React, { useState, useTransition } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import {
    ProjectStatus,
    createProjectStatus,
    deleteProjectStatus,
    setTaskCustomStatus,
} from "@/app/actions/custom-statuses";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

const PRESET_COLORS = [
    "#0051e6", "#34c759", "#ff9500", "#ff3b30",
    "#af52de", "#5ac8fa", "#ffcc00", "#86868b",
];

interface StatusPickerProps {
    taskId: string;
    projectId: string;
    statuses: ProjectStatus[];
    currentStatusId: string | null;
    onStatusChange?: (statusId: string | null, status: ProjectStatus | null) => void;
}

export function CustomStatusPicker({
    taskId,
    projectId,
    statuses,
    currentStatusId,
    onStatusChange,
}: StatusPickerProps) {
    const [open, setOpen] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
    const [pending, startTransition] = useTransition();

    const current = statuses.find(s => s.id === currentStatusId);

    function handleSelect(status: ProjectStatus | null) {
        startTransition(async () => {
            try {
                await setTaskCustomStatus(taskId, status?.id ?? null);
                onStatusChange?.(status?.id ?? null, status ?? null);
                setOpen(false);
            } catch {
                toast.error("Failed to update status");
            }
        });
    }

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!newName.trim()) return;
        startTransition(async () => {
            try {
                await createProjectStatus({
                    project_id: projectId,
                    name: newName.trim(),
                    color: newColor,
                    sort_order: statuses.length,
                });
                setNewName("");
                setShowNew(false);
                toast.success("Status created");
            } catch {
                toast.error("Failed to create status");
            }
        });
    }

    function handleDelete(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        startTransition(async () => {
            try {
                await deleteProjectStatus(id);
                toast.success("Status deleted");
            } catch {
                toast.error("Failed to delete status");
            }
        });
    }

    return (
        <UpgradeGate feature="custom_statuses" mode="disable">
            <div className="relative">
                <button
                    onClick={() => setOpen(o => !o)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold hover:border-slate-300 transition-colors"
                >
                    {current ? (
                        <>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: current.color }} />
                            {current.name}
                        </>
                    ) : (
                        <span className="text-slate-400">Set status…</span>
                    )}
                </button>

                {open && (
                    <div className="absolute left-0 top-full mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                        <div className="p-2 space-y-0.5">
                            <button
                                onClick={() => handleSelect(null)}
                                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-[11px] font-bold text-slate-400 flex items-center gap-2"
                            >
                                {!currentStatusId && <Check size={10} />}
                                <span>None (use default)</span>
                            </button>
                            {statuses.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => handleSelect(s)}
                                    disabled={pending}
                                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-[11px] font-bold text-slate-700 flex items-center justify-between gap-2 group"
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                                        {s.name}
                                        {currentStatusId === s.id && <Check size={10} className="text-[#0051e6]" />}
                                    </span>
                                    <button
                                        onClick={e => handleDelete(e, s.id)}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-300 hover:text-[#ff3b30]"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </button>
                            ))}
                        </div>

                        <div className="border-t border-slate-100 p-2">
                            {showNew ? (
                                <form onSubmit={handleCreate} className="space-y-2">
                                    <input
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="Status name"
                                        autoFocus
                                        className="w-full px-2 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 focus:outline-none"
                                    />
                                    <div className="flex gap-1 flex-wrap">
                                        {PRESET_COLORS.map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setNewColor(c)}
                                                className="w-5 h-5 rounded-full border-2 transition-transform"
                                                style={{
                                                    background: c,
                                                    borderColor: newColor === c ? "#1d1d1f" : "transparent",
                                                    transform: newColor === c ? "scale(1.2)" : "scale(1)",
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button type="submit" disabled={pending} className="flex-1 px-2 py-1 rounded-lg bg-[#0051e6] text-white text-[10px] font-black">
                                            {pending ? "…" : "Add"}
                                        </button>
                                        <button type="button" onClick={() => setShowNew(false)} className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500">
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <button
                                    onClick={() => setShowNew(true)}
                                    className="w-full flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-50 text-[11px] font-black text-[#0051e6]"
                                >
                                    <Plus size={12} /> New status
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </UpgradeGate>
    );
}
