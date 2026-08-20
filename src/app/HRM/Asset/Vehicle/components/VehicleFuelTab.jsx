'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Fuel, PlusCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import axiosInstance from '@/utils/axios';
import DocumentViewerModal from '@/app/emp/[employeeId]/components/modals/DocumentViewerModal';
import VehicleFuelModal from './VehicleFuelModal';
import { canAccessAddFuel } from '@/app/HRM/Asset/Vehicle/utils/vehiclePermissionAccess';

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

export default function VehicleFuelTab({ asset, isFlowchartHr = false }) {
    const { toast } = useToast();
    const vehicleId = asset?._id || asset?.id || '';
    const [rows, setRows] = useState([]);
    const [canManage, setCanManage] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingBill, setEditingBill] = useState(null);
    const [closingBill, setClosingBill] = useState(null);
    const [closing, setClosing] = useState(false);
    const [viewingDocument, setViewingDocument] = useState(null);

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

    const openAdd = () => {
        setEditingBill(null);
        setModalOpen(true);
    };

    const openEdit = (bill) => {
        setEditingBill(bill);
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

    const openAttachment = async (bill) => {
        const entry = [...(bill.entries || [])].reverse().find((e) => e.hasAttachment);
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
                        <table className="w-full min-w-[860px] text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/70">
                                    {['Sl', 'Vehicle Number', 'Vehicle Owner', 'Month', 'Monthly Limit', 'Amount Used', 'Monthly KM', 'Idle Time', ''].map((col) => (
                                        <th
                                            key={col || 'actions'}
                                            className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"
                                        >
                                            {col}
                                        </th>
                                    ))}
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
                                    return (
                                    <tr
                                        key={row._id}
                                        className={
                                            limitTone === 'red'
                                                ? 'bg-red-50 hover:bg-red-100/70'
                                                : limitTone === 'amber'
                                                  ? 'bg-amber-50 hover:bg-amber-100/70'
                                                  : 'hover:bg-slate-50/60'
                                        }
                                    >
                                        <td className={`px-4 py-3 text-sm font-semibold ${tone.sl}`}>{idx + 1}</td>
                                        <td className={`px-4 py-3 text-sm font-bold whitespace-nowrap ${tone.strong}`}>{row.vehicleNumber}</td>
                                        <td className={`px-4 py-3 text-sm ${tone.muted}`}>{row.vehicleOwner}</td>
                                        <td className={`px-4 py-3 text-sm font-semibold ${tone.body}`}>
                                            <span>{row.monthLabel}</span>
                                            {row.status === 'closed' && (
                                                <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                                    Closed
                                                </span>
                                            )}
                                            {row.limitExceeded && (
                                                <span className="ml-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-700">
                                                    100% of monthly limit
                                                </span>
                                            )}
                                            {row.limitWarning80 && (
                                                <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-800">
                                                    80% of monthly limit
                                                </span>
                                            )}
                                        </td>
                                        <td className={`px-4 py-3 text-sm font-semibold tabular-nums whitespace-nowrap ${tone.body}`}>
                                            {formatAmount(row.monthlyLimit)}
                                        </td>
                                        <td className={`px-4 py-3 text-sm font-black tabular-nums whitespace-nowrap ${tone.strong}`}>
                                            {formatAmount(row.amountUsed)}
                                        </td>
                                        <td className={`px-4 py-3 text-sm font-semibold tabular-nums whitespace-nowrap ${tone.body}`}>
                                            {formatKm(row.kmRun)}
                                        </td>
                                        <td className={`px-4 py-3 text-sm font-semibold tabular-nums whitespace-nowrap ${tone.body}`}>
                                            {row.idleTimeLabel || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {row.entries?.some((e) => e.hasAttachment) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openAttachment(row)}
                                                        className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                        title="View attachment"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                )}
                                                {allowHrActions && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(row)}
                                                        className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50"
                                                        title="Update"
                                                    >
                                                        Update
                                                    </button>
                                                )}
                                                {allowHrActions && row.status !== 'closed' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setClosingBill(row)}
                                                        className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50"
                                                        title="Close bill"
                                                    >
                                                        Close
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
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
                }}
                onSaved={loadBills}
                asset={asset}
                vehicles={vehicleOptions}
                existingBill={editingBill}
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

            <DocumentViewerModal
                isOpen={Boolean(viewingDocument)}
                onClose={() => setViewingDocument(null)}
                viewingDocument={viewingDocument}
            />
        </div>
    );
}
