import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
    const response = await updateSession(request);

    // Add security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Determine the environment URLs
    const isProdVercel = process.env.VERCEL_ENV === 'production';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    let supabaseHost = '';
    
    try {
        supabaseHost = new URL(supabaseUrl).host;
    } catch (e) {
        console.warn("Could not parse supabase URL for CSP");
    }

    // Set production URL explicitly if available
    const appUrl = isProdVercel ? 'https://team-management-pink-three.vercel.app' :
                  (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    
    // Very permissive CSP for testing, tightening later
    const csp = `
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval';
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        img-src 'self' data: blob: ${supabaseHost ? supabaseHost : '*'} https://*;
        font-src 'self' https://fonts.gstatic.com;
        connect-src 'self' ${supabaseUrl} wss://${supabaseHost} https://*;
        frame-ancestors 'none';
        object-src 'none';
        base-uri 'self';
        form-action 'self';
    `.replace(/\s{2,}/g, ' ').trim();

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
