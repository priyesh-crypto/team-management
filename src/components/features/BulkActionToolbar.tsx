"use client";

import React, { useTransition } from "react";
import { CheckSquare, Square, Trash2, CheckCircle2, X, Users } from "lucide-react";
import { toast } from "sonner";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

export interface BulkAction {
    label: string;
    icon: React.ReactNode;
    className?: string;
    onClick: (selectedIds: string[]) => Promise<void>;
}

interface Props {
    allIds: string[];
    selectedIds: string[];
    onToggleSelect: (id: string) => void;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onBulkDelete?: (ids: string[]) => Promise<void>;
    onBulkComplete?: (ids: string[]) => Promise<void>;
    extraActions?: BulkAction[];
}

export function BulkSelectionCheckbox({
    taskId,
    selectedIds,
    onToggle,
}: {
    taskId: string;
    selectedIds: string[];
    onToggle: (id: string) => void;
}) {
    const selected = selectedIds.includes(taskId);
    return (
        <UpgradeGate feature="bulk_actions" mode="disable">
            <button
                onClick={e => { e.stopPropagation(); onToggle(taskId); }}
                className={`w-5 h-5 rounded-md flex items-center justify-center transition-all flex-shrink-0 ${
                    selected
                        ? "bg-[#0051e6] text-white border border-[#0051e6]"
                        : "border border-slate-200 text-slate-200 hover:border-[#0051e6]/50 hover:text-[#0051e6]/50"
                }`}
            >
                {selected ? <CheckSquare size={12} fill="currentColor" /> : <Square size={12} />}
            </button>
        </UpgradeGate>
    );
}

export function BulkActionToolbar({
    allIds,
    selectedIds,
    onSelectAll,
    onClearSelection,
    onBulkDelete,
    onBulkComplete,
    extraActions = [],
}: Props) {
    const [pending, startTransition] = useTransition();

    if (selectedIds.length === 0) return null;

    function run(action: (ids: string[]) => Promise<void>, successMsg: string) {
        startTransition(async () => {
            try {
                await action(selectedIds);
                onClearSelection();
                toast.success(successMsg);
            } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Action failed");
            }
        });
    }

    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.includes(id));

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-3 bg-[#1d1d1f] rounded-2xl shadow-2xl shadow-black/30 border border-white/10">
            <button
                onClick={allSelected ? onClearSelection : onSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-black transition-colors"
            >
                <Users size={12} />
                {allSelected ? "Deselect all" : `All ${allIds.length}`}
            </button>

            <div className="w-px h-5 bg-white/20" />

            <span className="text-[11px] font-black text-white/60 min-w-[60px] text-center tabular-nums">
                {selectedIds.length} selected
            </span>

            <div className="w-px h-5 bg-white/20" />

            {onBulkComplete && (
                <button
                    onClick={() => run(onBulkComplete, `${selectedIds.length} tasks marked complete`)}
                    disabled={pending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#34c759]/20 hover:bg-[#34c759]/30 text-[#34c759] text-[11px] font-black transition-colors disabled:opacity-50"
                >
                    <CheckCircle2 size={12} />
                    Complete
                </button>
            )}

            {extraActions.map((action, i) => (
                <button
                    key={i}
                    onClick={() => run(action.onClick, `Done`)}
                    disabled={pending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-colors disabled:opacity-50 ${
                        action.className ?? "bg-white/10 hover:bg-white/20 text-white"
                    }`}
                >
                    {action.icon}
                    {action.label}
                </button>
            ))}

            {onBulkDelete && (
                <button
                    onClick={() => run(onBulkDelete, `${selectedIds.length} tasks deleted`)}
                    disabled={pending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff3b30]/20 hover:bg-[#ff3b30]/30 text-[#ff3b30] text-[11px] font-black transition-colors disabled:opacity-50"
                >
                    <Trash2 size={12} />
                    Delete
                </button>
            )}

            <div className="w-px h-5 bg-white/20" />

            <button
                onClick={onClearSelection}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
                <X size={14} />
            </button>
        </div>
    );
}
