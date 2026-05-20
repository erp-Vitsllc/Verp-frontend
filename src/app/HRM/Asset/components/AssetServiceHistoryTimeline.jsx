'use client';

import { ArrowUpRight, ArrowDownLeft, CalendarClock, FileText } from 'lucide-react';
import {
    formatServiceHistoryDate,
    formatServiceHistoryDateTime,
    getServiceHistoryDetailRows,
    groupAssetServiceHistorySessions,
} from '@/utils/assetServiceHistoryDisplay';

function ServiceDetailGrid({ details, className = '' }) {
    const rows = getServiceHistoryDetailRows(details);
    if (!rows.length) return null;
    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 ${className}`}>
            {rows.map((row) => (
                <div key={row.label} className="space-y-0.5 min-w-0">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                        {row.label}
                    </span>
                    <p className="text-xs font-bold text-slate-700 break-words">{row.value}</p>
                </div>
            ))}
        </div>
    );
}

function DocumentButtons({ item, onViewFile }) {
    const files = [
        item?.file,
        item?.details?.invoice,
        item?.details?.attachment,
        item?.details?.serviceRecord?.invoice,
        item?.details?.serviceRecord?.attachment,
        item?.details?.completionRecord?.attachment,
    ].filter(Boolean);
    const unique = [...new Set(files)];
    if (!unique.length || !onViewFile) return null;
    return (
        <div className="flex flex-wrap gap-2 mt-3">
            {unique.map((url, idx) => (
                <button
                    key={`${url}-${idx}`}
                    type="button"
                    onClick={() => onViewFile(url)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-[10px] font-bold text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm"
                >
                    <FileText size={12} /> View document {unique.length > 1 ? idx + 1 : ''}
                </button>
            ))}
        </div>
    );
}

export default function AssetServiceHistoryTimeline({ assetHistory = [], onViewFile }) {
    const sessions = groupAssetServiceHistorySessions(assetHistory);

    if (!sessions.length) {
        return (
            <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                <CalendarClock size={48} strokeWidth={1} className="mb-4 opacity-20" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">No Service History</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {sessions.map((session, sIdx) => (
                <div
                    key={session.id || sIdx}
                    className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all"
                >
                    <div className={`h-1.5 w-full ${session.receive ? 'bg-emerald-500' : session.extends?.length ? 'bg-amber-400' : 'bg-blue-500'}`} />

                    <div className="p-6 space-y-6">
                        {session.send && (
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 shadow-sm">
                                    <ArrowUpRight size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                                                Service dispatched
                                            </span>
                                            <span className="text-xs font-black text-slate-800">
                                                {formatServiceHistoryDate(session.send.date)}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                                            By {session.send.performedBy?.firstName || 'Staff'} · {formatServiceHistoryDateTime(session.send.date)}
                                        </span>
                                    </div>
                                    {session.send.comments && (
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-50 mb-3">
                                            {session.send.comments}
                                        </p>
                                    )}
                                    <ServiceDetailGrid details={session.send.details} />
                                    <DocumentButtons item={session.send} onViewFile={onViewFile} />
                                </div>
                            </div>
                        )}

                        {session.extends?.map((ext) => (
                            <div key={ext._id} className="flex gap-4 ml-2 sm:ml-6 border-l-2 border-amber-200 pl-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0 shadow-sm">
                                    <CalendarClock size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                                Extended
                                            </span>
                                            <span className="text-xs font-black text-slate-800">
                                                {formatServiceHistoryDate(ext.date)}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                                            By {ext.performedBy?.firstName || 'Staff'}
                                        </span>
                                    </div>
                                    {ext.comments && (
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed bg-amber-50/40 p-3 rounded-xl border border-amber-100/80 mb-3">
                                            {ext.comments}
                                        </p>
                                    )}
                                    <ServiceDetailGrid details={ext.details} />
                                </div>
                            </div>
                        ))}

                        {session.receive && (
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0 shadow-sm">
                                    <ArrowDownLeft size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                                {session.receive.details?.serviceEventType === 'live' ? 'Marked live' : 'Service completed'}
                                            </span>
                                            <span className="text-xs font-black text-slate-800">
                                                {formatServiceHistoryDate(session.receive.date)}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                                            By {session.receive.performedBy?.firstName || 'Staff'} · {formatServiceHistoryDateTime(session.receive.date)}
                                        </span>
                                    </div>
                                    {session.receive.comments && (
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed bg-emerald-50/30 p-3 rounded-xl border border-emerald-50 mb-3">
                                            {session.receive.comments}
                                        </p>
                                    )}
                                    <ServiceDetailGrid details={session.receive.details} className="bg-emerald-50/20 p-3 rounded-xl border border-emerald-50/50" />
                                    <DocumentButtons item={session.receive} onViewFile={onViewFile} />
                                </div>
                            </div>
                        )}

                        {!session.receive && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 text-center py-1">
                                Service in progress
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
