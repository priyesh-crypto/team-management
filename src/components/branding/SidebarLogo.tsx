"use client";

import { useBranding } from "@/context/BrandingContext";

/**
 * The logo lockup in the dashboard sidebars.
 *
 * Replaces what used to be four hand-copied <Image src="/knotlessai.svg">
 * blocks across ManagerSidebar and EmployeeSidebar. Plain <img> because tenant
 * logos are remote Supabase Storage URLs that the next/image optimizer would
 * reject without a remotePatterns entry per project.
 */
export function SidebarLogo({ className = "" }: { className?: string }) {
    const branding = useBranding();
    return (
        <div className={`flex items-center justify-start px-4 ${className}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={branding.logoUrl}
                alt={`${branding.name} logo`}
                className="h-[65px] w-auto max-w-[190px] object-contain object-left"
            />
        </div>
    );
}
