"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Building2,
    Search,
    Gem,
    Ticket,
    Megaphone,
    LineChart,
    Flag,
    LifeBuoy,
    ShieldCheck,
    Activity,
    ScrollText,
    LogOut,
    type LucideIcon,
} from "lucide-react";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/orgs", label: "Organizations", icon: Building2 },
    { href: "/admin/users", label: "User Search", icon: Search },
    { href: "/admin/plans", label: "Plans & Pricing", icon: Gem },
    { href: "/admin/coupons", label: "Coupons", icon: Ticket },
    { href: "/admin/broadcasts", label: "Broadcasts", icon: Megaphone },
    { href: "/admin/analytics", label: "Analytics", icon: LineChart },
    { href: "/admin/feature-flags", label: "Feature Flags", icon: Flag },
    { href: "/admin/support", label: "Support", icon: LifeBuoy },
    { href: "/admin/gdpr", label: "GDPR", icon: ShieldCheck },
    { href: "/admin/system", label: "System Health", icon: Activity },
    { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

export function AdminNav({ userEmail }: { userEmail: string }) {
    const pathname = usePathname();

    const isActive = (href: string) =>
        href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

    return (
        <aside className="fixed left-0 top-0 h-screen w-56 bg-white border-r border-[#e5e5ea] flex flex-col">
            <div className="flex items-center gap-2.5 px-5 h-14 border-b border-[#f0f0f2]">
                <div className="w-7 h-7 rounded-md bg-[#1d1d1f] flex items-center justify-center text-white text-xs font-semibold">
                    M
                </div>
                <div className="leading-tight">
                    <span className="text-sm font-semibold text-[#1d1d1f] block">
                        Mindbird
                    </span>
                    <span className="text-[10px] text-[#0c64ef] font-medium">
                        Platform Admin
                    </span>
                </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {NAV.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                                active
                                    ? "bg-[#0c64ef]/10 text-[#0c64ef] font-medium"
                                    : "text-[#52525b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                            }`}
                        >
                            <Icon
                                size={16}
                                strokeWidth={active ? 2.25 : 2}
                                className="shrink-0"
                            />
                            <span className="truncate">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-[#f0f0f2] p-3">
                <div className="flex items-center gap-2.5 px-2 py-2">
                    <div className="w-8 h-8 rounded-full bg-[#0c64ef] flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {userEmail.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#1d1d1f] truncate">
                            {userEmail.split("@")[0]}
                        </p>
                        <p className="text-[11px] text-[#86868b] truncate">
                            Super Admin
                        </p>
                    </div>
                </div>
                <Link
                    href="/dashboard"
                    className="mt-1 flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-[#52525b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] rounded-md transition-colors"
                >
                    <LogOut size={14} strokeWidth={2} />
                    Exit admin
                </Link>
            </div>
        </aside>
    );
}
