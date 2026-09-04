"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui/components";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[DashboardError]", error);
    }, [error]);

    return (
        <div className="p-6">
            <Card className="p-8 text-center max-w-md mx-auto">
                <h2 className="text-lg font-black text-[#1d1d1f] mb-2">This section failed to load</h2>
                <p className="text-sm font-medium text-[#86868b] mb-6">
                    Something went wrong loading this part of the dashboard. The rest of the app is unaffected.
                </p>
                <Button onClick={() => reset()}>Try again</Button>
            </Card>
        </div>
    );
}
