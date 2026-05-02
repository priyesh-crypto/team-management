"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { startImpersonation } from "../../actions-tier1";
import { Button } from "../../_components/ui";

export function ImpersonateButton({ orgId }: { orgId: string }) {
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    function handleImpersonate() {
        startTransition(async () => {
            try {
                await startImpersonation(orgId);
                router.push("/dashboard");
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to start impersonation");
            }
        });
    }

    return (
        <Button variant="secondary" disabled={pending} onClick={handleImpersonate}>
            <span className="inline-flex items-center gap-1.5">
                <Eye size={14} strokeWidth={2} />
                {pending ? "Starting…" : "View as org"}
            </span>
        </Button>
    );
}
