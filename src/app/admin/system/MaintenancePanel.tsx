"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { refreshWorkloadView, recalcOrgUsage, pruneOrphanedAttachments } from "../actions-system-config";
import { Card, SectionLabel, Button } from "../_components/ui";
import { RefreshCw, BarChart3, Trash2 } from "lucide-react";

type Op = "refresh" | "recalc" | "prune";

export function MaintenancePanel() {
    const [lastRun, setLastRun] = useState<Record<Op, string | null>>({
        refresh: null,
        recalc:  null,
        prune:   null,
    });
    const [pending, startTransition] = useTransition();
    const [runningOp, setRunningOp] = useState<Op | null>(null);

    const run = (op: Op, action: () => Promise<any>, successMsg: (result: any) => string) => {
        setRunningOp(op);
        startTransition(async () => {
            try {
                const result = await action();
                setLastRun(prev => ({ ...prev, [op]: new Date().toLocaleTimeString() }));
                toast.success(successMsg(result));
            } catch (e: any) {
                toast.error(e.message || `Failed to run ${op}`);
            } finally {
                setRunningOp(null);
            }
        });
    };

    const ops: {
        id: Op;
        label: string;
        description: string;
        icon: React.ReactNode;
        action: () => Promise<any>;
        success: (r: any) => string;
        variant?: "primary" | "secondary" | "danger";
    }[] = [
        {
            id:          "refresh",
            label:       "Refresh Workload Heatmap",
            description: "Manually triggers REFRESH MATERIALIZED VIEW CONCURRENTLY on workload_summary. Use this if pg_cron missed a cycle.",
            icon:        <RefreshCw size={14} />,
            action:      () => refreshWorkloadView(),
            success:     (r) => `Heatmap refreshed at ${new Date(r.refreshedAt).toLocaleTimeString()}`,
        },
        {
            id:          "recalc",
            label:       "Recalculate Org Usage",
            description: "Resyncs seat_count for all organizations from the organization_members table. Run after bulk imports or manual DB edits.",
            icon:        <BarChart3 size={14} />,
            action:      () => recalcOrgUsage(),
            success:     (r) => `Updated ${r.orgsUpdated} organization${r.orgsUpdated !== 1 ? "s" : ""}`,
            variant:     "secondary",
        },
        {
            id:          "prune",
            label:       "Prune Orphaned Attachments",
            description: "Removes storage objects in the attachments bucket that have no matching DB record. Safe to run anytime.",
            icon:        <Trash2 size={14} />,
            action:      () => pruneOrphanedAttachments(),
            success:     (r) => r.deleted > 0 ? `Deleted ${r.deleted} orphaned file${r.deleted !== 1 ? "s" : ""}` : "No orphaned files found",
            variant:     "secondary",
        },
    ];

    return (
        <Card>
            <SectionLabel>Database Control Center</SectionLabel>
            <p className="text-xs text-[#86868b] mb-4">
                One-click maintenance operations. All actions are logged to the audit trail.
            </p>
            <div className="space-y-3">
                {ops.map(op => (
                    <div
                        key={op.id}
                        className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[#f5f5f7]"
                    >
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-[#1d1d1f]">{op.label}</div>
                            <p className="text-xs text-[#86868b] mt-0.5 leading-relaxed">{op.description}</p>
                            {lastRun[op.id] && (
                                <p className="text-[10px] text-emerald-600 font-medium mt-1">
                                    Last run: {lastRun[op.id]}
                                </p>
                            )}
                        </div>
                        <Button
                            variant={op.variant ?? "primary"}
                            disabled={pending}
                            onClick={() => run(op.id, op.action, op.success)}
                            className="shrink-0 flex items-center gap-1.5"
                        >
                            <span className={runningOp === op.id ? "animate-spin" : ""}>
                                {op.icon}
                            </span>
                            {runningOp === op.id ? "Running…" : "Run"}
                        </Button>
                    </div>
                ))}
            </div>
        </Card>
    );
}
