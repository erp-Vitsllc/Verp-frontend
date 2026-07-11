'use client';

import { useMemo, useState } from 'react';
import { Download, PlusCircle } from 'lucide-react';
import {
    VEHICLE_SERVICE_TYPES,
    VEHICLE_SERVICE_TAB_REQUEST_TYPES,
    normalizeMongoId,
    formatNextChangeMonthDisplay,
    buildOilServiceRequestRowsFromAsset,
    buildCarWashRequestRowsFromAsset,
    buildVehicleServiceTabRequestRowsFromAsset,
} from './vehicleServiceUtils';

const OLD_PAGE_SIZE_OPTIONS = [5, 10, 50, 100];

const thClass =
    'px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 text-left whitespace-nowrap';
const tdClass = 'px-4 py-2.5 text-sm text-slate-700';

function statusBadgeClass(tone) {
    if (tone === 'draft') return 'bg-blue-100 text-blue-800';
    if (tone === 'complete') return 'bg-emerald-100 text-emerald-800';
    if (tone === 'scheduled') return 'bg-violet-100 text-violet-800';
    if (tone === 'rejected') return 'bg-slate-100 text-slate-600';
    return 'bg-amber-100 text-amber-800';
}

function formatDate(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return '—';
    }
}

function formatKm(value) {
    if (value == null || value === '' || value === '—') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return `${n.toLocaleString()} km`;
}

function formatAmount(value) {
    if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) return '—';
    return `AED ${Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function fleetServiceAttachmentRows(srv) {
    if (!srv) return [];
    const out = [];
    const add = (url, label) => {
        const u = url && String(url).trim();
        if (u) out.push({ label, url: u });
    };
    add(srv.attachment, 'Primary attachment');
    add(srv.invoice, 'Invoice');
    add(srv.shopInvoice, 'Shop invoice');
    add(srv.serviceCompletionReport, 'Service report');
    add(srv.quotation2, 'Quotation 2');
    add(srv.quotation3, 'Quotation 3');
    return out;
}

function findServiceRecord(asset, row) {
    if (row?.serviceRecord) return row.serviceRecord;
    const id = normalizeMongoId(row?.serviceId || row?.id);
    if (!id) return null;
    const services = Array.isArray(asset?.services) ? asset.services : [];
    return services.find((s) => normalizeMongoId(s?._id) === id) || null;
}

/** Same row lists as the vehicle Service tab, newest first. */
function buildServiceTabRowsForType(asset, serviceType) {
    if (!asset) return [];
    if (serviceType === 'Oil Service') return buildOilServiceRequestRowsFromAsset(asset);
    if (serviceType === 'Car Wash') return buildCarWashRequestRowsFromAsset(asset);
    if (VEHICLE_SERVICE_TAB_REQUEST_TYPES.includes(serviceType)) {
        return buildVehicleServiceTabRequestRowsFromAsset(asset, serviceType);
    }
    return [];
}

function AttachmentCell({ srv, onOpen }) {
    const rows = fleetServiceAttachmentRows(srv);
    const primary = rows[0];
    if (!primary) return <span className="text-slate-300">-</span>;
    return (
        <button
            type="button"
            onClick={() => onOpen?.(primary.url, primary.label || 'Attachment')}
            className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
        >
            <Download size={14} /> {primary.label || 'View'}
        </button>
    );
}

function StatusBadge({ label, tone }) {
    return (
        <span
            className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(tone)}`}
        >
            {label || 'Pending'}
        </span>
    );
}

function OldPaginationBar({ page, pageSize, total, onPageChange, onPageSizeChange }) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(total, safePage * pageSize);

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Show</span>
                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                    aria-label="Rows per page"
                >
                    {OLD_PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
                <span>per page</span>
                <span className="text-slate-400">
                    · {from}-{to} of {total}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => onPageChange(safePage - 1)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                    Prev
                </button>
                <span className="text-xs font-semibold text-slate-600">
                    Page {safePage} / {totalPages}
                </span>
                <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => onPageChange(safePage + 1)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                    Next
                </button>
            </div>
        </div>
    );
}

function TypeSubSection({ title, children }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-blue-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">{title}</h4>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-100 shadow-sm bg-white">{children}</div>
        </div>
    );
}

