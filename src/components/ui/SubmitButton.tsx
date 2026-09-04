"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/components";
import { cn } from "@/lib/utils";

/**
 * A submit button that reflects the pending state of the <form> it sits in.
 *
 * The auth pages post to server actions, which means the browser does a full
 * round trip with no client-side state to hang a spinner off. Before this,
 * pressing "Sign In" produced no feedback at all until the page navigated —
 * on a slow connection that reads as a dead button, and people click it again.
 *
 * useFormStatus() reads the pending state of the nearest enclosing form, so
 * this works with plain server actions and needs no prop wiring. It only
 * reports on a form it is INSIDE — hence a separate component rather than a
 * flag on the page itself.
 */
export function SubmitButton({
    children,
    pendingText,
    className,
    variant = "primary",
    disabled,
    ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
    // Narrowed from Button's own children type: it is a motion.button, whose
    // children union includes MotionValue, which is not a valid ReactNode.
    children: React.ReactNode;
    /** Label while submitting. Defaults to the idle label. */
    pendingText?: React.ReactNode;
}) {
    const { pending } = useFormStatus();

    return (
        <Button
            type="submit"
            variant={variant}
            // Blocks the double-submit that no-feedback buttons invite.
            disabled={pending || disabled}
            aria-busy={pending}
            className={cn("relative", className)}
            {...props}
        >
            {pending && (
                <Loader2
                    size={15}
                    strokeWidth={2.5}
                    className="animate-spin shrink-0"
                    aria-hidden="true"
                />
            )}
            <span>{pending ? (pendingText ?? children) : children}</span>
        </Button>
    );
}
