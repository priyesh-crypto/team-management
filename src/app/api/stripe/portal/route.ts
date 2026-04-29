import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { stripe, APP_URL } from "@/lib/stripe";

export async function POST(req: NextRequest) {
    try {
        const { orgId } = await req.json();
        if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
            .select("stripe_customer_id")
            .eq("id", orgId)
            .single();

        if (!org?.stripe_customer_id) {
            return NextResponse.json({ error: "No active subscription" }, { status: 400 });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: org.stripe_customer_id,
            return_url: `${APP_URL}/dashboard/settings/billing`,
        });

        return NextResponse.json({ url: session.url });
    } catch (err) {
        console.error("[stripe/portal]", err);
        return NextResponse.json({ error: "Portal session failed" }, { status: 500 });
    }
}
