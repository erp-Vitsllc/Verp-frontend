'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import VehicleServiceLockedSection from './VehicleServiceLockedSection';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import { isAccidentRepairGarageSubmitted } from '../utils/vehicleAccidentRepairWorkflow';

/**
 * Accident Repair: after Garage, flowchart HR must approve before On Service.
 * Always visible (Oil-style shell) — locked until garage is submitted / pending_hr.
 */
export default function VehicleAccidentRepairHrOnServiceCard({
    asset,
    vehicleId,
    serviceId,
    service,
    canActHr = false,
    workflowStage = '',
    onUpdated,
    className = '',
}) {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);
    const stage = String(workflowStage || '').toLowerCase();
    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const garageDone = isAccidentRepairGarageSubmitted(asset, service);

    const hrDone =
        Boolean(String(remark.hrOnServiceApprovedAt || remark.hrApprovedAt || '').trim()) ||
        [
            'scheduled_service',
            'pending_accounts',
            'pending_admin_return',
            'pending_billing',
            'billed',
            'complete',
        ].includes(stage);

    const locked = assignmentPending || (!garageDone && stage !== 'pending_hr');
    const lockMessage = assignmentPending
        ? 'Complete Initiate Service and click Send first'
        : 'Complete Schedule and Reschedule Service first';

    const canApprove = canActHr && stage === 'pending_hr' && !busy;

    const start = remark.serviceStartDate || remark.scheduledServiceDate || '';
    const end = remark.serviceEndDate || '';

    const handleApprove = async () => {
        if (!vehicleId || !canApprove) return;
        setBusy(true);
        try {
            const { data } = await axiosInstance.post(
                `/AssetItem/${vehicleId}/service-workflow/respond`,
                {
                    action: 'approve',
                    comment: 'HR approved accident repair — ready for On Service',
                    ...(serviceId ? { serviceRecordId: serviceId } : {}),
                },
            );
            toast({
                title: 'Approved',
                description:
                    data?.message || 'On Service will start on the service start date.',
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset || null);
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Approval failed',
                description:
                    err.response?.data?.message ||
                    'Could not approve On Service. Check flowchart HR and signature.',
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={`w-full ${className}`.trim()}>
            <VehicleServiceLockedSection locked={locked} message={lockMessage} className="h-full">
                <FineFormCard
                    title="HR Approval"
                    subtitle={
                        locked
                            ? 'Locked until Schedule is submitted'
                            : hrDone
                              ? 'HR approved On Service'
                              : canApprove
                                ? 'Approve to move this vehicle to On Service'
                                : 'Waiting for flowchart HR'
                    }
                    icon={ShieldCheck}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-700"
                    className="h-full w-full"
                >
                    <p className="text-sm text-gray-600">
                        Garage details are submitted. Approve to move this vehicle to{' '}
                        <span className="font-semibold text-gray-800">On Service</span>
                        {start ? (
                            <>
                                {' '}
                                (start {String(start).slice(0, 10)}
                                {end ? ` · end ${String(end).slice(0, 10)}` : ''})
                            </>
                        ) : null}
                        .
                    </p>

                    {hrDone && stage !== 'pending_hr' ? (
                        <p className="mt-4 text-sm font-semibold text-emerald-700">Approved</p>
                    ) : canApprove ? (
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => void handleApprove()}
                                disabled={busy}
                                className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {busy ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <CheckCircle2 size={16} />
                                )}
                                {busy ? 'Working…' : 'Approve On Service'}
                            </button>
                        </div>
                    ) : !locked ? (
                        <p className="mt-3 text-xs text-amber-800">
                            Waiting for flowchart HR to approve On Service.
                        </p>
                    ) : null}
                </FineFormCard>
            </VehicleServiceLockedSection>
        </div>
    );
}
