import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { hasFeature, getEntitlement } from "@/lib/entitlements";

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", user.id)
        .single();

    if (!membership || !["admin", "owner"].includes(membership.role)) {
        return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    const entitlement = await getEntitlement(membership.org_id);
    if (!entitlement || !hasFeature(entitlement, "webhooks_api")) {
        return NextResponse.json({ error: "Feature not available on your plan" }, { status: 403 });
    }

    const body = await req.json() as { url?: string; events?: string[]; orgId?: string };
    if (!body.url || !body.events?.length) {
        return NextResponse.json({ error: "url and events are required" }, { status: 400 });
    }
    if (body.orgId !== membership.org_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.from("org_webhooks").insert({
        org_id: membership.org_id,
        url: body.url,
        events: body.events,
        is_active: true,
        failure_count: 0,
    }).select("id, url, events, is_active, failure_count, last_triggered_at, created_at").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", user.id)
        .single();

    if (!membership || !["admin", "owner"].includes(membership.role)) {
        return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin
        .from("org_webhooks")
        .update({ is_active: false })
        .eq("id", id)
        .eq("org_id", membership.org_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
