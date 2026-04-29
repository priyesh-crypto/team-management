import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { stripe, APP_URL } from "@/lib/stripe";

export async function POST(req: NextRequest) {
    try {
        const { orgId, planId, seats } = await req.json();

        // Country resolution is server-authoritative — clients cannot spoof their region
        // for cheaper pricing. Geo header > org's saved billing_country > DEFAULT.
        const headerCountry =
            req.headers.get("x-vercel-ip-country") ??
            req.headers.get("cf-ipcountry") ??
            null;

        if (!orgId || !planId) {
            return NextResponse.json({ error: "orgId and planId required" }, { status: 400 });
        }

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Verify caller is owner/admin of org
        const { data: membership } = await supabase
            .from("organization_members")
            .select("role")
            .eq("org_id", orgId)
            .eq("user_id", user.id)
            .single();

        if (!membership || !["owner", "admin"].includes(membership.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { data: org } = await supabase
            .from("organizations")
            .select("id, name, billing_country, stripe_customer_id, stripe_subscription_id, subscription_status")
            .eq("id", orgId)
            .single();

        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        // Refuse if there's already an active or trialing subscription —
        // they should use the Customer Portal to switch plans instead.
        if (
            org.stripe_subscription_id &&
            ["active", "trialing", "past_due"].includes(org.subscription_status ?? "")
        ) {
            return NextResponse.json(
                {
                    error:
                        "An active subscription already exists. Use the billing portal to change plans.",
                },
                { status: 409 }
            );
        }

        const country = (headerCountry || org.billing_country || "DEFAULT")
            .toString()
            .toUpperCase();

        const { data: priceRowRaw } = await supabase
            .rpc("resolve_plan_price", { target_plan: planId, target_country: country })
            .maybeSingle();
        const priceRow = priceRowRaw as
            | { stripe_price_id: string | null; currency: string; price_monthly_cents: number }
            | null;

        if (!priceRow?.stripe_price_id) {
            return NextResponse.json(
                { error: "No purchasable price configured for this plan/region" },
                { status: 400 }
            );
        }

        // Reuse or create Stripe customer
        let customerId = org.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: org.name,
                metadata: { org_id: orgId },
            });
            customerId = customer.id;
            await supabase
                .from("organizations")
                .update({ stripe_customer_id: customerId, billing_country: country })
                .eq("id", orgId);
        } else if (country !== "DEFAULT" && country !== org.billing_country) {
            await supabase
                .from("organizations")
                .update({ billing_country: country })
                .eq("id", orgId);
        }

        const requestedSeats = Math.max(1, Number(seats) || 1);

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [
                {
                    price: priceRow.stripe_price_id,
                    quantity: requestedSeats,
                },
            ],
            subscription_data: {
                trial_period_days: 14,
                metadata: { org_id: orgId, plan_id: planId, country, currency: priceRow.currency },
            },
            metadata: { org_id: orgId, plan_id: planId, country, currency: priceRow.currency },
            success_url: `${APP_URL}/dashboard/settings/billing?status=success`,
            cancel_url: `${APP_URL}/dashboard/settings/billing?status=canceled`,
            allow_promotion_codes: true,
        });

        return NextResponse.json({ url: session.url });
    } catch (err) {
        console.error("[stripe/checkout]", err);
        const message = err instanceof Error ? err.message : "Checkout failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
