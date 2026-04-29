import Stripe from "stripe";

let _stripe: Stripe | null = null;

// Lazy accessor — only constructs the SDK when actually used (checkout, webhook, etc).
// Lets admin/billing pages render even before STRIPE_SECRET_KEY is configured.
export function getStripe(): Stripe {
    if (_stripe) return _stripe;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error(
            "STRIPE_SECRET_KEY is not configured. Add it to .env.local and restart the dev server."
        );
    }
    _stripe = new Stripe(key, { typescript: true });
    return _stripe;
}

// Backwards-compatible Proxy: existing `import { stripe } from ...` keeps working,
// but the actual SDK is only constructed on first method access.
export const stripe = new Proxy({} as Stripe, {
    get(_target, prop) {
        const real = getStripe();
        const value = (real as any)[prop];
        return typeof value === "function" ? value.bind(real) : value;
    },
});

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
