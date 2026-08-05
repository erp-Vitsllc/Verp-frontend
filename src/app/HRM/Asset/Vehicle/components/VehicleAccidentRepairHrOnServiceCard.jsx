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
 * Accident Repair: Schedule + HR open together after Initiate (oil/body style).
 * HR may approve before or after garage; garage still required before Accounts.
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

    const hrStamp = Boolean(String(remark.hrOnServiceApprovedAt || remark.hrApprovedAt || '').trim());
    const hrDone =
        hrStamp ||
        [
            'pending_accounts',
            'scheduled_service',
            'pending_admin_return',
            'pending_billing',
            'billed',
            'complete',
        ].includes(stage) ||
        (stage === 'pending_admin_officer' && hrStamp);

    // Oil-style: unlock with Schedule right after Initiate (not after garage).
    const locked = assignmentPending;
    const lockMessage = 'Complete Initiate Service first — Schedule and HR open together';

    const canApprove =
        canActHr &&
        !busy &&
        !hrDone &&
        (stage === 'pending_hr' || (stage === 'pending_admin_officer' && !hrStamp));

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
                    comment: garageDone
                        ? 'HR approved accident repair — sent to Accounts Approve'
                        : 'HR approved accident repair — Schedule/garage still open',
                    ...(serviceId ? { serviceRecordId: serviceId } : {}),
                },
            );
            toast({
                title: 'Approved',
                description:
                    data?.message ||
                    (garageDone
                        ? 'Sent to Accounts Approve.'
                        : 'HR approved. Admin can still complete Schedule.'),
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset || null);
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Approval failed',
                description:
                    err.response?.data?.message ||
                    'Could not approve. Check flowchart HR and signature.',
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
                            ? 'Locked until Initiate Service is sent'
                            : hrDone
                              ? 'HR approved'
                              : canApprove
                                ? garageDone
                                    ? 'Garage submitted — approve to send to Accounts'
                                    : 'Opens with Schedule after Initiate — approve once (Schedule can finish in parallel)'
                                : 'Waiting for flowchart HR'
                    }
                    icon={ShieldCheck}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-700"
                    className="h-full w-full"
                >
                    <p className="text-sm text-gray-600">
                        {garageDone ? (
                            <>
                                Garage details are submitted
                                {start ? (
                                    <>
                                        {' '}
                                        (start {String(start).slice(0, 10)}
                                        {end ? ` · end ${String(end).slice(0, 10)}` : ''})
                                    </>
                                ) : null}
                                . Approve to move this service to{' '}
                                <span className="font-semibold text-gray-800">Accounts Approve</span>.
                            </>
                        ) : (
                            <>
                                Schedule and HR open together after Initiate. You can approve now;
                                Admin Officer can finish garage / dates in parallel.
                            </>
                        )}
                    </p>

                    {hrDone ? (
                        <p className="mt-4 text-sm font-semibold text-emerald-700">Approved</p>
                    ) : canApprove ? (
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleApprove()}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                Approve
                            </button>
                        </div>
                    ) : !locked ? (
                        <p className="mt-4 text-sm text-gray-500">Waiting for flowchart HR to approve.</p>
                    ) : null}
                </FineFormCard>
            </VehicleServiceLockedSection>
        </div>
    );
}
