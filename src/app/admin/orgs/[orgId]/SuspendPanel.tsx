"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { suspendOrg, unsuspendOrg } from "../../actions-tier1";
import { Card, SectionLabel, Button, Field, Input } from "../../_components/ui";

interface Props {
    orgId: string;
    suspendedAt: string | null;
    suspendedReason: string | null;
}

export function SuspendPanel({ orgId, suspendedAt, suspendedReason }: Props) {
    const [reason, setReason] = useState("");
    const [pending, startTransition] = useTransition();
    const isSuspended = Boolean(suspendedAt);

    function handleSuspend() {
        if (!reason.trim()) { toast.error("Enter a reason before suspending."); return; }
        startTransition(async () => {
            try {
                await suspendOrg(orgId, reason);
                toast.success("Organization suspended");
                setReason("");
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
            }
        });
    }

    function handleUnsuspend() {
        startTransition(async () => {
            try {
                await unsuspendOrg(orgId);
                toast.success("Organization reinstated");
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
            }
        });
    }

    return (
        <Card className={isSuspended ? "border-amber-200" : ""}>
            <SectionLabel>Suspend access</SectionLabel>
            {isSuspended ? (
                <div className="space-y-3">
                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 space-y-1">
                        <p className="text-xs font-black text-amber-800 uppercase tracking-wider">Suspended</p>
                        <p className="text-xs text-amber-700">{suspendedReason}</p>
                        <p className="text-[10px] text-amber-600">
                            Since {new Date(suspendedAt!).toLocaleString()}
                        </p>
                    </div>
                    <Button variant="secondary" disabled={pending} onClick={handleUnsuspend} className="w-full">
                        {pending ? "Reinstating…" : "Reinstate access"}
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    <Field label="Reason" hint="Visible in the admin log only">
                        <Input
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="e.g. Payment dispute, ToS violation"
                        />
                    </Field>
                    <Button
                        variant="danger"
                        disabled={pending || !reason.trim()}
                        onClick={handleSuspend}
                        className="w-full"
                    >
                        {pending ? "Suspending…" : "Suspend organization"}
                    </Button>
                    <p className="text-[10px] text-[#86868b]">
                        Org members will see a suspended notice and cannot use the app until reinstated.
                    </p>
                </div>
            )}
        </Card>
    );
}
