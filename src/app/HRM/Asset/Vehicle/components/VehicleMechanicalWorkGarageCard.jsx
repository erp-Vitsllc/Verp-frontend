'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import {
    canEditMechanicalWorkGarage,
    MECHANICAL_WORK_WORKFLOW_STAGES,
} from '../utils/vehicleMechanicalWorkWorkflow';
import VehicleMechanicalWorkFormFieldCell from './VehicleMechanicalWorkFormFieldCell';
import VehicleServiceLockedSection from './VehicleServiceLockedSection';
import ZohoVendorSelect from '@/components/ZohoVendorSelect';
import { buildGarageHistoryOptions } from '../utils/buildGarageHistoryOptions';
import {
    buildMechanicalWorkGarageFormState,
    buildMechanicalWorkGarageUpdateBody,
    isMechanicalWorkGarageFormComplete,
    validateMechanicalWorkGarageForm,
} from '../utils/vehicleMechanicalWorkGarageForm';
import {
    MECHANICAL_WORK_DETAIL_GRID_LAYOUT,
    tireAccent as mechanicalAccent,
    tireDatePickerClass as mechanicalDatePickerClass,
    tireFieldSelect as mechanicalFieldSelect,
} from '../utils/vehicleMechanicalWorkDetailUi';
import {
    SHOP_SERVICE_CARD,
    resolveShopServiceCardGate,
} from '../utils/vehicleShopServiceCardGates';
import {
    serviceEndDisabledDays,
    serviceStartDisabledDays,
} from '../utils/vehicleServiceScheduleDates';
import {
    getScheduleSubmitButtonLabel,
    getScheduleSubmitStatus,
    getScheduleSubmitStatusLabel,
} from '../utils/vehicleServiceScheduleSubmitStatus';

