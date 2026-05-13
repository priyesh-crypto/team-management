"use client";

import { useState } from "react";
import { X, Megaphone } from "lucide-react";

type Banner = { id: string; title: string; body: string };

export function GlobalBanner({ banner }: { banner: Banner | null }) {
    const [dismissed, setDismissed] = useState(false);

    if (!banner || dismissed) return null;

    return (
        <div className="w-full bg-[#0051e6] text-white px-4 py-2.5 flex items-center justify-between gap-4 z-50">
            <div className="flex items-center gap-2.5 min-w-0">
                <Megaphone size={14} className="shrink-0 opacity-80" />
                <p className="text-sm font-medium truncate">
                    <span className="font-bold mr-1.5">{banner.title}:</span>
                    {banner.body}
                </p>
            </div>
            <button
                onClick={() => setDismissed(true)}
                aria-label="Dismiss banner"
                className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
            >
                <X size={14} />
            </button>
        </div>
    );
}
