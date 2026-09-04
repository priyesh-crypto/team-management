"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const HOLD_MS = 1200;

/**
 * A destructive button that must be held, not clicked.
 *
 * Deleting a project or wiping account data is one mouse-slip away from
 * happening by accident, and a modal alone doesn't help much — people dismiss
 * those on autopilot. Requiring a sustained press makes the commitment
 * deliberate, and the fill is the feedback that says how much longer.
 *
 * The timing is asymmetric on purpose: the fill takes 1.2s (a deliberate
 * phase, intentionally outside the normal sub-300ms UI budget), while
 * releasing early snaps back in 200ms — the system's own response should
 * always feel immediate.
 *
 * The fill uses clip-path on an overlay so only the compositor is involved;
 * animating width would relayout on every frame.
 */
export function HoldToConfirmButton({
    onConfirm,
    disabled,
    isLoading,
    children,
    holdingText = "Keep holding…",
    className,
}: {
    onConfirm: () => void;
    disabled?: boolean;
    isLoading?: boolean;
    children: React.ReactNode;
    holdingText?: string;
    className?: string;
}) {
    const [holding, setHolding] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clear = useCallback(() => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
        setHolding(false);
    }, []);

    // A pointerup outside the button still has to cancel the hold, otherwise
    // dragging off mid-press leaves it armed.
    useEffect(() => {
        if (!holding) return;
        window.addEventListener("pointerup", clear);
        window.addEventListener("pointercancel", clear);
        return () => {
            window.removeEventListener("pointerup", clear);
            window.removeEventListener("pointercancel", clear);
        };
    }, [holding, clear]);

    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const start = () => {
        if (disabled || isLoading) return;
        setHolding(true);
        timer.current = setTimeout(() => {
            setHolding(false);
            onConfirm();
        }, HOLD_MS);
    };

    return (
        <button
            type="button"
            disabled={disabled || isLoading}
            onPointerDown={start}
            onPointerUp={clear}
            onPointerLeave={clear}
            // Keyboard users get a plain activation — holding a key is not a
            // reasonable thing to require, and Enter/Space on a button already
            // takes deliberate intent.
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!disabled && !isLoading) onConfirm();
                }
            }}
            aria-busy={isLoading}
            className={cn(
                "relative h-12 w-full overflow-hidden rounded-2xl border-none",
                "bg-[#ff3b30] text-white shadow-lg shadow-[#ff3b30]/20",
                "text-[11px] font-black uppercase tracking-widest",
                "flex items-center justify-center gap-2",
                "transition-transform duration-[160ms] active:scale-[0.97]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                className
            )}
        >
            {/* Fill. Darker shade of the same red so the label stays legible
                the whole way across. */}
            <span
                aria-hidden="true"
                // Exempt from the global reduced-motion collapse: this bar
                // tracks a real 1.2s timer, so freezing it would show a full
                // bar before the action fires.
                data-keep-motion=""
                className="absolute inset-0 bg-[#c0271f]"
                style={{
                    clipPath: holding ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
                    transition: holding
                        ? `clip-path ${HOLD_MS}ms linear`
                        : "clip-path 200ms var(--ease-out)",
                }}
            />
            <span className="relative flex items-center gap-2">
                {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                {isLoading ? "Processing…" : holding ? holdingText : children}
            </span>
        </button>
    );
}
