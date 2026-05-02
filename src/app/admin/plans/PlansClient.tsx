"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Globe } from "lucide-react";
import { updatePlan, createPlan, upsertPlanPrice, deletePlanPrice } from "../actions";
import {
    Card,
    SectionLabel,
    Button,
    Input,
    Field,
    PlanPill,
    formatMoney,
} from "../_components/ui";

type Plan = {
    id: string;
    name: string;
    price_monthly_cents: number;
    stripe_price_id: string | null;
    seat_limit: number | null;
    project_limit: number | null;
    features: Record<string, boolean>;
    is_active: boolean;
    sort_order: number;
};

type PlanPrice = {
    id: string;
    plan_id: string;
    country_code: string;
    currency: string;
    price_monthly_cents: number;
    stripe_price_id: string | null;
    is_active: boolean;
};

const FEATURE_KEYS = [
    "workload_heatmap",
    "digest_emails",
    "sso",
    "audit_logs",
    "priority_support",
];

const FEATURE_LABELS: Record<string, string> = {
    workload_heatmap: "Workload heatmap",
    digest_emails: "Digest emails",
    sso: "SSO",
    audit_logs: "Audit logs",
    priority_support: "Priority support",
};

export function PlansClient({
    plans: initial,
    prices: initialPrices,
}: {
    plans: Plan[];
    prices: PlanPrice[];
}) {
    const router = useRouter();
    const [plans, setPlans] = useState(initial);
    const [editing, setEditing] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [isPending, startTransition] = useTransition();

    const save = (p: Plan) =>
        startTransition(async () => {
            try {
                await updatePlan(p.id, {
                    name: p.name,
                    price_monthly_cents: p.price_monthly_cents,
                    stripe_price_id: p.stripe_price_id || null,
                    seat_limit: p.seat_limit,
                    project_limit: p.project_limit,
                    features: p.features,
                    is_active: p.is_active,
                });
                setEditing(null);
                router.refresh();
            } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Save failed");
            }
        });

    return (
        <div className="p-10 max-w-7xl">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0c64ef] mb-1.5">
                        Mindbird Admin
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-[#1d1d1f]">
                        Plans &amp; Pricing
                    </h1>
                    <p className="text-sm text-[#86868b] font-medium mt-1.5">
                        Edit plan tiers, prices, limits, features, and regional pricing.
                    </p>
                </div>
                <Button onClick={() => setCreating(true)}>+ New plan</Button>
            </div>

            <div className="space-y-4">
                {plans.map((plan) => (
                    <Card key={plan.id}>
                        {editing === plan.id ? (
                            <PlanEditor
                                plan={plan}
                                onChange={(updated) =>
                                    setPlans(plans.map((p) => (p.id === plan.id ? updated : p)))
                                }
                                onSave={() => save(plan)}
                                onCancel={() => {
                                    setPlans(initial);
                                    setEditing(null);
                                }}
                                saving={isPending}
                            />
                        ) : (
                            <>
                                <PlanRow plan={plan} onEdit={() => setEditing(plan.id)} />
                                {plan.id !== "free" && (
                                    <RegionalPricing
                                        planId={plan.id}
                                        prices={initialPrices.filter((p) => p.plan_id === plan.id)}
                                    />
                                )}
                            </>
                        )}
                    </Card>
                ))}
            </div>

            {creating && (
                <CreatePlanModal
                    onClose={() => setCreating(false)}
                    onCreated={() => {
                        setCreating(false);
                        router.refresh();
                    }}
                />
            )}
        </div>
    );
}

function PlanRow({ plan, onEdit }: { plan: Plan; onEdit: () => void }) {
    return (
        <div className="flex items-start justify-between">
            <div className="flex-1">
                <div className="flex items-center gap-3">
                    <PlanPill plan={plan.id} />
                    <h2 className="text-2xl font-black tracking-tight text-[#1d1d1f]">
                        {plan.name}
                    </h2>
                    {!plan.is_active && (
                        <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-[#f5f5f7] text-[#86868b]">
                            Inactive
                        </span>
                    )}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-[#1d1d1f] tracking-tight">
                        {formatMoney(plan.price_monthly_cents)}
                    </span>
                    {plan.price_monthly_cents > 0 && (
                        <span className="text-xs text-[#86868b] font-bold uppercase tracking-wider">
                            /seat/mo
                        </span>
                    )}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#86868b] font-medium">
                    <Tag label="Seats" value={plan.seat_limit ?? "Unlimited"} />
                    <Tag label="Projects" value={plan.project_limit ?? "Unlimited"} />
                    <Tag
                        label="Stripe"
                        value={plan.stripe_price_id ?? "Not connected"}
                        mono={Boolean(plan.stripe_price_id)}
                    />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {FEATURE_KEYS.filter((k) => plan.features?.[k]).map((k) => (
                        <span
                            key={k}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700"
                        >
                            <Check size={11} strokeWidth={2.5} />
                            {FEATURE_LABELS[k]}
                        </span>
                    ))}
                    {FEATURE_KEYS.filter((k) => !plan.features?.[k]).map((k) => (
                        <span
                            key={k}
                            className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#f5f5f7] text-[#86868b]"
                        >
                            {FEATURE_LABELS[k]}
                        </span>
                    ))}
                </div>
            </div>
            <Button variant="secondary" onClick={onEdit}>
                Edit
            </Button>
        </div>
    );
}

function Tag({
    label,
    value,
    mono,
}: {
    label: string;
    value: string | number;
    mono?: boolean;
}) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#86868b]">
                {label}
            </span>
            <span
                className={`text-xs font-bold text-[#1d1d1f] ${
                    mono ? "font-mono" : ""
                } truncate max-w-[180px]`}
            >
                {value}
            </span>
        </span>
    );
}

