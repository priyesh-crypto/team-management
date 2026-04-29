// Convert Stripe-style unix timestamp (seconds) to ISO string. Null-safe.
export function tsFromUnix(seconds: number | null | undefined): string | null {
    if (!seconds || !Number.isFinite(seconds)) return null;
    return new Date(seconds * 1000).toISOString();
}
