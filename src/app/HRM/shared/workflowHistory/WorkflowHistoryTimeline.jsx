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
    paymentPending: 'bg-amber-50 text-amber-700 border-amber-200',
    scheduled: 'bg-gray-50 text-gray-400 border-gray-200',
    payment: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function EventIcon({ event, size = 'default' }) {
    const isLarge = size === 'large';
    const iconBoxClass = isLarge
        ? 'absolute left-0 top-0.5 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-[3px] transition-all duration-300 z-10'
        : 'absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300 z-10';
    const checkSize = isLarge ? 16 : 12;

    if (event.kind === 'workflow') {
        const approved = event.badgeVariant === 'approved';
        const rejected = event.badgeVariant === 'rejected';
        const pending = event.badgeVariant === 'pending';
        return (
            <div
                className={`${iconBoxClass} ${
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
                    <Check size={checkSize} strokeWidth={3} />
                ) : rejected ? (
                    <X size={checkSize} strokeWidth={3} />
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
    const smallIconSize = isLarge ? 16 : 12;

    if (event.kind === 'payment') {
        const completed = event.badgeVariant === 'approved';
        const pending = event.badgeVariant === 'paymentPending';
        return (
            <div
                className={`${iconBoxClass} ${
                    completed
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : pending
                          ? 'bg-amber-400 border-amber-400 text-white'
                          : 'bg-white border-emerald-400 text-emerald-600'
                }`}
            >
                <Icon size={smallIconSize} strokeWidth={2.5} />
            </div>
        );
    }

    return (
        <div className={`${iconBoxClass} bg-white border-indigo-400 text-indigo-600 shadow-sm`}>
            <Icon size={smallIconSize} strokeWidth={2.5} />
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
    size = 'default',
    verticalSpread = false,
    compact = false,
    layoutConfig = null,
    className = '',
}) {
    const isLarge = size === 'large';
    const useSpread = layoutConfig
        ? layoutConfig.verticalSpread && isLarge
        : isLarge && verticalSpread;

    const stepGapClass = layoutConfig
        ? layoutConfig.steps?.gapBottomClass || 'pb-4'
        : compact && isLarge
          ? 'pb-4'
          : isLarge
            ? 'pb-6'
            : 'pb-8';

    const stepPaddingLeftClass = layoutConfig
        ? layoutConfig.steps?.paddingLeftClass || (isLarge ? 'pl-14' : 'pl-10')
        : isLarge
          ? 'pl-14'
          : 'pl-10';

    const stepMinHeightPx = layoutConfig?.steps?.minHeightPx ?? (compact && isLarge ? 88 : null);
    const spreadMinHeightPx = layoutConfig?.steps?.spreadMinHeightPx ?? 72;
    const showTrailingLine = layoutConfig?.spread?.trailingLine ?? false;
    const spreadListPaddingYClass = layoutConfig?.spread?.listPaddingYClass ?? 'py-4';

    const headerPaddingClass = layoutConfig
        ? layoutConfig.header?.paddingBottomClass
        : compact && isLarge
          ? 'pb-3'
          : isLarge
            ? 'pb-4'
            : 'pb-4';

    const headerMarginClass = layoutConfig
        ? layoutConfig.header?.marginBottomClass
        : compact && isLarge
          ? 'mb-4'
          : isLarge
            ? 'mb-5'
            : 'mb-6';

    const listPaddingYClass = layoutConfig?.list?.paddingYClass ?? (isLarge ? 'py-1' : 'py-2');
    const listMarginLeftClass = layoutConfig?.list?.marginLeftClass ?? (isLarge ? 'ml-3' : 'ml-2');

    const labelGapClass = layoutConfig?.text?.labelGapClass ?? (compact && isLarge ? 'gap-2' : 'gap-3');
    const leadingClass = layoutConfig?.text?.leadingClass ?? (compact && isLarge ? 'leading-snug' : '');
    const actorMarginClass =
        layoutConfig?.text?.actorMarginTopClass ?? (compact && isLarge ? 'mt-1' : isLarge ? 'mt-2' : 'mt-2');
    const dateMarginClass =
        layoutConfig?.text?.dateMarginTopClass ?? (compact && isLarge ? 'mt-0.5' : isLarge ? 'mt-1' : 'mt-1');

    const connectorTopClass = layoutConfig?.connector?.topClass ?? (isLarge ? 'top-10' : 'top-7');
    const connectorLeftClass = layoutConfig?.connector?.leftClass ?? (isLarge ? 'left-[17px]' : 'left-[11px]');
    const connectorWidthClass = layoutConfig?.connector?.widthClass ?? (isLarge ? 'w-1' : 'w-[3px]');

    const spreadListClass = layoutConfig?.spread?.listPaddingYClass ?? 'py-4';
    const spreadPadRem = spreadListClass.includes('py-8') ? '2rem' : spreadListClass.includes('py-6') ? '1.5rem' : '1rem';
    const spreadIconCenterRem = isLarge ? '1.25rem' : '0.875rem';
    const spreadLineInset = `calc(${spreadPadRem} + ${spreadIconCenterRem})`;

    if (!events.length) {
        return (
            <div className="flex flex-col py-2 shrink-0">
                <p className={`text-gray-500 text-center py-8 ${isLarge ? 'text-base' : 'text-sm'}`}>
                    {emptyMessage}
                </p>
            </div>
        );
    }

    return (
        <div
            className={`${useSpread ? 'flex h-full min-h-0 flex-1 flex-col' : 'shrink-0'} ${className}`.trim()}
        >
            <div
                className={`flex items-center gap-3 border-b border-gray-100 shrink-0 ${headerPaddingClass} ${headerMarginClass}`}
            >
                <div className={`bg-blue-50 rounded-xl text-blue-600 ${isLarge ? 'p-3.5' : 'p-2.5'}`}>
                    <History size={isLarge ? 30 : 24} />
                </div>
                <div>
                    <h4 className={`font-bold text-gray-800 ${isLarge ? 'text-xl' : 'text-lg'}`}>{title}</h4>
                    <p className={`text-gray-500 ${isLarge ? 'text-sm mt-1' : 'text-xs'}`}>{subtitle}</p>
                </div>
            </div>

            <div
                className={`relative ${
                    useSpread
                        ? `grid min-h-0 flex-1 ${spreadListPaddingYClass} ${listMarginLeftClass}`
                        : `flex flex-col shrink-0 ${listPaddingYClass} ${listMarginLeftClass}`
                }`}
                style={
                    useSpread
                        ? { gridTemplateRows: `repeat(${events.length}, minmax(0, 1fr))` }
                        : undefined
                }
            >
                {useSpread && events.length > 1 ? (
                    <div
                        className={`pointer-events-none absolute w-1 -translate-x-1/2 rounded-full ${connectorWidthClass} ${
                            events.every((event, idx) => idx === events.length - 1 || (event.connectorGreen ?? true))
                                ? 'bg-green-500'
                                : 'bg-gradient-to-b from-green-500 from-60% to-slate-200 to-60%'
                        }`}
                        style={{
                            left: isLarge ? '18px' : '12px',
                            top: spreadLineInset,
                            bottom: spreadLineInset,
                        }}
                        aria-hidden
                    />
                ) : null}

                {events.map((event, idx) => {
                    const isLast = idx === events.length - 1;
                    const connectorGreen = !isLast && (event.connectorGreen ?? true);
                    const prevConnectorGreen =
                        idx > 0 ? (events[idx - 1].connectorGreen ?? true) : connectorGreen;
                    const documentLinks = resolveEventLinks(event);
                    const showConnector = !useSpread && (!isLast || (isLast && useSpread && showTrailingLine));
                    const connectorColorClass =
                        isLast && useSpread && showTrailingLine
                            ? prevConnectorGreen
                                ? 'bg-green-500'
                                : 'bg-red-200'
                            : connectorGreen
                              ? 'bg-green-500'
                              : 'bg-red-200';

                    return (
                        <div
                            key={event.id}
                            className={`relative ${stepPaddingLeftClass} ${
                                useSpread ? 'flex min-h-0 items-start' : 'shrink-0'
                            } ${useSpread ? '' : !isLast ? stepGapClass : ''}`}
                            style={
                                !useSpread && stepMinHeightPx && !isLast
                                    ? { minHeight: `${stepMinHeightPx}px` }
                                    : undefined
                            }
                        >
                            {showConnector && (
                                <div
                                    className={`absolute rounded-full transition-colors duration-500 bottom-0 ${connectorTopClass} ${connectorLeftClass} ${connectorWidthClass} ${connectorColorClass}`}
                                    aria-hidden
                                />
                            )}

                            <EventIcon event={event} size={size} />

                            <div
                                className={`flex flex-col text-gray-700 ${isLarge ? 'text-base' : 'text-sm'} ${leadingClass}`}
                            >
                                <div className={`flex items-center flex-wrap ${labelGapClass}`}>
                                    <span className={`font-bold text-gray-800 ${isLarge ? 'text-base' : 'text-sm'}`}>
                                        {event.label}
                                    </span>
                                    <span
                                        className={`rounded font-bold uppercase tracking-wider border ${
                                            isLarge
                                                ? 'px-2.5 py-1 text-xs'
                                                : 'px-2 py-0.5 text-[10px]'
                                        } ${BADGE_CLASSES[event.badgeVariant] || BADGE_CLASSES.scheduled}`}
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
                                    <span
                                        className={`text-gray-500 font-medium ${actorMarginClass} ${isLarge ? 'text-sm' : 'text-xs'}`}
                                    >
                                        Action by:{' '}
                                        <span className="font-semibold text-gray-800">{event.actor}</span>
                                    </span>
                                )}

                                {shouldShowEventDetail(event) && (
                                    <span
                                        className={`text-gray-600 mt-2 bg-gray-50 border border-gray-100 rounded-lg inline-block w-fit ${
                                            isLarge ? 'text-sm px-3 py-2' : 'text-xs px-2.5 py-1.5'
                                        }`}
                                    >
                                        {event.detail}
                                    </span>
                                )}

                                {event.date && (
                                    <span
                                        className={`text-gray-400 ${dateMarginClass} ${isLarge ? 'text-sm' : 'text-[11px]'}`}
                                    >
                                        Date: {formatHistoryDate(event.date)}
                                    </span>
                                )}

                                {event.rejectionReason && (
                                    <div
                                        className={`mt-2 text-red-600 bg-red-50/50 border border-red-100 rounded-lg font-medium italic ${
                                            isLarge ? 'text-sm p-3' : 'text-xs p-2.5'
                                        }`}
                                    >
                                        Reason: {event.rejectionReason}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
