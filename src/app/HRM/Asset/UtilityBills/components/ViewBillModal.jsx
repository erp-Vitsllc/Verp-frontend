'use client';

import { useEffect, useState } from 'react';
import { Eye, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { billDisplayStatus, formatBillMoney } from '../utils/utilityBillStats';
import { openUtilityAttachment } from '../utils/openUtilityAttachment';
import {
    fetchUtilityBillPayment,
    loadUtilityBillPaymentInvoice,
} from '../utils/utilityBillPaymentInvoice';
import PaymentInvoiceViewerModal from '@/app/Accounts/Payments/components/PaymentInvoiceViewerModal';

function monthLabel(billMonth) {
    if (!billMonth || !/^\d{4}-\d{2}$/.test(String(billMonth))) return '—';
    const [y, m] = String(billMonth).split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
    });
}

function payByDisplay(bill) {
    const mode = String(bill?.paymentBy || '').trim();
    if (mode === 'company') {
        return bill?.payByCompanyName
            ? `Company — ${bill.payByCompanyName}`
            : 'Company';
    }
    if (mode === 'employee' || mode === 'employee_balance') {
        return bill?.payByEmployeeName
            ? `Employee — ${bill.payByEmployeeName}`
            : 'Employee';
    }
    if (mode === 'employee_and_company') return 'Company / Employee';
    return '—';
}

/**
 * View a submitted bill using the same fields as Add Bills.
 * Approved / Paid — read-only; Invoice = Accounts Payments RECEIPT.
 */
