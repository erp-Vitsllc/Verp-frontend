'use client';

import { FileText, Paperclip, X } from 'lucide-react';

export function buildPendingRequestView(source, fallbackAction = '') {
    const details = source?.pendingActionDetails || {};
    const leaveDays = details.leaveDuration ?? details.duration ?? null;
    return {
        title: details.originalActionType || source?.pendingAction || fallbackAction || 'Request',
        reason: String(details.reason || details.description || '').trim(),
        attachment: details.attachment || details.file || null,
        leaveDays: leaveDays != null && leaveDays !== '' ? Number(leaveDays) : null,
        waitingForName: details.waitingForName || '',
        itemName: source?.name || source?.assetId || '',
    };
}

export function PendingRequestDetailsPanel({ request, onOpenAttachment, className = '' }) {
    if (!request) return null;
    const hasAttachment = !!request.attachment;
    const leaveDays = Number.isFinite(request.leaveDays) && request.leaveDays > 0 ? request.leaveDays : null;

    return (
        <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-left ${className}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Request description</p>
            <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">
                {request.reason || 'No description was provided with this request.'}
            </p>
            {leaveDays ? (
                <p className="text-xs font-bold text-amber-700">Leave duration: {leaveDays} day(s)</p>
            ) : null}
            {hasAttachment ? (
                <button
                    type="button"
                    onClick={() => onOpenAttachment?.(request.attachment, `${request.title || 'Request'} attachment`)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100"
                >
                    <Paperclip size={14} />
                    View attachment
                </button>
            ) : (
                <p className="text-[11px] font-semibold text-slate-400">No attachment</p>
            )}
        </div>
    );
}

export default function PendingAssetRequestViewModal({ isOpen, request, onClose, onOpenAttachment }) {
    if (!isOpen || !request) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm shrink-0">
                            <FileText size={20} strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight truncate">
                                {request.title} request
                            </h2>
                            {request.itemName ? (
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest truncate">
                                    {request.itemName}
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all shadow-sm shrink-0"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <PendingRequestDetailsPanel request={request} onOpenAttachment={onOpenAttachment} />
                    {request.waitingForName ? (
                        <p className="text-[11px] font-semibold text-slate-500">
                            Waiting on <span className="font-black text-slate-700">{request.waitingForName}</span>
                        </p>
                    ) : null}
                </div>
                <div className="px-6 pb-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
