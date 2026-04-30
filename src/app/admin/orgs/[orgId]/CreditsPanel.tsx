"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { issueCredit } from "../../actions-tier1";
import { Card, SectionLabel, Button, Field, Input, Select, formatMoney } from "../../_components/ui";

interface Credit {
    id: string;
    amount_cents: number;
    currency: string;
    reason: string;
    created_at: string;
    applied_at: string | null;
}

interface Props {
    orgId: string;
    credits: Credit[];
}

export function CreditsPanel({ orgId, credits }: Props) {
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [reason, setReason] = useState("");
    const [pending, startTransition] = useTransition();

    function handleIssue() {
        const cents = Math.round(parseFloat(amount) * 100);
        if (isNaN(cents) || cents <= 0) { toast.error("Enter a valid amount."); return; }
        if (!reason.trim()) { toast.error("Enter a reason."); return; }
        startTransition(async () => {
            try {
                await issueCredit(orgId, cents, currency, reason);
                toast.success("Credit issued");
                setAmount("");
                setReason("");
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
            }
        });
    }

    const totalPending = credits
        .filter(c => !c.applied_at)
        .reduce((sum, c) => sum + c.amount_cents, 0);

    return (
        <Card>
            <SectionLabel>Account credits</SectionLabel>
            <div className="space-y-4">
                {totalPending > 0 && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">Pending credits</span>
                        <span className="text-sm font-black text-emerald-700">
                            {(totalPending / 100).toFixed(2)} {credits[0]?.currency ?? "USD"}
                        </span>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                    <Field label="Amount ($)">
                        <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="50.00"
                        />
                    </Field>
                    <Field label="Currency">
                        <Select value={currency} onChange={e => setCurrency(e.target.value)}>
                            {["USD", "EUR", "GBP", "INR", "AUD", "CAD"].map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Reason">
                        <Input
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Refund, goodwill…"
                        />
                    </Field>
                </div>

                <Button disabled={pending} onClick={handleIssue} className="w-full">
                    {pending ? "Issuing…" : "Issue credit"}
                </Button>

                {credits.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-[#f5f5f7]">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#86868b]">History</p>
                        {credits.map(c => (
                            <div key={c.id} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-[#f5f5f7]">
                                <div>
                                    <span className="font-bold text-[#1d1d1f]">
                                        +{formatMoney(c.amount_cents)} {c.currency}
                                    </span>
                                    <span className="text-[#86868b] ml-2">{c.reason}</span>
                                </div>
                                <div className="text-[10px] text-[#86868b]">
                                    {c.applied_at
                                        ? <span className="text-emerald-600 font-bold">Applied</span>
                                        : <span className="text-amber-600 font-bold">Pending</span>}
                                    {" · "}{new Date(c.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
}
