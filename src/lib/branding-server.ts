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
    } catch (err) {
        // Unapplied migration, missing SUPABASE_SERVICE_ROLE_KEY, or a network
        // blip. The auth pages must still render, so this degrades to platform
        // branding — but it is logged, because a silent fallback here is
        // indistinguishable from "the org has no branding configured" and is
        // otherwise very hard to diagnose in a deployed environment.
        console.error(
            "[branding] pre-auth lookup failed; falling back to platform branding.",
            "Is SUPABASE_SERVICE_ROLE_KEY set in this environment?",
            err instanceof Error ? err.message : err
        );
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

/**
 * Hosts that are unambiguously us, not a tenant — not worth a lookup.
 *
 * Kept deliberately narrow. An earlier version excluded all of `.vercel.app`,
 * which silently broke the main reason to use custom_domain at all: putting a
 * client on a `<name>.vercel.app` subdomain before they have a real domain.
 * A tenant may legitimately own any hostname, so anything not listed here gets
 * looked up — a single indexed query on a page that already hits the database.
 *
 * The canonical platform host is taken from NEXT_PUBLIC_APP_URL so this doesn't
 * need editing per deployment.
 */
function isPlatformHost(host: string): boolean {
    if (host === "localhost" || host.startsWith("127.") || host === "[::1]") {
        return true;
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
        try {
            if (new URL(appUrl).hostname.toLowerCase() === host) return true;
        } catch {
            // Malformed NEXT_PUBLIC_APP_URL — fall through and just do the lookup.
        }
    }
    return false;
}
