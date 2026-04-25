'use client';

import { useMemo } from 'react';
import { Settings, Gauge, FileText, ClipboardList } from 'lucide-react';
import { parseVehicleServiceRemark, formatNextChangeMonthDisplay } from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';

function Row({ label, value, showEmpty = false }) {
    const empty = value === undefined || value === null || value === '';
    if (empty && !showEmpty) return null;
    return (
        <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">{label}</span>
            <span className="text-sm font-medium text-slate-800 text-right break-words max-w-[70%]">
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

function approvalStatusPresentation(row) {
    const stage = row.workflowStage;
    const typeLbl = row.workflowServiceTypeLabel || row.serviceType || '';

    if (row.workflowSnapshot?.trailIncomplete) {
        return {
            badge: 'Timeline not on file',
            badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
            detail:
                'Could not match this row to stored approval history. Use vehicle details → Service tab for the live workflow.',
        };
    }

    if (row.workflowSnapshot) {
        const map = {
            pending_hr: { title: 'Awaiting HR', className: 'bg-amber-100 text-amber-950 border-amber-200' },
            pending_accounts: { title: 'Awaiting Accounts', className: 'bg-sky-100 text-sky-950 border-sky-200' },
            pending_admin: { title: 'On service (Asset Controller)', className: 'bg-violet-100 text-violet-950 border-violet-200' },
            scheduled_service: { title: 'Scheduled in-shop service', className: 'bg-fuchsia-100 text-fuchsia-950 border-fuchsia-200' },
            pending_management: { title: 'Awaiting Management', className: 'bg-indigo-100 text-indigo-950 border-indigo-200' },
            complete: { title: 'Workflow complete', className: 'bg-emerald-100 text-emerald-950 border-emerald-200' },
            rejected: { title: 'Workflow rejected', className: 'bg-red-100 text-red-950 border-red-200' },
        };
        const m = map[stage] || {
            title: stage ? String(stage) : 'In workflow',
            className: 'bg-slate-100 text-slate-800 border-slate-200',
        };
        return {
            badge: m.title,
            badgeClass: m.className,
            detail: typeLbl ? `Service: ${typeLbl}` : 'Multi-step approval in progress or completed.',
        };
    }

    if (row.vehicleHasDifferentActiveWorkflow) {
        return {
            badge: 'Another service is active',
            badgeClass: 'bg-blue-50 text-blue-950 border-blue-200',
            detail: 'This vehicle has a different service request in the approval pipeline.',
        };
    }

    return {
        badge: 'No linked workflow',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        detail:
            'This record is not the one attached to the vehicle’s workflow (older entry, or workflow was not started).',
    };
}

/**
 * Service record fields + approval status for the fleet “service requests” expand panel.
 * `row` should include fields from GET /AssetItem/vehicle-fleet-service-requests.
 */
export default function VehicleServiceRequestRecordDetails({ row }) {
    const meta = useMemo(() => parseVehicleServiceRemark({ remark: row.remark || '' }), [row.remark]);
    const serviceTypeLabel = row.serviceType || '';
    const isSchedule =
        serviceTypeLabel === 'Oil Service' ||
        serviceTypeLabel === 'Tire Change' ||
        serviceTypeLabel === 'Car Wash';

    const status = approvalStatusPresentation(row);

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center gap-3">
                <ClipboardList size={18} className="text-teal-600 shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Service details</p>
                    <p className="text-xs text-slate-600 mt-0.5">{status.detail}</p>
                </div>
                <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wide border ${status.badgeClass}`}
                >
                    {status.badge}
                </span>
            </div>

            <div className="px-4 py-3 space-y-4">
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-2">
                        <Settings size={14} />
                        Core
                    </h3>
                    <div className="rounded-xl border border-slate-100 px-3 bg-slate-50/50">
                        <Row label="Service date" value={row.date ? fmtDate(row.date) : undefined} showEmpty />
                        <Row
                            label="Amount"
                            value={row.value != null ? `AED ${Number(row.value).toLocaleString()}` : undefined}
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
                        <Row label="Paid by" value={row.paidBy || undefined} showEmpty />
                        <Row
                            label="Current KM"
                            value={row.currentKm != null ? `${row.currentKm} KM` : undefined}
                            showEmpty
                        />
                        <Row
                            label="Approved quotation"
                            value={
                                meta?.approvedQuotationChoice === 'q1'
                                    ? 'Quotation 1'
                                    : meta?.approvedQuotationChoice === 'q2'
                                      ? 'Quotation 2'
                                      : meta?.approvedQuotationChoice === 'q3'
                                        ? 'Quotation 3'
                                        : undefined
                            }
                            showEmpty
                        />
                        <Row label="Vendor" value={meta?.vendorName || undefined} showEmpty />
                        <Row label="Description" value={row.description || undefined} showEmpty />
                    </div>
                </div>

                {isSchedule && (
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-2">
                            <Gauge size={14} />
                            Oil / tire / wash schedule
                        </h3>
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3">
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
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Liability</h3>
                        <div className="rounded-xl border border-slate-100 px-3 bg-white">
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
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Accident</h3>
                        <div className="rounded-xl border border-slate-100 px-3 bg-white">
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
                        Files (this row)
                    </h3>
                    <div className="rounded-xl border border-slate-100 px-3 bg-slate-50/60">
                        <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100">
                            <span className="text-[11px] font-semibold text-slate-500 shrink-0">Quotation 1</span>
                            {row.attachment ? (
                                <a
                                    href={row.attachment}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-semibold text-teal-700 hover:text-teal-900 hover:underline text-right"
                                >
                                    Open file
                                </a>
                            ) : (
                                <span className="text-sm font-medium text-slate-800 text-right">—</span>
                            )}
                        </div>
                        <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100">
                            <span className="text-[11px] font-semibold text-slate-500 shrink-0">Quotation 2</span>
                            {row.quotation2 ? (
                                <a
                                    href={row.quotation2}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-semibold text-teal-700 hover:text-teal-900 hover:underline text-right"
                                >
                                    Open file
                                </a>
                            ) : (
                                <span className="text-sm font-medium text-slate-800 text-right">—</span>
                            )}
                        </div>
                        <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100">
                            <span className="text-[11px] font-semibold text-slate-500 shrink-0">Quotation 3</span>
                            {row.quotation3 ? (
                                <a
                                    href={row.quotation3}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-semibold text-teal-700 hover:text-teal-900 hover:underline text-right"
                                >
                                    Open file
                                </a>
                            ) : (
                                <span className="text-sm font-medium text-slate-800 text-right">—</span>
                            )}
                        </div>
                        <div className="flex items-start justify-between gap-4 py-2.5">
                            <span className="text-[11px] font-semibold text-slate-500 shrink-0">Invoice</span>
                            {row.invoice ? (
                                <a
                                    href={row.invoice}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-semibold text-teal-700 hover:text-teal-900 hover:underline text-right"
                                >
                                    Open file
                                </a>
                            ) : (
                                <span className="text-sm font-medium text-slate-800 text-right">—</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
