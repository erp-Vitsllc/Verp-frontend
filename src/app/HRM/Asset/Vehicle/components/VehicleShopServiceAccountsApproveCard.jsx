'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Wallet } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import VehicleServiceLockedSection from './VehicleServiceLockedSection';
import {
    SHOP_SERVICE_CARD,
    resolveShopServiceCardGate,
} from '../utils/vehicleShopServiceCardGates';

function formatAed(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function resolveApprovedQuoteKey(remark = {}) {
    const key = String(
        remark.approvedQuotationChoice ||
            remark.approvedQuoteKey ||
            remark.hrApprovedQuoteKey ||
            '',
    )
        .toLowerCase()
        .trim();
    if (key === 'q1' || key === 'quote1') return 'q1';
    if (key === 'q2' || key === 'quote2') return 'q2';
    if (key === 'q3' || key === 'quote3') return 'q3';
    return '';
}

function quoteLabelFromKey(key, remark = {}) {
    if (key === 'q1') return 'Quote 1';
    if (key === 'q2') return 'Quote 2';
    if (key === 'q3') return 'Quote 3';
    return remark.approvedQuoteLabel || '—';
}

function quoteLabelFromRemark(remark) {
    return quoteLabelFromKey(resolveApprovedQuoteKey(remark), remark);
}

function isAccountsApprovalDone(remark = {}, stage = '') {
    if (
        String(remark.accountsQuoteApprovedAt || '').trim() ||
        String(remark.accountsGarageApprovedAt || '').trim() ||
        String(remark.accountsApprovedAt || '').trim()
    ) {
        return true;
    }
    return ['pending_admin_return', 'pending_billing', 'billed', 'complete'].includes(stage);
}

/**
 * Oil-style Accounts Approve shell for shop services (Tire / Mechanical / Body).
 * Shows approved quote summary; Approve runs at pending_accounts (legacy garage Accounts step).
 */
export default function VehicleShopServiceAccountsApproveCard({
    asset,
    service,
    vehicleId,
    serviceId,
    canActAccounts = false,
    assignmentPending = false,
    workflowStage = '',
    serviceTypeLabel = 'Service',
    /** Live HR Approval draft — keeps Accounts totals in sync while HR edits. */
    liveHrReview = null,
    onUpdated,
    className = '',
}) {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);
    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const stage = String(workflowStage || '').toLowerCase();

    const gate = resolveShopServiceCardGate({
        assignmentPending,
        workflowStage: stage,
        service,
        cardKey: SHOP_SERVICE_CARD.ACCOUNTS,
    });

    const amount =
        Number(liveHrReview?.approvedAmount) ||
        Number(remark.hrReviewApprovedAmount) ||
        Number(remark.approvedAmount) ||
        Number(remark.estimatedCost) ||
        Number(service?.value) ||
        0;
    const companyPay =
        liveHrReview?.companyPay != null && liveHrReview?.companyPay !== ''
            ? Number(liveHrReview.companyPay) || 0
            : Number(remark.hrReviewCompanyPay ?? remark.companyPay ?? 0);
    const employeePay =
        liveHrReview?.employeePay != null && liveHrReview?.employeePay !== ''
            ? Number(liveHrReview.employeePay) || 0
            : Number(remark.hrReviewEmployeePay ?? remark.employeePay ?? 0);
    const approvedQuoteKey =
        (['q1', 'q2', 'q3'].includes(liveHrReview?.approvedQuoteKey)
            ? liveHrReview.approvedQuoteKey
            : '') || resolveApprovedQuoteKey(remark);
    const quoteLabel = quoteLabelFromKey(approvedQuoteKey, remark);
    const quoteUrl =
        remark.approvedQuoteUrl ||
        (approvedQuoteKey === 'q2'
            ? service?.quotation2
            : approvedQuoteKey === 'q3'
              ? service?.quotation3
              : service?.attachment) ||
        '';

    const canApprove = canActAccounts && stage === 'pending_accounts' && !busy;
    const accountsDone = isAccountsApprovalDone(remark, stage) || Boolean(gate.done);

    const handleApprove = async () => {
        if (!vehicleId || !canApprove) return;
        setBusy(true);
        try {
            const { data } = await axiosInstance.post(`/AssetItem/${vehicleId}/service-workflow/respond`, {
                action: 'approve',
                comment: `${serviceTypeLabel} — Accounts approved schedule / quotation`,
                ...(serviceId ? { serviceRecordId: serviceId } : {}),
            });
            toast({
                title: 'Approved',
                description: data?.message || 'Accounts approved.',
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Accounts approval blocked',
                description: error.response?.data?.message || 'Try again.',
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={`w-full ${className}`.trim()}>
            <VehicleServiceLockedSection locked={gate.locked} message={gate.message} className="h-full">
                <FineFormCard
                    title="Accounts Approve"
                    subtitle={
                        gate.locked
                            ? 'Locked until HR Approval is done'
                            : accountsDone
                              ? 'Quotation / schedule approved'
                              : canApprove
                                ? 'Review amount and quotation — then approve'
                                : 'Waiting for Accounts'
                    }
                    icon={Wallet}
                    iconBg="bg-sky-50"
                    iconColor="text-sky-700"
                    className="h-full w-full"
                >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Amount (AED)
                            </span>
                            <p className="mt-1 text-sm font-bold text-gray-900">
                                {amount > 0 ? formatAed(amount) : '—'}
                            </p>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Selected quotation
                            </span>
                            <p className="mt-1 text-sm font-bold text-gray-900">{quoteLabel}</p>
                            {quoteUrl ? (
                                <button
                                    type="button"
                                    onClick={() => void openAttachmentInNewTab(quoteUrl)}
                                    className="mt-1 inline-block text-xs font-semibold text-sky-700 hover:underline"
                                >
                                    View PDF
                                </button>
                            ) : null}
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Company Pay
                            </span>
                            <p className="mt-1 text-sm font-bold text-gray-900">
                                {companyPay > 0 ? `AED ${formatAed(companyPay)}` : '—'}
                            </p>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Employee Pay
                            </span>
                            <p className="mt-1 text-sm font-bold text-gray-900">
                                {employeePay > 0 ? `AED ${formatAed(employeePay)}` : '—'}
                            </p>
                        </div>
                    </div>

                    {accountsDone && stage !== 'pending_accounts' ? (
                        <p className="mt-4 text-sm font-semibold text-emerald-700">
                            Approved{amount > 0 ? ` with amount AED ${formatAed(amount)}` : ''}
                            {quoteLabel && quoteLabel !== '—' ? ` · ${quoteLabel}` : ''}
                        </p>
                    ) : canApprove ? (
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => void handleApprove()}
                                disabled={busy}
                                className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                {busy ? 'Working…' : 'Approve quotation'}
                            </button>
                        </div>
                    ) : stage === 'pending_hr' || gate.locked ? null : (
                        <p className="mt-3 text-xs text-amber-800">
                            Waiting for flowchart Accounts to approve.
                        </p>
                    )}
                </FineFormCard>
            </VehicleServiceLockedSection>
        </div>
    );
}
