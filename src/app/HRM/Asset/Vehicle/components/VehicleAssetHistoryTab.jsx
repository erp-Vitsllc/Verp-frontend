'use client';

import { useMemo, useState } from 'react';
import {
    UserPlus,
    History,
    CheckCircle2,
    XCircle,
    RotateCcw,
    Wrench,
    PlusCircle,
    Clock,
    ChevronDown,
    Eye,
    MessageSquare,
    Reply,
    FileText,
    ExternalLink,
    Printer,
    X,
} from 'lucide-react';

const fmtPerson = (p) => {
    if (!p) return '';
    const n = `${p.firstName || ''} ${p.lastName || ''}`.trim();
    return n || p.employeeId || '';
};

const fmtCompany = (c) => (c && typeof c === 'object' ? c.name || c.companyId || '' : '');

/** Labels for vehicle service approval workflow stages (matches backend STAGE_LABEL). */
const WORKFLOW_STAGE_TITLE = {
    pending_hr: 'HR',
    pending_accounts: 'Accounts',
    pending_admin: 'On service',
    pending_management: 'Management',
};

/** History rows may embed an asset snapshot in `details` (e.g. assignment/handover); print route uses these ids. */
export function historyHasSnapshotDocument(entry) {
    return Boolean(
        entry?.details &&
        typeof entry.details === 'object' &&
        entry.details._id
    );
}

export function getHandoverDocumentUrl(entry) {
    if (typeof window === 'undefined') return '';
    const snapId = entry?.details?._id;
    const hid = entry?._id;
    if (!snapId || !hid) return '';
    return `${window.location.origin}/print/asset-handover/${snapId}?historyId=${encodeURIComponent(String(hid))}`;
}

