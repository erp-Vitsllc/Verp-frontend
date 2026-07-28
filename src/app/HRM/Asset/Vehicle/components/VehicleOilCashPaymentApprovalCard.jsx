'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, Wallet } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import VehicleGarageZohoBillRetry from './VehicleGarageZohoBillRetry';

/**
 * Cash oil service: after End Service → HR approval → Accounts payment (Zoho bill).
 */
export default function VehicleOilCashPaymentApprovalCard({
    asset,
    service,
    vehicleId,
    serviceId,
    canActHr = false,
    canActAccounts = false,
    workflowStage = '',
    onUpdated,
    className = '',
}) {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);
    const stage = String(workflowStage || '').toLowerCase();
    const remark = parseVehicleServiceRemark(service) || {};
    const isCash = String(remark.amountMode || '').toLowerCase() !== 'warranty';
    const amount =
        Number(remark.totalServiceCharge ?? remark.quotation1Amount ?? service?.value) || 0;
    const payAccount =
        remark.payAccountName ||
        remark.garagePayAccountName ||
        remark.payAccountId ||
        remark.garagePayAccountId ||
        '—';

    if (!isCash) return null;
    if (stage !== 'pending_hr' && stage !== 'pending_accounts') return null;

    const isHr = stage === 'pending_hr';
    const canAct = isHr ? canActHr : canActAccounts;

    const handleApprove = async () => {
        if (!vehicleId || !canAct || busy) return;
        setBusy(true);
        try {
            const { data } = await axiosInstance.post(`/AssetItem/${vehicleId}/service-workflow/respond`, {
                action: 'approve',
                comment: isHr
                    ? 'HR approved Cash oil service payment'
                    : 'Accounts approved Cash oil service — create Zoho bill',
            });
            toast({
                title: 'Approved',
                description: data?.message || (isHr ? 'Sent to Accounts.' : 'Payment complete.'),
            });
            if (typeof onUpdated === 'function') {
                onUpdated(data?.asset || null);
            }
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Approval failed',
                description: err.response?.data?.message || 'Could not approve this step.',
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <FineFormCard
            title={isHr ? 'HR — Cash payment approval' : 'Accounts — Cash payment (Zoho bill)'}
            icon={isHr ? ShieldCheck : Wallet}
            iconBg={isHr ? 'bg-emerald-50' : 'bg-sky-50'}
            iconColor={isHr ? 'text-emerald-700' : 'text-sky-700'}
            className={className}
            headerAction={
                canAct ? (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleApprove()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 size={14} />}
                        Approve
                    </button>
                ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {isHr ? 'Awaiting HR' : 'Awaiting Accounts'}
                    </span>
                )
            }
        >
            <p className="text-sm text-slate-700 mb-3">
                {isHr
                    ? canAct
                        ? 'Review the Cash oil service charge, then Approve to send to Accounts. Accounts will create the Zoho bill.'
                        : 'Waiting for flowchart HR to approve this Cash payment before Accounts.'
                    : canAct
                      ? 'Approve to store this service as a Zoho bill (Vendor = Garage, Pay Account, Amount).'
                      : 'Waiting for Accounts to approve payment and create the Zoho bill.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Amount</p>
                    <p className="font-semibold text-slate-800">
                        {Number.isFinite(amount) ? `AED ${amount.toLocaleString()}` : '—'}
                    </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pay Account</p>
                    <p className="font-semibold text-slate-800 break-words">{String(payAccount)}</p>
                </div>
            </div>
            {stage === 'pending_accounts' ? (
                <div className="mt-3">
                    <VehicleGarageZohoBillRetry
                        vehicleId={vehicleId}
                        serviceId={serviceId}
                        service={service}
                        onUpdated={onUpdated}
                    />
                </div>
            ) : null}
        </FineFormCard>
    );
}
