'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { DatePicker } from '@/components/ui/date-picker';
import ZohoVendorSelect from '@/components/ZohoVendorSelect';
import VehicleOilServiceLockedSection from './VehicleOilServiceLockedSection';
import { buildGarageHistoryOptions } from '../utils/buildGarageHistoryOptions';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import {
    OIL_SERVICE_DETAIL_GRID_ACCENTS,
    OIL_SERVICE_DETAIL_GRID_LAYOUT,
} from '../utils/vehicleOilServiceDetailGrid';
import {
    isOilServiceAwaitingSchedule,
    isOilServiceAssignmentSubmitted,
    isOilServiceInitiated,
    OIL_SERVICE_CARD,
    resolveOilServiceCardGate,
} from '../utils/vehicleOilServiceAccess';
import {
    buildOilServiceDetailFormState,
    getOilServiceScheduleMissingFields,
    isOilServiceScheduleFormComplete,
} from '../utils/vehicleOilServiceDetailForm';
import {
    serviceEndDisabledDays,
    serviceStartDisabledDays,
} from '../utils/vehicleServiceScheduleDates';

const fieldInput =
    'w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed';
const datePickerClass = `${fieldInput} h-auto justify-start font-normal`;

function FormFieldCell({ label, children, accentClass, minHeightPx }) {
    return (
        <div
            className={`flex flex-col justify-center rounded-lg border px-3 py-2.5 ${accentClass}`}
            style={{ minHeight: `${minHeightPx}px` }}
        >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
            <div className="mt-1.5 min-w-0">{children}</div>
        </div>
    );
}

