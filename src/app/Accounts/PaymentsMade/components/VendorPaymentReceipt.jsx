'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatZohoPaymentDate, formatZohoPaymentMoney } from '@/utils/zohoVendorPayments';

const DEFAULT_COMPANY = {
    name: 'VEGADIGITAL IT SOLUTIONS LLC',
    addressLines: [
        'Office 2401, API Trio Tower',
        'Sheikh Zayed Road, Al Barsha Heights',
        'Dubai, United Arab Emirates',
    ],
    trn: '',
    logoSrc: '/assets/images/logo.png',
};

function cleanText(value, fallback = '—') {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function receiptStatusLabel(status, unusedAmount) {
    const value = String(status || '').toLowerCase();
    if (value.includes('void')) return 'Void';
    if (value.includes('draft')) return 'Draft';
    if (value.includes('partial') || unusedAmount > 0) return 'Partial';
    if (value.includes('paid') || value.includes('applied') || !value) return 'Paid';
    return cleanText(status, 'Paid');
}

function amountLabel(amount, currency) {
    const code = cleanText(currency, 'AED');
    const value = numberValue(amount);
    return `${code} ${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function InfoPair({ label, children }) {
    return (
        <div className="grid grid-cols-[120px_1fr] gap-2 py-1.5 text-sm">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-800 break-words">{children}</dd>
        </div>
    );
}

/**
 * Zoho-style Payments Made receipt document.
 */
export default function VendorPaymentReceipt({
    payment,
    company = DEFAULT_COMPANY,
    className = '',
}) {
    const [logoError, setLogoError] = useState(false);

    if (!payment) return null;

    const currencyCode = cleanText(payment.currency_code, 'AED');
    const amountPaid = numberValue(payment.amount);
    const unusedAmount = numberValue(payment.balance);
    const status = receiptStatusLabel(payment.status, unusedAmount);
    const isPaid = status.toLowerCase() === 'paid';
    const paymentNumber = cleanText(
        payment.payment_number || payment.payment_no || payment.payment_id,
    );
    const paidThrough = cleanText(
        payment.paid_through_account_name ||
            payment.account_name ||
            payment.paid_through,
    );
    const vendorName = cleanText(payment.vendor_name, 'Vendor');
    const vendorId = cleanText(payment.vendor_id || payment.contact_id, '');
    const referenceNumber = cleanText(payment.reference_number, '');
    const paymentMode = cleanText(payment.payment_mode);
    const companyName = cleanText(company?.name, DEFAULT_COMPANY.name);
    const addressLines = Array.isArray(company?.addressLines)
        ? company.addressLines.filter(Boolean)
        : DEFAULT_COMPANY.addressLines;
    const trn = cleanText(company?.trn || company?.vatNumber, '');
    const logoSrc = company?.logoSrc || DEFAULT_COMPANY.logoSrc;

    const appliedBills = Array.isArray(payment.bills) ? payment.bills : [];
    const appliedExpenses = Array.isArray(payment.expenses) ? payment.expenses : [];

    return (
        <div
            className={`relative overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm ${className}`}
            id="vendor-payment-receipt"
            data-payment-receipt="true"
        >
            {/* Status ribbon */}
            <div
                className={`pointer-events-none absolute -left-10 top-5 w-40 -rotate-45 py-1 text-center text-[11px] font-bold uppercase tracking-wide text-white shadow ${
                    isPaid
                        ? 'bg-emerald-500'
                        : status.toLowerCase() === 'partial'
                          ? 'bg-amber-500'
                          : 'bg-slate-500'
                }`}
            >
                {status}
            </div>

            <div className="px-6 sm:px-10 pt-8 pb-10">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                        {!logoError ? (
                            <img
                                src={logoSrc}
                                alt={companyName}
                                className="h-12 w-auto object-contain"
                                onError={() => setLogoError(true)}
                            />
                        ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-800 text-sm font-bold text-white">
                                V
                            </div>
                        )}
                        <div className="min-w-0 text-[12px] leading-relaxed text-slate-600">
                            <p className="text-sm font-bold text-slate-900">{companyName}</p>
                            {addressLines.map((line) => (
                                <p key={line}>{line}</p>
                            ))}
                            {trn ? <p className="mt-1">TRN {trn}</p> : null}
                        </div>
                    </div>

                    <div className="text-center sm:pt-2 sm:pr-6">
                        <h2 className="text-xl font-bold tracking-[0.12em] text-slate-800">
                            PAYMENTS MADE
                        </h2>
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
                    <dl className="max-w-xl">
                        <InfoPair label="Payment #">{paymentNumber}</InfoPair>
                        <InfoPair label="Payment Date">
                            {formatZohoPaymentDate(payment.date)}
                        </InfoPair>
                        {referenceNumber && referenceNumber !== '—' ? (
                            <InfoPair label="Reference Number">{referenceNumber}</InfoPair>
                        ) : null}
                        <InfoPair label="Paid To">
                            {vendorId ? (
                                <Link
                                    href={`/Accounts/Vendors?vendorId=${encodeURIComponent(vendorId)}`}
                                    className="font-semibold text-blue-600 hover:underline"
                                >
                                    {vendorName}
                                </Link>
                            ) : (
                                <span className="font-semibold text-blue-600">{vendorName}</span>
                            )}
                        </InfoPair>
                        <InfoPair label="Payment Mode">{paymentMode}</InfoPair>
                        <InfoPair label="Paid Through">{paidThrough}</InfoPair>
                    </dl>

                    <div className="w-full min-w-[200px] rounded-md bg-emerald-500 px-5 py-4 text-white shadow-sm lg:w-56">
                        <p className="text-xs font-medium text-emerald-50">Amount Paid</p>
                        <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">
                            {amountLabel(amountPaid, currencyCode)}
                        </p>
                    </div>
                </div>

                {(appliedBills.length > 0 || appliedExpenses.length > 0) && (
                    <div className="mt-10 border-t border-slate-100 pt-6">
                        <h3 className="mb-3 text-sm font-bold text-slate-800">Payment applied to</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                                        <th className="py-2 pr-3">Date</th>
                                        <th className="py-2 pr-3">Reference</th>
                                        <th className="py-2 pr-3 text-right">Amount</th>
                                        <th className="py-2 text-right">Paid</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appliedBills.map((bill, index) => {
                                        const id = String(bill?.bill_id || bill?.id || index);
                                        return (
                                            <tr
                                                key={`bill-${id}`}
                                                className="border-b border-slate-50"
                                            >
                                                <td className="py-2 pr-3 text-slate-600">
                                                    {formatZohoPaymentDate(
                                                        bill?.date || bill?.bill_date,
                                                    )}
                                                </td>
                                                <td className="py-2 pr-3 font-medium text-slate-800">
                                                    Bill #{cleanText(bill?.bill_number || id)}
                                                </td>
                                                <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                                                    {formatZohoPaymentMoney(
                                                        numberValue(
                                                            bill?.total ||
                                                                bill?.bill_amount ||
                                                                bill?.amount,
                                                        ),
                                                        currencyCode,
                                                    )}
                                                </td>
                                                <td className="py-2 text-right tabular-nums font-semibold text-slate-800">
                                                    {formatZohoPaymentMoney(
                                                        numberValue(
                                                            bill?.amount_applied ||
                                                                bill?.applied_amount ||
                                                                bill?.payment_amount,
                                                        ),
                                                        currencyCode,
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {appliedExpenses.map((expense, index) => {
                                        const id = String(
                                            expense?.expense_id || expense?.id || index,
                                        );
                                        return (
                                            <tr
                                                key={`expense-${id}`}
                                                className="border-b border-slate-50"
                                            >
                                                <td className="py-2 pr-3 text-slate-600">
                                                    {formatZohoPaymentDate(expense?.date)}
                                                </td>
                                                <td className="py-2 pr-3 font-medium text-slate-800">
                                                    Expense #
                                                    {cleanText(
                                                        expense?.expense_number ||
                                                            expense?.reference_number ||
                                                            id,
                                                    )}
                                                </td>
                                                <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                                                    {formatZohoPaymentMoney(
                                                        numberValue(
                                                            expense?.total || expense?.amount,
                                                        ),
                                                        currencyCode,
                                                    )}
                                                </td>
                                                <td className="py-2 text-right tabular-nums font-semibold text-slate-800">
                                                    {formatZohoPaymentMoney(
                                                        numberValue(
                                                            expense?.amount_applied ||
                                                                expense?.applied_amount ||
                                                                expense?.payment_amount,
                                                        ),
                                                        currencyCode,
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {cleanText(payment.description || payment.notes, '') ? (
                    <div className="mt-8 border-t border-slate-100 pt-4 text-sm text-slate-600">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Notes
                        </p>
                        <p className="whitespace-pre-wrap">
                            {cleanText(payment.description || payment.notes)}
                        </p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
