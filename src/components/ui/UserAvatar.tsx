"use client";

interface UserAvatarProps {
    /** Display name used for the initials fallback and alt text */
    name: string;
    /** URL of the uploaded profile picture. Renders initials when absent. */
    avatarUrl?: string | null;
    /** Tailwind classes applied to the wrapper div (shape, size, background colour for the initials fallback) */
    className?: string;
    /** Tailwind classes applied to the initials <span> */
    textClassName?: string;
}

/**
 * Renders a circular/rounded avatar.
 * Shows the uploaded photo when `avatarUrl` is present; falls back to the
 * first letter of `name` otherwise. The wrapper keeps its className in both
 * cases so shape and size are always consistent.
 */
export function UserAvatar({ name, avatarUrl, className = '', textClassName = '' }: UserAvatarProps) {
    const initial = name?.charAt(0)?.toUpperCase() || '?';
    return (
        <div className={`overflow-hidden flex items-center justify-center shrink-0 ${className}`}>
            {avatarUrl
                ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                : <span className={textClassName}>{initial}</span>
            }
        </div>
    );
}
