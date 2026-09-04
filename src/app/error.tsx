"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/components";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[GlobalError]", error);
    }, [error]);

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <div className="max-w-md text-center">
                <h1 className="text-2xl font-black text-[#1d1d1f] mb-2">Something went wrong</h1>
                <p className="text-sm font-medium text-[#86868b] mb-8">
                    An unexpected error occurred. You can try again, or head back to the dashboard.
                </p>
                <div className="flex items-center justify-center gap-3">
                    <Button variant="secondary" onClick={() => reset()}>Try again</Button>
                    <Button onClick={() => { window.location.href = "/dashboard"; }}>Go to dashboard</Button>
                </div>
            </div>
        </main>
    );
}
