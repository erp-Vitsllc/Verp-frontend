'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

const normType = (t) => String(t || '').toLowerCase().trim();

function parseRegDescription(doc) {
    if (!doc?.description) return {};
    try {
        return JSON.parse(doc.description);
    } catch {
        return {};
    }
}

function buildSectionRows(sectionId, asset) {
    const docs = asset?.documents || [];
    const registrationDoc = docs.find((d) => normType(d.type) === 'registration');
    const insuranceDoc = docs.find((d) => normType(d.type) === 'insurance');
    const warrantyDoc = docs.find((d) => normType(d.type) === 'warranty');
    const insMeta = insuranceDoc ? parseRegDescription(insuranceDoc) : {};

    switch (sectionId) {
        case 'basic':
            return [
                { label: 'Asset ID', value: asset?.assetId || '—' },
                { label: 'Brand', value: asset?.typeId?.name || asset?.type || '—' },
                { label: 'Model', value: asset?.name || '—' },
                {
                    label: 'Plate',
                    value: `${asset?.plateEmirate || ''} ${asset?.plateNumber || ''}`.trim() || '—',
                },
                { label: 'Model year', value: asset?.modelYear ?? '—' },
                { label: 'Disposition', value: asset?.vehicleDispositionStatus || '—' },
            ];
        case 'registration':
            return [
                { label: 'Registration date', value: registrationDoc?.issueDate ? String(registrationDoc.issueDate).slice(0, 10) : '—' },
                { label: 'Expiry', value: registrationDoc?.expiryDate ? String(registrationDoc.expiryDate).slice(0, 10) : '—' },
                {
                    label: 'Registration value',
                    value: (() => {
                        const m = parseRegDescription(registrationDoc);
                        return m.fee != null ? `AED ${Number(m.fee).toLocaleString()}` : '—';
                    })(),
                },
                { label: 'Primary card on file', value: registrationDoc?.attachment ? 'Yes' : 'No' },
            ];
        case 'insurance':
            return [
                { label: 'Insurer', value: insMeta.company || insuranceDoc?.issueAuthority || '—' },
                { label: 'Policy', value: insMeta.policy || '—' },
                { label: 'Start', value: insuranceDoc?.issueDate ? String(insuranceDoc.issueDate).slice(0, 10) : '—' },
                { label: 'End', value: insuranceDoc?.expiryDate ? String(insuranceDoc.expiryDate).slice(0, 10) : '—' },
            ];
        case 'warranty':
            return [
                { label: 'Start', value: warrantyDoc?.issueDate ? String(warrantyDoc.issueDate).slice(0, 10) : '—' },
                { label: 'End', value: warrantyDoc?.expiryDate ? String(warrantyDoc.expiryDate).slice(0, 10) : '—' },
                { label: 'Attachment', value: warrantyDoc?.attachment ? 'Yes' : 'No' },
            ];
        case 'documents': {
            const n = docs.length;
            const types = [...new Set(docs.map((d) => normType(d.type)).filter(Boolean))];
            return [
                { label: 'Total document rows', value: String(n) },
                { label: 'Types present', value: types.length ? types.join(', ') : '—' },
            ];
        }
        default:
            return [];
    }
}

function sectionGroups(warrantyRequired) {
    const g = [
        { id: 'basic', label: 'Basic details' },
        { id: 'registration', label: 'Registration (card)' },
        { id: 'insurance', label: 'Insurance' },
        { id: 'documents', label: 'Documents summary' },
    ];
    if (warrantyRequired) {
        g.splice(3, 0, { id: 'warranty', label: 'Warranty' });
    }
    return g;
}

function RowTable({ rows }) {
    return (
        <div className="rounded-lg border border-slate-200 overflow-hidden text-sm">
            {rows.map((r) => (
                <div key={r.label} className="flex justify-between gap-3 px-3 py-2 border-b border-slate-100 last:border-0 bg-white">
                    <span className="text-slate-500 shrink-0">{r.label}</span>
                    <span className="font-semibold text-slate-800 text-right break-words">{r.value}</span>
                </div>
            ))}
        </div>
    );
}

export default function VehicleActivationSubmitModal({
    isOpen,
    onClose,
    asset,
    assetMongoId,
    warrantyRequired = false,
    onSuccess,
}) {
    const { toast } = useToast();
    const groups = useMemo(() => sectionGroups(warrantyRequired), [warrantyRequired]);
    const allIds = useMemo(() => groups.map((g) => g.id), [groups]);
    const [selected, setSelected] = useState(() => new Set(allIds));
    const [description, setDescription] = useState('');
    const [sending, setSending] = useState(false);
    const [reviewSection, setReviewSection] = useState(null);

    useEffect(() => {
        if (!isOpen) return;
        setSelected(new Set(allIds));
        setDescription('');
        setReviewSection(null);
    }, [isOpen, allIds]);

    if (!isOpen || !asset) return null;

    const allSelected = groups.every((g) => selected.has(g.id));
    const toggleAll = () => {
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(allIds));
    };
    const toggleOne = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const submit = async () => {
        const includedSections = [...selected];
        if (includedSections.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Nothing selected',
                description: 'Select at least one area to send with this request.',
            });
            return;
        }
        setSending(true);
        try {
            await axiosInstance.post(`/AssetItem/${assetMongoId}/submit-vehicle-profile-activation`, {
                description: description.trim(),
                includedSections,
            });
            toast({
                title: 'Submitted',
                description: 'The Asset Controller has been emailed and will see a dashboard task.',
            });
            onClose();
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Submit failed',
                description: err.response?.data?.message || 'Could not submit for review.',
            });
        } finally {
            setSending(false);
        }
    };

    const reviewRows = reviewSection ? buildSectionRows(reviewSection, asset) : [];

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="text-xl font-bold text-gray-800">Submit vehicle profile for review</h3>
                        <p className="text-sm text-gray-500 mt-1">Optional note to the Asset Controller.</p>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-xs text-gray-500 leading-snug">
                            Tick the areas you want included in this request. Open <strong>View</strong> to see what will
                            be reviewed (on-file values). Unticked items stay out of this submission only — they are not
                            removed from the vehicle record.
                        </p>
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-gray-700">Areas to include</div>
                            <label className="inline-flex items-center gap-2 text-xs text-gray-600 shrink-0 cursor-pointer">
                                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                                Select all
                            </label>
                        </div>
                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                            {groups.map((group) => (
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
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Note (optional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none"
                                placeholder="Add context for the Asset Controller…"
                            />
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (!sending) onClose();
                            }}
                            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submit}
                            disabled={sending}
                            className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sending ? 'Submitting…' : 'Submit for review'}
                        </button>
                    </div>
                </div>
            </div>

            {reviewSection && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Review for approver</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Left: values on file today. Right: same snapshot flagged for this request (no pending
                                    draft layer on vehicles yet).
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReviewSection(null)}
                                className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                    On file (current)
                                </p>
                                <RowTable rows={reviewRows} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-2">
                                    Included in this request
                                </p>
                                <RowTable rows={reviewRows} />
                            </div>
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
