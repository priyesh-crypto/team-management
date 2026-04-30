"use client";

import React, { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { ApprovalRequest, decideApproval } from "@/app/actions/approvals";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Props {
    requests: (ApprovalRequest & { task_name?: string })[];
}

export function ApprovalsPanel({ requests }: Props) {
    const [pending, startTransition] = useTransition();
    const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});

    function handleDecide(id: string, decision: "approved" | "rejected") {
        startTransition(async () => {
            try {
                await decideApproval(id, decision, decisionNotes[id]);
                toast.success(`Request ${decision}`);
            } catch {
                toast.error("Failed to process decision");
            }
        });
    }

    return (
        <UpgradeGate feature="approvals">
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Clock size={16} className="text-[#ff9500]" />
                    <h3 className="text-sm font-black text-[#1d1d1f]">Pending Approvals</h3>
                    {requests.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#ff9500]/10 text-[#ff9500] text-[10px] font-black">
                            {requests.length}
                        </span>
                    )}
                </div>

                {requests.length === 0 && (
                    <div className="text-center py-8 text-sm text-slate-400">
                        No pending approvals.
                    </div>
                )}

                <div className="space-y-3">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div>
                                    <div className="text-sm font-black text-[#1d1d1f]">
                                        {req.task_name ?? `Task #${req.task_id.slice(0, 8)}`}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                        Requested {new Date(req.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <span className="px-2 py-1 rounded-lg bg-[#ff9500]/10 text-[#ff9500] text-[10px] font-black">
                                    Pending
                                </span>
                            </div>

                            <input
                                value={decisionNotes[req.id] ?? ""}
                                onChange={e => setDecisionNotes(n => ({ ...n, [req.id]: e.target.value }))}
                                placeholder="Add a note (optional)"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none mb-3"
                            />

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleDecide(req.id, "approved")}
                                    disabled={pending}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/20 text-sm font-black hover:bg-[#34c759]/20 disabled:opacity-50 transition-colors"
                                >
                                    <CheckCircle2 size={14} /> Approve
                                </button>
                                <button
                                    onClick={() => handleDecide(req.id, "rejected")}
                                    disabled={pending}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#ff3b30]/10 text-[#ff3b30] border border-[#ff3b30]/20 text-sm font-black hover:bg-[#ff3b30]/20 disabled:opacity-50 transition-colors"
                                >
                                    <XCircle size={14} /> Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </UpgradeGate>
    );
}
