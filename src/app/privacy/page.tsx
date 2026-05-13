import { getContentPage } from "@/app/admin/actions-system-config";
import { notFound } from "next/navigation";

export const revalidate = 300;

export default async function PrivacyPage() {
    const page = await getContentPage("privacy");
    if (!page) notFound();

    const html = page.body_md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
        .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .split('\n\n')
        .map(p => p.startsWith('<') ? p : `<p>${p}</p>`)
        .join('\n');

    return (
        <main className="max-w-2xl mx-auto py-16 px-6">
            <p className="text-xs text-[#86868b] mb-6">
                Last updated: {new Date(page.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <article
                className="prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </main>
    );
}
