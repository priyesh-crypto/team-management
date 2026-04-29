"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { requirePlatformAdmin, logAdminAction } from "@/lib/platform-admin";
import { stripe } from "@/lib/stripe";

type AdminClient = ReturnType<typeof createAdminClient>;

// ----------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------
async function getOrgOrThrow(admin: AdminClient, orgId: string) {
    const { data, error } = await admin
        .from("organizations")
        .select(
            "id, name, plan_id, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end, trial_ends_at, seats_purchased, billing_country"
        )
        .eq("id", orgId)
        .single();
    if (error || !data) throw new Error(`Organization not found: ${orgId}`);
    return data;
}

async function getPlanOrThrow(admin: AdminClient, planId: string) {
    const { data, error } = await admin
        .from("plans")
        .select("*")
        .eq("id", planId)
        .single();
    if (error || !data) throw new Error(`Plan not found: ${planId}`);
    if (!data.is_active) throw new Error(`Plan is not active: ${planId}`);
    return data;
}

async function resolveRegionalPrice(
    admin: AdminClient,
    planId: string,
    country: string | null
): Promise<{ stripe_price_id: string | null; currency: string; price_monthly_cents: number } | null> {
    const lookup = (country ?? "DEFAULT").toUpperCase();
    const { data: regional } = await admin
        .from("plan_prices")
        .select("stripe_price_id, currency, price_monthly_cents")
        .eq("plan_id", planId)
        .eq("country_code", lookup)
        .eq("is_active", true)
        .maybeSingle();
    if (regional) return regional;
    const { data: fallback } = await admin
        .from("plan_prices")
        .select("stripe_price_id, currency, price_monthly_cents")
        .eq("plan_id", planId)
        .eq("country_code", "DEFAULT")
        .eq("is_active", true)
        .maybeSingle();
    return fallback ?? null;
}

async function getActiveMemberCount(admin: AdminClient, orgId: string): Promise<number> {
    const { data } = await admin.rpc("org_active_member_count", { target_org: orgId });
    return Number(data ?? 0);
}

// ----------------------------------------------------------------------
// Plan catalog management
// ----------------------------------------------------------------------
export async function updatePlan(planId: string, updates: {
    name?: string;
    price_monthly_cents?: number;
    stripe_price_id?: string | null;
    seat_limit?: number | null;
    project_limit?: number | null;
    features?: Record<string, boolean>;
    is_active?: boolean;
}) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from("plans").update(updates).eq("id", planId);
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "update_plan", null, { planId, updates });
    revalidatePath("/admin");
    revalidatePath("/admin/plans");
}

export async function createPlan(plan: {
    id: string;
    name: string;
    price_monthly_cents: number;
    stripe_price_id?: string | null;
    seat_limit?: number | null;
    project_limit?: number | null;
    features?: Record<string, boolean>;
    sort_order?: number;
}) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from("plans").insert(plan);
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "create_plan", null, { plan });
    revalidatePath("/admin/plans");
}

// ----------------------------------------------------------------------
// Regional pricing
// ----------------------------------------------------------------------
export async function upsertPlanPrice(input: {
    plan_id: string;
    country_code: string;
    currency: string;
    price_monthly_cents: number;
    stripe_price_id?: string | null;
    is_active?: boolean;
}) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const country = input.country_code.toUpperCase();
    const currency = input.currency.toUpperCase();

    if (!/^[A-Z]{2,7}$/.test(country)) throw new Error("country_code must be ISO-2 or 'DEFAULT'");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be ISO-3 (e.g. USD, INR)");
    if (input.price_monthly_cents < 0) throw new Error("price must be >= 0");

    const { error } = await admin
        .from("plan_prices")
        .upsert(
            {
                plan_id: input.plan_id,
                country_code: country,
                currency,
                price_monthly_cents: input.price_monthly_cents,
                stripe_price_id: input.stripe_price_id ?? null,
                is_active: input.is_active ?? true,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "plan_id,country_code" }
        );
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "upsert_plan_price", null, {
        plan_id: input.plan_id,
        country_code: country,
        currency,
        price_monthly_cents: input.price_monthly_cents,
    });
    revalidatePath("/admin/plans");
}

export async function deletePlanPrice(id: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from("plan_prices").delete().eq("id", id);
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "delete_plan_price", null, { id });
    revalidatePath("/admin/plans");
}

// ----------------------------------------------------------------------
// Per-org subscription management
// ----------------------------------------------------------------------

/**
 * Change an org's plan.
 *
 * Behavior:
 * - If the org has an active Stripe subscription, swap the subscription's price
 *   item to the new plan's regional price. Local DB sync follows via webhook.
 * - If the org has no Stripe subscription (free / comped), update locally.
 * - Downgrading to free resets seats_purchased to the free plan's seat_limit.
 */
