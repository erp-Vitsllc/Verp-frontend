'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';

/**
 * Accident Repair: after Garage, flowchart HR must approve before On Service.
 */
export default function VehicleAccidentRepairHrOnServiceCard({
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
    const remark = parseVehicleServiceRemark(service) || {};

    if (stage !== 'pending_hr') return null;

    const start =
        remark.serviceStartDate ||
        remark.scheduledServiceDate ||
        '';
    const end = remark.serviceEndDate || '';

    const handleApprove = async () => {
        if (!vehicleId || !canActHr || busy) return;
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
                    data?.message ||
                    'On Service will start on the service start date.',
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
        <FineFormCard
            title="HR — Approve On Service"
            icon={ShieldCheck}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-700"
            className={className}
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

            {canActHr ? (
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
            ) : (
                <p className="mt-3 text-xs text-amber-800">
                    Waiting for flowchart HR to approve On Service.
                </p>
            )}
        </FineFormCard>
    );
}
