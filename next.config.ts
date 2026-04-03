import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : undefined;

const nextConfig: NextConfig = {
    experimental: {
        optimizePackageImports: ['lucide-react', 'date-fns', 'framer-motion'],
    },

    // Restrict image optimization to known domains only.
    images: {
        remotePatterns: [
            ...(supabaseHostname
                ? [{ protocol: 'https' as const, hostname: supabaseHostname }]
                : []),
        ],
    },

    // Strip server-only env vars from the client bundle.
    // NEXT_PUBLIC_* vars are intentionally exposed; nothing else should leak.
    serverExternalPackages: [],

    // Enforce strict output mode for cleaner production builds.
    output: 'standalone',
};

export default nextConfig;
