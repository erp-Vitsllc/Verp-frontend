'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, Loader2, Plus, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import ZohoVendorSelect from '@/components/ZohoVendorSelect';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import VehicleGarageZohoBillRetry from './VehicleGarageZohoBillRetry';
import ZohoPayAccountSelect from './ZohoPayAccountSelect';
import VehicleOilServiceLockedSection from './VehicleOilServiceLockedSection';
import {
    OIL_SERVICE_CARD,
    resolveOilServiceCardGate,
} from '../utils/vehicleOilServiceAccess';
import {
    oilPaymentMethodLabel,
    oilPaymentTypeLabel,
} from '../utils/vehicleOilServiceDetailForm';
import { oilQuoteKeyToLabel } from '../utils/vehicleOilServiceQuoteDrag';
import { ERP_PDF_ACCEPT, validateErpPdfFile } from '@/utils/uploadFileTypes';

function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function formatAed(value) {
    return money(value).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function buildOilQuoteRows(service, remark) {
    const rows = [];
    const add = (key, urlVal, name, amount) => {
        if (urlVal || name) {
            rows.push({
                key,
                label: oilQuoteKeyToLabel(key),
                name: name || '',
                amount,
                url: urlVal || '',
            });
        }
    };
    add(
        'q1',
        service?.attachment,
        remark?.attachmentName,
        remark?.quotationAmounts?.q1 ?? remark?.quotation1Amount ?? service?.value,
    );
    add('q2', service?.quotation2, remark?.quotation2Name, remark?.quotationAmounts?.q2 ?? remark?.quotation2Amount);
    add('q3', service?.quotation3, remark?.quotation3Name, remark?.quotationAmounts?.q3 ?? remark?.quotation3Amount);
    return rows;
}

function buildInitialBillingState(service) {
    const remark = parseVehicleServiceRemark(service) || {};
    const existingLines = Array.isArray(remark.billingPayables) ? remark.billingPayables : null;
    const seedAmount =
        money(remark.garageBillAmount) ||
        money(remark.totalServiceCharge) ||
        money(service?.value) ||
        0;
    const lines =
        existingLines && existingLines.length
            ? existingLines.map((row) => ({
                  payableTo: String(row.payableTo || row.payAccountName || '').trim(),
                  payAccountId: String(row.payAccountId || '').trim(),
                  amount: row.amount != null && row.amount !== '' ? String(row.amount) : '',
              }))
            : [
                  {
                      payableTo: String(
                          remark.payAccountName || remark.garagePayAccountName || '',
                      ).trim(),
                      payAccountId: String(
                          remark.payAccountId || remark.garagePayAccountId || '',
                      ).trim(),
                      amount: seedAmount > 0 ? String(seedAmount) : '',
                  },
              ];

    const existingGarageAttachmentUrl = String(
        remark.garageAttachmentUrl ||
            remark.garageBillAttachmentUrl ||
            service?.shopInvoice ||
            remark.garageInvoiceUrl ||
            '',
    ).trim();
    const existingGarageAttachmentName = String(
        remark.garageAttachmentName ||
            remark.garageInvoiceName ||
            remark.shopInvoiceName ||
            '',
    ).trim();

    return {
        garageName: String(remark.garageName || remark.vendorName || '').trim(),
        zohoVendorId: String(remark.zohoVendorId || '').trim(),
        garageBillAmount: seedAmount > 0 ? String(seedAmount) : '',
        payAccountId: String(remark.payAccountId || remark.garagePayAccountId || '').trim(),
        payAccountName: String(remark.payAccountName || remark.garagePayAccountName || '').trim(),
        garageAttachment: null,
        existingGarageAttachmentUrl,
        existingGarageAttachmentName:
            existingGarageAttachmentName ||
            (existingGarageAttachmentUrl ? 'Garage invoice (from Complete Service)' : ''),
        billingPayables: lines,
    };
}

/**
 * Cash oil — sequential unlock: Schedule → HR → Accounts → … → Make Payment.
 * mode="approvals": HR Approval | Accounts Approve (Accounts opens only after HR).
 * mode="payment": Make Payment (Zoho), unlocks after Complete Service.
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
    mode = 'approvals',
}) {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);
    const stage = String(workflowStage || '').toLowerCase();
    const remark = parseVehicleServiceRemark(service) || {};

    const hrGate = useMemo(
        () => resolveOilServiceCardGate(service, asset, OIL_SERVICE_CARD.HR),
        [service, asset],
    );
    const accountsGate = useMemo(
        () => resolveOilServiceCardGate(service, asset, OIL_SERVICE_CARD.ACCOUNTS),
        [service, asset],
    );
    const paymentGate = useMemo(
        () => resolveOilServiceCardGate(service, asset, OIL_SERVICE_CARD.PAYMENT),
        [service, asset],
    );

    const hrLocked = hrGate.locked;
    const hrLockMessage = hrGate.message;
    const hrActiveStage = Boolean(hrGate.active);
    const hrDone = Boolean(hrGate.done);
    const canActOnHr = hrActiveStage && canActHr && !busy;

    const accountsQuoteApproved = Boolean(accountsGate.done);
    const accountsLocked = accountsGate.locked;
    const accountsLockMessage = accountsGate.message;
    const canActOnAccountsQuote = Boolean(accountsGate.active) && canActAccounts && !busy;

    const paymentLocked = paymentGate.locked;
    const paymentLockMessage = paymentGate.message;
    const canActOnPayment = Boolean(paymentGate.active) && canActAccounts && !busy;

    const [hrQuoteChoice, setHrQuoteChoice] = useState(() =>
        String(remark.approvedQuotationChoice || '').trim(),
    );
    const [hrDescription, setHrDescription] = useState(() =>
        String(remark.hrReviewDescription || remark.quoteReviewDescription || '').trim(),
    );

    useEffect(() => {
        setHrQuoteChoice(String(remark.approvedQuotationChoice || '').trim());
        setHrDescription(
            String(remark.hrReviewDescription || remark.quoteReviewDescription || '').trim(),
        );
    }, [
        remark.approvedQuotationChoice,
        remark.hrReviewDescription,
        remark.quoteReviewDescription,
        service?._id,
        service?.updatedAt,
    ]);

    const quoteRows = useMemo(() => buildOilQuoteRows(service, remark), [service, remark]);
    const selectedQuoteRow = useMemo(
        () => quoteRows.find((row) => row.key === hrQuoteChoice) || null,
        [quoteRows, hrQuoteChoice],
    );
    const selectedQuoteAmount = money(selectedQuoteRow?.amount);
    const quoteAmount =
        selectedQuoteAmount ||
        money(remark.garageBillAmount) ||
        money(remark.amount) ||
        money(remark.value) ||
        money(service?.value);
    const paymentTypeLabel = oilPaymentTypeLabel(remark.amountMode);
    const paymentMethodLabel =
        String(remark.amountMode || '').toLowerCase() === 'warranty'
            ? '—'
            : oilPaymentMethodLabel(remark.paymentMethod || remark.amountMode);
    const quoteLabel =
        selectedQuoteRow?.label ||
        (hrQuoteChoice ? oilQuoteKeyToLabel(hrQuoteChoice) : '') ||
        (remark.approvedQuotationChoice ? oilQuoteKeyToLabel(remark.approvedQuotationChoice) : '');

    const handleApproveHr = async () => {
        if (!vehicleId || !canActOnHr) return;
        if (quoteRows.length > 0 && !hrQuoteChoice) {
            toast({
                variant: 'destructive',
                title: 'Select a quotation',
                description: 'Choose one quote to continue. The other quotes will not go forward.',
            });
            return;
        }
        setBusy(true);
        try {
            const description = String(hrDescription || '').trim();
            const amountNum = selectedQuoteAmount > 0 ? selectedQuoteAmount : null;
            const nextRemark = {
                ...remark,
                approvedQuotationChoice: hrQuoteChoice || '',
                ...(amountNum != null
                    ? {
                          amount: amountNum,
                          garageBillAmount: amountNum,
                          value: amountNum,
                      }
                    : {}),
                ...(description
                    ? {
                          hrReviewDescription: description,
                          quoteReviewDescription: description,
                      }
                    : {}),
            };
            const serviceUpdates = {
                remark: JSON.stringify(nextRemark),
                ...(amountNum != null ? { value: amountNum } : {}),
            };
            const { data } = await axiosInstance.post(`/AssetItem/${vehicleId}/service-workflow/respond`, {
                action: 'approve',
                comment: description ||
                    (selectedQuoteRow
                        ? `HR approved ${selectedQuoteRow.label} — ready for Accounts`
                        : 'HR approved oil service schedule — ready for Accounts'),
                ...(serviceId ? { serviceRecordId: serviceId } : {}),
                serviceUpdates,
            });
            toast({
                title: 'Approved',
                description: selectedQuoteRow
                    ? `${selectedQuoteRow.label} selected. Other quotes will not continue.`
                    : data?.message || 'Schedule approved — Accounts can review next.',
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset || null);
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

    const handleApproveAccountsQuote = async () => {
        if (!vehicleId || !serviceId || !canActOnAccountsQuote) return;
        setBusy(true);
        try {
            const { data } = await axiosInstance.put(
                `/AssetItem/${vehicleId}/service/${serviceId}/oil-accounts-quote-approve`,
            );
            toast({
                title: 'Quotation approved',
                description: data?.message || 'Accounts approved the quotation.',
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset || null);
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Approval failed',
                description: err.response?.data?.message || 'Could not approve the quotation.',
            });
        } finally {
            setBusy(false);
        }
    };

    // ---- Make Payment (Zoho billing) ----
    const [billing, setBilling] = useState(() => buildInitialBillingState(service));
    const garageInvoiceInputRef = useRef(null);

    useEffect(() => {
        setBilling(buildInitialBillingState(service));
    }, [service?._id, service?.updatedAt, service?.remark, service?.shopInvoice, service?.value]);

    const totalFromLines = useMemo(
        () => (billing.billingPayables || []).reduce((sum, row) => sum + money(row.amount), 0),
        [billing.billingPayables],
    );

    const fieldsDisabled = !canActOnPayment;

    const setLine = (index, patch) => {
        setBilling((prev) => {
            const next = [...(prev.billingPayables || [])];
            next[index] = { ...next[index], ...patch };
            const updated = { ...prev, billingPayables: next };
            if (index === 0 && (patch.payAccountId !== undefined || patch.payableTo !== undefined)) {
                updated.payAccountId =
                    patch.payAccountId !== undefined ? patch.payAccountId : next[0]?.payAccountId || '';
                updated.payAccountName =
                    patch.payableTo !== undefined ? patch.payableTo : next[0]?.payableTo || '';
            }
            return updated;
        });
    };

    const addLine = () => {
        setBilling((prev) => ({
            ...prev,
            billingPayables: [
                ...(prev.billingPayables || []),
                { payableTo: '', payAccountId: '', amount: '' },
            ],
        }));
    };

    const removeLine = (index) => {
        setBilling((prev) => {
            const next = [...(prev.billingPayables || [])];
            if (next.length <= 1) return prev;
            next.splice(index, 1);
            return { ...prev, billingPayables: next };
        });
    };

    const handleGarageInvoice = async (file) => {
        if (!file) return;
        const check = validateErpPdfFile(file);
        if (!check.ok) {
            toast({ variant: 'destructive', title: 'Invalid file', description: check.message });
            return;
        }
        const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        setBilling((prev) => ({
            ...prev,
            garageAttachment: { name: file.name, data, mime: file.type || 'application/pdf' },
            existingGarageAttachmentName: file.name,
        }));
    };

    const garageInvoiceViewUrl = String(
        billing.garageAttachment?.data || billing.existingGarageAttachmentUrl || '',
    ).trim();
    const hasGarageInvoice = Boolean(garageInvoiceViewUrl);

    const buildServiceUpdates = () => {
        const lines = (billing.billingPayables || [])
            .map((row) => ({
                payableTo: String(row.payableTo || '').trim(),
                payAccountId: String(row.payAccountId || '').trim(),
                amount: money(row.amount),
            }))
            .filter((row) => row.payableTo || row.payAccountId || row.amount > 0);

        const total = lines.reduce((s, r) => s + r.amount, 0) || money(billing.garageBillAmount);
        const primary = lines[0] || {};
        const nextRemark = {
            ...remark,
            garageName: String(billing.garageName || '').trim() || remark.garageName,
            vendorName: String(billing.garageName || '').trim() || remark.vendorName,
            zohoVendorId: String(billing.zohoVendorId || '').trim() || remark.zohoVendorId,
            billingPayables: lines,
            billingTotalAmount: total,
            garageBillAmount: total,
            totalServiceCharge: total,
            payAccountId: primary.payAccountId || billing.payAccountId || remark.payAccountId,
            payAccountName: primary.payableTo || billing.payAccountName || remark.payAccountName,
            garagePayAccountId: primary.payAccountId || billing.payAccountId || remark.garagePayAccountId,
            garagePayAccountName: primary.payableTo || billing.payAccountName || remark.garagePayAccountName,
        };

        const existingUrl = String(
            billing.existingGarageAttachmentUrl ||
                service?.shopInvoice ||
                remark.garageAttachmentUrl ||
                remark.garageBillAttachmentUrl ||
                '',
        ).trim();
        if (existingUrl && !billing.garageAttachment?.data) {
            nextRemark.garageAttachmentUrl = existingUrl;
            nextRemark.garageBillAttachmentUrl = existingUrl;
            nextRemark.garageAttachmentName =
                String(
                    billing.existingGarageAttachmentName ||
                        remark.garageAttachmentName ||
                        remark.garageInvoiceName ||
                        remark.shopInvoiceName ||
                        '',
                ).trim() || 'garage-invoice.pdf';
        }

        const body = { remark: JSON.stringify(nextRemark) };
        if (billing.garageAttachment?.data) {
            body.garageBillAttachment = billing.garageAttachment;
        }
        if (Number.isFinite(total) && total > 0) {
            body.value = total;
        }
        return body;
    };

    const handleSubmitPayment = async () => {
        if (!vehicleId || !canActOnPayment || busy) return;
        setBusy(true);
        try {
            const serviceUpdates = buildServiceUpdates();
            const parsedRemark = JSON.parse(serviceUpdates.remark || '{}');
            const total = money(parsedRemark.billingTotalAmount);
            const payableLines = (
                Array.isArray(parsedRemark.billingPayables) ? parsedRemark.billingPayables : []
            ).filter((row) => String(row.payAccountId || '').trim() && money(row.amount) > 0);
            if (!(total > 0) || !payableLines.length) {
                toast({
                    variant: 'destructive',
                    title: 'Payable from required',
                    description:
                        'Add at least one Chart of Accounts line with amount before submitting to Zoho.',
                });
                setBusy(false);
                return;
            }
            if (payableLines.length !== (parsedRemark.billingPayables || []).length) {
                toast({
                    variant: 'destructive',
                    title: 'Incomplete payable lines',
                    description: 'Every payable-from line needs a Chart of Accounts and amount.',
                });
                setBusy(false);
                return;
            }

            const { data } = await axiosInstance.post(`/AssetItem/${vehicleId}/service-workflow/respond`, {
                action: 'approve',
                comment: 'Accounts submitted billing — create Zoho bill (Billed)',
                serviceUpdates,
                ...(serviceId ? { serviceRecordId: serviceId } : {}),
            });
            toast({
                title: 'Approved',
                description: data?.message || 'Zoho bill created — Billed.',
            });
            if (typeof onUpdated === 'function') {
                onUpdated(data?.asset || null);
            }
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Accounts approval blocked',
                description:
                    err.response?.data?.message || 'Zoho bill must succeed before status becomes Billed.',
            });
        } finally {
            setBusy(false);
        }
    };

    if (mode === 'payment') {
        return (
            <div className={`w-full ${className}`.trim()}>
                <VehicleOilServiceLockedSection locked={paymentLocked} message={paymentLockMessage}>
                    <FineFormCard
                        title="Make Payment"
                        subtitle={
                            paymentLocked
                                ? 'Visible preview — unlocks after Complete Service for cash billing'
                                : 'Submit billing — Zoho bill create sets status to Billed'
                        }
                        icon={Wallet}
                        iconBg="bg-sky-50"
                        iconColor="text-sky-700"
                        className="w-full"
                    >
                        <VehicleGarageZohoBillRetry
                            vehicleId={vehicleId}
                            serviceId={serviceId}
                            service={service}
                            serviceTypeLabel="Oil Service"
                            onUpdated={onUpdated}
                        />

                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Service work is <span className="font-semibold text-gray-800">complete</span>. Edit
                                billing below and submit — status becomes{' '}
                                <span className="font-semibold text-gray-800">Billed</span> only if Zoho bill create
                                succeeds.
                            </p>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className="block text-xs font-semibold text-gray-500">
                                    Garage vendor
                                    <div className="mt-1">
                                        <ZohoVendorSelect
                                            className="w-full"
                                            value={billing.garageName || ''}
                                            onChange={(nextValue, vendor) => {
                                                setBilling((prev) => ({
                                                    ...prev,
                                                    garageName: nextValue,
                                                    zohoVendorId: String(
                                                        vendor?.id || vendor?.zohoContactId || vendor?.value || '',
                                                    ).trim(),
                                                }));
                                            }}
                                            disabled={fieldsDisabled}
                                            placeholder="Select vendor"
                                        />
                                    </div>
                                </label>
                                <div className="block text-xs font-semibold text-gray-500">
                                    Garage invoice (PDF)
                                    <input
                                        ref={garageInvoiceInputRef}
                                        type="file"
                                        accept={ERP_PDF_ACCEPT}
                                        className="sr-only"
                                        disabled={fieldsDisabled}
                                        onChange={(e) => {
                                            void handleGarageInvoice(e.target.files?.[0]);
                                            e.target.value = '';
                                        }}
                                    />
                                    {hasGarageInvoice ? (
                                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                            <a
                                                href={garageInvoiceViewUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100"
                                            >
                                                <Eye size={14} />
                                                View
                                            </a>
                                            {!fieldsDisabled ? (
                                                <button
                                                    type="button"
                                                    onClick={() => garageInvoiceInputRef.current?.click()}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                                                >
                                                    Change
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={fieldsDisabled}
                                                onClick={() => garageInvoiceInputRef.current?.click()}
                                                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                Upload PDF
                                            </button>
                                            <span className="text-[11px] font-medium text-amber-700">
                                                No invoice yet — upload here or in Complete Service
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-white p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Payable from
                                    </span>
                                    {canActOnPayment ? (
                                        <button
                                            type="button"
                                            onClick={addLine}
                                            disabled={busy}
                                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700"
                                        >
                                            <Plus size={12} /> Add line
                                        </button>
                                    ) : null}
                                </div>
                                <div className="space-y-2">
                                    {(billing.billingPayables || []).map((row, index) => (
                                        <div
                                            key={`payable-${index}`}
                                            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_36px] items-start"
                                        >
                                            <ZohoPayAccountSelect
                                                value={row.payAccountId || ''}
                                                name={row.payableTo || ''}
                                                disabled={fieldsDisabled}
                                                placeholder="Select Chart of Accounts"
                                                onChange={({ id, name }) => {
                                                    setLine(index, {
                                                        payAccountId: id,
                                                        payableTo: name,
                                                    });
                                                }}
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="min-h-[44px] rounded-lg border border-gray-200 px-2.5 text-sm font-semibold"
                                                placeholder="Amount"
                                                value={row.amount || ''}
                                                disabled={fieldsDisabled}
                                                onChange={(e) => setLine(index, { amount: e.target.value })}
                                            />
                                            {canActOnPayment ? (
                                                <button
                                                    type="button"
                                                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-40"
                                                    disabled={busy || (billing.billingPayables || []).length <= 1}
                                                    onClick={() => removeLine(index)}
                                                    title="Remove line"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            ) : (
                                                <span />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
                                    <span className="font-semibold text-gray-500">Total amount</span>
                                    <span className="font-bold text-gray-900">AED {formatAed(totalFromLines)}</span>
                                </div>
                            </div>
                        </div>

                        {canActOnPayment ? (
                            <div className="mt-4 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => void handleSubmitPayment()}
                                    disabled={busy}
                                    className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    {busy ? 'Working…' : 'Submit to Zoho (Billed)'}
                                </button>
                            </div>
                        ) : stage === 'pending_accounts' ? (
                            <p className="mt-3 text-xs text-amber-800">
                                Waiting for flowchart Accounts to submit billing to Zoho.
                            </p>
                        ) : null}
                    </FineFormCard>
                </VehicleOilServiceLockedSection>
            </div>
        );
    }

    return (
        <div className={`w-full ${className}`.trim()}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <VehicleOilServiceLockedSection locked={hrLocked} message={hrLockMessage} className="h-full">
                    <FineFormCard
                        title="HR Approval"
                        subtitle={
                            hrLocked
                                ? 'Locked until Schedule and Reschedule is submitted'
                                : hrActiveStage
                                  ? 'Select one quotation, then approve'
                                  : hrDone
                                    ? 'HR approved this schedule'
                                    : 'Waiting for HR'
                        }
                        icon={ShieldCheck}
                        iconBg="bg-emerald-50"
                        iconColor="text-emerald-700"
                        className="h-full w-full"
                    >
                        <p className="text-sm text-gray-600">
                            Select one quote from Initiate. Only that quote continues to Accounts and later steps;
                            the other quotes are not used.
                        </p>

                        <div className="mt-4 space-y-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Quotations
                            </span>
                            {quoteRows.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                                    No quotations uploaded on Initiate yet.
                                </p>
                            ) : (
                                <div className="space-y-2" role="radiogroup" aria-label="Select quotation">
                                    {quoteRows.map((row) => {
                                        const selected = hrQuoteChoice === row.key;
                                        const amountLabel =
                                            row.amount != null &&
                                            row.amount !== '' &&
                                            Number.isFinite(Number(row.amount))
                                                ? `AED ${Number(row.amount).toLocaleString()}`
                                                : null;
                                        return (
                                            <button
                                                key={row.key}
                                                type="button"
                                                role="radio"
                                                aria-checked={selected}
                                                disabled={!canActOnHr && !hrDone}
                                                onClick={() => {
                                                    if (!canActOnHr) return;
                                                    setHrQuoteChoice(row.key);
                                                }}
                                                className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                                                    selected
                                                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200'
                                                        : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40'
                                                } ${!canActOnHr ? 'cursor-default opacity-90' : 'cursor-pointer'}`}
                                            >
                                                <span
                                                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                                        selected
                                                            ? 'border-emerald-600 bg-emerald-600'
                                                            : 'border-gray-300 bg-white'
                                                    }`}
                                                    aria-hidden
                                                >
                                                    {selected ? (
                                                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                                    ) : null}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                        <span className="text-sm font-bold text-gray-900">
                                                            {row.label}
                                                        </span>
                                                        {amountLabel ? (
                                                            <span className="text-xs font-semibold text-emerald-700">
                                                                {amountLabel}
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    {row.name ? (
                                                        <span className="mt-0.5 block truncate text-xs text-gray-500">
                                                            {row.name}
                                                        </span>
                                                    ) : null}
                                                </span>
                                                {row.url ? (
                                                    <a
                                                        href={row.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="shrink-0 text-xs font-semibold text-sky-700 hover:underline"
                                                    >
                                                        View
                                                    </a>
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {hrDone && quoteLabel ? (
                                <p className="text-xs font-semibold text-emerald-700">
                                    Approved with {quoteLabel}
                                    {selectedQuoteAmount > 0
                                        ? ` · AED ${formatAed(selectedQuoteAmount)}`
                                        : ''}
                                    . Other quotes were not selected.
                                </p>
                            ) : null}
                        </div>

                        <div className="mt-4">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Description (optional)
                            </span>
                            <textarea
                                className="mt-1.5 w-full min-h-[88px] resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-50 disabled:text-gray-600"
                                value={hrDescription}
                                onChange={(e) => setHrDescription(e.target.value)}
                                disabled={!canActOnHr}
                                placeholder="Enter review notes..."
                                rows={3}
                            />
                        </div>

                        {canActOnHr ? (
                            <div className="mt-4 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => void handleApproveHr()}
                                    disabled={busy || (quoteRows.length > 0 && !hrQuoteChoice)}
                                    className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {busy ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <CheckCircle2 size={16} />
                                    )}
                                    {busy ? 'Working…' : 'Approve schedule'}
                                </button>
                            </div>
                        ) : hrActiveStage ? (
                            <p className="mt-3 text-xs text-amber-800">
                                Waiting for flowchart HR to approve the schedule.
                            </p>
                        ) : hrDone ? (
                            <p className="mt-3 text-xs text-emerald-700">HR approved — schedule is confirmed.</p>
                        ) : null}
                    </FineFormCard>
                </VehicleOilServiceLockedSection>

                <VehicleOilServiceLockedSection locked={accountsLocked} message={accountsLockMessage} className="h-full">
                    <FineFormCard
                        title="Accounts Approve"
                        subtitle={
                            accountsLocked
                                ? 'Locked until HR Approval is done'
                                : accountsQuoteApproved
                                  ? 'Quotation approved'
                                  : 'Review the amount and quotation, then approve'
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
                                    {quoteAmount > 0 ? formatAed(quoteAmount) : '—'}
                                </p>
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Selected quotation
                                </span>
                                <p className="mt-1 text-sm font-bold text-gray-900">{quoteLabel || '—'}</p>
                                {selectedQuoteRow?.name ? (
                                    <p className="mt-0.5 truncate text-xs text-gray-500">{selectedQuoteRow.name}</p>
                                ) : null}
                                {selectedQuoteRow?.url ? (
                                    <a
                                        href={selectedQuoteRow.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-1 inline-block text-xs font-semibold text-sky-700 hover:underline"
                                    >
                                        View PDF
                                    </a>
                                ) : null}
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Payment type
                                </span>
                                <p className="mt-1 text-sm font-bold text-gray-900">{paymentTypeLabel}</p>
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Payment method
                                </span>
                                <p className="mt-1 text-sm font-bold text-gray-900">{paymentMethodLabel}</p>
                            </div>
                        </div>

                        {accountsQuoteApproved ? (
                            <p className="mt-4 text-sm font-semibold text-emerald-700">
                                Approved with amount AED {formatAed(quoteAmount)}
                                {quoteLabel ? ` · ${quoteLabel}` : ''}
                            </p>
                        ) : canActOnAccountsQuote ? (
                            <div className="mt-4 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => void handleApproveAccountsQuote()}
                                    disabled={busy}
                                    className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {busy ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <CheckCircle2 size={16} />
                                    )}
                                    {busy ? 'Working…' : 'Approve quotation'}
                                </button>
                            </div>
                        ) : hrActiveStage ? (
                            <p className="mt-3 text-xs text-amber-800">
                                Waiting for flowchart Accounts to approve the quotation.
                            </p>
                        ) : null}
                    </FineFormCard>
                </VehicleOilServiceLockedSection>
            </div>
        </div>
    );
}
