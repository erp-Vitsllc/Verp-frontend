'use client';

import { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import PendingChangeSnapshotTable from './PendingChangeSnapshotTable';

/**
 * Read-only list of queued items HR placed on hold (legacy HOD entry removed from profile header).
 * HR-checked rows were already saved; these are the leftovers.
 */
export default function HeldPendingsReviewModal({
    isOpen,
    onClose,
    employee,
    rowCheckedById = {},
    onToggleRowChecked,
    holdResubmitEligible = false,
    activationSubmitLabel = 'Submit for Activation',
    onConfirmReviewAck,
    onOpenSubmitForActivation,
}) {
    const [previewEntry, setPreviewEntry] = useState(null);

    const { rows, hrNote } = useMemo(() => {
        const hold = employee?.profileActivationHold || null;
        const unapprovedIds = Array.isArray(hold?.unapprovedEntryIds) ? hold.unapprovedEntryIds.map(String) : [];
        const pending = Array.isArray(employee?.pendingReactivationChanges) ? employee.pendingReactivationChanges : [];
        const mapped = unapprovedIds.map((id) => {
            const idx = pending.findIndex((e, i) => String(e?._id || i) === id);
            const entry = idx >= 0 ? pending[idx] : null;
            return {
                id,
                card: entry ? String(entry.card || '').trim() || 'Profile change' : `Change (${id.slice(-6)})`,
                section: entry ? String(entry.section || '') : '',
                entry: entry || {
                    _id: id,
                    card: 'Profile change',
                    proposedData: null,
                    section: '',
                    changeType: '',
                },
            };
        });
        return {
            rows: mapped,
            hrNote: String(hold?.comment || '').trim(),
        };
    }, [employee?.profileActivationHold, employee?.pendingReactivationChanges]);

    const allRowsAcknowledged =
        rows.length > 0 && rows.every((row) => rowCheckedById[String(row.id)] === true);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Held pending changes</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            HR confirmed the <span className="font-semibold text-gray-700">checked cards</span> were saved. Below are the{' '}
                            <span className="font-semibold text-gray-700">still-pending rows</span> awaiting this employee&apos;s corrections and their
                            re-submission to HR.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 shrink-0">
                        Close
                    </button>
                </div>
                <div className="px-6 py-3 flex items-center gap-2 text-sm text-amber-800 bg-amber-50/70 border-b border-amber-100">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>
                        Submission status remains <strong>submitted</strong> — no action needed from your side except awareness.
                        The employee edits these items directly on their profile.
                    </span>
                </div>
                {hrNote ? (
                    <div className="mx-6 mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                        <span className="font-semibold">HR note:</span> {hrNote}
                    </div>
                ) : null}
                <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2">
                    {rows.length === 0 ? (
                        <p className="text-sm text-gray-500 py-6">
                            Nothing on hold — either HR cleared the queue or reload the employee profile.
                        </p>
                    ) : (
                        rows.map((row) => {
                            const rowId = String(row.id);
                            const checked = rowCheckedById[rowId] === true;
                            return (
                                <div
                                    key={row.id}
                                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5"
                                >
                                    <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                            checked={checked}
                                            onChange={() => onToggleRowChecked?.(rowId)}
                                        />
                                        <span className="sr-only">Acknowledge reviewed: {row.card}</span>
                                    </label>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-gray-900 truncate">{row.card}</div>
                                        {row.section ? <div className="text-xs text-gray-500 truncate">{row.section}</div> : null}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewEntry(row.entry)}
                                        className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                                    >
                                        View
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm font-semibold hover:bg-gray-200"
                    >
                        Done
                    </button>
                    {allRowsAcknowledged && rows.length > 0 && holdResubmitEligible && onOpenSubmitForActivation ? (
                        <button
                            type="button"
                            onClick={() => onOpenSubmitForActivation()}
                            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 shadow-sm"
                        >
                            {activationSubmitLabel}
                        </button>
                    ) : null}
                    {allRowsAcknowledged && rows.length > 0 && !holdResubmitEligible && onConfirmReviewAck ? (
                        <button
                            type="button"
                            onClick={() => onConfirmReviewAck()}
                            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 shadow-sm"
                        >
                            Confirm review
                        </button>
                    ) : null}
                </div>
            </div>

            {previewEntry ? (
                <div className="fixed inset-0 z-[116] flex items-center justify-center p-4 bg-black/40">
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
                                title="Prior snapshot"
                                variant="gray"
                            />
                            <PendingChangeSnapshotTable
                                entry={previewEntry}
                                kind="proposed"
                                title="Employee proposed (held)"
                                variant="amber"
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
