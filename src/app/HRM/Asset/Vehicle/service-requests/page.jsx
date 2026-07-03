'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePersistListReturnState } from '@/hooks/usePersistListReturnState';
import { navigateFromList } from '@/utils/listReturnNavigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import ConfirmAlertDialog from '@/components/ConfirmAlertDialog';
import { ClipboardList, RotateCcw } from 'lucide-react';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import { normalizeMongoId } from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';
import VehicleServiceRecordsTable, {
    vehicleServiceRowKey,
} from '@/app/HRM/Asset/Vehicle/components/VehicleServiceRecordsTable';
import { isAdmin } from '@/utils/permissions';
import {
    canAdminDeleteActivatedVehicleRecord,
    isVehicleProfileActivationActive,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleAdminDeleteAccess';

function serviceRowKey(row) {
    return vehicleServiceRowKey(row);
}

export default function VehicleServiceRequestsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const vehicleIdFilter = String(searchParams?.get('vehicleId') || '').trim();
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingKey, setDeletingKey] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [submittingKey, setSubmittingKey] = useState('');
    const [canDelete, setCanDelete] = useState(false);

    const canDeleteServiceRow = useCallback(
        (row) =>
            canAdminDeleteActivatedVehicleRecord({
                isAdminUser: canDelete,
                profileActive: isVehicleProfileActivationActive(row?.vehicleProfileActivationStatus),
            }),
        [canDelete],
    );

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/AssetItem/vehicle-fleet-service-requests');
            let next = Array.isArray(res.data?.items) ? res.data.items : [];
            next = next.filter((row) => {
                const type = String(row?.serviceType || '').trim();
                return type !== 'Oil Service' && type !== 'Car Wash';
            });
            if (vehicleIdFilter) {
                next = next.filter((row) => String(row?.vehicleId || '') === vehicleIdFilter);
            }
            setRows(next);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load service requests',
                description: error.response?.data?.message || 'Try again in a moment.',
            });
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [toast, vehicleIdFilter]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        setCanDelete(isAdmin());
        load();
    }, [mounted, load]);

    const listReturnExtra = useMemo(
        () => (vehicleIdFilter ? { vehicleId: vehicleIdFilter } : null),
        [vehicleIdFilter],
    );
    usePersistListReturnState(listReturnExtra);

    const onRowClick = useCallback(
        (row) => {
            const vehicleId = normalizeMongoId(row.vehicleId);
            const serviceId = normalizeMongoId(row.serviceId);
            if (!vehicleId || !serviceId) return;
            const serviceType = String(row?.serviceType || '').trim();
            if (serviceType === 'Oil Service') {
                navigateFromList(router, `/HRM/Asset/Vehicle/details/${vehicleId}/oil-service/${serviceId}`);
                return;
            }
            if (serviceType === 'Car Wash') {
                navigateFromList(
                    router,
                    `/HRM/Asset/Vehicle/details/${vehicleId}?tab=service&carWashServiceId=${serviceId}`,
                );
                return;
            }
            navigateFromList(
                router,
                `/HRM/Asset/Vehicle/service-requests/details/${vehicleId}/${serviceId}`,
            );
        },
        [router]
    );

    const handleDelete = useCallback(
        (row) => {
            const vehicleId = normalizeMongoId(row.vehicleId);
            const serviceId = normalizeMongoId(row.serviceId);
            if (!vehicleId || !serviceId) return;
            setDeleteTarget(row);
        },
        [],
    );

    const executeDelete = useCallback(async () => {
        if (!deleteTarget) return;
        const row = deleteTarget;
        const vehicleId = normalizeMongoId(row.vehicleId);
        const serviceId = normalizeMongoId(row.serviceId);
        if (!vehicleId || !serviceId) return;
        const key = serviceRowKey(row);
        try {
            setDeletingKey(key);
            setDeleteTarget(null);
            await axiosInstance.delete(`/AssetItem/${vehicleId}/service/${serviceId}`, {
                timeout: 20000,
            });
            setRows((prev) => prev.filter((r) => serviceRowKey(r) !== key));
            toast({ title: 'Deleted', description: 'Service request removed successfully.' });
        } catch (error) {
            setDeleteTarget(row);
            toast({
                variant: 'destructive',
                title: 'Delete failed',
                description: error.response?.data?.message || 'Could not delete this service request.',
            });
        } finally {
            setDeletingKey('');
        }
    }, [deleteTarget, toast]);

    const handleSubmitDraft = useCallback(
        async (row) => {
            const vehicleId = normalizeMongoId(row.vehicleId);
            const serviceId = normalizeMongoId(row.serviceId);
            if (!vehicleId || !serviceId) return;
            const key = serviceRowKey(row);
            try {
                setSubmittingKey(key);
                await axiosInstance.post(`/AssetItem/${vehicleId}/service/${serviceId}/submit-request`);
                toast({ title: 'Submitted', description: 'Draft moved for workflow approval.' });
                await load();
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Submit failed',
                    description: error.response?.data?.message || 'Could not submit this draft request.',
                });
            } finally {
                setSubmittingKey('');
            }
        },
        [load, toast]
    );

    if (!mounted) return null;

    return (
        <>
        <PermissionGuard moduleId="hrm_asset_vehicle" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full bg-[#f2f6f9]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <div className="p-8">
                        <div className="flex flex-col gap-4 mb-6">
                            <ListReturnBackButton
                                onFallback={() => router.push('/HRM/Asset/Vehicle/dashboard')}
                                className="w-fit"
                            />
                            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 dashboard-hero-glow rounded-2xl px-4 py-4 md:px-6 md:py-5 border border-white/60 shadow-sm shadow-teal-900/5">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
                                        {vehicleIdFilter ? 'Vehicle service history' : 'Service requests'}
                                    </h1>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {vehicleIdFilter
                                            ? 'Service lines for this vehicle only (newest first).'
                                            : 'All service lines for fleet vehicles (newest first). Rows stay here after the workflow completes.'}
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
                                <VehicleServiceRecordsTable
                                    rows={rows}
                                    onRowClick={onRowClick}
                                    canDeleteRow={canDeleteServiceRow}
                                    onDelete={handleDelete}
                                    onSubmitDraft={handleSubmitDraft}
                                    deletingKey={deletingKey}
                                    submittingKey={submittingKey}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </PermissionGuard>
        <ConfirmAlertDialog
            open={Boolean(deleteTarget)}
            onOpenChange={(open) => !open && !deletingKey && setDeleteTarget(null)}
            title="Delete service request?"
            description="This service request record will be permanently removed. This cannot be undone."
            confirmLabel="Delete"
            destructive
            loading={Boolean(deletingKey)}
            onConfirm={executeDelete}
        />
        </>
    );
}
