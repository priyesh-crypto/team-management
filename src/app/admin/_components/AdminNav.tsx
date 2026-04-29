"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
    { href: "/admin", label: "OVERVIEW", icon: "📊" },
    { href: "/admin/orgs", label: "ORGANIZATIONS", icon: "🏢" },
    { href: "/admin/plans", label: "PLANS & PRICING", icon: "💎" },
    { href: "/admin/audit", label: "AUDIT LOG", icon: "📜" },
];

export function AdminNav({ userEmail }: { userEmail: string }) {
    const pathname = usePathname();

    const isActive = (href: string) =>
        href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

    return (
        <aside className="fixed left-0 top-0 h-screen w-60 bg-white border-r border-[#e5e5ea] flex flex-col p-5">
            <div className="flex items-center gap-3 mb-8 px-1">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1d1d1f] to-[#434343] flex items-center justify-center text-white text-sm font-black">
                    M
                </div>
                <div>
                    <span className="text-sm font-black tracking-tight text-[#1d1d1f] leading-none block">
                        Mindbird.ai
                    </span>
                    <span className="text-[10px] text-[#0c64ef] uppercase tracking-widest font-black">
                        Platform Admin
                    </span>
                </div>
            </div>

            <nav className="flex-1 space-y-1.5">
                {NAV.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${
                                active
                                    ? "bg-[#0c64ef] text-white shadow-lg shadow-[#0c64ef]/20 font-bold translate-x-1"
                                    : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] font-bold"
                            }`}
                        >
                            <span
                                className={`text-lg transition-transform duration-300 ${
                                    active ? "scale-110" : "group-hover:scale-110"
                                }`}
                            >
                                {item.icon}
                            </span>
                            <span className="text-[10px] uppercase tracking-widest">
                                {item.label}
                            </span>
                            {active && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto p-5 bg-[#f5f5f7]/50 rounded-[32px] border border-[#e5e5ea]/50 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#0c64ef] shadow-lg shadow-[#0c64ef]/20 flex items-center justify-center text-white text-xs font-black">
                        {userEmail.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-[#1d1d1f] truncate leading-tight uppercase tracking-wider">
                            {userEmail.split("@")[0]}
                        </p>
                        <p className="text-[9px] text-[#86868b] font-black uppercase tracking-widest mt-0.5">
                            Super Admin
                        </p>
                    </div>
                </div>
                <Link
                    href="/dashboard"
                    className="block w-full py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#86868b] hover:text-[#0c64ef] transition-all border border-[#e5e5ea] rounded-xl bg-white text-center"
                >
                    Exit Admin
                </Link>
            </div>
        </aside>
    );
}
