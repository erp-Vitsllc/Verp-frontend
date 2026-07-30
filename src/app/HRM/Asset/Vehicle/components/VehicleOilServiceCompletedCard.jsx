'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import VehicleOilServiceLockedSection from './VehicleOilServiceLockedSection';
import {
    OIL_SERVICE_CARD,
    resolveOilServiceCardGate,
} from '../utils/vehicleOilServiceAccess';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import { tireDatePickerClass } from '../utils/vehicleAccidentRepairDetailUi';

function toDateInputValue(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function resolveOilExtendDates(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const wf = asset?.activeServiceWorkflow || {};
    return {
        start: toDateInputValue(remark.serviceStartDate || remark.scheduledServiceDate || wf.scheduledServiceDate),
        end: toDateInputValue(remark.serviceEndDate || remark.nextChangeMonth || wf.serviceWindowEndDate),
    };
}

export default function VehicleOilServiceCompletedCard({
    asset,
    service,
    vehicleId,
    serviceId,
    workflowStage = '',
    onUpdated,
    className = '',
}) {
    const { toast } = useToast();
    const gate = useMemo(
        () => resolveOilServiceCardGate(service, asset, OIL_SERVICE_CARD.EXTEND),
        [service, asset],
    );
    const unlocked = !gate.locked;
    const lockMessage = gate.message || 'Complete the previous step first';

    const [dates, setDates] = useState(() => resolveOilExtendDates(service, asset));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDates(resolveOilExtendDates(service, asset));
    }, [asset, service?._id, service?.updatedAt, service?.remark]);

    const canEdit = unlocked && !saving;

    const handleUpdate = useCallback(async () => {
        if (!canEdit || !vehicleId || !serviceId) return;
        if (!dates.start && !dates.end) return;
        setSaving(true);
        try {
            const { data } = await axiosInstance.put(`/AssetItem/${vehicleId}/service/${serviceId}/oil-dates`, {
                serviceStartDate: dates.start || '',
                serviceEndDate: dates.end || '',
            });
            toast({ title: 'Dates updated', description: 'Service start and end dates have been updated.' });
            if (typeof onUpdated === 'function') onUpdated(data?.asset || null);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not update dates',
                description: error.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    }, [canEdit, dates.end, dates.start, onUpdated, serviceId, toast, vehicleId]);

    return (
        <div className={`w-full ${className}`.trim()}>
            <VehicleOilServiceLockedSection locked={!unlocked} message={lockMessage}>
                <FineFormCard
                    title="Extend Date"
                    subtitle={
                        unlocked
                            ? 'Update the service start or end date when more time is needed.'
                            : 'Locked until Schedule and Reschedule is submitted'
                    }
                    icon={ClipboardCheck}
                    iconBg="bg-teal-50"
                    iconColor="text-teal-600"
                    className="w-full"
                >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Start Date
                            </span>
                            <div className="mt-1.5">
                                <DatePicker
                                    value={dates.start || ''}
                                    onChange={(value) => setDates((prev) => ({ ...prev, start: value || '' }))}
                                    placeholder="dd/mm/yyyy"
                                    className={tireDatePickerClass}
                                    disabled={!canEdit}
                                />
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                End Date
                            </span>
                            <div className="mt-1.5">
                                <DatePicker
                                    value={dates.end || ''}
                                    onChange={(value) => setDates((prev) => ({ ...prev, end: value || '' }))}
                                    placeholder="dd/mm/yyyy"
                                    className={tireDatePickerClass}
                                    disabled={!canEdit}
                                />
                            </div>
                        </div>
                    </div>
                    {canEdit ? (
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => void handleUpdate()}
                                disabled={saving || (!dates.start && !dates.end)}
                                className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                                {saving ? 'Updating…' : 'Update'}
                            </button>
                        </div>
                    ) : null}
                </FineFormCard>
            </VehicleOilServiceLockedSection>
        </div>
    );
}
