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
        <div className="flex items-start justify-between mb-8">
            <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0c64ef] mb-1.5">
                    Mindbird Admin
                </div>
                <h1 className="text-3xl font-black tracking-tight text-[#1d1d1f]">{title}</h1>
                {subtitle && (
                    <p className="text-sm text-[#86868b] font-medium mt-1.5">{subtitle}</p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}

export function Card({
    children,
    className = "",
    padding = "p-6",
}: {
    children: React.ReactNode;
    className?: string;
    padding?: string;
}) {
    return (
        <div
            className={`bg-white rounded-[24px] border border-[#e5e5ea] shadow-sm ${padding} ${className}`}
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
    icon?: string;
    sub?: string;
}) {
    const accentColor: Record<string, string> = {
        default: "text-[#1d1d1f]",
        blue: "text-[#0c64ef]",
        emerald: "text-emerald-600",
        amber: "text-amber-600",
        red: "text-red-600",
    };
    const iconBg: Record<string, string> = {
        default: "bg-[#f5f5f7]",
        blue: "bg-[#0c64ef]/10",
        emerald: "bg-emerald-50",
        amber: "bg-amber-50",
        red: "bg-red-50",
    };
    return (
        <Card>
            <div className="flex items-start justify-between">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#86868b]">
                        {label}
                    </div>
                    <div className={`text-3xl font-black mt-2 tracking-tight ${accentColor[accent]}`}>
                        {value}
                    </div>
                    {sub && (
                        <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mt-1.5">
                            {sub}
                        </div>
                    )}
                </div>
                {icon && (
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${iconBg[accent]}`}
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
        trialing: { bg: "bg-[#0c64ef]/10", fg: "text-[#0c64ef]", dot: "bg-[#0c64ef]" },
        past_due: { bg: "bg-amber-50", fg: "text-amber-700", dot: "bg-amber-500" },
        canceled: { bg: "bg-red-50", fg: "text-red-700", dot: "bg-red-500" },
        free: { bg: "bg-[#f5f5f7]", fg: "text-[#86868b]", dot: "bg-[#86868b]" },
    };
    const cls = map[s] ?? map.free;
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] rounded-full ${cls.bg} ${cls.fg}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${cls.dot}`} />
            {s.replace("_", " ")}
        </span>
    );
}

export function PlanPill({ plan }: { plan: string }) {
    const colors: Record<string, string> = {
        free: "bg-[#f5f5f7] text-[#86868b]",
        pro: "bg-[#0c64ef]/10 text-[#0c64ef]",
        business: "bg-purple-50 text-purple-700",
    };
    return (
        <span
            className={`inline-block px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] rounded-full ${
                colors[plan] ?? "bg-[#f5f5f7] text-[#1d1d1f]"
            }`}
        >
            {plan}
        </span>
    );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#86868b] mb-3">
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
            "bg-[#0c64ef] text-white hover:bg-[#0950c4] shadow-md shadow-[#0c64ef]/20",
        secondary:
            "bg-white text-[#1d1d1f] border border-[#e5e5ea] hover:bg-[#f5f5f7]",
        danger: "bg-red-600 text-white hover:bg-red-700",
        ghost: "bg-transparent text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]",
    };
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
        >
            {children}
        </button>
    );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={`w-full px-3.5 py-2.5 rounded-xl border border-[#e5e5ea] bg-white text-sm font-medium text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:border-[#0c64ef] focus:ring-2 focus:ring-[#0c64ef]/10 transition ${
                props.className ?? ""
            }`}
        />
    );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            {...props}
            className={`w-full px-3.5 py-2.5 rounded-xl border border-[#e5e5ea] bg-white text-sm font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0c64ef] focus:ring-2 focus:ring-[#0c64ef]/10 transition ${
                props.className ?? ""
            }`}
        />
    );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
    return (
        <label className="block">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#86868b] mb-1.5">
                {label}
            </div>
            {children}
            {hint && <div className="text-[10px] text-[#86868b] mt-1.5">{hint}</div>}
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
