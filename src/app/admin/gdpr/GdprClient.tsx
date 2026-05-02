"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package, Lock, AlertTriangle } from "lucide-react";
import { initiateGdprExport, anonymizeUser } from "../actions-tier3";
import { Card, SectionLabel, Button, Field, Input } from "../_components/ui";

export function GdprClient() {
    const [orgId, setOrgId] = useState("");
    const [userId, setUserId] = useState("");
    const [notes, setNotes] = useState("");
    const [action, setAction] = useState<"export" | "anonymize">("export");
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!orgId.trim() || !userId.trim()) {
            toast.error("Org ID and User ID are required.");
            return;
        }
        if (action === "anonymize") {
            if (!confirm(`Permanently anonymize user ${userId}? This replaces their name and email with placeholder values and cannot be undone.`)) return;
        }

        startTransition(async () => {
            try {
                if (action === "export") {
                    const result = await initiateGdprExport(orgId.trim(), userId.trim(), notes);
                    if (result.fileUrl) {
                        window.open(result.fileUrl, "_blank");
                        toast.success("Export ready — opening download link");
                    } else {
                        toast.success("Export completed (no storage configured — check server logs)");
                    }
                } else {
                    await anonymizeUser(orgId.trim(), userId.trim(), notes);
                    toast.success("User anonymized successfully");
                }
                setOrgId(""); setUserId(""); setNotes("");
                router.refresh();
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
            }
        });
    }

    return (
        <Card>
            <SectionLabel>New GDPR request</SectionLabel>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-4">
                    {(["export", "anonymize"] as const).map(t => (
                        <label key={t} className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                checked={action === t}
                                onChange={() => setAction(t)}
                                className="accent-[#0c64ef]"
                            />
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1d1d1f]">
                                {t === "export" ? <Package size={14} strokeWidth={2} /> : <Lock size={14} strokeWidth={2} />}
                                {t === "export" ? "Data export" : "Anonymize (right to be forgotten)"}
                            </span>
                        </label>
                    ))}
                </div>

                {action === "anonymize" && (
                    <div className="bg-red-50 border border-red-100 rounded-md px-3 py-2.5 text-xs text-red-800">
                        <p className="inline-flex items-center gap-1.5 font-medium mb-1">
                            <AlertTriangle size={12} strokeWidth={2} />
                            Irreversible action
                        </p>
                        <p>This replaces the user&apos;s name with a placeholder and changes their auth email to an anonymous address. Task data and comments are retained (content only, no PII). The request is logged in the audit trail.</p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Organization ID (UUID)">
                        <Input
                            value={orgId}
                            onChange={e => setOrgId(e.target.value)}
                            required
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        />
                    </Field>
                    <Field label="User ID (UUID)">
                        <Input
                            value={userId}
                            onChange={e => setUserId(e.target.value)}
                            required
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        />
                    </Field>
                </div>

                <Field label="Notes (optional — internal only)">
                    <Input
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="e.g. Customer emailed support on 2026-04-30 requesting deletion"
                    />
                </Field>

                <Button
                    type="submit"
                    disabled={pending}
                    variant={action === "anonymize" ? "danger" : "primary"}
                    className="w-full"
                >
                    {pending
                        ? action === "export" ? "Generating export…" : "Anonymizing…"
                        : action === "export" ? "Generate data export" : "Anonymize user"}
                </Button>
            </form>
        </Card>
    );
}
