'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

function formatMoney(v) {
    if (v == null || v === '') return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return '—';
    return `AED ${Math.round(n).toLocaleString()}`;
}

function formatDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
}

export default function VehicleDispositionReviewModal({
    isOpen,
    onClose,
    onSuccess,
    assetMongoId,
    asset,
    mode,
}) {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);
    const [comment, setComment] = useState('');

    const wf = asset?.vehicleDispositionWorkflow || {};
    const target = String(wf.targetStatus || '').toLowerCase();
    const targetLabel = target === 'sold' ? 'Sold' : 'Total loss';

    if (!isOpen || !asset) return null;

    const rows = [
        { label: 'Requested status', value: targetLabel },
        { label: 'Requested by', value: wf.requestedByName || '—' },
        ...(target === 'sold' ? [{ label: 'Sold value', value: formatMoney(wf.soldValue) }] : []),
        ...(target === 'total loss'
            ? [{ label: 'Total loss value', value: formatMoney(wf.totalLossValue) }]
            : []),
        { label: 'Current loan', value: formatMoney(wf.currentLoanAmount) },
        ...(target === 'sold'
            ? [
                  { label: 'Registration expense', value: formatMoney(wf.registrationExpense) },
                  { label: 'Other expenses', value: formatMoney(wf.otherExpense) },
              ]
            : []),
        { label: 'Balance in hand', value: formatMoney(wf.balanceInHand) },
        ...(target === 'total loss' ? [{ label: 'Registration expiry', value: formatDate(wf.registrationExpiryDate) }] : []),
        ...(wf.note ? [{ label: 'Note', value: wf.note }] : []),
    ];

    const runHr = async (action) => {
        setBusy(true);
        try {
            await axiosInstance.post(`/AssetItem/${assetMongoId}/respond-vehicle-disposition-hr`, {
                action,
                comment: comment.trim(),
            });
            toast({
                title: action === 'approve' ? 'Approved' : 'Rejected',
                description:
                    action === 'approve'
                        ? 'Accounts and Management have been notified.'
                        : 'The requester has been notified.',
            });
            onSuccess?.();
            onClose();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Action failed.',
            });
        } finally {
            setBusy(false);
        }
    };

    const runFinance = async () => {
        setBusy(true);
        try {
            const res = await axiosInstance.post(`/AssetItem/${assetMongoId}/submit-vehicle-disposition-finance`, {
                role: mode === 'accounts' ? 'accounts' : 'management',
            });
            toast({
                title: res.data?.finalized ? 'Disposition complete' : 'Submitted',
                description:
                    res.data?.message ||
                    (res.data?.finalized
                        ? 'Vehicle status has been updated.'
                        : 'Waiting for the other department to complete their step.'),
            });
            onSuccess?.();
            onClose();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Submit failed.',
            });
        } finally {
            setBusy(false);
        }
    };

    const title =
        mode === 'hr'
            ? `Disposition review — ${targetLabel}`
            : mode === 'accounts'
              ? `Disposition — Accounts (${targetLabel})`
              : `Disposition — Management (${targetLabel})`;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />
            <div className="relative bg-white rounded-[22px] shadow-xl w-full max-w-[560px] max-h-[90vh] flex flex-col p-6 md:p-8">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[20px] font-semibold text-gray-800">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-0 text-gray-400 hover:text-gray-600"
                        disabled={busy}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 pt-4 space-y-3 modal-scroll">
                    <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                        {rows.map((r) => (
                            <div key={r.label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                                <span className="font-semibold text-slate-600">{r.label}</span>
                                <span className="text-slate-800 text-right">{r.value}</span>
                            </div>
                        ))}
                    </div>
                    {mode === 'hr' && (
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-bold text-slate-500 uppercase">Comment (optional)</label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                                disabled={busy}
                            />
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="px-5 h-10 rounded-xl border border-slate-200 text-sm font-bold text-slate-500"
                    >
                        Close
                    </button>
                    {mode === 'hr' && (
                        <>
                            <button
                                type="button"
                                onClick={() => runHr('reject')}
                                disabled={busy}
                                className="px-5 h-10 rounded-xl bg-red-50 text-red-700 text-sm font-bold border border-red-200"
                            >
                                Reject
                            </button>
                            <button
                                type="button"
                                onClick={() => runHr('approve')}
                                disabled={busy}
                                className="px-6 h-10 rounded-xl bg-emerald-600 text-white text-sm font-bold"
                            >
                                Accept
                            </button>
                        </>
                    )}
                    {(mode === 'accounts' || mode === 'management') && (
                        <button
                            type="button"
                            onClick={runFinance}
                            disabled={busy}
                            className="px-6 h-10 rounded-xl bg-blue-600 text-white text-sm font-bold"
                        >
                            Submit
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
