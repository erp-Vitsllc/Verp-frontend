'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Trash2, Loader2, Bell, Check } from 'lucide-react';
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
import SalaryRegisterFilterCard from './components/SalaryRegisterFilterCard';
import SalaryHeaderActions from './components/SalaryHeaderActions';
import PendingSalaryRequestsModal from './components/PendingSalaryRequestsModal';
import {
    countVisibleSalaryPendingInbox,
    buildSalaryBellInbox,
    notifySalaryPendingInboxChanged,
    SALARY_PENDING_INBOX_CHANGED,
} from './utils/salaryPendingInboxCount';
import { fetchSalaryPendingInbox } from '@/utils/pendingInboxFetch';
import {
    salaryRegisterFiltersFromSearchParams,
    salaryRegisterHref,
} from './utils/salaryRegisterHref';
import { syncBrowserUrl } from '@/utils/listReturnNavigation';

function formatAed(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTH_HEAD = 'whitespace-nowrap text-left text-[11px] font-semibold leading-none text-gray-500';

const MONTH_ROW_GRID =
    'grid w-full min-w-[1320px] items-center gap-x-4 ' +
    'grid-cols-[2.25rem_minmax(6.5rem,0.9fr)_minmax(6.75rem,0.85fr)_minmax(7.4rem,0.95fr)_minmax(6.8rem,0.85fr)_minmax(6.4rem,0.8fr)_minmax(6.6rem,0.82fr)_minmax(6.75rem,0.8fr)_minmax(6.75rem,0.8fr)_minmax(5.2rem,0.68fr)_minmax(6.2rem,0.75fr)]';

const COLUMNS = [
    { key: 'slNo', label: 'SL' },
    { key: 'month', label: 'Month' },
    { key: 'enrollUser', label: 'Enroll User' },
    { key: 'monthlySalary', label: 'Monthly Salary' },
    { key: 'grossSalary', label: 'Gross Salary' },
    { key: 'actualSalary', label: 'Net Salary' },
    { key: 'basicSalary', label: 'Basic Salary' },
    { key: 'ot', label: 'OT' },
    { key: 'deduction', label: 'Deduction' },
    { key: 'processStatus', label: 'Process' },
    { key: 'paymentStatus', label: 'Payment' },
];
const APPROVAL_COL_CLASS =
    'w-[10.5rem] shrink-0 px-1 text-[11px] font-semibold leading-none text-gray-500';

function employeeMatchesCompanyFilter(emp, company) {
    if (!company) return true;
    const want = String(company).trim().toLowerCase();
    if (String(emp?.companyId || '').trim().toLowerCase() === want) return true;
    return String(emp?.companyName || 'Unassigned').trim().toLowerCase() === want;
}

function sameEmployeeId(left, right) {
    return (
        String(left || '')
            .trim()
            .replace(/\s+/g, '')
            .toUpperCase() ===
        String(right || '')
            .trim()
            .replace(/\s+/g, '')
            .toUpperCase()
    );
}

function SalaryPageContent() {
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const initialFilters = salaryRegisterFiltersFromSearchParams(searchParams);
    const [months, setMonths] = useState([]);
    const [years, setYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtering, setFiltering] = useState(false);
    const [error, setError] = useState('');
    const [enrollmentOverview, setEnrollmentOverview] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [addingMonth, setAddingMonth] = useState(false);
    const [hiddenMonthCount, setHiddenMonthCount] = useState(0);
    const [waitingForOpenMonth, setWaitingForOpenMonth] = useState(false);
    const [firstSalaryMonth, setFirstSalaryMonth] = useState('');
    const [nextOpenMonth, setNextOpenMonth] = useState('');
    const [viewerIsSalaryHr, setViewerIsSalaryHr] = useState(false);
    const [pendingInboxModalOpen, setPendingInboxModalOpen] = useState(false);
    const [pendingInboxCount, setPendingInboxCount] = useState(0);
    const [actingMonthKey, setActingMonthKey] = useState('');
    const [rejectRow, setRejectRow] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [yearFilter, setYearFilter] = useState(initialFilters.year);
    const [companyFilter, setCompanyFilter] = useState(initialFilters.company);
    const [employeeId, setEmployeeId] = useState(initialFilters.employeeId);
    const loadedRef = useRef(false);
    const canDeleteMonth = isAdmin();
    const hasFilters = Boolean(yearFilter || companyFilter || employeeId);
    const selectedEmployee = useMemo(
        () =>
            (enrollmentOverview?.employees || []).find((emp) =>
                sameEmployeeId(emp?.employeeId, employeeId),
            ),
        [enrollmentOverview, employeeId],
    );

    const fetchRegister = useCallback(async (signal) => {
        if (loadedRef.current) setFiltering(true);
        else setLoading(true);
        setError('');
        try {
            const params = {};
            if (yearFilter) params.year = yearFilter;
            if (companyFilter) params.company = companyFilter;
            if (employeeId) params.employeeId = employeeId;
            const response = await axiosInstance.get('/Employee/salary-register', {
                params,
                skipToast: true,
                signal: typeof AbortSignal !== 'undefined' && signal instanceof AbortSignal ? signal : undefined,
            });
            const list = Array.isArray(response.data?.months) ? response.data.months : [];
            setMonths(list);
            setYears(Array.isArray(response.data?.years) ? response.data.years : []);
            setEnrollmentOverview(response.data?.enrollmentOverview || null);
            setHiddenMonthCount(Number(response.data?.hiddenMonthCount) || 0);
            setWaitingForOpenMonth(Boolean(response.data?.waitingForProcessingDate));
            setFirstSalaryMonth(String(response.data?.firstSalaryMonth || '').trim());
            setNextOpenMonth(String(response.data?.nextOpenMonth || '').trim());
            setViewerIsSalaryHr(Boolean(response.data?.viewerIsSalaryHr));
            loadedRef.current = true;
        } catch (err) {
            if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
            if (!loadedRef.current) {
                setMonths([]);
                setYears([]);
                setEnrollmentOverview(null);
                setHiddenMonthCount(0);
                setWaitingForOpenMonth(false);
                setFirstSalaryMonth('');
                setNextOpenMonth('');
                setViewerIsSalaryHr(false);
            }
            setError(err?.response?.data?.message || err.message || 'Failed to load salary.');
        } finally {
            setLoading(false);
            setFiltering(false);
        }
    }, [yearFilter, companyFilter, employeeId]);

    useEffect(() => {
        const controller = new AbortController();
        fetchRegister(controller.signal);
        return () => controller.abort();
    }, [fetchRegister]);

    const fetchPendingInboxCount = useCallback(async ({ force = false } = {}) => {
        try {
            const items = await fetchSalaryPendingInbox(axiosInstance, { skipToast: true, force });
            const merged = buildSalaryBellInbox(items, {
                overview: enrollmentOverview,
                includePendingEnrollments: viewerIsSalaryHr,
                months,
            });
            setPendingInboxCount(countVisibleSalaryPendingInbox(merged));
        } catch {
            const merged = buildSalaryBellInbox([], {
                overview: enrollmentOverview,
                includePendingEnrollments: viewerIsSalaryHr,
                months,
            });
            setPendingInboxCount(countVisibleSalaryPendingInbox(merged));
        }
    }, [enrollmentOverview, viewerIsSalaryHr, months]);

    useEffect(() => {
        fetchPendingInboxCount();
        const refreshInbox = () => fetchPendingInboxCount({ force: true });
        window.addEventListener(SALARY_PENDING_INBOX_CHANGED, refreshInbox);
        document.addEventListener(SALARY_PENDING_INBOX_CHANGED, refreshInbox);
        return () => {
            window.removeEventListener(SALARY_PENDING_INBOX_CHANGED, refreshInbox);
            document.removeEventListener(SALARY_PENDING_INBOX_CHANGED, refreshInbox);
        };
    }, [fetchPendingInboxCount]);

    useEffect(() => {
        syncBrowserUrl(
            salaryRegisterHref({
                employeeId,
                year: yearFilter,
                company: companyFilter,
            }),
        );
    }, [employeeId, yearFilter, companyFilter]);

    function handleCompanyChange(nextCompany) {
        setCompanyFilter(nextCompany);
        setEmployeeId((current) => {
            if (!current) return '';
            const emp = (enrollmentOverview?.employees || []).find((row) =>
                sameEmployeeId(row?.employeeId, current),
            );
            return employeeMatchesCompanyFilter(emp, nextCompany) ? current : '';
        });
    }

    function clearFilters() {
        setYearFilter('');
        setCompanyFilter('');
        setEmployeeId('');
    }

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

    const showApprovalCol = months.some((row) => row.canAct);

    async function approveMonth(row) {
        if (!row?.monthKey || actingMonthKey) return;
        setActingMonthKey(row.monthKey);
        try {
            const res = await axiosInstance.post(
                `/Employee/salary-register/${encodeURIComponent(row.monthKey)}/dmf/approve`,
            );
            const next = res.data?.dmf || res.data;
            toast({
                title:
                    String(next?.status || '').toLowerCase() === 'approved'
                        ? 'Processed'
                        : next?.statusLabel || 'Approved',
            });
            notifySalaryPendingInboxChanged();
            await fetchRegister();
        } catch (err) {
            toast({
                title: err?.response?.data?.message || 'Could not approve',
                variant: 'destructive',
            });
        } finally {
            setActingMonthKey('');
        }
    }

    async function confirmRejectMonth() {
        const reason = String(rejectReason || '').trim();
        if (!reason) {
            toast({ title: 'Enter a rejection reason', variant: 'destructive' });
            return;
        }
        const row = rejectRow;
        if (!row?.monthKey) return;
        setActingMonthKey(row.monthKey);
        try {
            await axiosInstance.post(
                `/Employee/salary-register/${encodeURIComponent(row.monthKey)}/dmf/reject`,
                { reason },
            );
            toast({ title: 'Rejected' });
            setRejectRow(null);
            setRejectReason('');
            notifySalaryPendingInboxChanged();
            await fetchRegister();
        } catch (err) {
            toast({
                title: err?.response?.data?.message || 'Could not reject',
                variant: 'destructive',
            });
        } finally {
            setActingMonthKey('');
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
                                title="Salary notifications assigned to you"
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
                            <SalaryEnrollmentOverviewCard
                                overview={enrollmentOverview}
                                activeCompany={companyFilter}
                                onSelectCompany={(name) =>
                                    handleCompanyChange(
                                        String(name || '').trim().toLowerCase() ===
                                            String(companyFilter || '').trim().toLowerCase()
                                            ? ''
                                            : name,
                                    )
                                }
                            />
                            <div
                                className={`bg-white rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                            />
                        </div>

                        <SalaryRegisterFilterCard
                            years={years}
                            companies={enrollmentOverview?.companies}
                            employees={enrollmentOverview?.employees}
                            year={yearFilter}
                            company={companyFilter}
                            employeeId={employeeId}
                            onYearChange={setYearFilter}
                            onCompanyChange={handleCompanyChange}
                            onEmployeeChange={setEmployeeId}
                            onClear={clearFilters}
                            filtering={filtering}
                        />

                        {error ? (
                            <ErpErrorBanner className="mb-4" message={error} onRetry={() => fetchRegister()} />
                        ) : null}

                        <div className="w-full max-w-full overflow-x-auto">
                            <div className="min-w-[1320px]">
                                <div className="flex items-center">
                                    <div className={`${MONTH_ROW_GRID} min-w-0 flex-1 px-3 sm:px-4 py-2`}>
                                        {COLUMNS.map((col) => (
                                            <span key={col.key} className={MONTH_HEAD}>
                                                {col.key === 'enrollUser' && employeeId
                                                    ? 'Employee'
                                                    : col.label}
                                            </span>
                                        ))}
                                    </div>
                                    {showApprovalCol ? (
                                        <span className={APPROVAL_COL_CLASS}>Approval</span>
                                    ) : null}
                                    {canDeleteMonth ? <span className="w-9 shrink-0" /> : null}
                                </div>

                                {loading ? (
                                    <div className="rounded-xl border border-gray-100 bg-white px-4 py-8 text-center text-xs text-gray-500 sm:text-sm">
                                        Loading salary...
                                    </div>
                                ) : months.length === 0 ? (
                                    <div className="rounded-xl border border-gray-100 bg-white px-4 py-8 text-center text-xs text-gray-500 sm:text-sm">
                                        {hasFilters ? (
                                            <>
                                                <p>No salary months match these filters.</p>
                                                <button
                                                    type="button"
                                                    onClick={clearFilters}
                                                    className="mt-3 h-9 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                                >
                                                    Clear filters
                                                </button>
                                            </>
                                        ) : hiddenMonthCount > 0 ? (
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
                                        ) : waitingForOpenMonth && nextOpenMonth ? (
                                            firstSalaryMonth
                                                ? `${firstSalaryMonth} salary opens on 1 ${nextOpenMonth}.`
                                                : `Payroll opens on 1 ${nextOpenMonth}.`
                                        ) : (
                                            'Set Salary processing date and Salary process start month in Salary Policy.'
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className={`flex flex-col gap-1.5 bg-white p-1 rounded-xl border border-gray-100 ${filtering ? 'opacity-60' : ''
                                            }`}
                                        aria-label="Salary months"
                                    >
                                        {months.map((row) => (
                                            <div
                                                key={row.monthKey}
                                                className="flex items-stretch rounded-lg hover:bg-slate-50"
                                            >
                                                <NavButton
                                                    href={`/HRM/Salary/${row.monthKey}`}
                                                    className={`${MONTH_ROW_GRID} flex-1 min-w-0 px-3 sm:px-4 py-2.5 text-[12px] font-medium whitespace-nowrap transition-all text-left text-slate-600 hover:text-blue-600 no-underline`}
                                                >
                                                    <span className="tabular-nums font-semibold">{row.slNo}</span>
                                                    <span className="truncate">{row.month}</span>
                                                    <span className={employeeId ? 'truncate' : 'tabular-nums'}>
                                                        {selectedEmployee
                                                            ? selectedEmployee.name || selectedEmployee.employeeId
                                                            : employeeId || row.enrollUser}
                                                    </span>
                                                    <span className="tabular-nums font-semibold">
                                                        {formatAed(row.monthlySalary)}
                                                    </span>
                                                    <span className="tabular-nums font-semibold" title="Zoho salary on the salary slip">
                                                        {formatAed(row.grossSalary)}
                                                    </span>
                                                    <span className="tabular-nums font-semibold" title="Net salary payable on the salary slip">
                                                        {formatAed(row.actualSalary)}
                                                    </span>
                                                    <span className="tabular-nums font-semibold">
                                                        {formatAed(row.basicSalary)}
                                                    </span>
                                                    <span className="tabular-nums text-slate-600">
                                                        {formatAed(row.ot)}
                                                    </span>
                                                    <span className="tabular-nums text-slate-600">
                                                        {formatAed(row.deduction)}
                                                    </span>
                                                    <span
                                                        title={row.processStatus || 'Pending'}
                                                        className={
                                                            String(row.processStatus || '') === 'Processed'
                                                                ? 'font-semibold text-emerald-700'
                                                                : 'font-semibold text-amber-700'
                                                        }
                                                    >
                                                        {row.processStatus || 'Pending'}
                                                    </span>
                                                    <span
                                                        title={row.paymentStatus || 'Not paid'}
                                                        className={
                                                            row.paymentStatus === 'Paid'
                                                                ? 'font-semibold text-emerald-700'
                                                                : row.paymentStatus === 'Partially paid'
                                                                    ? 'font-semibold text-amber-700'
                                                                    : 'font-semibold text-slate-500'
                                                        }
                                                    >
                                                        {row.paymentStatus || 'Not paid'}
                                                    </span>
                                                </NavButton>
                                                {showApprovalCol ? (
                                                    <div className="flex w-[10.5rem] shrink-0 items-center justify-end gap-1 px-1">
                                                        {row.canAct ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    title="Reject"
                                                                    disabled={Boolean(actingMonthKey)}
                                                                    onClick={() => {
                                                                        setRejectRow(row);
                                                                        setRejectReason('');
                                                                    }}
                                                                    className="h-7 rounded-lg border border-red-200 bg-white px-2 text-[10px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                                                                >
                                                                    Reject
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    title="Approve"
                                                                    disabled={Boolean(actingMonthKey)}
                                                                    onClick={() => approveMonth(row)}
                                                                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                                                >
                                                                    {actingMonthKey === row.monthKey ? (
                                                                        <Loader2 size={12} className="animate-spin" />
                                                                    ) : (
                                                                        <Check size={12} />
                                                                    )}
                                                                    Approve
                                                                </button>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                ) : null}
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
            {rejectRow ? (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/30"
                        aria-label="Close"
                        onClick={() => {
                            if (actingMonthKey) return;
                            setRejectRow(null);
                            setRejectReason('');
                        }}
                    />
                    <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
                        <h3 className="text-base font-bold text-slate-800">Reject {rejectRow.month}?</h3>
                        <textarea
                            value={rejectReason}
                            onChange={(event) => setRejectReason(event.target.value)}
                            rows={4}
                            placeholder="Reason"
                            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={Boolean(actingMonthKey)}
                                onClick={() => {
                                    setRejectRow(null);
                                    setRejectReason('');
                                }}
                                className="h-10 rounded-xl border px-4 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={Boolean(actingMonthKey)}
                                onClick={confirmRejectMonth}
                                className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {actingMonthKey === rejectRow.monthKey ? 'Rejecting…' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
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
                onRefreshParent={() => fetchPendingInboxCount({ force: true })}
                onPendingInboxCount={setPendingInboxCount}
                enrollmentOverview={enrollmentOverview}
                includePendingEnrollments={viewerIsSalaryHr}
                months={months}
            />
        </PermissionGuard>
    );
}

export default function SalaryPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <SalaryPageContent />
        </Suspense>
    );
}
