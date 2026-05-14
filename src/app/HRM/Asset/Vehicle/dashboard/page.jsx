'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    List,
    RotateCcw,
    Wrench,
    X,
    ChevronDown,
    Droplets,
    CircleDot,
    Hammer,
    PaintBucket,
    AlertTriangle,
    Sparkles,
    Bell,
    ClipboardList,
} from 'lucide-react';
import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import VehicleFleetDashboard from '@/app/HRM/Asset/Vehicle/components/VehicleFleetDashboard';
import VehicleServiceModal from '@/app/HRM/Asset/Vehicle/components/VehicleServiceModal';
import PendingAssetRequestsModal from '@/app/HRM/Asset/components/PendingAssetRequestsModal';
import { VEHICLE_SERVICE_TYPES } from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';

const SERVICE_TYPE_META = {
    'Oil Service': { icon: Droplets, desc: 'Oil & filter' },
    'Tire Change': { icon: CircleDot, desc: 'Tires & rotation' },
    'Mechanical Work': { icon: Hammer, desc: 'Repairs & parts' },
    'Body Work': { icon: PaintBucket, desc: 'Dent & paint' },
    'Accident Repair': { icon: AlertTriangle, desc: 'Insurance / accident' },
    'Car Wash': { icon: Sparkles, desc: 'Cleaning' },
};