function OilServiceDocTable({ rows, mode, onOpenAttachment, onAdd }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[980px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className={thClass}>Vehicle asset no</th>
                        <th className={thClass}>Vehicle no</th>
                        <th className={thClass}>Last oil service km</th>
                        <th className={thClass}>Last oil service date</th>
                        <th className={thClass}>Next oil service km</th>
                        <th className={thClass}>Next oil service date</th>
                        <th className={thClass}>Status</th>
                        <th className={thClass}>Attachment</th>
                        {mode === 'live' ? <th className={thClass}>Add</th> : null}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ srv, row }) => (
                        <tr key={row.id} className="border-b border-slate-100 hover:bg-blue-50/30">
                            <td className={`${tdClass} font-mono text-xs`}>{row.vehicleAssetNo}</td>
                            <td className={tdClass}>{row.vehicleNo}</td>
                            <td className={`${tdClass} tabular-nums`}>{formatKm(row.lastOilServiceKm)}</td>
                            <td className={tdClass}>{formatDate(row.lastOilServiceDate)}</td>
                            <td className={`${tdClass} tabular-nums`}>{formatKm(row.nextOilServiceKm)}</td>
                            <td className={tdClass}>{formatDate(row.nextOilServiceDate)}</td>
                            <td className={tdClass}>
                                <StatusBadge label={row.status} tone={row.statusTone} />
                            </td>
                            <td className={tdClass}>
                                <AttachmentCell srv={srv} onOpen={onOpenAttachment} />
                            </td>
                            {mode === 'live' ? (
                                <td className={tdClass}>
                                    <button
                                        type="button"
                                        onClick={() => onAdd?.('Oil Service')}
                                        className="text-emerald-600 hover:text-emerald-700 p-1 rounded-lg hover:bg-emerald-50"
                                        title="Add Oil Service request"
                                    >
                                        <PlusCircle size={18} />
                                    </button>
                                </td>
                            ) : null}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function CarWashDocTable({ rows, mode, onOpenAttachment, onAdd }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[900px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className={thClass}>Vehicle asset no</th>
                        <th className={thClass}>Vehicle no</th>
                        <th className={thClass}>Car Wash Month</th>
                        <th className={thClass}>Car Wash Type</th>
                        <th className={thClass}>Amount</th>
                        <th className={thClass}>Status</th>
                        <th className={thClass}>Attachment</th>
                        {mode === 'live' ? <th className={thClass}>Add</th> : null}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ srv, row }) => (
                        <tr key={row.id} className="border-b border-slate-100 hover:bg-blue-50/30">
                            <td className={`${tdClass} font-mono text-xs`}>{row.vehicleAssetNo}</td>
                            <td className={tdClass}>{row.vehicleNo}</td>
                            <td className={`${tdClass} whitespace-nowrap`}>
                                {formatNextChangeMonthDisplay(row.carWashMonth) || '—'}
                            </td>
                            <td className={tdClass}>{row.carWashType || '—'}</td>
                            <td className={`${tdClass} tabular-nums`}>{formatAmount(row.amount)}</td>
                            <td className={tdClass}>
                                <StatusBadge label={row.status} tone={row.statusTone} />
                            </td>
                            <td className={tdClass}>
                                <AttachmentCell srv={srv} onOpen={onOpenAttachment} />
                            </td>
                            {mode === 'live' ? (
                                <td className={tdClass}>
                                    <button
                                        type="button"
                                        onClick={() => onAdd?.('Car Wash')}
                                        className="text-emerald-600 hover:text-emerald-700 p-1 rounded-lg hover:bg-emerald-50"
                                        title="Add Car Wash request"
                                    >
                                        <PlusCircle size={18} />
                                    </button>
                                </td>
                            ) : null}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function GenericServiceDocTable({ serviceType, rows, mode, onOpenAttachment, onAdd }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[820px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className={thClass}>Vehicle asset no</th>
                        <th className={thClass}>Vehicle no</th>
                        <th className={thClass}>Request date</th>
                        <th className={thClass}>Current km</th>
                        <th className={thClass}>Status</th>
                        <th className={thClass}>Attachment</th>
                        {mode === 'live' ? <th className={thClass}>Add</th> : null}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ srv, row }) => (
                        <tr key={row.id} className="border-b border-slate-100 hover:bg-blue-50/30">
                            <td className={`${tdClass} font-mono text-xs`}>{row.vehicleAssetNo}</td>
                            <td className={tdClass}>{row.vehicleNo}</td>
                            <td className={`${tdClass} whitespace-nowrap text-xs`}>
                                {formatDate(row.requestDate)}
                            </td>
                            <td className={`${tdClass} tabular-nums`}>{formatKm(row.currentKm)}</td>
                            <td className={tdClass}>
                                <StatusBadge label={row.status} tone={row.statusTone} />
                            </td>
                            <td className={tdClass}>
                                <AttachmentCell srv={srv} onOpen={onOpenAttachment} />
                            </td>
                            {mode === 'live' ? (
                                <td className={tdClass}>
                                    <button
                                        type="button"
                                        onClick={() => onAdd?.(serviceType)}
                                        className="text-emerald-600 hover:text-emerald-700 p-1 rounded-lg hover:bg-emerald-50"
                                        title={`Add ${serviceType} request`}
                                    >
                                        <PlusCircle size={18} />
                                    </button>
                                </td>
                            ) : null}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ServiceTypeBlock({ serviceType, asset, tabRows, mode, onOpenAttachment, onAdd }) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    const displayRows = mode === 'live' ? tabRows.slice(0, 1) : tabRows.slice(1);
    const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize) || 1);
    const safePage = Math.min(Math.max(1, page), totalPages);

    const pagedRows = useMemo(() => {
        if (mode !== 'old') return displayRows;
        const start = (safePage - 1) * pageSize;
        return displayRows.slice(start, start + pageSize);
    }, [displayRows, mode, safePage, pageSize]);

    const mappedRows = useMemo(
        () =>
            pagedRows.map((row) => ({
                row,
                srv: findServiceRecord(asset, row),
            })),
        [pagedRows, asset],
    );

    if (!displayRows.length) return null;

    return (
        <TypeSubSection title={serviceType}>
            {serviceType === 'Oil Service' ? (
                <OilServiceDocTable
                    rows={mappedRows}
                    mode={mode}
                    onOpenAttachment={onOpenAttachment}
                    onAdd={onAdd}
                />
            ) : serviceType === 'Car Wash' ? (
                <CarWashDocTable
                    rows={mappedRows}
                    mode={mode}
                    onOpenAttachment={onOpenAttachment}
                    onAdd={onAdd}
                />
            ) : (
                <GenericServiceDocTable
                    serviceType={serviceType}
                    rows={mappedRows}
                    mode={mode}
                    onOpenAttachment={onOpenAttachment}
                    onAdd={onAdd}
                />
            )}
            {mode === 'old' ? (
                <OldPaginationBar
                    page={safePage}
                    pageSize={pageSize}
                    total={displayRows.length}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                    }}
                />
            ) : null}
        </TypeSubSection>
    );
}

