import React from "react";

export function PageHeader({
    title,
    subtitle,
    actions,
}: {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between mb-6 pb-5 border-b border-[#e5e5ea]">
            <div>
                <h1 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-sm text-[#86868b] mt-1">{subtitle}</p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}

export function Card({
    children,
    className = "",
    padding = "p-5",
}: {
    children: React.ReactNode;
    className?: string;
    padding?: string;
}) {
    return (
        <div
            className={`bg-white rounded-lg border border-[#e5e5ea] ${padding} ${className}`}
        >
            {children}
        </div>
    );
}

export function StatCard({
    label,
    value,
    accent = "default",
    icon,
    sub,
}: {
    label: string;
    value: string | number;
    accent?: "default" | "blue" | "emerald" | "amber" | "red";
    icon?: React.ReactNode;
    sub?: string;
}) {
    const accentColor: Record<string, string> = {
        default: "text-[#1d1d1f]",
        blue: "text-[#0051e6]",
        emerald: "text-emerald-600",
        amber: "text-amber-600",
        red: "text-red-600",
    };
    const iconBg: Record<string, string> = {
        default: "bg-[#f5f5f7] text-[#52525b]",
        blue: "bg-[#0051e6]/10 text-[#0051e6]",
        emerald: "bg-emerald-50 text-emerald-600",
        amber: "bg-amber-50 text-amber-600",
        red: "bg-red-50 text-red-600",
    };
    return (
        <Card padding="p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs font-medium text-[#86868b]">
                        {label}
                    </div>
                    <div className={`text-2xl font-semibold mt-1 tracking-tight tabular-nums ${accentColor[accent]}`}>
                        {value}
                    </div>
                    {sub && (
                        <div className="text-xs text-[#86868b] mt-1">
                            {sub}
                        </div>
                    )}
                </div>
                {icon && (
                    <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${iconBg[accent]}`}
                    >
                        {icon}
                    </div>
                )}
            </div>
        </Card>
    );
}

export function StatusPill({ status }: { status: string | null }) {
    const s = (status ?? "free").toLowerCase();
    const map: Record<string, { bg: string; fg: string; dot: string }> = {
        active: { bg: "bg-emerald-50", fg: "text-emerald-700", dot: "bg-emerald-500" },
        trialing: { bg: "bg-[#0051e6]/10", fg: "text-[#0051e6]", dot: "bg-[#0051e6]" },
        past_due: { bg: "bg-amber-50", fg: "text-amber-700", dot: "bg-amber-500" },
        canceled: { bg: "bg-red-50", fg: "text-red-700", dot: "bg-red-500" },
        free: { bg: "bg-[#f5f5f7]", fg: "text-[#52525b]", dot: "bg-[#86868b]" },
    };
    const cls = map[s] ?? map.free;
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full ${cls.bg} ${cls.fg}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${cls.dot}`} />
            {s.replace("_", " ")}
        </span>
    );
}

export function PlanPill({ plan }: { plan: string }) {
    const colors: Record<string, string> = {
        free: "bg-[#f5f5f7] text-[#52525b]",
        pro: "bg-[#0051e6]/10 text-[#0051e6]",
        business: "bg-purple-50 text-purple-700",
    };
    return (
        <span
            className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full capitalize ${
                colors[plan] ?? "bg-[#f5f5f7] text-[#1d1d1f]"
            }`}
        >
            {plan}
        </span>
    );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="text-sm font-semibold text-[#1d1d1f] mb-3">
            {children}
        </div>
    );
}

export function Button({
    children,
    onClick,
    type = "button",
    variant = "primary",
    disabled,
    className = "",
}: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: "button" | "submit";
    variant?: "primary" | "secondary" | "danger" | "ghost";
    disabled?: boolean;
    className?: string;
}) {
    const styles: Record<string, string> = {
        primary:
            "bg-[#0051e6] text-white hover:bg-[#0950c4]",
        secondary:
            "bg-white text-[#1d1d1f] border border-[#e5e5ea] hover:bg-[#f5f5f7]",
        danger: "bg-red-600 text-white hover:bg-red-700",
        ghost: "bg-transparent text-[#52525b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]",
    };
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`px-3.5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
        >
            {children}
        </button>
    );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={`w-full px-3 py-2 rounded-md border border-[#e5e5ea] bg-white text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:border-[#0051e6] focus:ring-2 focus:ring-[#0051e6]/10 transition-colors ${
                props.className ?? ""
            }`}
        />
    );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            {...props}
            className={`w-full px-3 py-2 rounded-md border border-[#e5e5ea] bg-white text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0051e6] focus:ring-2 focus:ring-[#0051e6]/10 transition-colors ${
                props.className ?? ""
            }`}
        />
    );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
    return (
        <label className="block">
            <div className="text-xs font-medium text-[#52525b] mb-1.5">
                {label}
            </div>
            {children}
            {hint && <div className="text-xs text-[#86868b] mt-1.5">{hint}</div>}
        </label>
    );
}

export function formatMoney(cents: number, currency: string = "USD"): string {
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(cents / 100);
    } catch {
        return `${(cents / 100).toFixed(2)} ${currency}`;
    }
}

export function relativeTime(date: string | Date | null | undefined): string {
    if (!date) return "—";
    const d = typeof date === "string" ? new Date(date) : date;
    const diff = d.getTime() - Date.now();
    const abs = Math.abs(diff);
    const day = 86400000;
    if (abs < day) return diff < 0 ? "today" : "today";
    const days = Math.round(diff / day);
    if (days < 0) return `${-days}d ago`;
    if (days < 30) return `in ${days}d`;
    if (days < 365) return `in ${Math.round(days / 30)}mo`;
    return `in ${Math.round(days / 365)}y`;
}

export function humanizeAction(action: string): string {
    return action
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
