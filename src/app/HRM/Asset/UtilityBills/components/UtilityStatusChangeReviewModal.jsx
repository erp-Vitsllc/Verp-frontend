'use client';

import { useEffect, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { openUtilityAttachment } from '../utils/openUtilityAttachment';

/**
 * HR review modal for utility activate / deactivate requests.
 */
export default function UtilityStatusChangeReviewModal({
    isOpen,
    requestId,
    onClose,
    onResolved,
}) {
    const [request, setRequest] = useState(null);
    const [canRespond, setCanRespond] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [comment, setComment] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen || !requestId) return;
        let cancelled = false;
        setLoading(true);
        setError('');
        setComment('');
        axiosInstance
            .get(`/UtilityBill/status-change/${encodeURIComponent(String(requestId))}`, {
                skipToast: true,
            })
            .then((res) => {
                if (cancelled) return;
                setRequest(res.data?.request || null);
                setCanRespond(Boolean(res.data?.canRespond));
            })
            .catch((err) => {
                if (cancelled) return;
                setRequest(null);
                setError(err?.response?.data?.message || 'Could not load request.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, requestId]);

    if (!isOpen) return null;

    const label =
        request?.requestedStatus === 'Active' ? 'Activation' : 'Deactivation';

    const handleRespond = async (decision) => {
        if (!requestId) return;
        setSaving(true);
        setError('');
        try {
            const res = await axiosInstance.put(
                `/UtilityBill/status-change/${encodeURIComponent(String(requestId))}/respond`,
                { decision, comment: comment.trim() },
            );
            onResolved?.(res.data || {});
            onClose?.();
        } catch (err) {
            setError(err?.response?.data?.message || 'Action failed.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100 shrink-0">
                    <h2 className="text-lg font-bold text-gray-800">
                        Utility {label} Review
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-4 sm:px-5 py-4 overflow-y-auto flex-1 space-y-4">
                    {loading ? (
                        <p className="text-sm text-gray-500 text-center py-6">Loading…</p>
                    ) : !request ? (
                        <p className="text-sm text-red-600 text-center py-6">
                            {error || 'Request not found.'}
                        </p>
                    ) : (
                        <>
                            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-3 text-sm space-y-1.5">
                                <p>
                                    <span className="text-gray-500">Type:</span>{' '}
                                    <span className="font-semibold text-gray-800">
                                        {request.utilityType || '—'}
                                    </span>
                                </p>
                                <p>
                                    <span className="text-gray-500">Account:</span>{' '}
                                    <span className="font-semibold text-gray-800">
                                        {request.accountNo || '—'}
                                    </span>
                                </p>
                                <p>
                                    <span className="text-gray-500">Change:</span>{' '}
                                    <span className="font-semibold text-gray-800">
                                        {request.currentStatus} → {request.requestedStatus}
                                    </span>
                                </p>
                                <p>
                                    <span className="text-gray-500">Requested by:</span>{' '}
                                    <span className="font-semibold text-gray-800">
                                        {request.requestedByName || '—'}
                                    </span>
                                </p>
                                <p>
                                    <span className="text-gray-500">Status:</span>{' '}
                                    <span className="font-semibold text-gray-800">
                                        {request.status}
                                    </span>
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                                    Reason
                                </p>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap rounded-lg border border-gray-100 bg-white px-3 py-2">
                                    {request.reason || '—'}
                                </p>
                            </div>

                            {request.attachment?.name ? (
                                <button
                                    type="button"
                                    onClick={() => openUtilityAttachment(request.attachment)}
                                    className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800"
                                >
                                    <Paperclip size={14} />
                                    {request.attachment.name}
                                </button>
                            ) : null}

                            {canRespond ? (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        HR comment (optional)
                                    </label>
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        rows={2}
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                                        disabled={saving}
                                    />
                                </div>
                            ) : null}

                            {error ? (
                                <p className="text-sm text-red-600 font-medium">{error}</p>
                            ) : null}
                        </>
                    )}
                </div>

                {request && canRespond ? (
                    <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50/80 shrink-0">
                        <button
                            type="button"
                            onClick={() => handleRespond('reject')}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60"
                        >
                            {saving ? '…' : 'Reject'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleRespond('approve')}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60"
                        >
                            {saving ? '…' : 'Approve'}
                        </button>
                    </div>
                ) : (
                    <div className="flex justify-end px-4 sm:px-5 py-3 border-t border-gray-100 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
