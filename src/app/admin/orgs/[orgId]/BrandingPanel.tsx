"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Trash2, Palette, ExternalLink } from "lucide-react";
import {
    uploadOrgBrandingAsset,
    saveOrgBrandingAsAdmin,
    clearOrgBrandingAsset,
    type AdminBranding,
} from "../../actions-branding";
import { Card, SectionLabel, Button, Input, Field } from "../../_components/ui";

const DEFAULT_PRIMARY = "#0051e6";
const DEFAULT_ACCENT = "#22be66";

/** Same set the bucket and the server action accept. SVG excluded (scriptable). */
const ACCEPT = "image/png,image/jpeg,image/webp,image/x-icon";

/**
 * Branding for one client org, edited by us on their behalf.
 *
 * The tenant-facing equivalent (Settings -> Branding) is gated behind the
 * `white_labeling` Business feature and only takes image URLs. This panel has
 * no gate — we're the platform owner — and uploads files directly.
 */
export function BrandingPanel({
    orgId,
    orgName,
    branding,
}: {
    orgId: string;
    orgName: string;
    branding: AdminBranding | null;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);

    const logoInput = useRef<HTMLInputElement>(null);
    const faviconInput = useRef<HTMLInputElement>(null);

    const [displayName, setDisplayName] = useState(branding?.org_display_name ?? "");
    const [primary, setPrimary] = useState(branding?.primary_color ?? DEFAULT_PRIMARY);
    const [accent, setAccent] = useState(branding?.accent_color ?? DEFAULT_ACCENT);
    const [domain, setDomain] = useState(branding?.custom_domain ?? "");
    const [supportEmail, setSupportEmail] = useState(branding?.support_email ?? "");

    const logoUrl = branding?.logo_url ?? null;
    const faviconUrl = branding?.favicon_url ?? null;

    const upload = (kind: "logo" | "favicon", file: File) => {
        setUploading(kind);
        startTransition(async () => {
            try {
                const fd = new FormData();
                fd.set("kind", kind);
                fd.set("file", file);
                await uploadOrgBrandingAsset(orgId, fd);
                toast.success(`${kind === "logo" ? "Logo" : "Favicon"} uploaded`);
                router.refresh();
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "Upload failed");
            } finally {
                setUploading(null);
            }
        });
    };

    const save = () =>
        startTransition(async () => {
            try {
                await saveOrgBrandingAsAdmin(orgId, {
                    org_display_name: displayName,
                    primary_color: primary,
                    accent_color: accent,
                    custom_domain: domain,
                    support_email: supportEmail,
                });
                toast.success("Branding saved");
                router.refresh();
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "Save failed");
            }
        });

    const clear = (kind: "logo" | "favicon") =>
        startTransition(async () => {
            try {
                await clearOrgBrandingAsset(orgId, kind);
                toast.success(`${kind === "logo" ? "Logo" : "Favicon"} removed`);
                router.refresh();
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to remove");
            }
        });

    const loginPreviewUrl = `/?org=${encodeURIComponent(
        slugify(displayName || orgName)
    )}`;

    return (
        <Card>
            <div className="flex items-center justify-between">
                <SectionLabel>Branding</SectionLabel>
                <a
                    href={loginPreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6b6b73] hover:text-brand-blue transition-colors"
                >
                    Preview login page
                    <ExternalLink size={11} strokeWidth={2} />
                </a>
            </div>

            <div className="grid grid-cols-2 gap-5">
                {/* ── Assets ─────────────────────────────────────────── */}
                <div className="space-y-4">
                    <AssetRow
                        label="Logo"
                        hint="PNG, JPEG or WebP up to 2 MB. Shown on the login page and in the sidebar."
                        url={logoUrl}
                        previewClass="h-12 max-w-[180px]"
                        busy={uploading === "logo"}
                        disabled={isPending}
                        inputRef={logoInput}
                        onPick={(f) => upload("logo", f)}
                        onClear={() => clear("logo")}
                    />
                    <AssetRow
                        label="Favicon"
                        hint="PNG or ICO, square. Shown in the browser tab."
                        url={faviconUrl}
                        previewClass="h-8 w-8"
                        busy={uploading === "favicon"}
                        disabled={isPending}
                        inputRef={faviconInput}
                        onPick={(f) => upload("favicon", f)}
                        onClear={() => clear("favicon")}
                    />
                </div>

                {/* ── Identity + colors ──────────────────────────────── */}
                <div className="space-y-3">
                    <Field
                        label="Display name"
                        hint={`Replaces the product name for this org. Blank = "${orgName}".`}
                    >
                        <Input
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder={orgName}
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-2">
                        <ColorField label="Primary" value={primary} onChange={setPrimary} />
                        <ColorField label="Accent" value={accent} onChange={setAccent} />
                    </div>

                    <Field label="Custom domain" hint="Bare hostname. Brands the login page when visited on it.">
                        <Input
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            placeholder="tasks.client.com"
                        />
                    </Field>

                    <Field label="Support email" hint="Where their 'Contact support' links point.">
                        <Input
                            type="email"
                            value={supportEmail}
                            onChange={(e) => setSupportEmail(e.target.value)}
                            placeholder="support@client.com"
                        />
                    </Field>
                </div>
            </div>

            {/* ── Live preview ───────────────────────────────────────── */}
            <div className="mt-5 pt-4 border-t border-[#f0f0f2]">
                <div className="text-[11px] font-medium text-[#6b6b73] mb-2">Preview</div>
                <div className="rounded-lg border border-[#e5e5ea] p-4 flex items-center gap-4 flex-wrap">
                    {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="" className="h-9 max-w-[150px] object-contain" />
                    ) : (
                        <div className="flex items-center gap-2 text-[#6b6b73]">
                            <Palette size={16} strokeWidth={2} />
                            <span className="text-sm">No logo</span>
                        </div>
                    )}
                    <span className="text-sm font-semibold text-[#1d1d1f]">
                        {displayName || orgName}
                    </span>
                    <button
                        type="button"
                        className="px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm"
                        style={{
                            background: `linear-gradient(135deg, ${safeColor(primary, DEFAULT_PRIMARY)} 0%, ${safeColor(accent, DEFAULT_ACCENT)} 100%)`,
                        }}
                    >
                        Sign In
                    </button>
                    <span
                        className="text-xs font-bold"
                        style={{ color: safeColor(primary, DEFAULT_PRIMARY) }}
                    >
                        Forgot password?
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
                <Button disabled={isPending} onClick={save}>
                    {isPending ? "Saving…" : "Save branding"}
                </Button>
                <Button
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => {
                        setPrimary(DEFAULT_PRIMARY);
                        setAccent(DEFAULT_ACCENT);
                    }}
                >
                    Reset colors
                </Button>
                <p className="text-[11px] text-[#6b6b73] ml-1">
                    Applies to their dashboard immediately, and to the login page via
                    <code className="mx-1 px-1 rounded bg-[#f5f5f7]">?org=</code>
                    or custom domain.
                </p>
            </div>
        </Card>
    );
}