export async function setOrgPlan(orgId: string, planId: string, opts?: { seats?: number }) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const org = await getOrgOrThrow(admin, orgId);
    const newPlan = await getPlanOrThrow(admin, planId);

    if (org.plan_id === planId && opts?.seats === undefined) {
        return { ok: true, noop: true };
    }

    // Path 1: Stripe-managed subscription — update Stripe, let webhook sync DB
    if (org.stripe_subscription_id && newPlan.id !== "free") {
        const price = await resolveRegionalPrice(admin, planId, org.billing_country);
        if (!price?.stripe_price_id) {
            throw new Error(
                `No Stripe price configured for plan '${planId}' in region '${org.billing_country ?? "DEFAULT"}'.`
            );
        }

        const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
        const itemId = sub.items.data[0]?.id;
        if (!itemId) throw new Error("Stripe subscription has no items");

        const seats = opts?.seats ?? org.seats_purchased;
        const activeMembers = await getActiveMemberCount(admin, orgId);
        if (newPlan.seat_limit !== null && newPlan.seat_limit !== undefined && seats > newPlan.seat_limit) {
            throw new Error(`New plan caps at ${newPlan.seat_limit} seats; requested ${seats}.`);
        }
        if (seats < activeMembers) {
            throw new Error(`Cannot set seats=${seats} below current active members (${activeMembers}).`);
        }

        await stripe.subscriptions.update(org.stripe_subscription_id, {
            items: [{ id: itemId, price: price.stripe_price_id, quantity: seats }],
            proration_behavior: "create_prorations",
            metadata: { org_id: orgId, plan_id: planId },
        });

        // Optimistic local update; webhook will reconcile with authoritative state
        await admin
            .from("organizations")
            .update({ plan_id: planId, seats_purchased: seats })
            .eq("id", orgId);
    } else {
        // Path 2: Local-only update (free or comped, no Stripe sub)
        let seats = opts?.seats ?? org.seats_purchased;
        if (newPlan.id === "free") {
            seats = Math.min(seats, newPlan.seat_limit ?? 3);
            // Cancel any leftover Stripe sub silently to avoid future charges
            if (org.stripe_subscription_id) {
                try {
                    await stripe.subscriptions.cancel(org.stripe_subscription_id);
                } catch (e) {
                    console.warn("[setOrgPlan] failed to cancel Stripe sub on free downgrade", e);
                }
            }
            await admin
                .from("organizations")
                .update({
                    plan_id: "free",
                    seats_purchased: seats,
                    subscription_status: "canceled",
                    stripe_subscription_id: null,
                    current_period_end: null,
                    cancel_at_period_end: false,
                })
                .eq("id", orgId);
        } else {
            await admin
                .from("organizations")
                .update({ plan_id: planId, seats_purchased: seats })
                .eq("id", orgId);
        }
    }

    await logAdminAction(user.id, "set_org_plan", orgId, { planId, ...opts });
    revalidatePath(`/admin/orgs/${orgId}`);
    revalidatePath("/admin");
    return { ok: true };
}

/**
 * Extend an org's trial.
 * Only valid when the org is currently on a trial — refuses to convert
 * an active paying customer back to trialing.
 */
export async function extendTrial(orgId: string, days: number) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();
    if (days <= 0) throw new Error("days must be > 0");

    const org = await getOrgOrThrow(admin, orgId);
    if (org.subscription_status === "active") {
        throw new Error(
            "Cannot extend trial on an active paying subscription. Use the Stripe Portal or comp instead."
        );
    }

    const base = org.trial_ends_at ? new Date(org.trial_ends_at).getTime() : Date.now();
    const newEnd = new Date(Math.max(base, Date.now()) + days * 86400000).toISOString();

    if (org.stripe_subscription_id) {
        // Stripe-managed trial
        await stripe.subscriptions.update(org.stripe_subscription_id, {
            trial_end: Math.floor(new Date(newEnd).getTime() / 1000),
            proration_behavior: "none",
        });
    }

    const { error } = await admin
        .from("organizations")
        .update({ trial_ends_at: newEnd, subscription_status: "trialing" })
        .eq("id", orgId);
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "extend_trial", orgId, { days, newEnd });
    revalidatePath(`/admin/orgs/${orgId}`);
}

/**
 * Comp a paid plan to an org for N months at no charge.
 * Cancels any existing Stripe subscription FIRST so the customer stops being billed.
 */
export async function compOrg(orgId: string, planId: string, months: number) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();
    if (months <= 0) throw new Error("months must be > 0");

    const org = await getOrgOrThrow(admin, orgId);
    await getPlanOrThrow(admin, planId);

    // Stop billing first
    if (org.stripe_subscription_id) {
        try {
            await stripe.subscriptions.cancel(org.stripe_subscription_id, { invoice_now: false, prorate: true });
        } catch (e) {
            console.warn("[compOrg] could not cancel pre-existing Stripe sub", e);
        }
    }

    const periodEnd = new Date(Date.now() + months * 30 * 86400000).toISOString();
    const { error } = await admin
        .from("organizations")
        .update({
            plan_id: planId,
            subscription_status: "active",
            current_period_end: periodEnd,
            stripe_subscription_id: null,
            cancel_at_period_end: false,
            trial_ends_at: null,
        })
        .eq("id", orgId);
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "comp_org", orgId, { planId, months, periodEnd });
    revalidatePath(`/admin/orgs/${orgId}`);
}

