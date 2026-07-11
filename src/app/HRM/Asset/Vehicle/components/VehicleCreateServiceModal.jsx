'use client';

import { useMemo, useState } from 'react';
import { Loader2, Wrench, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    VEHICLE_SERVICE_TYPES,
    buildFleetListServicePendingRequestBody,
    normalizeMongoId,
} from './vehicleServiceUtils';

function vehicleOptionLabel(vehicle) {
    const plate = [vehicle?.plateEmirate, vehicle?.plateNumber].filter(Boolean).join(' ').trim();
    const name = String(vehicle?.name || vehicle?.vehicleBrand || '').trim();
    const assetId = String(vehicle?.assetId || '').trim();
    const parts = [plate || null, name || null, assetId || null].filter(Boolean);
    return parts.join(' · ') || 'Vehicle';
}

function isSelectableFleetVehicle(vehicle) {
    if (!vehicle) return false;
    const id = normalizeMongoId(vehicle._id);
    if (!id || id.startsWith('locator-')) return false;
    if (vehicle.isLocatorOnly || vehicle.needsLocatorSetup) return false;
    return true;
}

export default function VehicleCreateServiceModal({
    isOpen,
    onClose,
    vehicles = [],
    onSuccess,
}) {
    const { toast } = useToast();
    const [serviceType, setServiceType] = useState('');
    const [vehicleId, setVehicleId] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const vehicleOptions = useMemo(() => {
        return (vehicles || [])
            .filter(isSelectableFleetVehicle)
            .slice()
            .sort((a, b) => vehicleOptionLabel(a).localeCompare(vehicleOptionLabel(b)));
    }, [vehicles]);

    if (!isOpen) return null;

    const handleClose = () => {
        if (submitting) return;
        setServiceType('');
        setVehicleId('');
        onClose?.();
    };

    const handleSubmit = async () => {
        if (!serviceType) {
            toast({
                variant: 'destructive',
                title: 'Service type required',
                description: 'Select a service type.',
            });
            return;
        }
        if (!vehicleId) {
            toast({
                variant: 'destructive',
                title: 'Vehicle required',
                description: 'Select a vehicle.',
            });
            return;
        }

        try {
            setSubmitting(true);
            let asset = vehicleOptions.find((v) => normalizeMongoId(v._id) === vehicleId) || null;
            try {
                const detailRes = await axiosInstance.get(`/AssetItem/detail/${vehicleId}`, {
                    skipToast: true,
                    timeout: 20000,
                });
                if (detailRes?.data) asset = detailRes.data;
            } catch {
                // Fall back to list row fields when detail is unavailable.
            }

            const payload = buildFleetListServicePendingRequestBody(asset || { _id: vehicleId }, serviceType, {
                source: 'vehicle_fleet_dashboard',
            });

            const { data } = await axiosInstance.post(`/AssetItem/${vehicleId}/service`, payload, {
                timeout: 30000,
            });

            const createdId = normalizeMongoId(data?.service?._id);
            toast({
                title: 'Service request created',
                description: `${serviceType} pending row was added. Admin Officer and assigned user were notified.`,
            });
            onSuccess?.({
                vehicleId,
                serviceId: createdId,
                serviceType,
                service: data?.service,
            });
            setServiceType('');
            setVehicleId('');
            onClose?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not create service',
                description: error?.response?.data?.message || 'Failed to create service request.',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
                            <Wrench size={18} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Create service</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Pick a type and vehicle — a pending Service tab row is created.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Service type <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={serviceType}
                            onChange={(e) => setServiceType(e.target.value)}
                            className="mt-2 w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                        >
                            <option value="">Select service type</option>
                            {VEHICLE_SERVICE_TYPES.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Vehicle <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={vehicleId}
                            onChange={(e) => setVehicleId(e.target.value)}
                            className="mt-2 w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                        >
                            <option value="">Select vehicle</option>
                            {vehicleOptions.map((vehicle) => {
                                const id = normalizeMongoId(vehicle._id);
                                return (
                                    <option key={id} value={id}>
                                        {vehicleOptionLabel(vehicle)}
                                    </option>
                                );
                            })}
                        </select>
                        {vehicleOptions.length === 0 ? (
                            <p className="mt-2 text-[11px] text-amber-700 font-medium">
                                No eligible vehicles in the current list. Refresh the list or activate a vehicle profile.
                            </p>
                        ) : null}
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || !serviceType || !vehicleId}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60"
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Wrench size={16} />}
                        {submitting ? 'Creating…' : 'Create service'}
                    </button>
                </div>
            </div>
        </div>
    );
}
