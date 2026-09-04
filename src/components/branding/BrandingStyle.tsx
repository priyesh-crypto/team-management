import { brandingCssVars, type Branding } from "@/lib/branding";

/**
 * Re-declares the brand CSS custom properties on :root for the active tenant.
 *
 * Every brand-colored utility in the app resolves through
 * `var(--color-brand-blue)` (Tailwind v4 `@theme` tokens), so overriding the
 * var here re-skins the whole tree with no rebuild and no per-component props.
 *
 * Renders nothing when the tenant's colors match the platform defaults.
 */
export function BrandingStyle({ branding }: { branding: Branding }) {
    const css = brandingCssVars(branding);
    if (!css) return null;
    // Safe to inline: brandingCssVars emits only var names it owns, and drops
    // any color that isn't a literal hex (isHexColor), so no tenant-supplied
    // text can reach this string and close the <style> tag.
    return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
