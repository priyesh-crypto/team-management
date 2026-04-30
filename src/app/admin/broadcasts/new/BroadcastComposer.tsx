"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createBroadcast } from "../../actions-tier2";
import { Card, SectionLabel, Button, Field, Input } from "../../_components/ui";

const PLANS = ["free", "pro", "business"];

export function BroadcastComposer() {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [targetAll, setTargetAll] = useState(true);
    const [targetPlans, setTargetPlans] = useState<string[]>([]);
    const [minSeats, setMinSeats] = useState("");
    const [channels, setChannels] = useState<string[]>(["in_app"]);
    const [sendNow, setSendNow] = useState(true);
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    function togglePlan(plan: string) {
        setTargetPlans(prev => prev.includes(plan) ? prev.filter(p => p !== plan) : [...prev, plan]);
    }

    function toggleChannel(ch: string) {
        setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (channels.length === 0) { toast.error("Select at least one channel."); return; }

        const target = targetAll
            ? { all: true }
            : {
                plans: targetPlans.length > 0 ? targetPlans : undefined,
                min_seats: minSeats ? parseInt(minSeats) : undefined,
            };

        startTransition(async () => {
            try {
                const result = await createBroadcast(title, body, target, channels, sendNow);
                if (sendNow) {
                    if (result.recipients === 0) {
                        toast.error(`Sent — but 0 recipients matched (${result.orgsTargeted} orgs targeted but they have no members).`);
                    } else {
                        toast.success(`Sent to ${result.recipients} user${result.recipients !== 1 ? "s" : ""} across ${result.orgsTargeted} org${result.orgsTargeted !== 1 ? "s" : ""}.`);
                    }
                } else {
                    toast.success("Draft saved");
                }
                router.push("/admin/broadcasts");
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <Card>
                <SectionLabel>Content</SectionLabel>
                <div className="space-y-3">
                    <Field label="Title">
                        <Input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            placeholder="e.g. New feature: Milestones are here!"
                        />
                    </Field>
                    <Field label="Body">
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            required
                            rows={4}
                            placeholder="Write your announcement..."
                            className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5ea] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0c64ef]/20 resize-none bg-white"
                        />
                    </Field>
                </div>
            </Card>

            <Card>
                <SectionLabel>Audience</SectionLabel>
                <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={targetAll}
                            onChange={e => setTargetAll(e.target.checked)}
                            className="w-4 h-4 rounded accent-[#0c64ef]"
                        />
                        <span className="text-sm font-bold text-[#1d1d1f]">All organizations</span>
                    </label>

                    {!targetAll && (
                        <div className="space-y-3 pl-7">
                            <div>
                                <p className="text-[10px] font-black text-[#86868b] uppercase tracking-wider mb-2">Filter by plan</p>
                                <div className="flex gap-2">
                                    {PLANS.map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => togglePlan(p)}
                                            className={`px-3 py-1.5 rounded-xl text-[11px] font-black capitalize transition-colors ${
                                                targetPlans.includes(p)
                                                    ? "bg-[#0c64ef] text-white"
                                                    : "bg-[#f5f5f7] text-[#86868b] hover:bg-[#e5e5ea]"
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <Field label="Minimum seats (optional)">
                                <Input
                                    type="number"
                                    min={1}
                                    value={minSeats}
                                    onChange={e => setMinSeats(e.target.value)}
                                    placeholder="e.g. 5"
                                />
                            </Field>
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <SectionLabel>Delivery channels</SectionLabel>
                <div className="flex gap-3">
                    {[
                        { id: "in_app", label: "🔔 In-app notification" },
                    ].map(({ id, label }) => (
                        <label key={id} className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={channels.includes(id)}
                                onChange={() => toggleChannel(id)}
                                className="w-4 h-4 rounded accent-[#0c64ef]"
                            />
                            <span className="text-sm font-bold text-[#1d1d1f]">{label}</span>
                        </label>
                    ))}
                </div>
                <p className="text-[10px] text-[#86868b] mt-2">
                    In-app creates a notification in each matched user&apos;s inbox.
                </p>
            </Card>

            <Card>
                <SectionLabel>Send options</SectionLabel>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={sendNow} onChange={() => setSendNow(true)} className="accent-[#0c64ef]" />
                        <span className="text-sm font-bold text-[#1d1d1f]">Send now</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={!sendNow} onChange={() => setSendNow(false)} className="accent-[#0c64ef]" />
                        <span className="text-sm font-bold text-[#1d1d1f]">Save as draft</span>
                    </label>
                </div>
            </Card>

            <div className="flex gap-3">
                <Button type="submit" disabled={pending} className="flex-1">
                    {pending ? "Sending…" : sendNow ? "Send broadcast" : "Save draft"}
                </Button>
                <button
                    type="button"
                    onClick={() => router.push("/admin/broadcasts")}
                    className="px-4 py-2.5 rounded-xl border border-[#e5e5ea] text-sm font-bold text-[#86868b] hover:bg-[#f5f5f7] transition-colors"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
