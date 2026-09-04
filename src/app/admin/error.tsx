"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui/components";

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[AdminError]", error);
    }, [error]);

    return (
        <div className="p-6">
            <Card className="p-8 text-center max-w-md mx-auto">
                <h2 className="text-lg font-black text-[#1d1d1f] mb-2">Admin panel error</h2>
                <p className="text-sm font-medium text-[#6b6b73] mb-6">
                    Something went wrong in the platform admin panel.
                </p>
                <Button onClick={() => reset()}>Try again</Button>
            </Card>
        </div>
    );
}
