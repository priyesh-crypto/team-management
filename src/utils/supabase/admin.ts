import { createClient } from "@supabase/supabase-js";

// Service-role client. NEVER import from client components or expose to the browser.
// Used by Stripe webhooks and other server-only flows that must bypass RLS.
export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
        );
    }

    return createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
