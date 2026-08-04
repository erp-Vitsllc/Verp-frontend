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
    canEditBodyWorkGarage,
    BODY_WORK_WORKFLOW_STAGES,
} from '../utils/vehicleBodyWorkWorkflow';
import VehicleBodyWorkFormFieldCell from './VehicleBodyWorkFormFieldCell';
import VehicleServiceLockedSection from './VehicleServiceLockedSection';
import ZohoVendorSelect from '@/components/ZohoVendorSelect';
import { buildGarageHistoryOptions } from '../utils/buildGarageHistoryOptions';
import {
    buildBodyWorkGarageFormState,
    buildBodyWorkGarageUpdateBody,
    isBodyWorkGarageFormComplete,
    validateBodyWorkGarageForm,
} from '../utils/vehicleBodyWorkGarageForm';
import {
    BODY_WORK_DETAIL_GRID_LAYOUT,
    tireAccent as bodyAccent,
    tireDatePickerClass as bodyDatePickerClass,
    tireFieldSelect as bodyFieldSelect,
} from '../utils/vehicleBodyWorkDetailUi';
import {
    SHOP_SERVICE_CARD,
    resolveShopServiceCardGate,
} from '../utils/vehicleShopServiceCardGates';

export default function VehicleBodyWorkGarageCard({
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
    const [formData, setFormData] = useState(() => buildBodyWorkGarageFormState(service, asset));

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const stage = String(workflowStage || '').toLowerCase();
    const isComplete = stage === BODY_WORK_WORKFLOW_STAGES.COMPLETE;

    const canEditGarage = canEditBodyWorkGarage(stage, canManage, { asset, service });
    const scheduleGate = resolveShopServiceCardGate({
        assignmentPending,
        workflowStage: stage,
        service,
        cardKey: SHOP_SERVICE_CARD.SCHEDULE,
    });
    const fieldsDisabled = !canEditGarage || saving || isComplete || assignmentPending || scheduleGate.locked;

    const { fieldMinHeightPx, gapClass } = BODY_WORK_DETAIL_GRID_LAYOUT;
    const accent = bodyAccent;
    const approvedAmount =
        Number(remark.hrReviewApprovedAmount) ||
        Number(remark.approvedAmount) ||
        Number(remark.estimatedCost) ||
        Number(service?.value) ||
        0;

    useEffect(() => {
        setFormData(buildBodyWorkGarageFormState(service, asset));
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
        if (!isBodyWorkGarageFormComplete(formData)) {
            const errors = validateBodyWorkGarageForm(formData);
            toast({
                variant: 'destructive',
                title: 'Complete garage details',
                description: Object.values(errors).join(', '),
            });
            return;
        }

        setSaving(true);
        try {
            const body = buildBodyWorkGarageUpdateBody(formData);
            const { data } = await axiosInstance.put(
                `/AssetItem/${vehicleId}/service/${serviceId}/body-work/garage`,
                body,
            );
            toast({
                title: 'Service scheduled',
                description: 'Garage and dates were submitted for this body work.',
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
          ? 'Waiting for flowchart Admin Officer to schedule / reschedule'
          : stage === BODY_WORK_WORKFLOW_STAGES.HR ||
              stage === BODY_WORK_WORKFLOW_STAGES.ADMIN_OFFICER
            ? 'Garage and dates are required â€” then click OK (open with HR Approval)'
            : isComplete || stage === 'billed'
              ? 'Schedule locked â€” service is complete'
              : 'Admin Officer can update garage or dates until Complete Service';

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
                <VehicleBodyWorkFormFieldCell
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
                </VehicleBodyWorkFormFieldCell>
                <VehicleBodyWorkFormFieldCell
                    label="Garage Location"
                    accentClass={accent(1)}
                    minHeightPx={fieldMinHeightPx}
                >
                    <input
                        className={bodyFieldSelect}
                        type="text"
                        value={formData.garageLocation || ''}
                        onChange={(e) => set('garageLocation', e.target.value)}
                        disabled={fieldsDisabled}
                    />
                </VehicleBodyWorkFormFieldCell>
                <VehicleBodyWorkFormFieldCell
                    label="Garage Contact"
                    accentClass={accent(2)}
                    minHeightPx={fieldMinHeightPx}
                >
                    <input
                        className={bodyFieldSelect}
                        type="text"
                        value={formData.garageContact || ''}
                        onChange={(e) => set('garageContact', e.target.value)}
                        disabled={fieldsDisabled}
                    />
                </VehicleBodyWorkFormFieldCell>
                <VehicleBodyWorkFormFieldCell
                    label="Amount (from Initiate / HR)"
                    accentClass={accent(0)}
                    minHeightPx={fieldMinHeightPx}
                >
                    <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                            AED
                        </span>
                        <input
                            className={`${bodyFieldSelect} pl-11`}
                            type="text"
                            readOnly
                            value={
                                approvedAmount > 0
                                    ? approvedAmount.toLocaleString(undefined, {
                                          minimumFractionDigits: 0,
                                          maximumFractionDigits: 2,
                                      })
                                    : 'â€”'
                            }
                            disabled
                        />
                    </div>
                </VehicleBodyWorkFormFieldCell>
                <VehicleBodyWorkFormFieldCell
                    label="Service Start Date"
                    accentClass={accent(1)}
                    minHeightPx={fieldMinHeightPx}
                >
                    <DatePicker
                        value={formData.serviceStartDate || ''}
                        onChange={(value) => set('serviceStartDate', value || '')}
                        placeholder="dd/mm/yyyy"
                        className={bodyDatePickerClass}
                        disabled={fieldsDisabled}
                    />
                </VehicleBodyWorkFormFieldCell>
                <VehicleBodyWorkFormFieldCell
                    label="Service End Date"
                    accentClass={accent(2)}
                    minHeightPx={fieldMinHeightPx}
                >
                    <DatePicker
                        value={formData.serviceEndDate || ''}
                        onChange={(value) => set('serviceEndDate', value || '')}
                        placeholder="dd/mm/yyyy"
                        className={bodyDatePickerClass}
                        disabled={fieldsDisabled}
                    />
                </VehicleBodyWorkFormFieldCell>
            </div>

            {canEditGarage ? (
                <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleUpdate()}
                        className="min-w-[140px] rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {saving ? (
                            <span className="inline-flex items-center justify-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                Submitting...
                            </span>
                        ) : (
                            'OK'
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

