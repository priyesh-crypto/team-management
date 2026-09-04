import React from 'react';
import Image from 'next/image';
import { PLATFORM_BRANDING, type Branding } from '@/lib/branding';

/**
 * The product/tenant logo.
 *
 * Server-safe (no "use client"), so auth pages can pass branding they resolved
 * server-side. Client components inside the dashboard should read branding from
 * useBranding() and pass it in, or use <SidebarLogo> which does that already.
 *
 * `next/image` is skipped for remote logos: tenant logos live in Supabase
 * Storage on a per-project domain, which would each need a
 * `next.config` remotePatterns entry to pass the optimizer.
 */
export default function Logo({
    className = "",
    branding = PLATFORM_BRANDING,
}: {
    className?: string;
    branding?: Branding;
}) {
    const isRemote = /^https?:\/\//i.test(branding.logoUrl);
    return (
        <div className={`flex flex-col items-center ${className}`}>
            {isRemote ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={branding.logoUrl}
                    alt={`${branding.name} logo`}
                    className="w-72 h-auto max-h-36 object-contain drop-shadow-md"
                />
            ) : (
                <Image
                    src={branding.logoUrl}
                    alt={`${branding.name} logo`}
                    width={288}
                    height={144}
                    priority
                    className="w-72 h-auto object-contain drop-shadow-md"
                />
            )}
        </div>
    );
}
