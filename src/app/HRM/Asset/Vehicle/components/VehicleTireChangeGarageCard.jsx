'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Wrench } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { parseVehicleServiceRemark, normalizeMongoId } from './vehicleServiceUtils';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import {
    canApproveTireChangeGarageAccounts,
    canEditTireChangeGarage,
    TIRE_CHANGE_WORKFLOW_STAGES,
} from '../utils/vehicleTireChangeWorkflow';
import VehicleTireChangeFormFieldCell from './VehicleTireChangeFormFieldCell';
import ZohoVendorSelect from '@/components/ZohoVendorSelect';
import { buildGarageHistoryOptions } from '../utils/buildGarageHistoryOptions';
import {
    buildTireChangeGarageFormState,
    buildTireChangeGarageUpdateBody,
    isTireChangeGarageFormComplete,
    validateTireChangeGarageForm,
} from '../utils/vehicleTireChangeGarageForm';
import {
    TIRE_CHANGE_DETAIL_GRID_LAYOUT,
    tireAccent,
    tireBtnBlue,
    tireBtnPrimary,
    tireDatePickerClass,
    tireFieldSelect,
} from '../utils/vehicleTireChangeDetailUi';

export default function VehicleTireChangeGarageCard({
    asset,
    service,
    vehicleId,
    serviceId,
    canManage = false,
    canActAccounts = false,
    workflowStage = '',
    onUpdated,
    className = '',
}) {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(() => buildTireChangeGarageFormState(service, asset));

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const stage = String(workflowStage || '').toLowerCase();
    const isComplete = stage === TIRE_CHANGE_WORKFLOW_STAGES.COMPLETE;

    const canEditGarage = canEditTireChangeGarage(stage, canManage);
    const canApproveAccounts = canApproveTireChangeGarageAccounts(stage, canActAccounts);
    const fieldsDisabled = !canEditGarage || saving || isComplete || assignmentPending;

    const { fieldMinHeightPx, gapClass } = TIRE_CHANGE_DETAIL_GRID_LAYOUT;
    const accent = tireAccent;

    useEffect(() => {
        setFormData(buildTireChangeGarageFormState(service, asset));
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
        if (!isTireChangeGarageFormComplete(formData)) {
            const errors = validateTireChangeGarageForm(formData);
            toast({
                variant: 'destructive',
                title: 'Complete garage details',
                description: Object.values(errors).join(', '),
            });
            return;
        }

        setSaving(true);
        try {
            const body = buildTireChangeGarageUpdateBody(formData);
            const { data } = await axiosInstance.put(
                `/AssetItem/${vehicleId}/service/${serviceId}/tire-change/garage`,
                body,
            );
            toast({
                title: 'Garage updated',
                description: 'Accounts was notified to review and approve garage details.',
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

    const handleAccountsApprove = async () => {
        if (!vehicleId || !canApproveAccounts) return;
        setSaving(true);
        try {
            const { data } = await axiosInstance.post(`/AssetItem/${vehicleId}/service-workflow/respond`, {
                action: 'approve',
                comment: 'Garage and service dates approved',
            });
            toast({
                title: 'Approved',
                description: data?.message || 'Admin Officer was notified to complete return details.',
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Approval failed',
                description: error.response?.data?.message || 'Could not approve garage details.',
            });
        } finally {
            setSaving(false);
        }
    };

    const subtitle =
        stage === TIRE_CHANGE_WORKFLOW_STAGES.ADMIN_OFFICER
            ? 'Admin Officer — update garage vendor and service window, then click Update Garage'
            : stage === TIRE_CHANGE_WORKFLOW_STAGES.ACCOUNTS
              ? canApproveAccounts
                  ? 'Accounts — review garage details below, then click Approve'
                  : 'Garage details submitted — awaiting Accounts approval'
              : isComplete
                ? 'Garage details approved and locked'
                : 'Garage vendor, location, and scheduled service window';

    return (
        <div className={`w-full ${className}`.trim()}>
            <FineFormCard
                title="Garage / Service Details"
                subtitle={subtitle}
                icon={Wrench}
                iconBg="bg-violet-50"
                iconColor="text-violet-600"
                className={`w-full ${fieldsDisabled && !canApproveAccounts ? 'opacity-[0.97]' : ''}`}
            >
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                    <VehicleTireChangeFormFieldCell
                        label="Garage Name"
                        accentClass={accent(0)}
                        minHeightPx={fieldMinHeightPx}
                    >
                        <ZohoVendorSelect
                            className="w-full"
                            value={formData.garageName || ''}
                            onChange={(nextValue) => set('garageName', nextValue)}
                            disabled={fieldsDisabled}
                            placeholder="Select vendor"
                            extraOptions={garageOptions}
                        />
                    </VehicleTireChangeFormFieldCell>
                    <VehicleTireChangeFormFieldCell
                        label="Garage Location"
                        accentClass={accent(1)}
                        minHeightPx={fieldMinHeightPx}
                    >
                        <input
                            className={tireFieldSelect}
                            type="text"
                            value={formData.garageLocation || ''}
                            onChange={(e) => set('garageLocation', e.target.value)}
                            disabled={fieldsDisabled}
                        />
                    </VehicleTireChangeFormFieldCell>
                    <VehicleTireChangeFormFieldCell
                        label="Garage Contact"
                        accentClass={accent(2)}
                        minHeightPx={fieldMinHeightPx}
                    >
                        <input
                            className={tireFieldSelect}
                            type="text"
                            value={formData.garageContact || ''}
                            onChange={(e) => set('garageContact', e.target.value)}
                            disabled={fieldsDisabled}
                        />
                    </VehicleTireChangeFormFieldCell>
                    <VehicleTireChangeFormFieldCell
                        label="Service Start Date"
                        accentClass={accent(0)}
                        minHeightPx={fieldMinHeightPx}
                    >
                        <DatePicker
                            value={formData.serviceStartDate || ''}
                            onChange={(value) => set('serviceStartDate', value || '')}
                            placeholder="dd/mm/yyyy"
                            className={tireDatePickerClass}
                            disabled={fieldsDisabled}
                        />
                    </VehicleTireChangeFormFieldCell>
                    <VehicleTireChangeFormFieldCell
                        label="Service End Date"
                        accentClass={accent(1)}
                        minHeightPx={fieldMinHeightPx}
                    >
                        <DatePicker
                            value={formData.serviceEndDate || ''}
                            onChange={(value) => set('serviceEndDate', value || '')}
                            placeholder="dd/mm/yyyy"
                            className={tireDatePickerClass}
                            disabled={fieldsDisabled}
                        />
                    </VehicleTireChangeFormFieldCell>
                </div>

                {canEditGarage ? (
                    <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleUpdate()}
                            className={tireBtnBlue}
                        >
                            {saving ? (
                                <span className="inline-flex items-center justify-center gap-2">
                                    <Loader2 size={14} className="animate-spin" />
                                    Updating...
                                </span>
                            ) : (
                                'Update Garage'
                            )}
                        </button>
                    </div>
                ) : null}

                {canApproveAccounts ? (
                    <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleAccountsApprove()}
                            className={tireBtnPrimary}
                        >
                            {saving ? (
                                <span className="inline-flex items-center justify-center gap-2">
                                    <Loader2 size={14} className="animate-spin" />
                                    Approving...
                                </span>
                            ) : (
                                'Approve'
                            )}
                        </button>
                    </div>
                ) : null}
            </FineFormCard>
        </div>
    );
}
