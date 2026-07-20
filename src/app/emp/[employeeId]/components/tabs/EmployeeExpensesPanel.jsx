'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2, Receipt, Wallet } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { navHrefProps } from '@/utils/linkContextMenu';
import { useToast } from '@/hooks/use-toast';

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return 'AED 0.00';
    return `AED ${num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadge(status) {
    const paid = String(status || '').toLowerCase() === 'paid';
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                paid
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-amber-50 text-amber-800 border border-amber-100'
            }`}
        >
            {paid ? 'Paid' : 'Not Paid'}
        </span>
    );
}

/**
 * Employee Salary → Expenses: extra amounts the employee must pay (utility / Payments Made).
 */
export default function EmployeeExpensesPanel({ employee }) {
    const router = useRouter();
    const { toast } = useToast();
    const employeeId = String(employee?.employeeId || '').trim();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    const load = useCallback(async () => {
        if (!employeeId) return;
        setLoading(true);
        try {
            const res = await axiosInstance.get('/Expense', {
                params: { employeeId },
                skipToast: true,
            });
            setRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
        } catch (err) {
            console.error('[EmployeeExpensesPanel]', err);
            setRows([]);
            toast({
                variant: 'destructive',
                title: 'Could not load expenses',
                description: err?.response?.data?.message || err?.message || 'Try again.',
            });
        } finally {
            setLoading(false);
        }
    }, [employeeId, toast]);

    useEffect(() => {
        load();
    }, [load]);

    const handlePay = (row) => {
        const kind = String(row.kind || 'balance').toLowerCase();
        if (kind === 'balance') {
            const amount = Number(row.amount) || 0;
            const prefill = {
                mode: 'employee_balance',
                employeeId,
                organizationId: row.zohoOrganizationId || '',
                returnTo:
                    typeof window !== 'undefined'
                        ? `${window.location.pathname}${window.location.search || ''}`
                        : '',
                balance: amount,
                paymentSource: 'Cash',
                batchId: row.utilityBatchId || '',
                utilityType: row.utilityType || '',
                billMonth: row.billMonth || '',
                partyExpenseId:
                    row.id && !String(row.id).startsWith('balance:') ? String(row.id) : '',
                utilityBills: [
                    {
                        _id: row.utilityBillId,
                        id: row.utilityBillId,
                        accountNo: row.accountNo || '',
                        balance: amount,
                        utilityType: row.utilityType || '',
                        billMonth: row.billMonth || '',
                        payByEmployeeBusinessId: employeeId,
                        zohoBillId: row.zohoBillId || '',
                        zohoOrganizationId: row.zohoOrganizationId || '',
                        selected: true,
                    },
                ],
            };
            try {
                sessionStorage.setItem('utilityBillPaymentPrefill', JSON.stringify(prefill));
            } catch {
                /* ignore */
            }
            router.push('/Accounts/Payments?addUtilityPay=1');
            return;
        }

        const params = new URLSearchParams();
        params.set('addUtilityPay', '1');
        if (row.zohoBillId) params.set('billIds', row.zohoBillId);
        if (row.utilityBillId) params.set('utilityBillIds', row.utilityBillId);
        if (row.utilityBatchId) params.set('batchId', row.utilityBatchId);
        if (row.zohoOrganizationId) params.set('organizationId', row.zohoOrganizationId);
        if (row.amount) params.set('amount', String(row.amount));
        params.set('mode', 'difference');

        const prefill = {
            amount: row.amount > 0 ? Number(row.amount).toFixed(2) : '',
            notes: row.description || '',
            mode: 'difference',
            utilityBatchId: row.utilityBatchId || '',
            utilityBillIds: row.utilityBillId ? [row.utilityBillId] : [],
            utilityBillLinks: row.utilityBillId
                ? [
                      {
                          utilityBillId: row.utilityBillId,
                          zohoBillId: row.zohoBillId || '',
                          billNumber: row.accountNo || '',
                      },
                  ]
                : [],
            selectedBillIds: row.zohoBillId ? [row.zohoBillId] : [],
            zohoBillIds: row.zohoBillId ? [row.zohoBillId] : [],
            organizationId: row.zohoOrganizationId || '',
            payBy: 'employee',
            payByEmployeeId: employeeId,
            payByEmployeeName:
                `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() ||
                row.employeeName ||
                '',
            employeePayAmount: row.amount,
            partyRows: [
                {
                    utilityBillId: row.utilityBillId || '',
                    accountNo: row.accountNo || '',
                    payBy: 'employee',
                    amount: row.amount,
                    employeePayAmount: row.amount,
                    payByEmployeeId: employeeId,
                    payByEmployeeName:
                        `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() ||
                        row.employeeName ||
                        '',
                },
            ],
        };
        try {
            sessionStorage.setItem('utilityVendorPaymentPrefill', JSON.stringify(prefill));
        } catch {
            /* ignore */
        }
        router.push(`/Accounts/PaymentsMade/new?${params.toString()}`);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-2 text-slate-600">
                <Wallet size={18} className="text-blue-600 mt-0.5 shrink-0" />
                <p className="text-sm">
                    Utility balances, fines, and loan/advance schedules appear here. Utility
                    over-contract balances: Pay opens Accounts → Payments with VEGA/NNIT Zoho
                    Chart of Accounts (Paid Through as credit).
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                    <Loader2 size={18} className="animate-spin" /> Loading expenses…
                </div>
            ) : rows.length === 0 ? (
                <p className="py-16 text-center text-sm text-gray-400">No expenses found</p>
            ) : (
                <div className="overflow-x-auto w-full">
                    <table className="w-full min-w-[960px] table-auto">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Month / Type
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Account
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Amount
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Status
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Bill
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Payment
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Paid Through
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Ledger
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const key = String(row.id);
                                const expanded = expandedId === key;
                                const ledger = Array.isArray(row.ledger) ? row.ledger : [];
                                const installments = Array.isArray(row.installments)
                                    ? row.installments
                                    : [];
                                const isLoanLike = row.kind === 'loan' || row.kind === 'advance';
                                const monthlyHint =
                                    isLoanLike && row.duration > 0
                                        ? ` · ${row.duration} mo · ${formatMoney(
                                              Number(row.amount) / Number(row.duration),
                                          )}/mo`
                                        : '';
                                return (
                                    <React.Fragment key={key}>
                                        <tr className="border-b border-gray-100 hover:bg-slate-50/80">
                                            <td className="py-3 px-4 text-sm text-slate-800">
                                                <div className="font-semibold">
                                                    {isLoanLike
                                                        ? row.monthStart || row.billMonth || 'Schedule'
                                                        : row.billMonth || '—'}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {row.utilityType || row.description || 'Expense'}
                                                    {monthlyHint}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-700 tabular-nums">
                                                {row.accountNo || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm font-semibold text-slate-900 tabular-nums">
                                                {formatMoney(row.amount)}
                                            </td>
                                            <td className="py-3 px-4">{statusBadge(row.status)}</td>
                                            <td className="py-3 px-4">
                                                {row.billLink ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(row.billLink)}
                                                        {...navHrefProps(row.billLink)}
                                                        className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-xs font-semibold"
                                                    >
                                                        {isLoanLike ? 'Open loan' : 'Open bill'}{' '}
                                                        <ExternalLink size={12} />
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {row.paymentLink && row.status === 'Paid' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(row.paymentLink)}
                                                        {...navHrefProps(row.paymentLink)}
                                                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-semibold"
                                                    >
                                                        {row.zohoPaymentNumber || 'Payment'}{' '}
                                                        <ExternalLink size={12} />
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-slate-600 max-w-[160px] truncate">
                                                {row.paidThroughAccountName || '—'}
                                            </td>
                                            <td className="py-3 px-4">
                                                {ledger.length || installments.length ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setExpandedId(expanded ? null : key)
                                                        }
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                                                    >
                                                        <Receipt size={12} />
                                                        {expanded
                                                            ? 'Hide'
                                                            : isLoanLike
                                                              ? 'Parts'
                                                              : 'View'}{' '}
                                                        (
                                                        {isLoanLike
                                                            ? installments.length || ledger.length
                                                            : ledger.length}
                                                        )
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {isLoanLike ? (
                                                    <span className="text-xs font-semibold text-slate-500">
                                                        {row.duration
                                                            ? `${row.duration} parts`
                                                            : '—'}
                                                    </span>
                                                ) : row.canPay || row.status === 'Not Paid' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePay(row)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
                                                    >
                                                    Pay balance
                                                </button>
                                                ) : (
                                                    <span className="text-xs font-semibold text-emerald-600">
                                                        Paid
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                        {expanded ? (
                                            <tr className="bg-slate-50 border-b border-gray-100">
                                                <td colSpan={9} className="px-6 py-3 space-y-4">
                                                    {installments.length ? (
                                                        <div>
                                                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                                                {row.kind === 'advance'
                                                                    ? 'Advance'
                                                                    : 'Loan'}{' '}
                                                                duration parts ({row.duration || installments.length} months)
                                                            </div>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                                                {installments.map((part) => {
                                                                    const paid =
                                                                        String(part.status || '').toLowerCase() ===
                                                                        'paid';
                                                                    return (
                                                                        <div
                                                                            key={`${part.index}-${part.monthKey}`}
                                                                            className={`rounded-lg border px-3 py-2 ${
                                                                                paid
                                                                                    ? 'border-emerald-200 bg-emerald-50'
                                                                                    : 'border-amber-200 bg-amber-50'
                                                                            }`}
                                                                        >
                                                                            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                                                                {part.monthLabel ||
                                                                                    `Part ${part.index}`}
                                                                            </div>
                                                                            <div className="text-sm font-bold tabular-nums text-slate-800 mt-0.5">
                                                                                {formatMoney(part.amount)}
                                                                            </div>
                                                                            <div
                                                                                className={`text-[10px] font-semibold mt-1 ${
                                                                                    paid
                                                                                        ? 'text-emerald-700'
                                                                                        : 'text-amber-700'
                                                                                }`}
                                                                            >
                                                                                {paid ? 'Paid' : 'Not Paid'}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                    {ledger.length ? (
                                                        <div>
                                                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                                        Chart of Accounts ledger (read-only)
                                                    </div>
                                                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                                                                    <th className="px-3 py-2">Side</th>
                                                                    <th className="px-3 py-2">
                                                                        Account
                                                                    </th>
                                                                    <th className="px-3 py-2">
                                                                        Amount
                                                                    </th>
                                                                    <th className="px-3 py-2">
                                                                        Notes
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {ledger.map((line, idx) => (
                                                                    <tr
                                                                        key={line._id || idx}
                                                                        className="border-b border-slate-50"
                                                                    >
                                                                        <td className="px-3 py-2 font-semibold capitalize">
                                                                            {line.side}
                                                                        </td>
                                                                        <td className="px-3 py-2">
                                                                            {line.accountName ||
                                                                                line.accountId ||
                                                                                '—'}
                                                                        </td>
                                                                        <td className="px-3 py-2 tabular-nums">
                                                                            {formatMoney(line.amount)}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-slate-500">
                                                                            {line.notes || '—'}
                                                                            {line.locked ? (
                                                                                <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">
                                                                                    locked
                                                                                </span>
                                                                            ) : null}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                        </div>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        ) : null}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
