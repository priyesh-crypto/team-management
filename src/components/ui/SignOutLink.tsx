"use client";

import { useFormStatus } from "react-dom";

/**
 * The "Sign out instead" text button on the onboarding screen.
 *
 * Split into its own client component purely so it can read useFormStatus() —
 * that hook only reports on a form the component is rendered inside, and the
 * page itself is a server component.
 */
export function SignOutLink() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="text-xs font-bold text-[#52525b] hover:text-[#1d1d1f] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
            {pending ? "Signing out…" : "Sign out instead"}
        </button>
    );
}
