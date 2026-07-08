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
    canApproveBodyWorkGarageAccounts,
    canEditBodyWorkGarage,
    BODY_WORK_WORKFLOW_STAGES,
} from '../utils/vehicleBodyWorkWorkflow';
import VehicleBodyWorkFormFieldCell from './VehicleBodyWorkFormFieldCell';
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
    tireAccent,
    tireBtnBlue,
    tireBtnPrimary,
    tireDatePickerClass,
    tireFieldSelect,
} from '../utils/vehicleBodyWorkDetailUi';

export default function VehicleBodyWorkGarageCard({
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
    const [formData, setFormData] = useState(() => buildBodyWorkGarageFormState(service, asset));

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const stage = String(workflowStage || '').toLowerCase();
    const isComplete = stage === BODY_WORK_WORKFLOW_STAGES.COMPLETE;

    const canEditGarage = canEditBodyWorkGarage(stage, canManage, { asset, service });
    const canApproveAccounts = canApproveBodyWorkGarageAccounts(stage, canActAccounts);
    const fieldsDisabled = !canEditGarage || saving || isComplete || assignmentPending;

    const { fieldMinHeightPx, gapClass } = BODY_WORK_DETAIL_GRID_LAYOUT;
    const accent = tireAccent;

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
        stage === BODY_WORK_WORKFLOW_STAGES.ADMIN_OFFICER
            ? 'Admin Officer — update garage vendor and service window, then click Update Garage'
            : stage === BODY_WORK_WORKFLOW_STAGES.ACCOUNTS
              ? canEditGarage
                  ? 'Admin Officer — complete garage details below, then click Update Garage'
                  : canApproveAccounts
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
                    <VehicleBodyWorkFormFieldCell
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
                    </VehicleBodyWorkFormFieldCell>
                    <VehicleBodyWorkFormFieldCell
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
                    </VehicleBodyWorkFormFieldCell>
                    <VehicleBodyWorkFormFieldCell
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
                    </VehicleBodyWorkFormFieldCell>
                    <VehicleBodyWorkFormFieldCell
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
                    </VehicleBodyWorkFormFieldCell>
                    <VehicleBodyWorkFormFieldCell
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
                    </VehicleBodyWorkFormFieldCell>
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
