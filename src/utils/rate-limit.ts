import { createClient } from "@/utils/supabase/server"
import { headers } from "next/headers"

export async function checkActionRateLimit(
    identifier: string, 
    action: string, 
    limit: number = 5, 
    windowMs: number = 60 * 1000
): Promise<{ allowed: boolean; error?: string }> {
    // TEMPORARY: Disabled to reduce database pressure during resource exhaustion
    return { allowed: true };
}

/**
 * Internal helper to apply rate limiting inside a server action.
 */
export async function applyRateLimit(actionName: string, limit: number, windowMs: number) {
    const ip = (await headers().catch(() => null))?.get('x-forwarded-for') || 'unknown';
    // We don't have user info yet here, so we use IP
    const { allowed, error } = await checkActionRateLimit(ip, actionName, limit, windowMs);
    if (!allowed) {
        throw new Error(error || "Rate limit exceeded");
    }
}
