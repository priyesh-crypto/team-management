"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    setOrgPlan,
    extendTrial,
    compOrg,
    cancelOrgSubscription,
    adjustSeats,
} from "../../actions";
import {
    Card,
    StatusPill,
    PlanPill,
    SectionLabel,
    Button,
    Input,
    Select,
    Field,
    formatMoney,
    humanizeAction,
} from "../../_components/ui";

type Org = {
    id: string;
    name: string;
    plan_id: string;
    subscription_status: string | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
    seats_purchased: number;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    cancel_at_period_end: boolean;
    billing_country: string | null;
};

type Plan = { id: string; name: string; price_monthly_cents: number };
type Usage = { active_seats: number; project_count: number; task_count: number };
type Member = {
    user_id: string;
    role: string;
    profiles: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
};
type AdminAction = {
    id: number;
    action: string;
    payload: Record<string, unknown> | null;
    created_at: string;
};

export function OrgDetailClient({
    org,
    plans,
    usage,
    members,
    recentActions,
}: {
    org: Org;
    plans: Plan[];
    usage: Usage;
    members: Member[];
    recentActions: AdminAction[];
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [planSel, setPlanSel] = useState(org.plan_id);
    const [seats, setSeats] = useState(org.seats_purchased);
    const [trialDays, setTrialDays] = useState(14);
    const [compMonths, setCompMonths] = useState(3);
    const [compPlan, setCompPlan] = useState(plans.find((p) => p.id !== "free")?.id ?? "pro");

    const run = (fn: () => Promise<unknown>) =>
        startTransition(async () => {
            try {
                await fn();
                router.refresh();
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Action failed";
                alert(msg);
            }
        });

    return (
        <div className="p-10 max-w-7xl space-y-6">
            {/* Header */}
            <div>
                <Link
                    href="/admin/orgs"
                    className="text-[10px] font-black uppercase tracking-widest text-[#86868b] hover:text-[#0c64ef] transition"
                >
                    ← All organizations
                </Link>
                <div className="flex items-start justify-between mt-3">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-[#1d1d1f]">{org.name}</h1>
                        <div className="flex items-center gap-2 mt-2.5">
                            <PlanPill plan={org.plan_id} />
                            <StatusPill status={org.subscription_status} />
                            {org.cancel_at_period_end && (
                                <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] rounded-full bg-amber-50 text-amber-700">
                                    Cancels at period end
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] font-mono text-[#86868b] mt-2.5">{org.id}</div>
                    </div>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-4">
                <MiniStat label="Seats" value={`${usage.active_seats} / ${org.seats_purchased}`} />
                <MiniStat label="Projects" value={usage.project_count} />
                <MiniStat label="Tasks" value={usage.task_count} />
                <MiniStat
                    label="Period ends"
                    value={
                        org.current_period_end
                            ? new Date(org.current_period_end).toLocaleDateString()
                            : org.trial_ends_at
                            ? new Date(org.trial_ends_at).toLocaleDateString()
                            : "—"
                    }
                    sub={org.trial_ends_at && !org.current_period_end ? "Trial" : undefined}
                />
            </div>

            {/* Action panels */}
            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <SectionLabel>Change plan</SectionLabel>
                    <div className="space-y-3">
                        <Select value={planSel} onChange={(e) => setPlanSel(e.target.value)}>
                            {plans.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} — {formatMoney(p.price_monthly_cents)}/seat/mo
                                </option>
                            ))}
                        </Select>
                        <Button
                            disabled={isPending || planSel === org.plan_id}
                            onClick={() => run(() => setOrgPlan(org.id, planSel))}
                            className="w-full"
                        >
                            {isPending ? "Updating…" : `Set plan → ${planSel}`}
                        </Button>
                        <p className="text-[10px] text-[#86868b]">
                            Changes the customer&apos;s plan immediately. If Stripe-managed, also
                            updates the Stripe subscription with prorations.
                        </p>
                    </div>
                </Card>

                <Card>
                    <SectionLabel>Adjust seats</SectionLabel>
                    <div className="space-y-3">
                        <Input
                            type="number"
                            min={1}
                            value={seats}
                            onChange={(e) => setSeats(Number(e.target.value))}
                        />
                        <Button
                            disabled={isPending || seats === org.seats_purchased}
                            onClick={() => run(() => adjustSeats(org.id, seats))}
                            className="w-full"
                        >
                            {isPending ? "Updating…" : `Update to ${seats} seats`}
                        </Button>
                        <p className="text-[10px] text-[#86868b]">
                            Stripe is updated with prorated billing if connected. Cannot drop below
                            current active members ({usage.active_seats}).
                        </p>
                    </div>
                </Card>

                <Card>
                    <SectionLabel>Extend trial</SectionLabel>
                    <div className="space-y-3">
                        <Input
                            type="number"
                            min={1}
                            value={trialDays}
                            onChange={(e) => setTrialDays(Number(e.target.value))}
                        />
                        <Button
                            variant="secondary"
                            disabled={isPending || org.subscription_status === "active"}
                            onClick={() => run(() => extendTrial(org.id, trialDays))}
                            className="w-full"
                        >
                            {isPending ? "Updating…" : `Add ${trialDays} trial days`}
                        </Button>
                        <p className="text-[10px] text-[#86868b]">
                            Only valid for non-paying customers. Pushes the trial end on Stripe too.
                        </p>
                    </div>
                </Card>

                <Card>
                    <SectionLabel>Comp subscription</SectionLabel>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <Select value={compPlan} onChange={(e) => setCompPlan(e.target.value)}>
                                {plans
                                    .filter((p) => p.id !== "free")
                                    .map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                            </Select>
                            <Input
                                type="number"
                                min={1}
                                value={compMonths}
                                onChange={(e) => setCompMonths(Number(e.target.value))}
                                placeholder="Months"
                            />
                        </div>
                        <Button
                            disabled={isPending}
                            onClick={() => run(() => compOrg(org.id, compPlan, compMonths))}
                            className="w-full"
                        >
                            {isPending ? "Updating…" : `Comp ${compPlan} for ${compMonths} months`}
                        </Button>
                        <p className="text-[10px] text-[#86868b]">
                            Cancels any active Stripe subscription, then grants this plan free for
                            the chosen period.
                        </p>
                    </div>
                </Card>
            </div>

            {/* Cancel */}
            <Card className="border-red-100">
                <SectionLabel>Danger zone</SectionLabel>
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <p className="text-sm font-medium text-[#1d1d1f]">
                        Cancel this organization&apos;s subscription.
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            disabled={isPending}
                            onClick={() => {
                                if (confirm("Cancel at period end?"))
                                    run(() => cancelOrgSubscription(org.id, false));
                            }}
                        >
                            Cancel at period end
                        </Button>
                        <Button
                            variant="danger"
                            disabled={isPending}
                            onClick={() => {
                                if (
                                    confirm(
                                        "Cancel IMMEDIATELY? This downgrades them to free right now."
                                    )
                                )
                                    run(() => cancelOrgSubscription(org.id, true));
                            }}
                        >
                            Cancel now
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Members */}
            <Card>
                <SectionLabel>Members ({members.length})</SectionLabel>
                {members.length === 0 ? (
                    <p className="text-sm text-[#86868b]">No members.</p>
                ) : (
                    <div className="space-y-2">
                        {members.map((m) => {
                            const profile = Array.isArray(m.profiles)
                                ? m.profiles[0]
                                : m.profiles;
                            const name = profile?.full_name ?? m.user_id;
                            const initial = (profile?.full_name ?? "?").slice(0, 1).toUpperCase();
                            return (
                                <div
                                    key={m.user_id}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-[#f5f5f7] transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1d1d1f] to-[#434343] text-white text-xs font-black flex items-center justify-center">
                                            {initial}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-[#1d1d1f]">
                                                {name}
                                            </div>
                                            <div className="text-[10px] font-mono text-[#86868b]">
                                                {m.user_id.slice(0, 8)}…
                                            </div>
                                        </div>
                                    </div>
                                    <RolePill role={m.role} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* Audit timeline */}
            {recentActions.length > 0 && (
                <Card>
                    <SectionLabel>Recent admin actions</SectionLabel>
                    <div className="space-y-3">
                        {recentActions.map((a) => (
                            <ActionRow key={a.id} action={a} />
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}

function MiniStat({
    label,
    value,
    sub,
}: {
    label: string;
    value: string | number;
    sub?: string;
}) {
    return (
        <Card padding="p-5">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#86868b]">
                {label}
            </div>
            <div className="text-2xl font-black mt-1.5 tracking-tight text-[#1d1d1f]">
                {value}
            </div>
            {sub && (
                <div className="text-[10px] font-bold text-[#0c64ef] uppercase tracking-wider mt-1">
                    {sub}
                </div>
            )}
        </Card>
    );
}

function RolePill({ role }: { role: string }) {
    const colors: Record<string, string> = {
        owner: "bg-purple-50 text-purple-700",
        admin: "bg-[#0c64ef]/10 text-[#0c64ef]",
        manager: "bg-emerald-50 text-emerald-700",
        employee: "bg-[#f5f5f7] text-[#86868b]",
    };
    return (
        <span
            className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] rounded-full ${
                colors[role] ?? "bg-[#f5f5f7] text-[#1d1d1f]"
            }`}
        >
            {role}
        </span>
    );
}

function ActionRow({ action }: { action: AdminAction }) {
    return (
        <div className="flex items-start gap-3 pb-3 border-b border-[#f5f5f7] last:border-0 last:pb-0">
            <div className="w-8 h-8 rounded-xl bg-[#0c64ef]/10 text-[#0c64ef] flex items-center justify-center text-xs flex-shrink-0">
                ⚡
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-black text-[#1d1d1f]">
                        {humanizeAction(action.action)}
                    </div>
                    <div className="text-[10px] text-[#86868b] font-medium whitespace-nowrap">
                        {new Date(action.created_at).toLocaleString()}
                    </div>
                </div>
                {action.payload && Object.keys(action.payload).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {Object.entries(action.payload).map(([k, v]) => (
                            <span
                                key={k}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-[#f5f5f7] text-[#86868b] font-medium"
                            >
                                <span className="font-bold text-[#1d1d1f]">{k}</span>{" "}
                                {typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
