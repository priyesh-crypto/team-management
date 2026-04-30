import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import crypto from "crypto";

async function resolveApiKey(req: NextRequest): Promise<{ org_id: string; scopes: string[] } | null> {
    const auth = req.headers.get("authorization") ?? "";
    const key = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!key) return null;

    const hash = crypto.createHash("sha256").update(key).digest("hex");
    const admin = createAdminClient();

    const { data } = await admin
        .from("api_keys")
        .select("org_id, scopes, is_active, expires_at")
        .eq("key_hash", hash)
        .eq("is_active", true)
        .maybeSingle();

    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

    // Update last_used_at (best-effort)
    admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", hash).then(() => {});

    return { org_id: data.org_id, scopes: data.scopes ?? ["read"] };
}

export async function GET(req: NextRequest) {
    const auth = await resolveApiKey(req);
    if (!auth) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const admin = createAdminClient();
    let query = admin
        .from("tasks")
        .select("id, name, status, priority, deadline, start_date, notes, employee_id, created_at")
        .eq("org_id", auth.org_id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
        data: data ?? [],
        meta: { limit, offset, total: count ?? (data?.length ?? 0) },
    });
}

export async function POST(req: NextRequest) {
    const auth = await resolveApiKey(req);
    if (!auth) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
    if (!auth.scopes.includes("write")) return NextResponse.json({ error: "Write scope required" }, { status: 403 });

    const body = await req.json() as {
        name: string;
        priority?: string;
        status?: string;
        deadline?: string;
        start_date?: string;
        notes?: string;
        workspace_id: string;
        employee_id: string;
    };

    if (!body.name || !body.workspace_id || !body.employee_id) {
        return NextResponse.json({ error: "name, workspace_id, and employee_id are required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.from("tasks").insert({
        org_id: auth.org_id,
        workspace_id: body.workspace_id,
        employee_id: body.employee_id,
        name: body.name,
        priority: body.priority ?? "Medium",
        status: body.status ?? "To Do",
        deadline: body.deadline ?? new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        start_date: body.start_date ?? new Date().toISOString().split("T")[0],
        notes: body.notes ?? "",
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
}
