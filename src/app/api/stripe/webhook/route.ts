import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";
import { tsFromUnix } from "@/lib/billing-utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const sig = req.headers.get("stripe-signature");
    if (!sig || !STRIPE_WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const body = await req.text();
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error("[stripe/webhook] signature verification failed", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Idempotency: skip if we've already processed this event
    const { data: existing } = await admin
        .from("stripe_events")
        .select("id")
        .eq("id", event.id)
        .maybeSingle();
    if (existing) return NextResponse.json({ received: true, duplicate: true });

    let orgId: string | null = null;

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                orgId = (session.metadata?.org_id as string) ?? null;
                if (orgId && session.subscription) {
                    const sub = await stripe.subscriptions.retrieve(session.subscription as string);
                    await syncSubscription(admin, orgId, sub);
                }
                break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.trial_will_end": {
                const sub = event.data.object as Stripe.Subscription;
                orgId = (sub.metadata?.org_id as string) ?? (await orgFromCustomer(admin, sub.customer as string));
                if (orgId) await syncSubscription(admin, orgId, sub);
                break;
            }
            case "customer.subscription.deleted": {
                const sub = event.data.object as Stripe.Subscription;
                orgId = (sub.metadata?.org_id as string) ?? (await orgFromCustomer(admin, sub.customer as string));
                if (orgId) {
                    await admin
                        .from("organizations")
                        .update({
                            subscription_status: "canceled",
                            plan_id: "free",
                            stripe_subscription_id: null,
                            cancel_at_period_end: false,
                        })
                        .eq("id", orgId);
                }
                break;
            }
            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice;
                orgId = await orgFromCustomer(admin, invoice.customer as string);
                if (orgId) {
                    await admin
                        .from("organizations")
                        .update({ subscription_status: "past_due" })
                        .eq("id", orgId);
                }
                break;
            }
            default:
                // Unhandled event type — still log for idempotency
                break;
        }

        await admin.from("stripe_events").insert({
            id: event.id,
            type: event.type,
            org_id: orgId,
            payload: event as unknown as Record<string, unknown>,
        });

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error("[stripe/webhook] handler error", event.type, err);
        return NextResponse.json({ error: "Handler error" }, { status: 500 });
    }
}

async function orgFromCustomer(
    admin: ReturnType<typeof createAdminClient>,
    customerId: string
): Promise<string | null> {
    const { data } = await admin
        .from("organizations")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
    return data?.id ?? null;
}

async function syncSubscription(
    admin: ReturnType<typeof createAdminClient>,
    orgId: string,
    sub: Stripe.Subscription
) {
    const planId = (sub.metadata?.plan_id as string) ?? (await planFromPrice(admin, sub.items.data[0]?.price.id));
    const seats = sub.items.data[0]?.quantity ?? 1;

    // In recent Stripe API versions, current_period_end lives on the subscription item.
    const periodEnd =
        (sub as unknown as { current_period_end?: number }).current_period_end ??
        sub.items.data[0]?.current_period_end ??
        null;

    await admin
        .from("organizations")
        .update({
            plan_id: planId ?? "free",
            stripe_subscription_id: sub.id,
            subscription_status: sub.status,
            trial_ends_at: tsFromUnix(sub.trial_end),
            current_period_end: tsFromUnix(periodEnd),
            seats_purchased: seats,
            cancel_at_period_end: sub.cancel_at_period_end,
        })
        .eq("id", orgId);
}

async function planFromPrice(
    admin: ReturnType<typeof createAdminClient>,
    priceId: string | undefined
): Promise<string | null> {
    if (!priceId) return null;
    // Try regional prices first, then fall back to base plan price column
    const { data: regional } = await admin
        .from("plan_prices")
        .select("plan_id")
        .eq("stripe_price_id", priceId)
        .maybeSingle();
    if (regional?.plan_id) return regional.plan_id;

    const { data } = await admin
        .from("plans")
        .select("id")
        .eq("stripe_price_id", priceId)
        .maybeSingle();
    return data?.id ?? null;
}
