"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { endImpersonation } from "@/app/admin/actions-tier1";

export function ImpersonationBanner({ orgName }: { orgName: string }) {
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    function handleExit() {
        startTransition(async () => {
            await endImpersonation();
            router.push("/admin");
        });
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white flex items-center justify-between px-6 py-2 shadow-lg">
            <div className="flex items-center gap-2 text-sm font-bold">
                <span>👁</span>
                <span>Viewing as <strong>{orgName}</strong> — all actions are real</span>
            </div>
            <button
                onClick={handleExit}
                disabled={pending}
                className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-black uppercase tracking-wider transition-colors"
            >
                {pending ? "Exiting…" : "Exit impersonation"}
            </button>
        </div>
    );
}
