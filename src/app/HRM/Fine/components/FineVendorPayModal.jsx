'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useZohoOrganizations } from '@/hooks/useZohoOrganizations';
import ZohoOrganizationPicker from '@/components/ZohoOrganizationPicker';
import { mapZohoPaymentAccounts } from '@/utils/zohoVendorPayments';
import { mapZohoVendors } from '@/utils/zohoVendors';
import { buildFineVendorPaymentPrefill } from '../utils/fineVendorPaymentPrefill';

function parseFineMonthStart(startMonth) {
    if (!startMonth) return null;
    const raw = String(startMonth).trim();
    if (!raw) return null;

    if (raw.includes('-')) {
        const parts = raw.split('-');
        if (parts[0].length === 4) {
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        }
        return new Date(parseInt(parts[1], 10), parseInt(parts[0], 10) - 1, 1);
    }
    if (raw.includes('/')) {
        const parts = raw.split('/');
        if (parts[0].length === 4) {
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        }
        return new Date(parseInt(parts[1], 10), parseInt(parts[0], 10) - 1, 1);
    }

    const monthNames = [
        'january',
        'february',
        'march',
        'april',
        'may',
        'june',
        'july',
        'august',
        'september',
        'october',
        'november',
        'december',
    ];
    const normalized = raw.toLowerCase();
    const monthIndex = monthNames.findIndex((m) => m.startsWith(normalized));
    if (monthIndex !== -1) {
        const d = new Date();
        d.setMonth(monthIndex);
        d.setDate(1);
        return d;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setDate(1);
    return parsed;
}

function buildVendorPaymentSchedule(fine, totalAmount) {
    const duration = Math.max(1, Number(fine?.payableDuration) || 1);
    const startDate = parseFineMonthStart(fine?.monthStart);
    if (!startDate || !(totalAmount > 0)) return [];

    const monthlyAmount = totalAmount / duration;
    const boxes = [];
    for (let i = 0; i < duration; i += 1) {
        const monthDate = new Date(startDate);
        monthDate.setMonth(startDate.getMonth() + i);
        boxes.push({
            month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            monthlyAmount,
            paidAmount: 0,
            isPaid: false,
            isPartial: false,
            isNotPaid: true,
            remaining: monthlyAmount,
        });
    }
    return boxes;
}

/**
 * Payment to vendors for an employee fine.
 * Fields: Vendor + Paid Through only → continues to Accounts → Payments Made.
 */
export default function FineVendorPayModal({
    isOpen,
    onClose,
    fine = null,
    returnTo = '',
    onSuccess,
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [vendors, setVendors] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loadingSupport, setLoadingSupport] = useState(false);
    const [vendorId, setVendorId] = useState('');
    const [paidThroughAccountId, setPaidThroughAccountId] = useState('');
    const [amount, setAmount] = useState('');
    const [selectedCardIndex, setSelectedCardIndex] = useState(null);

    const preferredOrgId = String(fine?.zohoOrganizationId || '').trim();
    const preferredCompanyId = String(fine?.company?._id || fine?.company || '').trim();

    const {
        options: zohoOrgOptions,
        organizationId,
        setOrganizationId,
        active: activeZohoOrg,
        showPicker: showZohoOrgPicker,
        loading: zohoOrgLoading,
    } = useZohoOrganizations({
        enabled: isOpen,
        preferredOrganizationId: preferredOrgId,
        preferredCompanyId,
    });

    const hasZohoBill = Boolean(String(fine?.zohoBillId || '').trim());

    const fineTotalAmount = useMemo(() => {
        const n = Number(fine?.fineAmount ?? fine?.totalFineAmount ?? fine?.balance ?? 0);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }, [fine]);

    const remainingAmount = useMemo(() => {
        if (fine?.balance != null && Number.isFinite(Number(fine.balance))) {
            return Math.max(0, Number(fine.balance));
        }
        return fineTotalAmount;
    }, [fine, fineTotalAmount]);

    const monthBoxes = useMemo(
        () => buildVendorPaymentSchedule(fine, remainingAmount > 0 ? remainingAmount : fineTotalAmount),
        [fine, remainingAmount, fineTotalAmount],
    );

    const vendorOptions = useMemo(
        () =>
            vendors.map((v) => ({
                id: v.id,
                label: v.label || v.name || v.id,
            })),
        [vendors],
    );

    const accountOptions = useMemo(
        () =>
            accounts.map((a) => ({
                id: a.id,
                label: a.label || a.name || a.id,
                name: a.name || a.label || '',
            })),
        [accounts],
    );

    useEffect(() => {
        if (!isOpen || !fine) return;
        setAmount(remainingAmount > 0 ? remainingAmount.toFixed(2) : '');
        setVendorId(String(fine.zohoVendorId || '').trim());
        setPaidThroughAccountId(
            String(fine.paidThroughAccountId || fine.expenseAccountId || '').trim(),
        );
        setSelectedCardIndex(null);
    }, [isOpen, fine, remainingAmount]);

    useEffect(() => {
        if (!isOpen || !organizationId) return undefined;
        let cancelled = false;
        setLoadingSupport(true);
        (async () => {
            try {
                const [supportRes, vendorRes] = await Promise.all([
                    axiosInstance.get('/zoho/vendorpayments/support', {
                        params: {
                            organizationId,
                            accountsOnly: 'true',
                            includeInactive: 'true',
                        },
                        skipToast: true,
                        timeout: 45000,
                    }),
                    axiosInstance.get('/zoho/vendors', {
                        params: { organizationId },
                        skipToast: true,
                        timeout: 45000,
                    }),
                ]);
                if (cancelled) return;
                const accountRows = supportRes?.data?.data?.accounts || [];
                const vendorRows = vendorRes?.data?.data;
                setAccounts(mapZohoPaymentAccounts(accountRows));
                setVendors(mapZohoVendors(vendorRows));
            } catch {
                if (!cancelled) {
                    setAccounts([]);
                    setVendors([]);
                }
            } finally {
                if (!cancelled) setLoadingSupport(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, organizationId]);

    if (!isOpen || !fine) return null;

    const handleCardClick = (index, box) => {
        if (box.isPaid) return;
        if (selectedCardIndex === index) {
            setSelectedCardIndex(null);
            setAmount(remainingAmount > 0 ? remainingAmount.toFixed(2) : '');
            return;
        }
        setSelectedCardIndex(index);
        setAmount(Number(box.remaining || 0).toFixed(2));
    };

    const handleContinueToPaymentsMade = () => {
        if (!vendorId) {
            toast({
                variant: 'destructive',
                title: 'Vendor required',
                description: 'Select a vendor for this payment.',
            });
            return;
        }
        if (!paidThroughAccountId) {
            toast({
                variant: 'destructive',
                title: 'Paid Through required',
                description: 'Select the Paid Through account.',
            });
            return;
        }
        const payAmt = Number(amount);
        if (!Number.isFinite(payAmt) || payAmt <= 0) {
            toast({
                variant: 'destructive',
                title: 'Amount required',
                description: 'Enter a valid fine amount.',
            });
            return;
        }
        if (!organizationId) {
            toast({
                variant: 'destructive',
                title: 'Organization required',
                description: 'Select VEGA or NNIT organization.',
            });
            return;
        }

        const paidThrough = accountOptions.find((o) => o.id === paidThroughAccountId);
        const prefill = buildFineVendorPaymentPrefill(fine, {
            returnTo,
            vendorId,
            vendorName: vendorOptions.find((o) => o.id === vendorId)?.label || '',
            amount: payAmt.toFixed(2),
            paidThroughAccountId,
            paidThroughAccountName: paidThrough?.name || paidThrough?.label || '',
            organizationId,
        });
        try {
            sessionStorage.setItem('fineVendorPaymentPrefill', JSON.stringify(prefill));
        } catch {
            /* ignore */
        }
        const params = new URLSearchParams();
        params.set('addFinePay', '1');
        if (prefill.organizationId || organizationId) {
            params.set('organizationId', prefill.organizationId || organizationId);
        }
        if (prefill.companyId) params.set('companyId', prefill.companyId);
        if (prefill.fineMongoId) params.set('fineMongoId', prefill.fineMongoId);
        onSuccess?.();
        onClose?.();
        router.push(`/Accounts/PaymentsMade/new?${params.toString()}`);
    };

    const inputClass =
        'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 disabled:opacity-60';

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={onClose} aria-hidden />
            <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden max-h-[92vh] flex flex-col">
                <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-gray-100 shrink-0">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">Add Payment</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Payment to vendors · {fine.fineId || 'Fine'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 min-h-0">
                    <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Remaining Amount
                        </span>
                        <p className="text-lg font-bold text-amber-600 mt-1">
                            {remainingAmount.toFixed(2)} AED
                        </p>
                    </div>

                    {monthBoxes.length > 0 && (
                        <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">
                            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                Payment Schedule
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {monthBoxes.map((box, index) => (
                                    <div
                                        key={`${box.month}-${index}`}
                                        onClick={() => handleCardClick(index, box)}
                                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                                            box.isPaid
                                                ? 'bg-green-50 border-green-500'
                                                : box.isPartial
                                                  ? 'bg-amber-50 border-amber-500'
                                                  : selectedCardIndex === index
                                                    ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20'
                                                    : 'bg-red-50 border-red-500'
                                        }`}
                                    >
                                        <div
                                            className={`text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between ${
                                                box.isPaid
                                                    ? 'text-green-700'
                                                    : box.isPartial
                                                      ? 'text-amber-700'
                                                      : 'text-red-700'
                                            }`}
                                        >
                                            {box.month}
                                            {box.isNotPaid && (
                                                <span className="text-red-600 bg-red-100 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                                                    ✗
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className={`text-sm font-bold mb-1 ${
                                                box.isPaid
                                                    ? 'text-green-700'
                                                    : box.isPartial
                                                      ? 'text-amber-700'
                                                      : 'text-red-700'
                                            }`}
                                        >
                                            {box.paidAmount.toFixed(2)}{' '}
                                            <span className="text-xs font-normal text-gray-500">
                                                / {box.monthlyAmount.toFixed(2)} AED
                                            </span>
                                        </div>
                                        {!box.isPaid && (
                                            <div className="text-[10px] font-medium text-red-600/80 mt-2">
                                                Remaining: {box.remaining.toFixed(2)} AED
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="p-5 bg-white border border-indigo-100 shadow-sm rounded-2xl space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800">
                                    Payment to vendors · Zoho Payments Made
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Vendor + Paid Through → recorded in Zoho Payments Made.
                                </p>
                            </div>
                            {(showZohoOrgPicker || activeZohoOrg) && (
                                <ZohoOrganizationPicker
                                    options={zohoOrgOptions}
                                    value={organizationId}
                                    onChange={setOrganizationId}
                                    loading={zohoOrgLoading || loadingSupport}
                                    size="sm"
                                />
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                Vendor <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={vendorId}
                                onChange={(e) => setVendorId(e.target.value)}
                                disabled={loadingSupport}
                                className={inputClass}
                            >
                                <option value="">
                                    {loadingSupport ? 'Loading vendors…' : 'Select vendor'}
                                </option>
                                {vendorOptions.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                Paid Through <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={paidThroughAccountId}
                                onChange={(e) => setPaidThroughAccountId(e.target.value)}
                                disabled={loadingSupport}
                                className={inputClass}
                            >
                                <option value="">
                                    {loadingSupport
                                        ? 'Loading Chart of Accounts…'
                                        : 'Select Paid Through account'}
                                </option>
                                {accountOptions.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                Fine amount <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                                    AED
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => {
                                        setSelectedCardIndex(null);
                                        setAmount(e.target.value);
                                    }}
                                    className={`${inputClass} pl-12`}
                                />
                            </div>
                        </div>

                        {hasZohoBill ? (
                            <p className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                                Continues to Zoho Payments Made to settle the vendor bill.
                            </p>
                        ) : (
                            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                Continues to Zoho Payments Made to record this vendor payment.
                            </p>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 sm:justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={loadingSupport}
                        onClick={handleContinueToPaymentsMade}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-semibold"
                    >
                        {loadingSupport ? <Loader2 size={16} className="animate-spin" /> : null}
                        Continue to Payments Made
                    </button>
                </div>
            </div>
        </div>
    );
}
