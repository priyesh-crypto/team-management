import { searchUsers } from "../actions-tier2";
import { PageHeader, Card } from "../_components/ui";
import Link from "next/link";

const ROLE_COLORS: Record<string, string> = {
    owner: "bg-purple-50 text-purple-700",
    admin: "bg-[#0051e6]/10 text-[#0051e6]",
    manager: "bg-emerald-50 text-emerald-700",
    employee: "bg-[#f5f5f7] text-[#86868b]",
};

const PLAN_COLORS: Record<string, string> = {
    business: "bg-[#1d1d1f] text-white",
    pro: "bg-[#0051e6] text-white",
    free: "bg-[#f5f5f7] text-[#86868b]",
};

export default async function UsersPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const { q } = await searchParams;
    const results = q && q.trim().length >= 2 ? await searchUsers(q) : null;

    return (
        <div className="p-10 max-w-4xl space-y-6">
            <PageHeader
                title="User search"
                subtitle="Find any user across all organizations by name or email."
            />

            <form method="GET" action="/admin/users">
                <div className="flex gap-3">
                    <input
                        name="q"
                        defaultValue={q ?? ""}
                        placeholder="Search by name or email…"
                        autoFocus
                        className="flex-1 px-4 py-3 rounded-2xl border border-[#e5e5ea] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0051e6]/20 bg-white"
                    />
                    <button
                        type="submit"
                        className="px-5 py-3 rounded-2xl bg-[#0051e6] text-white text-sm font-black hover:bg-[#005bb7] transition-colors"
                    >
                        Search
                    </button>
                </div>
            </form>

            {q && results === null && (
                <p className="text-sm text-[#86868b]">Enter at least 2 characters to search.</p>
            )}

            {results !== null && results.length === 0 && (
                <Card>
                    <p className="text-sm text-[#86868b] text-center py-6">
                        No users found matching <strong>&ldquo;{q}&rdquo;</strong>.
                    </p>
                </Card>
            )}

            {results && results.length > 0 && (
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#86868b]">
                        {results.length} user{results.length !== 1 ? "s" : ""} found
                    </p>
                    {results.map(user => (
                        <Card key={user.userId} padding="p-5">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1d1d1f] to-[#434343] text-white text-sm font-black flex items-center justify-center flex-shrink-0">
                                    {(user.name ?? "?").slice(0, 1).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-black text-[#1d1d1f]">
                                        {user.name ?? <span className="text-[#86868b]">No name</span>}
                                    </div>
                                    <div className="text-[10px] font-mono text-[#86868b] mt-0.5">
                                        {user.userId}
                                    </div>
                                    {user.orgs.length > 0 && (
                                        <div className="mt-3 space-y-1.5">
                                            {user.orgs.map(org => (
                                                <div key={org.orgId} className="flex items-center gap-2 flex-wrap">
                                                    <Link
                                                        href={`/admin/orgs/${org.orgId}`}
                                                        className="text-xs font-bold text-[#0051e6] hover:underline"
                                                    >
                                                        {org.name}
                                                    </Link>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${PLAN_COLORS[org.plan] ?? "bg-[#f5f5f7] text-[#86868b]"}`}>
                                                        {org.plan}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${ROLE_COLORS[org.role] ?? "bg-[#f5f5f7] text-[#86868b]"}`}>
                                                        {org.role}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {user.orgs.length === 0 && (
                                        <p className="text-xs text-[#86868b] mt-1">No org memberships found.</p>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {!q && (
                <Card>
                    <p className="text-sm text-[#86868b] text-center py-8">
                        Search by full name or email address to find a user across all organizations.
                    </p>
                </Card>
            )}
        </div>
    );
}
