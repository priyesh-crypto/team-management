"use client";

import React, { useState } from "react";
import { Send, CheckCircle2, Loader2 } from "lucide-react";
import { Form, FormField, submitForm } from "@/app/actions/forms";

interface Props {
    form: Form;
}

export function PublicFormRenderer({ form }: Props) {
    const [values, setValues] = useState<Record<string, unknown>>({});
    const [submitterName, setSubmitterName] = useState("");
    const [submitterEmail, setSubmitterEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function setValue(fieldId: string, val: unknown) {
        setValues(v => ({ ...v, [fieldId]: val }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            // Map field IDs to labels for readability
            const labeledFields: Record<string, unknown> = {};
            form.fields.forEach(f => { labeledFields[f.label] = values[f.id] ?? ""; });

            await submitForm(form.id, {
                submitter_name: submitterName || undefined,
                submitter_email: submitterEmail || undefined,
                fields: labeledFields,
            });
            setSubmitted(true);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    if (submitted) {
        return (
            <div className="px-8 py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={28} className="text-emerald-500" />
                </div>
                <h2 className="text-xl font-black text-[#1d1d1f] mb-2">Submitted!</h2>
                <p className="text-sm text-slate-500 leading-relaxed">{form.submit_message}</p>
            </div>
        );
    }

    const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0051e6]/20 transition-colors";

    function renderField(field: FormField) {
        switch (field.type) {
            case "text":
            case "email":
                return (
                    <input
                        type={field.type}
                        value={String(values[field.id] ?? "")}
                        onChange={e => setValue(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        className={inputClass}
                    />
                );
            case "textarea":
                return (
                    <textarea
                        value={String(values[field.id] ?? "")}
                        onChange={e => setValue(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        rows={4}
                        className={`${inputClass} resize-none`}
                    />
                );
            case "date":
                return (
                    <input
                        type="date"
                        value={String(values[field.id] ?? "")}
                        onChange={e => setValue(field.id, e.target.value)}
                        required={field.required}
                        className={inputClass}
                    />
                );
            case "select":
                return (
                    <select
                        value={String(values[field.id] ?? "")}
                        onChange={e => setValue(field.id, e.target.value)}
                        required={field.required}
                        className={inputClass}
                    >
                        <option value="">— select —</option>
                        {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                );
            case "checkbox":
                return (
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={Boolean(values[field.id])}
                            onChange={e => setValue(field.id, e.target.checked)}
                            className="w-5 h-5 rounded"
                        />
                        <span className="text-sm font-bold text-slate-700">{field.placeholder}</span>
                    </label>
                );
            default:
                return null;
        }
    }

    return (
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
            {/* Submitter info */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Your name</label>
                    <input
                        value={submitterName}
                        onChange={e => setSubmitterName(e.target.value)}
                        placeholder="Jane Smith"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Your email</label>
                    <input
                        type="email"
                        value={submitterEmail}
                        onChange={e => setSubmitterEmail(e.target.value)}
                        placeholder="jane@company.com"
                        className={inputClass}
                    />
                </div>
            </div>

            {/* Custom fields */}
            {form.fields.map(field => (
                <div key={field.id}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
                        {field.label}
                        {field.required && <span className="text-[#ff3b30] ml-0.5">*</span>}
                    </label>
                    {renderField(field)}
                </div>
            ))}

            {error && (
                <div className="px-4 py-3 rounded-xl bg-[#ff3b30]/10 text-[#ff3b30] text-sm font-bold">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0051e6] text-white font-black text-sm hover:bg-[#005bb7] disabled:opacity-50 transition-colors"
            >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {submitting ? "Submitting…" : "Submit request"}
            </button>

            <p className="text-center text-[10px] text-slate-400">
                Powered by <span className="font-black text-[#0051e6]">TaskFlow</span>
            </p>
        </form>
    );
}
