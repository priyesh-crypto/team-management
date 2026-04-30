"use client";

import React, { createContext, useContext } from "react";
import { Entitlement } from "@/lib/entitlements";

const EntitlementContext = createContext<Entitlement | null>(null);

export function EntitlementProvider({
    entitlement,
    children,
}: {
    entitlement: Entitlement | null;
    children: React.ReactNode;
}) {
    return (
        <EntitlementContext.Provider value={entitlement}>
            {children}
        </EntitlementContext.Provider>
    );
}

export function useEntitlement(): Entitlement | null {
    return useContext(EntitlementContext);
}

export function useFeature(feature: string): boolean {
    const e = useContext(EntitlementContext);
    if (!e) return false;
    return e.is_active && Boolean(e.features?.[feature]);
}
