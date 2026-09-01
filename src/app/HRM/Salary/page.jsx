'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import SalaryRegisterFilterCard from './components/SalaryRegisterFilterCard';
import SalaryHeaderActions from './components/SalaryHeaderActions';
import PendingSalaryRequestsModal from './components/PendingSalaryRequestsModal';
import {
    countVisibleSalaryPendingInbox,
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
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const MONTH_ROW_GRID =
    'grid w-full min-w-[640px] items-center gap-x-2 sm:gap-x-3 ' +
    'grid-cols-[2.25rem_minmax(7.5rem,1.1fr)_minmax(6.5rem,1fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_3.25rem_4.25rem]';

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
    const [viewerIsSalaryHr, setViewerIsSalaryHr] = useState(false);
    const [pendingInboxModalOpen, setPendingInboxModalOpen] = useState(false);
    const [pendingInboxCount, setPendingInboxCount] = useState(0);
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
            setViewerIsSalaryHr(Boolean(response.data?.viewerIsSalaryHr));
            loadedRef.current = true;
        } catch (err) {
            if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
            if (!loadedRef.current) {
                setMonths([]);
                setYears([]);
                setEnrollmentOverview(null);
                setHiddenMonthCount(0);
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
            setPendingInboxCount(countVisibleSalaryPendingInbox(items));
        } catch {
            setPendingInboxCount(0);
        }
    }, []);

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
                            {viewerIsSalaryHr ? (
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
                            ) : null}
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
                                            {col.key === 'enrollUser' && employeeId
                                                ? 'Employee'
                                                : col.label}
                                        </span>
                                    ))}
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
                                        ) : (
                                            'Set Salary processing date and Salary process start month in Salary Policy.'
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className={`flex flex-col gap-1.5 bg-white p-1 rounded-xl border border-gray-100 ${
                                            filtering ? 'opacity-60' : ''
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
                                                    className={`${MONTH_ROW_GRID} flex-1 min-w-0 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap transition-all text-left text-slate-600 hover:text-blue-600 no-underline`}
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
                onRefreshParent={() => fetchPendingInboxCount({ force: true })}
                onPendingInboxCount={setPendingInboxCount}
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
