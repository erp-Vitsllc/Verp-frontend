'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import LeaveCalendarView from '../components/LeaveCalendarView';
import LeaveDashboard from '../components/LeaveDashboard';
import AnnualLeaveFilterModal from '../components/AnnualLeaveFilterModal';
import { isValidDateKey } from '../utils/leaveCalendarUtils';
import axiosInstance from '@/utils/axios';
import { toast } from '@/hooks/use-toast';

function mapEmployeeRow(emp) {
    return {
        _id: String(emp?._id || ''),
        employeeId: emp?.employeeId || '',
        employeeName:
            emp?.employeeName || [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim(),
        annualLeaveTaken: Number(emp?.annualLeaveTaken) || 0,
        authorizedLeave: Number(emp?.authorizedLeave) || 0,
        sickLeave: Number(emp?.sickLeave) || 0,
        unauthorizedLeave: Number(emp?.unauthorizedLeave) || 0,
        compoffLeave: Number(emp?.compoffLeave) || 0,
    };
}

function resolveYearFromDateKey(dateKey) {
    const year = Number(String(dateKey || '').slice(0, 4));
    if (Number.isInteger(year) && year >= 2000 && year <= 2100) return year;
    return null;
}

function buildYearOptions(selectedYear) {
    const current = new Date().getFullYear();
    const start = Math.min(current - 5, selectedYear);
    const end = Math.max(current + 1, selectedYear);
    const years = [];
    for (let year = end; year >= start; year -= 1) years.push(year);
    return years;
}

function AnnualLeavePageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [employees, setEmployees] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
    const [confirming, setConfirming] = useState(false);
    const [savedLeaveKey, setSavedLeaveKey] = useState('');

    const employeeId = String(searchParams.get('employeeId') || '').trim();
    const from = String(searchParams.get('from') || '').trim();
    const to = String(searchParams.get('to') || '').trim();
    const employeeName = String(searchParams.get('employeeName') || '').trim();
    const approvalId = String(searchParams.get('approvalId') || '').trim();
    const sourceEmployeeId = String(searchParams.get('sourceEmployeeId') || '').trim();
    const sourceEmployeeName = String(searchParams.get('sourceEmployeeName') || '').trim();
    const sourceFrom = String(searchParams.get('sourceFrom') || '').trim();
    const sourceTo = String(searchParams.get('sourceTo') || '').trim();

    const [filterYear, setFilterYear] = useState(
        () => resolveYearFromDateKey(from) || new Date().getFullYear(),
    );
    const yearOptions = useMemo(() => buildYearOptions(filterYear), [filterYear]);

    const hasFilters = useMemo(
        () => Boolean(employeeId && isValidDateKey(from) && isValidDateKey(to)),
        [employeeId, from, to],
    );

    const fetchEmployees = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/Leave/employees', {
                params: { year: filterYear },
                skipToast: true,
            });
            const list = Array.isArray(response.data?.employees) ? response.data.employees : [];
            setEmployees(list.map(mapEmployeeRow));
        } catch {
            setEmployees([]);
        }
    }, [filterYear]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees, dashboardRefreshKey]);

    const handleModalApply = useCallback(
        ({ employeeId: nextEmployeeId, startDate, endDate, employee, leaveMode }) => {
            const params = new URLSearchParams({
                employeeId: nextEmployeeId,
                from: startDate,
                to: endDate,
                leaveType: leaveMode === 'authorized' ? 'authorized' : 'annual',
                sourceEmployeeId: nextEmployeeId,
                sourceFrom: startDate,
                sourceTo: endDate,
            });
            if (employee?.employeeName) {
                params.set('employeeName', employee.employeeName);
                params.set('sourceEmployeeName', employee.employeeName);
            }
            const nextYear = resolveYearFromDateKey(startDate);
            if (nextYear) setFilterYear(nextYear);
            setSavedLeaveKey('');
            setModalOpen(false);
            router.push(`/HRM/Leave/annual-leave?${params.toString()}`);
        },
        [router],
    );

    const handleConfirmLeave = useCallback(async () => {
        if (!employeeId || !isValidDateKey(from) || !isValidDateKey(to) || confirming) return;

        setConfirming(true);
        try {
            const response = await axiosInstance.post(
                '/Leave/apply',
                {
                    employeeId,
                    from,
                    to,
                    leavePayType: 'paid',
                },
                { skipToast: true },
            );
            toast({
                title: 'Leave saved',
                description: response.data?.message || 'Leave marked on the calendar.',
            });
            setSavedLeaveKey(`${employeeId}|${from}|${to}`);
            setDashboardRefreshKey((value) => value + 1);
        } catch (err) {
            toast({
                title: 'Could not save leave',
                description: err?.response?.data?.message || err.message || 'Failed to confirm leave.',
                variant: 'destructive',
            });
        } finally {
            setConfirming(false);
        }
    }, [confirming, employeeId, from, to]);

    const handleDraftRangeChange = useCallback(
        ({ from: nextFrom, to: nextTo }) => {
            if (!employeeId || !isValidDateKey(nextFrom) || !isValidDateKey(nextTo)) return;

            setSavedLeaveKey('');

            const params = new URLSearchParams({
                employeeId,
                from: nextFrom,
                to: nextTo,
                leaveType: searchParams.get('leaveType') || 'annual',
            });
            if (employeeName) params.set('employeeName', employeeName);
            if (approvalId) params.set('approvalId', approvalId);

            const isSourceEmployee =
                !sourceEmployeeId || String(sourceEmployeeId) === String(employeeId);
            const nextSourceId = sourceEmployeeId || employeeId;
            const nextSourceName = sourceEmployeeName || employeeName;
            const nextSourceFrom = isSourceEmployee ? nextFrom : sourceFrom || nextFrom;
            const nextSourceTo = isSourceEmployee ? nextTo : sourceTo || nextTo;

            if (nextSourceId) params.set('sourceEmployeeId', nextSourceId);
            if (nextSourceName) params.set('sourceEmployeeName', nextSourceName);
            if (nextSourceFrom) params.set('sourceFrom', nextSourceFrom);
            if (nextSourceTo) params.set('sourceTo', nextSourceTo);
            router.replace(`/HRM/Leave/annual-leave?${params.toString()}`);
        },
        [
            approvalId,
            employeeId,
            employeeName,
            router,
            searchParams,
            sourceEmployeeId,
            sourceEmployeeName,
            sourceFrom,
            sourceTo,
        ],
    );

    const handleApprovalRowSelect = useCallback(
        (row) => {
            if (!row?.employeeMongoId) return;
            if (!isValidDateKey(row.startDateKey) || !isValidDateKey(row.endDateKey)) return;

            const leaveType =
                row.requestedStatusKey === 'authorized_leave' ? 'authorized' : 'annual';

            const params = new URLSearchParams({
                employeeId: row.employeeMongoId,
                from: row.startDateKey,
                to: row.endDateKey,
                leaveType,
                approvalId: row.id,
            });
            if (row.name) params.set('employeeName', row.name);

            const isReturningToSource =
                sourceEmployeeId && String(row.employeeMongoId) === String(sourceEmployeeId);
            const isViewingSourceEmployee =
                !sourceEmployeeId || String(sourceEmployeeId) === String(employeeId);

            const nextSourceId = sourceEmployeeId || employeeId;
            const nextSourceName = sourceEmployeeName || employeeName;
            const nextSourceFrom = isViewingSourceEmployee ? from : sourceFrom || from;
            const nextSourceTo = isViewingSourceEmployee ? to : sourceTo || to;

            if (nextSourceId) params.set('sourceEmployeeId', nextSourceId);
            if (nextSourceName) params.set('sourceEmployeeName', nextSourceName);

            if (isReturningToSource) {
                params.set('from', nextSourceFrom);
                params.set('to', nextSourceTo);
                params.delete('approvalId');
                if (nextSourceName) params.set('employeeName', nextSourceName);
            } else {
                if (nextSourceFrom) params.set('sourceFrom', nextSourceFrom);
                if (nextSourceTo) params.set('sourceTo', nextSourceTo);
            }
            router.replace(`/HRM/Leave/annual-leave?${params.toString()}`);
        },
        [employeeId, employeeName, from, router, sourceEmployeeId, sourceEmployeeName, sourceFrom, sourceTo, to],
    );

    return (
        <PermissionGuard moduleId="hrm_leave" permissionType="view">
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
                        <ErpPageHeader title="Leave Dashboard">
                            <label className="inline-flex items-center gap-2 text-sm text-[#555B65]">
                                <span className="font-medium">Year</span>
                                <select
                                    value={filterYear}
                                    onChange={(event) => setFilterYear(Number(event.target.value))}
                                    className="min-w-[108px] rounded-lg border border-[#DDE3EA] bg-white px-3 py-2 text-sm font-medium text-[#344054] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                                    aria-label="Filter leave dashboard by year"
                                >
                                    {yearOptions.map((year) => (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </ErpPageHeader>

                        <LeaveDashboard
                            employees={employees}
                            employeeId={employeeId}
                            employeeName={employeeName}
                            selectedFrom={from}
                            selectedTo={to}
                            selectedApprovalId={approvalId}
                            sourceEmployeeId={sourceEmployeeId}
                            sourceEmployeeName={sourceEmployeeName}
                            sourceFrom={sourceFrom}
                            sourceTo={sourceTo}
                            year={filterYear}
                            onYearChange={setFilterYear}
                            onApplyLeave={() => setModalOpen(true)}
                            onLeaveInformation={() => router.push('/HRM/Leave')}
                            refreshKey={dashboardRefreshKey}
                            onDataChanged={() => setDashboardRefreshKey((value) => value + 1)}
                            onApprovalRowSelect={handleApprovalRowSelect}
                        />

                        <LeaveCalendarView
                            employeeId={employeeId}
                            from={from}
                            to={to}
                            employeeName={employeeName}
                            year={filterYear}
                            onYearChange={setFilterYear}
                            onConfirm={hasFilters ? handleConfirmLeave : () => setModalOpen(true)}
                            onDraftRangeChange={handleDraftRangeChange}
                            refreshKey={dashboardRefreshKey}
                            confirming={confirming}
                            hideDraft={
                                !hasFilters || savedLeaveKey === `${employeeId}|${from}|${to}`
                            }
                        />
                    </div>
                </div>
            </div>

            <AnnualLeaveFilterModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                employees={employees}
                initialEmployeeId={employeeId}
                initialStartDate={from}
                initialEndDate={to}
                onApply={handleModalApply}
                applyLabel="Apply"
            />
        </PermissionGuard>
    );
}

export default function AnnualLeavePage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
                    Loading leave dashboard...
                </div>
            }
        >
            <AnnualLeavePageContent />
        </Suspense>
    );
}
