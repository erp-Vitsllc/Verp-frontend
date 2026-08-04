'use client';

import { useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    FileText,
    History,
    ExternalLink,
    RefreshCw,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    getPaymentAmountTextClass,
    getPaymentStatusBadgeClass,
    getPaymentStatusLabel,
    getPaymentStatusSurfaceClass,
} from '@/utils/paymentStatusDisplay';
import {
    getLoanRepaymentPaymentsForDocuments,
    openPaymentReceiptInNewTab,
} from '../utils/loanPaymentReceipts';

function needsZohoRetry(pay) {
    if (!pay) return false;
    if (String(pay.zohoExpenseId || '').trim()) return false;
    const status = String(pay.status || '').trim();
    const hasErr = Boolean(String(pay.zohoSyncError || '').trim());
    return status === 'Failed' || hasErr;
}

/** Document column control — expands the full loan/advance row (not a popup). */
export function LoanDocumentExpandButton({
    receiptCount = 0,
    isExpanded = false,
    onToggle,
    disabled = false,
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation();
                onToggle?.();
            }}
            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                isExpanded
                    ? 'border-emerald-400 bg-emerald-100 text-emerald-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
            title={isExpanded ? 'Hide invoices' : 'Show payment invoices'}
        >
            <FileText size={15} />
            <span className="text-[10px] font-black uppercase tracking-wide">{receiptCount}</span>
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
    );
}

/**
 * Full-width expanded panel under a loan/advance row — invoice list, new-tab open, Retry Zoho.
 */
export default function LoanPaymentReceiptsExpandPanel({
    loan,
    payments = [],
    requestAttachment = null,
    onViewRequestAttachment,
    onPaymentsChanged,
    moduleId = 'hrm_loan',
    allowDownload = false,
    onViewDocument,
}) {
    const { toast } = useToast();
    const [retryingId, setRetryingId] = useState(null);
    const receipts = getLoanRepaymentPaymentsForDocuments(loan, payments);
    const hasRequestDoc = Boolean(requestAttachment);

    const handleRetryZoho = async (pay) => {
        const id = pay?._id;
        if (!id) return;
        setRetryingId(String(id));
        try {
            const res = await axiosInstance.post(
                `/Payment/${encodeURIComponent(id)}/retry-zoho-expense-refund`,
            );
            toast({
                title: 'Zoho Expense Refund',
                description: res.data?.message || 'Zoho Expense Refund posted.',
            });
            onPaymentsChanged?.();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Retry Zoho failed',
                description:
                    err?.response?.data?.message ||
                    err?.message ||
                    'Could not post Expense Refund to Zoho.',
            });
            onPaymentsChanged?.();
        } finally {
            setRetryingId(null);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <History size={14} className="text-emerald-500" />
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Payment invoices
                    </h4>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 italic">
                    Click row to open in new tab
                </span>
            </div>

            {hasRequestDoc ? (
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">Loan request document</p>
                        <p className="text-[10px] text-slate-500">Original application attachment</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onViewRequestAttachment?.()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                    >
                        <FileText size={14} />
                        View
                    </button>
                </div>
            ) : null}

            {receipts.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                    No repayment invoices yet
                </div>
            ) : (
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="px-4 py-2">#</th>
                            <th className="px-4 py-2">Receipt No</th>
                            <th className="px-4 py-2">Date</th>
                            <th className="px-4 py-2">Amount</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Zoho</th>
                            <th className="px-4 py-2 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {receipts.map((pay, index) => {
                            const retry = needsZohoRetry(pay);
                            const isRetrying = retryingId === String(pay._id);
                            return (
                                <tr
                                    key={pay._id || pay.paymentId || index}
                                    className={`border-b border-slate-50 transition-colors ${getPaymentStatusSurfaceClass(pay.status)} ${
                                        retry ? '' : 'cursor-pointer hover:bg-emerald-50/40'
                                    }`}
                                    onClick={() => {
                                        if (retry) return;
                                        openPaymentReceiptInNewTab(pay);
                                    }}
                                    title={
                                        retry
                                            ? pay.zohoSyncError || 'Zoho not posted — use Retry Zoho'
                                            : 'Open invoice in new tab'
                                    }
                                >
                                    <td className="px-4 py-3 text-slate-400 font-bold text-xs">
                                        {index + 1}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-slate-700">
                                        {pay.paymentId || pay._id || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {new Date(
                                            pay.paymentDate || pay.createdAt || Date.now(),
                                        ).toLocaleDateString()}
                                    </td>
                                    <td
                                        className={`px-4 py-3 font-black ${getPaymentAmountTextClass(pay.status)}`}
                                    >
                                        AED {(parseFloat(pay.amount) || 0).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight border ${getPaymentStatusBadgeClass(pay.status)}`}
                                        >
                                            {getPaymentStatusLabel(pay.status)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-[10px] font-semibold">
                                        {String(pay.zohoExpenseId || '').trim() ? (
                                            <span className="text-emerald-700">Synced</span>
                                        ) : retry ? (
                                            <span className="text-rose-600" title={pay.zohoSyncError || ''}>
                                                Failed
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">—</span>
                                        )}
                                    </td>
                                    <td
                                        className="px-4 py-3 text-right"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {retry ? (
                                            <button
                                                type="button"
                                                onClick={() => handleRetryZoho(pay)}
                                                disabled={isRetrying}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-[9px] font-black uppercase tracking-wide hover:bg-amber-600 disabled:opacity-60"
                                            >
                                                <RefreshCw
                                                    size={12}
                                                    className={isRetrying ? 'animate-spin' : ''}
                                                />
                                                {isRetrying ? '…' : 'Retry Zoho'}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => openPaymentReceiptInNewTab(pay)}
                                                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold text-[10px] uppercase tracking-widest ml-auto"
                                            >
                                                Open
                                                <ExternalLink size={12} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}