export default function VehicleFleetDashboardPage() {
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [fleetDashboard, setFleetDashboard] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState(null);

    const [serviceMenuOpen, setServiceMenuOpen] = useState(false);
    const serviceMenuRef = useRef(null);

    const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
    const [pickerVehicleId, setPickerVehicleId] = useState('');
    const [serviceModalOpen, setServiceModalOpen] = useState(false);
    const [serviceVehicle, setServiceVehicle] = useState(null);
    const [presetServiceType, setPresetServiceType] = useState('');
    const [vehicleInboxOpen, setVehicleInboxOpen] = useState(false);
    const [vehicleInboxCount, setVehicleInboxCount] = useState(0);
    const vehicleInboxWarmRef = useRef(false);

    const vehicles = fleetDashboard?.vehicles || [];

    const fetchVehicleInboxCount = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/AssetItem/dashboard/pending-inbox', { params: { scope: 'vehicle' } });
            const items = Array.isArray(res.data?.items) ? res.data.items : [];
            const n = items.filter((row) => row.asset || (row.isBulk && row.bulkAssetIds?.length)).length;
            setVehicleInboxCount(n);
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
        if (!serviceMenuOpen) return;
        const onDoc = (e) => {
            if (serviceMenuRef.current && !serviceMenuRef.current.contains(e.target)) {
                setServiceMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [serviceMenuOpen]);

    const beginServiceForType = (type) => {
        setPresetServiceType(type);
        setServiceMenuOpen(false);

        if (!vehicles.length) {
            setPresetServiceType('');
            toast({
                variant: 'destructive',
                title: 'No vehicles',
                description: 'Add a vehicle first, or open the vehicle list.',
            });
            return;
        }
        if (vehicles.length === 1) {
            setServiceVehicle(vehicles[0]);
            setServiceModalOpen(true);
            return;
        }
        setPickerVehicleId(String(vehicles[0]._id));
        setVehiclePickerOpen(true);
    };

    const confirmVehicleForService = () => {
        const v = vehicles.find((x) => String(x._id) === String(pickerVehicleId));
        if (!v) {
            toast({ variant: 'destructive', title: 'Select a vehicle' });
            return;
        }
        setServiceVehicle(v);
        setVehiclePickerOpen(false);
        setServiceModalOpen(true);
    };

    const closeServiceModal = () => {
        setServiceModalOpen(false);
        setServiceVehicle(null);
        setPresetServiceType('');
    };

    const fetchFleetDashboard = useCallback(async () => {
        try {
            setDashboardLoading(true);
            setDashboardError(null);
            const res = await axiosInstance.get('/AssetItem/vehicle-fleet-dashboard');
            setFleetDashboard(res.data);
        } catch (error) {
            console.error('Error fetching vehicle fleet dashboard', error);
            setDashboardError(error.response?.data?.message || 'Failed to load dashboard');
            setFleetDashboard(null);
        } finally {
            setDashboardLoading(false);
        }
    }, []);

    useEffect(() => {
        setMounted(true);
        fetchFleetDashboard();
    }, [fetchFleetDashboard]);

    useEffect(() => {
        if (!mounted || dashboardLoading) return;
        let cancelled = false;
        const run = () => {
            if (!cancelled) warmVehicleInboxBadge();
        };
        const t = setTimeout(run, 2500);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [mounted, dashboardLoading, warmVehicleInboxBadge]);

    if (!mounted) return null;

    return (
        <PermissionGuard moduleId="hrm_asset" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full bg-[#f2f6f9]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <div className="p-8">
                        <ScrollReveal className="relative z-[140]" durationMs={550} rootMargin="0px 0px 10% 0px">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 dashboard-hero-glow rounded-2xl px-4 py-3 md:px-5 md:py-4 border border-white/60 shadow-sm shadow-teal-900/5">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Vehicle dashboard</h1>
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

                                    <div className="relative" ref={serviceMenuRef}>
                                        <button
                                            type="button"
                                            onClick={() => setServiceMenuOpen((o) => !o)}
                                            disabled={dashboardLoading || !vehicles.length}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00B5AD] text-white text-sm font-semibold hover:bg-teal-600 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                        >
                                            <Wrench size={18} />
                                            Create service request
                                            <ChevronDown
                                                size={16}
                                                className={`opacity-90 transition-transform ${serviceMenuOpen ? 'rotate-180' : ''}`}
                                            />
                                        </button>

                                        {serviceMenuOpen && (
                                            <div
                                                className="absolute right-0 top-full z-[130] mt-2 w-[min(100vw-2rem,420px)] rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50 ring-1 ring-black/5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                                                role="menu"
                                            >
                                                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-slate-50/50">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
                                                        Service type
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                        Same options as the vehicle Service tab — pick one, then choose the vehicle if needed.
                                                    </p>
                                                </div>
                                                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[min(70vh,360px)] overflow-y-auto">
                                                    {VEHICLE_SERVICE_TYPES.map((label) => {
                                                        const meta = SERVICE_TYPE_META[label] || {
                                                            icon: Wrench,
                                                            desc: '',
                                                        };
                                                        const Icon = meta.icon;
                                                        return (
                                                            <button
                                                                key={label}
                                                                type="button"
                                                                role="menuitem"
                                                                onClick={() => beginServiceForType(label)}
                                                                className="flex items-start gap-3 text-left rounded-xl border border-slate-100 bg-white px-3 py-3 hover:border-teal-200 hover:bg-teal-50/40 transition-all group"
                                                            >
                                                                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 group-hover:bg-teal-500/15">
                                                                    <Icon size={20} strokeWidth={2} />
                                                                </span>
                                                                <span className="min-w-0">
                                                                    <span className="block text-sm font-bold text-slate-800 leading-tight">
                                                                        {label}
                                                                    </span>
                                                                    {meta.desc ? (
                                                                        <span className="block text-[11px] text-slate-500 mt-0.5">
                                                                            {meta.desc}
                                                                        </span>
                                                                    ) : null}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <Link
                                        href="/HRM/Asset/Vehicle/service-requests"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-50 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <ClipboardList size={18} />
                                        View service request
                                    </Link>

                                    <Link
                                        href="/HRM/Asset/Vehicle"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <List size={18} />
                                        View vehicle list
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={fetchFleetDashboard}
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
                        />
                    </div>
                </div>
            </div>

            {vehiclePickerOpen && (
                <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Select vehicle</h2>
                                {presetServiceType ? (
                                    <p className="text-xs text-slate-500 mt-1 font-medium">
                                        Service: <span className="text-teal-700">{presetServiceType}</span>
                                    </p>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setVehiclePickerOpen(false);
                                    setPresetServiceType('');
                                }}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <label className="block text-sm font-semibold text-gray-700">Vehicle</label>
                            <select
                                value={pickerVehicleId}
                                onChange={(e) => setPickerVehicleId(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-[#00B5AD] outline-none"
                            >
                                {vehicles.map((v) => (
                                    <option key={v._id} value={String(v._id)}>
                                        {v.plateNumber || v.label || v.assetId || v._id}
                                        {v.assetId ? ` · ${v.assetId}` : ''}
                                    </option>
                                ))}
                            </select>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setVehiclePickerOpen(false);
                                        setPresetServiceType('');
                                    }}
                                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmVehicleForService}
                                    className="px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                                >
                                    Continue to form
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <VehicleServiceModal
                isOpen={serviceModalOpen}
                onClose={closeServiceModal}
                onSuccess={() => {
                    fetchFleetDashboard();
                    fetchVehicleInboxCount();
                    closeServiceModal();
                    toast({
                        title: 'Service request submitted',
                        description:
                            'It is stored on the vehicle with a service record ID and appears on Service requests. Approvals follow the flowchart on that line.',
                    });
                }}
                assetId={serviceVehicle?._id}
                presetServiceType={presetServiceType}
                assignedEmployee={
                    serviceVehicle?.assignedTo && typeof serviceVehicle.assignedTo === 'object'
                        ? serviceVehicle.assignedTo
                        : null
                }
                assetController={serviceVehicle?.assetController || null}
                assetControllerId={serviceVehicle?.assetControllerId || null}
                lastCompletedServiceDate={null}
                serviceRequestSource="vehicle_fleet_dashboard"
            />

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
                    fetchVehicleInboxCount();
                }}
            />
        </PermissionGuard>
    );
}
