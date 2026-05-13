/**
 * Distributed rate limiter.
 *
 * Uses Upstash Redis + @upstash/ratelimit when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set (production). Falls back to an in-process
 * Map for local development — the fallback does NOT share state across
 * serverless instances, so only use it for dev/preview.
 */

import { headers } from "next/headers";

// ── Upstash (distributed) ────────────────────────────────────────────────────

let redisClient: import("@upstash/redis").Redis | null = null;
let rlFactory: typeof import("@upstash/ratelimit").Ratelimit | null = null;

// Lazy-init so the module doesn't blow up when env vars are absent.
async function getRedisRatelimit() {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return null;
    }
    if (!redisClient || !rlFactory) {
        const { Redis }     = await import("@upstash/redis");
        const { Ratelimit } = await import("@upstash/ratelimit");
        redisClient = new Redis({
            url:   process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        rlFactory = Ratelimit;
    }
    return { redis: redisClient, Ratelimit: rlFactory };
}

// Per-action Ratelimit instances are cached to reuse the sliding-window config.
const rlCache = new Map<string, import("@upstash/ratelimit").Ratelimit>();

async function getDistributedLimiter(action: string, limit: number, windowMs: number) {
    const deps = await getRedisRatelimit();
    if (!deps) return null;

    const key = `${action}:${limit}:${windowMs}`;
    if (!rlCache.has(key)) {
        const { Ratelimit, redis } = deps;
        rlCache.set(
            key,
            new Ratelimit({
                redis,
                limiter: Ratelimit.slidingWindow(limit, `${windowMs}ms`),
                prefix:  `rl:${action}`,
                analytics: false,
            })
        );
    }
    return rlCache.get(key)!;
}

// ── In-process fallback (dev / single-instance) ───────────────────────────────

type RateLimitEntry = { count: number; resetAt: number };
const store = new Map<string, RateLimitEntry>();

function pruneExpired() {
    const now = Date.now();
    for (const [k, e] of store) {
        if (e.resetAt <= now) store.delete(k);
    }
}

function localCheck(
    identifier: string,
    action: string,
    limit: number,
    windowMs: number
): { allowed: boolean; error?: string } {
    pruneExpired();
    const key   = `${action}:${identifier}`;
    const now   = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true };
    }

    if (entry.count >= limit) {
        const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
        return {
            allowed: false,
            error: `Too many requests. Please try again in ${retryAfterSec} second${retryAfterSec !== 1 ? "s" : ""}.`,
        };
    }

    entry.count += 1;
    return { allowed: true };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function checkActionRateLimit(
    identifier: string,
    action: string,
    limit: number = 5,
    windowMs: number = 60_000
): Promise<{ allowed: boolean; error?: string }> {
    const limiter = await getDistributedLimiter(action, limit, windowMs);

    if (limiter) {
        // Upstash Redis path — shared across all serverless instances
        const { success, reset } = await limiter.limit(identifier);
        if (!success) {
            const retryAfterSec = Math.ceil((reset - Date.now()) / 1000);
            return {
                allowed: false,
                error: `Too many requests. Please try again in ${retryAfterSec} second${retryAfterSec !== 1 ? "s" : ""}.`,
            };
        }
        return { allowed: true };
    }

    // In-process fallback
    return localCheck(identifier, action, limit, windowMs);
}

export async function applyRateLimit(actionName: string, limit: number, windowMs: number) {
    const ip = (await headers().catch(() => null))?.get("x-forwarded-for") || "unknown";
    const { allowed, error } = await checkActionRateLimit(ip, actionName, limit, windowMs);
    if (!allowed) throw new Error(error || "Rate limit exceeded");
}
