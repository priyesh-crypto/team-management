"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSupportTicket } from "../actions-tier3";
import { Card, SectionLabel, Button, Field, Input, Select } from "../_components/ui";

export function NewTicketForm() {
    const [open, setOpen] = useState(false);
    const [orgId, setOrgId] = useState("");
    const [subject, setSubject] = useState("");
    const [priority, setPriority] = useState("normal");
    const [message, setMessage] = useState("");
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            try {
                const result = await createSupportTicket(orgId.trim(), subject, priority, message);
                toast.success("Ticket created");
                router.push(`/admin/support/${result.ticketId}`);
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
            }
        });
    }

    if (!open) {
        return (
            <Button onClick={() => setOpen(true)}>+ New ticket</Button>
        );
    }

    return (
        <Card>
            <SectionLabel>Create support ticket</SectionLabel>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Organization ID (UUID)">
                        <Input value={orgId} onChange={e => setOrgId(e.target.value)} placeholder="org UUID (optional)" />
                    </Field>
                    <Field label="Priority">
                        <Select value={priority} onChange={e => setPriority(e.target.value)}>
                            {["low", "normal", "high", "urgent"].map(p => (
                                <option key={p} value={p} className="capitalize">{p}</option>
                            ))}
                        </Select>
                    </Field>
                </div>
                <Field label="Subject">
                    <Input value={subject} onChange={e => setSubject(e.target.value)} required placeholder="e.g. Can't invite new member" />
                </Field>
                <Field label="Initial message">
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        required rows={4}
                        placeholder="Describe the issue…"
                        className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5ea] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0051e6]/20 resize-none bg-white"
                    />
                </Field>
                <div className="flex gap-2">
                    <Button type="submit" disabled={pending} className="flex-1">
                        {pending ? "Creating…" : "Create ticket"}
                    </Button>
                    <button type="button" onClick={() => setOpen(false)}
                        className="px-4 py-2 rounded-xl border border-[#e5e5ea] text-sm font-bold text-[#86868b] hover:bg-[#f5f5f7] transition-colors">
                        Cancel
                    </button>
                </div>
            </form>
        </Card>
    );
}
