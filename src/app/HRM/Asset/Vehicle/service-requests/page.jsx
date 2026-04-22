'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, ExternalLink, Download, ArrowLeft, RotateCcw } from 'lucide-react';
import { normalizeMongoId } from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';

function serviceRowKey(row) {
    return `${normalizeMongoId(row.vehicleId)}::${normalizeMongoId(row.serviceId)}`;
}

export default function VehicleServiceRequestsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/AssetItem/vehicle-fleet-service-requests');
            const next = Array.isArray(res.data?.items) ? res.data.items : [];
            setRows(next);
        } catch (error) {
            console.error('vehicle-fleet-service-requests', error);
            toast({
                variant: 'destructive',
                title: 'Could not load service requests',
                description: error.response?.data?.message || 'Try again in a moment.',
            });
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        load();
    }, [mounted, load]);

    const onRowClick = useCallback(
        (row) => {
            const vehicleId = normalizeMongoId(row.vehicleId);
            const serviceId = normalizeMongoId(row.serviceId);
            if (!vehicleId || !serviceId) return;
            router.push(`/HRM/Asset/Vehicle/service-requests/details/${vehicleId}/${serviceId}`);
        },
        [router]
    );

    if (!mounted) return null;

    return (
        <PermissionGuard moduleId="hrm_asset" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full bg-[#f2f6f9]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <div className="p-8">
                        <div className="flex flex-col gap-4 mb-6">
                            <Link
                                href="/HRM/Asset/Vehicle/dashboard"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-900 w-fit"
                            >
                                <ArrowLeft size={16} />
                                Back to vehicle dashboard
                            </Link>
                            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 dashboard-hero-glow rounded-2xl px-4 py-4 md:px-6 md:py-5 border border-white/60 shadow-sm shadow-teal-900/5">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Service requests</h1>
                                    <p className="text-sm text-slate-500 mt-1">
                                        All service lines for fleet vehicles (newest first). Rows stay here after the workflow
                                        completes — nothing is removed from this list when a request is approved or closed.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Link
                                        href="/HRM/Asset/Vehicle"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-50 shadow-sm"
                                    >
                                        Vehicle list
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => load()}
                                        disabled={loading}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00B5AD] text-white text-sm font-semibold hover:bg-teal-600 shadow-sm disabled:opacity-50"
                                    >
                                        <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
                                        Refresh
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            {loading ? (
                                <div className="flex items-center justify-center py-24">
                                    <p className="text-sm font-medium text-slate-500">Loading…</p>
                                </div>
                            ) : rows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                                    <ClipboardList className="text-slate-300 mb-3" size={44} />
                                    <p className="text-sm font-semibold text-slate-600">No service records yet</p>
                                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                        Add a service request from the vehicle fleet dashboard to see entries here.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <p className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 bg-slate-50/50">
                                        Click a row to open the service request details page with service details and progress
                                        tracker.
                                    </p>
                                    <table className="w-full text-sm border-collapse min-w-[940px]">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                                                <th className="px-2 py-3 w-10" aria-label="Expand" />
                                                <th className="px-4 py-3 whitespace-nowrap">Sl.</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Type</th>
                                                <th className="px-4 py-3 min-w-[140px]">Vehicle</th>
                                                <th className="px-4 py-3 whitespace-nowrap">SL No.</th>
                                                <th className="px-4 py-3 whitespace-nowrap">ID</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Value</th>
                                                <th className="px-4 py-3 min-w-[200px]">Attachments</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row, idx) => {
                                                const rk = serviceRowKey(row);
                                                return (
                                                    <tr
                                                        key={rk}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => onRowClick(row)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                onRowClick(row);
                                                            }
                                                        }}
                                                        className="border-b border-slate-100 transition-colors cursor-pointer hover:bg-teal-50/40"
                                                    >
                                                            <td className="px-2 py-2.5 align-middle" />
                                                            <td className="px-4 py-2.5 text-slate-600 tabular-nums">{idx + 1}</td>
                                                            <td className="px-4 py-2.5 font-semibold text-slate-800">
                                                                {row.serviceType || '—'}
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <Link
                                                                    href={`/HRM/Asset/Vehicle/details/${row.vehicleId}`}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-medium hover:underline"
                                                                >
                                                                    <span className="truncate max-w-[220px]">{row.vehicleLabel || '—'}</span>
                                                                    <ExternalLink size={12} className="shrink-0 opacity-70" />
                                                                </Link>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">
                                                                {row.vehicleAssetId || '—'}
                                                            </td>
                                                            <td
                                                                className="px-4 py-2.5 text-slate-500 font-mono text-[11px] max-w-[140px] truncate"
                                                                title={row.serviceId ? String(row.serviceId) : ''}
                                                            >
                                                                {row.serviceId ? String(row.serviceId) : '—'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap text-xs">
                                                                {row.date
                                                                    ? new Date(row.date).toLocaleDateString(undefined, {
                                                                          year: 'numeric',
                                                                          month: 'short',
                                                                          day: 'numeric',
                                                                      })
                                                                    : '—'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-slate-800 font-semibold tabular-nums">
                                                                {row.value != null && Number(row.value) !== 0
                                                                    ? `AED ${Number(row.value).toLocaleString()}`
                                                                    : row.value === 0
                                                                      ? 'AED 0'
                                                                      : '—'}
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                                    {row.attachment ? (
                                                                        <a
                                                                            href={row.attachment}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                                                                        >
                                                                            <Download size={10} /> Q1
                                                                        </a>
                                                                    ) : null}
                                                                    {row.quotation2 ? (
                                                                        <a
                                                                            href={row.quotation2}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                                                                        >
                                                                            <Download size={10} /> Q2
                                                                        </a>
                                                                    ) : null}
                                                                    {row.quotation3 ? (
                                                                        <a
                                                                            href={row.quotation3}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                                                                        >
                                                                            <Download size={10} /> Q3
                                                                        </a>
                                                                    ) : null}
                                                                    {row.invoice ? (
                                                                        <a
                                                                            href={row.invoice}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-900 text-[10px] font-bold text-white hover:bg-slate-800"
                                                                        >
                                                                            <Download size={10} /> Inv
                                                                        </a>
                                                                    ) : null}
                                                                    {!row.attachment &&
                                                                    !row.quotation2 &&
                                                                    !row.quotation3 &&
                                                                    !row.invoice ? (
                                                                        <span className="text-slate-300 text-xs">—</span>
                                                                    ) : null}
                                                                </div>
                                                            </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
