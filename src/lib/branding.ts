/**
 * Branding resolution.
 *
 * Two layers, in precedence order:
 *
 *   1. `org_branding` row for the active org  (per-tenant white-label)
 *   2. PLATFORM_BRANDING below                (our own product identity)
 *
 * Layer 2 is what login/signup show when there is no org context yet, and what
 * fills any field a tenant left blank. Layer 1 is applied at runtime by
 * <BrandingStyle> re-declaring the `--color-brand-*` CSS vars on :root, which
 * is why every brand-colored class in the app must be written as a token
 * utility (`bg-brand-blue`) rather than a hex literal (`bg-[#0051e6]`).
 */

export type Branding = {
    /** Product/company name shown in headings, titles and emails. */
    name: string;
    /** Logo shown on auth pages and in the dashboard sidebar. */
    logoUrl: string;
    /** Browser tab icon. */
    faviconUrl: string;
    /** Primary brand color — buttons, links, active states. */
    primaryColor: string;
    /** Secondary brand color — the second stop of the brand gradient. */
    accentColor: string;
    /** Where "Contact support" points. */
    supportEmail: string;
    /** Sub-headline on the login card. */
    tagline: string;
};

/** Our own product identity. Overridable per deploy via env. */
export const PLATFORM_BRANDING: Branding = {
    name: process.env.NEXT_PUBLIC_BRAND_NAME || "Knotless AI",
    logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO || "/knotlessai.svg",
    faviconUrl: process.env.NEXT_PUBLIC_BRAND_FAVICON || "/favicon.svg",
    primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY || "#0051e6",
    accentColor: process.env.NEXT_PUBLIC_BRAND_ACCENT || "#22be66",
    supportEmail: process.env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL || "support@knotless.ai",
    tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || "Sign in to your workspace",
};

/** The shape `org_branding` rows come back in (see src/app/actions/branding.ts). */
type OrgBrandingRow = {
    logo_url: string | null;
    favicon_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    org_display_name: string | null;
    support_email: string | null;
};

/**
 * Overlay a tenant's `org_branding` row onto the platform defaults.
 * Blank strings are treated as unset — the branding form submits "" for
 * cleared fields, and "" is not a usable color or logo.
 */
export function resolveBranding(row: OrgBrandingRow | null | undefined): Branding {
    if (!row) return PLATFORM_BRANDING;
    const pick = (v: string | null | undefined, fallback: string) => {
        const trimmed = v?.trim();
        return trimmed ? trimmed : fallback;
    };
    return {
        name: pick(row.org_display_name, PLATFORM_BRANDING.name),
        logoUrl: pick(row.logo_url, PLATFORM_BRANDING.logoUrl),
        faviconUrl: pick(row.favicon_url, PLATFORM_BRANDING.faviconUrl),
        primaryColor: pick(row.primary_color, PLATFORM_BRANDING.primaryColor),
        accentColor: pick(row.accent_color, PLATFORM_BRANDING.accentColor),
        supportEmail: pick(row.support_email, PLATFORM_BRANDING.supportEmail),
        tagline: PLATFORM_BRANDING.tagline,
    };
}

/**
 * #RRGGBB -> "r g b" for use inside rgb(). Returns null for a non-hex input.
 *
 * The channels are emitted split because that's what lets Tailwind apply
 * opacity modifiers to a runtime-overridable color — see the long comment in
 * globals.css.
 */
function hexToChannels(hex: string): string | null {
    const rgb = parseHex(hex);
    return rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : null;
}

/** #RGB / #RRGGBB -> {r,g,b}. Returns null for anything else. */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}

/**
 * Darken a hex color toward black by `amount` (0..1).
 * Used for the `-dark` hover shade so a tenant only has to supply one color.
 */
export function darken(hex: string, amount = 0.18): string {
    const rgb = parseHex(hex);
    if (!rgb) return hex;
    const f = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
    return `#${[f(rgb.r), f(rgb.g), f(rgb.b)]
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")}`;
}

/**
 * Relative luminance per WCAG. Used to decide whether text sitting on the
 * brand color should be white or near-black — a gold accent (#FCB51E) needs
 * dark text, a purple primary needs white.
 */
export function readableTextOn(hex: string): string {
    const rgb = parseHex(hex);
    if (!rgb) return "#ffffff";
    const chan = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const L = 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
    return L > 0.45 ? "#1d1d1f" : "#ffffff";
}

/**
 * True only for a literal `#RGB`/`#RRGGBB` string.
 *
 * `primary_color` / `accent_color` are plain TEXT columns fed by an org-admin
 * form, and their values get inlined into a <style> block. A value containing
 * `</style>` would break out of the tag into script context, so nothing that
 * isn't provably a hex color is allowed anywhere near that output.
 */
export function isHexColor(value: string | null | undefined): boolean {
    return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

/**
 * The CSS custom properties that re-skin the app for one tenant.
 *
 * Only emits vars that actually differ from the compiled defaults, so the
 * common (unbranded) case injects nothing. Non-hex colors are dropped rather
 * than escaped — see isHexColor.
 */
export function brandingCssVars(b: Branding): string {
    const decls: string[] = [];
    const safePrimary = isHexColor(b.primaryColor);
    const safeAccent = isHexColor(b.accentColor);

    // Only the channel vars from globals.css are written. The `--color-brand-*`
    // theme tokens read through these, so overriding them re-skins solid
    // colors, opacity variants and gradients in one go.
    if (safePrimary && b.primaryColor !== PLATFORM_BRANDING.primaryColor) {
        const primary = hexToChannels(b.primaryColor);
        const dark = hexToChannels(darken(b.primaryColor));
        const deep = hexToChannels(darken(b.primaryColor, 0.28));
        if (primary) decls.push(`--brand-primary-rgb:${primary}`);
        if (dark) decls.push(`--brand-primary-dark-rgb:${dark}`);
        if (deep) decls.push(`--brand-primary-deep-rgb:${deep}`);
        decls.push(`--color-on-brand:${readableTextOn(b.primaryColor)}`);
    }
    if (safeAccent && b.accentColor !== PLATFORM_BRANDING.accentColor) {
        const accent = hexToChannels(b.accentColor);
        if (accent) decls.push(`--brand-accent-rgb:${accent}`);
    }
    return decls.length ? `:root{${decls.join(";")}}` : "";
}
