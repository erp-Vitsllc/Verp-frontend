'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Wallet } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { normalizeMongoId, parseVehicleServiceRemark } from './vehicleServiceUtils';
import VehicleServiceLockedSection from './VehicleServiceLockedSection';
import { SegmentedToggle } from './VehicleServicePaymentTypeMethodFields';
import {
    SHOP_SERVICE_CARD,
    resolveShopServiceCardGate,
} from '../utils/vehicleShopServiceCardGates';
import {
    OIL_PAYMENT_METHOD_OPTIONS,
    OIL_PAYMENT_TYPE_OPTIONS,
    isOilPayablePaymentMode,
    normalizeOilPaymentMethod,
    normalizeOilPaymentType,
    oilPaymentMethodLabel,
    oilPaymentTypeLabel,
    resolveOilPaymentFields,
} from '../utils/vehicleOilServiceDetailForm';

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

function paymentByModeLabel(mode) {
    const m = String(mode || '').toLowerCase().trim();
    if (m === 'person') return 'EMP';
    if (m === 'split') return 'EMP & CMPY';
    if (m === 'company') return 'CMPY';
    return '';
}

function PaymentByModeDisplay({ mode }) {
    const active = String(mode || '').toLowerCase().trim();
    return (
        <div className="inline-flex w-full rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {[
                { id: 'person', label: 'EMP' },
                { id: 'company', label: 'CMPY' },
                { id: 'split', label: 'EMP & CMPY' },
            ].map((opt) => (
                <span
                    key={opt.id}
                    className={`flex-1 rounded-md px-1 py-1.5 text-center text-[10px] font-bold ${
                        active === opt.id
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-400'
                    }`}
                >
                    {opt.label}
                </span>
            ))}
        </div>
    );
}

