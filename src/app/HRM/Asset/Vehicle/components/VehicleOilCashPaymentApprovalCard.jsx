'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, Loader2, Plus, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import ZohoVendorSelect from '@/components/ZohoVendorSelect';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import VehicleGarageZohoBillRetry from './VehicleGarageZohoBillRetry';
import ZohoPayAccountSelect from './ZohoPayAccountSelect';
import VehicleOilServiceLockedSection from './VehicleOilServiceLockedSection';
import {
    OIL_SERVICE_CARD,
    resolveOilServiceCardGate,
} from '../utils/vehicleOilServiceAccess';
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
import { oilQuoteKeyToLabel } from '../utils/vehicleOilServiceQuoteDrag';
import { ERP_PDF_ACCEPT, validateErpPdfFile } from '@/utils/uploadFileTypes';

function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function formatAed(value) {
    return money(value).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function SegmentedToggle({ options, value, onChange, disabled, selectedFallback }) {
    const selected = value || selectedFallback;
    return (
        <div className="inline-flex w-full flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {options.map((opt) => (
                <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(opt.id)}
                    className={`min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-[11px] font-bold transition-all sm:text-xs ${
                        selected === opt.id
                            ? 'bg-white text-sky-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                    } disabled:opacity-60`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
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
    const mapLine = (row, fallbackAmount = '') => ({
        description: String(row?.description || row?.item || row?.name || '').trim(),
        payableTo: String(row?.payableTo || row?.payAccountName || '').trim(),
        payAccountId: String(row?.payAccountId || row?.accountId || '').trim(),
        qty:
            row?.qty != null && row?.qty !== ''
                ? String(row.qty)
                : row?.quantity != null && row?.quantity !== ''
                  ? String(row.quantity)
                  : '1',
        amount: row?.amount != null && row?.amount !== '' ? String(row.amount) : fallbackAmount,
    });
    const lines =
        existingLines && existingLines.length
            ? existingLines.map((row) => mapLine(row))
            : [
                  mapLine(
                      {
                          payableTo: String(
                              remark.payAccountName || remark.garagePayAccountName || '',
                          ).trim(),
                          payAccountId: String(
                              remark.payAccountId || remark.garagePayAccountId || '',
                          ).trim(),
                          description: '',
                          qty: '1',
                      },
                      seedAmount > 0 ? String(seedAmount) : '',
                  ),
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
 * Cash oil — Schedule + HR open together after Initiate; Accounts after HR once; Make Payment after Complete.
 * mode="approvals": HR Approval | Accounts Approve (Accounts opens only after HR once).
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
        const nextRemark = parseVehicleServiceRemark(service) || {};
        const next = resolveOilPaymentFields(nextRemark);
        setAccountsAmountMode(next.amountMode || 'amount');
        setAccountsPaymentMethod(next.paymentMethod || 'cash');
        setAccountsDescription(String(nextRemark.accountsReviewDescription || '').trim());
    }, [service?._id, service?.updatedAt, service?.remark]);

    const accountsCashMode = isOilPayablePaymentMode(accountsAmountMode);

    const [hrQuoteChoice, setHrQuoteChoice] = useState(() =>
        String(remark.approvedQuotationChoice || '').trim(),
    );
    const [hrDescription, setHrDescription] = useState(() =>
        String(remark.hrReviewDescription || remark.quoteReviewDescription || '').trim(),
    );
    const [hrAmount, setHrAmount] = useState(() => {
        const seed =
            money(remark.garageBillAmount) ||
            money(remark.amount) ||
            money(remark.value) ||
            money(service?.value) ||
            0;
        return seed > 0 ? String(seed) : '';
    });

    useEffect(() => {
        setHrQuoteChoice(String(remark.approvedQuotationChoice || '').trim());
        setHrDescription(
            String(remark.hrReviewDescription || remark.quoteReviewDescription || '').trim(),
        );
        const seed =
            money(remark.garageBillAmount) ||
            money(remark.amount) ||
            money(remark.value) ||
            money(service?.value) ||
            0;
        setHrAmount(seed > 0 ? String(seed) : '');
    }, [
        remark.approvedQuotationChoice,
        remark.hrReviewDescription,
        remark.quoteReviewDescription,
        remark.garageBillAmount,
        remark.amount,
        remark.value,
        service?._id,
        service?.updatedAt,
        service?.value,
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

    // When HR picks a quote with an amount, seed the editable Amount field.
    useEffect(() => {
        if (!canActOnHr) return;
        if (!(selectedQuoteAmount > 0)) return;
        setHrAmount(String(selectedQuoteAmount));
    }, [canActOnHr, selectedQuoteAmount, hrQuoteChoice]);
    const paymentTypeLabel = oilPaymentTypeLabel(
        accountsQuoteApproved ? remark.amountMode : accountsAmountMode,
    );
    const paymentMethodLabel =
        String(
            (accountsQuoteApproved ? remark.amountMode : accountsAmountMode) || '',
        ).toLowerCase() === 'warranty'
            ? '—'
            : oilPaymentMethodLabel(
                  (accountsQuoteApproved ? remark.paymentMethod : accountsPaymentMethod) ||
                      remark.amountMode,
              );
    const quoteLabel =
        selectedQuoteRow?.label ||
        (hrQuoteChoice ? oilQuoteKeyToLabel(hrQuoteChoice) : '') ||
        (remark.approvedQuotationChoice ? oilQuoteKeyToLabel(remark.approvedQuotationChoice) : '');

    const handleViewQuote = async (row) => {
        if (!row?.url) return;
        const result = await openAttachmentInNewTab(row.url, {
            name: row.name || `${row.label || 'Quotation'}.pdf`,
            mimeType: 'application/pdf',
        });
        if (!result.ok) {
            toast({
                variant: 'destructive',
                title: 'Cannot open quotation',
                description: result.error || 'File unavailable.',
            });
        }
    };

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
            const editedAmount = money(hrAmount);
            const amountNum =
                editedAmount > 0
                    ? editedAmount
                    : selectedQuoteAmount > 0
                      ? selectedQuoteAmount
                      : quoteAmount > 0
                        ? quoteAmount
                        : null;
            const nextRemark = {
                ...remark,
                approvedQuotationChoice: hrQuoteChoice || '',
                ...(amountNum != null
                    ? {
                          amount: amountNum,
                          garageBillAmount: amountNum,
                          value: amountNum,
                          hrReviewApprovedAmount: amountNum,
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
        const amountMode = normalizeOilPaymentType(accountsAmountMode) || 'amount';
        const paymentMethod =
            amountMode === 'warranty'
                ? ''
                : normalizeOilPaymentMethod(accountsPaymentMethod) || 'cash';
        if (amountMode !== 'warranty' && !paymentMethod) {
            toast({
                variant: 'destructive',
                title: 'Payment method required',
                description: 'Select a payment method before approving.',
            });
            return;
        }
        setBusy(true);
        try {
            const description = String(accountsDescription || '').trim();
            const { data } = await axiosInstance.put(
                `/AssetItem/${vehicleId}/service/${serviceId}/oil-accounts-quote-approve`,
                { amountMode, paymentMethod, description },
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
                { description: '', payableTo: '', payAccountId: '', qty: '1', amount: '' },
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
            .map((row) => {
                const qtyNum = Number(row.qty);
                const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 1;
                return {
                    description: String(row.description || '').trim(),
                    payableTo: String(row.payableTo || '').trim(),
                    payAccountId: String(row.payAccountId || '').trim(),
                    qty,
                    quantity: qty,
                    amount: money(row.amount),
                };
            })
            .filter(
                (row) =>
                    row.description ||
                    row.payableTo ||
                    row.payAccountId ||
                    row.amount > 0,
            );

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
            ).filter((row) => {
                const qty = Number(row.qty ?? row.quantity);
                return (
                    String(row.payAccountId || '').trim() &&
                    money(row.amount) > 0 &&
                    Number.isFinite(qty) &&
                    qty > 0
                );
            });
            if (!(total > 0) || !payableLines.length) {
                toast({
                    variant: 'destructive',
                    title: 'Payable lines required',
                    description:
                        'Add at least one line with Chart of Accounts, Qty, and Amount before submitting to Zoho.',
                });
                setBusy(false);
                return;
            }
            if (payableLines.length !== (parsedRemark.billingPayables || []).length) {
                toast({
                    variant: 'destructive',
                    title: 'Incomplete payable lines',
                    description:
                        'Every line needs Chart of Accounts, Qty (> 0), and Amount.',
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
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void handleViewQuote({
                                                        url: garageInvoiceViewUrl,
                                                        name:
                                                            billing.existingGarageAttachmentName ||
                                                            'Garage-invoice.pdf',
                                                        label: 'Garage invoice',
                                                    })
                                                }
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100"
                                            >
                                                <Eye size={14} />
                                                View
                                            </button>
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
                                        Zoho payable lines
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
                                <div className="mb-1.5 hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_72px_110px_36px] gap-2 px-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 lg:grid">
                                    <span>Description</span>
                                    <span>Payable (Chart of Accounts)</span>
                                    <span>Qty</span>
                                    <span>Amount</span>
                                    <span />
                                </div>
                                <div className="space-y-2">
                                    {(billing.billingPayables || []).map((row, index) => (
                                        <div
                                            key={`payable-${index}`}
                                            className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_72px_110px_36px] items-start"
                                        >
                                            <input
                                                type="text"
                                                className="min-h-[44px] w-full rounded-lg border border-gray-200 px-2.5 text-sm font-semibold text-gray-900 placeholder:text-gray-400"
                                                placeholder="Description"
                                                value={row.description || ''}
                                                disabled={fieldsDisabled}
                                                onChange={(e) =>
                                                    setLine(index, { description: e.target.value })
                                                }
                                            />
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
                                                min="0.01"
                                                step="any"
                                                className="min-h-[44px] w-full rounded-lg border border-gray-200 px-2.5 text-sm font-semibold"
                                                placeholder="Qty"
                                                value={row.qty ?? '1'}
                                                disabled={fieldsDisabled}
                                                onChange={(e) => setLine(index, { qty: e.target.value })}
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="min-h-[44px] w-full rounded-lg border border-gray-200 px-2.5 text-sm font-semibold"
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
                                    <span className="font-semibold text-gray-500">Net</span>
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
                                    {busy ? 'Working…' : 'Submit Make Payment (Zoho)'}
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
                                ? hrLockMessage || 'Locked until Initiate Service is sent'
                                : hrActiveStage
                                  ? 'Open with Schedule — select quotation, then approve once'
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
                                            <div
                                                key={row.key}
                                                role="radio"
                                                aria-checked={selected}
                                                tabIndex={canActOnHr || selected ? 0 : -1}
                                                onClick={() => {
                                                    if (!canActOnHr) return;
                                                    setHrQuoteChoice(row.key);
                                                }}
                                                onKeyDown={(event) => {
                                                    if (!canActOnHr) return;
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        setHrQuoteChoice(row.key);
                                                    }
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
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void handleViewQuote(row);
                                                        }}
                                                        className="shrink-0 text-xs font-semibold text-sky-700 hover:underline"
                                                    >
                                                        View
                                                    </button>
                                                ) : null}
                                            </div>
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

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Amount (AED)
                                </span>
                                {canActOnHr ? (
                                    <div className="relative mt-1">
                                        <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                                            AED
                                        </span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full border-0 bg-transparent py-0.5 pl-9 text-sm font-bold text-gray-900 outline-none focus:ring-0"
                                            value={hrAmount}
                                            onChange={(e) => setHrAmount(e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                ) : (
                                    <p className="mt-1 text-sm font-bold text-gray-900">
                                        {money(hrAmount) > 0
                                            ? formatAed(hrAmount)
                                            : quoteAmount > 0
                                              ? formatAed(quoteAmount)
                                              : '—'}
                                    </p>
                                )}
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Payment type
                                </span>
                                <p className="mt-1 text-sm font-bold text-gray-900">
                                    {oilPaymentTypeLabel(remark.amountMode) || '—'}
                                </p>
                            </div>
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
                                Waiting for flowchart HR to approve (open with Schedule).
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
                                  : 'Review amount, payment type/method, and quotation — then approve'
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
                                    <button
                                        type="button"
                                        onClick={() => void handleViewQuote(selectedQuoteRow)}
                                        className="mt-1 inline-block text-xs font-semibold text-sky-700 hover:underline"
                                    >
                                        View PDF
                                    </button>
                                ) : null}
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5 sm:col-span-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Payment type
                                </span>
                                {canActOnAccountsQuote ? (
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
                            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5 sm:col-span-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Payment method
                                </span>
                                {canActOnAccountsQuote ? (
                                    <div className="mt-2">
                                        {accountsCashMode ? (
                                            <SegmentedToggle
                                                options={OIL_PAYMENT_METHOD_OPTIONS}
                                                value={normalizeOilPaymentMethod(
                                                    accountsPaymentMethod,
                                                )}
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
                            {canActOnAccountsQuote ? (
                                <textarea
                                    className="mt-1.5 w-full min-h-[88px] resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-gray-50 disabled:text-gray-600"
                                    value={accountsDescription}
                                    onChange={(e) => setAccountsDescription(e.target.value)}
                                    disabled={busy}
                                    placeholder="Enter accounts review notes..."
                                    rows={3}
                                />
                            ) : String(remark.accountsReviewDescription || accountsDescription || '').trim() ? (
                                <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                                    {String(remark.accountsReviewDescription || accountsDescription).trim()}
                                </p>
                            ) : (
                                <p className="mt-1.5 text-sm text-gray-400">—</p>
                            )}
                        </div>

                        {accountsQuoteApproved ? (
                            <p className="mt-4 text-sm font-semibold text-emerald-700">
                                Approved with amount AED {formatAed(quoteAmount)}
                                {quoteLabel ? ` · ${quoteLabel}` : ''}
                                {paymentTypeLabel ? ` · ${paymentTypeLabel}` : ''}
                                {paymentMethodLabel && paymentMethodLabel !== '—'
                                    ? ` · ${paymentMethodLabel}`
                                    : ''}
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
