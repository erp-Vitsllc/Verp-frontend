'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Car,
    Banknote,
    Eye,
    Fuel,
    PlusCircle,
    RotateCcw,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import ListTableRowLink from '@/components/ListTableRowLink';
import DocumentViewerModal from '@/app/emp/[employeeId]/components/modals/DocumentViewerModal';
import VehicleFuelModal from '@/app/HRM/Asset/Vehicle/components/VehicleFuelModal';
import VehicleFuelEditButton from '@/app/HRM/Asset/Vehicle/components/VehicleFuelEditButton';
import VehicleFuelPreviousToggle from '@/app/HRM/Asset/Vehicle/components/VehicleFuelPreviousToggle';
import { MonthPicker } from '@/components/ui/date-picker';
import VehicleServiceRequestSortHeader from '@/app/HRM/Asset/Vehicle/components/VehicleServiceRequestSortHeader';
import {
    codeSortValue,
    numberSortValue,
    sortServiceTableRows,
    textSortValue,
} from '@/app/HRM/Asset/Vehicle/components/vehicleServiceRequestTableSort';
import { canAccessAddFuel } from '@/app/HRM/Asset/Vehicle/utils/vehiclePermissionAccess';
import {
    formatFuelEntryWhen,
    latestFuelEntry,
    previousFuelEntries,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleFuelPreviousEntries';
import { isAdmin } from '@/utils/permissions';

const VEHICLE_LIST_RETURN = '/HRM/Asset/Vehicle';

function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const TYPE_CARD =
    'group flex items-center gap-2 rounded-xl border p-2 text-left transition-colors min-h-[3.25rem]';
const TYPE_CARD_ACTIVE = 'border-teal-500 bg-teal-50 ring-1 ring-teal-200';
const TYPE_CARD_IDLE = 'border-slate-200 bg-slate-50/70 hover:border-teal-300 hover:bg-teal-50/60';
const TYPE_ICON_WRAP =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm shrink-0';

const FILTERS = [
    { key: 'added', label: 'Fuel added vehicle', Icon: Fuel, tone: 'pending' },
    { key: 'not-added', label: 'Not added vehicle', Icon: Car, tone: 'pending' },
    { key: 'total', label: 'Total month fuel price', Icon: Banknote, tone: 'complete' },
    { key: 'exceeded', label: 'Vehicle exceed limit of fuel', Icon: AlertTriangle, tone: 'pending' },
];

const FUEL_COLUMNS = [
    { key: 'slNo', label: 'Sl', type: 'number' },
    { key: 'vehicleName', label: 'Vehicle name', type: 'text' },
    { key: 'plateNo', label: 'Plate no', type: 'text' },
    { key: 'vehicleOwner', label: 'Vehicle owner', type: 'text' },
    { key: 'monthLabel', label: 'Month', type: 'text' },
    { key: 'monthlyLimit', label: 'Monthly limit', type: 'number' },
    { key: 'amountUsed', label: 'Amount used', type: 'number' },
    { key: 'kmRun', label: 'Monthly KM', type: 'number' },
    { key: 'idleTimeLabel', label: 'Idle time', type: 'text' },
];

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

function fuelSortValue(row, key) {
    switch (key) {
        case 'slNo':
        case 'monthlyLimit':
        case 'amountUsed':
        case 'kmRun':
            return numberSortValue(row?.[key]);
        case 'plateNo':
            return codeSortValue(row?.plateNo || row?.vehicleNumber);
        default:
            return textSortValue(row?.[key]);
    }
}

export default function VehicleAccessFuelPanel({
    onClose,
    listReturnHref = VEHICLE_LIST_RETURN,
}) {
    const router = useRouter();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [canManage, setCanManage] = useState(false);
    const [canDelete, setCanDelete] = useState(() => isAdmin());
    const [vehicles, setVehicles] = useState([]);
    const [added, setAdded] = useState([]);
    const [notAdded, setNotAdded] = useState([]);
    const [summary, setSummary] = useState({
        addedCount: 0,
        notAddedCount: 0,
        totalAmount: 0,
        exceedCount: 0,
    });
    const [monthKey, setMonthKey] = useState(currentMonthKey);
    const [monthLabel, setMonthLabel] = useState('');
    const [selectedFilter, setSelectedFilter] = useState('added');
    const [formOpen, setFormOpen] = useState(false);
    const [editingBill, setEditingBill] = useState(null);
    const [editingEntry, setEditingEntry] = useState(null);
    const [sortKey, setSortKey] = useState('vehicleName');
    const [sortDirection, setSortDirection] = useState('asc');
    const [viewingDocument, setViewingDocument] = useState(null);
    const [deletingBill, setDeletingBill] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [openPreviousId, setOpenPreviousId] = useState('');

    const allowManage = canManage || canAccessAddFuel();
    const allowDelete = canDelete || isAdmin();

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/VehicleFuel/access-list', {
                params: { monthKey },
                skipToast: true,
            });
            setVehicles(Array.isArray(res.data?.vehicles) ? res.data.vehicles : []);
            setAdded(Array.isArray(res.data?.added) ? res.data.added : []);
            setNotAdded(Array.isArray(res.data?.notAdded) ? res.data.notAdded : []);
            setSummary({
                addedCount: Number(res.data?.summary?.addedCount || 0),
                notAddedCount: Number(res.data?.summary?.notAddedCount || 0),
                totalAmount: Number(res.data?.summary?.totalAmount || 0),
                exceedCount: Number(res.data?.summary?.exceedCount || 0),
            });
            setMonthLabel(res.data?.monthLabel || '');
            setCanManage(Boolean(res.data?.canManage));
            setCanDelete(Boolean(res.data?.canDelete) || isAdmin());
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load fuel',
                description: error?.response?.data?.message || 'Try again in a moment.',
            });
            setVehicles([]);
            setAdded([]);
            setNotAdded([]);
        } finally {
            setLoading(false);
        }
    }, [toast, monthKey]);

    useEffect(() => {
        loadList();
    }, [loadList]);

    const visibleRows = useMemo(() => {
        if (selectedFilter === 'not-added') return notAdded;
        if (selectedFilter === 'exceeded') return added.filter((row) => row.limitExceeded);
        return added;
    }, [selectedFilter, added, notAdded]);

    const handleSort = useCallback(
        (key) => {
            const column = FUEL_COLUMNS.find((c) => c.key === key);
            if (!column) return;
            if (sortKey === key) {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                return;
            }
            setSortKey(key);
            setSortDirection(column.type === 'date' || column.type === 'number' ? 'desc' : 'asc');
        },
        [sortKey],
    );

    const sortedRows = useMemo(() => {
        const column = FUEL_COLUMNS.find((c) => c.key === sortKey) || FUEL_COLUMNS[0];
        const withSl = (visibleRows || []).map((row, index) => ({ ...row, slNo: index + 1 }));
        return sortServiceTableRows(withSl, fuelSortValue, sortKey, sortDirection, column.type);
    }, [visibleRows, sortKey, sortDirection]);

    const cardHint = (key) => {
        if (loading) return 'Loading…';
        if (key === 'added') {
            return summary.addedCount > 0 ? `${summary.addedCount} vehicle${summary.addedCount === 1 ? '' : 's'}` : 'None added';
        }
        if (key === 'not-added') {
            return summary.notAddedCount > 0
                ? `${summary.notAddedCount} vehicle${summary.notAddedCount === 1 ? '' : 's'}`
                : 'All added';
        }
        if (key === 'total') return formatAmount(summary.totalAmount);
        return summary.exceedCount > 0
            ? `${summary.exceedCount} vehicle${summary.exceedCount === 1 ? '' : 's'}`
            : 'None exceeded';
    };

    const cardCount = (key) => {
        if (key === 'added') return summary.addedCount;
        if (key === 'not-added') return summary.notAddedCount;
        if (key === 'total') return summary.totalAmount;
        return summary.exceedCount;
    };

    const openAdd = () => {
        const defaultVehicleId = notAdded[0]?.vehicleId || vehicles[0]?._id || '';
        setEditingEntry(null);
        setEditingBill({
            monthKey,
            ...(defaultVehicleId ? { vehicleId: defaultVehicleId } : {}),
        });
        setFormOpen(true);
    };

    const openEdit = (row) => {
        setEditingEntry(null);
        if (row?.noFuel) {
            setEditingBill({
                vehicleId: row.vehicleId,
                monthKey: row.monthKey,
                monthlyLimit: Number(row.monthlyLimit) > 0 ? row.monthlyLimit : undefined,
            });
            setFormOpen(true);
            return;
        }
        setEditingBill(row);
        setFormOpen(true);
    };

    const openEditEntry = (row, entry) => {
        if (row?.noFuel || !entry) return;
        setEditingBill(row);
        setEditingEntry(entry);
        setFormOpen(true);
    };

    const closeForm = () => {
        setFormOpen(false);
        setEditingBill(null);
        setEditingEntry(null);
    };

    const handleSaved = (saved) => {
        closeForm();
        loadList();
        if (saved?._id && previousFuelEntries(saved.entries).length) {
            setOpenPreviousId(String(saved._id));
        }
    };

    const deleteBill = async () => {
        if (!deletingBill?._id || deletingBill?.noFuel) return;
        setDeleting(true);
        try {
            const res = await axiosInstance.delete(`/VehicleFuel/${deletingBill._id}`);
            toast({
                title: 'Fuel deleted',
                description: res.data?.message || 'Fuel bill deleted. Management has been notified.',
            });
            setDeletingBill(null);
            loadList();
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

    const rowHref = (row) => {
        const id = row?.vehicleId;
        if (!id) return '';
        return `/HRM/Asset/Vehicle/details/${id}?tab=fuel`;
    };

    const openAttachment = async (bill, entryId = '') => {
        const entries = bill.entries || [];
        const entry = entryId
            ? entries.find((e) => String(e._id) === String(entryId))
            : [...entries].reverse().find((e) => e.hasAttachment);
        if (!entry) return;
        setViewingDocument({
            data: '',
            name: entry.attachmentName || 'Fuel attachment',
            mimeType: 'application/pdf',
            loading: true,
        });
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

    const listTitle =
        selectedFilter === 'not-added'
            ? 'Not added vehicles'
            : selectedFilter === 'exceeded'
              ? 'Vehicles exceeding fuel limit'
              : selectedFilter === 'total'
                ? 'Current month fuel records'
                : 'Fuel added vehicles';

    return (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-sm mb-4 sm:mb-6 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-teal-50/40">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-teal-800">
                            Access Fuel
                        </h2>
                        {monthLabel ? (
                            <span className="text-[10px] font-black uppercase tracking-widest text-teal-700">
                                {monthLabel}
                            </span>
                        ) : null}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Fuel bills, GPS running KM, and idle time for the selected month
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <div className="min-w-[150px]">
                        <MonthPicker value={monthKey} onChange={setMonthKey} />
                    </div>
                    {allowManage ? (
                        <button
                            type="button"
                            onClick={() => (formOpen && !editingBill ? closeForm() : openAdd())}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700"
                        >
                            <PlusCircle size={14} />
                            Add Fuel
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={loadList}
                        disabled={loading}
                        className="p-2 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Refresh"
                    >
                        <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div className="p-3 sm:p-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Fuel summary
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {FILTERS.map((box) => {
                        const Icon = box.Icon;
                        const isActive = selectedFilter === box.key;
                        const count = cardCount(box.key);
                        return (
                            <button
                                key={box.key}
                                type="button"
                                onClick={() => setSelectedFilter(box.key)}
                                className={`${TYPE_CARD} ${isActive ? TYPE_CARD_ACTIVE : TYPE_CARD_IDLE}`}
                            >
                                <span
                                    className={`${TYPE_ICON_WRAP} ${
                                        isActive
                                            ? 'bg-teal-600 border-teal-600 text-white'
                                            : 'bg-white border-slate-200 text-teal-700'
                                    }`}
                                >
                                    <Icon size={16} />
                                </span>
                                <span className="min-w-0">
                                    <span className="flex items-center gap-1">
                                        <span
                                            className={`block text-[10px] font-black uppercase tracking-wide leading-tight ${
                                                isActive ? 'text-teal-900' : 'text-slate-800 group-hover:text-teal-800'
                                            }`}
                                        >
                                            {box.label}
                                        </span>
                                        {!loading && box.key !== 'total' && Number(count || 0) > 0 ? (
                                            <span
                                                className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-black tabular-nums ${
                                                    box.key === 'exceeded'
                                                        ? 'bg-red-100 text-red-600'
                                                        : 'bg-teal-100 text-teal-700'
                                                }`}
                                            >
                                                {count}
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="block text-[10px] text-slate-500 mt-0.5 tabular-nums leading-tight">
                                        {cardHint(box.key)}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {formOpen ? (
                <VehicleFuelModal
                    variant="inline"
                    isOpen={formOpen}
                    onClose={closeForm}
                    onSaved={handleSaved}
                    vehicles={vehicles}
                    existingBill={editingBill}
                    editingEntry={editingEntry}
                    knownBills={[...added, ...notAdded]}
                    canManage={allowManage}
                />
            ) : null}

            <div className="border-t border-slate-100">
                <div className="px-4 sm:px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
                        {listTitle}
                        {!loading ? (
                            <span className="ml-2 text-teal-700 tabular-nums">({visibleRows.length})</span>
                        ) : null}
                    </h3>
                    {!loading && selectedFilter !== 'not-added' ? (
                        <span className="text-[11px] font-black uppercase tracking-widest text-teal-700 tabular-nums whitespace-nowrap">
                            {formatAmount(
                                visibleRows.reduce((sum, row) => sum + (Number(row.amountUsed) || 0), 0),
                            )}
                        </span>
                    ) : null}
                </div>
                <div className="overflow-hidden">
                    {loading ? (
                        <div className="py-16 text-center text-sm text-slate-500">Loading fuel lists…</div>
                    ) : !sortedRows.length ? (
                        <div className="py-16 text-center text-sm text-slate-500">
                            {selectedFilter === 'not-added'
                                ? 'Every vehicle has fuel recorded this month.'
                                : selectedFilter === 'exceeded'
                                  ? 'No vehicles exceeded the fuel limit this month.'
                                  : 'No fuel records for this month.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse min-w-[1080px]">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        {FUEL_COLUMNS.map((column) => (
                                            <VehicleServiceRequestSortHeader
                                                key={column.key}
                                                label={column.label}
                                                columnKey={column.key}
                                                sortKey={sortKey}
                                                sortDirection={sortDirection}
                                                onSort={handleSort}
                                            />
                                        ))}
                                        <th className="px-4 py-3 whitespace-nowrap text-right w-44">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedRows.map((row) => {
                                        const href = rowHref(row);
                                        const isNavigable = Boolean(href && router);
                                        const limitTone = row.limitExceeded
                                            ? 'red'
                                            : row.limitWarning80
                                              ? 'amber'
                                              : null;
                                        const previous = previousFuelEntries(row.entries);
                                        const currentEntry = latestFuelEntry(row.entries);
                                        const previousOpen = String(openPreviousId) === String(row._id);
                                        const rowElement = (
                                            <tr
                                                key={row._id}
                                                className={
                                                    limitTone === 'red'
                                                        ? 'bg-red-50 hover:bg-red-100/70 cursor-pointer'
                                                        : limitTone === 'amber'
                                                          ? 'bg-amber-50 hover:bg-amber-100/70 cursor-pointer'
                                                          : 'hover:bg-slate-50/70 cursor-pointer border-b border-slate-100'
                                                }
                                                title="Open vehicle fuel tab"
                                            >
                                                <td className="px-4 py-3 text-slate-600 font-semibold tabular-nums">
                                                    {row.slNo}
                                                </td>
                                                <td className="px-4 py-3 text-slate-800 font-medium">
                                                    {row.vehicleName || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                                                    {row.plateNo || row.vehicleNumber || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">{row.vehicleOwner || '—'}</td>
                                                <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                                                    {row.monthLabel || '—'}
                                                    {row.status === 'closed' ? (
                                                        <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                                            Closed
                                                        </span>
                                                    ) : null}
                                                    {row.noFuel ? (
                                                        <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-800">
                                                            Not added
                                                        </span>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                                                    {formatAmount(row.monthlyLimit)}
                                                </td>
                                                <td className="px-4 py-3 font-black tabular-nums whitespace-nowrap">
                                                    {row.noFuel ? '—' : formatAmount(row.amountUsed)}
                                                </td>
                                                <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                                                    {formatKm(row.kmRun)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {row.idleTimeLabel || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="inline-flex items-center justify-end gap-1">
                                                        {!row.noFuel && row.entries?.some((e) => e.hasAttachment) ? (
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    openAttachment(row);
                                                                }}
                                                                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                                title="View attachment"
                                                            >
                                                                <Eye size={16} />
                                                            </button>
                                                        ) : null}
                                                        {allowManage ? (
                                                            row.noFuel ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        openEdit(row);
                                                                    }}
                                                                    className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50"
                                                                >
                                                                    Add
                                                                </button>
                                                            ) : (
                                                                <VehicleFuelEditButton
                                                                    title="Edit current fuel"
                                                                    onClick={() => openEditEntry(row, currentEntry)}
                                                                />
                                                            )
                                                        ) : null}
                                                        {allowManage && !row.noFuel ? (
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    openEdit(row);
                                                                }}
                                                                className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50"
                                                            >
                                                                Update
                                                            </button>
                                                        ) : null}
                                                        {allowDelete && !row.noFuel ? (
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    setDeletingBill(row);
                                                                }}
                                                                className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-red-700 hover:bg-red-50"
                                                            >
                                                                Delete
                                                            </button>
                                                        ) : null}
                                                        <VehicleFuelPreviousToggle
                                                            open={previousOpen}
                                                            count={previous.length}
                                                            onToggle={() =>
                                                                setOpenPreviousId((current) =>
                                                                    String(current) === String(row._id)
                                                                        ? ''
                                                                        : String(row._id),
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );

                                        const previousRows = previousOpen
                                            ? previous.map((entry, entryIdx) => {
                                                  const isFirstFuel = entryIdx === previous.length - 1;
                                                  return (
                                                      <tr
                                                          key={`${row._id}-prev-${entry._id || entryIdx}`}
                                                          className={
                                                              isFirstFuel
                                                                  ? 'bg-slate-100/90 border-b border-slate-200'
                                                                  : 'bg-slate-50/80 border-b border-slate-100'
                                                          }
                                                      >
                                                          <td className="px-4 py-2.5 text-slate-400">—</td>
                                                          <td className="px-4 py-2.5 text-slate-500">{row.vehicleName || '—'}</td>
                                                          <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                                                              {row.plateNo || row.vehicleNumber || '—'}
                                                          </td>
                                                          <td className="px-4 py-2.5 text-slate-400">{row.vehicleOwner || '—'}</td>
                                                          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                                                              <div className="flex items-center gap-2">
                                                                  <span>{formatFuelEntryWhen(entry.createdAt) || row.monthLabel}</span>
                                                                  <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                                                      {isFirstFuel ? 'First fuel' : 'Previous'}
                                                                  </span>
                                                                  {allowManage ? (
                                                                      <VehicleFuelEditButton
                                                                          onClick={() => openEditEntry(row, entry)}
                                                                      />
                                                                  ) : null}
                                                              </div>
                                                          </td>
                                                          <td className="px-4 py-2.5 text-slate-400">—</td>
                                                          <td className="px-4 py-2.5 font-black tabular-nums whitespace-nowrap text-slate-700">
                                                              {formatAmount(entry.amount)}
                                                          </td>
                                                          <td className="px-4 py-2.5 text-slate-400">—</td>
                                                          <td className="px-4 py-2.5 text-slate-400">—</td>
                                                          <td className="px-4 py-2.5 text-right">
                                                              {entry.hasAttachment ? (
                                                                  <button
                                                                      type="button"
                                                                      onClick={(event) => {
                                                                          event.stopPropagation();
                                                                          openAttachment(row, entry._id);
                                                                      }}
                                                                      className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                                      title="View attachment"
                                                                  >
                                                                      <Eye size={16} />
                                                                  </button>
                                                              ) : null}
                                                          </td>
                                                      </tr>
                                                  );
                                              })
                                            : null;

                                        return (
                                            <Fragment key={row._id}>
                                                {isNavigable ? (
                                                    <ListTableRowLink
                                                        href={href}
                                                        router={router}
                                                        listReturnHref={listReturnHref}
                                                    >
                                                        {rowElement}
                                                    </ListTableRowLink>
                                                ) : (
                                                    rowElement
                                                )}
                                                {previousRows}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {deletingBill ? (
                <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">Delete fuel?</h3>
                            <button type="button" onClick={() => setDeletingBill(null)} className="p-1 text-slate-400 hover:text-slate-700">
                                <X size={18} />
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
