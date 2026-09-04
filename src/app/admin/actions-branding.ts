"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requirePlatformAdmin, logAdminAction } from "@/lib/platform-admin";
import { isHexColor } from "@/lib/branding";
import { revalidatePath } from "next/cache";

/**
 * Owner-portal branding management.
 *
 * These differ from the tenant-facing actions in src/app/actions/branding.ts in
 * two ways: they require platform admin (not org membership), and they operate
 * on an org the caller does not belong to. Every one of them is audit-logged.
 */

const BUCKET = "org-branding";

/** Mirrors the bucket's allowed_mime_types. SVG is excluded on purpose. */
const ALLOWED_MIME = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/x-icon",
    "image/vnd.microsoft.icon",
] as const;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB, matches the bucket limit

const EXT_BY_MIME: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
};

export type AdminBranding = {
    logo_url: string | null;
    favicon_url: string | null;
    primary_color: string;
    accent_color: string;
    org_display_name: string | null;
    custom_domain: string | null;
    support_email: string | null;
};

/** Read one org's branding row, bypassing the member-only RLS policy. */
export async function getOrgBrandingAsAdmin(orgId: string): Promise<AdminBranding | null> {
    await requirePlatformAdmin();
    const admin = createAdminClient();
    const { data } = await admin
        .from("org_branding")
        .select(
            "logo_url, favicon_url, primary_color, accent_color, org_display_name, custom_domain, support_email"
        )
        .eq("org_id", orgId)
        .maybeSingle();
    return (data as AdminBranding) ?? null;
}

/**
 * Upload a logo or favicon for `orgId` and record the public URL on its
 * branding row.
 *
 * The file is validated here rather than trusting the client: `formData` comes
 * straight off the wire, and the bucket's own limits would otherwise be the
 * only check.
 */
export async function uploadOrgBrandingAsset(
    orgId: string,
    formData: FormData
): Promise<{ url: string }> {
    const user = await requirePlatformAdmin();

    const kind = formData.get("kind");
    if (kind !== "logo" && kind !== "favicon") {
        throw new Error("kind must be 'logo' or 'favicon'");
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
        throw new Error("No file provided");
    }
    if (file.size > MAX_BYTES) {
        throw new Error(
            `Image is ${(file.size / 1048576).toFixed(1)} MB — the limit is 2 MB.`
        );
    }
    if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
        throw new Error(
            `${file.type || "That file type"} isn't allowed. Use PNG, JPEG, WebP or ICO — not SVG, which can carry scripts.`
        );
    }

    const admin = createAdminClient();

    // Confirm the org exists before writing anything named after it, so a typo'd
    // id can't leave an orphaned object in the bucket.
    const { data: org } = await admin
        .from("organizations")
        .select("id, name")
        .eq("id", orgId)
        .single();
    if (!org) throw new Error("Organization not found");

    // Timestamped filename: object storage is CDN-cached, and reusing a path
    // would serve the previous logo until the edge expired it.
    const ext = EXT_BY_MIME[file.type] ?? "png";
    const path = `${orgId}/${kind}-${Date.now()}.${ext}`;

    const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const {
        data: { publicUrl },
    } = admin.storage.from(BUCKET).getPublicUrl(path);

    const column = kind === "logo" ? "logo_url" : "favicon_url";
    const { error: saveError } = await admin.from("org_branding").upsert(
        {
            org_id: orgId,
            [column]: publicUrl,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id" }
    );
    if (saveError) {
        // Don't leave a file behind that nothing references.
        await admin.storage.from(BUCKET).remove([path]);
        throw new Error(`Saved the file but couldn't record it: ${saveError.message}`);
    }

    await logAdminAction(user.id, `upload_org_${kind}`, orgId, {
        path,
        bytes: file.size,
        mime: file.type,
    });

    revalidatePath(`/admin/orgs/${orgId}`);
    revalidatePath("/dashboard");
    return { url: publicUrl };
}

/** Save the non-file branding fields (name, colors, domain, support email). */
export async function saveOrgBrandingAsAdmin(
    orgId: string,
    input: {
        org_display_name?: string | null;
        primary_color?: string | null;
        accent_color?: string | null;
        custom_domain?: string | null;
        support_email?: string | null;
        logo_url?: string | null;
        favicon_url?: string | null;
    }
) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    // Colors are inlined into a <style> tag by BrandingStyle. It drops
    // non-hex values defensively, but rejecting them at the door gives the
    // admin an actual error message instead of a silently ignored setting.
    for (const key of ["primary_color", "accent_color"] as const) {
        const value = input[key];
        if (value != null && value !== "" && !isHexColor(value)) {
            throw new Error(`${key.replace("_", " ")} must be a hex color like #6939B5`);
        }
    }

    const clean = (v: string | null | undefined) => {
        const t = v?.trim();
        return t ? t : null;
    };

    // A bare hostname — no scheme, no path. Matched against the Host header.
    const domain = clean(input.custom_domain)?.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") ?? null;

    const { error } = await admin.from("org_branding").upsert(
        {
            org_id: orgId,
            org_display_name: clean(input.org_display_name),
            primary_color: clean(input.primary_color) ?? "#0051e6",
            accent_color: clean(input.accent_color) ?? "#22be66",
            custom_domain: domain,
            support_email: clean(input.support_email),
            ...(input.logo_url !== undefined ? { logo_url: clean(input.logo_url) } : {}),
            ...(input.favicon_url !== undefined ? { favicon_url: clean(input.favicon_url) } : {}),
            updated_by: user.id,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id" }
    );
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "update_org_branding", orgId, {
        fields: Object.keys(input),
    });

    revalidatePath(`/admin/orgs/${orgId}`);
    revalidatePath("/dashboard");
}

/** Clear a logo or favicon, removing the stored file too. */
export async function clearOrgBrandingAsset(orgId: string, kind: "logo" | "favicon") {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const column = kind === "logo" ? "logo_url" : "favicon_url";
    const { data: row } = await admin
        .from("org_branding")
        .select(column)
        .eq("org_id", orgId)
        .maybeSingle();

    const currentUrl = (row as Record<string, string | null> | null)?.[column] ?? null;

    const { error } = await admin
        .from("org_branding")
        .update({ [column]: null, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq("org_id", orgId);
    if (error) throw new Error(error.message);

    // Only delete files we own. A manually-entered external URL is left alone.
    const marker = `/${BUCKET}/`;
    if (currentUrl?.includes(marker)) {
        const path = currentUrl.split(marker)[1]?.split("?")[0];
        if (path) await admin.storage.from(BUCKET).remove([decodeURIComponent(path)]);
    }

    await logAdminAction(user.id, `clear_org_${kind}`, orgId, {});
    revalidatePath(`/admin/orgs/${orgId}`);
    revalidatePath("/dashboard");
}