/** @deprecated Prefer in-tab modal via VehicleAssetHistoryTab; opens print view in a new browser tab. */
export function openHandoverDocumentAtTime(entry) {
    const url = getHandoverDocumentUrl(entry);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

const actionIcon = (action) => {
    switch (action) {
        case 'Assigned':
            return UserPlus;
        case 'Accepted':
            return CheckCircle2;
        case 'Rejected':
            return XCircle;
        case 'Returned':
        case 'Unassigned':
            return RotateCcw;
        case 'Service':
        case 'Service Send':
        case 'Service Receive':
            return Wrench;
        case 'Created':
            return PlusCircle;
        case 'ControllerHandover':
        case 'Transfer':
        case 'End of Life':
        case 'Out of Service':
        case 'On Leave':
            return History;
        default:
            return History;
    }
};

const statusBadge = (entry) => {
    const action = entry?.action;
    const wf = entry?.details;
    if (wf?.type === 'VehicleServiceWorkflow' && wf.workflowAction === 'reject') {
        return { label: 'REJECTED', className: 'bg-rose-50 text-rose-700 border border-rose-100' };
    }
    if (wf?.type === 'VehicleServiceWorkflow' && wf.workflowAction === 'start') {
        return { label: 'WORKFLOW', className: 'bg-sky-50 text-sky-800 border border-sky-100' };
    }
    if (action === 'Rejected') {
        return { label: 'REJECTED', className: 'bg-rose-50 text-rose-700 border border-rose-100' };
    }
    if (action === 'Assigned') {
        return { label: 'AWAITING ACCEPTANCE', className: 'bg-amber-50 text-amber-800 border border-amber-100' };
    }
    if (action === 'AcceptWithComments') {
        return { label: 'APPROVED (WITH NOTES)', className: 'bg-emerald-50 text-emerald-700 border border-emerald-100' };
    }
    return { label: 'COMPLETED', className: 'bg-emerald-50 text-emerald-700 border border-emerald-100' };
};

function buildCardTitle(entry, copyMode = 'vehicle') {
    const d = entry.details || {};
    const a = entry.action;
    if (d.userStory && (a === 'Created' || a === 'ControllerHandover')) {
        return d.userStory;
    }

    const actor = fmtPerson(entry.performedBy);
    if (d.type === 'VehicleServiceWorkflow') {
        const svc = d.serviceTypeLabel ? ` — ${d.serviceTypeLabel}` : '';
        const who = actor || (d.byName && String(d.byName).trim()) || '';
        const step = WORKFLOW_STAGE_TITLE[d.stage] || d.stage || '';
        if (d.workflowAction === 'start') {
            return who ? `${who} started service approval${svc}` : `Service approval started${svc}`;
        }
        if (d.workflowAction === 'reject') {
            return who
                ? `${who} rejected at ${step || 'workflow'}`
                : `Service approval rejected at ${step || 'workflow'}`;
        }
        if (d.workflowAction === 'approve') {
            const upd = d.hasServiceUpdates ? ' (record updated)' : '';
            return who
                ? `${who} approved — ${step}${upd}${svc}`
                : `Approved — ${step}${upd}${svc}`;
        }
        return who ? `${who} — service workflow` : 'Service workflow';
    }
    const target = fmtPerson(entry.assignedTo);
    const company = fmtCompany(entry.assignedCompany);

    if (a === 'Assigned') {
        if (entry.assignedToType === 'Company' && company) {
            return `Assigned to ${company} — awaiting acceptance`;
        }
        return target
            ? `Assigned to ${target} — awaiting acceptance`
            : actor
              ? `${actor} recorded an assignment`
              : 'Assignment recorded';
    }
    if (a === 'Accepted') {
        if (copyMode === 'asset') {
            return target ? `${target} approved the assignment` : 'Request approved';
        }
        return target ? `${target} accepted this vehicle` : 'Assignment accepted';
    }
    if (a === 'Rejected') {
        return target ? `${target} rejected this assignment` : 'Assignment rejected';
    }
    if (a === 'Returned' || a === 'Unassigned') {
        return actor
            ? `${actor} returned or unassigned this asset`
            : copyMode === 'asset'
              ? 'Asset returned or unassigned'
              : 'Vehicle returned or unassigned';
    }
    if (a === 'Created') {
        return actor ? `${actor} added this asset` : 'This asset was created';
    }
    if (a === 'Service' || a === 'Service Send' || a === 'Service Receive') {
        return actor ? `${actor} updated service status` : 'Service activity recorded';
    }
    if (a === 'Comment') {
        return actor ? `Note from ${actor}` : 'Comment added';
    }
    return actor ? `${actor} — ${a}` : a;
}

function buildRequestSummary(entry, copyMode = 'vehicle') {
    const actor = fmtPerson(entry.performedBy);
    const target = fmtPerson(entry.assignedTo);
    const company = fmtCompany(entry.assignedCompany);
    const a = entry.action;
    const isAsset = copyMode === 'asset';
    const itemWord = isAsset ? 'asset' : 'vehicle';

    if (a === 'Assigned') {
        if (entry.assignedToType === 'Company' && company) {
            return `This ${itemWord} was assigned to **${company}** (company). The assignee is asked to review and accept or reject the assignment.`;
        }
        return target
            ? `This ${itemWord} was assigned to **${target}**. They can accept or reject the assignment from their tasks.`
            : `An assignment was recorded${actor ? ` by ${actor}` : ''}.`;
    }
    if (a === 'Accepted') {
        return `The assignee confirmed they received the ${itemWord} and accepted the assignment${actor ? ` (logged by ${actor})` : ''}.`;
    }
    if (a === 'Rejected') {
        return `The assignee declined the assignment. Any notes below explain why.`;
    }
    if (a === 'Returned' || a === 'Unassigned') {
        return `The ${itemWord} was returned or unassigned from the current holder.`;
    }
    if (a === 'Created') {
        return isAsset
            ? `The asset record was created in the system.`
            : `The vehicle record was created in the system.`;
    }
    if (a === 'Service' || a === 'Service Send' || a === 'Service Receive') {
        const wd = entry.details || {};
        if (wd.type === 'VehicleServiceWorkflow') {
            const step = WORKFLOW_STAGE_TITLE[wd.stage] || wd.stage || 'workflow';
            if (wd.workflowAction === 'start') {
                return `Multi-step service approval started (next: **HR**).${wd.serviceTypeLabel ? ` Service: **${wd.serviceTypeLabel}**.` : ''}`;
            }
            if (wd.workflowAction === 'reject') {
                return `The service request was **rejected** at the **${step}** step. Notes may appear below.`;
            }
            if (wd.workflowAction === 'approve') {
                const extra = wd.hasServiceUpdates ? ' The service line was **updated** during this approval.' : '';
                return `**${step}** approved this step of the workflow.${extra}`;
            }
            return `Service approval workflow event at **${step}**.`;
        }
        return `Service activity was logged for this ${itemWord} (workshop send/receive or status update).`;
    }
    if (a === 'ControllerHandover' && entry.details?.userStory) {
        return entry.details.userStory;
    }
    return `Recorded event: **${a}**.`;
}

export default function VehicleAssetHistoryTab({
    assetHistory = [],
    onViewFile,
    eyebrow = 'Vehicle record',
    /** Use "asset" wording (tools / general inventory); default keeps vehicle-specific copy. */
    copyMode = 'vehicle',
    /** Override opening the handover document (default: in-app modal with print view iframe). */
    onHandoverDocumentClick,
    /** When set, shows an extra control to download the historical handover PDF (e.g. tools asset details). */
    onHandoverPdfDownload,
}) {
    const [expanded, setExpanded] = useState(() => new Set());
    const [detailEntry, setDetailEntry] = useState(null);
    const [handoverFrame, setHandoverFrame] = useState(null);

    const sorted = useMemo(() => {
        return [...assetHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [assetHistory]);

    const toggle = (id) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleHandoverDocument = (entry) => {
        if (onHandoverDocumentClick) {
            onHandoverDocumentClick(entry);
            return;
        }
        const url = getHandoverDocumentUrl(entry);
        if (!url) return;
        setHandoverFrame({
            url,
            label: buildCardTitle(entry, copyMode),
        });
    };

    const shortId = (entry) => {
        const id = entry._id;
        if (!id) return '';
        const s = typeof id === 'string' ? id : id.toString?.() || '';
        return s.slice(-6);
    };

    if (!sorted.length) {
        return (
            <div className="w-full">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-6 sm:px-8 py-8 sm:py-10">
                        <div className="text-center space-y-1 mb-10">
                            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-slate-400">{eyebrow}</p>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Asset lifecycle &amp; history</h3>
                        </div>
                        <div className="bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 py-16 flex flex-col items-center justify-center text-center px-6">
                            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-slate-200 mb-6 shadow-sm border border-slate-100">
                                <History size={32} />
                            </div>
                            <h5 className="text-sm font-black text-slate-400 uppercase tracking-[.25em] mb-2">No lifecycle history yet</h5>
                            <p className="text-[11px] text-slate-400 font-medium max-w-sm leading-relaxed">
                                Assignments, acceptances, service updates, and other events will appear here as a clear timeline.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-6 sm:px-8 py-6 sm:py-8 space-y-6">
                    <div className="text-center space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-slate-400">{eyebrow}</p>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">Asset lifecycle &amp; history</h3>
                        <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed pt-1">
                            Each card is one event. Expand a card to see what happened and any reply or notes left on that step.
                        </p>
                    </div>

                    <div className="space-y-4">
                {sorted.map((entry) => {
                    const id = entry._id || `${entry.date}-${entry.action}`;
                    const Icon = actionIcon(entry.action);
                    const badge = statusBadge(entry);
                    const title = buildCardTitle(entry, copyMode);
                    const sid = shortId(entry);
                    const targetLine =
                        entry.assignedToType === 'Company' && entry.assignedCompany
                            ? fmtCompany(entry.assignedCompany)
                            : fmtPerson(entry.assignedTo);
                    const expandedNow = expanded.has(id);
                    const requestSummary = buildRequestSummary(entry, copyMode);
                    const hasFile = !!entry.file;
                    const showHandoverDoc = historyHasSnapshotDocument(entry);

                    return (
                        <div
                            key={id}
                            className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
                        >
                            <div className="h-1 w-full bg-emerald-500" aria-hidden />

                            <div className="p-4 sm:p-5 flex gap-4">
                                <div className="shrink-0">
                                    <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-emerald-600">
                                        <Icon size={20} strokeWidth={2} />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0 space-y-1">
                                            <p className="text-sm font-bold text-slate-900 leading-snug">
                                                {title}
                                                {sid ? (
                                                    <span className="ml-2 text-[10px] font-mono text-slate-400 font-normal">
                                                        #{sid}
                                                    </span>
                                                ) : null}
                                            </p>
                                            {targetLine ? (
                                                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">
                                                    Target: {targetLine}
                                                </p>
                                            ) : null}
                                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                                <Clock size={12} className="shrink-0 text-slate-400" />
                                                <span>
                                                    Initiated:{' '}
                                                    {entry.date
                                                        ? `${new Date(entry.date).toLocaleDateString()} ${new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                        : '—'}
                                                </span>
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {showHandoverDoc && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleHandoverDocument(entry)}
                                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50/80 transition-colors"
                                                    title="View handover document from this date & time"
                                                    aria-label="View handover document from this date and time"
                                                >
                                                    <FileText size={16} strokeWidth={2} />
                                                </button>
                                            )}
                                            <span
                                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${badge.className}`}
                                            >
                                                {badge.label === 'COMPLETED' && (
                                                    <CheckCircle2 size={12} className="text-emerald-600" />
                                                )}
                                                {badge.label}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => toggle(id)}
                                                className="p-1.5 rounded-lg border border-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                                                aria-expanded={expandedNow}
                                                aria-label={expandedNow ? 'Collapse details' : 'Expand details'}
                                            >
                                                <ChevronDown
                                                    size={18}
                                                    className={`transition-transform ${expandedNow ? 'rotate-180' : ''}`}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {expandedNow && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                                            <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4 space-y-2">
                                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                                    <MessageSquare size={14} className="text-emerald-600" />
                                                    What this step means
                                                </div>
                                                <p className="text-sm text-slate-700 leading-relaxed">
                                                    {requestSummary.split('**').map((part, i) =>
                                                        i % 2 === 1 ? (
                                                            <strong key={i} className="font-semibold text-slate-900">
                                                                {part}
                                                            </strong>
                                                        ) : (
                                                            <span key={i}>{part}</span>
                                                        )
                                                    )}
                                                </p>
                                            </div>

                                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-2">
                                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800">
                                                    <Reply size={14} />
                                                    Reply &amp; attachments
                                                </div>
                                                {entry.comments && String(entry.comments).trim() ? (
                                                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                                                        {entry.comments}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-slate-500 italic">
                                                        No written reply or notes were added on this step.
                                                    </p>
                                                )}
                                                {hasFile && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onViewFile?.(entry.file)}
                                                        className="inline-flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-white border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wide hover:bg-emerald-50 transition-colors"
                                                    >
                                                        <Eye size={14} />
                                                        View attachment
                                                    </button>
                                                )}
                                            </div>

                                            {showHandoverDoc && (
                                                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                                        <FileText size={14} className="text-emerald-600" />
                                                        Document at this time
                                                    </div>
                                                    <p className="text-xs text-slate-600 leading-relaxed">
                                                        Opens the handover view captured for this history step (asset state when this event was recorded).
                                                    </p>
                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleHandoverDocument(entry)}
                                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wide hover:bg-emerald-700 transition-colors"
                                                        >
                                                            <FileText size={14} />
                                                            View document
                                                        </button>
                                                        {onHandoverPdfDownload && entry._id ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => onHandoverPdfDownload(String(entry._id))}
                                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-[11px] font-bold uppercase tracking-wide hover:bg-slate-50 transition-colors"
                                                            >
                                                                <Printer size={14} />
                                                                Download PDF
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => setDetailEntry(entry)}
                                                className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wide"
                                            >
                                                Open full details
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                    </div>
                </div>
            </div>

            {detailEntry && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={() => setDetailEntry(null)}
                    role="presentation"
                >
                    <div
                        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="history-detail-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="h-1 w-full bg-emerald-500 shrink-0" />
                        <div className="p-6 sm:p-8 overflow-y-auto">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-emerald-600 shrink-0">
                                    {(() => {
                                        const I = actionIcon(detailEntry.action);
                                        return <I size={22} strokeWidth={2} />;
                                    })()}
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <h2
                                        id="history-detail-title"
                                        className="text-lg font-black text-slate-900 leading-tight"
                                    >
                                        {buildCardTitle(detailEntry, copyMode)}
                                    </h2>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Plain-language summary of this history event. Use it to understand who did what and
                                        when—without guessing from codes or internal labels.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-5 text-sm text-slate-700 leading-relaxed">
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                                        Description
                                    </h3>
                                    <p>
                                        {buildRequestSummary(detailEntry, copyMode).split('**').map((part, i) =>
                                            i % 2 === 1 ? (
                                                <strong key={i} className="font-semibold text-slate-900">
                                                    {part}
                                                </strong>
                                            ) : (
                                                <span key={i}>{part}</span>
                                            )
                                        )}
                                    </p>
                                </div>

                                {(detailEntry.assignedToType === 'Company' && detailEntry.assignedCompany) ||
                                detailEntry.assignedTo ? (
                                    <div className="rounded-xl bg-blue-50/60 border border-blue-100 px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-wide text-blue-700 mb-1">
                                            Target
                                        </p>
                                        <p className="text-sm font-semibold text-blue-900">
                                            {detailEntry.assignedToType === 'Company' && detailEntry.assignedCompany
                                                ? fmtCompany(detailEntry.assignedCompany)
                                                : fmtPerson(detailEntry.assignedTo)}
                                        </p>
                                    </div>
                                ) : null}

                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Clock size={14} />
                                    <span>
                                        {detailEntry.date
                                            ? `${new Date(detailEntry.date).toLocaleString()}`
                                            : '—'}
                                    </span>
                                </div>

                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-2">
                                        <Reply size={14} />
                                        Reply or notes
                                    </h3>
                                    {detailEntry.comments && String(detailEntry.comments).trim() ? (
                                        <p className="whitespace-pre-wrap text-slate-800">{detailEntry.comments}</p>
                                    ) : (
                                        <p className="text-slate-500 italic text-sm">No reply or notes were saved for this event.</p>
                                    )}
                                </div>

                                {detailEntry.file && (
                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onViewFile?.(detailEntry.file);
                                            }}
                                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold uppercase tracking-wide hover:bg-emerald-700 transition-colors w-full sm:w-auto justify-center"
                                        >
                                            <FileText size={16} />
                                            View attachment
                                        </button>
                                    </div>
                                )}

                                {historyHasSnapshotDocument(detailEntry) && (
                                    <div className="pt-4 space-y-2">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-2">
                                            <FileText size={14} />
                                            Document at this time
                                        </h3>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Handover snapshot from when this event was logged.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleHandoverDocument(detailEntry)}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold uppercase tracking-wide hover:bg-emerald-700 transition-colors"
                                            >
                                                <FileText size={16} />
                                                View document
                                            </button>
                                            {onHandoverPdfDownload && detailEntry._id ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onHandoverPdfDownload(String(detailEntry._id))}
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wide hover:bg-slate-50 transition-colors"
                                                >
                                                    <Printer size={16} />
                                                    Download PDF
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setDetailEntry(null)}
                                    className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wide hover:bg-slate-800 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {handoverFrame && (
                <div
                    className="fixed inset-0 z-[95] flex items-stretch justify-center bg-slate-900/55 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200"
                    onClick={() => setHandoverFrame(null)}
                    role="presentation"
                >
                    <div
                        className="flex flex-col w-full max-w-6xl h-[min(92vh,calc(100dvh-2rem))] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="handover-doc-modal-title"
                    >
                        <div className="h-1 w-full bg-emerald-500 shrink-0" />
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Handover document
                                </p>
                                <h2
                                    id="handover-doc-modal-title"
                                    className="text-sm font-bold text-slate-900 truncate pr-2"
                                    title={handoverFrame.label}
                                >
                                    {handoverFrame.label}
                                </h2>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        window.open(handoverFrame.url, '_blank', 'noopener,noreferrer');
                                    }}
                                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-colors"
                                >
                                    <ExternalLink size={14} />
                                    New tab
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHandoverFrame(null)}
                                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                    aria-label="Close document"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 bg-slate-100">
                            <iframe
                                key={handoverFrame.url}
                                src={handoverFrame.url}
                                title="Handover document at this history step"
                                className="w-full h-full border-0 bg-white"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
