'use client';

import { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { downloadAccessFuelListedVehiclesPdf } from '@/app/HRM/Asset/Vehicle/utils/accessFuelListPdf.js';

function sanitizeLimit(raw) {
    const cleaned = String(raw ?? '')
        .replace(/[^\d.]/g, '')
        .replace(/(\..*)\./g, '$1');
    const [whole, fraction] = cleaned.split('.');
    if (fraction == null) return whole.slice(0, 10);
    return `${whole.slice(0, 10)}.${fraction.slice(0, 2)}`;
}

function rowsFromVehicles(vehicles) {
    return (Array.isArray(vehicles) ? vehicles : []).map((vehicle) => ({
        vehicleId: String(vehicle?._id || ''),
        vehicleNo: vehicle?.plate || vehicle?.assetId || '—',
        name: vehicle?.name || '—',
        limit: Number(vehicle?.fuelMonthlyLimit) > 0 ? String(vehicle.fuelMonthlyLimit) : '',
    }));
}

function rowKey(row) {
    return String(row?.vehicleId || '');
}

export default function VehicleAccessFuelMonthlyLimitModal({
    isOpen,
    onClose,
    onCreated,
    vehicles = [],
    monthKey,
    monthLabel,
    canCreate = true,
}) {
    const { toast } = useToast();
    const [rows, setRows] = useState([]);
    const [selected, setSelected] = useState(() => new Set());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setRows(rowsFromVehicles(vehicles));
        setSelected(new Set());
        setError('');
        setSaving(false);
    }, [isOpen, vehicles]);

    if (!isOpen) return null;

    const allChecked = rows.length > 0 && rows.every((row) => selected.has(rowKey(row)));
    const someChecked = rows.some((row) => selected.has(rowKey(row)));

    const toggleAll = () => {
        if (allChecked) {
            setSelected(new Set());
            return;
        }
        setSelected(new Set(rows.map((row) => rowKey(row)).filter(Boolean)));
        if (error) setError('');
    };

    const toggleRow = (vehicleId) => {
        const key = String(vehicleId);
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
        if (error) setError('');
    };

    const setLimit = (vehicleId, value) => {
        const nextLimit = sanitizeLimit(value);
        setRows((current) =>
            current.map((row) => (row.vehicleId === vehicleId ? { ...row, limit: nextLimit } : row)),
        );
        setSelected((current) => {
            const next = new Set(current);
            const key = String(vehicleId);
            if (Number(nextLimit) > 0) next.add(key);
            else next.delete(key);
            return next;
        });
        if (error) setError('');
    };

    const printListedVehicles = () => {
        if (!rows.length) return;
        try {
            downloadAccessFuelListedVehiclesPdf({
                title: 'Monthly limit',
                subtitle: monthLabel || monthKey || 'Selected month',
                headers: ['Sl', 'Vehicle no', 'Name', 'Limit'],
                rows: rows.map((row, index) => [
                    String(index + 1),
                    row.vehicleNo || '—',
                    row.name || '—',
                    row.limit ? `AED ${row.limit}` : '—',
                ]),
                columnWeights: [10, 22, 44, 24],
                columnAlign: ['left', 'left', 'left', 'right'],
                fileName: `monthly-limit-${monthKey || 'month'}.pdf`,
            });
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not create PDF',
                description: err?.message || 'Try again in a moment.',
            });
        }
    };

    const createLimits = async () => {
        if (!canCreate) return;
        const chosen = rows.filter((row) => selected.has(rowKey(row)));
        if (!chosen.length) {
            setError('Check at least one assigned vehicle, or enter a monthly limit.');
            return;
        }
        const missing = chosen.find((row) => {
            const n = Number(row.limit);
            return !Number.isFinite(n) || n <= 0;
        });
        if (missing) {
            setError('Enter a monthly limit for every checked vehicle.');
            return;
        }

        setSaving(true);
        try {
            const res = await axiosInstance.post('/VehicleFuel/monthly-limits', {
                monthKey,
                limits: chosen.map((row) => ({
                    vehicleId: row.vehicleId,
                    monthlyLimit: Number(row.limit),
                })),
            });
            toast({
                title: 'Monthly limits created',
                description: res.data?.message || 'Assignees have been emailed.',
            });
            onCreated?.();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not create monthly limits',
                description: err?.response?.data?.message || 'Try again in a moment.',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
                    <div className="min-w-0">
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">
                            Monthly limit
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            {monthLabel || 'Selected month'} — Assigned vehicles only. Checked or limited vehicles will not appear here again this month. Create emails the assigned employee, or their HOD if they have no company email.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-auto flex-1">
                    {rows.length ? (
                        <table className="w-full text-sm border-collapse min-w-[640px]">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                                    <th className="px-4 py-3 w-12">
                                        <input
                                            type="checkbox"
                                            checked={allChecked}
                                            ref={(el) => {
                                                if (el) el.indeterminate = someChecked && !allChecked;
                                            }}
                                            onChange={toggleAll}
                                            disabled={saving}
                                            aria-label="Select all assigned vehicles"
                                        />
                                    </th>
                                    <th className="px-4 py-3 w-16">Sl</th>
                                    <th className="px-4 py-3">Vehicle no</th>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3 w-44">Limit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={row.vehicleId} className="border-b border-slate-100">
                                        <td className="px-4 py-2.5">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(rowKey(row))}
                                                onChange={() => toggleRow(row.vehicleId)}
                                                disabled={saving}
                                                aria-label={`Select ${row.vehicleNo || row.name || 'vehicle'}`}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-600 font-semibold tabular-nums">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-800 whitespace-nowrap">
                                            {row.vehicleNo || '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-800">{row.name || '—'}</td>
                                        <td className="px-4 py-2.5">
                                            <div className="relative">
                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    AED
                                                </span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={row.limit}
                                                    onChange={(event) => setLimit(row.vehicleId, event.target.value)}
                                                    placeholder="0.00"
                                                    disabled={saving}
                                                    className="w-full h-10 pl-12 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 tabular-nums outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 disabled:opacity-60"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-16 text-center text-sm text-slate-500">
                            No assigned vehicles to set a monthly limit.
                        </div>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
                    <div className="mr-auto flex items-center gap-3 min-w-0">
                        {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
                        <button
                            type="button"
                            onClick={printListedVehicles}
                            disabled={saving || !rows.length}
                            title={
                                rows.length
                                    ? 'Download the vehicles listed now as PDF'
                                    : 'No vehicles listed to print'
                            }
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50"
                        >
                            <Printer size={14} />
                            Print
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={createLimits}
                        disabled={saving || !rows.length || !canCreate}
                        className="px-4 py-2 rounded-xl bg-teal-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-800 disabled:opacity-60"
                    >
                        {saving ? 'Creating…' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    );
}
