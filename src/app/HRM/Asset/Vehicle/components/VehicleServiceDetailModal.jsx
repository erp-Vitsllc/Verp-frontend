'use client';

import { X, Settings, Calendar, Gauge, FileText, Download, Wrench } from 'lucide-react';
import { parseVehicleServiceRemark, formatNextChangeMonthDisplay } from './vehicleServiceUtils';

function Row({ label, value, showEmpty = false }) {
    const empty = value === undefined || value === null || value === '';
    if (empty && !showEmpty) return null;
    return (
        <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
            <span className="text-xs font-semibold text-slate-500 shrink-0">{label}</span>
            <span className="text-sm font-medium text-slate-800 text-right break-words max-w-[65%]">
                {empty ? '—' : value}
            </span>
        </div>
    );
}

function fmtDate(d) {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleString();
    } catch {
        return String(d);
    }
}

export default function VehicleServiceDetailModal({
    isOpen,
    onClose,
    serviceRecord: srv,
    serviceTypeLabel,
    previousRecord,
    onOpenFile,
}) {
    if (!isOpen || !srv) return null;

    const meta = parseVehicleServiceRemark(srv);
    const isSchedule =
        serviceTypeLabel === 'Oil Service' ||
        serviceTypeLabel === 'Tire Change' ||
        serviceTypeLabel === 'Car Wash';

    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-slate-100"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="h-1 w-full bg-[#13c5c0] shrink-0" />
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-[#00B5AD] shrink-0">
                            <Wrench size={20} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-black text-slate-900 truncate">{serviceTypeLabel}</h2>
                            <p className="text-[11px] text-slate-500 font-medium">Full service record</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto px-6 py-5 space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <Calendar size={12} />
                            Previous service (same type)
                        </div>
                        <p className="text-sm font-bold text-slate-800">
                            {previousRecord?.date ? fmtDate(previousRecord.date) : 'No earlier service of this type on record.'}
                        </p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            This is the visit before the current card. Use it to see how often this vehicle is serviced.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-2">
                            <Settings size={14} />
                            Core details
                        </h3>
                        <div className="rounded-2xl border border-slate-100 px-4 bg-white">
                            <Row label="Service date" value={srv.date ? fmtDate(srv.date) : undefined} showEmpty />
                            <Row
                                label="Amount"
                                value={srv.value != null ? `AED ${Number(srv.value).toLocaleString()}` : undefined}
                                showEmpty
                            />
                            <Row
                                label="Amount type"
                                value={
                                    meta?.amountMode === 'warranty'
                                        ? 'Warranty'
                                        : meta?.amountMode === 'amount'
                                          ? 'Amount'
                                          : undefined
                                }
                                showEmpty
                            />
                            <Row label="Paid by" value={srv.paidBy || undefined} showEmpty />
                            <Row
                                label="Current KM"
                                value={srv.currentKm != null ? `${srv.currentKm} KM` : undefined}
                                showEmpty
                            />
                            <Row label="Description" value={srv.description || undefined} showEmpty />
                        </div>
                    </div>

                    {isSchedule && (
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-2">
                                <Gauge size={14} />
                                Oil / tire / wash schedule
                            </h3>
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4">
                                {serviceTypeLabel === 'Oil Service' && (
                                    <Row label="Oil service type" value={meta?.oilServiceTypeText || undefined} showEmpty />
                                )}
                                {serviceTypeLabel === 'Tire Change' && (
                                    <Row
                                        label="Tire count"
                                        value={meta?.tireNumber != null ? String(meta.tireNumber) : undefined}
                                        showEmpty
                                    />
                                )}
                                <Row
                                    label="Next change KM"
                                    value={
                                        meta &&
                                        meta.nextChangeKm !== undefined &&
                                        meta.nextChangeKm !== null &&
                                        String(meta.nextChangeKm).trim() !== ''
                                            ? `${meta.nextChangeKm} KM`
                                            : undefined
                                    }
                                    showEmpty
                                />
                                <Row
                                    label="Next change month"
                                    value={
                                        meta?.nextChangeMonth
                                            ? formatNextChangeMonthDisplay(meta.nextChangeMonth)
                                            : undefined
                                    }
                                    showEmpty
                                />
                            </div>
                        </div>
                    )}

                    {(serviceTypeLabel === 'Mechanical Work' || serviceTypeLabel === 'Body Work') && (
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                                Liability
                            </h3>
                            <div className="rounded-2xl border border-slate-100 px-4 bg-white">
                                <Row
                                    label="Liable on"
                                    value={
                                        meta?.liableOn === 'person'
                                            ? 'Person'
                                            : meta?.liableOn === 'company'
                                              ? 'Company'
                                              : undefined
                                    }
                                    showEmpty
                                />
                                <Row label="Liable person (ID)" value={meta?.liablePersonId || undefined} showEmpty />
                                <Row label="Attachment name" value={meta?.attachmentName || undefined} showEmpty />
                            </div>
                        </div>
                    )}

                    {serviceTypeLabel === 'Accident Repair' && (
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                                Accident
                            </h3>
                            <div className="rounded-2xl border border-slate-100 px-4 bg-white">
                                <Row
                                    label="Accident date"
                                    value={meta?.accidentDate ? fmtDate(meta.accidentDate) : undefined}
                                    showEmpty
                                />
                                <Row
                                    label="Policy report date"
                                    value={meta?.policyReportDate ? fmtDate(meta.policyReportDate) : undefined}
                                    showEmpty
                                />
                                <Row label="Accident owner" value={meta?.accidentOwner || undefined} showEmpty />
                                <Row label="Accident status" value={meta?.accidentStatus || undefined} showEmpty />
                                <Row label="Insurance approval" value={meta?.insuranceApprovalStatus || undefined} showEmpty />
                                <Row label="Attachment name" value={meta?.attachmentName || undefined} showEmpty />
                            </div>
                        </div>
                    )}

                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-2">
                            <FileText size={14} />
                            Files
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {srv.invoice ? (
                                <button
                                    type="button"
                                    onClick={() => onOpenFile?.(srv.invoice)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wide hover:bg-slate-800"
                                >
                                    <Download size={14} />
                                    Open invoice
                                </button>
                            ) : (
                                <span className="text-xs text-slate-400">No invoice uploaded.</span>
                            )}
                            {srv.attachment ? (
                                <button
                                    type="button"
                                    onClick={() => onOpenFile?.(srv.attachment)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-800 text-[11px] font-bold uppercase tracking-wide hover:bg-slate-50"
                                >
                                    <Download size={14} />
                                    Open attachment
                                </button>
                            ) : (
                                <span className="text-xs text-slate-400">No attachment uploaded.</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-white">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wide hover:bg-slate-800"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
