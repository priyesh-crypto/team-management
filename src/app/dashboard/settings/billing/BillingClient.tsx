"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Check, X, Sparkles, Zap, Crown, ArrowRight } from "lucide-react";

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

const PLAN_ORDER = ["free", "pro", "business"];

const PLAN_META: Record<string, {
    icon: React.ReactNode;
    tagline: string;
    accent: string;
    badge?: string;
    cta: string;
}> = {
    free: {
        icon: <Sparkles size={18} />,
        tagline: "Get started solo or with a small team.",
        accent: "border-slate-200",
        cta: "Free forever",
    },
    pro: {
        icon: <Zap size={18} />,
        tagline: "For growing teams that need more power.",
        accent: "border-[#0c64ef] ring-2 ring-[#0c64ef]/10",
        badge: "MOST POPULAR",
        cta: "Upgrade to Pro",
    },
    business: {
        icon: <Crown size={18} />,
        tagline: "For organizations that need scale & control.",
        accent: "border-[#1d1d1f]",
        cta: "Upgrade to Business",
    },
};

// Grouped feature matrix — every row tells customers what they unlock.
type FeatureRow = { key: string; label: string; description?: string };
type FeatureGroup = { label: string; rows: FeatureRow[] };

const FEATURE_GROUPS: FeatureGroup[] = [
    {
        label: "Task management",
        rows: [
            { key: "_seats", label: "Team seats" },
            { key: "_projects", label: "Projects" },
            { key: "recurring_tasks", label: "Recurring tasks", description: "Repeat daily, weekly, monthly" },
            { key: "task_templates", label: "Task templates" },
            { key: "custom_statuses", label: "Custom statuses" },
            { key: "saved_views", label: "Saved views" },
            { key: "bulk_actions", label: "Bulk actions" },
            { key: "time_tracker", label: "Time tracker" },
            { key: "milestones", label: "Milestones" },
            { key: "sprints", label: "Sprints" },
            { key: "gantt_dependencies", label: "Gantt & dependencies" },
        ],
    },
    {
        label: "Collaboration",
        rows: [
            { key: "task_comments", label: "Task comments" },
            { key: "comment_reactions", label: "Comment reactions" },
            { key: "notifications", label: "In-app notifications" },
            { key: "public_share_links", label: "Public share links" },
            { key: "client_portal", label: "Client portal" },
            { key: "approvals", label: "Approval workflows" },
        ],
    },
    {
        label: "AI & automation",
        rows: [
            { key: "ai_breakdown", label: "AI task breakdown" },
            { key: "ai_weekly_summary", label: "AI weekly summary" },
            { key: "smart_due_dates", label: "Smart due dates" },
            { key: "automations", label: "Custom automations" },
        ],
    },
    {
        label: "Reporting & insights",
        rows: [
            { key: "reports_dashboards", label: "Reports & dashboards" },
            { key: "workload_view", label: "Workload heatmap" },
            { key: "custom_fields", label: "Custom fields" },
            { key: "forms", label: "Public forms" },
            { key: "data_export", label: "Data export (CSV / JSON)" },
        ],
    },
    {
        label: "Integrations & API",
        rows: [
            { key: "github_integration", label: "GitHub integration" },
            { key: "slack_integration", label: "Slack integration" },
            { key: "calendar_sync", label: "Calendar sync" },
            { key: "email_to_task", label: "Email to task" },
            { key: "extended_api", label: "REST API access" },
            { key: "webhooks_api", label: "Webhooks" },
        ],
    },
    {
        label: "Security & admin",
        rows: [
            { key: "sso", label: "Single sign-on (SAML/OIDC)" },
            { key: "custom_roles", label: "Custom roles & permissions" },
            { key: "org_audit_log", label: "Audit log" },
            { key: "white_labeling", label: "White-labeling" },
        ],
    },
];

