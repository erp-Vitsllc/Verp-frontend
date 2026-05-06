'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import PendingChangeSnapshotTable from './PendingChangeSnapshotTable';

const norm = (s) => String(s || '').toLowerCase().trim();

/** Match backend `pendingChangeDedupeKey`: one row per section / visa subtype. */
function activationHoldDedupeKey(entry) {
    if (!entry || typeof entry !== 'object') return '';
    const sec = norm(entry.section);
    if (sec === 'visa') {
        const pd = entry.proposedData && typeof entry.proposedData === 'object' ? entry.proposedData : {};
        const prev = entry.previousData && typeof entry.previousData === 'object' ? entry.previousData : {};
        const vt = norm(pd.visaType || prev.visaType);
        if (vt) return `visa::${vt}`;
    }
    if (sec) return `section::${sec}`;
    const card = norm(entry.card);
    const ct = norm(entry.changeType);
    return `card::${card}::${ct}`;
}

/**
 * Employee: list HR hold items, red/green by save progress, open edit with proposed payload.
 */
export default function ActivationHoldReviewModal({
    isOpen,
    onClose,
    employee,
    onEditHeldEntry,
    onSubmitForActivation = null,
}) {
    const [previewEntry, setPreviewEntry] = useState(null);
    const { rows, hrNote, allResolved } = useMemo(() => {
        const hold = employee?.profileActivationHold || null;
        const unapprovedIds = Array.isArray(hold?.unapprovedEntryIds) ? hold.unapprovedEntryIds.map(String) : [];
        const resolvedIds = new Set((hold?.resolvedEntryIds || []).map(String));
        const pending = Array.isArray(employee?.pendingReactivationChanges) ? employee.pendingReactivationChanges : [];
        const mapped = unapprovedIds.map((id) => {
            const idx = pending.findIndex((e, i) => String(e?._id || i) === id);
            const entry = idx >= 0 ? pending[idx] : null;
            const rowEntry = entry || { _id: id, card: 'Profile change', proposedData: null, section: '', changeType: '' };
            return {
                id,
                resolved: resolvedIds.has(String(id)),
                card: entry ? String(entry.card || '').trim() || 'Profile change' : `Change (${id.slice(-6)})`,
                section: entry ? String(entry.section || '') : '',
                entry: rowEntry,
                changedAt: entry?.changedAt ? new Date(entry.changedAt).getTime() : 0,
            };
        });

        const byKey = new Map();
        for (const row of mapped) {
            const k = row.entry ? activationHoldDedupeKey(row.entry) : `id::${row.id}`;
            if (!byKey.has(k)) byKey.set(k, []);
            byKey.get(k).push(row);
        }

        const rowNotesSrc =
            typeof hold?.rowNotesByEntryId === 'object' && hold?.rowNotesByEntryId ? hold.rowNotesByEntryId : {};

        const merged = [...byKey.values()].map((group) => {
            const sorted = [...group].sort((a, b) => b.changedAt - a.changedAt);
            const best = sorted[0];
            const groupIds = group.map((r) => String(r.id));
            const resolved = group.every((r) => resolvedIds.has(String(r.id)));
            let rowNoteMerged = '';
            for (const gid of groupIds) {
                const t = rowNotesSrc[gid];
                if (t && String(t).trim()) {
                    rowNoteMerged = String(t).trim();
                    break;
                }
            }
            return {
                id: groupIds.slice().sort().join('\u0001'),
                groupIds,
                resolved,
                card: best.card,
                section: best.section,
                entry: best.entry,
                rowNoteMerged,
            };
        });

        const done = merged.length === 0 || merged.every((r) => r.resolved);
        return {
            rows: merged,
            hrNote: String(hold?.comment || '').trim(),
            allResolved: done,
        };
    }, [employee?.profileActivationHold, employee?.pendingReactivationChanges]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[45] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">HR activation hold</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            HR needs updates on the items marked in red below. Edit and save each one — they turn green when saved. When all are green you can{' '}
                            <span className="font-semibold text-gray-700">submit for activation again</span>.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 shrink-0">
                        Close
                    </button>
                </div>
                <div className="px-6 py-3 flex items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-700">Status:</span>
                    {allResolved ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 size={16} /> All items addressed — you can resubmit
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <AlertCircle size={16} /> Action required ({rows.filter((r) => !r.resolved).length} left)
                        </span>
                    )}
                </div>
                {hrNote ? (
                    <div className="mx-6 mb-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                        <span className="font-semibold">HR note:</span> {hrNote}
                    </div>
                ) : null}
                <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2">
                    {rows.length === 0 ? (
                        <p className="text-sm text-gray-500 py-6">No held items recorded. Refresh the profile or contact HR.</p>
                    ) : (
                        rows.map((row) => (
                            <div
                                key={row.id}
                                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                                    row.resolved ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/50'
                                }`}
                            >
                                <div className="shrink-0" title={row.resolved ? 'Saved' : 'Pending your update'}>
                                    {row.resolved ? (
                                        <CheckCircle2 className="text-emerald-600" size={20} />
                                    ) : (
                                        <AlertCircle className="text-red-600" size={20} />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-gray-900 truncate">{row.card}</div>
                                    {row.section ? (
                                        <div className="text-xs text-gray-500 truncate">{row.section}</div>
                                    ) : null}
                                    {String(row.rowNoteMerged || '').trim() ? (
                                        <div className="text-xs text-slate-700 mt-1.5 whitespace-pre-wrap leading-snug">
                                            <span className="font-semibold text-gray-800">HR instructions: </span>
                                            {row.rowNoteMerged}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewEntry(row.entry)}
                                        className="text-xs font-semibold text-blue-700 hover:underline"
                                    >
                                        View
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onEditHeldEntry?.(row.entry)}
                                        className="text-xs font-semibold rounded-lg bg-blue-600 text-white px-2.5 py-1 hover:bg-blue-700"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex flex-col gap-2 items-stretch">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm font-semibold hover:bg-gray-200"
                    >
                        Done
                    </button>
                    {typeof onSubmitForActivation === 'function' ? (
                        <button
                            type="button"
                            disabled={!allResolved}
                            title={
                                allResolved
                                    ? 'Send this profile to HR for activation review again'
                                    : 'Edit and save each red item until it turns green, then submit here'
                            }
                            onClick={() => {
                                if (!allResolved) return;
                                onClose();
                                onSubmitForActivation();
                            }}
                            className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm ${
                                allResolved
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-green-600/50 cursor-not-allowed opacity-70'
                            }`}
                        >
                            Submit for activation
                        </button>
                    ) : null}
                </div>
            </div>

            {previewEntry ? (
                <div className="fixed inset-0 z-[46] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-gray-200">
                        <div className="px-5 py-3 border-b flex justify-between items-center">
                            <h4 className="font-bold text-gray-900 text-lg">
                                {String(previewEntry.card || '').trim() ||
                                    String(previewEntry.reason || '').trim() ||
                                    'Change preview'}
                            </h4>
                            <button type="button" className="text-sm text-gray-500 hover:text-gray-800" onClick={() => setPreviewEntry(null)}>
                                Close
                            </button>
                        </div>
                        <div className="p-5 overflow-auto space-y-5">
                            <PendingChangeSnapshotTable
                                entry={previewEntry}
                                kind="previous"
                                title="Prior snapshot (HR)"
                                variant="gray"
                            />
                            <PendingChangeSnapshotTable
                                entry={previewEntry}
                                kind="proposed"
                                title="Your submitted edit (needs correction)"
                                variant="blue"
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
