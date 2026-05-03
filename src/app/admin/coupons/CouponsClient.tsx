"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCoupon, deactivateCoupon } from "../actions-tier2";
import { Card, SectionLabel, Button, Field, Input } from "../_components/ui";

interface Coupon {
    code: string;
    stripe_coupon_id: string | null;
    percent_off: number | null;
    amount_off_cents: number | null;
    currency: string;
    valid_until: string | null;
    max_redemptions: number | null;
    redemptions: number;
    is_active: boolean;
    created_at: string;
}

export function CouponsClient({ initialCoupons }: { initialCoupons: Coupon[] }) {
    const [coupons, setCoupons] = useState(initialCoupons);
    const [showForm, setShowForm] = useState(false);
    const [code, setCode] = useState("");
    const [type, setType] = useState<"percent" | "amount">("percent");
    const [percentOff, setPercentOff] = useState("");
    const [amountOff, setAmountOff] = useState("");
    const [maxRed, setMaxRed] = useState("");
    const [validUntil, setValidUntil] = useState("");
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            try {
                await createCoupon({
                    code,
                    percentOff: type === "percent" ? parseInt(percentOff) : undefined,
                    amountOffCents: type === "amount" ? Math.round(parseFloat(amountOff) * 100) : undefined,
                    maxRedemptions: maxRed ? parseInt(maxRed) : undefined,
                    validUntil: validUntil || undefined,
                });
                toast.success("Coupon created");
                setShowForm(false);
                setCode(""); setPercentOff(""); setAmountOff(""); setMaxRed(""); setValidUntil("");
                router.refresh();
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
            }
        });
    }

    function handleDeactivate(couponCode: string) {
        if (!confirm(`Deactivate coupon ${couponCode}?`)) return;
        startTransition(async () => {
            try {
                await deactivateCoupon(couponCode);
                setCoupons(cs => cs.map(c => c.code === couponCode ? { ...c, is_active: false } : c));
                toast.success("Coupon deactivated");
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
            }
        });
    }

    return (
        <div className="space-y-5">
            <div className="flex justify-end">
                <Button onClick={() => setShowForm(s => !s)}>
                    {showForm ? "Cancel" : "+ New coupon"}
                </Button>
            </div>

            {showForm && (
                <Card>
                    <SectionLabel>Create coupon</SectionLabel>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <Field label="Coupon code (e.g. LAUNCH50)">
                            <Input
                                value={code}
                                onChange={e => setCode(e.target.value.toUpperCase())}
                                required
                                placeholder="LAUNCH50"
                            />
                        </Field>

                        <div>
                            <p className="text-[10px] font-black text-[#86868b] uppercase tracking-wider mb-2">Discount type</p>
                            <div className="flex gap-3">
                                {(["percent", "amount"] as const).map(t => (
                                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" checked={type === t} onChange={() => setType(t)} className="accent-[#0051e6]" />
                                        <span className="text-sm font-bold capitalize text-[#1d1d1f]">{t === "percent" ? "% off" : "Fixed amount"}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {type === "percent" ? (
                            <Field label="Percent off (1–100)">
                                <Input type="number" min={1} max={100} value={percentOff} onChange={e => setPercentOff(e.target.value)} required placeholder="50" />
                            </Field>
                        ) : (
                            <Field label="Amount off ($)">
                                <Input type="number" min={0.01} step={0.01} value={amountOff} onChange={e => setAmountOff(e.target.value)} required placeholder="25.00" />
                            </Field>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Max redemptions (blank = unlimited)">
                                <Input type="number" min={1} value={maxRed} onChange={e => setMaxRed(e.target.value)} placeholder="100" />
                            </Field>
                            <Field label="Valid until (blank = forever)">
                                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                            </Field>
                        </div>

                        <Button type="submit" disabled={pending} className="w-full">
                            {pending ? "Creating…" : "Create coupon"}
                        </Button>
                    </form>
                </Card>
            )}

            <Card>
                <SectionLabel>All coupons</SectionLabel>
                {coupons.length === 0 ? (
                    <p className="text-sm text-[#86868b] py-6 text-center">No coupons yet.</p>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[9px] font-black uppercase tracking-[0.15em] text-[#86868b] border-b border-[#f5f5f7]">
                                <th className="pb-3">Code</th>
                                <th className="pb-3 text-center">Discount</th>
                                <th className="pb-3 text-center">Redemptions</th>
                                <th className="pb-3 text-center">Expires</th>
                                <th className="pb-3 text-center">Status</th>
                                <th className="pb-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.map(c => (
                                <tr key={c.code} className="border-b border-[#f5f5f7] last:border-0 hover:bg-[#f5f5f7]/50">
                                    <td className="py-3 font-black text-sm text-[#1d1d1f] font-mono">{c.code}</td>
                                    <td className="py-3 text-center text-sm font-bold text-[#1d1d1f]">
                                        {c.percent_off ? `${c.percent_off}%` : `$${((c.amount_off_cents ?? 0) / 100).toFixed(2)}`}
                                    </td>
                                    <td className="py-3 text-center text-sm text-[#86868b]">
                                        {c.redemptions}{c.max_redemptions ? ` / ${c.max_redemptions}` : ""}
                                    </td>
                                    <td className="py-3 text-center text-[11px] text-[#86868b]">
                                        {c.valid_until ? new Date(c.valid_until).toLocaleDateString() : "—"}
                                    </td>
                                    <td className="py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                            c.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                                        }`}>
                                            {c.is_active ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right">
                                        {c.is_active && (
                                            <button
                                                disabled={pending}
                                                onClick={() => handleDeactivate(c.code)}
                                                className="text-[10px] font-black text-[#86868b] hover:text-red-500 transition-colors"
                                            >
                                                Deactivate
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
}
