'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    ChevronDown,
    ChevronRight,
    ExternalLink,
    FileText,
    History,
    Plus,
    Wallet,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { fineMatchesDeductionMonthRange } from '@/app/HRM/Fine/utils/fineScheduleUtils';
import FineFlowManager from '@/app/HRM/Fine/components/FineFlowManager';
import PaymentReceipt from '@/app/Accounts/Payments/components/PaymentReceipt';
import {
    getPaymentAmountTextClass,
    getPaymentStatusBadgeClass,
    getPaymentStatusLabel,
    getPaymentStatusSurfaceClass,
    isPaymentCountableTowardPaid,
    shouldShowPaymentInHistory,
} from '@/utils/paymentStatusDisplay';
import { resolveCompanyFinePayableAmount } from '@/utils/finePayableAmount';
import { crudAccess, isAdmin } from '@/utils/permissions';

const COMPANY_PARTY_ID = 'VEGA-HR-0000';

const PAYABLE_FINE_STATUSES = ['Approved', 'Active', 'Completed', 'Paid'];

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function paymentMatchesMonthRange(payment, startMonth, endMonth) {
    if (!startMonth && !endMonth) return true;
    const raw = payment?.paymentDate || payment?.createdAt;
    if (!raw) return false;
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
    const billCompanyId = String(bill.payByCompanyId || '').trim();
    const billCompanyName = String(bill.payByCompanyName || '').trim().toLowerCase();
    if (companyOid && billCompanyId === companyOid) return true;
    if (companyBusinessId && billCompanyId === companyBusinessId) return true;
    if (companyName && billCompanyName && billCompanyName === companyName) return true;
    return false;
}

/**
 * Company profile → Fines and Payment: list company fines, Add Fine, company-share
 * payments (VEGA-HR-0000), expand history, Pay selected.
 */
