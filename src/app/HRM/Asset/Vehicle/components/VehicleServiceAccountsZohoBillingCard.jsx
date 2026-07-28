'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import ZohoVendorSelect from '@/components/ZohoVendorSelect';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import VehicleGarageZohoBillRetry from './VehicleGarageZohoBillRetry';
import ZohoPayAccountSelect from './ZohoPayAccountSelect';
import { ERP_PDF_ACCEPT, validateErpPdfFile } from '@/utils/uploadFileTypes';

function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function buildInitialBillingState(service) {
    const remark = parseVehicleServiceRemark(service) || {};
    const existingLines = Array.isArray(remark.billingPayables) ? remark.billingPayables : null;
    const seedAmount =
        money(remark.garageBillAmount) ||
        money(remark.totalServiceCharge) ||
        money(remark.hrReviewCompanyPay) ||
        money(remark.hrReviewApprovedAmount) ||
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
            (existingGarageAttachmentUrl ? 'Garage invoice (from service details)' : ''),
        billingPayables: lines,
    };
}

/**
 * Shared Accounts Zoho billing card (same UI as Oil cash Accounts).
 * Used after End Service / complete for Tire, Mechanical, Body Work, Accident Repair,
 * and Oil cash (pending_accounts).
 */
export default function VehicleServiceAccountsZohoBillingCard({
    service,
    vehicleId,
    serviceId,
    canActAccounts = false,
    workflowStage = '',
    serviceTypeLabel = 'Vehicle Service',
    onUpdated,
    className = '',
}) {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);
    const remark = parseVehicleServiceRemark(service) || {};
    const [billing, setBilling] = useState(() => buildInitialBillingState(service));

    useEffect(() => {
        setBilling(buildInitialBillingState(service));
    }, [service?._id, service?.updatedAt, service?.remark, service?.shopInvoice, service?.value]);

    const totalFromLines = useMemo(
        () => (billing.billingPayables || []).reduce((sum, row) => sum + money(row.amount), 0),
        [billing.billingPayables],
    );

    const stageProp = String(workflowStage || '').toLowerCase();
    const stageFromRemark = String(remark.workflowStage || '').toLowerCase();
    const stage =
        stageProp === 'pending_billing' || stageProp === 'pending_accounts'
            ? stageProp
            : stageFromRemark === 'pending_billing' || stageFromRemark === 'pending_accounts'
              ? stageFromRemark
              : stageProp || stageFromRemark;

    const awaitingBilling = stage === 'pending_billing' || stage === 'pending_accounts';
    const isBilled =
        !awaitingBilling &&
        (stage === 'billed' ||
            String(remark.billingStatus || '').toLowerCase() === 'billed' ||
            Boolean(String(remark.zohoBillId || '').trim()));

    // Only show while awaiting Accounts Zoho billing (hide after billed).
    if (isBilled) return null;
    if (!awaitingBilling) return null;

    const canAct = Boolean(canActAccounts);

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

    const handleSubmit = async () => {
        if (!vehicleId || !canAct || busy) return;
        setBusy(true);
        try {
            const serviceUpdates = buildServiceUpdates();
            const parsedRemark = JSON.parse(serviceUpdates.remark || '{}');
            const total = money(parsedRemark.billingTotalAmount);
            const payableLines = (Array.isArray(parsedRemark.billingPayables)
                ? parsedRemark.billingPayables
                : []
            ).filter(
                (row) =>
                    String(row.payAccountId || '').trim() && money(row.amount) > 0,
            );
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
                comment: `${serviceTypeLabel} — Accounts submitted billing — create Zoho bill (Billed)`,
                serviceUpdates,
                ...(serviceId ? { serviceRecordId: serviceId } : {}),
            });
            toast({
                title: 'Billed',
                description: data?.message || data?.zohoBillMessage || 'Zoho bill created — Billed.',
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset || null);
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Accounts approval blocked',
                description:
                    err.response?.data?.message ||
                    'Zoho bill must succeed before status becomes Billed.',
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <FineFormCard
            title="Accounts — Billing (Zoho → Billed)"
            icon={Wallet}
            iconBg="bg-sky-50"
            iconColor="text-sky-700"
            className={className}
        >
            <VehicleGarageZohoBillRetry
                vehicleId={vehicleId}
                serviceId={serviceId}
                service={service}
                serviceTypeLabel={serviceTypeLabel}
                onUpdated={onUpdated}
            />

            <div className="space-y-4">
                <p className="text-sm text-gray-600">
                    {serviceTypeLabel} work is{' '}
                    <span className="font-semibold text-gray-800">complete</span>. Edit billing below and
                    submit — status becomes <span className="font-semibold text-gray-800">Billed</span> only
                    if Zoho bill create succeeds.
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
                                disabled={!canAct || busy}
                                placeholder="Select vendor"
                            />
                        </div>
                    </label>
                    <label className="block text-xs font-semibold text-gray-500">
                        Garage invoice (PDF)
                        <input
                            type="file"
                            accept={ERP_PDF_ACCEPT}
                            className="mt-1 block w-full text-sm"
                            disabled={!canAct || busy}
                            onChange={(e) => void handleGarageInvoice(e.target.files?.[0])}
                        />
                        {billing.existingGarageAttachmentName ||
                        billing.garageAttachment?.name ||
                        billing.existingGarageAttachmentUrl ? (
                            <span className="mt-1 block text-[11px] text-emerald-700">
                                {billing.garageAttachment?.name ||
                                    billing.existingGarageAttachmentName ||
                                    'Garage invoice from service details'}
                                {!billing.garageAttachment?.data && billing.existingGarageAttachmentUrl
                                    ? ' — will attach to Zoho bill'
                                    : ''}
                            </span>
                        ) : (
                            <span className="mt-1 block text-[11px] text-amber-700">
                                No garage invoice yet — upload here or from garage / return details
                            </span>
                        )}
                    </label>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                            Payable from
                        </span>
                        {canAct ? (
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
                                    disabled={!canAct || busy}
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
                                    disabled={!canAct || busy}
                                    onChange={(e) => setLine(index, { amount: e.target.value })}
                                />
                                {canAct ? (
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
                        <span className="font-bold text-gray-900">
                            AED {totalFromLines.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {canAct ? (
                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={busy}
                        className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        {busy ? 'Working…' : 'Submit to Zoho (Billed)'}
                    </button>
                </div>
            ) : (
                <p className="mt-3 text-xs text-amber-800">
                    Waiting for flowchart Accounts to submit billing to Zoho.
                </p>
            )}
        </FineFormCard>
    );
}
