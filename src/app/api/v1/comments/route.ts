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
    admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", hash).then(() => {});
    return { org_id: data.org_id, scopes: data.scopes ?? ["read"] };
}

export async function GET(req: NextRequest) {
    const auth = await resolveApiKey(req);
    if (!auth) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("task_id");
    if (!taskId) return NextResponse.json({ error: "task_id is required" }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin
        .from("task_comments")
        .select("id, task_id, user_id, content, mentions, edited_at, created_at")
        .eq("task_id", taskId)
        .eq("org_id", auth.org_id)
        .order("created_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
    const auth = await resolveApiKey(req);
    if (!auth) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
    if (!auth.scopes.includes("write")) return NextResponse.json({ error: "Write scope required" }, { status: 403 });

    const body = await req.json() as { task_id?: string; content?: string; user_id?: string };
    if (!body.task_id || !body.content) {
        return NextResponse.json({ error: "task_id and content are required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
        .from("task_comments")
        .insert({
            task_id: body.task_id,
            org_id: auth.org_id,
            user_id: body.user_id ?? "00000000-0000-0000-0000-000000000000",
            content: body.content,
            mentions: [],
        })
        .select("id, task_id, user_id, content, mentions, edited_at, created_at")
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
}
