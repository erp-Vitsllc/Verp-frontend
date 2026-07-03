'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import {
    canEditServiceExtendDate,
    resolveServiceExtendDate,
} from '../utils/vehicleShopServiceExtendDate';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';

export default function VehicleShopServiceExtendDateSection({
    asset,
    service,
    vehicleId,
    serviceId,
    canManage = false,
    workflowStage = '',
    onUpdated,
    datePickerClass = '',
    updateButtonClass = '',
}) {
    const { toast } = useToast();
    const remark = parseVehicleServiceRemark(service) || {};
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const stage = String(workflowStage || '').toLowerCase();
    const isComplete =
        stage === 'complete' || String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live';

    const canEdit = canEditServiceExtendDate({
        assignmentPending,
        isComplete,
        stage,
        canManage,
    });

    const [extendDate, setExtendDate] = useState(() => resolveServiceExtendDate(service, asset));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setExtendDate(resolveServiceExtendDate(service, asset));
    }, [asset, service?._id, service?.updatedAt, service?.remark]);

    const handleUpdate = useCallback(async () => {
        if (!canEdit || !vehicleId || !serviceId || !extendDate) return;
        setSaving(true);
        try {
            const { data } = await axiosInstance.put(
                `/AssetItem/${vehicleId}/service/${serviceId}/extend-date`,
                { serviceEndDate: extendDate },
            );
            toast({ title: 'Extend date updated', description: 'Service end date has been updated.' });
            if (typeof onUpdated === 'function') onUpdated(data?.asset || null);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not update extend date',
                description: error.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    }, [canEdit, extendDate, onUpdated, serviceId, toast, vehicleId]);

    return (
        <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Extend Date
                    </span>
                    <div className="mt-1.5">
                        <DatePicker
                            value={extendDate || ''}
                            onChange={(value) => setExtendDate(value || '')}
                            placeholder="dd/mm/yyyy"
                            className={datePickerClass}
                            disabled={!canEdit || saving}
                        />
                    </div>
                </div>
                {canEdit ? (
                    <button
                        type="button"
                        disabled={saving || !extendDate}
                        onClick={() => void handleUpdate()}
                        className={
                            updateButtonClass ||
                            'inline-flex min-h-[40px] min-w-[140px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40'
                        }
                    >
                        {saving ? (
                            <span className="inline-flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                Updating...
                            </span>
                        ) : (
                            'Update Extend Date'
                        )}
                    </button>
                ) : null}
            </div>
            <p className="mt-2 text-xs text-gray-500">
                Admin Officer or assigned user can extend the service end date. This updates Garage / Service Details.
            </p>
        </div>
    );
}
