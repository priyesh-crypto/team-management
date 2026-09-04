import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { PLATFORM_BRANDING, resolveBranding, type Branding } from "@/lib/branding";

const BRANDING_COLUMNS =
    "logo_url, favicon_url, primary_color, accent_color, org_display_name, support_email";

/**
 * Branding for an org the current user is a member of.
 *
 * Uses the request-scoped (RLS-enforcing) client, so a user can only ever read
 * their own org's branding. Falls back to platform branding if the org has no
 * row, or if the `org_branding` migration hasn't been applied yet — branding is
 * cosmetic and must never take the dashboard down.
 */
export async function getOrgBranding(orgId: string): Promise<Branding> {
    try {
        const supabase = await createClient();
        const { data } = await supabase
            .from("org_branding")
            .select(BRANDING_COLUMNS)
            .eq("org_id", orgId)
            .maybeSingle();
        return resolveBranding(data);
    } catch {
        return PLATFORM_BRANDING;
    }
}

/**
 * Branding for the login / signup pages, which render BEFORE authentication —
 * there is no session and therefore no org to key off. We resolve a tenant from
 * the request itself, in this order:
 *
 *   1. `?org=<slug>`     — explicit, and what a demo link uses
 *   2. custom domain     — `org_branding.custom_domain` matching the Host header
 *
 * No match returns platform branding. This needs the service-role client
 * because `org_branding`'s RLS policy requires org membership, which an
 * anonymous visitor does not have.
 *
 * `slug` is matched against `custom_domain` and against a dash-normalized
 * `org_display_name`, so `?org=acme-sports` finds "Acme Sports".
 */
export async function getPreAuthBranding(opts: {
    slug?: string | null;
    host?: string | null;
}): Promise<Branding> {
    const slug = opts.slug?.trim().toLowerCase();
    const host = opts.host?.trim().toLowerCase().replace(/:\d+$/, "");

    if (!slug && !host) return PLATFORM_BRANDING;

    try {
        const admin = createAdminClient();

        if (slug) {
            // Exact custom-domain match first — unambiguous.
            const { data: byDomain } = await admin
                .from("org_branding")
                .select(BRANDING_COLUMNS)
                .ilike("custom_domain", slug)
                .maybeSingle();
            if (byDomain) return resolveBranding(byDomain);

            // Then a slugified display-name match. Compared in JS rather than
            // SQL so "Acme Sports" -> "acme-sports" without a generated column.
            const { data: rows } = await admin
                .from("org_branding")
                .select(BRANDING_COLUMNS)
                .not("org_display_name", "is", null)
                .limit(500);
            const hit = rows?.find(
                (r) => slugify(r.org_display_name ?? "") === slug
            );
            if (hit) return resolveBranding(hit);
        }

        if (host && !isPlatformHost(host)) {
            const { data: byHost } = await admin
                .from("org_branding")
                .select(BRANDING_COLUMNS)
                .ilike("custom_domain", host)
                .maybeSingle();
            if (byHost) return resolveBranding(byHost);
        }
    } catch {
        // Unapplied migration, missing service key, or a network blip — the
        // auth pages must still render.
        return PLATFORM_BRANDING;
    }

    return PLATFORM_BRANDING;
}

function slugify(s: string): string {
    return s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/** Hosts that are us, not a tenant — never worth a lookup. */
function isPlatformHost(host: string): boolean {
    return (
        host === "localhost" ||
        host.startsWith("127.") ||
        host.endsWith(".vercel.app") ||
        host.endsWith("knotless.ai")
    );
}
