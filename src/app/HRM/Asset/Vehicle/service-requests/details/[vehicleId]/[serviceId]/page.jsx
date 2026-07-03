'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import VehicleServiceWorkflowCards from '@/app/HRM/Asset/Vehicle/components/VehicleServiceWorkflowCards';
import { normalizeMongoId } from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';

export default function VehicleServiceRequestDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [asset, setAsset] = useState(null);

    const vehicleIdParam = useMemo(() => normalizeMongoId(params?.vehicleId), [params?.vehicleId]);
    const serviceIdParam = useMemo(() => normalizeMongoId(params?.serviceId), [params?.serviceId]);

    useEffect(() => {
        setMounted(true);
    }, []);

    const load = useCallback(async () => {
        if (!vehicleIdParam || !serviceIdParam) return;

        setLoading(true);
        try {
            const [rowsRes, assetRes] = await Promise.all([
                axiosInstance.get('/AssetItem/vehicle-fleet-service-requests'),
                axiosInstance.get(`/AssetItem/detail/${vehicleIdParam}`),
            ]);
            setRows(Array.isArray(rowsRes.data?.items) ? rowsRes.data.items : []);
            setAsset(assetRes.data || null);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load service request details',
                description:
                    error.message ||
                    error.response?.data?.message ||
                    'Try again in a moment.',
            });
            setRows([]);
            setAsset(null);
        } finally {
            setLoading(false);
        }
    }, [vehicleIdParam, serviceIdParam, toast]);

    useEffect(() => {
        if (!mounted) return;
        load();
    }, [mounted, load]);

    const matchedRow = useMemo(() => {
        if (!vehicleIdParam || !serviceIdParam) return null;
        return (
            rows.find((row) => {
                const rowVehicleId = normalizeMongoId(row?.vehicleId);
                const rowServiceId = normalizeMongoId(row?.serviceId);
                return rowVehicleId === vehicleIdParam && rowServiceId === serviceIdParam;
            }) || null
        );
    }, [rows, vehicleIdParam, serviceIdParam]);

    const hasRequestMatch = Boolean(matchedRow);

    useEffect(() => {
        if (loading || !matchedRow || !vehicleIdParam || !serviceIdParam) return;
        const serviceType = String(matchedRow.serviceType || '').trim();
        if (serviceType === 'Car Wash') {
            router.replace(
                `/HRM/Asset/Vehicle/details/${vehicleIdParam}?tab=service&carWashServiceId=${serviceIdParam}`,
            );
            return;
        }
        if (serviceType === 'Oil Service') {
            router.replace(`/HRM/Asset/Vehicle/details/${vehicleIdParam}/oil-service/${serviceIdParam}`);
            return;
        }
        if (serviceType === 'Tire Change') {
            router.replace(`/HRM/Asset/Vehicle/details/${vehicleIdParam}/tire-change/${serviceIdParam}`);
            return;
        }
        if (serviceType === 'Mechanical Work') {
            router.replace(`/HRM/Asset/Vehicle/details/${vehicleIdParam}/mechanical-work/${serviceIdParam}`);
        }
    }, [loading, matchedRow, router, serviceIdParam, vehicleIdParam]);

    if (!mounted) return null;

    return (
        <PermissionGuard moduleId="hrm_asset_vehicle" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full bg-[#f2f6f9]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <div className="p-6 md:p-8">
                        {loading ? (
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-10 text-center text-sm font-medium text-slate-500">
                                Loading details...
                            </div>
                        ) : ['Car Wash', 'Oil Service', 'Tire Change', 'Mechanical Work'].includes(
                              String(matchedRow?.serviceType || '').trim(),
                          ) ? (
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-10 text-center text-sm font-medium text-slate-500">
                                Opening service request...
                            </div>
                        ) : !hasRequestMatch ? (
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-10 text-center">
                                <p className="text-sm font-semibold text-slate-700">Service request not found.</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    It may have been removed or the link is outdated.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                                    <VehicleServiceWorkflowCards
                                        asset={asset}
                                        assetId={vehicleIdParam}
                                        serviceRecordId={serviceIdParam}
                                        onUpdated={() => {
                                            load();
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
