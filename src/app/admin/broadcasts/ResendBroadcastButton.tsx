"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { resendBroadcast } from "../actions-tier2";

export function ResendBroadcastButton({ broadcastId }: { broadcastId: string }) {
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    return (
        <button
            disabled={pending}
            onClick={() => {
                if (!confirm("Re-deliver this broadcast to all matching users? They will get a new in-app notification.")) return;
                startTransition(async () => {
                    try {
                        const r = await resendBroadcast(broadcastId);
                        toast.success(`Re-delivered to ${r.recipients} user${r.recipients !== 1 ? "s" : ""}`);
                        router.refresh();
                    } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                    }
                });
            }}
            className="p-2 rounded-md text-[#86868b] hover:text-[#0c64ef] hover:bg-[#0c64ef]/10 transition-colors"
            title="Re-deliver"
        >
            <RefreshCw size={14} strokeWidth={2} />
        </button>
    );
}
