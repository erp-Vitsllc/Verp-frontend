'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ClipboardList, Route } from 'lucide-react';
import VehicleServiceRequestRecordDetails from '@/app/HRM/Asset/Vehicle/components/VehicleServiceRequestRecordDetails';
import VehicleServiceWorkflowTrackReadonly from '@/app/HRM/Asset/Vehicle/components/VehicleServiceWorkflowTrackReadonly';
import { normalizeMongoId } from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';

export default function VehicleServiceRequestDetailsPage() {
    const params = useParams();
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [asset, setAsset] = useState(null);
    const [activeTab, setActiveTab] = useState('service-details');

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
            console.error('vehicle service request details load failed', error);
            toast({
                variant: 'destructive',
                title: 'Could not load service request details',
                description: error.response?.data?.message || 'Try again in a moment.',
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

    const selectedRow = useMemo(() => {
        if (!vehicleIdParam || !serviceIdParam) return null;
        return (
            rows.find((row) => {
                const rowVehicleId = normalizeMongoId(row.vehicleId);
                const rowServiceId = normalizeMongoId(row.serviceId);
                return rowVehicleId === vehicleIdParam && rowServiceId === serviceIdParam;
            }) || null
        );
    }, [rows, vehicleIdParam, serviceIdParam]);

    if (!mounted) return null;

    return (
        <PermissionGuard moduleId="hrm_asset" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full bg-[#f2f6f9]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <div className="p-8 space-y-6">
                        <div className="flex flex-col gap-3">
                            <Link
                                href="/HRM/Asset/Vehicle/service-requests"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-900 w-fit"
                            >
                                <ArrowLeft size={16} />
                                Back to service requests
                            </Link>
                            <div className="rounded-2xl px-4 py-4 md:px-6 md:py-5 border border-white/60 shadow-sm shadow-teal-900/5 dashboard-hero-glow">
                                <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Service request details</h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Request details and approval progress tracker for the selected service line.
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-10 text-center text-sm font-medium text-slate-500">
                                Loading details...
                            </div>
                        ) : !selectedRow ? (
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-10 text-center">
                                <p className="text-sm font-semibold text-slate-700">Service request not found.</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    It may have been removed or the link is outdated.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm h-full min-h-[260px]" />

                                    <div className="space-y-2 h-full flex flex-col">
                                        <div className="px-1 flex items-center gap-2">
                                            <Route size={16} className="text-teal-600" />
                                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                Approval tracker
                                            </p>
                                        </div>
                                        <div className="flex-1">
                                            <VehicleServiceWorkflowTrackReadonly
                                                workflowSnapshot={selectedRow.workflowSnapshot}
                                                asset={asset}
                                                serviceRecordId={normalizeMongoId(selectedRow.serviceId)}
                                                vehicleDetailHref={`/HRM/Asset/Vehicle/details/${vehicleIdParam}`}
                                                loading={false}
                                                errorMessage={null}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="px-4 pt-3 border-b border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('service-details')}
                                                className={`pb-3 px-1 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
                                                    activeTab === 'service-details'
                                                        ? 'border-teal-600 text-teal-700'
                                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                Service details
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        {activeTab === 'service-details' ? (
                                            <VehicleServiceRequestRecordDetails row={selectedRow} />
                                        ) : null}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