function PlanEditor({
    plan,
    onChange,
    onSave,
    onCancel,
    saving,
}: {
    plan: Plan;
    onChange: (p: Plan) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
}) {
    const set = <K extends keyof Plan>(k: K, v: Plan[K]) => onChange({ ...plan, [k]: v });
    const setFeature = (k: string, v: boolean) =>
        onChange({ ...plan, features: { ...plan.features, [k]: v } });

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                    <Input value={plan.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="Base price (USD/seat/mo)">
                    <Input
                        type="number"
                        step="0.01"
                        value={plan.price_monthly_cents / 100}
                        onChange={(e) =>
                            set("price_monthly_cents", Math.round(Number(e.target.value) * 100))
                        }
                    />
                </Field>
                <Field label="Stripe price ID (default)">
                    <Input
                        value={plan.stripe_price_id ?? ""}
                        onChange={(e) => set("stripe_price_id", e.target.value)}
                        placeholder="price_…"
                        className="font-mono"
                    />
                </Field>
                <Field label="Sort order">
                    <Input
                        type="number"
                        value={plan.sort_order}
                        onChange={(e) => set("sort_order", Number(e.target.value))}
                    />
                </Field>
                <Field label="Seat limit (blank = unlimited)">
                    <Input
                        type="number"
                        value={plan.seat_limit ?? ""}
                        onChange={(e) =>
                            set("seat_limit", e.target.value === "" ? null : Number(e.target.value))
                        }
                    />
                </Field>
                <Field label="Project limit (blank = unlimited)">
                    <Input
                        type="number"
                        value={plan.project_limit ?? ""}
                        onChange={(e) =>
                            set(
                                "project_limit",
                                e.target.value === "" ? null : Number(e.target.value)
                            )
                        }
                    />
                </Field>
            </div>

            <div>
                <SectionLabel>Features</SectionLabel>
                <div className="grid grid-cols-3 gap-2">
                    {FEATURE_KEYS.map((k) => (
                        <label
                            key={k}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#f5f5f7] hover:bg-[#e5e5ea]/60 cursor-pointer transition"
                        >
                            <input
                                type="checkbox"
                                checked={Boolean(plan.features?.[k])}
                                onChange={(e) => setFeature(k, e.target.checked)}
                                className="w-4 h-4 rounded accent-[#0c64ef]"
                            />
                            <span className="text-xs font-bold text-[#1d1d1f]">
                                {FEATURE_LABELS[k]}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#f5f5f7] cursor-pointer">
                <input
                    type="checkbox"
                    checked={plan.is_active}
                    onChange={(e) => set("is_active", e.target.checked)}
                    className="w-4 h-4 rounded accent-[#0c64ef]"
                />
                <span className="text-xs font-bold text-[#1d1d1f]">
                    Active (visible on pricing page)
                </span>
            </label>

            <div className="flex gap-2">
                <Button onClick={onSave} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                </Button>
                <Button variant="secondary" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}

function RegionalPricing({ planId, prices }: { planId: string; prices: PlanPrice[] }) {
    const router = useRouter();
    const [adding, setAdding] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [draft, setDraft] = useState({
        country_code: "",
        currency: "USD",
        price_monthly_cents: 0,
        stripe_price_id: "",
    });

    const submit = () =>
        startTransition(async () => {
            try {
                await upsertPlanPrice({
                    plan_id: planId,
                    country_code: draft.country_code.trim(),
                    currency: draft.currency.trim(),
                    price_monthly_cents: draft.price_monthly_cents,
                    stripe_price_id: draft.stripe_price_id || null,
                });
                setAdding(false);
                setDraft({ country_code: "", currency: "USD", price_monthly_cents: 0, stripe_price_id: "" });
                router.refresh();
            } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Save failed");
            }
        });

    const remove = (id: string) =>
        startTransition(async () => {
            if (!confirm("Delete this regional price?")) return;
            try {
                await deletePlanPrice(id);
                router.refresh();
            } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Delete failed");
            }
        });

    return (
        <div className="mt-6 pt-6 border-t border-[#f5f5f7]">
            <div className="flex items-center justify-between mb-4">
                <SectionLabel>Regional pricing ({prices.length})</SectionLabel>
                <button
                    onClick={() => setAdding((v) => !v)}
                    className="text-[10px] font-black uppercase tracking-widest text-[#0c64ef] hover:underline"
                >
                    {adding ? "Cancel" : "+ Add region"}
                </button>
            </div>

            {prices.length === 0 && !adding && (
                <p className="text-[11px] text-[#86868b]">
                    No regional prices yet. The DEFAULT fallback uses the plan&apos;s base price.
                </p>
            )}

            {prices.length > 0 && (
                <div className="rounded-xl bg-[#f5f5f7]/40 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[9px] font-black uppercase tracking-[0.15em] text-[#86868b] border-b border-[#e5e5ea]">
                                <th className="px-4 py-2.5">Country</th>
                                <th className="px-4 py-2.5">Currency</th>
                                <th className="px-4 py-2.5">Price/seat/mo</th>
                                <th className="px-4 py-2.5">Stripe price</th>
                                <th className="px-4 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {prices.map((p) => (
                                <tr key={p.id} className="border-b border-[#e5e5ea] last:border-0">
                                    <td className="px-4 py-3 text-sm font-medium text-[#1d1d1f]">
                                        {p.country_code === "DEFAULT" ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Globe size={13} strokeWidth={2} />
                                                Default
                                            </span>
                                        ) : (
                                            p.country_code
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-[#52525b]">
                                        {p.currency}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium text-[#1d1d1f] tabular-nums">
                                        {formatMoney(p.price_monthly_cents, p.currency)}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-mono text-[#86868b] truncate max-w-[180px]">
                                        {p.stripe_price_id ?? "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => remove(p.id)}
                                            disabled={isPending}
                                            className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:underline"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {adding && (
                <div className="mt-4 p-4 bg-[#f5f5f7] rounded-xl space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                        <Input
                            placeholder="IN, US, DEFAULT"
                            maxLength={7}
                            value={draft.country_code}
                            onChange={(e) =>
                                setDraft({ ...draft, country_code: e.target.value.toUpperCase() })
                            }
                        />
                        <Input
                            placeholder="USD"
                            maxLength={3}
                            value={draft.currency}
                            onChange={(e) =>
                                setDraft({ ...draft, currency: e.target.value.toUpperCase() })
                            }
                        />
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="Price"
                            onChange={(e) =>
                                setDraft({
                                    ...draft,
                                    price_monthly_cents: Math.round(Number(e.target.value) * 100),
                                })
                            }
                        />
                        <Input
                            placeholder="price_…"
                            value={draft.stripe_price_id}
                            onChange={(e) => setDraft({ ...draft, stripe_price_id: e.target.value })}
                            className="font-mono"
                        />
                    </div>
                    <Button
                        onClick={submit}
                        disabled={isPending || !draft.country_code || !draft.currency}
                        className="w-full"
                    >
                        {isPending ? "Saving…" : "Save regional price"}
                    </Button>
                    <p className="text-[10px] text-[#86868b]">
                        Use DEFAULT to set the global fallback. Each country/currency needs its own
                        Stripe Price ID.
                    </p>
                </div>
            )}
        </div>
    );
}

function CreatePlanModal({
    onClose,
    onCreated,
}: {
    onClose: () => void;
    onCreated: () => void;
}) {
    const [form, setForm] = useState({
        id: "",
        name: "",
        price_monthly_cents: 0,
        stripe_price_id: "",
        seat_limit: null as number | null,
        project_limit: null as number | null,
        sort_order: 99,
    });
    const [isPending, startTransition] = useTransition();

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="w-[520px] max-w-[90vw]">
                <SectionLabel>Create plan</SectionLabel>
                <div className="space-y-3">
                    <Field label="Plan ID (lowercase, no spaces)">
                        <Input
                            placeholder="enterprise"
                            value={form.id}
                            onChange={(e) =>
                                setForm({ ...form, id: e.target.value.toLowerCase().replace(/\s/g, "") })
                            }
                        />
                    </Field>
                    <Field label="Display name">
                        <Input
                            placeholder="Enterprise"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                    </Field>
                    <Field label="Base price (USD/seat/mo)">
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="49"
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    price_monthly_cents: Math.round(Number(e.target.value) * 100),
                                })
                            }
                        />
                    </Field>
                    <Field label="Stripe price ID">
                        <Input
                            placeholder="price_…"
                            value={form.stripe_price_id}
                            onChange={(e) => setForm({ ...form, stripe_price_id: e.target.value })}
                            className="font-mono"
                        />
                    </Field>
                    <div className="flex gap-2 pt-2">
                        <Button
                            onClick={() =>
                                startTransition(async () => {
                                    try {
                                        await createPlan({
                                            ...form,
                                            stripe_price_id: form.stripe_price_id || null,
                                        });
                                        onCreated();
                                    } catch (e: unknown) {
                                        toast.error(e instanceof Error ? e.message : "Create failed");
                                    }
                                })
                            }
                            disabled={isPending || !form.id || !form.name}
                            className="flex-1"
                        >
                            {isPending ? "Creating…" : "Create plan"}
                        </Button>
                        <Button variant="secondary" onClick={onClose}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
