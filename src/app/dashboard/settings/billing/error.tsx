"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui/components";

export default function BillingError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[BillingError]", error);
    }, [error]);

    return (
        <div className="p-6">
            <Card className="p-8 text-center max-w-md mx-auto">
                <h2 className="text-lg font-black text-[#1d1d1f] mb-2">Billing failed to load</h2>
                <p className="text-sm font-medium text-[#86868b] mb-6">
                    We couldn&apos;t load your billing information. No changes were made to your subscription.
                </p>
                <Button onClick={() => reset()}>Try again</Button>
            </Card>
        </div>
    );
}