function formatPrice(cents: number) {
    if (cents === 0) return "Free";
    return `$${(cents / 100).toFixed(0)}`;
}

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
    const [billing] = useState<"monthly" | "annual">("monthly");

    // Order plans by our canonical order, fallback to whatever was returned
    const orderedPlans = [...plans].sort((a, b) => {
        const ai = PLAN_ORDER.indexOf(a.id);
        const bi = PLAN_ORDER.indexOf(b.id);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const currentPlan = plans.find(p => p.id === org.plan_id);
    const status = org.subscription_status ?? "free";
    const trialEnds = org.trial_ends_at ? new Date(org.trial_ends_at) : null;

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
            else toast.error(json.error ?? "Checkout failed");
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
            else toast.error(json.error ?? "Could not open billing portal");
        } finally {
            setLoading(null);
        }
    }

    function getCellValue(plan: Plan, row: FeatureRow): React.ReactNode {
        if (row.key === "_seats") {
            return plan.seat_limit ? (
                <span className="text-sm font-black text-[#1d1d1f]">{plan.seat_limit}</span>
            ) : (
                <span className="text-sm font-black text-emerald-600">Unlimited</span>
            );
        }
        if (row.key === "_projects") {
            return plan.project_limit ? (
                <span className="text-sm font-black text-[#1d1d1f]">{plan.project_limit}</span>
            ) : (
                <span className="text-sm font-black text-emerald-600">Unlimited</span>
            );
        }
        const enabled = Boolean(plan.features?.[row.key]);
        return enabled ? (
            <Check size={16} className="text-emerald-500 mx-auto" />
        ) : (
            <X size={14} className="text-slate-300 mx-auto" />
        );
    }

    return (
        <div className="mx-auto max-w-6xl p-8 space-y-8">
            {/* Header */}
            <header>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0c64ef] mb-1.5">
                    Plans & Billing
                </div>
                <h1 className="text-3xl font-black tracking-tight text-[#1d1d1f]">
                    {org.name}
                </h1>
                <p className="text-sm text-slate-500 font-medium mt-1.5">
                    Choose the plan that fits your team. Upgrade or downgrade any time.
                </p>
            </header>

            {/* Current plan summary */}
            <section className="rounded-2xl border border-slate-200 p-6 bg-white">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Current Plan
                        </div>
                        <div className="text-2xl font-black mt-1 text-[#1d1d1f]">
                            {currentPlan?.name ?? "Free"}
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span
                                className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full ${
                                    status === "active"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : status === "trialing"
                                        ? "bg-amber-100 text-amber-700"
                                        : status === "past_due"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-slate-100 text-slate-600"
                                }`}
                            >
                                {status}
                            </span>
                            {trialEnds && status === "trialing" && (
                                <span className="text-xs text-slate-500 font-bold">
                                    Trial ends {trialEnds.toLocaleDateString()}
                                </span>
                            )}
                            {org.cancel_at_period_end && (
                                <span className="text-xs text-amber-600 font-black">
                                    Cancels at period end
                                </span>
                            )}
                        </div>
                    </div>
                    {org.plan_id !== "free" && (
                        <button
                            onClick={openPortal}
                            disabled={loading === "portal"}
                            className="px-4 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-black hover:bg-[#434343] disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {loading === "portal" ? "Opening..." : "Manage billing"}
                            <ArrowRight size={14} />
                        </button>
                    )}
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            {/* Plan cards */}
            <section>
                <h2 className="text-lg font-black tracking-tight text-[#1d1d1f] mb-4">Choose your plan</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {orderedPlans.map(plan => {
                        const meta = PLAN_META[plan.id] ?? {
                            icon: null, tagline: "", accent: "border-slate-200", cta: "Select",
                        };
                        const isCurrent = plan.id === org.plan_id;
                        const isFree = plan.id === "free";
                        return (
                            <div
                                key={plan.id}
                                className={`relative rounded-2xl border-2 p-6 bg-white transition-shadow hover:shadow-md ${meta.accent}`}
                            >
                                {meta.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0c64ef] text-white text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow-md">
                                        {meta.badge}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 text-[#1d1d1f]">
                                    <span className={`p-1.5 rounded-lg ${
                                        plan.id === "pro" ? "bg-[#0c64ef]/10 text-[#0c64ef]" :
                                        plan.id === "business" ? "bg-[#1d1d1f]/10 text-[#1d1d1f]" :
                                        "bg-slate-100 text-slate-500"
                                    }`}>{meta.icon}</span>
                                    <span className="text-sm font-black uppercase tracking-wider">{plan.name}</span>
                                </div>

                                <div className="mt-3 flex items-baseline gap-1">
                                    <span className="text-4xl font-black tracking-tight text-[#1d1d1f]">
                                        {formatPrice(plan.price_monthly_cents)}
                                    </span>
                                    {plan.price_monthly_cents > 0 && (
                                        <span className="text-xs text-slate-500 font-bold">
                                            /seat /{billing === "monthly" ? "mo" : "yr"}
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-slate-500 mt-2 font-medium">{meta.tagline}</p>

                                {/* Headline features */}
                                <ul className="mt-5 space-y-2 text-xs">
                                    <li className="flex items-center gap-2 text-slate-700">
                                        <Check size={13} className="text-emerald-500 flex-shrink-0" />
                                        <span className="font-bold">{plan.seat_limit ? `${plan.seat_limit} seats` : "Unlimited seats"}</span>
                                    </li>
                                    <li className="flex items-center gap-2 text-slate-700">
                                        <Check size={13} className="text-emerald-500 flex-shrink-0" />
                                        <span className="font-bold">{plan.project_limit ? `${plan.project_limit} project${plan.project_limit !== 1 ? "s" : ""}` : "Unlimited projects"}</span>
                                    </li>
                                    {plan.id === "pro" && (
                                        <>
                                            <li className="flex items-center gap-2 text-slate-700"><Check size={13} className="text-emerald-500 flex-shrink-0" /><span>AI task breakdown & weekly summaries</span></li>
                                            <li className="flex items-center gap-2 text-slate-700"><Check size={13} className="text-emerald-500 flex-shrink-0" /><span>Time tracker, milestones, sprints</span></li>
                                            <li className="flex items-center gap-2 text-slate-700"><Check size={13} className="text-emerald-500 flex-shrink-0" /><span>GitHub integration & REST API</span></li>
                                        </>
                                    )}
                                    {plan.id === "business" && (
                                        <>
                                            <li className="flex items-center gap-2 text-slate-700"><Check size={13} className="text-emerald-500 flex-shrink-0" /><span>Everything in Pro, plus:</span></li>
                                            <li className="flex items-center gap-2 text-slate-700"><Check size={13} className="text-emerald-500 flex-shrink-0" /><span>SSO, custom roles, audit log</span></li>
                                            <li className="flex items-center gap-2 text-slate-700"><Check size={13} className="text-emerald-500 flex-shrink-0" /><span>Slack, automations, white-labeling</span></li>
                                            <li className="flex items-center gap-2 text-slate-700"><Check size={13} className="text-emerald-500 flex-shrink-0" /><span>Reports, forms, custom fields</span></li>
                                        </>
                                    )}
                                </ul>

                                <button
                                    onClick={() => !isCurrent && !isFree && startCheckout(plan.id)}
                                    disabled={isCurrent || isFree || loading === plan.id}
                                    className={`mt-6 w-full px-4 py-2.5 rounded-xl text-sm font-black transition-colors ${
                                        isCurrent
                                            ? "bg-emerald-50 text-emerald-700 cursor-default border border-emerald-200"
                                            : isFree
                                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                            : plan.id === "pro"
                                            ? "bg-[#0c64ef] text-white hover:bg-[#005bb7]"
                                            : "bg-[#1d1d1f] text-white hover:bg-[#434343]"
                                    }`}
                                >
                                    {isCurrent ? "✓ Current plan" :
                                     isFree ? "—" :
                                     loading === plan.id ? "Loading..." :
                                     meta.cta}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Feature comparison matrix */}
            <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="text-base font-black tracking-tight text-[#1d1d1f]">Compare features</h2>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">Everything you get on each plan.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-slate-100">
                                <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-2/5">
                                    Feature
                                </th>
                                {orderedPlans.map(plan => (
                                    <th key={plan.id} className={`text-center px-3 py-3 ${
                                        plan.id === "pro" ? "bg-[#0c64ef]/5" : ""
                                    }`}>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[#1d1d1f]">
                                                {plan.name}
                                            </span>
                                            {plan.id === "pro" && (
                                                <span className="bg-[#0c64ef] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">
                                                    Popular
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {FEATURE_GROUPS.map(group => (
                                <React.Fragment key={group.label}>
                                    <tr className="bg-slate-50/50">
                                        <td colSpan={orderedPlans.length + 1}
                                            className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            {group.label}
                                        </td>
                                    </tr>
                                    {group.rows.map(row => (
                                        <tr key={row.key} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                                            <td className="px-6 py-2.5">
                                                <div className="text-xs font-bold text-[#1d1d1f]">{row.label}</div>
                                                {row.description && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{row.description}</div>
                                                )}
                                            </td>
                                            {orderedPlans.map(plan => (
                                                <td key={plan.id}
                                                    className={`text-center px-3 py-2.5 ${plan.id === "pro" ? "bg-[#0c64ef]/3" : ""}`}>
                                                    {getCellValue(plan, row)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* FAQ */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    { q: "Can I change plans later?", a: "Yes — upgrade or downgrade anytime. Changes are prorated automatically through Stripe." },
                    { q: "What happens to my data on downgrade?", a: "Your data is preserved. If you exceed the new plan's limits (seats, projects), you'll be asked to remove items before downgrading." },
                    { q: "Do you offer annual billing?", a: "Annual plans with two months free are available — contact sales@mindbird.ai." },
                    { q: "What's included in each seat?", a: "Every seat includes full access to your plan's features. Inactive members don't count toward your seat usage." },
                ].map(item => (
                    <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-sm font-black text-[#1d1d1f]">{item.q}</p>
                        <p className="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed">{item.a}</p>
                    </div>
                ))}
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
    const overLimit = limit !== null && used > limit;
    return (
        <div>
            <div className="flex justify-between text-xs font-black mb-1.5">
                <span className="uppercase tracking-wider text-slate-500">{label}</span>
                <span className={`tabular-nums ${overLimit ? "text-red-600" : "text-slate-700"}`}>
                    {used}
                    {limit ? ` / ${limit}` : ""}
                </span>
            </div>
            {limit ? (
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                        className={`h-full transition-all ${
                            pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-[#0c64ef]"
                        }`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            ) : (
                <div className="text-[10px] text-emerald-600 font-black uppercase tracking-wider">Unlimited</div>
            )}
        </div>
    );
}
