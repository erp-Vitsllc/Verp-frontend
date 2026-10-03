'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import axiosInstance from '@/utils/axios';

export default function CompOffRequestModal({ open, onClose, onSent }) {
    const [date, setDate] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setDate('');
        setReason('');
        setError('');
        setSaving(false);
    }, [open]);

    if (!open) return null;

    async function submit(event) {
        event.preventDefault();
        if (!date) {
            setError('Select the comp-off date.');
            return;
        }
        if (!reason.trim()) {
            setError('Reason is required.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await axiosInstance.post(
                '/Attendance/me/compoff-request',
                { date, reason: reason.trim() },
                { skipToast: true },
            );
            onSent?.();
            onClose?.();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not send the comp-off request.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-slate-900/35" aria-label="Close" onClick={onClose} disabled={saving} />
            <form onSubmit={submit} className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Request comp-off leave</h2>
                        <p className="text-sm text-slate-500 mt-1">Choose the date. Your primary reportee approves it.</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={saving} className="p-2 rounded-lg text-slate-400 hover:bg-slate-50" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>
                <div className="px-5 py-4 space-y-4">
                    <label className="block">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Date</span>
                        <input
                            type="date"
                            value={date}
                            onChange={(event) => setDate(event.target.value)}
                            required
                            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                        />
                    </label>
                    <label className="block">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Reason</span>
                        <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={3}
                            required
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                        />
                    </label>
                    {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                </div>
                <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
                    <button type="button" onClick={onClose} disabled={saving} className="h-10 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600">
                        Close
                    </button>
                    <button type="submit" disabled={saving} className="h-10 px-4 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50">
                        {saving ? 'Sending…' : 'Send request'}
                    </button>
                </div>
            </form>
        </div>
    );
}