export default function VehicleMechanicalWorkGarageCard({
    asset,
    service,
    vehicleId,
    serviceId,
    canManage = false,
    workflowStage = '',
    onUpdated,
    className = '',
}) {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(() => buildMechanicalWorkGarageFormState(service, asset));

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const scheduleSubmitStatus = getScheduleSubmitStatus(
        remark,
        asset?.activeServiceWorkflow,
    );
    const scheduleStatusLabel = getScheduleSubmitStatusLabel(scheduleSubmitStatus);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const stage = String(workflowStage || '').toLowerCase();
    const isComplete = stage === MECHANICAL_WORK_WORKFLOW_STAGES.COMPLETE;

    const canEditGarage = canEditMechanicalWorkGarage(stage, canManage, { asset, service });
    const scheduleGate = resolveShopServiceCardGate({
        assignmentPending,
        workflowStage: stage,
        service,
        cardKey: SHOP_SERVICE_CARD.SCHEDULE,
    });
    const fieldsDisabled = !canEditGarage || saving || isComplete || assignmentPending || scheduleGate.locked;

    const { fieldMinHeightPx, gapClass } = MECHANICAL_WORK_DETAIL_GRID_LAYOUT;
    const accent = mechanicalAccent;

    useEffect(() => {
        setFormData(buildMechanicalWorkGarageFormState(service, asset));
    }, [service?._id, service?.updatedAt, service?.remark, asset]);

    const garageOptions = useMemo(
        () => buildGarageHistoryOptions(asset, service, formData.garageName),
        [asset, service, formData.garageName],
    );

    const set = useCallback((key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleUpdate = async () => {
        if (!vehicleId || !serviceId || !canEditGarage) return;
        if (!isMechanicalWorkGarageFormComplete(formData)) {
            const errors = validateMechanicalWorkGarageForm(formData);
            toast({
                variant: 'destructive',
                title: 'Complete garage details',
                description: Object.values(errors).join(', '),
            });
            return;
        }

        setSaving(true);
        try {
            const body = buildMechanicalWorkGarageUpdateBody(formData);
            const { data } = await axiosInstance.put(
                `/AssetItem/${vehicleId}/service/${serviceId}/mechanical-work/garage`,
                body,
            );
            toast({
                title: scheduleSubmitStatus ? 'Schedule resubmitted' : 'Schedule submitted',
                description: scheduleSubmitStatus
                    ? 'Garage and dates were resubmitted for this mechanical work.'
                    : 'Garage and dates were submitted for this mechanical work.',
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not update garage',
                description: error.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    const subtitle = scheduleGate.locked
        ? scheduleGate.message
        : !canManage
          ? 'Waiting for Admin / Admin Officer to schedule / reschedule'
          : canEditGarage
            ? 'Admin / Admin Officer can schedule / reschedule anytime until Complete Service'
            : 'Garage vendor and scheduled service window';

    const card = (
        <FineFormCard
            title="Schedule and Reschedule Service"
            subtitle={subtitle}
            icon={CalendarClock}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
            className="w-full"
        >
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                <VehicleMechanicalWorkFormFieldCell
                    label="Garage Name (Vendor)"
                    accentClass={accent(0)}
                    minHeightPx={fieldMinHeightPx}
                >
                    <ZohoVendorSelect
                        className="w-full"
                        value={formData.garageName || ''}
                        onChange={(nextValue, vendor) => {
                            set('garageName', nextValue);
                            set(
                                'zohoVendorId',
                                String(vendor?.id || vendor?.zohoContactId || vendor?.value || '').trim(),
                            );
                        }}
                        disabled={fieldsDisabled}
                        placeholder="Select vendor"
                        extraOptions={garageOptions}
                    />
                </VehicleMechanicalWorkFormFieldCell>
                <VehicleMechanicalWorkFormFieldCell
                    label="Garage Location"
                    accentClass={accent(1)}
                    minHeightPx={fieldMinHeightPx}
                >
                    <input
                        className={mechanicalFieldSelect}
                        type="text"
                        value={formData.garageLocation || ''}
                        onChange={(e) => set('garageLocation', e.target.value)}
                        disabled={fieldsDisabled}
                    />
                </VehicleMechanicalWorkFormFieldCell>
                <VehicleMechanicalWorkFormFieldCell
                    label="Garage Contact"
                    accentClass={accent(2)}
                    minHeightPx={fieldMinHeightPx}
                >
                    <input
                        className={mechanicalFieldSelect}
                        type="text"
                        value={formData.garageContact || ''}
                        onChange={(e) => set('garageContact', e.target.value)}
                        disabled={fieldsDisabled}
                    />
                </VehicleMechanicalWorkFormFieldCell>
                <VehicleMechanicalWorkFormFieldCell
                    label="Service Start Date"
                    accentClass={accent(0)}
                    minHeightPx={fieldMinHeightPx}
                >
                    <DatePicker
                        value={formData.serviceStartDate || ''}
                        onChange={(value) => set('serviceStartDate', value || '')}
                        placeholder="dd/mm/yyyy"
                        className={mechanicalDatePickerClass}
                        disabled={fieldsDisabled}
                        disabledDays={serviceStartDisabledDays()}
                    />
                </VehicleMechanicalWorkFormFieldCell>
                <VehicleMechanicalWorkFormFieldCell
                    label="Service End Date"
                    accentClass={accent(1)}
                    minHeightPx={fieldMinHeightPx}
                >
                    <DatePicker
                        value={formData.serviceEndDate || ''}
                        onChange={(value) => set('serviceEndDate', value || '')}
                        placeholder="dd/mm/yyyy"
                        className={mechanicalDatePickerClass}
                        disabled={fieldsDisabled}
                        disabledDays={serviceEndDisabledDays(formData.serviceStartDate)}
                    />
                </VehicleMechanicalWorkFormFieldCell>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Description (optional)
                </span>
                <textarea
                    className={`${mechanicalFieldSelect} mt-1.5 min-h-[88px] resize-y font-medium`}
                    rows={3}
                    value={formData.serviceIssue || ''}
                    onChange={(e) => set('serviceIssue', e.target.value)}
                    disabled={fieldsDisabled}
                    placeholder="Enter work description"
                />
            </div>

            {canEditGarage ? (
                <div className="mt-4 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                    {scheduleStatusLabel ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 border border-emerald-100">
                            {scheduleStatusLabel}
                        </span>
                    ) : null}
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleUpdate()}
                        className="min-w-[140px] rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {saving ? (
                            <span className="inline-flex items-center justify-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                {getScheduleSubmitButtonLabel({
                                    status: scheduleSubmitStatus,
                                    saving: true,
                                })}
                            </span>
                        ) : (
                            getScheduleSubmitButtonLabel({ status: scheduleSubmitStatus })
                        )}
                    </button>
                </div>
            ) : null}
        </FineFormCard>
    );

    return (
        <div className={`w-full ${className}`.trim()}>
            <VehicleServiceLockedSection
                locked={scheduleGate.locked}
                message={scheduleGate.message || 'Complete HR Approval first'}
            >
                {card}
            </VehicleServiceLockedSection>
        </div>
    );
}
