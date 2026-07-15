'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { ArrowLeft, Check, Plus, Receipt, X } from 'lucide-react';
import {
    DETAIL_PAIR_COLUMN,
    DETAIL_PAIR_GRID,
    HEADER_PAIR_CARD_FIXED,
    HEADER_PAIR_GRID,
} from '@/utils/headerPairLayout';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    buildDetailFieldRows,
    getMonthlyRentalAmount,
    getUtilityConfigForType,
    getUtilityEntryById,
} from '../../utils/utilityBillsStorage';
import FieldViewModal from '../../components/FieldViewModal';
import AddBillModal from '../../components/AddBillModal';
import HrApproveBillModal from '../../components/HrApproveBillModal';
import { invalidateAssetPendingInbox } from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { clearModuleNotificationFeedsCache } from '@/utils/moduleNotifications';

const MAX_INLINE_LEN = 48;

function paymentByLabel(mode) {
    if (mode === 'employee_balance') return 'Balance pay by employee';
    if (mode === 'company') return 'Pay by company';
    return 'Awaiting HR';
}

function statusBadgeClass(status) {
    const s = String(status || '');
    if (s === 'Pending HR') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (s === 'Approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
}

/**
 * Utility entry details — header cards, tabs, 1/2 type details + bills list with HR approval.
 */
export default function UtilityBillDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const entryId = params?.id ? String(params.id) : '';

    const [entry, setEntry] = useState(null);
    const [utilityConfig, setUtilityConfig] = useState(null);
    const [bills, setBills] = useState([]);
    const [loadingBills, setLoadingBills] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewFields, setViewFields] = useState([]);
    const [addBillOpen, setAddBillOpen] = useState(false);
    const [savingBill, setSavingBill] = useState(false);
    const [respondingId, setRespondingId] = useState('');
    const [approveBill, setApproveBill] = useState(null);

    const focusBillId = searchParams?.get('billId') || '';

    useEffect(() => {
        if (!entryId) return;
        const found = getUtilityEntryById(entryId);
        setEntry(found);
        if (found) {
            setUtilityConfig(getUtilityConfigForType(found.type));
        }
    }, [entryId]);

    const loadBills = useCallback(async () => {
        if (!entryId) return;
        setLoadingBills(true);
        try {
            const res = await axiosInstance.get('/UtilityBill', {
                params: { entryId },
                skipToast: true,
            });
            setBills(Array.isArray(res.data?.bills) ? res.data.bills : []);
        } catch {
            setBills([]);
        } finally {
            setLoadingBills(false);
        }
    }, [entryId]);

    useEffect(() => {
        loadBills();
    }, [loadBills]);

    useEffect(() => {
        if (focusBillId) setActiveTab('overview');
    }, [focusBillId]);

    useEffect(() => {
        if (!focusBillId || !bills.length) return;
        const el = document.getElementById(`bill-${focusBillId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [focusBillId, bills]);

    const detailRows = useMemo(
        () => (entry ? buildDetailFieldRows(entry, utilityConfig) : []),
        [entry, utilityConfig],
    );

    const monthlyRental = getMonthlyRentalAmount(entry);

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'bills', label: 'Bills' },
    ];

    const handleAddBill = async (payload) => {
        if (!entry) return;
        setSavingBill(true);
        try {
            const res = await axiosInstance.post('/UtilityBill', {
                entryId: entry.id,
                utilityType: entry.type,
                amount: payload.amount,
                monthlyRental,
                billMonth: payload.billMonth,
                notes: payload.notes,
                sendForHr: payload.sendForHr,
            });
            toast({
                title: res.data?.sentToHr ? 'Sent to HR' : 'Bill saved',
                description: res.data?.sentToHr
                    ? 'HR received an email and dashboard task for approval.'
                    : 'Bill stored successfully.',
            });
            setAddBillOpen(false);
            if (res.data?.sentToHr) {
                invalidateAssetPendingInbox('tools');
                clearModuleNotificationFeedsCache();
            }
            await loadBills();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not save bill',
                description: err?.response?.data?.message || 'Please try again.',
            });
        } finally {
            setSavingBill(false);
        }
    };

    const handleRespond = async (billId, decision, paymentBy = null) => {
        setRespondingId(billId);
        try {
            const body = { decision };
            if (decision === 'approve') body.paymentBy = paymentBy;
            await axiosInstance.put(`/UtilityBill/${billId}/respond`, body);
            toast({
                title: decision === 'approve' ? 'Approved' : 'Rejected',
                description:
                    decision === 'approve'
                        ? 'Bill stored. Task completed on dashboard.'
                        : 'Bill deleted. Requester was emailed.',
            });
            setApproveBill(null);
            invalidateAssetPendingInbox('tools');
            clearModuleNotificationFeedsCache();
            await loadBills();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Action failed',
                description: err?.response?.data?.message || 'Please try again.',
            });
        } finally {
            setRespondingId('');
        }
    };

    const renderDetailFields = () => {
        if (detailRows.length === 0) {
            return <p className="text-sm text-slate-400 px-5 py-4">No fields configured for this utility.</p>;
        }

        return (
            <div className="px-5 pb-4">
                {detailRows.map((row, idx, arr) => {
                    const text = String(row.value ?? '').trim();
                    const hasValue = text !== '' && text !== '—';
                    const display = hasValue ? text.replace(/\s+/g, ' ') : '';
                    const tooLong = hasValue && (display.length > MAX_INLINE_LEN || String(row.value).includes('\n'));

                    return (
                        <div
                            key={row.key}
                            className={`flex items-center justify-between gap-3 py-3 ${
                                idx !== arr.length - 1 ? 'border-b border-slate-100' : ''
                            }`}
                        >
                            <span className="text-[13px] text-slate-500 shrink-0">{row.label}</span>
                            <span className="text-[13px] font-semibold text-slate-700 max-w-[62%] text-right flex items-center justify-end gap-2 min-w-0">
                                {hasValue ? (
                                    <>
                                        <span className="truncate">{display}</span>
                                        {tooLong ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewFields([row]);
                                                    setViewModalOpen(true);
                                                }}
                                                className="shrink-0 text-[12px] font-semibold text-blue-600 hover:text-blue-700"
                                            >
                                                View
                                            </button>
                                        ) : null}
                                    </>
                                ) : (
                                    <span className="text-slate-300 font-semibold">—</span>
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderBillsHeader = () => (
        <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h3 className="text-base font-bold text-slate-800">Bills</h3>
            <button
                type="button"
                onClick={() => setAddBillOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold"
            >
                <Plus size={14} />
                Add Bills
            </button>
        </div>
    );

    const renderBillsList = () => (
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
            {loadingBills ? (
                <p className="text-sm text-slate-400 py-6 text-center">Loading bills…</p>
            ) : bills.length === 0 ? (
                <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 bg-white/60">
                    <p className="text-sm text-slate-400">No bills yet. Click Add Bills to create one.</p>
                </div>
            ) : (
                <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
                    {bills.map((bill) => {
                        const over = Number(bill.amount) > monthlyRental;
                        const focused = String(bill._id) === String(focusBillId);
                        const pending = bill.status === 'Pending HR';
                        const amountTxt = `${Number(bill.amount || 0).toLocaleString('en-AE', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })} AED`;

                        return (
                            <div
                                key={bill._id}
                                id={`bill-${bill._id}`}
                                className={`rounded-2xl border shadow-sm bg-white px-4 py-3 ${
                                    focused
                                        ? 'border-teal-300 ring-1 ring-teal-200'
                                        : 'border-slate-100'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3 mb-1">
                                    <span className="text-[13px] text-slate-500">
                                        {bill.billMonth || 'Bill'}
                                    </span>
                                    <span
                                        className={`text-[13px] font-semibold tabular-nums ${
                                            over ? 'text-red-600' : 'text-slate-700'
                                        }`}
                                    >
                                        {amountTxt}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[12px] text-slate-400">
                                        {bill.status === 'Approved'
                                            ? paymentByLabel(bill.paymentBy)
                                            : pending
                                              ? 'Payment by: set on HR approve'
                                              : paymentByLabel(bill.paymentBy)}
                                        {bill.createdAt
                                            ? ` · ${new Date(bill.createdAt).toLocaleDateString('en-GB')}`
                                            : ''}
                                    </span>
                                    <span
                                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusBadgeClass(bill.status)}`}
                                    >
                                        {bill.status}
                                    </span>
                                </div>
                                {bill.status === 'Approved' && bill.paymentBy === 'employee_balance' ? (
                                    <p className="text-[12px] text-slate-500 mt-1.5 text-right">
                                        Company {Number(bill.companyPayAmount || 0).toLocaleString()} AED · Employee{' '}
                                        {Number(bill.employeePayAmount || 0).toLocaleString()} AED
                                    </p>
                                ) : null}
                                {pending ? (
                                    <div className="flex flex-wrap justify-end gap-2 mt-2">
                                        <button
                                            type="button"
                                            disabled={respondingId === bill._id}
                                            onClick={() => setApproveBill(bill)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
                                        >
                                            <Check size={13} />
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            disabled={respondingId === bill._id}
                                            onClick={() => handleRespond(bill._id, 'reject')}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50"
                                        >
                                            <X size={13} />
                                            Reject
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    if (!entry) {
        return (
            <div className="flex min-h-screen" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <div className="p-6 text-center">
                        <p className="text-gray-600 mb-4">Utility record not found on this device.</p>
                        <button
                            type="button"
                            onClick={() => router.push('/HRM/Asset/UtilityBills')}
                            className="text-teal-600 font-semibold text-sm"
                        >
                            Back to Utility Bills
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                        <div className="min-w-0">
                            <button
                                type="button"
                                onClick={() => router.push('/HRM/Asset/UtilityBills')}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-teal-700 mb-2"
                            >
                                <ArrowLeft size={14} />
                                Utility Bills
                            </button>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
                                <Receipt className="shrink-0 text-slate-500" size={26} strokeWidth={1.75} />
                                {entry.type} Details
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                {entry.assignedTo
                                    ? `Assigned to ${entry.assignedToType === 'Company' ? 'company' : 'employee'}: ${entry.assignedTo}`
                                    : 'Utility account details and bills'}
                            </p>
                        </div>
                    </div>

                    <div className={HEADER_PAIR_GRID}>
                        <div
                            className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_FIXED}`}
                        >
                            <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest shrink-0">
                                Utility Overview
                            </h3>
                        </div>
                        <div
                            className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_FIXED}`}
                        >
                            <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest shrink-0">
                                Amount Summary
                            </h3>
                        </div>
                    </div>

                    <div className="mb-4 sm:mb-6">
                        <div className="flex items-center gap-1 p-1 bg-slate-100/50 rounded-2xl border border-slate-100 w-full sm:w-auto overflow-x-auto">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-white text-teal-700 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeTab === 'overview' ? (
                        <div className={DETAIL_PAIR_GRID}>
                            <div className={DETAIL_PAIR_COLUMN}>
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full">
                                    <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                        <h3 className="text-base font-bold text-slate-800">
                                            {entry.type} Details
                                        </h3>
                                    </div>
                                    {renderDetailFields()}
                                </div>
                            </div>
                            {/* Absolute fill so bills match left card height and scroll instead of growing the page */}
                            <div className={`${DETAIL_PAIR_COLUMN} relative min-h-[320px] lg:min-h-0`}>
                                <div className="flex flex-col min-h-0 max-h-[420px] lg:max-h-none lg:absolute lg:inset-0">
                                    {renderBillsHeader()}
                                    {renderBillsList()}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col min-h-0 max-h-[min(70vh,640px)]">
                            {renderBillsHeader()}
                            {renderBillsList()}
                        </div>
                    )}
                </div>
            </div>

            <FieldViewModal
                isOpen={viewModalOpen}
                onClose={() => setViewModalOpen(false)}
                title={`${entry.type} Details`}
                fields={viewFields.length ? viewFields : detailRows}
            />

            <AddBillModal
                isOpen={addBillOpen}
                onClose={() => setAddBillOpen(false)}
                monthlyRental={monthlyRental}
                utilityType={entry.type}
                onSubmit={handleAddBill}
                saving={savingBill}
            />

            <HrApproveBillModal
                isOpen={Boolean(approveBill)}
                onClose={() => setApproveBill(null)}
                bill={approveBill}
                saving={Boolean(approveBill && respondingId === approveBill._id)}
                onConfirm={({ paymentBy }) =>
                    handleRespond(approveBill._id, 'approve', paymentBy)
                }
            />
        </div>
    );
}