export default function VehicleOilServiceScheduleCard({
    asset,
    service,
    vehicleId,
    serviceId,
    canManage = false,
    onUpdated,
    className = '',
}) {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(() => buildOilServiceDetailFormState(service, asset));

    useEffect(() => {
        setFormData(buildOilServiceDetailFormState(service, asset));
    }, [service?._id, service?.updatedAt, service?.remark, asset]);

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const scheduleGate = useMemo(
        () => resolveOilServiceCardGate(service, asset, OIL_SERVICE_CARD.SCHEDULE),
        [service, asset],
    );
    const initiated = isOilServiceInitiated(remark);
    const submitted = isOilServiceAssignmentSubmitted(remark);
    const awaitingSchedule = isOilServiceAwaitingSchedule(remark);
    const stepLocked = scheduleGate.locked;
    // Admin Officer: edit anytime once unlocked, until service complete.
    const canEdit = Boolean(canManage) && initiated && !stepLocked;
    const fieldsDisabled = !canEdit || saving;

    const set = useCallback((key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }, []);

    const garageHistoryOptions = useMemo(
        () => buildGarageHistoryOptions(asset, service, formData.garageName),
        [asset, service, formData.garageName],
    );

    const missingFields = useMemo(
        () =>
            canManage && !isOilServiceScheduleFormComplete(formData)
                ? getOilServiceScheduleMissingFields(formData)
                : [],
        [formData, canManage],
    );
    const canSubmitSchedule =
        awaitingSchedule && canManage && !saving && isOilServiceScheduleFormComplete(formData);
    const canUpdateSchedule = submitted && canManage && !stepLocked && !saving;

    const handleSubmitSchedule = useCallback(async () => {
        if (!canSubmitSchedule || !vehicleId || !serviceId) return;
        setSaving(true);
        try {
            // Admin Schedule uses /oil-dates (same as shop garage APIs) — not the Initiate PUT
            // which is HR-only after Send until Zoho billed.
            await axiosInstance.put(`/AssetItem/${vehicleId}/service/${serviceId}/oil-dates`, {
                serviceStartDate: formData.serviceStartDate || '',
                serviceEndDate: formData.serviceEndDate || '',
                garageName: formData.garageName || '',
                garageLocation: formData.garageLocation || '',
                garageContact: formData.garageContact || '',
                zohoVendorId: formData.zohoVendorId || '',
                serviceIssue: formData.serviceIssue || '',
            });
            const { data } = await axiosInstance.post(
                `/AssetItem/${vehicleId}/service/${serviceId}/submit-request`,
            );
            toast({
                title: 'Service scheduled',
                description: 'Garage, dates, and description were submitted for this oil service.',
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset || asset);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not schedule service',
                description: error.response?.data?.message || 'Try again in a moment.',
            });
        } finally {
            setSaving(false);
        }
    }, [asset, canSubmitSchedule, formData, onUpdated, serviceId, toast, vehicleId]);

    const handleUpdateSchedule = useCallback(async () => {
        if (!canUpdateSchedule || !vehicleId || !serviceId) return;
        setSaving(true);
        try {
            const { data } = await axiosInstance.put(`/AssetItem/${vehicleId}/service/${serviceId}/oil-dates`, {
                serviceStartDate: formData.serviceStartDate || '',
                serviceEndDate: formData.serviceEndDate || '',
                garageName: formData.garageName || '',
                garageLocation: formData.garageLocation || '',
                garageContact: formData.garageContact || '',
                zohoVendorId: formData.zohoVendorId || '',
                serviceIssue: formData.serviceIssue || '',
            });
            toast({ title: 'Schedule updated', description: 'Garage and dates were saved.' });
            if (typeof onUpdated === 'function') onUpdated(data?.asset || asset);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not update schedule',
                description: error.response?.data?.message || 'Try again in a moment.',
            });
        } finally {
            setSaving(false);
        }
    }, [asset, canUpdateSchedule, formData, onUpdated, serviceId, toast, vehicleId]);

    const { fieldMinHeightPx, gapClass } = OIL_SERVICE_DETAIL_GRID_LAYOUT;
    const accent = (index) => OIL_SERVICE_DETAIL_GRID_ACCENTS[index % OIL_SERVICE_DETAIL_GRID_ACCENTS.length];

    const subtitle = stepLocked
        ? scheduleGate.done || submitted
          ? 'Locked — service is complete'
          : 'Available once Initiate Service is sent'
        : !canManage
          ? 'Waiting for Admin / Admin Officer to schedule / reschedule'
          : awaitingSchedule
            ? 'Garage and dates are required — description is optional'
            : 'Admin / Admin Officer can update garage or dates anytime until Complete Service';

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
                <FormFieldCell label="Garage Name (Vendor)" accentClass={accent(0)} minHeightPx={fieldMinHeightPx}>
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
                        extraOptions={garageHistoryOptions}
                    />
                </FormFieldCell>
                <FormFieldCell label="Garage Location" accentClass={accent(1)} minHeightPx={fieldMinHeightPx}>
                    <input
                        className={fieldInput}
                        type="text"
                        value={formData.garageLocation || ''}
                        onChange={(e) => set('garageLocation', e.target.value)}
                        disabled={fieldsDisabled}
                    />
                </FormFieldCell>
                <FormFieldCell label="Garage Contact" accentClass={accent(2)} minHeightPx={fieldMinHeightPx}>
                    <input
                        className={fieldInput}
                        type="text"
                        value={formData.garageContact || ''}
                        onChange={(e) => set('garageContact', e.target.value)}
                        disabled={fieldsDisabled}
                    />
                </FormFieldCell>

                <FormFieldCell
                    label="Service Start Date"
                    accentClass={accent(0)}
                    minHeightPx={fieldMinHeightPx}
                >
                    <DatePicker
                        value={formData.serviceStartDate || ''}
                        onChange={(value) => set('serviceStartDate', value || '')}
                        placeholder="dd/mm/yyyy"
                        className={datePickerClass}
                        disabled={fieldsDisabled}
                        disabledDays={serviceStartDisabledDays()}
                    />
                </FormFieldCell>
                <FormFieldCell
                    label="Service End Date"
                    accentClass={accent(1)}
                    minHeightPx={fieldMinHeightPx}
                >
                    <DatePicker
                        value={formData.serviceEndDate || ''}
                        onChange={(value) => {
                            set('serviceEndDate', value || '');
                            if (value) set('nextChangeMonth', value.slice(0, 7));
                        }}
                        placeholder="dd/mm/yyyy"
                        className={datePickerClass}
                        disabled={fieldsDisabled}
                        disabledDays={serviceEndDisabledDays(formData.serviceStartDate)}
                    />
                </FormFieldCell>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Description (optional)
                </span>
                <textarea
                    className={`${fieldInput} mt-1.5 min-h-[88px] resize-y font-medium`}
                    rows={3}
                    value={formData.serviceIssue || ''}
                    onChange={(e) => set('serviceIssue', e.target.value)}
                    disabled={fieldsDisabled}
                    placeholder="Enter work description"
                />
            </div>

            {awaitingSchedule ? (
                <div className="mt-4 border-t border-gray-100 pt-4">
                    {missingFields.length > 0 ? (
                        <p className="mb-3 text-xs text-amber-700">Still required: {missingFields.join(', ')}</p>
                    ) : null}
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={() => void handleSubmitSchedule()}
                            disabled={!canSubmitSchedule}
                            className="min-w-[140px] rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                            title={missingFields.length ? `Missing: ${missingFields.join(', ')}` : ''}
                        >
                            {saving ? 'Submitting...' : 'OK'}
                        </button>
                    </div>
                </div>
            ) : submitted && canManage ? (
                <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                    <button
                        type="button"
                        onClick={() => void handleUpdateSchedule()}
                        disabled={!canUpdateSchedule}
                        className="min-w-[140px] rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {saving ? 'Updating...' : 'Update'}
                    </button>
                </div>
            ) : null}
        </FineFormCard>
    );

    return (
        <div id="oil-service-schedule-panel" className={`w-full ${className}`.trim()}>
            <VehicleOilServiceLockedSection
                locked={stepLocked}
                message={scheduleGate.message || 'Complete Initiate Service and click Send first'}
            >
                {card}
            </VehicleOilServiceLockedSection>
        </div>
    );
}
