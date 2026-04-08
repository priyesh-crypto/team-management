'use client';

import React from 'react';

type DataCategory = {
    category: string;
    examples: string;
    lawfulBasis: string;
    retentionLabel: string;
    retentionDays: number;
};

const DATA_CATEGORIES: DataCategory[] = [
    {
        category: 'Account profile',
        examples: 'Name, role',
        lawfulBasis: 'Contract',
        retentionLabel: 'Until account deleted',
        retentionDays: 0,
    },
    {
        category: 'Tasks you own',
        examples: 'Title, notes, deadline, priority',
        lawfulBasis: 'Contract',
        retentionLabel: '2 years after completion',
        retentionDays: 730,
    },
    {
        category: 'Task comments',
        examples: 'Message content, timestamp',
        lawfulBasis: 'Contract',
        retentionLabel: 'Until task deleted',
        retentionDays: 0,
    },
    {
        category: 'File attachments',
        examples: 'Filename, uploader, file type',
        lawfulBasis: 'Contract',
        retentionLabel: 'Until task deleted',
        retentionDays: 0,
    },
    {
        category: 'Activity audit log',
        examples: 'Actions performed, IP address',
        lawfulBasis: 'Legitimate interest',
        retentionLabel: '1 year',
        retentionDays: 365,
    },
    {
        category: 'Digest preferences',
        examples: 'Email, Slack ID, timezone, schedule',
        lawfulBasis: 'Consent',
        retentionLabel: 'Until consent withdrawn',
        retentionDays: 0,
    },
];

const BASIS_COLORS: Record<string, string> = {
    'Contract':            'bg-blue-50 text-blue-600',
    'Legitimate interest': 'bg-amber-50 text-amber-600',
    'Consent':             'bg-emerald-50 text-emerald-600',
};

export function DataSummaryTable() {
    return (
        <div className="space-y-3">
            <p className="text-[11px] text-[#86868b] font-medium leading-relaxed">
                The table below shows every category of personal data we hold about you,
                why we hold it, and how long we keep it.
            </p>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-hidden rounded-2xl border border-[#eceef0]">
                <table className="w-full text-[11px]">
                    <thead>
                        <tr className="bg-[#f5f5f7] border-b border-[#eceef0]">
                            <th className="text-left px-4 py-3 font-black text-[9px] uppercase tracking-[0.25em] text-[#86868b]">Data</th>
                            <th className="text-left px-4 py-3 font-black text-[9px] uppercase tracking-[0.25em] text-[#86868b]">Examples</th>
                            <th className="text-left px-4 py-3 font-black text-[9px] uppercase tracking-[0.25em] text-[#86868b]">Lawful basis</th>
                            <th className="text-left px-4 py-3 font-black text-[9px] uppercase tracking-[0.25em] text-[#86868b]">Kept for</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f2]">
                        {DATA_CATEGORIES.map((row) => (
                            <tr key={row.category} className="bg-white hover:bg-[#fafafa] transition-colors">
                                <td className="px-4 py-3 font-bold text-[#1d1d1f]">{row.category}</td>
                                <td className="px-4 py-3 text-[#86868b]">{row.examples}</td>
                                <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${BASIS_COLORS[row.lawfulBasis]}`}>
                                        {row.lawfulBasis}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-[#86868b]">{row.retentionLabel}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden space-y-2">
                {DATA_CATEGORIES.map((row) => (
                    <div key={row.category} className="rounded-2xl border border-[#eceef0] bg-white p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-[12px] text-[#1d1d1f]">{row.category}</span>
                            <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${BASIS_COLORS[row.lawfulBasis]}`}>
                                {row.lawfulBasis}
                            </span>
                        </div>
                        <p className="text-[11px] text-[#86868b]">{row.examples}</p>
                        <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">
                            Kept for: <span className="normal-case font-medium">{row.retentionLabel}</span>
                        </p>
                    </div>
                ))}
            </div>

            <p className="text-[10px] text-[#86868b] pt-1">
                Processing is carried out under GDPR Art. 6. To request a correction, email us directly.
            </p>
        </div>
    );
}
