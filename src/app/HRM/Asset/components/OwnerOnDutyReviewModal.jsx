'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, Loader2, Package } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { getParkingEndDate, getRemainingDaysUntil, formatRemainingDaysLabel } from '@/utils/assetStatusHelpers';

export default function OwnerOnDutyReviewModal({
    isOpen,
    onClose,
    dashboardActionId,
    onCompleted,
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [review, setReview] = useState(null);
    const [checked, setChecked] = useState({});
    const [reasons, setReasons] = useState({});

    const load = useCallback(async () => {
        if (!dashboardActionId) return;
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/AssetItem/owner-on-duty/review/${dashboardActionId}`);
            setReview(res.data);
            const initialChecked = {};
            const assets = res.data?.assets || [];
            assets.forEach((a) => {
                const id = String(a._id);
                initialChecked[id] =
                    res.data?.triggerAssetId && String(res.data.triggerAssetId) === id
                        ? true
                        : assets.length === 1;
            });
            setChecked(initialChecked);
            setReasons({});
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Could not load review',
                description: e?.response?.data?.message || e.message,
            });
            onClose?.();
        } finally {
            setLoading(false);
        }
    }, [dashboardActionId, onClose, toast]);

    useEffect(() => {
        if (!isOpen || !dashboardActionId) return;
        load();
    }, [isOpen, dashboardActionId, load]);

    const assets = review?.assets || [];

    const allChecked = useMemo(
        () => assets.length > 0 && assets.every((a) => checked[String(a._id)]),
        [assets, checked],
    );

    const toggleAll = (value) => {
        const next = {};
        assets.forEach((a) => {
            next[String(a._id)] = value;
        });
        setChecked(next);
        if (value) setReasons({});
    };

    const handleSubmit = async () => {
        if (!dashboardActionId) return;
        const decisions = assets.map((a) => {
            const id = String(a._id);
            const accept = !!checked[id];
            return {
                assetId: id,
                accept,
                reason: accept ? undefined : String(reasons[id] || '').trim(),
            };
        });

        setSubmitting(true);
        try {
            const res = await axiosInstance.put('/AssetItem/owner-on-duty/respond', {
                dashboardActionId,
                decisions,
            });
            toast({
                title: 'Submitted',
                description: res.data?.message || 'On duty review completed.',
            });
            onCompleted?.(res.data);
            onClose?.();
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Submit failed',
                description: e?.response?.data?.message || e.message,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDismiss = () => {
        onClose?.();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[230] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">Confirm on duty</h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Select parked assets you are ready to take on duty. Unchecked assets need a reason and stay on leave.
                        </p>
                    </div>
                    <button type="button" onClick={handleDismiss} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                            <Loader2 className="animate-spin" size={20} />
                            Loading parked assets…
                        </div>
                    ) : assets.length === 0 ? (
                        <p className="text-center text-slate-500 py-12">No parked assets found for this request.</p>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {assets.length} asset(s) on leave
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => toggleAll(true)}
                                        className="text-xs font-bold text-emerald-700 hover:underline"
                                    >
                                        Select all
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                        type="button"
                                        onClick={() => toggleAll(false)}
                                        className="text-xs font-bold text-slate-600 hover:underline"
                                    >
                                        Clear all
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {assets.map((asset) => {
                                    const id = String(asset._id);
                                    const isChecked = !!checked[id];
                                    const remaining = formatRemainingDaysLabel(
                                        getRemainingDaysUntil(getParkingEndDate(asset)),
                                    );
                                    return (
                                        <div
                                            key={id}
                                            className={`rounded-xl border p-4 transition-colors ${isChecked ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/50'}`}
                                        >
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="mt-1 w-4 h-4 rounded text-emerald-600"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        setChecked((prev) => ({ ...prev, [id]: e.target.checked }));
                                                        if (e.target.checked) {
                                                            setReasons((prev) => {
                                                                const next = { ...prev };
                                                                delete next[id];
                                                                return next;
                                                            });
                                                        }
                                                    }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Package size={14} className="text-purple-600 shrink-0" />
                                                        <span className="font-bold text-slate-900">{asset.name}</span>
                                                        <span className="text-xs text-slate-500">{asset.assetId}</span>
                                                    </div>
                                                    {remaining && (
                                                        <p className="text-xs font-semibold text-purple-700 mt-1">
                                                            Parking · {remaining}
                                                        </p>
                                                    )}
                                                </div>
                                            </label>
                                            {!isChecked && (
                                                <div className="mt-3 pl-7">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-amber-700 block mb-1">
                                                        Reason (required if not on duty)
                                                    </label>
                                                    <textarea
                                                        rows={2}
                                                        value={reasons[id] || ''}
                                                        onChange={(e) =>
                                                            setReasons((prev) => ({ ...prev, [id]: e.target.value }))
                                                        }
                                                        className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-400 outline-none"
                                                        placeholder="Why is this asset staying on leave?"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={handleDismiss}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200/80 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={submitting || loading || !assets.length}
                        onClick={handleSubmit}
                        className="px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Confirm on duty
                    </button>
                </div>
            </div>
        </div>
    );
}
