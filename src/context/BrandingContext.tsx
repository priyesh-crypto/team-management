"use client";

import { createContext, useContext } from "react";
import { PLATFORM_BRANDING, type Branding } from "@/lib/branding";

const BrandingContext = createContext<Branding>(PLATFORM_BRANDING);

/**
 * Makes the active tenant's branding available to client components.
 *
 * The sidebars are client components rendered several levels below the
 * dashboard layout without an `orgId` in scope, so passing branding down as
 * props would mean threading it through DashboardContainer, ManagerDashboard
 * and EmployeeDashboard purely as pass-through. Context avoids that.
 *
 * Colors do NOT come through here — those are CSS vars applied by
 * <BrandingStyle>. This is only for values that must appear in markup: the
 * logo URL, product name and support address.
 */
export function BrandingProvider({
    branding,
    children,
}: {
    branding: Branding;
    children: React.ReactNode;
}) {
    return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

/** Active branding. Falls back to platform branding outside a provider. */
export function useBranding(): Branding {
    return useContext(BrandingContext);
}
