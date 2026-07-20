'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import axiosInstance from '@/utils/axios';

function humanizeType(value) {
    return String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase())
        .trim();
}

function activityTitle(item) {
    const description = String(item?.description || '').trim();
    if (description) return description;
    const operation = humanizeType(item?.operationType);
    const txn = humanizeType(item?.transactionType);
    if (operation && txn) return `${operation} ${txn}`;
    return operation || txn || 'Activity';
}

export default function BillActivityPanel({ billId }) {
    const id = String(billId || '').trim();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);

    const loadActivity = useCallback(async () => {
        if (!id) {
            setActivities([]);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get(
                `/zoho/bills/${encodeURIComponent(id)}/comments`,
                { skipToast: true, timeout: 60000 },
            );
            setActivities(Array.isArray(response?.data?.data) ? response.data.data : []);
        } catch (err) {
            setActivities([]);
            setError(
                err?.response?.data?.message ||
                    err?.message ||
                    'Failed to load bill comments & history',
            );
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void loadActivity();
    }, [loadActivity]);

    const handleAddComment = async (event) => {
        event.preventDefault();
        const text = String(comment || '').trim();
        if (!id || !text || saving) return;

        setSaving(true);
        setError('');
        try {
            await axiosInstance.post(
                `/zoho/bills/${encodeURIComponent(id)}/comments`,
                { description: text },
                { skipToast: true },
            );
            setComment('');
            await loadActivity();
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to add comment');
        } finally {
            setSaving(false);
        }
    };

    if (!id) return null;

    return (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Comments & History</h3>
                <p className="text-xs text-slate-500">
                    Internal notes and Zoho activity for this bill.
                </p>
            </div>

            <div className="space-y-4 px-4 py-4">
                <form onSubmit={handleAddComment} className="space-y-2">
                    <textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        rows={3}
                        placeholder="Add a comment…"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                        disabled={saving}
                    />
                    <button
                        type="submit"
                        disabled={!comment.trim() || saving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Add Comment
                    </button>
                </form>

                {error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {error}
                    </div>
                ) : null}

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                        <Loader2 size={16} className="animate-spin" />
                        Loading history…
                    </div>
                ) : !activities.length ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                        No comments or history yet.
                    </div>
                ) : (
                    <ol className="relative ml-2 space-y-0 border-l border-slate-200">
                        {activities.map((item, index) => (
                            <li
                                key={item.id || `${item.date}-${index}`}
                                className="relative pb-5 pl-5 last:pb-0"
                            >
                                <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500 shadow" />
                                <p className="text-sm font-semibold leading-snug text-slate-800">
                                    {activityTitle(item)}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                    {[item.commentedBy, item.dateDescription || item.date, item.time]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
}
