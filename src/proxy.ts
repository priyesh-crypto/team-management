import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function proxy(request: NextRequest) {
    const response = await updateSession(request);

    // Add security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    let supabaseHost = '';
    
    try {
        supabaseHost = new URL(supabaseUrl).host;
    } catch (e) {
        console.warn("Could not parse supabase URL for CSP");
    }

    const csp = [
        "default-src 'self'",
        // Next.js requires 'unsafe-inline' for styles and inline scripts it generates.
        // 'unsafe-eval' is removed; avoid it unless a dependency requires it.
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        `img-src 'self' data: blob: ${supabaseHost ? `https://${supabaseHost}` : ''}`.trimEnd(),
        "font-src 'self' https://fonts.gstatic.com",
        `connect-src 'self' ${supabaseUrl}${supabaseHost ? ` wss://${supabaseHost}` : ''}`,
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ');

    response.headers.set('Content-Security-Policy', csp);
    
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
;
