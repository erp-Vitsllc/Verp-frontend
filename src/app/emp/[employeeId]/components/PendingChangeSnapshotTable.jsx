'use client';

import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import {
    buildActivationSnapshotRows,
    filterSnapshotRowsToChangesOnly,
    formatSnapshotFallbackJson,
    resolveActivationSnapshot,
} from '../utils/pendingActivationSnapshotRows';

/**
 * Read-only prior vs proposed blocks (submit pending, HR activation, held pendings).
 * @param {'previous'|'proposed'} kind
 * @param {'gray'|'amber'|'blue'} variant
 * @param {boolean} [diffOnly=true] — only show fields whose displayed value (or document URL) differs
 */
export default function PendingChangeSnapshotTable({
    entry,
    kind,
    title,
    variant = 'gray',
    diffOnly = true,
    resolveContext = null,
}) {
    const snapshotData = entry ? resolveActivationSnapshot(entry, kind) : {};
    const context = resolveContext && typeof resolveContext === 'object' ? resolveContext : {};

    let rows;
    if (diffOnly && entry) {
        const { previousRows, proposedRows } = filterSnapshotRowsToChangesOnly(entry, { resolveContext: context });
        rows = kind === 'previous' ? previousRows : proposedRows;
    } else {
        rows = buildActivationSnapshotRows(snapshotData, { entry, resolveContext: context });
    }

    const shell =
        variant === 'amber'
            ? 'border-amber-100 bg-amber-50/90'
            : variant === 'blue'
              ? 'border-blue-50/40 border-blue-200 bg-blue-50/40'
              : 'border-gray-200 bg-gray-50/80';

    const labelTone =
        variant === 'amber' ? 'text-amber-950' : variant === 'blue' ? 'text-blue-800' : 'text-gray-700';
    const valueTone =
        variant === 'amber' ? 'text-amber-950' : variant === 'blue' ? 'text-blue-900' : 'text-gray-800';
    const titleTone =
        variant === 'blue' ? 'text-blue-700' : variant === 'amber' ? 'text-amber-900' : 'text-gray-600';

    return (
        <div className="space-y-1.5">
            <div className={`text-[10px] font-bold uppercase tracking-wide ${titleTone}`}>{title}</div>
            {rows.length > 0 ? (
                <div className={`rounded-lg border overflow-hidden ${shell}`}>
                    {rows.map((row, idx) => (
                        <div
                            key={`${kind}-${idx}`}
                            className="grid grid-cols-12 gap-2 px-2.5 py-1.5 border-b border-gray-200/70 last:border-b-0 text-xs"
                        >
                            <div className={`col-span-5 font-semibold ${labelTone}`}>{row.label}</div>
                            <div className={`col-span-7 flex items-center justify-between gap-2 min-w-0 ${valueTone}`}>
                                <span className="truncate">{row.value}</span>
                                {row.isAttachment || row.url || row.attachmentRef ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            openAttachmentInNewTab(row.attachmentRef || row.url, {
                                                name: row.label,
                                            })
                                        }
                                        className="shrink-0 text-[10px] font-semibold text-blue-700 hover:underline"
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
