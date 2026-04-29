"use client";

import { useState } from "react";

type Org = {
    id: string;
    name: string;
    plan_id: string;
    subscription_status: string | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
    seats_purchased: number;
    cancel_at_period_end: boolean;
};

type Plan = {
    id: string;
    name: string;
    price_monthly_cents: number;
    seat_limit: number | null;
    project_limit: number | null;
    features: Record<string, boolean>;
};

type Usage = {
    active_seats: number;
    project_count: number;
    task_count: number;
};

const FEATURE_LABELS: Record<string, string> = {
    workload_heatmap: "Workload heatmap",
    digest_emails: "Digest emails",
    sso: "SSO",
    audit_logs: "Audit logs",
    priority_support: "Priority support",
};

export function BillingClient({
    org,
    plans,
    usage,
}: {
    org: Org;
    plans: Plan[];
    usage: Usage;
}) {
    const [loading, setLoading] = useState<string | null>(null);
    const currentPlan = plans.find((p) => p.id === org.plan_id);

    async function startCheckout(planId: string) {
        setLoading(planId);
        try {
            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orgId: org.id,
                    planId,
                    seats: Math.max(usage.active_seats, 1),
                }),
            });
            const json = await res.json();
            if (json.url) window.location.href = json.url;
            else alert(json.error ?? "Checkout failed");
        } finally {
            setLoading(null);
        }
    }

    async function openPortal() {
        setLoading("portal");
        try {
            const res = await fetch("/api/stripe/portal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId: org.id }),
            });
            const json = await res.json();
            if (json.url) window.location.href = json.url;
            else alert(json.error ?? "Could not open billing portal");
        } finally {
            setLoading(null);
        }
    }

    const status = org.subscription_status ?? "free";
    const trialEnds = org.trial_ends_at ? new Date(org.trial_ends_at) : null;

    return (
        <div className="mx-auto max-w-5xl p-8 space-y-8">
            <header>
                <h1 className="text-3xl font-black tracking-tight">Billing</h1>
                <p className="text-sm text-slate-500 mt-1">
                    Manage {org.name}'s plan, seats, and invoices.
                </p>
            </header>

            <section className="rounded-2xl border border-slate-200 p-6 bg-white">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Current Plan
                        </div>
                        <div className="text-2xl font-black mt-1">
                            {currentPlan?.name ?? "Free"}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <span
                                className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full ${
                                    status === "active" || status === "trialing"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : status === "past_due"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-slate-100 text-slate-600"
                                }`}
                            >
                                {status}
                            </span>
                            {trialEnds && status === "trialing" && (
                                <span className="text-xs text-slate-500">
                                    Trial ends {trialEnds.toLocaleDateString()}
                                </span>
                            )}
                            {org.cancel_at_period_end && (
                                <span className="text-xs text-amber-600 font-bold">
                                    Cancels at period end
                                </span>
                            )}
                        </div>
                    </div>
                    {org.plan_id !== "free" && (
                        <button
                            onClick={openPortal}
                            disabled={loading === "portal"}
                            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 disabled:opacity-50"
                        >
                            {loading === "portal" ? "Opening..." : "Manage billing"}
                        </button>
                    )}
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4">
                    <UsageBar
                        label="Seats"
                        used={usage.active_seats}
                        limit={currentPlan?.seat_limit ?? null}
                    />
                    <UsageBar
                        label="Projects"
                        used={usage.project_count}
                        limit={currentPlan?.project_limit ?? null}
                    />
                    <UsageBar label="Tasks" used={usage.task_count} limit={null} />
                </div>
            </section>

            <section>
                <h2 className="text-lg font-black mb-4">Available plans</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {plans.map((plan) => {
                        const isCurrent = plan.id === org.plan_id;
                        return (
                            <div
                                key={plan.id}
                                className={`rounded-2xl border p-6 bg-white ${
                                    isCurrent ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"
                                }`}
                            >
                                <div className="text-sm font-black uppercase tracking-wider text-slate-500">
                                    {plan.name}
                                </div>
                                <div className="mt-2 flex items-baseline gap-1">
                                    <span className="text-3xl font-black">
                                        ${(plan.price_monthly_cents / 100).toFixed(0)}
                                    </span>
                                    {plan.price_monthly_cents > 0 && (
                                        <span className="text-xs text-slate-500">/seat/mo</span>
                                    )}
                                </div>
                                <ul className="mt-4 space-y-2 text-sm">
                                    <li className="text-slate-700">
                                        {plan.seat_limit ? `Up to ${plan.seat_limit} seats` : "Unlimited seats"}
                                    </li>
                                    <li className="text-slate-700">
                                        {plan.project_limit ? `${plan.project_limit} project` : "Unlimited projects"}
                                    </li>
                                    {Object.entries(plan.features).map(([key, enabled]) =>
                                        enabled ? (
                                            <li key={key} className="text-slate-700 flex items-center gap-2">
                                                <span className="text-emerald-500">✓</span>
                                                {FEATURE_LABELS[key] ?? key}
                                            </li>
                                        ) : null
                                    )}
                                </ul>
                                <button
                                    onClick={() => startCheckout(plan.id)}
                                    disabled={isCurrent || plan.id === "free" || loading === plan.id}
                                    className={`mt-6 w-full px-4 py-2 rounded-lg text-sm font-bold transition ${
                                        isCurrent
                                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                            : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                    }`}
                                >
                                    {isCurrent
                                        ? "Current plan"
                                        : plan.id === "free"
                                        ? "—"
                                        : loading === plan.id
                                        ? "Loading..."
                                        : "Upgrade"}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}

function UsageBar({
    label,
    used,
    limit,
}: {
    label: string;
    used: number;
    limit: number | null;
}) {
    const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
    return (
        <div>
            <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                <span className="uppercase tracking-wider">{label}</span>
                <span className="tabular-nums">
                    {used}
                    {limit ? ` / ${limit}` : ""}
                </span>
            </div>
            {limit ? (
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                        className={`h-full ${
                            pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            ) : (
                <div className="text-xs text-slate-400">Unlimited</div>
            )}
        </div>
    );
}