/**
 * Document tab → Service section: same data as Service tab, categorized by type.
 * Live = newest only per type. Old = remaining rows with per-type pagination.
 */
export default function VehicleDocumentTabServiceSections({
    asset,
    mode = 'live',
    sectionTitle,
    onOpenAttachment,
    onAddService,
}) {
    const byType = useMemo(() => {
        return VEHICLE_SERVICE_TYPES.map((serviceType) => ({
            serviceType,
            tabRows: buildServiceTabRowsForType(asset, serviceType),
        }));
    }, [asset]);

    const visibleBlocks = byType.filter(({ tabRows }) => {
        if (mode === 'live') return tabRows.length > 0;
        return tabRows.length > 1;
    });

    if (!visibleBlocks.length) return null;

    return (
        <div className="space-y-6">
            {typeof sectionTitle === 'function' ? sectionTitle('Service') : null}
            <div className="space-y-5">
                {visibleBlocks.map(({ serviceType, tabRows }) => (
                    <ServiceTypeBlock
                        key={`${mode}-${serviceType}`}
                        serviceType={serviceType}
                        asset={asset}
                        tabRows={tabRows}
                        mode={mode}
                        onOpenAttachment={onOpenAttachment}
                        onAdd={onAddService}
                    />
                ))}
            </div>
        </div>
    );
}

export function documentTabHasServiceRows(asset, mode) {
    return VEHICLE_SERVICE_TYPES.some((st) => {
        const rows = buildServiceTabRowsForType(asset, st);
        return mode === 'live' ? rows.length > 0 : rows.length > 1;
    });
}
