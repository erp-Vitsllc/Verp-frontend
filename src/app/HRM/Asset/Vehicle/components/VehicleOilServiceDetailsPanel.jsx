'use client';

import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import VehicleOilServiceDetailsForm from './VehicleOilServiceDetailsForm';
import { buildOilServiceHrServiceUpdates } from '../utils/vehicleOilServiceHrSubmit';
import {
    isOilServiceAssignmentPending,
    isOilServiceDetailsEnabled,
    isOilServiceScheduledWaiting,
} from '../utils/vehicleOilServiceAccess';
import { invalidateAssetPendingInbox } from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import {
    normalizeMongoId,
    parseVehicleServiceRemark,
    resolveAssetCurrentKilometer,
} from './vehicleServiceUtils';

function formatKmDisplay(value) {
    if (value == null || String(value).trim() === '') return '—';
    const n = Number(value);
    if (Number.isFinite(n)) return n.toLocaleString();
    return String(value).trim();
}

function resolveServiceCurrentKm(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const fromService =
        remark.currentKm != null && String(remark.currentKm).trim() !== ''
            ? remark.currentKm
            : service?.currentKm != null && String(service.currentKm).trim() !== ''
              ? service.currentKm
              : '';
    if (fromService !== '') return fromService;
    return resolveAssetCurrentKilometer(asset);
}

function CurrentKmHeaderBadge({ value }) {
    return (
        <div className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-1.5 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700/80">Current KM</p>
            <p className="text-sm font-bold tabular-nums text-teal-900">{formatKmDisplay(value)}</p>
        </div>
    );
}

function resolveWorkflow(asset, serviceId) {
    const activeWf = asset?.activeServiceWorkflow;
    const wfMatches = normalizeMongoId(activeWf?.serviceRecordId) === normalizeMongoId(serviceId);
    return wfMatches ? activeWf : asset?.activeServiceWorkflow || {};
}

function formatShortDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function VehicleOilServiceDetailsPanel({
    asset,
    service,
    vehicleId,
    serviceId,
    canManage = false,
    onUpdated,
}) {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const scheduledWaiting = useMemo(() => isOilServiceScheduledWaiting(service, asset), [service, asset]);
    const detailsEnabled = useMemo(() => isOilServiceDetailsEnabled(service, asset), [service, asset]);

    const wf = useMemo(() => resolveWorkflow(asset, serviceId), [asset, serviceId]);
    const stage = String(wf?.stage || '').trim().toLowerCase();
    const isComplete = stage === 'complete' || String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live';
    const isRejected = stage === 'rejected';

    const serviceStartDate =
        remark.serviceStartDate ||
        remark.scheduledServiceDate ||
        wf?.scheduledServiceDate ||
        null;

    if (assignmentPending) {
        return (
            <div id="oil-service-details-panel" className="w-full shrink-0">
                <FineFormCard
                    title="Service Details"
                    subtitle="Available after the assignment is sent"
                    icon={ClipboardList}
                    iconBg="bg-teal-50"
                    iconColor="text-teal-600"
                    className="w-full"
                >
                    <p className="text-sm text-gray-500">
                        Complete Oil Service Assignment Details and click Send to unlock this section.
                    </p>
                </FineFormCard>
            </div>
        );
    }

    if (scheduledWaiting) {
        return (
            <div id="oil-service-details-panel" className="w-full shrink-0">
                <FineFormCard
                    title="Service Details"
                    subtitle="Scheduled — waiting for service start date"
                    icon={ClipboardList}
                    iconBg="bg-violet-50"
                    iconColor="text-violet-600"
                    className="w-full opacity-95"
                >
                    <p className="text-sm text-gray-500">
                        This service is scheduled. Service Details will unlock automatically on{' '}
                        <span className="font-semibold text-gray-700">{formatShortDate(serviceStartDate)}</span>{' '}
                        when the vehicle moves to On Service. There is no separate next page — stay on this screen.
                    </p>
                </FineFormCard>
            </div>
        );
    }

    if (!detailsEnabled && !isComplete && !isRejected) {
        return (
            <div id="oil-service-details-panel" className="w-full shrink-0">
                <FineFormCard
                    title="Service Details"
                    subtitle="Not available yet"
                    icon={ClipboardList}
                    iconBg="bg-teal-50"
                    iconColor="text-teal-600"
                    className="w-full"
                >
                    <p className="text-sm text-gray-500">
                        Service Details will be available once the vehicle is on service.
                    </p>
                </FineFormCard>
            </div>
        );
    }

    const locked = isComplete || isRejected;
    const canAct = !locked && canManage && detailsEnabled;
    const currentKm = resolveServiceCurrentKm(service, asset);

    const handleSave = async (formPayload) => {
        if (!vehicleId || !canAct) return;
        setSaving(true);
        try {
            const serviceUpdates = buildOilServiceHrServiceUpdates(service, formPayload);
            await axiosInstance.post(`/AssetItem/${vehicleId}/service/${serviceId}/oil-details/save`, {
                serviceUpdates,
            });
            toast({ title: 'Draft saved', description: 'Service details saved.' });
            if (typeof onUpdated === 'function') onUpdated();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not save',
                description: error.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (formPayload) => {
        if (!vehicleId || !canAct) return;
        setSubmitting(true);
        try {
            const serviceUpdates = buildOilServiceHrServiceUpdates(service, formPayload);
            const { data } = await axiosInstance.post(
                `/AssetItem/${vehicleId}/service/${serviceId}/oil-details/submit`,
                { serviceUpdates },
            );
            const routedTo = data?.routedTo || data?.asset?.activeServiceWorkflow?.stage;
            toast({
                title:
                    routedTo === 'pending_hr'
                        ? 'Sent to HR'
                        : 'Service completed',
                description:
                    data?.message ||
                    (routedTo === 'pending_hr'
                        ? 'Cash payment sent to HR for approval, then Accounts will create the Zoho bill.'
                        : 'Vehicle status restored. Stakeholders notified.'),
            });
            invalidateAssetPendingInbox('vehicle');
            if (typeof onUpdated === 'function') onUpdated(data?.asset);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not submit service details',
                description: error.response?.data?.message || 'Try again in a moment.',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div id="oil-service-details-panel" className={`w-full shrink-0 ${locked ? 'opacity-95' : ''}`}>
            <FineFormCard
                title="Service Details"
                subtitle={
                    isComplete
                        ? 'Service record completed'
                        : isRejected
                          ? 'This request was rejected'
                          : 'Complete return details — Save draft or Send to close this service'
                }
                icon={ClipboardList}
                iconBg="bg-teal-50"
                iconColor="text-teal-600"
                className="w-full"
                headerAction={<CurrentKmHeaderBadge value={currentKm} />}
            >
                <VehicleOilServiceDetailsForm
                    service={service}
                    workflow={wf}
                    saving={saving}
                    submitting={submitting}
                    locked={locked}
                    canAct={canAct}
                    onSave={handleSave}
                    onSubmit={handleSubmit}
                />
            </FineFormCard>
        </div>
    );
}
