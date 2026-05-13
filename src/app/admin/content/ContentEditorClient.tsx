"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertContentPage, type ContentPage } from "../actions-system-config";
import { Card, SectionLabel, Button, Field, Input } from "../_components/ui";

function Editor({ page }: { page: ContentPage }) {
    const [title, setTitle] = useState(page.title);
    const [body, setBody] = useState(page.body_md);
    const [preview, setPreview] = useState(false);
    const [pending, startTransition] = useTransition();

    const save = () => {
        if (!title.trim()) { toast.error("Title is required"); return; }
        startTransition(async () => {
            try {
                await upsertContentPage(page.slug, title, body);
                toast.success(`"/${page.slug}" saved`);
            } catch (e: any) {
                toast.error(e.message || "Failed to save");
            }
        });
    };

    // Minimal markdown → HTML for preview (bold, italic, headings, paragraphs)
    const renderPreview = (md: string) =>
        md
            .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-1">$1</h3>')
            .replace(/^## (.+)$/gm,  '<h2 class="text-lg font-bold mt-5 mb-2">$1</h2>')
            .replace(/^# (.+)$/gm,   '<h1 class="text-xl font-black mt-6 mb-3">$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p class="mb-3">')
            .replace(/^(.+)$/gm, (line) => line.startsWith('<') ? line : `<p class="mb-3">${line}</p>`);

    return (
        <Card>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <SectionLabel>/{page.slug}</SectionLabel>
                    <p className="text-xs text-[#86868b] -mt-2">
                        Last updated: {new Date(page.updated_at).toLocaleDateString()}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPreview(p => !p)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium border border-[#e5e5ea] text-[#52525b] hover:bg-[#f5f5f7] transition-colors"
                    >
                        {preview ? "Edit" : "Preview"}
                    </button>
                    <Button onClick={save} disabled={pending}>
                        {pending ? "Saving…" : "Save"}
                    </Button>
                </div>
            </div>

            <div className="space-y-3">
                <Field label="Page title">
                    <Input value={title} onChange={e => setTitle(e.target.value)} />
                </Field>

                {preview ? (
                    <div
                        className="min-h-[300px] p-4 rounded-md border border-[#e5e5ea] bg-[#fafafa] text-sm text-[#1d1d1f] prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: renderPreview(body) }}
                    />
                ) : (
                    <Field label="Content (Markdown)" hint="Supports # headings, **bold**, _italic_, and paragraph breaks.">
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            rows={18}
                            className="w-full px-3 py-2 rounded-md border border-[#e5e5ea] bg-white text-sm font-mono text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:border-[#0051e6] focus:ring-2 focus:ring-[#0051e6]/10 resize-y"
                        />
                    </Field>
                )}
            </div>
        </Card>
    );
}

export function ContentEditorClient({ pages }: { pages: ContentPage[] }) {
    const [activeSlug, setActiveSlug] = useState(pages[0]?.slug ?? "");
    const activePage = pages.find(p => p.slug === activeSlug);

    return (
        <div className="space-y-6">
            {/* Slug tabs */}
            <div className="flex gap-2 flex-wrap">
                {pages.map(p => (
                    <button
                        key={p.slug}
                        onClick={() => setActiveSlug(p.slug)}
                        className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            activeSlug === p.slug
                                ? "bg-[#0051e6] text-white"
                                : "bg-[#f5f5f7] text-[#52525b] hover:bg-[#e5e5ea]"
                        }`}
                    >
                        /{p.slug}
                    </button>
                ))}
            </div>

            {activePage && <Editor key={activePage.slug} page={activePage} />}
        </div>
    );
}
