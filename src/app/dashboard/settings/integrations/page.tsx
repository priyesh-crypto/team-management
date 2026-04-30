import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { SlackIntegrationSettings } from "@/components/features/SlackIntegrationSettings";
import { ApiKeysManager } from "./ApiKeysManager";
import { WebhooksManager } from "./WebhooksManager";

export default async function IntegrationsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/");

    const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

    if (!membership || !["manager", "admin", "owner"].includes(membership.role)) {
        redirect("/dashboard");
    }

    const [keysRes, webhooksRes] = await Promise.all([
        supabase.from("api_keys").select("id, name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at").eq("org_id", membership.org_id).eq("is_active", true),
        supabase.from("org_webhooks").select("id, url, events, is_active, failure_count, last_triggered_at, created_at").eq("org_id", membership.org_id).eq("is_active", true),
    ]);

    return (
        <div className="p-8 max-w-3xl space-y-8">
            <div>
                <h1 className="text-2xl font-black text-[#1d1d1f]">Integrations</h1>
                <p className="text-sm text-slate-400 mt-1">Connect your workspace with external tools.</p>
            </div>
            <SlackIntegrationSettings />
            <ApiKeysManager orgId={membership.org_id} keys={keysRes.data ?? []} />
            <WebhooksManager orgId={membership.org_id} webhooks={webhooksRes.data ?? []} />
        </div>
    );
}