function AssetRow({
    label,
    hint,
    url,
    previewClass,
    busy,
    disabled,
    inputRef,
    onPick,
    onClear,
}: {
    label: string;
    hint: string;
    url: string | null;
    previewClass: string;
    busy: boolean;
    disabled: boolean;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onPick: (file: File) => void;
    onClear: () => void;
}) {
    return (
        <div>
            <div className="text-xs font-medium text-[#1d1d1f] mb-1.5">{label}</div>
            <div className="flex items-center gap-3">
                <div className="w-[200px] h-16 rounded-lg border border-[#e5e5ea] bg-[#fafafa] flex items-center justify-center overflow-hidden shrink-0">
                    {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className={`${previewClass} object-contain`} />
                    ) : (
                        <span className="text-[11px] text-[#6b6b73]">None</span>
                    )}
                </div>
                <div className="flex flex-col gap-1.5">
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            // Reset so re-picking the same file fires onChange again.
                            e.target.value = "";
                            if (f) onPick(f);
                        }}
                    />
                    <Button
                        variant="secondary"
                        disabled={disabled}
                        onClick={() => inputRef.current?.click()}
                    >
                        <span className="inline-flex items-center gap-1.5">
                            <Upload size={12} strokeWidth={2} />
                            {busy ? "Uploading…" : url ? "Replace" : "Upload"}
                        </span>
                    </Button>
                    {url && (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={onClear}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
                        >
                            <Trash2 size={11} strokeWidth={2} />
                            Remove
                        </button>
                    )}
                </div>
            </div>
            <p className="text-[11px] text-[#6b6b73] mt-1.5">{hint}</p>
        </div>
    );
}

function ColorField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    const valid = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
    return (
        <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">{label}</label>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={valid ? value : "#000000"}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-9 h-9 rounded-md border border-[#e5e5ea] bg-white cursor-pointer shrink-0"
                    aria-label={`${label} color picker`}
                />
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#6939B5"
                    className={valid ? "" : "!border-red-300"}
                />
            </div>
            {!valid && value.trim() !== "" && (
                <p className="text-[11px] text-red-600 mt-1">Must be a hex color</p>
            )}
        </div>
    );
}

function safeColor(value: string, fallback: string): string {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : fallback;
}

function slugify(s: string): string {
    return s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
