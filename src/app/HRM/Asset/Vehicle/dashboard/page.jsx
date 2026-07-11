'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { List, RotateCcw, Bell } from 'lucide-react';
import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import VehicleFleetDashboard from '@/app/HRM/Asset/Vehicle/components/VehicleFleetDashboard';
import { useLocatorFleetDashboard } from '@/hooks/useLocatorFleetDashboard';
import PendingAssetRequestsModal from '@/app/HRM/Asset/components/PendingAssetRequestsModal';
import {
    countVisibleAssetPendingInbox,
    ASSET_PENDING_INBOX_CHANGED,
} from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { fetchAssetPendingInbox } from '@/utils/pendingInboxFetch';

export default function VehicleFleetDashboardPage() {
    const [mounted, setMounted] = useState(false);
    const [fleetDashboard, setFleetDashboard] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState(null);

    const [vehicleInboxOpen, setVehicleInboxOpen] = useState(false);
    const [vehicleInboxCount, setVehicleInboxCount] = useState(0);
    const vehicleInboxWarmRef = useRef(false);

    const fetchVehicleInboxCount = useCallback(async ({ force = false, sync = false } = {}) => {
        try {
            const items = await fetchAssetPendingInbox(axiosInstance, {
                inboxScope: 'vehicle',
                skipSync: !(sync || force),
                skipToast: true,
                force,
            });
            setVehicleInboxCount(countVisibleAssetPendingInbox(items));
        } catch {
            setVehicleInboxCount(0);
        }
    }, []);

    const warmVehicleInboxBadge = useCallback(() => {
        if (vehicleInboxWarmRef.current) return;
        vehicleInboxWarmRef.current = true;
        fetchVehicleInboxCount();
    }, [fetchVehicleInboxCount]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onInboxChanged = () => {
            fetchVehicleInboxCount({ force: true });
        };
        window.addEventListener(ASSET_PENDING_INBOX_CHANGED, onInboxChanged);
        return () => window.removeEventListener(ASSET_PENDING_INBOX_CHANGED, onInboxChanged);
    }, [fetchVehicleInboxCount]);

    const fetchFleetDashboard = useCallback(async () => {
        try {
            setDashboardLoading(true);
            setDashboardError(null);
            const res = await axiosInstance.get('/AssetItem/vehicle-fleet-dashboard');
            setFleetDashboard(res.data);
        } catch (error) {
            setDashboardError(error.response?.data?.message || 'Failed to load dashboard');
            setFleetDashboard(null);
        } finally {
            setDashboardLoading(false);
        }
    }, []);

    const {
        data: locatorDashboard,
        loading: locatorLoading,
        error: locatorError,
        reload: reloadLocatorDashboard,
    } = useLocatorFleetDashboard();

    useEffect(() => {
        setMounted(true);
        fetchFleetDashboard();
    }, [fetchFleetDashboard]);

    useEffect(() => {
        if (!mounted || dashboardLoading) return;
        const t = setTimeout(() => warmVehicleInboxBadge(), 400);
        return () => clearTimeout(t);
    }, [mounted, dashboardLoading, warmVehicleInboxBadge]);

    if (!mounted) return null;

    return (
        <PermissionGuard moduleId="hrm_asset_vehicle" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full bg-white">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <div className="p-8">
                        <ScrollReveal className="relative z-[140]" durationMs={550} rootMargin="0px 0px 10% 0px">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 dashboard-hero-glow rounded-2xl px-4 py-3 md:px-5 md:py-4 border border-gray-200 bg-white shadow-sm">
                                <div>
                                    <h1 className="text-2xl md:text-3xl font-bold text-[#5c4f55] tracking-tight">
                                        Vehicle Dashboard
                                    </h1>
                                    <p className="text-sm text-[#9a8a90] mt-1 hidden md:block">
                                        Fleet availability, replacement outlook, and service metrics in floral overview.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setVehicleInboxOpen(true)}
                                        onMouseEnter={warmVehicleInboxBadge}
                                        onFocus={warmVehicleInboxBadge}
                                        className="relative inline-flex items-center justify-center p-2 rounded-lg bg-white border border-teal-200 text-teal-800 hover:bg-teal-50 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-md active:scale-95"
                                        title="Vehicle service workflow — pending inbox"
                                    >
                                        <Bell size={20} />
                                        {vehicleInboxCount > 0 ? (
                                            <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-black leading-none flex items-center justify-center border-2 border-white shadow-sm tabular-nums">
                                                {vehicleInboxCount > 99 ? '99+' : vehicleInboxCount}
                                            </span>
                                        ) : null}
                                    </button>

                                    <Link
                                        href="/HRM/Asset/Vehicle"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <List size={18} />
                                        View vehicle list
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            fetchFleetDashboard();
                                            reloadLocatorDashboard();
                                        }}
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-300 border border-gray-200 bg-white shadow-sm hover:scale-105 active:scale-95"
                                        title="Refresh dashboard"
                                    >
                                        <RotateCcw size={18} className="transition-transform duration-500 hover:rotate-180" />
                                    </button>
                                </div>
                            </div>
                        </ScrollReveal>

                        <VehicleFleetDashboard
                            data={fleetDashboard}
                            loading={dashboardLoading}
                            error={dashboardError}
                            onRefresh={fetchFleetDashboard}
                            locatorData={locatorDashboard}
                            locatorLoading={locatorLoading}
                            locatorError={locatorError}
                            onLocatorRefresh={reloadLocatorDashboard}
                        />
                    </div>
                </div>
            </div>

            <PendingAssetRequestsModal
                isOpen={vehicleInboxOpen}
                inboxScope="vehicle"
                onPendingInboxCount={setVehicleInboxCount}
                onClose={() => {
                    setVehicleInboxOpen(false);
                    fetchVehicleInboxCount();
                }}
                onRefreshParent={() => {
                    fetchFleetDashboard();
                    fetchVehicleInboxCount({ force: true });
                }}
            />
        </PermissionGuard>
    );
}
