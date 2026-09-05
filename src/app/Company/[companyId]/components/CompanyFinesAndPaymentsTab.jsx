'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import PaymentReceipt from '@/app/Accounts/Payments/components/PaymentReceipt';
import {
    isPaymentCountableTowardPaid,
    shouldShowPaymentInHistory,
} from '@/utils/paymentStatusDisplay';
import { resolveCompanyFinePayableAmount } from '@/utils/finePayableAmount';

const COMPANY_PARTY_ID = 'VEGA-HR-0000';

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function paymentMatchesMonthRange(row, startMonth, endMonth) {
    if (!startMonth && !endMonth) return true;
    const raw = row?.paymentDate || row?.billMonth || row?.createdAt;
    if (!raw) return false;
    if (/^\d{4}-\d{2}$/.test(String(raw))) {
        if (startMonth && raw < startMonth) return false;
        if (endMonth && raw > endMonth) return false;
        return true;
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return false;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (startMonth && ym < startMonth) return false;
    if (endMonth && ym > endMonth) return false;
    return true;
}

function utilityBillBelongsToCompany(bill, company) {
    if (!bill || !company) return false;
    const companyOid = company?._id ? String(company._id) : '';
    const companyBusinessId = String(company?.companyId || '').trim();
    const companyName = String(company?.name || '').trim().toLowerCase();
    const ids = new Set([companyOid, companyBusinessId].filter(Boolean));
    const billCompanyId = String(bill.payByCompanyId || '').trim();
    const billCompanyName = String(bill.payByCompanyName || '').trim().toLowerCase();
    if (billCompanyId && ids.has(billCompanyId)) return true;
    if (companyName && billCompanyName && billCompanyName === companyName) return true;
    const lines = Array.isArray(bill.zohoLineItems) ? bill.zohoLineItems : [];
    return lines.some((line) => {
        const payBy = String(line?.payBy || '').toLowerCase();
        const empId = String(line?.payByEmployeeId || '').trim();
        if (payBy === 'employee' || (empId && payBy !== 'company')) return false;
        const coId = String(line?.payByCompanyId || '').trim();
        const coName = String(line?.payByCompanyName || '').trim().toLowerCase();
        if (coId && ids.has(coId)) return true;
        if (companyName && coName && coName === companyName) return true;
        return false;
    });
}

function isZohoPaidStatus(value) {
    return String(value || '').trim().toLowerCase() === 'paid';
}

/** Company payment list: Zoho bill paid → Paid. */
function companyRowStatus(row) {
    if (isZohoPaidStatus(row?.status) || isZohoPaidStatus(row?.vendorBillStatus)) return 'Paid';
    if (isPaymentCountableTowardPaid(row?.status)) return 'Paid';
    const label = String(row?.status || '').trim();
    if (!label) return 'Not Paid';
    if (label.toLowerCase() === 'zoho billed') return 'Zoho billed';
    if (['pending', 'processing', 'not paid'].includes(label.toLowerCase())) return 'Not Paid';
    return label;
}

function statusBadgeClass(status) {
    const label = String(status || '').toLowerCase();
    if (label === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (label === 'zoho billed') return 'bg-sky-50 text-sky-800 border-sky-200';
    if (label === 'not paid' || label === 'pending') {
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
}

/**
 * Company profile → Payment: company-share bills and payments only (no fine list).
 */
export default function CompanyFinesAndPaymentsTab({ company }) {
    const router = useRouter();
    const companyOid = company?._id ? String(company._id) : '';

    const [fines, setFines] = useState([]);
    const [companyPayments, setCompanyPayments] = useState([]);
    const [companyDeductions, setCompanyDeductions] = useState([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [filterStartMonth, setFilterStartMonth] = useState('');
    const [filterEndMonth, setFilterEndMonth] = useState('');
    const [utilityBillById, setUtilityBillById] = useState({});
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    const loadFines = useCallback(async () => {
        if (!companyOid) return;
        try {
            const res = await axiosInstance.get('/Fine', {
                params: { companyId: companyOid, limit: 1000 },
                skipToast: true,
            });
            setFines(res.data?.fines || res.data || []);
        } catch (err) {
            console.error('Error fetching company fines:', err);
            setFines([]);
        }
    }, [companyOid]);

    const loadCompanyPayments = useCallback(async () => {
        setPaymentsLoading(true);
        try {
            const res = await axiosInstance.get('/Payment', {
                params: {
                    employeeId: COMPANY_PARTY_ID,
                    limit: 1000,
                },
                skipToast: true,
            });
            const pays = res.data?.payments || (Array.isArray(res.data) ? res.data : []);
            setCompanyPayments(pays);
        } catch (err) {
            console.error('Error fetching company payments:', err);
            setCompanyPayments([]);
        } finally {
            setPaymentsLoading(false);
        }
    }, []);

    const loadCompanyDeductions = useCallback(async () => {
        if (!companyOid) return;
        try {
            const res = await axiosInstance.get('/Expense', {
                params: { companyId: companyOid },
                skipToast: true,
            });
            setCompanyDeductions(Array.isArray(res.data?.rows) ? res.data.rows : []);
        } catch (err) {
            console.error('Error fetching company payments:', err);
            setCompanyDeductions([]);
        }
    }, [companyOid]);

    useEffect(() => {
        loadFines();
        loadCompanyPayments();
        loadCompanyDeductions();
    }, [loadFines, loadCompanyPayments, loadCompanyDeductions]);

    useEffect(() => {
        const utilityPayments = (companyPayments || []).filter(
            (p) => p.paymentType === 'UtilityBill',
        );
        const billIds = [
            ...new Set(
                utilityPayments
                    .map((p) => String(p.relatedEntityId || p.referenceId || '').trim())
                    .filter(Boolean),
            ),
        ];
        if (!billIds.length) {
            setUtilityBillById({});
            return;
        }
        let cancelled = false;
        Promise.all(
            billIds.map((id) =>
                axiosInstance
                    .get(`/UtilityBill/${id}`, { skipToast: true })
                    .then((res) => [id, res.data?.bill || res.data])
                    .catch(() => [id, null]),
            ),
        ).then((results) => {
            if (cancelled) return;
            const map = {};
            results.forEach(([id, bill]) => {
                if (bill) map[id] = bill;
            });
            setUtilityBillById(map);
        });
        return () => {
            cancelled = true;
        };
    }, [companyPayments]);

    const companyFineIds = useMemo(
        () => new Set(fines.map((f) => String(f.fineId || '')).filter(Boolean)),
        [fines],
    );

    const companyFineMongoIds = useMemo(
        () => new Set(fines.map((f) => String(f._id || '')).filter(Boolean)),
        [fines],
    );

    const paymentsForCompany = useMemo(() => {
        return (companyPayments || []).filter((p) => {
            if (
                !shouldShowPaymentInHistory(p.status) &&
                !isPaymentCountableTowardPaid(p.status)
            ) {
                return false;
            }

            if (p.paymentType === 'Fine') {
                const ref = String(p.referenceId || '');
                const rel = String(p.relatedEntityId || '');
                return (
                    (ref && companyFineIds.has(ref)) ||
                    (rel && companyFineMongoIds.has(rel))
                );
            }

            if (p.paymentType === 'UtilityBill') {
                const billId = String(p.relatedEntityId || p.referenceId || '').trim();
                const bill = utilityBillById[billId];
                return utilityBillBelongsToCompany(bill, company);
            }

            return false;
        });
    }, [companyPayments, companyFineIds, companyFineMongoIds, utilityBillById, company]);

    const monthFilterActive = Boolean(filterStartMonth || filterEndMonth);

    const listRows = useMemo(() => {
        const rows = [];
        const seenFine = new Set();
        const seenUtility = new Set();

        (fines || [])
            .filter((f) => f.fineStatus !== 'Draft')
            .forEach((fine) => {
                const amount = resolveCompanyFinePayableAmount(fine);
                if (!(amount > 0.01)) return;
                const fineKey = String(fine.fineId || fine._id || '');
                if (fineKey) seenFine.add(fineKey);
                const vendorPaid = isZohoPaidStatus(fine.vendorBillStatus);
                const hasZohoBill = Boolean(String(fine.zohoBillId || '').trim());
                rows.push({
                    id: `fine:${fine._id || fine.fineId}`,
                    paymentId: fine.fineId || '—',
                    type: 'Fine',
                    reference: fine.fineId || fine.billNumber || '—',
                    paymentDate: fine.billDate || fine.awardedDate || fine.createdAt,
                    amount,
                    status: vendorPaid ? 'Paid' : hasZohoBill ? 'Not Paid' : 'Not Paid',
                    billLink: fine.fineId || fine._id
                        ? `/HRM/Fine/${encodeURIComponent(fine.fineId || fine._id)}`
                        : '',
                    payment: null,
                });
            });

        (companyDeductions || []).forEach((row) => {
            const kind = String(row.kind || '').toLowerCase();
            if (kind === 'fine') {
                const fineKey = String(row.fineId || row.fineMongoId || '');
                if (fineKey && seenFine.has(fineKey)) return;
                if (fineKey) seenFine.add(fineKey);
            }
            // Company profile lists company-pay items only (Payable To = company).
            if (kind === 'balance') return;
            if (kind === 'utility_share') {
                const billKey = String(row.utilityBillId || '');
                if (billKey) seenUtility.add(billKey);
            }
            const typeLabel =
                kind === 'utility_share'
                    ? 'Utility'
                    : kind === 'service'
                        ? row.utilityType || 'Service'
                        : kind === 'fine'
                          ? 'Fine'
                          : row.kind || 'Payment';
            rows.push({
                id: `exp:${row.id}`,
                paymentId: row.accountNo || row.fineId || row.zohoPaymentNumber || '—',
                type: typeLabel,
                reference: row.utilityBillId || row.fineId || row.description || '—',
                paymentDate: row.billMonth || row.paidAt,
                amount: Number(row.amount) || 0,
                status: companyRowStatus(row),
                billLink: row.billLink || row.paymentLink || '',
                payment: null,
            });
        });

        paymentsForCompany.forEach((pay) => {
            if (pay.paymentType === 'Fine') {
                const ref = String(pay.referenceId || '');
                const rel = String(pay.relatedEntityId || '');
                if ((ref && seenFine.has(ref)) || (rel && seenFine.has(rel))) return;
            }
            if (pay.paymentType === 'UtilityBill') {
                const billId = String(pay.relatedEntityId || pay.referenceId || '').trim();
                if (billId && seenUtility.has(billId)) return;
            }
            rows.push({
                id: `pay:${pay._id}`,
                paymentId: pay.paymentId || '—',
                type: pay.paymentType || 'Payment',
                reference: pay.referenceId || '—',
                paymentDate: pay.paymentDate || pay.createdAt,
                amount: Number(pay.amount) || 0,
                status: companyRowStatus(pay),
                billLink: '',
                payment: pay,
            });
        });

        return rows;
    }, [fines, companyDeductions, paymentsForCompany]);

    const filteredRows = useMemo(
        () => listRows.filter((row) => paymentMatchesMonthRange(row, filterStartMonth, filterEndMonth)),
        [listRows, filterStartMonth, filterEndMonth],
    );

    return (
        <div className="animate-in fade-in duration-500 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 min-h-[400px]">
                <div className="flex flex-col gap-4 mb-4">
                    <div>
                        <h3 className="text-base sm:text-xl font-semibold text-gray-800">Payment</h3>
                        <p className="text-sm text-gray-400 mt-0.5">
                            Company-pay items for {company?.name || 'this company'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        {monthFilterActive ? (
                            <p className="text-xs text-slate-500">
                                Showing {filteredRows.length} of {listRows.length} payment(s) in the
                                selected period
                            </p>
                        ) : (
                            <p className="text-xs text-slate-500">
                                {listRows.length} payment(s) for this company
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Start Month
                            </label>
                            <MonthYearPicker
                                value={filterStartMonth ? `${filterStartMonth}-01` : undefined}
                                onChange={(d) => d && setFilterStartMonth(d.slice(0, 7))}
                                placeholder="From month"
                                className="w-44 h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                End Month
                            </label>
                            <MonthYearPicker
                                value={filterEndMonth ? `${filterEndMonth}-01` : undefined}
                                onChange={(d) => d && setFilterEndMonth(d.slice(0, 7))}
                                placeholder="To month"
                                className="w-44 h-9 text-sm"
                            />
                        </div>
                        {monthFilterActive ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setFilterStartMonth('');
                                    setFilterEndMonth('');
                                }}
                                className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200"
                            >
                                Clear
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/80 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">
                                    Payment ID
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">
                                    Type
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">
                                    Reference
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">
                                    Date
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">
                                    Amount
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-right">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paymentsLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        Loading payments…
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        {listRows.length === 0
                                            ? 'No company payments yet'
                                            : 'No payments match the selected month range'}
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => {
                                    const status = companyRowStatus(row);
                                    return (
                                        <tr
                                            key={row.id}
                                            className={
                                                status === 'Paid'
                                                    ? 'bg-emerald-50/30'
                                                    : 'hover:bg-slate-50/80'
                                            }
                                        >
                                            <td className="px-4 py-3 font-bold text-slate-700">
                                                {row.paymentId || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 capitalize">
                                                {row.type || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                                                {row.reference || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {row.paymentDate
                                                    ? /^\d{4}-\d{2}$/.test(String(row.paymentDate))
                                                        ? row.paymentDate
                                                        : new Date(row.paymentDate).toLocaleDateString(
                                                              'en-GB',
                                                          )
                                                    : '—'}
                                            </td>
                                            <td
                                                className={`px-4 py-3 font-bold ${
                                                    status === 'Paid'
                                                        ? 'text-emerald-700'
                                                        : 'text-slate-800'
                                                }`}
                                            >
                                                AED {formatMoney(row.amount)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight border ${statusBadgeClass(status)}`}
                                                >
                                                    {status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {row.payment ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedInvoice(row.payment)}
                                                        className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
                                                    >
                                                        View Invoice
                                                    </button>
                                                ) : row.billLink ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(row.billLink)}
                                                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                                    >
                                                        Open
                                                    </button>
                                                ) : (
                                                    <span className="text-xs font-semibold text-slate-400">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedInvoice ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-lg font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="text-blue-600" size={20} />
                                Payment Invoice
                            </h3>
                            <button
                                type="button"
                                onClick={() => setSelectedInvoice(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-100/50">
                            <PaymentReceipt payment={selectedInvoice} />
                        </div>
                        <div className="p-6 bg-white border-t border-gray-100 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedInvoice(null)}
                                className="px-8 py-3 bg-gray-100 text-gray-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-gray-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
