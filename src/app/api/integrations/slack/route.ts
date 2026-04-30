import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getEntitlement, hasFeature } from "@/lib/entitlements";

/** POST: Save/update Slack webhook URL for the org */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

        const { data: membership } = await supabase
            .from("organization_members")
            .select("org_id, role")
            .eq("user_id", user.id)
            .single();
        if (!membership || !["manager", "admin", "owner"].includes(membership.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const entitlement = await getEntitlement(membership.org_id);
        if (!entitlement || !hasFeature(entitlement, "slack_integration")) {
            return NextResponse.json({ error: "Feature not available on your plan" }, { status: 403 });
        }

        const { webhookUrl, channelName, events } = await req.json() as {
            webhookUrl: string;
            channelName?: string;
            events?: string[];
        };

        if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) {
            return NextResponse.json({ error: "Invalid Slack webhook URL" }, { status: 400 });
        }

        const admin = createAdminClient();
        const { error } = await admin.from("org_integrations").upsert({
            org_id: membership.org_id,
            provider: "slack",
            config: {
                webhook_url: webhookUrl,
                channel_name: channelName ?? "#general",
                events: events ?? ["task.created", "task.completed", "task.overdue"],
            },
            is_active: true,
            connected_by: user.id,
            updated_at: new Date().toISOString(),
        }, { onConflict: "org_id,provider" });

        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}

/** GET: Fetch current Slack integration config */
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

        const { data: membership } = await supabase
            .from("organization_members")
            .select("org_id")
            .eq("user_id", user.id)
            .single();
        if (!membership) return NextResponse.json({ integration: null });

        const { data } = await supabase
            .from("org_integrations")
            .select("id, provider, config, is_active, connected_at")
            .eq("org_id", membership.org_id)
            .eq("provider", "slack")
            .maybeSingle();

        return NextResponse.json({ integration: data ?? null });
    } catch {
        return NextResponse.json({ integration: null });
    }
}

/** DELETE: Disconnect Slack */
export async function DELETE() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

        const { data: membership } = await supabase
            .from("organization_members")
            .select("org_id, role")
            .eq("user_id", user.id)
            .single();
        if (!membership || !["manager", "admin", "owner"].includes(membership.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const admin = createAdminClient();
        await admin.from("org_integrations")
            .update({ is_active: false })
            .eq("org_id", membership.org_id)
            .eq("provider", "slack");

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