/**
 * Cancel a subscription either immediately or at period end.
 * Optimistically updates local state so the admin UI reflects the action.
 * Webhook will reconcile authoritative state when Stripe confirms.
 */
export async function cancelOrgSubscription(orgId: string, immediate: boolean) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const org = await getOrgOrThrow(admin, orgId);

    if (org.stripe_subscription_id) {
        if (immediate) {
            await stripe.subscriptions.cancel(org.stripe_subscription_id);
            await admin
                .from("organizations")
                .update({
                    plan_id: "free",
                    subscription_status: "canceled",
                    stripe_subscription_id: null,
                    current_period_end: null,
                    cancel_at_period_end: false,
                })
                .eq("id", orgId);
        } else {
            await stripe.subscriptions.update(org.stripe_subscription_id, {
                cancel_at_period_end: true,
            });
            await admin
                .from("organizations")
                .update({ cancel_at_period_end: true })
                .eq("id", orgId);
        }
    } else {
        // Comped or free — local-only downgrade
        await admin
            .from("organizations")
            .update({
                plan_id: "free",
                subscription_status: "canceled",
                current_period_end: null,
                cancel_at_period_end: false,
            })
            .eq("id", orgId);
    }

    await logAdminAction(user.id, "cancel_subscription", orgId, { immediate });
    revalidatePath(`/admin/orgs/${orgId}`);
}

/**
 * Adjust the seat count.
 * Refuses to drop below current active member count (would lock users out).
 * Refuses to exceed the plan's seat_limit if one is set.
 */
export async function adjustSeats(orgId: string, seats: number) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();
    if (!Number.isInteger(seats) || seats < 1) throw new Error("seats must be a positive integer");

    const org = await getOrgOrThrow(admin, orgId);
    const plan = await getPlanOrThrow(admin, org.plan_id);

    const activeMembers = await getActiveMemberCount(admin, orgId);
    if (seats < activeMembers) {
        throw new Error(
            `Cannot set seats=${seats} below current active members (${activeMembers}). Remove members first.`
        );
    }
    if (plan.seat_limit !== null && plan.seat_limit !== undefined && seats > plan.seat_limit) {
        throw new Error(`Plan '${plan.id}' caps at ${plan.seat_limit} seats.`);
    }

    if (org.stripe_subscription_id) {
        const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
        const itemId = sub.items.data[0]?.id;
        if (itemId) {
            await stripe.subscriptions.update(org.stripe_subscription_id, {
                items: [{ id: itemId, quantity: seats }],
                proration_behavior: "create_prorations",
            });
        }
    }

    await admin.from("organizations").update({ seats_purchased: seats }).eq("id", orgId);
    await logAdminAction(user.id, "adjust_seats", orgId, { seats });
    revalidatePath(`/admin/orgs/${orgId}`);
}

/**
 * Permanently delete an organization and all its data.
 *
 * Safeguards:
 * - Requires the admin to type the exact org name to confirm.
 * - Cancels any active Stripe subscription first to stop billing.
 * - Deletes the org row; ON DELETE CASCADE removes members, tasks, subtasks,
 *   workspaces, comments, attachments, notifications, usage, plan-related rows.
 * - Stripe customer is left intact (orphaned) so historical invoices remain accessible.
 * - User accounts in auth.users are NOT deleted — users may belong to other orgs.
 */
export async function deleteOrganization(orgId: string, confirmName: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const org = await getOrgOrThrow(admin, orgId);

    if (confirmName !== org.name) {
        throw new Error(
            `Confirmation name does not match. Type "${org.name}" exactly to delete.`
        );
    }

    // Cancel Stripe subscription first so we don't keep billing a deleted org
    if (org.stripe_subscription_id) {
        try {
            await stripe.subscriptions.cancel(org.stripe_subscription_id);
        } catch (e) {
            console.warn("[deleteOrganization] failed to cancel Stripe sub", e);
        }
    }

    // Snapshot for the audit log before the row disappears
    const snapshot = {
        name: org.name,
        plan_id: org.plan_id,
        stripe_customer_id: org.stripe_customer_id,
        stripe_subscription_id: org.stripe_subscription_id,
        seats_purchased: org.seats_purchased,
    };

    const { error } = await admin.from("organizations").delete().eq("id", orgId);
    if (error) throw new Error(error.message);

    // Log AFTER delete; target_org_id will be null since the FK cascaded.
    // The action_payload preserves the org id and snapshot for traceability.
    await logAdminAction(user.id, "delete_organization", null, { orgId, ...snapshot });

    revalidatePath("/admin");
    revalidatePath("/admin/orgs");
}

