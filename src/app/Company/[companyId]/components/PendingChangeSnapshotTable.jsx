'use client';

import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import {
    buildActivationSnapshotRows,
    filterSnapshotRowsToChangesOnly,
    formatSnapshotFallbackJson,
    resolveActivationSnapshot,
    scopeSnapshotToProposedKeys,
} from '../utils/pendingActivationSnapshotRows';

/**
 * Read-only prior vs proposed blocks for Company activation hold.
 */
export default function PendingChangeSnapshotTable({ entry, kind, title, variant = 'gray', diffOnly = true }) {
    const proposedSnapshot = entry ? resolveActivationSnapshot(entry, 'proposed') : {};
    const snapshotData =
        entry && kind === 'previous'
            ? scopeSnapshotToProposedKeys(resolveActivationSnapshot(entry, 'previous'), proposedSnapshot)
            : entry
              ? resolveActivationSnapshot(entry, kind)
              : {};

    let rows;
    if (diffOnly && entry) {
        const { previousRows, proposedRows } = filterSnapshotRowsToChangesOnly(entry);
        rows = kind === 'previous' ? previousRows : proposedRows;
    } else {
        rows = buildActivationSnapshotRows(snapshotData, { entry });
    }

    const shell =
        variant === 'amber'
            ? 'border-amber-100 bg-amber-50/90'
            : variant === 'blue'
              ? 'border-blue-100 bg-blue-50'
              : 'border-gray-200 bg-gray-50';

    const labelTone =
        variant === 'amber' ? 'text-amber-950' : variant === 'blue' ? 'text-blue-900' : 'text-gray-800';
    const valueTone =
        variant === 'amber' ? 'text-amber-950' : variant === 'blue' ? 'text-blue-900' : 'text-gray-800';

    return (
        <div className="space-y-1">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</div>
            {rows.length > 0 ? (
                <div className={`rounded-lg border overflow-hidden max-h-[36vh] overflow-y-auto ${shell}`}>
                    {rows.map((row, idx) => (
                        <div
                            key={`${kind}-${idx}`}
                            className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-gray-200/80 last:border-b-0 text-sm"
                        >
                            <div className={`col-span-4 font-semibold ${labelTone}`}>{row.label}</div>
                            <div className={`col-span-8 break-all flex items-start justify-between gap-2 ${valueTone}`}>
                                <span>{row.value}</span>
                                {row.isAttachment || row.url || row.attachmentRef ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            openAttachmentInNewTab(row.attachmentRef || row.url, {
                                                name: row.label,
                                            })
                                        }
                                        className="shrink-0 text-xs font-semibold text-blue-700 hover:underline"
                                    >
                                        View
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <pre
                    className={`rounded-lg border p-3 overflow-auto max-h-[28vh] text-xs whitespace-pre-wrap font-mono ${shell} ${valueTone}`}
                >
                    {formatSnapshotFallbackJson(Object.keys(snapshotData).length ? snapshotData : null)}
                </pre>
            )}
        </div>
    );
}
