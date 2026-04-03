import { headers } from "next/headers"

type RateLimitEntry = { count: number; resetAt: number }

// Module-level map survives across requests in the same server process.
// On serverless (Vercel), each instance has its own map — acceptable for
// abuse prevention; not a substitute for a distributed rate-limiter.
const store = new Map<string, RateLimitEntry>()

// Prune expired entries periodically to prevent unbounded memory growth.
function pruneExpired() {
    const now = Date.now()
    for (const [key, entry] of store) {
        if (entry.resetAt <= now) store.delete(key)
    }
}

export async function checkActionRateLimit(
    identifier: string,
    action: string,
    limit: number = 5,
    windowMs: number = 60 * 1000
): Promise<{ allowed: boolean; error?: string }> {
    pruneExpired()

    const key = `${action}:${identifier}`
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || entry.resetAt <= now) {
        store.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true }
    }

    if (entry.count >= limit) {
        const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000)
        return {
            allowed: false,
            error: `Too many requests. Please try again in ${retryAfterSec} second${retryAfterSec !== 1 ? 's' : ''}.`,
        }
    }

    entry.count += 1
    return { allowed: true }
}

/**
 * Internal helper to apply rate limiting inside a server action.
 */
export async function applyRateLimit(actionName: string, limit: number, windowMs: number) {
    const ip = (await headers().catch(() => null))?.get('x-forwarded-for') || 'unknown';
    const { allowed, error } = await checkActionRateLimit(ip, actionName, limit, windowMs);
    if (!allowed) {
        throw new Error(error || "Rate limit exceeded");
    }
}
