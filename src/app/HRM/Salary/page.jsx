'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, Loader2, Bell } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import { HEADER_PAIR_CARD_DASHBOARD, HEADER_PAIR_GRID } from '@/utils/headerPairLayout';
import axiosInstance from '@/utils/axios';
import { isAdmin } from '@/utils/permissions';
import { useToast } from '@/hooks/use-toast';
import NavButton from '@/components/NavButton';
import SalaryEnrollmentOverviewCard from './components/SalaryEnrollmentOverviewCard';
import SalaryHeaderActions from './components/SalaryHeaderActions';
import PendingSalaryRequestsModal from './components/PendingSalaryRequestsModal';
import { fetchSalaryPendingInbox } from '@/utils/pendingInboxFetch';
import {
    SALARY_PENDING_INBOX_CHANGED,
    countVisibleSalaryPendingInbox,
} from './utils/salaryPendingInboxCount';

function formatAed(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const MONTH_ROW_GRID =
    'grid w-full min-w-[640px] items-center gap-x-2 sm:gap-x-3 ' +
    'grid-cols-[2.25rem_minmax(7.5rem,1.1fr)_minmax(4.5rem,0.7fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_3.25rem_4.25rem]';

const COLUMNS = [
    { key: 'slNo', label: 'SL', className: 'text-left' },
    { key: 'month', label: 'Month', className: 'text-left' },
    { key: 'enrollUser', label: 'Enroll User', className: 'text-left' },
    { key: 'monthlySalary', label: 'Monthly Salary', className: 'text-left' },
    { key: 'actualSalary', label: 'Actual Salary', className: 'text-left' },
    { key: 'basicSalary', label: 'Basic Salary', className: 'text-left' },
    { key: 'ot', label: 'OT', className: 'text-left text-[9px] font-semibold tracking-normal', compact: true },
    { key: 'deduction', label: 'Deduction', className: 'text-left text-[9px] font-semibold tracking-normal', compact: true },
];

export default function SalaryPage() {
    const { toast } = useToast();
    const [months, setMonths] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [enrollmentOverview, setEnrollmentOverview] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [addingMonth, setAddingMonth] = useState(false);
    const [hiddenMonthCount, setHiddenMonthCount] = useState(0);
    const [pendingInboxCount, setPendingInboxCount] = useState(0);
    const [pendingInboxModalOpen, setPendingInboxModalOpen] = useState(false);
    const canDeleteMonth = isAdmin();

    const fetchRegister = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get('/Employee/salary-register', { skipToast: true });
            const list = Array.isArray(response.data?.months) ? response.data.months : [];
            setMonths(list);
            setEnrollmentOverview(response.data?.enrollmentOverview || null);
            setHiddenMonthCount(Number(response.data?.hiddenMonthCount) || 0);
        } catch (err) {
            setMonths([]);
            setEnrollmentOverview(null);
            setHiddenMonthCount(0);
            setError(err?.response?.data?.message || err.message || 'Failed to load salary.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRegister();
    }, [fetchRegister]);

    const fetchPendingInboxCount = useCallback(async ({ force = false } = {}) => {
        try {
            const items = await fetchSalaryPendingInbox(axiosInstance, {
                skipToast: true,
                force,
            });
            setPendingInboxCount(countVisibleSalaryPendingInbox(items));
        } catch {
            setPendingInboxCount(0);
        }
    }, []);

    useEffect(() => {
        fetchPendingInboxCount();
        const refresh = () => fetchPendingInboxCount({ force: true });
        if (typeof window !== 'undefined') {
            window.addEventListener(SALARY_PENDING_INBOX_CHANGED, refresh);
        }
        if (typeof document !== 'undefined') {
            document.addEventListener(SALARY_PENDING_INBOX_CHANGED, refresh);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(SALARY_PENDING_INBOX_CHANGED, refresh);
            }
            if (typeof document !== 'undefined') {
                document.removeEventListener(SALARY_PENDING_INBOX_CHANGED, refresh);
            }
        };
    }, [fetchPendingInboxCount]);

    async function confirmDeleteMonth() {
        if (!pendingDelete?.monthKey) return;
        setDeleting(true);
        try {
            await axiosInstance.delete(`/Employee/salary-register/${pendingDelete.monthKey}`);
            toast({ title: `${pendingDelete.month} removed` });
            setPendingDelete(null);
            await fetchRegister();
        } catch (err) {
            toast({
                title: 'Could not delete month',
                description: err?.response?.data?.message || 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setDeleting(false);
        }
    }

    async function addDemoMonth() {
        setAddingMonth(true);
        try {
            await axiosInstance.post('/Employee/salary-register/restore', {});
            toast({ title: 'Salary month added' });
            await fetchRegister();
        } catch (err) {
            toast({
                title: 'Could not add month',
                description: err?.response?.data?.message || 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setAddingMonth(false);
        }
    }

    return (
        <PermissionGuard
            moduleId="hrm_salary"
            moduleIds={['hrm_salary', 'hrm_employees_view_salary', 'hrm']}
            permissionType="view"
        >
            <div
                className="flex min-h-screen w-full max-w-full overflow-x-hidden"
                style={{ backgroundColor: '#F2F6F9' }}
            >
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div
                        className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden"
                        style={{ backgroundColor: '#F2F6F9' }}
                    >
                        <ErpPageHeader title="Salary">
                            <button
                                type="button"
                                onClick={() => setPendingInboxModalOpen(true)}
                                className="relative p-1.5 sm:p-2 hover:bg-amber-50 rounded-lg transition-colors bg-white shadow-sm border border-amber-200/80 text-amber-800 shrink-0"
                                title="Salary notifications"
                            >
                                <Bell size={20} />
                                {pendingInboxCount > 0 ? (
                                    <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-black leading-none flex items-center justify-center border-2 border-white shadow-sm tabular-nums">
                                        {pendingInboxCount > 99 ? '99+' : pendingInboxCount}
                                    </span>
                                ) : null}
                            </button>
                            <SalaryHeaderActions enrollLabel="Salary Enrollment" />
                        </ErpPageHeader>

                        <div className={HEADER_PAIR_GRID}>
                            <SalaryEnrollmentOverviewCard overview={enrollmentOverview} />
                            <div
                                className={`bg-white rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                            />
                        </div>

                        {error ? (
                            <ErpErrorBanner className="mb-4" message={error} onRetry={fetchRegister} />
                        ) : null}

                        <div className="w-full max-w-full overflow-x-auto">
                            <div className="min-w-[640px]">
                                <div className={`${MONTH_ROW_GRID} px-3 sm:px-4 py-2 text-gray-700`}>
                                    {COLUMNS.map((col) => (
                                        <span
                                            key={col.key}
                                            className={
                                                col.compact
                                                    ? 'text-[9px] font-semibold tracking-normal text-gray-600'
                                                    : `text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${col.className}`
                                            }
                                        >
                                            {col.label}
                                        </span>
                                    ))}
                                </div>

                                {loading ? (
                                    <div className="rounded-xl border border-gray-100 bg-white px-4 py-8 text-center text-xs text-gray-500 sm:text-sm">
                                        Loading salary...
                                    </div>
                                ) : months.length === 0 ? (
                                    <div className="rounded-xl border border-gray-100 bg-white px-4 py-8 text-center text-xs text-gray-500 sm:text-sm">
                                        {hiddenMonthCount > 0 ? (
                                            <>
                                                <p>Salary months were removed from this list.</p>
                                                {canDeleteMonth ? (
                                                    <button
                                                        type="button"
                                                        disabled={addingMonth}
                                                        onClick={addDemoMonth}
                                                        className="mt-3 h-9 px-4 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
                                                    >
                                                        {addingMonth ? 'Adding…' : 'Add month'}
                                                    </button>
                                                ) : null}
                                            </>
                                        ) : (
                                            'Set Salary processing date and Salary process start month in Salary Policy.'
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className="flex flex-col gap-1.5 bg-white p-1 rounded-xl border border-gray-100"
                                        aria-label="Salary months"
                                    >
                                        {months.map((row) => (
                                                <div
                                                    key={row.monthKey}
                                                    className="flex items-stretch rounded-lg hover:bg-slate-50"
                                                >
                                                <NavButton
                                                    href={`/HRM/Salary/${row.monthKey}`}
                                                    className={`${MONTH_ROW_GRID} flex-1 min-w-0 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap transition-all text-left text-slate-600 hover:text-blue-600 no-underline`}
                                                >
                                                    <span className="tabular-nums font-semibold">{row.slNo}</span>
                                                    <span className="truncate">{row.month}</span>
                                                    <span className="tabular-nums">{row.enrollUser}</span>
                                                    <span className="tabular-nums font-semibold">
                                                        {formatAed(row.monthlySalary)}
                                                    </span>
                                                    <span className="tabular-nums font-semibold">
                                                        {formatAed(row.actualSalary)}
                                                    </span>
                                                    <span className="tabular-nums font-semibold">
                                                        {formatAed(row.basicSalary)}
                                                    </span>
                                                    <span className="tabular-nums text-[11px] text-slate-600">
                                                        {formatAed(row.ot)}
                                                    </span>
                                                    <span className="tabular-nums text-[11px] text-slate-600">
                                                        {formatAed(row.deduction)}
                                                    </span>
                                                </NavButton>
                                                {canDeleteMonth ? (
                                                    <button
                                                        type="button"
                                                        title={`Delete ${row.month}`}
                                                        onClick={() => setPendingDelete(row)}
                                                        className="shrink-0 px-2.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                ) : null}
                                                </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {pendingDelete ? (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/30"
                        aria-label="Close"
                        onClick={() => !deleting && setPendingDelete(null)}
                    />
                    <div className="relative w-full max-w-sm rounded-xl bg-white shadow-2xl border border-gray-100 p-5">
                        <h3 className="text-base font-bold text-slate-800">Delete salary month?</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Remove <span className="font-semibold">{pendingDelete.month}</span> from the salary
                            list? This does not unenroll employees from other months.
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={() => setPendingDelete(null)}
                                className="h-9 px-3 rounded-lg border border-gray-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={confirmDeleteMonth}
                                className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                            >
                                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            <PendingSalaryRequestsModal
                isOpen={pendingInboxModalOpen}
                onClose={() => setPendingInboxModalOpen(false)}
                onPendingInboxCount={setPendingInboxCount}
            />
        </PermissionGuard>
    );
}
