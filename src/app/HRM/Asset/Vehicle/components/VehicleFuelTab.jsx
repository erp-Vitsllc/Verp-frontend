'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Fuel, PlusCircle, XCircle } from 'lucide-react';
import VehicleFuelEditButton from './VehicleFuelEditButton';
import { useToast } from '@/hooks/use-toast';
import axiosInstance from '@/utils/axios';
import DocumentViewerModal from '@/app/emp/[employeeId]/components/modals/DocumentViewerModal';
import VehicleFuelModal from './VehicleFuelModal';
import VehicleFuelPreviousToggle from './VehicleFuelPreviousToggle';
import { canAccessAddFuel } from '@/app/HRM/Asset/Vehicle/utils/vehiclePermissionAccess';
import {
    formatFuelEntryWhen,
    fuelEntryHistoryRows,
    latestFuelEntry,
    previousFuelEntries,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleFuelPreviousEntries';
import { isAdmin } from '@/utils/permissions';

function formatAmount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatKm(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

function fuelRowStatus(row) {
    return row?.status === 'closed' ? 'Closed' : 'Opened';
}

export default function VehicleFuelTab({ asset, isFlowchartHr = false }) {
    const { toast } = useToast();
    const vehicleId = asset?._id || asset?.id || '';
    const [rows, setRows] = useState([]);
    const [canManage, setCanManage] = useState(false);
    const [canDelete, setCanDelete] = useState(() => isAdmin());
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingBill, setEditingBill] = useState(null);
    const [editingEntry, setEditingEntry] = useState(null);
    const [closingBill, setClosingBill] = useState(null);
    const [closing, setClosing] = useState(false);
    const [deletingBill, setDeletingBill] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [viewingDocument, setViewingDocument] = useState(null);
    const [openPreviousId, setOpenPreviousId] = useState('');

    const loadBills = useCallback(async () => {
        if (!vehicleId) {
            setRows([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/VehicleFuel/vehicle/${vehicleId}`);
            setRows(Array.isArray(res.data?.data) ? res.data.data : []);
            setCanManage(Boolean(res.data?.canManage));
            setCanDelete(Boolean(res.data?.canDelete) || isAdmin());
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load fuel',
                description: error.response?.data?.message || 'Failed to load fuel bills.',
            });
        } finally {
            setLoading(false);
        }
    }, [vehicleId, toast]);

    const loadVehicles = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/VehicleFuel/vehicles');
            setVehicles(Array.isArray(res.data?.data) ? res.data.data : []);
        } catch {
            setVehicles([]);
        }
    }, []);

    useEffect(() => {
        loadBills();
        loadVehicles();
    }, [loadBills, loadVehicles]);

    const allowHrActions = isFlowchartHr || canManage || canAccessAddFuel();
    const allowDelete = canDelete || isAdmin();

    const handleSaved = (saved) => {
        loadBills();
        if (saved?._id && previousFuelEntries(saved.entries).length) {
            setOpenPreviousId(String(saved._id));
        }
    };

    const openAdd = () => {
        setEditingBill(null);
        setEditingEntry(null);
        setModalOpen(true);
    };

    const openEdit = (bill) => {
        setEditingBill(bill);
        setEditingEntry(null);
        setModalOpen(true);
    };

    const openEditEntry = (bill, entry) => {
        if (!bill || !entry) return;
        setEditingBill(bill);
        setEditingEntry(entry);
        setModalOpen(true);
    };

    const closeBill = async () => {
        if (!closingBill?._id) return;
        setClosing(true);
        try {
            const res = await axiosInstance.post(`/VehicleFuel/${closingBill._id}/close`);
            toast({ title: 'Bill closed', description: res.data?.message || 'This month’s fuel bill is closed.' });
            setClosingBill(null);
            loadBills();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not close',
                description: error.response?.data?.message || 'Failed to close the fuel bill.',
            });
        } finally {
            setClosing(false);
        }
    };

    const deleteBill = async () => {
        if (!deletingBill?._id) return;
        setDeleting(true);
        try {
            const res = await axiosInstance.delete(`/VehicleFuel/${deletingBill._id}`);
            toast({
                title: 'Fuel deleted',
                description: res.data?.message || 'Fuel bill deleted. Management has been notified.',
            });
            setDeletingBill(null);
            loadBills();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not delete',
                description: error.response?.data?.message || 'Failed to delete the fuel bill.',
            });
        } finally {
            setDeleting(false);
        }
    };

    const openAttachment = async (bill, entryId = '') => {
        const entries = bill.entries || [];
        const entry = entryId
            ? entries.find((e) => String(e._id) === String(entryId))
            : [...entries].reverse().find((e) => e.hasAttachment);
        if (!entry) return;
        setViewingDocument({ data: '', name: entry.attachmentName || 'Fuel attachment', mimeType: 'application/pdf', loading: true });
        try {
            const res = await axiosInstance.get(`/VehicleFuel/${bill._id}/attachment`, {
                params: { entryId: entry._id },
            });
            const file = res.data?.data;
            setViewingDocument({
                name: file?.name || 'Fuel attachment',
                mimeType: file?.mimeType || 'application/pdf',
                data: file?.data || '',
                loading: false,
            });
        } catch (error) {
            setViewingDocument(null);
            toast({
                variant: 'destructive',
                title: 'Cannot open attachment',
                description: error.response?.data?.message || 'Failed to open attachment.',
            });
        }
    };

    const currentAssetOption = useMemo(() => {
        if (!asset) return null;
        return {
            _id: asset._id || asset.id,
            assetId: asset.assetId,
            name: asset.name,
            plate: [asset.plateEmirate, asset.plateNumber].filter(Boolean).join(' '),
            fuelMonthlyLimit: Number(asset.fuelMonthlyLimit) || 0,
            documents: asset.documents,
            owner:
                asset.assignedToType === 'Company'
                    ? asset.assignedCompany?.name || 'Company'
                    : `${asset.assignedTo?.firstName || ''} ${asset.assignedTo?.lastName || ''}`.trim() || 'Unassigned',
        };
    }, [asset]);

    const vehicleOptions = useMemo(() => {
        if (!currentAssetOption) return vehicles;
        if (vehicles.some((v) => String(v._id) === String(currentAssetOption._id))) return vehicles;
        return [currentAssetOption, ...vehicles];
    }, [vehicles, currentAssetOption]);

    return (
        <div className="w-full px-2 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Fuel</h3>
                {allowHrActions && (
                    <button
                        type="button"
                        onClick={openAdd}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                    >
                        <PlusCircle size={14} /> Add Fuel
                    </button>
                )}
            </div>

            {loading ? (
                <div className="py-16 flex items-center justify-center text-slate-400 text-sm font-semibold">
                    Loading fuel bills…
                </div>
            ) : rows.length === 0 ? (
                <div className="bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100 py-16 flex flex-col items-center justify-center text-center px-6">
                    <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                        <Fuel size={32} />
                    </div>
                    <h5 className="text-sm font-black text-slate-400 uppercase tracking-[.25em] mb-2">No Fuel Bills</h5>
                    <p className="text-[10px] text-slate-300 font-medium max-w-sm">
                        {allowHrActions
                            ? 'Click “Add Fuel” to record the first monthly petrol bill.'
                            : 'No monthly petrol bills have been recorded for this vehicle.'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1160px] table-fixed text-left border-collapse">
                            <colgroup>
                                <col className="w-12" />
                                <col className="w-[140px]" />
                                <col className="w-[150px]" />
                                <col className="w-[130px]" />
                                <col className="w-[110px]" />
                                <col className="w-[130px]" />
                                <col className="w-[130px]" />
                                <col className="w-[110px]" />
                                <col className="w-[120px]" />
                                <col />
                            </colgroup>
                            <thead>
                                <tr className="bg-slate-50/70">
                                    <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Sl</th>
                                    <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Vehicle Number</th>
                                    <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Vehicle Owner</th>
                                    <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Month</th>
                                    <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                                    <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Monthly Limit</th>
                                    <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Amount Used</th>
                                    <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Monthly KM</th>
                                    <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Idle Time</th>
                                    <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => {
                                    const limitTone = row.limitExceeded
                                        ? 'red'
                                        : row.limitWarning80
                                            ? 'amber'
                                            : null;
                                    const tone = {
                                        sl: limitTone === 'red' ? 'text-red-600' : limitTone === 'amber' ? 'text-amber-600' : 'text-slate-500',
                                        strong: limitTone === 'red' ? 'text-red-700' : limitTone === 'amber' ? 'text-amber-800' : 'text-slate-800',
                                        muted: limitTone === 'red' ? 'text-red-600' : limitTone === 'amber' ? 'text-amber-700' : 'text-slate-600',
                                        body: limitTone === 'red' ? 'text-red-700' : limitTone === 'amber' ? 'text-amber-800' : 'text-slate-700',
                                    };
                                    const previous = previousFuelEntries(row.entries);
                                    const currentEntry = latestFuelEntry(row.entries);
                                    const previousOpen = String(openPreviousId) === String(row._id);
                                    return (
                                        <Fragment key={row._id}>
                                            <tr
                                                className={
                                                    limitTone === 'red'
                                                        ? 'bg-red-50 hover:bg-red-100/70'
                                                        : limitTone === 'amber'
                                                            ? 'bg-amber-50 hover:bg-amber-100/70'
                                                            : 'hover:bg-slate-50/60'
                                                }
                                            >
                                                <td className={`px-3 py-3.5 text-sm font-semibold align-top ${tone.sl}`}>{idx + 1}</td>
                                                <td className={`px-3 py-3.5 text-sm font-bold align-top break-words ${tone.strong}`}>{row.vehicleNumber}</td>
                                                <td className={`px-3 py-3.5 text-sm align-top break-words ${tone.muted}`}>{row.vehicleOwner}</td>
                                                <td className={`px-3 py-3.5 text-sm font-semibold align-top whitespace-nowrap ${tone.body}`}>
                                                    {row.monthLabel}
                                                </td>
                                                <td className="px-3 py-3.5 align-top">
                                                    {fuelRowStatus(row) === 'Closed' ? (
                                                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                                            Closed
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                                            Opened
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={`px-3 py-3.5 text-sm font-semibold tabular-nums whitespace-nowrap text-right align-top ${tone.body}`}>
                                                    {formatAmount(row.monthlyLimit)}
                                                </td>
                                                <td className={`px-3 py-3.5 text-sm font-black tabular-nums whitespace-nowrap text-right align-top ${tone.strong}`}>
                                                    {formatAmount(row.amountUsed)}
                                                </td>
                                                <td className={`px-3 py-3.5 text-sm font-semibold tabular-nums whitespace-nowrap text-right align-top ${tone.body}`}>
                                                    {formatKm(row.kmRun)}
                                                </td>
                                                <td className={`px-3 py-3.5 text-sm font-semibold tabular-nums whitespace-nowrap text-right align-top ${tone.body}`}>
                                                    {row.idleTimeLabel || '—'}
                                                </td>
                                                <td className="px-3 py-3.5 align-top">
                                                    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                                                        {row.entries?.some((e) => e.hasAttachment) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openAttachment(row)}
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                                title="View attachment"
                                                            >
                                                                <Eye size={16} />
                                                            </button>
                                                        )}
                                                        {allowHrActions && currentEntry ? (
                                                            <VehicleFuelEditButton
                                                                title="Edit current fuel"
                                                                onClick={() => openEditEntry(row, currentEntry)}
                                                            />
                                                        ) : null}
                                                        {allowHrActions && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openEdit(row)}
                                                                className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50"
                                                                title="Add another fuel entry"
                                                            >
                                                                Update
                                                            </button>
                                                        )}
                                                        {allowHrActions && row.status !== 'closed' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setClosingBill(row)}
                                                                className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50"
                                                                title="Close bill"
                                                            >
                                                                Close
                                                            </button>
                                                        )}
                                                        {allowDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeletingBill(row)}
                                                                className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-red-700 hover:bg-red-50"
                                                                title="Delete fuel bill"
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                        <VehicleFuelPreviousToggle
                                                            open={previousOpen}
                                                            count={previous.length}
                                                            onToggle={() =>
                                                                setOpenPreviousId((current) =>
                                                                    String(current) === String(row._id) ? '' : String(row._id),
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                            {previousOpen ? (
                                                <tr className={limitTone === 'red' ? 'bg-red-50/40' : limitTone === 'amber' ? 'bg-amber-50/40' : 'bg-white'}>
                                                    <td colSpan={10} className="px-4 pb-4 pt-0">
                                                        <div className="ml-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                                    Fuel entries · {row.monthLabel}
                                                                </p>
                                                            </div>
                                                            <table className="w-full text-left">
                                                                <thead>
                                                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                        <th className="px-4 py-2 w-12">#</th>
                                                                        <th className="px-4 py-2">Added on</th>
                                                                        <th className="px-4 py-2 text-right">Amount</th>
                                                                        <th className="px-4 py-2">Entry</th>
                                                                        <th className="px-4 py-2 text-right w-32">Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {fuelEntryHistoryRows(row.entries).map((item, entryIdx) => {
                                                                        const entry = item.entry;
                                                                        return (
                                                                            <tr
                                                                                key={`${row._id}-hist-${entry._id || entryIdx}`}
                                                                                className="border-t border-slate-100"
                                                                            >
                                                                                <td className="px-4 py-2.5 text-sm text-slate-400 tabular-nums">
                                                                                    {entryIdx + 1}
                                                                                </td>
                                                                                <td className="px-4 py-2.5 text-sm font-semibold text-slate-700 whitespace-nowrap">
                                                                                    {formatFuelEntryWhen(entry.createdAt) || row.monthLabel}
                                                                                </td>
                                                                                <td className="px-4 py-2.5 text-sm font-black tabular-nums whitespace-nowrap text-right text-slate-800">
                                                                                    {formatAmount(entry.amount)}
                                                                                </td>
                                                                                <td className="px-4 py-2.5">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span
                                                                                            className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                                                                                                item.isCurrent
                                                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                                                    : 'bg-slate-100 text-slate-600'
                                                                                            }`}
                                                                                        >
                                                                                            {item.label}
                                                                                        </span>
                                                                                        {allowHrActions ? (
                                                                                            <VehicleFuelEditButton
                                                                                                onClick={() => openEditEntry(row, entry)}
                                                                                            />
                                                                                        ) : null}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-4 py-2.5 text-right">
                                                                                    {entry.hasAttachment ? (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => openAttachment(row, entry._id)}
                                                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                                                            title="View attachment"
                                                                                        >
                                                                                            <Eye size={16} />
                                                                                        </button>
                                                                                    ) : null}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <VehicleFuelModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingBill(null);
                    setEditingEntry(null);
                }}
                onSaved={handleSaved}
                asset={asset}
                vehicles={vehicleOptions}
                existingBill={editingBill}
                editingEntry={editingEntry}
                knownBills={rows}
                canManage={allowHrActions}
                lockVehicle
            />

            {closingBill ? (
                <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">Close bill?</h3>
                            <button type="button" onClick={() => setClosingBill(null)} className="p-1 text-slate-400 hover:text-slate-700">
                                <XCircle size={18} />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500">
                            Do you want to close the fuel bill for {closingBill.monthLabel}? Once closed, fuel cannot be added again for that month.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setClosingBill(null)}
                                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={closing}
                                onClick={closeBill}
                                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest"
                            >
                                {closing ? 'Closing…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {deletingBill ? (
                <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">Delete fuel?</h3>
                            <button type="button" onClick={() => setDeletingBill(null)} className="p-1 text-slate-400 hover:text-slate-700">
                                <XCircle size={18} />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500">
                            Delete the fuel bill for {deletingBill.monthLabel}? Management will be emailed, and the record stays in recovery.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeletingBill(null)}
                                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={deleteBill}
                                className="px-4 py-2 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                            >
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <DocumentViewerModal
                isOpen={Boolean(viewingDocument)}
                onClose={() => setViewingDocument(null)}
                viewingDocument={viewingDocument}
            />
        </div>
    );
}
