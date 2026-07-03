'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Upload, Wrench } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { DatePicker } from '@/components/ui/date-picker';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { parseVehicleServiceRemark, normalizeMongoId } from './vehicleServiceUtils';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import {
    canApproveAccidentRepairGarageAccounts,
    canEditAccidentRepairGarage,
    ACCIDENT_REPAIR_WORKFLOW_STAGES,
} from '../utils/vehicleAccidentRepairWorkflow';
import VehicleAccidentRepairFormFieldCell from './VehicleAccidentRepairFormFieldCell';
import {
    buildAccidentRepairGarageFormState,
    buildAccidentRepairGarageUpdateBody,
    isAccidentRepairGarageFormComplete,
    ACCIDENT_REPAIR_GARAGE_VENDOR_OPTIONS,
    validateAccidentRepairGarageForm,
} from '../utils/vehicleAccidentRepairGarageForm';
import {
    ACCIDENT_REPAIR_DETAIL_GRID_LAYOUT,
    tireBtnPrimary,
    tireDatePickerClass,
    tireFieldSelect,
    tireUploadBtn,
    tireViewBtn,
} from '../utils/vehicleAccidentRepairDetailUi';

const PDF_MIME_TYPES = ['application/pdf'];

function buildGarageOptions(asset, service, currentName) {
    const set = new Set(ACCIDENT_REPAIR_GARAGE_VENDOR_OPTIONS);
    const add = (value) => {
        const trimmed = String(value || '').trim();
        if (trimmed) set.add(trimmed);
    };

    add(currentName);
    const remark = parseVehicleServiceRemark(service) || {};
    add(remark.garageName);
    add(remark.vendorName);

    if (Array.isArray(asset?.services)) {
        asset.services.forEach((row) => {
            const rowRemark = parseVehicleServiceRemark(row) || {};
            add(rowRemark.garageName);
            add(rowRemark.vendorName);
        });
    }

    return Array.from(set);
}

