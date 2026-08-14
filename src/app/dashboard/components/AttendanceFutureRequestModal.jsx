'use client';

import { useEffect, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';

const CATEGORY_OPTIONS = [
    { key: 'leave', label: 'Leave' },
    { key: 'late_early', label: 'Late arrival / Early go' },
];

const LATE_EARLY_OPTIONS = [
    { key: 'late_arrived', label: 'Late arrival' },
    { key: 'early_go', label: 'Early go' },
];

export default function AttendanceFutureRequestModal({
    isOpen,
    dateKey,
    earliestDate = '',
    submitting = false,
    error = '',
    onClose,
    onSubmit,
}) {
    const fileRef = useRef(null);
    const [category, setCategory] = useState('');
    const [lateEarlyKind, setLateEarlyKind] = useState('');
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setCategory('');
        setLateEarlyKind('');
        setReason('');
        setAttachment(null);
        setLocalError('');
    }, [isOpen, dateKey]);

    if (!isOpen) return null;

    const showDetails = category === 'leave' || (category === 'late_early' && lateEarlyKind);
    const kind = category === 'leave' ? 'leave' : lateEarlyKind;

    const handleClose = () => {
        if (submitting) return;
        onClose?.();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!category) {
            setLocalError('Choose Leave or Late arrival / Early go.');
            return;
        }
        if (category === 'late_early' && !lateEarlyKind) {
            setLocalError('Choose Late arrival or Early go.');
            return;
        }
        const trimmed = String(reason || '').trim();
        if (!trimmed) {
            setLocalError('Description is required.');
            return;
        }
        if (!attachment?.name) {
            setLocalError('Attachment is required.');
            return;
        }
        setLocalError('');
        onSubmit?.({
            kind,
            reason: trimmed,
            attachmentName: attachment.name,
        });
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
                aria-label="Close"
                onClick={handleClose}
                disabled={submitting}
            />
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                            Request for a future day
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">{dateKey}</p>
                        {earliestDate ? (
                            <p className="text-xs text-slate-400 mt-1">
                                Earliest allowed date is {earliestDate} (not tomorrow; holidays and
                                weekly offs are skipped).
                            </p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                    <label className="block">
                        <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Request type
                        </span>
                        <select
                            value={category}
                            onChange={(e) => {
                                setCategory(e.target.value);
                                setLateEarlyKind('');
                                setLocalError('');
                            }}
                            disabled={submitting}
                            className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                        >
                            <option value="">Select…</option>
                            {CATEGORY_OPTIONS.map((opt) => (
                                <option key={opt.key} value={opt.key}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    {category === 'late_early' ? (
                        <label className="block">
                            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Late arrival or Early go
                            </span>
                            <select
                                value={lateEarlyKind}
                                onChange={(e) => {
                                    setLateEarlyKind(e.target.value);
                                    setLocalError('');
                                }}
                                disabled={submitting}
                                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                            >
                                <option value="">Select…</option>
                                {LATE_EARLY_OPTIONS.map((opt) => (
                                    <option key={opt.key} value={opt.key}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}

                    {showDetails ? (
                        <>
                            <label className="block">
                                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                    Description
                                </span>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    required
                                    placeholder="Briefly explain this request…"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-y min-h-[88px]"
                                />
                            </label>

                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                    Attachment
                                </span>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    className="w-full flex items-center gap-3 h-12 px-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-400 transition-colors text-left"
                                >
                                    <span className="h-8 w-8 rounded-lg bg-white border border-slate-200 inline-flex items-center justify-center text-slate-500 shrink-0">
                                        <Paperclip size={15} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-medium text-slate-800 truncate">
                                            {attachment ? attachment.name : 'Choose a file'}
                                        </span>
                                        <span className="block text-xs text-slate-400 mt-0.5">
                                            {attachment
                                                ? 'Click to change'
                                                : 'Required · PDF, image, or document'}
                                        </span>
                                    </span>
                                </button>
                            </div>
                        </>
                    ) : null}

                    {localError || error ? (
                        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                            {localError || error}
                        </p>
                    ) : null}

                    <div className="flex items-center gap-2.5 pt-1 pb-1">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={handleClose}
                            className="flex-1 h-11 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !showDetails}
                            className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                        >
                            {submitting ? 'Sending…' : 'Send to reportee'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
