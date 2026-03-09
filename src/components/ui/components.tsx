import React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children }: { className?: string, children: React.ReactNode }) {
    return (
        <div className={cn("bg-white rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#e5e5ea] p-6", className)}>
            {children}
        </div>
    );
}

export function Button({
    className,
    variant = 'primary',
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
    const variants = {
        primary: "bg-[#0071e3] hover:bg-[#0077ED] text-white shadow-sm",
        secondary: "bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f]",
        danger: "bg-[#e83f3f] hover:bg-[#d53a3a] text-white shadow-sm"
    };

    return (
        <button
            className={cn(
                "px-5 py-2.5 rounded-full font-medium transition-colors duration-200 active:scale-[0.98]",
                variants[variant],
                className
            )}
            {...props}
        />
    );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>) {
    return (
        <input
            className={cn(
                "bg-white border border-[#d2d2d7] text-[#1d1d1f] rounded-xl px-4 py-2.5 outline-none transition-all duration-200 focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] placeholder-[#86868b]",
                className
            )}
            {...props}
        />
    );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            className={cn(
                "bg-white border border-[#d2d2d7] text-[#1d1d1f] rounded-xl px-4 py-2.5 outline-none transition-all duration-200 focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] appearance-none",
                className
            )}
            {...props}
        >
            {children}
        </select>
    );
}

export function Badge({ children, variant = 'default' }: { children: React.ReactNode, variant?: string }) {
    const variants: Record<string, string> = {
        Urgent: "bg-[#fee2e2] text-[#e83f3f]",
        High: "bg-[#ffedd5] text-[#ea580c]",
        Medium: "bg-[#fef9c3] text-[#ca8a04]",
        Low: "bg-[#dcfce7] text-[#16a34a]",
        default: "bg-[#f5f5f7] text-[#86868b]"
    };

    return (
        <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider", variants[variant] || variants.default)}>
            {children}
        </span>
    );
}