export default function ViewBillModal({
    isOpen,
    onClose,
    bill = null,
    onEdit = null,
}) {
    const { toast } = useToast();
    const [paymentRecord, setPaymentRecord] = useState(null);
    const [invoicePayment, setInvoicePayment] = useState(null);
    const [openingInvoice, setOpeningInvoice] = useState(false);

    useEffect(() => {
        if (!isOpen || !bill?._id) {
            setPaymentRecord(null);
            setInvoicePayment(null);
            return undefined;
        }
        const status = String(bill.status || '');
        if (status !== 'Paid' && status !== 'Approved') {
            setPaymentRecord(null);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            const match = await fetchUtilityBillPayment(bill);
            if (!cancelled) setPaymentRecord(match || null);
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, bill?._id, bill?.batchId, bill?.status]);

    if (!isOpen || !bill) return null;

    const contract = Number(bill.monthlyRental) || 0;
    const actual = Number(bill.amount) || 0;
    const difference = contract - actual;
    const status = String(bill.status || '');
    const isNotPaid = status === 'Approved';
    const isPaid = status === 'Paid';
    const isLocked = isNotPaid || isPaid || status === 'Rejected';
    const canEdit = !isLocked && typeof onEdit === 'function' && Boolean(bill.canApproveReject);
    const isPendingHr = status === 'Pending HR';
    const actionLabel = isPendingHr ? 'Approve' : 'Review';
    const billFile =
        bill.attachment?.name && (bill.attachment.dataUrl || bill.attachment.name)
            ? bill.attachment
            : null;
    const showPaymentInvoice = (isNotPaid || isPaid) && Boolean(paymentRecord);

    const openBillFile = () => {
        openUtilityAttachment(billFile, {
            onError: (msg) =>
                toast({
                    title: 'Bill file',
                    description: msg || 'Could not open bill attachment.',
                    variant: 'destructive',
                }),
        });
    };

    const openPaymentInvoice = async () => {
        if (openingInvoice) return;
        if (paymentRecord) {
            setInvoicePayment(paymentRecord);
            return;
        }
        setOpeningInvoice(true);
        try {
            const { payment, error } = await loadUtilityBillPaymentInvoice(bill);
            if (!payment) {
                toast({
                    variant: 'destructive',
                    title: 'Payment invoice',
                    description: error || 'Could not open payment invoice.',
                });
                return;
            }
            setPaymentRecord(payment);
            setInvoicePayment(payment);
        } finally {
            setOpeningInvoice(false);
        }
    };

    return (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-gray-100">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-gray-800 truncate">
                            View Bill — {monthLabel(bill.billMonth)}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {isLocked
                                ? 'Read only — Approved / Paid bills cannot be edited.'
                                : canEdit
                                  ? isPendingHr
                                      ? 'Pending HR — use Approve to review and decide.'
                                      : 'Pending bill — use Review to change fields.'
                                  : 'View only — awaiting workflow.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-4 sm:px-5 py-4 overflow-y-auto space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                            {billDisplayStatus(bill)}
                        </span>
                        {bill.accountNo ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200/50">
                                Acc {bill.accountNo}
                            </span>
                        ) : null}
                    </div>

                    {showPaymentInvoice || billFile?.name ? (
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                                    Documents
                                </p>
                                <p className="text-[11px] text-indigo-600/80 truncate">
                                    {showPaymentInvoice
                                        ? `Invoice: ${paymentRecord.paymentId || 'Payment receipt'}`
                                        : 'No payment invoice yet'}
                                    {billFile?.name ? ` · Bill: ${billFile.name}` : ''}
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-1.5 shrink-0">
                                {showPaymentInvoice ? (
                                    <button
                                        type="button"
                                        onClick={openPaymentInvoice}
                                        disabled={openingInvoice}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-60"
                                    >
                                        <Eye size={12} />
                                        View Invoice
                                    </button>
                                ) : null}
                                {billFile?.name ? (
                                    <button
                                        type="button"
                                        onClick={openBillFile}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-semibold"
                                    >
                                        <Eye size={12} />
                                        View Bill File
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full min-w-[36rem] text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                                    <th className="px-3 py-2.5 text-center font-semibold">
                                        Account No
                                    </th>
                                    <th className="px-3 py-2.5 text-center font-semibold">
                                        Contract
                                    </th>
                                    <th className="px-3 py-2.5 text-center font-semibold">
                                        Actual
                                    </th>
                                    <th className="px-3 py-2.5 text-center font-semibold">
                                        Difference
                                    </th>
                                    <th className="px-3 py-2.5 text-center font-semibold">
                                        Pay by
                                    </th>
                                    <th className="px-3 py-2.5 text-center font-semibold">
                                        Bill file
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-t border-gray-100">
                                    <td className="px-3 py-3.5 text-center font-semibold text-gray-800 tabular-nums">
                                        {bill.accountNo || '—'}
                                    </td>
                                    <td className="px-3 py-3.5 text-center tabular-nums text-gray-700">
                                        {formatBillMoney(contract)}
                                    </td>
                                    <td
                                        className={`px-3 py-3.5 text-center tabular-nums font-semibold ${
                                            actual > contract ? 'text-red-600' : 'text-gray-800'
                                        }`}
                                    >
                                        {formatBillMoney(actual)}
                                    </td>
                                    <td
                                        className={`px-3 py-3.5 text-center tabular-nums font-semibold ${
                                            difference < 0
                                                ? 'text-red-600'
                                                : difference > 0
                                                  ? 'text-emerald-600'
                                                  : 'text-gray-500'
                                        }`}
                                    >
                                        {formatBillMoney(Math.abs(difference))}
                                    </td>
                                    <td className="px-3 py-3.5 text-center text-xs text-gray-700">
                                        <div className="space-y-1">
                                            <p className="font-semibold">{payByDisplay(bill)}</p>
                                            {(bill.companyPayAmount != null ||
                                                bill.employeePayAmount != null) &&
                                            (Number(bill.companyPayAmount) > 0 ||
                                                Number(bill.employeePayAmount) > 0) ? (
                                                <p className="text-[10px] text-gray-500">
                                                    Co {formatBillMoney(bill.companyPayAmount)} · Emp{' '}
                                                    {formatBillMoney(bill.employeePayAmount)}
                                                </p>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-3 py-3.5 text-center align-middle">
                                        {billFile?.name ? (
                                            <button
                                                type="button"
                                                onClick={openBillFile}
                                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                                                title={billFile.name}
                                            >
                                                <Eye size={12} />
                                                View
                                            </button>
                                        ) : (
                                            <span className="text-xs text-gray-400">No file</span>
                                        )}
                                        {billFile?.name ? (
                                            <p
                                                className="mt-1 text-[10px] text-gray-500 truncate max-w-[8rem] mx-auto"
                                                title={billFile.name}
                                            >
                                                {billFile.name}
                                            </p>
                                        ) : null}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="px-4 sm:px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
                    {showPaymentInvoice ? (
                        <button
                            type="button"
                            onClick={openPaymentInvoice}
                            disabled={openingInvoice}
                            className="px-4 py-2 rounded-lg border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 text-sm font-semibold disabled:opacity-60"
                        >
                            View Invoice
                        </button>
                    ) : null}
                    {canEdit ? (
                        <button
                            type="button"
                            onClick={() => onEdit(bill)}
                            className="px-4 py-2 rounded-lg border border-teal-200 bg-white text-teal-700 hover:bg-teal-50 text-sm font-semibold"
                        >
                            {actionLabel}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>

        <PaymentInvoiceViewerModal
            payment={invoicePayment}
            onClose={() => setInvoicePayment(null)}
        />
        </>
    );
}