export default function VehicleAccidentRepairGarageCard({
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
    const [formData, setFormData] = useState(() => buildAccidentRepairGarageFormState(service, asset));

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const stage = String(workflowStage || '').toLowerCase();
    const isComplete = stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.COMPLETE;

    const canEditGarage = canEditAccidentRepairGarage(stage, canManage, { asset, service });
    const canApproveAccounts = canApproveAccidentRepairGarageAccounts(stage, canActAccounts);
    const garageFormComplete = isAccidentRepairGarageFormComplete(formData);
    const fieldsDisabled = !canEditGarage || saving || isComplete || assignmentPending;

    const { fieldMinHeightPx, gapClass } = ACCIDENT_REPAIR_DETAIL_GRID_LAYOUT;

    useEffect(() => {
        setFormData(buildAccidentRepairGarageFormState(service, asset));
    }, [service?._id, service?.updatedAt, service?.remark, asset]);

    const garageOptions = useMemo(
        () => buildGarageOptions(asset, service, formData.garageName),
        [asset, service, formData.garageName],
    );

    const set = useCallback((key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleClaimUpload = useCallback(
        (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!PDF_MIME_TYPES.includes(file.type)) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid file type',
                    description: 'Claim acknowledge must be a PDF.',
                });
                if (e.target) e.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = String(reader.result || '').split(',')[1] || '';
                setFormData((prev) => ({
                    ...prev,
                    quotation2Name: file.name,
                    quotation2Base64: base64,
                    quotation2Mime: file.type || 'application/pdf',
                    existingQuotation2Url: '',
                }));
            };
            reader.readAsDataURL(file);
        },
        [toast],
    );

    const handleUpdate = async () => {
        if (!vehicleId || !serviceId || !canEditGarage) return;
        if (!isAccidentRepairGarageFormComplete(formData)) {
            const errors = validateAccidentRepairGarageForm(formData);
            toast({
                variant: 'destructive',
                title: 'Complete garage details',
                description: Object.values(errors).join(', '),
            });
            return;
        }

        setSaving(true);
        try {
            const body = buildAccidentRepairGarageUpdateBody(formData);
            const { data } = await axiosInstance.put(
                `/AssetItem/${vehicleId}/service/${serviceId}/accident-repair/garage`,
                body,
            );
            toast({
                title: 'Garage details saved',
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
        stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.HR
            ? 'Garage details — completed by Admin Officer after assignment is submitted'
            : stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.ADMIN_OFFICER
              ? 'Admin Officer — complete garage vendor and service window, then click Done'
              : stage === ACCIDENT_REPAIR_WORKFLOW_STAGES.ACCOUNTS
              ? canEditGarage
                  ? 'Admin Officer — complete garage details below, then click Done'
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
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                className={`w-full ${fieldsDisabled && !canApproveAccounts ? 'opacity-[0.97]' : ''}`}
            >
                <div className={`grid grid-cols-1 sm:grid-cols-3 ${gapClass} mb-2.5`}>
                        <VehicleAccidentRepairFormFieldCell
                            label="Claim Acknowledge"
                            accentClass="border-gray-200 bg-white"
                            minHeightPx={fieldMinHeightPx}
                        >
                            <div className="flex flex-wrap items-center gap-2 min-h-[40px]">
                                {formData.existingQuotation2Url ? (
                                    <button
                                        type="button"
                                        className={tireViewBtn}
                                        onClick={() =>
                                            void openAttachmentInNewTab(formData.existingQuotation2Url, {
                                                name: formData.quotation2Name || 'Claim Acknowledge',
                                            })
                                        }
                                    >
                                        View
                                    </button>
                                ) : null}
                                {!fieldsDisabled ? (
                                    <label className={tireUploadBtn}>
                                        <Upload size={14} />
                                        {formData.quotation2Name || formData.existingQuotation2Url
                                            ? 'Change'
                                            : 'Upload'}
                                        <input
                                            type="file"
                                            className="sr-only"
                                            accept=".pdf,application/pdf"
                                            disabled={fieldsDisabled}
                                            onChange={(e) => {
                                                handleClaimUpload(e);
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>
                                ) : null}
                                {formData.quotation2Name ? (
                                    <span className="text-[10px] text-gray-500 truncate">
                                        {formData.quotation2Name}
                                    </span>
                                ) : null}
                            </div>
                        </VehicleAccidentRepairFormFieldCell>
                        <VehicleAccidentRepairFormFieldCell
                            label="Garage Location"
                            accentClass="border-gray-200 bg-white"
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                className={tireFieldSelect}
                                type="text"
                                value={formData.garageLocation || ''}
                                onChange={(e) => set('garageLocation', e.target.value)}
                                disabled={fieldsDisabled}
                            />
                        </VehicleAccidentRepairFormFieldCell>
                        <VehicleAccidentRepairFormFieldCell
                            label="Garage Contact"
                            accentClass="border-gray-200 bg-white"
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                className={tireFieldSelect}
                                type="text"
                                value={formData.garageContact || ''}
                                onChange={(e) => set('garageContact', e.target.value)}
                                disabled={fieldsDisabled}
                            />
                        </VehicleAccidentRepairFormFieldCell>
                    </div>

                    <div className={`grid grid-cols-1 sm:grid-cols-3 ${gapClass}`}>
                        <VehicleAccidentRepairFormFieldCell
                            label="Garage Name"
                            accentClass="border-gray-200 bg-white"
                            minHeightPx={fieldMinHeightPx}
                        >
                            <select
                                className={tireFieldSelect}
                                value={formData.garageName || ''}
                                onChange={(e) => set('garageName', e.target.value)}
                                disabled={fieldsDisabled}
                            >
                                <option value="">Select vendor</option>
                                {formData.garageName && !garageOptions.includes(formData.garageName) ? (
                                    <option value={formData.garageName}>{formData.garageName}</option>
                                ) : null}
                                {garageOptions.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </VehicleAccidentRepairFormFieldCell>
                        <VehicleAccidentRepairFormFieldCell
                            label="Service Start Date"
                            accentClass="border-gray-200 bg-white"
                            minHeightPx={fieldMinHeightPx}
                        >
                            <DatePicker
                                value={formData.serviceStartDate || ''}
                                onChange={(value) => set('serviceStartDate', value || '')}
                                placeholder="dd/mm/yyyy"
                                className={tireDatePickerClass}
                                disabled={fieldsDisabled}
                            />
                        </VehicleAccidentRepairFormFieldCell>
                        <VehicleAccidentRepairFormFieldCell
                            label="Service End Date"
                            accentClass="border-gray-200 bg-white"
                            minHeightPx={fieldMinHeightPx}
                        >
                            <DatePicker
                                value={formData.serviceEndDate || ''}
                                onChange={(value) => set('serviceEndDate', value || '')}
                                placeholder="dd/mm/yyyy"
                                className={tireDatePickerClass}
                                disabled={fieldsDisabled}
                            />
                        </VehicleAccidentRepairFormFieldCell>
                    </div>

                {canEditGarage ? (
                    <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                        <button
                            type="button"
                            disabled={saving || !garageFormComplete}
                            onClick={() => void handleUpdate()}
                            className={tireBtnPrimary}
                        >
                            {saving ? (
                                <span className="inline-flex items-center justify-center gap-2">
                                    <Loader2 size={14} className="animate-spin" />
                                    Saving…
                                </span>
                            ) : (
                                'Done'
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
