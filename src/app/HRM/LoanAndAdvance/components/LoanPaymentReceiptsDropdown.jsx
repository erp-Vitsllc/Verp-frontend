'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileText, ExternalLink } from 'lucide-react';
import {
    getLoanRepaymentPaymentsForDocuments,
    openPaymentReceiptInNewTab,
} from '../utils/loanPaymentReceipts';

function formatMoney(value) {
    return (parseFloat(value) || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatDate(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
}

/**
 * Document column dropdown: lists every repayment invoice for the loan/advance row.
 * Click opens the receipt in a new tab.
 */
export default function LoanPaymentReceiptsDropdown({
    loan,
    payments = [],
    requestAttachment = null,
    onViewRequestAttachment,
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    const receipts = getLoanRepaymentPaymentsForDocuments(loan, payments);
    const hasRequestDoc = Boolean(requestAttachment);
    const hasItems = receipts.length > 0 || hasRequestDoc;

    useEffect(() => {
        if (!open) return undefined;
        const onDocClick = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!hasItems) {
        return <span className="text-gray-400">—</span>;
    }

    return (
        <div ref={rootRef} className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                title="Payment receipts"
            >
                <FileText size={15} />
                <span className="text-[10px] font-black uppercase tracking-wide">
                    {receipts.length || (hasRequestDoc ? 1 : 0)}
                </span>
                <ChevronDown size={13} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {open ? (
                <div className="absolute right-0 z-[80] mt-1 w-72 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 sticky top-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Payment invoices
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                            Click to open receipt in a new tab
                        </p>
                    </div>
                    <ul className="py-1">
                        {hasRequestDoc ? (
                            <li>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onViewRequestAttachment?.();
                                        setOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-start gap-2 border-b border-slate-50"
                                >
                                    <FileText size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                    <span className="min-w-0">
                                        <span className="block text-xs font-bold text-slate-800">
                                            Loan request document
                                        </span>
                                        <span className="block text-[10px] text-slate-500">
                                            Original application attachment
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ) : null}
                        {receipts.length === 0 ? (
                            <li className="px-3 py-4 text-center text-[11px] font-semibold text-slate-400">
                                No repayment receipts yet
                            </li>
                        ) : (
                            receipts.map((pay, index) => {
                                const pid = pay.paymentId || pay._id || `pay-${index + 1}`;
                                return (
                                    <li key={pay._id || pid}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                openPaymentReceiptInNewTab(pay);
                                                setOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2.5 hover:bg-emerald-50/80 flex items-start gap-2 group"
                                        >
                                            <ExternalLink
                                                size={14}
                                                className="text-emerald-600 mt-0.5 shrink-0 opacity-70 group-hover:opacity-100"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center justify-between gap-2">
                                                    <span className="text-xs font-bold text-slate-800 truncate">
                                                        {index + 1}. {pid}
                                                    </span>
                                                    <span className="text-xs font-black text-emerald-700 whitespace-nowrap">
                                                        AED {formatMoney(pay.amount)}
                                                    </span>
                                                </span>
                                                <span className="block text-[10px] text-slate-500 mt-0.5">
                                                    {formatDate(pay.paymentDate || pay.createdAt)}
                                                    {pay.status ? ` · ${pay.status}` : ''}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
