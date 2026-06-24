'use client';

import { useState } from 'react';
import { Check, X, History, Banknote, CalendarClock, Package, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { formatHistoryDate } from './buildWorkflowHistoryEvents';
import { openWorkflowDocumentLink } from './openWorkflowDocumentLink';

function resolveEventLinks(event) {
    if (event.links?.length) return event.links;
    if (event.url || event.publicId) {
        return [{
            label: event.linkLabel || 'View PDF',
            url: event.url || '',
            publicId: event.publicId || '',
            source: event.source || '',
        }];
    }
    if (event.attachments?.length) {
        return event.attachments
            .filter((att) => att.url || att.publicId)
            .map((att) => ({
                label: att.label || att.name || 'View PDF',
                url: att.url || '',
                publicId: att.publicId || '',
                source: att.source || '',
            }));
    }
    return [];
}

function shouldShowEventDetail(event) {
    if (!event.detail) return false;
    if (!event.links?.length) return true;
    const detail = String(event.detail).trim();
    if (/\.(pdf|png|jpe?g|docx?)$/i.test(detail)) return false;
    const linkLabels = event.links.map((l) => String(l.label || '').trim().toLowerCase());
    if (linkLabels.includes(detail.toLowerCase())) return false;
    return true;
}

function InlineDocumentLinks({ links = [], entityKind, entityRouteId }) {
    const [openingKey, setOpeningKey] = useState('');

    if (!links.length) return null;

    const handleOpen = async (link, idx) => {
        const key = `${link.publicId || link.url || link.label}-${idx}`;
        setOpeningKey(key);
        try {
            await openWorkflowDocumentLink(link, { entityKind, entityRouteId });
        } finally {
            setOpeningKey('');
        }
    };

    return (
        <>
            {links.map((link, idx) => {
                const key = `${link.publicId || link.url || link.label}-${idx}`;
                const isOpening = openingKey === key;

                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => handleOpen(link, idx)}
                        disabled={isOpening}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 disabled:opacity-60"
                    >
                        {isOpening ? <Loader2 size={12} className="animate-spin" /> : null}
                        {link.label}
                    </button>
                );
            })}
        </>
    );
}

const BADGE_CLASSES = {
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    pending: 'bg-blue-50 text-blue-700 border-blue-200',
    scheduled: 'bg-gray-50 text-gray-400 border-gray-200',
    payment: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function EventIcon({ event }) {
    if (event.kind === 'workflow') {
        const approved = event.badgeVariant === 'approved';
        const rejected = event.badgeVariant === 'rejected';
        const pending = event.badgeVariant === 'pending';
        return (
            <div
                className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300 z-10 ${
                    approved
                        ? 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-200'
                        : rejected
                          ? 'bg-red-500 border-red-500 text-white shadow-sm shadow-red-200'
                          : pending
                            ? 'bg-white border-blue-500 text-blue-500 ring-4 ring-blue-50'
                            : 'bg-white border-red-200 text-red-400'
                }`}
            >
                {approved ? (
                    <Check size={12} strokeWidth={3} />
                ) : rejected ? (
                    <X size={12} strokeWidth={3} />
                ) : (
                    event.stepNumber
                )}
            </div>
        );
    }

    const iconMap = {
        payment: Banknote,
        'schedule-edit': CalendarClock,
        'asset-controller': Package,
        attachment: FileText,
        status: CheckCircle2,
    };
    const Icon = iconMap[event.kind] || CheckCircle2;

    return (
        <div className="absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-white border-indigo-400 text-indigo-600 shadow-sm z-10">
            <Icon size={12} strokeWidth={2.5} />
        </div>
    );
}

export default function WorkflowHistoryTimeline({
    title = 'Workflow History',
    subtitle = 'Timeline of creation, approvals, and post-approval activity',
    events = [],
    emptyMessage = 'No history available yet.',
    entityKind = '',
    entityRouteId = '',
}) {
    if (!events.length) {
        return (
            <div className="flex-1 flex flex-col py-2">
                <p className="text-sm text-gray-500 text-center py-8">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-6">
                <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
                    <History size={24} />
                </div>
                <div>
                    <h4 className="text-lg font-bold text-gray-800">{title}</h4>
                    <p className="text-xs text-gray-500">{subtitle}</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col py-2 ml-2">
                {events.map((event, idx) => {
                    const isLast = idx === events.length - 1;
                    const connectorGreen = !isLast && (event.connectorGreen ?? true);
                    const documentLinks = resolveEventLinks(event);

                    return (
                        <div key={event.id} className={`relative pl-10 ${!isLast ? 'pb-8' : ''}`}>
                            {!isLast && (
                                <div
                                    className={`absolute left-[11px] top-7 bottom-0 w-[3px] rounded-full transition-colors duration-500 ${
                                        connectorGreen ? 'bg-green-500' : 'bg-red-200'
                                    }`}
                                    aria-hidden
                                />
                            )}

                            <EventIcon event={event} />

                            <div className="flex flex-col text-sm text-gray-700">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-gray-800 text-sm">{event.label}</span>
                                    <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                            BADGE_CLASSES[event.badgeVariant] || BADGE_CLASSES.scheduled
                                        }`}
                                    >
                                        {event.badge}
                                    </span>
                                    <InlineDocumentLinks
                                        links={documentLinks}
                                        entityKind={entityKind}
                                        entityRouteId={entityRouteId}
                                    />
                                </div>

                                {event.actor && (
                                    <span className="text-xs text-gray-500 mt-1 font-medium">
                                        Action by:{' '}
                                        <span className="font-semibold text-gray-700">{event.actor}</span>
                                    </span>
                                )}

                                {shouldShowEventDetail(event) && (
                                    <span className="text-xs text-gray-600 mt-1 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 inline-block w-fit">
                                        {event.detail}
                                    </span>
                                )}

                                {event.date && (
                                    <span className="text-[11px] text-gray-400 mt-0.5">
                                        Date: {formatHistoryDate(event.date)}
                                    </span>
                                )}

                                {event.rejectionReason && (
                                    <div className="mt-2 text-xs text-red-600 bg-red-50/50 border border-red-100 p-2.5 rounded-lg font-medium italic">
                                        Reason: {event.rejectionReason}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
