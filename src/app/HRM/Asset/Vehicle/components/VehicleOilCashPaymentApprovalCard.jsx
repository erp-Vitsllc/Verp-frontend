'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import ZohoVendorSelect from '@/components/ZohoVendorSelect';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import VehicleGarageZohoBillRetry from './VehicleGarageZohoBillRetry';
import VehicleGarageBillingFields from './VehicleGarageBillingFields';
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

    return {
        garageName: String(remark.garageName || remark.vendorName || '').trim(),
        zohoVendorId: String(remark.zohoVendorId || '').trim(),
        garageBillAmount: seedAmount > 0 ? String(seedAmount) : '',
        payAccountId: String(remark.payAccountId || remark.garagePayAccountId || '').trim(),
        payAccountName: String(remark.payAccountName || remark.garagePayAccountName || '').trim(),
        garageAttachment: null,
        existingGarageAttachmentUrl: remark.garageAttachmentUrl || remark.garageBillAttachmentUrl || '',
        existingGarageAttachmentName: remark.garageAttachmentName || '',
        billingPayables: lines,
    };
}

/**
 * Cash oil:
 * - pending_hr (after Scheduled): HR approves schedule before On Service
 * - pending_accounts (after End Service complete): Accounts billing → Zoho → Billed
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
    const [billing, setBilling] = useState(() => buildInitialBillingState(service));

    const totalFromLines = useMemo(
        () =>
            (billing.billingPayables || []).reduce((sum, row) => sum + money(row.amount), 0),
        [billing.billingPayables],
    );

    if (!isCash) return null;
    if (stage !== 'pending_hr' && stage !== 'pending_accounts') return null;

    const isHr = stage === 'pending_hr';
    const canAct = isHr ? canActHr : canActAccounts;

    const setLine = (index, patch) => {
        setBilling((prev) => {
            const next = [...(prev.billingPayables || [])];
            next[index] = { ...next[index], ...patch };
            return { ...prev, billingPayables: next };
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

        const body = { remark: JSON.stringify(nextRemark) };
        if (billing.garageAttachment?.data) {
            body.garageBillAttachment = billing.garageAttachment;
        }
        if (Number.isFinite(total) && total > 0) {
            body.value = total;
        }
        return body;
    };

    const handleApprove = async () => {
        if (!vehicleId || !canAct || busy) return;
        setBusy(true);
        try {
            if (!isHr) {
                const serviceUpdates = buildServiceUpdates();
                const total = money(
                    JSON.parse(serviceUpdates.remark || '{}').billingTotalAmount,
                );
                if (!(total > 0)) {
                    toast({
                        variant: 'destructive',
                        title: 'Amount required',
                        description: 'Enter at least one payable amount before submitting to Zoho.',
                    });
                    setBusy(false);
                    return;
                }
                await axiosInstance.put(`/AssetItem/${vehicleId}/service/${serviceId}`, serviceUpdates);
            }

            const { data } = await axiosInstance.post(`/AssetItem/${vehicleId}/service-workflow/respond`, {
                action: 'approve',
                comment: isHr
                    ? 'HR approved oil service schedule — ready for On Service'
                    : 'Accounts submitted billing — create Zoho bill (Billed)',
            });
            toast({
                title: 'Approved',
                description:
                    data?.message ||
                    (isHr ? 'Schedule approved — On Service when start date is reached.' : 'Zoho bill created — Billed.'),
            });
            if (typeof onUpdated === 'function') {
                onUpdated(data?.asset || null);
            }
        } catch (err) {
            toast({
                variant: 'destructive',
                title: isHr ? 'Approval failed' : 'Accounts approval blocked',
                description:
                    err.response?.data?.message ||
                    (isHr
                        ? 'Could not approve this step.'
                        : 'Zoho bill must succeed before status becomes Billed.'),
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <FineFormCard
            title={
                isHr
                    ? 'HR — Schedule approval (before On Service)'
                    : 'Accounts — Billing (Zoho → Billed)'
            }
            icon={isHr ? ShieldCheck : Wallet}
            iconBg={isHr ? 'bg-emerald-50' : 'bg-sky-50'}
            iconColor={isHr ? 'text-emerald-700' : 'text-sky-700'}
            className={className}
        >
            {!isHr ? (
                <VehicleGarageZohoBillRetry
                    vehicleId={vehicleId}
                    serviceId={serviceId}
                    service={service}
                    serviceTypeLabel="Oil Service"
                    onUpdated={onUpdated}
                />
            ) : null}

            {isHr ? (
                <p className="text-sm text-gray-600">
                    Review the scheduled oil service. After you approve, the vehicle can move to{' '}
                    <span className="font-semibold text-gray-800">On Service</span> on the start date.
                </p>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Service work is <span className="font-semibold text-gray-800">complete</span>. Edit billing
                        below and submit — status becomes <span className="font-semibold text-gray-800">Billed</span>{' '}
                        only if Zoho bill create succeeds.
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
                            {billing.existingGarageAttachmentName || billing.garageAttachment?.name ? (
                                <span className="mt-1 block text-[11px] text-gray-500">
                                    {billing.garageAttachment?.name || billing.existingGarageAttachmentName}
                                </span>
                            ) : null}
                        </label>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                Payable to / Amount (multiple)
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
                                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_36px]"
                                >
                                    <input
                                        className="min-h-[38px] rounded-lg border border-gray-200 px-2.5 text-sm font-semibold"
                                        placeholder="Payable to (pay account name)"
                                        value={row.payableTo || ''}
                                        disabled={!canAct || busy}
                                        onChange={(e) => setLine(index, { payableTo: e.target.value })}
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="min-h-[38px] rounded-lg border border-gray-200 px-2.5 text-sm font-semibold"
                                        placeholder="Amount"
                                        value={row.amount || ''}
                                        disabled={!canAct || busy}
                                        onChange={(e) => setLine(index, { amount: e.target.value })}
                                    />
                                    {canAct ? (
                                        <button
                                            type="button"
                                            className="inline-flex items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-40"
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

                    <VehicleGarageBillingFields
                        formData={{
                            ...billing,
                            garageBillAmount:
                                totalFromLines > 0 ? String(totalFromLines) : billing.garageBillAmount,
                        }}
                        setFormData={setBilling}
                        disabled={!canAct || busy}
                        showVendor={false}
                    />
                </div>
            )}

            {canAct ? (
                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        onClick={() => void handleApprove()}
                        disabled={busy}
                        className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        {busy ? 'Working…' : isHr ? 'Approve schedule' : 'Submit to Zoho (Billed)'}
                    </button>
                </div>
            ) : (
                <p className="mt-3 text-xs text-amber-800">
                    {isHr
                        ? 'Waiting for flowchart HR to approve the schedule.'
                        : 'Waiting for flowchart Accounts to submit billing to Zoho.'}
                </p>
            )}
        </FineFormCard>
    );
}
