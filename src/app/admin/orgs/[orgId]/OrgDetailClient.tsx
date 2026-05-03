"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, BarChart3, AlertTriangle, Zap } from "lucide-react";
import {
    setOrgPlan,
    extendTrial,
    compOrg,
    cancelOrgSubscription,
    adjustSeats,
    deleteOrganization,
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
import { SuspendPanel } from "./SuspendPanel";
import { CreditsPanel } from "./CreditsPanel";
import { FeatureOverridesPanel } from "./FeatureOverridesPanel";
import { ImpersonateButton } from "./ImpersonateButton";

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
    suspended_at: string | null;
    suspended_reason: string | null;
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
type Credit = {
    id: string;
    amount_cents: number;
    currency: string;
    reason: string;
    created_at: string;
    applied_at: string | null;
};
type FeatureOverride = {
    feature_key: string;
    enabled: boolean;
    updated_at: string;
};

export function OrgDetailClient({
    org,
    plans,
    usage,
    members,
    recentActions,
    credits,
    featureOverrides,
}: {
    org: Org;
    plans: Plan[];
    usage: Usage;
    members: Member[];
    recentActions: AdminAction[];
    credits: Credit[];
    featureOverrides: FeatureOverride[];
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [planSel, setPlanSel] = useState(org.plan_id);
    const [seats, setSeats] = useState(org.seats_purchased);
    const [trialDays, setTrialDays] = useState(14);
    const [compMonths, setCompMonths] = useState(3);
    const [compPlan, setCompPlan] = useState(plans.find((p) => p.id !== "free")?.id ?? "pro");
    const [showDelete, setShowDelete] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState("");

    const run = (fn: () => Promise<unknown>) =>
        startTransition(async () => {
            try {
                await fn();
                router.refresh();
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Action failed";
                toast.error(msg);
            }
        });

    return (
        <div className="p-8 max-w-7xl space-y-5">
            {/* Header */}
            <div>
                <Link
                    href="/admin/orgs"
                    className="inline-flex items-center gap-1 text-xs text-[#86868b] hover:text-[#0051e6] transition-colors"
                >
                    <ArrowLeft size={12} strokeWidth={2} />
                    All organizations
                </Link>
                <div className="flex items-start justify-between mt-3">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">{org.name}</h1>
                        <div className="flex items-center gap-1.5 mt-2">
                            <PlanPill plan={org.plan_id} />
                            <StatusPill status={org.subscription_status} />
                            {org.cancel_at_period_end && (
                                <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-50 text-amber-700">
                                    Cancels at period end
                                </span>
                            )}
                            {org.suspended_at && (
                                <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-red-50 text-red-700">
                                    Suspended
                                </span>
                            )}
                        </div>
                        <div className="text-xs font-mono text-[#86868b] mt-2">{org.id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/admin/orgs/${org.id}/usage`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#e5e5ea] bg-white text-sm font-medium text-[#52525b] hover:bg-[#f5f5f7] transition-colors"
                        >
                            <BarChart3 size={14} strokeWidth={2} />
                            Usage
                        </Link>
                        <ImpersonateButton orgId={org.id} />
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

            {/* Operational panels */}
            <div className="grid grid-cols-2 gap-4">
                <SuspendPanel
                    orgId={org.id}
                    suspendedAt={org.suspended_at}
                    suspendedReason={org.suspended_reason}
                />
                <CreditsPanel orgId={org.id} credits={credits} />
            </div>

            <FeatureOverridesPanel orgId={org.id} overrides={featureOverrides} />

            {/* Danger zone */}
            <Card className="border-red-100">
                <SectionLabel>Danger zone</SectionLabel>
                <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-[#f0f0f2]">
                        <div>
                            <p className="text-sm font-medium text-[#1d1d1f]">Cancel subscription</p>
                            <p className="text-xs text-[#86868b] mt-0.5">
                                Stops billing. Org and data remain.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                disabled={isPending}
                                onClick={() => {
                                    if (confirm("Cancel at period end?"))
                                        run(() => cancelOrgSubscription(org.id, false));
                                }}
                            >
                                At period end
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

                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <p className="text-sm font-medium text-red-700">Delete organization</p>
                            <p className="text-xs text-[#86868b] mt-0.5">
                                Permanently removes the org, all members, projects, tasks, comments,
                                and attachments. Cannot be undone.
                            </p>
                        </div>
                        <Button variant="danger" onClick={() => setShowDelete(true)}>
                            Delete organization
                        </Button>
                    </div>
                </div>
            </Card>

            {showDelete && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-[520px] max-w-full !border-red-200">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-9 h-9 rounded-md bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                <AlertTriangle size={18} strokeWidth={2} />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold tracking-tight text-[#1d1d1f]">
                                    Delete this organization?
                                </h3>
                                <p className="text-xs text-[#86868b] mt-1">
                                    This permanently removes <strong>{org.name}</strong>, all{" "}
                                    {members.length} members, {usage.project_count} projects, and{" "}
                                    {usage.task_count} tasks. Cannot be undone.
                                </p>
                            </div>
                        </div>

                        <div className="bg-red-50/50 rounded-md p-3 mb-4 space-y-1 text-xs text-red-900">
                            <p className="font-medium">What happens:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-red-800/80">
                                <li>Stripe subscription cancelled (if any)</li>
                                <li>All organization data deleted via cascade</li>
                                <li>User accounts kept (they may belong to other orgs)</li>
                                <li>Stripe customer record kept for invoice history</li>
                                <li>Action recorded in audit log</li>
                            </ul>
                        </div>

                        <Field
                            label="Type organization name to confirm"
                            hint={`Match exactly: ${org.name}`}
                        >
                            <Input
                                value={deleteConfirm}
                                onChange={(e) => setDeleteConfirm(e.target.value)}
                                placeholder={org.name}
                                autoFocus
                            />
                        </Field>

                        <div className="flex gap-2 mt-4">
                            <Button
                                variant="danger"
                                disabled={isPending || deleteConfirm !== org.name}
                                onClick={() =>
                                    startTransition(async () => {
                                        try {
                                            await deleteOrganization(org.id, deleteConfirm);
                                            router.push("/admin/orgs");
                                        } catch (e: unknown) {
                                            toast.error(e instanceof Error ? e.message : "Delete failed");
                                        }
                                    })
                                }
                                className="flex-1"
                            >
                                {isPending ? "Deleting…" : "Delete permanently"}
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setShowDelete(false);
                                    setDeleteConfirm("");
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

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
                                    className="flex items-center justify-between p-2.5 rounded-md hover:bg-[#f5f5f7] transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[#1d1d1f] text-white text-xs font-semibold flex items-center justify-center">
                                            {initial}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-[#1d1d1f]">
                                                {name}
                                            </div>
                                            <div className="text-xs font-mono text-[#86868b]">
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
        <Card padding="p-4">
            <div className="text-xs font-medium text-[#86868b]">
                {label}
            </div>
            <div className="text-xl font-semibold mt-1 tracking-tight text-[#1d1d1f] tabular-nums">
                {value}
            </div>
            {sub && (
                <div className="text-xs text-[#0051e6] mt-0.5">
                    {sub}
                </div>
            )}
        </Card>
    );
}

function RolePill({ role }: { role: string }) {
    const colors: Record<string, string> = {
        owner: "bg-purple-50 text-purple-700",
        admin: "bg-[#0051e6]/10 text-[#0051e6]",
        manager: "bg-emerald-50 text-emerald-700",
        employee: "bg-[#f5f5f7] text-[#52525b]",
    };
    return (
        <span
            className={`px-2 py-0.5 text-[11px] font-medium rounded-full capitalize ${
                colors[role] ?? "bg-[#f5f5f7] text-[#1d1d1f]"
            }`}
        >
            {role}
        </span>
    );
}

function ActionRow({ action }: { action: AdminAction }) {
    return (
        <div className="flex items-start gap-3 pb-3 border-b border-[#f0f0f2] last:border-0 last:pb-0">
            <div className="w-7 h-7 rounded-md bg-[#0051e6]/10 text-[#0051e6] flex items-center justify-center shrink-0">
                <Zap size={13} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-[#1d1d1f]">
                        {humanizeAction(action.action)}
                    </div>
                    <div className="text-xs text-[#86868b] whitespace-nowrap">
                        {new Date(action.created_at).toLocaleString()}
                    </div>
                </div>
                {action.payload && Object.keys(action.payload).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {Object.entries(action.payload).map(([k, v]) => (
                            <span
                                key={k}
                                className="text-xs px-2 py-0.5 rounded bg-[#f5f5f7] text-[#52525b]"
                            >
                                <span className="font-medium text-[#1d1d1f]">{k}</span>{" "}
                                {typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