export default function CompanyFinesAndPaymentsTab({ company }) {
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();

    const companyOid = company?._id ? String(company._id) : '';
    const canAddFine = isAdmin() || crudAccess('hrm_fine').create || crudAccess('hrm_fine_add').create;
    const canPay = true; // Pay uses Accounts Payments prefill (same as employee Salary → Fine)

    const [fines, setFines] = useState([]);
    const [companyPayments, setCompanyPayments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState('fines');
    const [filterStartMonth, setFilterStartMonth] = useState('');
    const [filterEndMonth, setFilterEndMonth] = useState('');
    const [utilityBillById, setUtilityBillById] = useState({});
    const [expandedFineId, setExpandedFineId] = useState(null);
    const [finePayments, setFinePayments] = useState([]);
    const [loadingFinePayments, setLoadingFinePayments] = useState(false);
    const [selectedFineKeys, setSelectedFineKeys] = useState([]);
    const [showAddFine, setShowAddFine] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    const loadFines = useCallback(async () => {
        if (!companyOid) return;
        setLoading(true);
        try {
            const res = await axiosInstance.get('/Fine', {
                params: { companyId: companyOid, limit: 1000 },
                skipToast: true,
            });
            setFines(res.data?.fines || res.data || []);
        } catch (err) {
            console.error('Error fetching company fines:', err);
            setFines([]);
        } finally {
            setLoading(false);
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

    useEffect(() => {
        loadFines();
        loadCompanyPayments();
    }, [loadFines, loadCompanyPayments, reloadKey]);

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

    useEffect(() => {
        if (!showAddFine) return;
        axiosInstance
            .get('/Employee', { params: { limit: 2000 }, skipToast: true })
            .then((res) => {
                setEmployees(res.data?.employees || res.data || []);
            })
            .catch(() => setEmployees([]));
    }, [showAddFine]);

    const companyFineIds = useMemo(
        () => new Set(fines.map((f) => String(f.fineId || '')).filter(Boolean)),
        [fines],
    );

    const companyFineMongoIds = useMemo(
        () => new Set(fines.map((f) => String(f._id || '')).filter(Boolean)),
        [fines],
    );

    /** Company-share payments: fines for this company and asset bills paid on its behalf. */
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

    const getCompanyShare = (fine) => resolveCompanyFinePayableAmount(fine);

    const getPaidForFine = (fine) => {
        const fid = String(fine.fineId || '');
        const oid = String(fine._id || '');
        return paymentsForCompany
            .filter(
                (p) =>
                    isPaymentCountableTowardPaid(p.status) &&
                    (p.referenceId === fid || String(p.relatedEntityId || '') === oid),
            )
            .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    };

    const getBalanceForFine = (fine) =>
        Math.max(0, getCompanyShare(fine) - getPaidForFine(fine));

    const companyFines = useMemo(
        () => (fines || []).filter((f) => f.fineStatus !== 'Draft'),
        [fines],
    );

    const monthFilterActive = Boolean(filterStartMonth || filterEndMonth);

    const filteredFines = useMemo(
        () =>
            companyFines.filter((f) =>
                fineMatchesDeductionMonthRange(f, filterStartMonth, filterEndMonth),
            ),
        [companyFines, filterStartMonth, filterEndMonth],
    );

    const filteredPayments = useMemo(
        () =>
            paymentsForCompany.filter((p) =>
                paymentMatchesMonthRange(p, filterStartMonth, filterEndMonth),
            ),
        [paymentsForCompany, filterStartMonth, filterEndMonth],
    );

    const payableFines = useMemo(
        () =>
            filteredFines.filter(
                (f) =>
                    PAYABLE_FINE_STATUSES.includes(f.fineStatus) &&
                    getBalanceForFine(f) > 0.01 &&
                    getCompanyShare(f) > 0.01,
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [filteredFines, paymentsForCompany],
    );

    const selectedPayable = useMemo(
        () =>
            payableFines.filter((f) =>
                selectedFineKeys.includes(String(f.fineId || f._id)),
            ),
        [payableFines, selectedFineKeys],
    );

    const selectedTotalBalance = useMemo(
        () => selectedPayable.reduce((s, f) => s + getBalanceForFine(f), 0),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedPayable, paymentsForCompany],
    );

    const toggleExpand = async (rowKey, fineId) => {
        if (expandedFineId === rowKey) {
            setExpandedFineId(null);
            setFinePayments([]);
            return;
        }
        setExpandedFineId(rowKey);
        setLoadingFinePayments(true);
        try {
            const res = await axiosInstance.get('/Payment', {
                params: {
                    relatedEntityType: 'Fine',
                    referenceId: fineId,
                    employeeId: COMPANY_PARTY_ID,
                },
                skipToast: true,
            });
            const fetched = res.data?.payments || res.data || [];
            setFinePayments(fetched.filter((p) => shouldShowPaymentInHistory(p.status)));
        } catch (err) {
            console.error(err);
            setFinePayments([]);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to load payment history.',
            });
        } finally {
            setLoadingFinePayments(false);
        }
    };

    const handlePaySelected = () => {
        if (!selectedPayable.length) {
            toast({
                variant: 'destructive',
                title: 'No fines selected',
                description: 'Select one or more company fines with an outstanding balance.',
            });
            return;
        }
        const payload = {
            employeeId: COMPANY_PARTY_ID,
            returnTo: `${pathname}${typeof window !== 'undefined' ? window.location.search : ''}`,
            companyId: companyOid,
            companyName: company?.name || '',
            fines: selectedPayable.map((f) => ({
                _id: f._id,
                fineId: f.fineId,
                fineAmount: f.fineAmount,
                balance: getBalanceForFine(f),
                employeeShare: getCompanyShare(f),
                paidAmount: getPaidForFine(f),
                monthStart: f.monthStart,
                payableDuration: f.payableDuration,
                assignedEmployees: f.assignedEmployees,
                fineType: f.fineType,
                category: f.category,
                serviceCharge: f.serviceCharge,
                companyAmount: f.companyAmount,
                employeeAmount: f.employeeAmount,
                responsibleFor: f.responsibleFor,
            })),
        };
        sessionStorage.setItem('finePaymentPrefill', JSON.stringify(payload));
        router.push('/Accounts/Payments?addFinePay=1');
    };

    const statusColors = {
        Pending: 'bg-yellow-100 text-yellow-700',
        'Pending HR': 'bg-orange-100 text-orange-700',
        'Pending Accounts': 'bg-blue-100 text-blue-700',
        'Pending Authorization': 'bg-purple-100 text-purple-700',
        Approved: 'bg-green-100 text-green-700',
        Active: 'bg-emerald-100 text-emerald-700',
        Completed: 'bg-teal-100 text-teal-700',
        Paid: 'bg-gray-100 text-gray-700',
        Rejected: 'bg-red-100 text-red-700',
        Cancelled: 'bg-slate-100 text-slate-700',
        Draft: 'bg-gray-100 text-gray-500',
    };

    return (
        <div className="animate-in fade-in duration-500 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 min-h-[400px]">
                <div className="flex flex-col gap-4 mb-4">
                    <div>
                        <h3 className="text-base sm:text-xl font-semibold text-gray-800">
                            Fines and Payment
                        </h3>
                        <p className="text-sm text-gray-400 mt-0.5">
                            Company fines and payments for {company?.name || 'this company'}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-6 border-b border-gray-100 pb-1">
                        {[
                            { id: 'fines', label: 'Fines' },
                            { id: 'payments', label: 'Payments' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveSubTab(tab.id)}
                                className={`pb-2 text-sm font-semibold tracking-tight transition-all relative whitespace-nowrap ${
                                    activeSubTab === tab.id
                                        ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        {monthFilterActive ? (
                            <p className="text-xs text-slate-500">
                                {activeSubTab === 'fines'
                                    ? `Showing ${filteredFines.length} of ${companyFines.length} fine(s) in the selected period`
                                    : `Showing ${filteredPayments.length} of ${paymentsForCompany.length} payment(s) in the selected period`}
                            </p>
                        ) : (
                            <p className="text-xs text-slate-500">
                                {activeSubTab === 'fines'
                                    ? `${companyFines.length} fine(s) · draft excluded`
                                    : `${paymentsForCompany.length} payment(s) for fines and assets`}
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
                        {activeSubTab === 'fines' && canAddFine ? (
                            <button
                                type="button"
                                onClick={() => setShowAddFine(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
                            >
                                <Plus size={14} />
                                Add Fine
                            </button>
                        ) : null}
                        {activeSubTab === 'fines' && canPay && selectedPayable.length > 0 ? (
                            <button
                                type="button"
                                onClick={handlePaySelected}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                            >
                                <Wallet size={14} />
                                Pay · AED {formatMoney(selectedTotalBalance)}
                            </button>
                        ) : null}
                    </div>
                </div>

                {activeSubTab === 'fines' ? (
                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/80 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded text-emerald-600"
                                        checked={
                                            payableFines.length > 0 &&
                                            payableFines.every((f) =>
                                                selectedFineKeys.includes(
                                                    String(f.fineId || f._id),
                                                ),
                                            )
                                        }
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedFineKeys(
                                                    payableFines.map((f) =>
                                                        String(f.fineId || f._id),
                                                    ),
                                                );
                                            } else {
                                                setSelectedFineKeys([]);
                                            }
                                        }}
                                        title="Select all payable"
                                    />
                                </th>
                                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Fine ID
                                </th>
                                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Company Share
                                </th>
                                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Paid
                                </th>
                                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Balance
                                </th>
                                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 text-gray-300">
                                            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-sm font-semibold text-gray-400">
                                                Loading fines…
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredFines.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">
                                                <FileText size={28} className="text-gray-300" />
                                            </div>
                                            <span className="text-sm font-semibold text-gray-400">
                                                {companyFines.length === 0
                                                    ? 'No company fines for this company'
                                                    : 'No fines match the selected month range'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredFines.map((fine, idx) => {
                                    const rowKey = fine._id || idx;
                                    const fineKey = String(fine.fineId || fine._id);
                                    const share = getCompanyShare(fine);
                                    const paid = getPaidForFine(fine);
                                    const balance = getBalanceForFine(fine);
                                    const canSelect = balance > 0.01 && share > 0.01;
                                    const isExpanded = expandedFineId === rowKey;
                                    const statusClass =
                                        statusColors[fine.fineStatus] ||
                                        'bg-blue-100 text-blue-600';

                                    return (
                                        <React.Fragment key={fineKey || rowKey}>
                                            <tr
                                                className={`hover:bg-blue-50/20 transition-colors cursor-pointer ${
                                                    isExpanded ? 'bg-blue-50/30' : ''
                                                }`}
                                                onClick={() =>
                                                    toggleExpand(rowKey, fine.fineId)
                                                }
                                            >
                                                <td
                                                    className="px-4 py-4"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded text-emerald-600 disabled:opacity-40"
                                                        disabled={!canSelect}
                                                        checked={selectedFineKeys.includes(
                                                            fineKey,
                                                        )}
                                                        onChange={(e) => {
                                                            setSelectedFineKeys((prev) =>
                                                                e.target.checked
                                                                    ? [
                                                                          ...new Set([
                                                                              ...prev,
                                                                              fineKey,
                                                                          ]),
                                                                      ]
                                                                    : prev.filter(
                                                                          (k) => k !== fineKey,
                                                                      ),
                                                            );
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {isExpanded ? (
                                                            <ChevronDown
                                                                size={14}
                                                                className="text-blue-500"
                                                            />
                                                        ) : (
                                                            <ChevronRight
                                                                size={14}
                                                                className="text-gray-400"
                                                            />
                                                        )}
                                                        <span className="text-sm font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                                                            {fine.fineId || '—'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-600 capitalize">
                                                    {fine.fineType || fine.subCategory || '—'}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-bold text-emerald-700">
                                                    AED {formatMoney(share)}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-bold text-emerald-600">
                                                    AED {formatMoney(paid)}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-bold text-rose-600">
                                                    AED {formatMoney(balance)}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClass}`}
                                                    >
                                                        {fine.fineStatus || 'Pending'}
                                                    </span>
                                                </td>
                                                <td
                                                    className="px-4 py-4 text-right"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            router.push(
                                                                `/HRM/Fine/${encodeURIComponent(
                                                                    fine.fineId || fine._id,
                                                                )}`,
                                                            )
                                                        }
                                                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"
                                                        title="Open fine details"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                            {isExpanded ? (
                                                <tr>
                                                    <td
                                                        colSpan={8}
                                                        className="bg-gray-50/50 p-4"
                                                    >
                                                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <History
                                                                        size={14}
                                                                        className="text-blue-500"
                                                                    />
                                                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                                        Company Payment Receipts
                                                                    </h4>
                                                                </div>
                                                            </div>
                                                            {loadingFinePayments ? (
                                                                <div className="p-8 text-center text-xs text-gray-400 font-bold">
                                                                    Loading receipts…
                                                                </div>
                                                            ) : finePayments.length === 0 ? (
                                                                <div className="p-8 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                                                                    No company payments for this
                                                                    fine yet.
                                                                </div>
                                                            ) : (
                                                                <table className="w-full text-left text-sm">
                                                                    <thead>
                                                                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                                            <th className="px-4 py-2">
                                                                                Receipt No
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Date
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Amount
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Status
                                                                            </th>
                                                                            <th className="px-4 py-2 text-right">
                                                                                Action
                                                                            </th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {finePayments.map(
                                                                            (pay) => (
                                                                                <tr
                                                                                    key={pay._id}
                                                                                    className={`border-b border-slate-50 ${getPaymentStatusSurfaceClass(pay.status)}`}
                                                                                >
                                                                                    <td className="px-4 py-3 font-bold text-slate-700">
                                                                                        {
                                                                                            pay.paymentId
                                                                                        }
                                                                                    </td>
                                                                                    <td className="px-4 py-3 text-slate-500">
                                                                                        {new Date(
                                                                                            pay.paymentDate ||
                                                                                                pay.createdAt,
                                                                                        ).toLocaleDateString(
                                                                                            'en-GB',
                                                                                        )}
                                                                                    </td>
                                                                                    <td
                                                                                        className={`px-4 py-3 font-black ${getPaymentAmountTextClass(pay.status)}`}
                                                                                    >
                                                                                        AED{' '}
                                                                                        {formatMoney(
                                                                                            pay.amount,
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="px-4 py-3">
                                                                                        <span
                                                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight border ${getPaymentStatusBadgeClass(pay.status)}`}
                                                                                        >
                                                                                            {getPaymentStatusLabel(
                                                                                                pay.status,
                                                                                            )}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-4 py-3 text-right">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() =>
                                                                                                setSelectedInvoice(
                                                                                                    pay,
                                                                                                )
                                                                                            }
                                                                                            className="text-blue-600 hover:text-blue-700 font-bold text-[10px] uppercase tracking-widest"
                                                                                        >
                                                                                            View
                                                                                            Invoice
                                                                                        </button>
                                                                                    </td>
                                                                                </tr>
                                                                            ),
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                ) : (
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
                            ) : filteredPayments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        {paymentsForCompany.length === 0
                                            ? 'No company payments yet'
                                            : 'No payments match the selected month range'}
                                    </td>
                                </tr>
                            ) : (
                                filteredPayments.map((pay) => (
                                    <tr
                                        key={pay._id}
                                        className={`hover:bg-slate-50/80 ${getPaymentStatusSurfaceClass(pay.status)}`}
                                    >
                                        <td className="px-4 py-3 font-bold text-slate-700">
                                            {pay.paymentId || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 capitalize">
                                            {pay.paymentType || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                                            {pay.referenceId || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">
                                            {pay.paymentDate || pay.createdAt
                                                ? new Date(
                                                      pay.paymentDate || pay.createdAt,
                                                  ).toLocaleDateString('en-GB')
                                                : '—'}
                                        </td>
                                        <td
                                            className={`px-4 py-3 font-bold ${getPaymentAmountTextClass(pay.status)}`}
                                        >
                                            AED {formatMoney(pay.amount)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight border ${getPaymentStatusBadgeClass(pay.status)}`}
                                            >
                                                {getPaymentStatusLabel(pay.status)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedInvoice(pay)}
                                                className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
                                            >
                                                View Invoice
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                )}
            </div>

            <FineFlowManager
                isOpen={showAddFine}
                onClose={() => setShowAddFine(false)}
                onSuccess={() => {
                    setShowAddFine(false);
                    setReloadKey((k) => k + 1);
                    toast({
                        title: 'Fine submitted',
                        description: 'Company fines list will refresh.',
                    });
                }}
                employees={employees}
            />

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
