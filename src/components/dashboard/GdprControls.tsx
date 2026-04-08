'use client';

import React, { useEffect, useState } from 'react';
import { Download, Trash2, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import {
    requestDataExport,
    requestAccountDeletion,
    getMyGdprRequests,
    type GdprRequest,
} from '@/app/actions/actions';

// ─── Export button ────────────────────────────────────────────────────────────

export function RequestExportButton() {
    const [loading, setLoading]           = useState(false);
    const [latest, setLatest]             = useState<GdprRequest | null>(null);
    const [initialising, setInitialising] = useState(true);

    // Load the most recent export request on mount
    useEffect(() => {
        getMyGdprRequests()
            .then((requests) => {
                const exportRequests = requests.filter((r) => r.type === 'export');
                setLatest(exportRequests[0] ?? null);
            })
            .catch(() => {})
            .finally(() => setInitialising(false));
    }, []);

    const handleRequest = async () => {
        setLoading(true);
        try {
            const result = await requestDataExport();
            setLatest(result);
            toast.success('Export ready — click the download link.');
        } catch (err: any) {
            toast.error(err.message ?? 'Export failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (initialising) {
        return (
            <div className="flex items-center gap-2 text-[11px] text-[#86868b]">
                <Loader2 size={14} className="animate-spin" />
                <span>Checking export status…</span>
            </div>
        );
    }

    // Show status card when there's a recent request
    if (latest) {
        return (
            <div className="space-y-3">
                <ExportStatusCard request={latest} />
                {/* Allow a fresh export if the previous one failed or the link has likely expired */}
                {(latest.status === 'failed' || latest.status === 'completed') && (
                    <button
                        onClick={handleRequest}
                        disabled={loading}
                        className="text-[10px] font-black uppercase tracking-widest text-[#0c64ef] hover:underline disabled:opacity-50 flex items-center gap-1"
                    >
                        {loading ? <><Loader2 size={12} className="animate-spin" /> Preparing…</> : 'Request a new export'}
                    </button>
                )}
            </div>
        );
    }

    return (
        <button
            onClick={handleRequest}
            disabled={loading}
            className="flex items-center gap-2 h-10 px-5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[10px] font-black uppercase tracking-widest text-[#1d1d1f] hover:bg-[#e5e5ea] transition-colors disabled:opacity-50"
        >
            {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Preparing…</>
            ) : (
                <><Download size={14} /> Request export</>
            )}
        </button>
    );
}

function ExportStatusCard({ request }: { request: GdprRequest }) {
    const statusConfig = {
        pending:    { icon: Clock,        color: 'text-amber-500',  bg: 'bg-amber-50',   label: 'Queued' },
        processing: { icon: Loader2,      color: 'text-blue-500',   bg: 'bg-blue-50',    label: 'Preparing…' },
        completed:  { icon: CheckCircle,  color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Ready' },
        failed:     { icon: AlertCircle,  color: 'text-red-500',    bg: 'bg-red-50',     label: 'Failed' },
    } as const;

    const cfg  = statusConfig[request.status];
    const Icon = cfg.icon;
    const date = new Date(request.requested_at).toLocaleDateString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric',
    });

    return (
        <div className={`flex items-start gap-3 rounded-2xl p-4 ${cfg.bg}`}>
            <Icon
                size={16}
                className={`mt-0.5 shrink-0 ${cfg.color} ${request.status === 'processing' ? 'animate-spin' : ''}`}
            />
            <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-black uppercase tracking-widest ${cfg.color}`}>
                    {cfg.label}
                </p>
                <p className="text-[11px] text-[#86868b] mt-0.5">Requested {date}</p>
                {request.status === 'completed' && request.download_url && (
                    <a
                        href={request.download_url}
                        download={`my-data-export.json`}
                        className="inline-flex items-center gap-1 mt-2 text-[10px] font-black uppercase tracking-widest text-[#0c64ef] hover:underline"
                    >
                        <Download size={12} /> Download JSON
                    </a>
                )}
                {request.status === 'failed' && request.notes && (
                    <p className="text-[11px] text-red-500 mt-1">{request.notes}</p>
                )}
            </div>
        </div>
    );
}

// ─── Deletion button ──────────────────────────────────────────────────────────

export function RequestDeletionButton() {
    const [modalOpen, setModalOpen] = useState(false);
    const [loading, setLoading]     = useState(false);
    const [pending, setPending]     = useState(false);

    // Check whether a deletion request already exists
    useEffect(() => {
        getMyGdprRequests()
            .then((requests) => {
                const del = requests.find(
                    (r) => r.type === 'delete' && ['pending', 'processing'].includes(r.status)
                );
                setPending(!!del);
            })
            .catch(() => {});
    }, []);

    const handleDelete = async () => {
        setLoading(true);
        try {
            await requestAccountDeletion();
            // User is now deleted — redirect to sign-in
            toast.success('Your account has been scheduled for deletion.');
            // Small delay so the toast is visible, then redirect
            setTimeout(() => { window.location.href = '/auth'; }, 1500);
        } catch (err: any) {
            toast.error(err.message ?? 'Deletion failed. Please try again.');
            setLoading(false);
            setModalOpen(false);
        }
    };

    if (pending) {
        return (
            <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[11px] text-amber-600 font-bold">
                <Clock size={14} />
                A deletion request is in progress. You will be notified when complete.
            </div>
        );
    }

    return (
        <>
            <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 h-10 px-5 rounded-xl bg-red-50 border border-red-100 text-[10px] font-black uppercase tracking-widest text-[#ff3b30] hover:bg-red-100 transition-colors"
            >
                <Trash2 size={14} /> Delete my account
            </button>

            <ConfirmationModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete your account"
                description={
                    <span>
                        Your personal details will be anonymised within minutes. Tasks and
                        comments you created will remain visible to your team but attributed to{' '}
                        <strong>"Deleted User"</strong>.<br /><br />
                        <strong>This cannot be undone.</strong>
                    </span>
                }
                confirmText="Yes, delete my account"
                cancelText="Cancel"
                variant="danger"
                isLoading={loading}
            />
        </>
    );
}
