import { createClient } from "@/utils/supabase/server"
import { headers } from "next/headers"

export async function checkActionRateLimit(
    identifier: string, 
    action: string, 
    limit: number = 5, 
    windowMs: number = 60 * 1000
): Promise<{ allowed: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const now = new Date();
        const windowStart = new Date(now.getTime() - windowMs);

        // 1. Clean up old logs (optional)
        if (Math.random() < 0.01) {
            await supabase.from('rate_limit_logs')
                .delete()
                .lt('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
        }

        // 2. Count recent attempts
        const { count, error } = await supabase
            .from('rate_limit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('identifier', identifier)
            .eq('action', action)
            .gt('created_at', windowStart.toISOString());

        if (error) {
            console.error("[RateLimit] Error counting logs:", error);
            return { allowed: true };
        }

        if (count && count >= limit) {
            // Log security event for serious abuse
            if (count >= limit * 3) {
                // Note: requireOrgContext can't be imported easily here without circular dependency,
                // so we just log what we have.
                await supabase.from('activity_logs').insert([{
                    type: 'security_event' as any,
                    description: `Potential Brute Force/Abuse: ${action} limit hit ${count} times for ${identifier}`,
                    metadata: { identifier, action, count, limit }
                }]);
            }
            return { allowed: false, error: `Too many attempts. Please try again in ${Math.ceil(windowMs / 60000)} minutes.` };
        }

        // 3. Log this attempt
        await supabase.from('rate_limit_logs').insert([{ identifier, action }]);

        return { allowed: true };
    } catch (e) {
        console.error("[RateLimit] Fatal error:", e);
        return { allowed: true };
    }
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
