import { BroadcastComposer } from "./BroadcastComposer";
import { PageHeader } from "../../_components/ui";
import Link from "next/link";

export default function NewBroadcastPage() {
    return (
        <div className="p-10 max-w-3xl space-y-6">
            <div>
                <Link
                    href="/admin/broadcasts"
                    className="text-[11px] font-black uppercase tracking-widest text-[#6b6b73] hover:text-brand-blue transition"
                >
                    ← Broadcasts
                </Link>
            </div>
            <PageHeader title="New broadcast" subtitle="Compose an in-app announcement for your customers." />
            <BroadcastComposer />
        </div>
    );
}
