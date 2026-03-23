import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
    const response = await updateSession(request);

    // Add security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocations=()');
    
    // Strict-Transport-Security (HSTS) - only for production
    if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Basic CSP - Adjust based on your actual needs (e.g., Supabase URL)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : '';
    
    // Note: This is a restrictive CSP. If you use external fonts/scripts, add them here.
    const cspHeader = `
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval';
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        img-src 'self' data: blob: ${supabaseHost};
        font-src 'self' https://fonts.gstatic.com;
        connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace('https://', 'wss://')};
        frame-ancestors 'none';
        object-src 'none';
        base-uri 'self';
        form-action 'self';
    `.replace(/\s+/g, ' ').trim();

    response.headers.set('Content-Security-Policy', cspHeader);

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
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