/**
 * Oil-style Accounts Approve shell for shop services (Tire / Mechanical / Body / Accident).
 * Shows approved quote summary; Approve runs at pending_accounts (legacy garage Accounts step).
 * Accounts may edit Payment Type / Payment Method before approving.
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
    const [employees, setEmployees] = useState([]);
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
            : Number(remark.hrReviewCompanyPay ?? remark.companyPayAmount ?? remark.companyPay ?? 0);
    const employeePay =
        liveHrReview?.employeePay != null && liveHrReview?.employeePay !== ''
            ? Number(liveHrReview.employeePay) || 0
            : Number(remark.hrReviewEmployeePay ?? remark.employeePayAmount ?? remark.employeePay ?? 0);
    const paymentByMode = String(
        liveHrReview?.paymentByMode || remark.paymentByMode || '',
    )
        .toLowerCase()
        .trim();
    const showCompanyPay = !paymentByMode || paymentByMode !== 'person';
    const showEmployeePay = paymentByMode === 'person' || paymentByMode === 'split';
    const employeeRows = useMemo(() => {
        if (Array.isArray(liveHrReview?.employeeRows) && liveHrReview.employeeRows.length) {
            return liveHrReview.employeeRows;
        }
        if (Array.isArray(remark.hrReviewEmployeeRows) && remark.hrReviewEmployeeRows.length) {
            return remark.hrReviewEmployeeRows;
        }
        if (Array.isArray(remark.employeeLiabilityRows) && remark.employeeLiabilityRows.length) {
            return remark.employeeLiabilityRows;
        }
        return [];
    }, [liveHrReview?.employeeRows, remark.hrReviewEmployeeRows, remark.employeeLiabilityRows]);

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

    const resolvedPayment = useMemo(() => resolveOilPaymentFields(remark), [remark]);
    const [accountsAmountMode, setAccountsAmountMode] = useState(
        () => resolvedPayment.amountMode || 'amount',
    );
    const [accountsPaymentMethod, setAccountsPaymentMethod] = useState(
        () => resolvedPayment.paymentMethod || 'cash',
    );
    const [accountsDescription, setAccountsDescription] = useState(() =>
        String(remark.accountsReviewDescription || '').trim(),
    );

    useEffect(() => {
        const next = resolveOilPaymentFields(remark);
        setAccountsAmountMode(next.amountMode || 'amount');
        setAccountsPaymentMethod(next.paymentMethod || 'cash');
        setAccountsDescription(String(remark.accountsReviewDescription || '').trim());
    }, [service?._id, service?.updatedAt, service?.remark, remark]);

    useEffect(() => {
        let active = true;
        axiosInstance
            .get('/employee')
            .then(({ data }) => {
                if (!active) return;
                const list = Array.isArray(data) ? data : data?.employees || [];
                setEmployees(list);
            })
            .catch(() => {
                if (active) setEmployees([]);
            });
        return () => {
            active = false;
        };
    }, []);

    const employeeNameById = useMemo(() => {
        const map = {};
        (employees || []).forEach((emp) => {
            const id = normalizeMongoId(emp?._id || emp?.id);
            const label =
                `${emp.firstName || ''} ${emp.lastName || ''}`.trim() ||
                String(emp.employeeId || '').trim() ||
                'Employee';
            if (id) map[id] = label;
            const code = String(emp.employeeId || '').trim();
            if (code) map[code] = label;
        });
        return map;
    }, [employees]);

    const resolveEmployeeName = (employeeId) => {
        const id = normalizeMongoId(employeeId) || String(employeeId || '').trim();
        if (!id) return 'Employee';
        return employeeNameById[id] || `Employee`;
    };

    const accountsDone = isAccountsApprovalDone(remark, stage) || Boolean(gate.done);
    const canApprove = canActAccounts && stage === 'pending_accounts' && !busy && !accountsDone;
    const accountsCashMode = isOilPayablePaymentMode(
        accountsDone ? remark.amountMode || accountsAmountMode : accountsAmountMode,
    );
    const paymentTypeLabel = oilPaymentTypeLabel(
        accountsDone ? remark.amountMode || accountsAmountMode : accountsAmountMode,
    );
    const paymentMethodLabel = accountsCashMode
        ? oilPaymentMethodLabel(
              accountsDone
                  ? remark.paymentMethod || accountsPaymentMethod
                  : accountsPaymentMethod,
          )
        : '—';
    const totalPay = companyPay + employeePay > 0 ? companyPay + employeePay : amount;

    const handleApprove = async () => {
        if (!vehicleId || !canApprove) return;

        const amountMode = normalizeOilPaymentType(accountsAmountMode) || 'amount';
        const paymentMethod =
            amountMode === 'warranty'
                ? ''
                : normalizeOilPaymentMethod(accountsPaymentMethod) || 'cash';

        if (amountMode !== 'warranty' && !paymentMethod) {
            toast({
                variant: 'destructive',
                title: 'Payment method required',
                description: 'Select Cash, Acc Pay, or Bank Transfer before approving.',
            });
            return;
        }

        setBusy(true);
        try {
            const description = String(accountsDescription || '').trim();
            const { data } = await axiosInstance.post(`/AssetItem/${vehicleId}/service-workflow/respond`, {
                action: 'approve',
                comment:
                    description ||
                    `${serviceTypeLabel} — Accounts approved schedule / quotation`,
                ...(serviceId ? { serviceRecordId: serviceId } : {}),
                serviceUpdates: {
                    remark: JSON.stringify({
                        amountMode,
                        ...(amountMode === 'warranty'
                            ? { paymentMethod: '' }
                            : { paymentMethod }),
                        ...(description ? { accountsReviewDescription: description } : {}),
                    }),
                },
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
                                ? 'Review amount, payment method, and quotation — then approve'
                                : 'Waiting for Accounts (opens after HR Approval)'
                    }
                    icon={Wallet}
                    iconBg="bg-sky-50"
                    iconColor="text-sky-700"
                    className="h-full w-full"
                >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Payment By
                            </span>
                            <div className="mt-2">
                                {paymentByModeLabel(paymentByMode) ? (
                                    <PaymentByModeDisplay mode={paymentByMode} />
                                ) : (
                                    <p className="text-sm font-bold text-gray-900">—</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {(showCompanyPay || showEmployeePay || totalPay > 0) ? (
                        <div className="mt-3 w-full rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                            {showCompanyPay ? (
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-bold uppercase tracking-wide text-gray-500">
                                        Company payment
                                    </span>
                                    <span className="text-xl font-bold tabular-nums text-gray-900">
                                        {companyPay.toLocaleString()}{' '}
                                        <span className="text-sm font-bold text-gray-500">AED</span>
                                    </span>
                                </div>
                            ) : null}
                            {showEmployeePay ? (
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-bold uppercase tracking-wide text-gray-500">
                                            Employee payment
                                        </span>
                                        <span className="text-xl font-bold tabular-nums text-gray-900">
                                            {employeePay.toLocaleString()}{' '}
                                            <span className="text-sm font-bold text-gray-500">AED</span>
                                        </span>
                                    </div>
                                    {(employeeRows || []).map((row, index) => {
                                        const paid = Number(row?.paidAmount) || 0;
                                        if (!String(row?.employeeId || '').trim() && !(paid > 0)) {
                                            return null;
                                        }
                                        return (
                                            <div
                                                key={`accounts-emp-${index}`}
                                                className="flex items-center justify-between gap-3"
                                            >
                                                <span className="text-sm font-semibold text-gray-800">
                                                    {resolveEmployeeName(row.employeeId)}
                                                </span>
                                                <span className="text-base font-semibold tabular-nums text-gray-900">
                                                    AED {paid.toLocaleString()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}
                            <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                                <span className="text-sm font-bold uppercase tracking-wide text-gray-500">
                                    Total amount
                                </span>
                                <span className="text-2xl font-bold tabular-nums text-gray-900">
                                    {totalPay.toLocaleString()}{' '}
                                    <span className="text-sm font-bold text-gray-500">AED</span>
                                </span>
                            </div>
                        </div>
                    ) : null}

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Payment type
                            </span>
                            {canApprove ? (
                                <div className="mt-2">
                                    <SegmentedToggle
                                        options={OIL_PAYMENT_TYPE_OPTIONS}
                                        value={normalizeOilPaymentType(accountsAmountMode)}
                                        selectedFallback="amount"
                                        onChange={(mode) => {
                                            setAccountsAmountMode(mode);
                                            if (mode === 'warranty') {
                                                setAccountsPaymentMethod('');
                                            } else if (
                                                !normalizeOilPaymentMethod(accountsPaymentMethod)
                                            ) {
                                                setAccountsPaymentMethod('cash');
                                            }
                                        }}
                                        disabled={busy}
                                    />
                                </div>
                            ) : (
                                <p className="mt-1 text-sm font-bold text-gray-900">
                                    {paymentTypeLabel}
                                </p>
                            )}
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Payment method
                            </span>
                            {canApprove ? (
                                <div className="mt-2">
                                    {isOilPayablePaymentMode(accountsAmountMode) ? (
                                        <SegmentedToggle
                                            options={OIL_PAYMENT_METHOD_OPTIONS}
                                            value={normalizeOilPaymentMethod(accountsPaymentMethod)}
                                            selectedFallback="cash"
                                            onChange={setAccountsPaymentMethod}
                                            disabled={busy}
                                        />
                                    ) : (
                                        <p className="mt-1 text-sm font-bold text-gray-500">—</p>
                                    )}
                                </div>
                            ) : (
                                <p className="mt-1 text-sm font-bold text-gray-900">
                                    {paymentMethodLabel}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mt-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Description (optional)
                        </span>
                        {canApprove ? (
                            <textarea
                                className="mt-1.5 w-full min-h-[88px] resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-50 disabled:text-gray-600"
                                rows={3}
                                value={accountsDescription}
                                onChange={(e) => setAccountsDescription(e.target.value)}
                                disabled={busy}
                                placeholder="Enter review notes..."
                            />
                        ) : String(remark.accountsReviewDescription || accountsDescription || '').trim() ? (
                            <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                                {String(remark.accountsReviewDescription || accountsDescription).trim()}
                            </p>
                        ) : (
                            <p className="mt-1.5 text-sm text-gray-400">—</p>
                        )}
                    </div>

                    {accountsDone && stage !== 'pending_accounts' ? (
                        <p className="mt-4 text-sm font-semibold text-emerald-700">
                            Approved{amount > 0 ? ` with amount AED ${formatAed(amount)}` : ''}
                            {quoteLabel && quoteLabel !== '—' ? ` · ${quoteLabel}` : ''}
                            {paymentTypeLabel ? ` · ${paymentTypeLabel}` : ''}
                            {paymentMethodLabel && paymentMethodLabel !== '—'
                                ? ` · ${paymentMethodLabel}`
                                : ''}
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
