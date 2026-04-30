import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { hasFeature, getEntitlement } from "@/lib/entitlements";
import crypto from "crypto";

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

    const body = await req.json() as { name?: string; scopes?: string[]; orgId?: string };
    if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (body.orgId !== membership.org_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawKey = `tf_${crypto.randomBytes(32).toString("hex")}`;
    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 10);
    const scopes = (body.scopes ?? ["read"]).filter(s => ["read", "write", "admin"].includes(s));

    const admin = createAdminClient();
    const { data, error } = await admin.from("api_keys").insert({
        org_id: membership.org_id,
        created_by: user.id,
        name: body.name,
        key_hash: hash,
        key_prefix: prefix,
        scopes,
        is_active: true,
    }).select("id, name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ key: rawKey, meta: data }, { status: 201 });
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
        .from("api_keys")
        .update({ is_active: false })
        .eq("id", id)
        .eq("org_id", membership.org_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
