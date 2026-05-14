'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { buildSectionRows, sectionGroups, RowTable } from './VehicleActivationSubmitModal';

const SECTION_LABEL = {
    basic: 'Basic details',
    registration: 'Registration (card)',
    insurance: 'Insurance',
    warranty: 'Warranty',
    documents: 'Documents summary',
};

export default function VehicleProfileActivationReviewModal({
    isOpen,
    onClose,
    asset,
    assetMongoId,
    warrantyRequired = false,
    onSuccess,
}) {
    const { toast } = useToast();
    const groups = useMemo(() => sectionGroups(warrantyRequired), [warrantyRequired]);
    const requested = useMemo(() => {
        const raw = Array.isArray(asset?.vehicleProfileActivationSections) ? asset.vehicleProfileActivationSections : [];
        const allowed = new Set(groups.map((g) => g.id));
        return [...new Set(raw.map((s) => String(s || '').trim()).filter((s) => allowed.has(s)))];
    }, [asset?.vehicleProfileActivationSections, groups]);

    const [selected, setSelected] = useState(() => new Set(requested));
    const [reviewSection, setReviewSection] = useState(null);
    const [holdComment, setHoldComment] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [rejectOpen, setRejectOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setSelected(new Set(requested));
        setReviewSection(null);
        setHoldComment('');
        setRejectReason('');
        setRejectOpen(false);
        setBusy(false);
    }, [isOpen, requested]);

    if (!isOpen || !asset) return null;

    const allSelected = requested.length > 0 && requested.every((id) => selected.has(id));
    const toggleAll = () => {
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(requested));
    };
    const toggleOne = (id) => {
        if (!requested.includes(id)) return;
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const run = async (fn) => {
        setBusy(true);
        try {
            await fn();
            toast({ title: 'Saved', description: 'The vehicle profile activation state was updated.' });
            onClose();
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Action failed',
                description: err.response?.data?.message || err.message || 'Request failed.',
            });
        } finally {
            setBusy(false);
        }
    };

    const accept = () =>
        run(() =>
            axiosInstance.post(`/AssetItem/${assetMongoId}/approve-vehicle-profile-activation`, {
                selectionProvided: true,
                approvedSections: requested,
            }),
        );

    const hold = () => {
        const approvedSections = requested.filter((id) => selected.has(id));
        if (approvedSections.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Nothing accepted',
                description: 'Check at least one section you accept now; unchecked sections return to the submitter.',
            });
            return;
        }
        if (approvedSections.length >= requested.length) {
            toast({
                variant: 'destructive',
                title: 'Use Accept instead',
                description: 'Uncheck at least one section to place those items on hold.',
            });
            return;
        }
        return run(() =>
            axiosInstance.post(`/AssetItem/${assetMongoId}/hold-vehicle-profile-activation`, {
                selectionProvided: true,
                approvedSections,
                comment: holdComment.trim(),
            }),
        );
    };

    const reject = () => {
        const reason = rejectReason.trim();
        if (!reason) {
            toast({ variant: 'destructive', title: 'Reason required', description: 'Enter a short rejection reason.' });
            return;
        }
        return run(() =>
            axiosInstance.post(`/AssetItem/${assetMongoId}/reject-vehicle-profile-activation`, { reason }),
        );
    };

    const reviewRows = reviewSection ? buildSectionRows(reviewSection, asset) : [];

    return (
        <>
            <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="text-xl font-bold text-gray-800">Review vehicle profile request</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Same areas as the submitter&apos;s request. <strong>View</strong> shows on-file values. Use{' '}
                            <strong>Hold</strong> when only some sections are acceptable — unchecked sections go back to
                            the submitter (not removed from the vehicle).
                        </p>
                    </div>
                    <div className="p-6 space-y-4">
                        {requested.length === 0 ? (
                            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                No sections were recorded on this submission. Close and refresh, or reject the request.
                            </p>
                        ) : (
                            <>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-xs font-semibold text-gray-700">Sections in this request</div>
                                    <label className="inline-flex items-center gap-2 text-xs text-gray-600 shrink-0 cursor-pointer">
                                        <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                                        Select all
                                    </label>
                                </div>
                                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                                    {groups
                                        .filter((g) => requested.includes(g.id))
                                        .map((group) => (
                                            <div
                                                key={group.id}
                                                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 bg-slate-50/50 gap-2"
                                            >
                                                <label className="inline-flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.has(group.id)}
                                                        onChange={() => toggleOne(group.id)}
                                                    />
                                                    <span className="text-sm text-gray-800 truncate" title={group.label}>
                                                        {group.label}
                                                    </span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setReviewSection(group.id)}
                                                    className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        ))}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Note for submitter (optional, shown on Hold)
                                    </label>
                                    <textarea
                                        value={holdComment}
                                        onChange={(e) => setHoldComment(e.target.value)}
                                        rows={2}
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none"
                                        placeholder="Instructions for corrected sections…"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="px-6 py-4 bg-gray-50 flex flex-wrap justify-end gap-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => !busy && onClose()}
                            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={busy || requested.length === 0}
                            onClick={() => setRejectOpen(true)}
                            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            Reject
                        </button>
                        <button
                            type="button"
                            disabled={busy || requested.length === 0}
                            onClick={hold}
                            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            Hold
                        </button>
                        <button
                            type="button"
                            disabled={busy || requested.length === 0}
                            onClick={accept}
                            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            Accept
                        </button>
                    </div>
                </div>
            </div>

            {rejectOpen && (
                <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h4 className="text-lg font-bold text-gray-900">Reject this request?</h4>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            placeholder="Reason (required)…"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                className="px-3 py-2 text-sm text-gray-600"
                                onClick={() => !busy && setRejectOpen(false)}
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg disabled:opacity-50"
                                onClick={reject}
                            >
                                Confirm reject
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {reviewSection && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">
                                    {SECTION_LABEL[reviewSection] || reviewSection}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">On-file snapshot for this vehicle.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReviewSection(null)}
                                className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <RowTable rows={reviewRows} />
                        </div>
                        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setReviewSection(null)}
                                className="px-4 py-2 text-sm font-semibold text-blue-700 hover:underline"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
