"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteBroadcast } from "../actions-tier2";

export function BroadcastDeleteButton({ broadcastId }: { broadcastId: string }) {
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    return (
        <button
            disabled={pending}
            onClick={() => {
                if (!confirm("Delete this broadcast?")) return;
                startTransition(async () => {
                    try {
                        await deleteBroadcast(broadcastId);
                        toast.success("Deleted");
                        router.refresh();
                    } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                    }
                });
            }}
            className="p-2 rounded-lg text-[#86868b] hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
        >
            🗑
        </button>
    );
}
