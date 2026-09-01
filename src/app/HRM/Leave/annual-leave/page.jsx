'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import NavButton from '@/components/NavButton';
import LeaveCalendarView from '../components/LeaveCalendarView';
import LeaveDashboard, { ALL_LEAVE_STATUS } from '../components/LeaveDashboard';
import LeaveGroupFilterDropdown, { ALL_LEAVE_GROUP } from '../components/LeaveGroupFilterDropdown';
import AnnualLeaveFilterModal from '../components/AnnualLeaveFilterModal';
import PendingLeaveRequestsModal from '../components/PendingLeaveRequestsModal';
import { isValidDateKey } from '../utils/leaveCalendarUtils';
import {
    countVisibleLeavePendingInbox,
    LEAVE_PENDING_INBOX_CHANGED,
    notifyLeavePendingInboxChanged,
} from '../utils/leavePendingInboxCount';
import { fetchLeavePendingInbox } from '@/utils/pendingInboxFetch';
import {
    ALL_LEAVE_YEAR,
    isAllLeaveYear,
    leaveDashboardYearOptions,
    useLeaveSalaryVisibility,
} from '../utils/leaveSalaryVisibility';
import useWorkLocations from '@/hooks/useWorkLocations';
import { normalizeWorkLocationKey, workLocationLabel } from '@/utils/workLocations';
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
        staffType: normalizeWorkLocationKey(emp?.staffType),
    };
}

function resolveYearFromDateKey(dateKey) {
    const year = Number(String(dateKey || '').slice(0, 4));
    if (Number.isInteger(year) && year >= 2000 && year <= 2100) return year;
    return null;
}

function normalizeLeaveMode(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'authorize') return 'authorized';
    if (['annual', 'authorized', 'unauthorized', 'sick', 'compoff'].includes(raw)) return raw;
    return 'annual';
}

function applyLeaveMode(value) {
    const mode = normalizeLeaveMode(value);
    return mode === 'authorized' ? 'authorized' : 'annual';
}

function leaveModeFromStatusKey(statusKey) {
    switch (String(statusKey || '')) {
        case 'authorized_leave':
            return 'authorized';
        case 'unauthorized_leave':
            return 'unauthorized';
        case 'sick_leave':
            return 'sick';
        case 'compoff_leave':
            return 'compoff';
        default:
            return 'annual';
    }
}

function leaveDashboardHref({
    employeeId = '',
    employeeName = '',
    from = '',
    to = '',
    approvalId = '',
    leaveType = '',
} = {}) {
    const params = new URLSearchParams();
    if (employeeId) params.set('employeeId', employeeId);
    if (employeeName) params.set('employeeName', employeeName);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (approvalId) params.set('approvalId', approvalId);
    if (leaveType) params.set('leaveType', leaveType);
    const query = params.toString();
    return query ? `/HRM/Leave/annual-leave?${query}` : '/HRM/Leave/annual-leave';
}

function AnnualLeavePageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [employees, setEmployees] = useState([]);
    const salaryVisibility = useLeaveSalaryVisibility();
    const { locations } = useWorkLocations();
    const [modalOpen, setModalOpen] = useState(false);
    const [leaveModalMode, setLeaveModalMode] = useState('apply');
    const [approveRequest, setApproveRequest] = useState(null);
    const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
    const [confirming, setConfirming] = useState(false);
    const [savedLeaveKey, setSavedLeaveKey] = useState('');
    const [calendarLeaveFocus, setCalendarLeaveFocus] = useState(null);
    const [pendingInboxCount, setPendingInboxCount] = useState(0);
    const [pendingInboxModalOpen, setPendingInboxModalOpen] = useState(false);

    const employeeId = String(searchParams.get('employeeId') || '').trim();
    const from = String(searchParams.get('from') || '').trim();
    const to = String(searchParams.get('to') || '').trim();
    const leaveType = normalizeLeaveMode(searchParams.get('leaveType'));
    const employeeName = String(searchParams.get('employeeName') || '').trim();
    const approvalId = String(searchParams.get('approvalId') || '').trim();
    const sourceEmployeeId = String(searchParams.get('sourceEmployeeId') || '').trim();
    const sourceEmployeeName = String(searchParams.get('sourceEmployeeName') || '').trim();
    const sourceFrom = String(searchParams.get('sourceFrom') || '').trim();
    const sourceTo = String(searchParams.get('sourceTo') || '').trim();

    const [filterYear, setFilterYear] = useState(ALL_LEAVE_YEAR);
    const yearOptions = useMemo(
        () => leaveDashboardYearOptions(salaryVisibility),
        [salaryVisibility],
    );
    const yearMin = yearOptions.length ? yearOptions[yearOptions.length - 1] : new Date().getFullYear();
    const yearMax = new Date().getFullYear();
    const [filterGroup, setFilterGroup] = useState(ALL_LEAVE_GROUP);
    const [groupMenuLevel, setGroupMenuLevel] = useState('groups');
    const [statusFilter, setStatusFilter] = useState(ALL_LEAVE_STATUS);

    const enrolledEmployees = useMemo(() => {
        if (!salaryVisibility.ready) return employees;
        return employees.filter(
            (row) =>
                salaryVisibility.byMongoId.has(String(row._id || '')) ||
                salaryVisibility.byEmployeeId.has(String(row.employeeId || '').trim()),
        );
    }, [employees, salaryVisibility]);

    const groupOptions = useMemo(() => {
        const byKey = new Map();
        for (const loc of locations || []) {
            const key = normalizeWorkLocationKey(loc.key);
            if (!key) continue;
            byKey.set(key, loc.label || workLocationLabel(key, locations));
        }
        for (const emp of enrolledEmployees) {
            const key = normalizeWorkLocationKey(emp.staffType);
            if (!key || byKey.has(key)) continue;
            byKey.set(key, workLocationLabel(key, locations));
        }
        return [...byKey.entries()].map(([key, label]) => ({ key, label }));
    }, [enrolledEmployees, locations]);

    const groupEmployees = useMemo(() => {
        if (filterGroup === ALL_LEAVE_GROUP) return enrolledEmployees;
        return enrolledEmployees.filter((row) => row.staffType === filterGroup);
    }, [enrolledEmployees, filterGroup]);

    const groupEmployeeIds = useMemo(() => {
        if (filterGroup === ALL_LEAVE_GROUP) return null;
        return new Set(groupEmployees.map((row) => String(row._id)));
    }, [filterGroup, groupEmployees]);

    const selectedFilterEmployee = useMemo(
        () => enrolledEmployees.find((row) => String(row._id) === String(employeeId)) || null,
        [employeeId, enrolledEmployees],
    );
    const selectedEmployeeCode = String(selectedFilterEmployee?.employeeId || '').trim();
    const leaveDashboardReturnHref = leaveDashboardHref({
        employeeId,
        employeeName,
        from,
        to,
    });

    const clearDashboardEmployee = useCallback(() => {
        router.replace(leaveDashboardHref({ from, to }));
    }, [from, router, to]);

    const handleSelectGroup = useCallback(
        (nextGroup) => {
            const key = nextGroup === ALL_LEAVE_GROUP ? ALL_LEAVE_GROUP : String(nextGroup || '');
            setFilterGroup(key || ALL_LEAVE_GROUP);
            if (key === ALL_LEAVE_GROUP) {
                setGroupMenuLevel('groups');
                if (employeeId) clearDashboardEmployee();
                return;
            }
            setGroupMenuLevel('employees');
            if (employeeId) clearDashboardEmployee();
        },
        [clearDashboardEmployee, employeeId],
    );

    const handleSelectGroupEmployee = useCallback(
        (next) => {
            if (!next) {
                if (employeeId) clearDashboardEmployee();
                return;
            }
            router.replace(
                leaveDashboardHref({
                    employeeId: String(next._id),
                    employeeName: next.employeeName || '',
                    from,
                    to,
                }),
            );
        },
        [clearDashboardEmployee, employeeId, from, router, to],
    );

    const handleReturnToGroups = useCallback(() => {
        setFilterGroup(ALL_LEAVE_GROUP);
        setGroupMenuLevel('groups');
        if (employeeId) clearDashboardEmployee();
    }, [clearDashboardEmployee, employeeId]);

    useEffect(() => {
        if (!employeeId) return;
        const emp =
            enrolledEmployees.find((row) => String(row._id) === String(employeeId)) || null;
        if (!emp?.staffType) return;
        setFilterGroup(emp.staffType);
        setGroupMenuLevel('employees');
    }, [employeeId, enrolledEmployees]);

    const fetchEmployees = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/Leave/employees', {
                params: { year: isAllLeaveYear(filterYear) ? ALL_LEAVE_YEAR : filterYear },
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

    const fetchPendingInboxCount = useCallback(async ({ force = false } = {}) => {
        try {
            const items = await fetchLeavePendingInbox(axiosInstance, {
                skipToast: true,
                force,
            });
            setPendingInboxCount(countVisibleLeavePendingInbox(items));
        } catch {
            setPendingInboxCount(0);
        }
    }, []);

    useEffect(() => {
        fetchPendingInboxCount();
        const refresh = () => fetchPendingInboxCount({ force: true });
        if (typeof window !== 'undefined') {
            window.addEventListener(LEAVE_PENDING_INBOX_CHANGED, refresh);
        }
        if (typeof document !== 'undefined') {
            document.addEventListener(LEAVE_PENDING_INBOX_CHANGED, refresh);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(LEAVE_PENDING_INBOX_CHANGED, refresh);
            }
            if (typeof document !== 'undefined') {
                document.removeEventListener(LEAVE_PENDING_INBOX_CHANGED, refresh);
            }
        };
    }, [fetchPendingInboxCount]);

    const openApplyModal = useCallback(() => {
        setLeaveModalMode('apply');
        setApproveRequest(null);
        setModalOpen(true);
    }, []);

    const applyLeaveSelection = useCallback(
        async ({ nextEmployeeId, startDate, endDate, employee, leaveMode, attendanceId, approve, reject }) => {
            const response = await axiosInstance.post(
                '/Leave/apply',
                {
                    employeeId: nextEmployeeId,
                    from: startDate,
                    to: endDate,
                    leavePayType: 'paid',
                    leaveType: attendanceId
                        ? normalizeLeaveMode(leaveMode)
                        : applyLeaveMode(leaveMode),
                    ...(attendanceId ? { attendanceId } : {}),
                    ...(approve ? { approve: true } : {}),
                    ...(reject ? { reject: true } : {}),
                },
                { skipToast: true },
            );

            setFilterGroup(ALL_LEAVE_GROUP);
            setGroupMenuLevel('groups');
            const nextYear = resolveYearFromDateKey(startDate);
            if (nextYear && !isAllLeaveYear(filterYear)) setFilterYear(nextYear);
            setSavedLeaveKey(`${nextEmployeeId}|${startDate}|${endDate}`);
            setDashboardRefreshKey((value) => value + 1);
            notifyLeavePendingInboxChanged();
            router.replace(
                leaveDashboardHref({
                    from: startDate,
                    to: endDate,
                }),
            );
            return response;
        },
        [filterYear, router],
    );

    const handlePendingRangeChange = useCallback(
        async ({ employeeMongoId, from: nextFrom, to: nextTo, leaveType, attendanceId }) => {
            if (confirming) return;
            setConfirming(true);
            try {
                await applyLeaveSelection({
                    nextEmployeeId: employeeMongoId,
                    startDate: nextFrom,
                    endDate: nextTo,
                    leaveMode: leaveType,
                    attendanceId,
                });
                toast({
                    title: 'Pending leave updated',
                    description: 'The leave dates were moved on the calendar.',
                });
            } catch (err) {
                toast({
                    title: 'Could not move leave',
                    description:
                        err?.response?.data?.message || err.message || 'Failed to update pending leave.',
                    variant: 'destructive',
                });
                setDashboardRefreshKey((value) => value + 1);
            } finally {
                setConfirming(false);
            }
        },
        [applyLeaveSelection, confirming],
    );

    const handleModalApply = useCallback(
        async ({ employeeId: nextEmployeeId, startDate, endDate, employee, leaveMode }) => {
            if (confirming) return;
            const isExisting =
                (leaveModalMode === 'approve' || leaveModalMode === 'edit') && approveRequest?.id;
            setConfirming(true);
            try {
                const response = await applyLeaveSelection({
                    nextEmployeeId,
                    startDate,
                    endDate,
                    employee,
                    leaveMode,
                    attendanceId: isExisting ? approveRequest.id : '',
                    approve: isExisting,
                });
                toast({
                    title: isExisting ? 'Leave saved' : 'Leave request submitted',
                    description:
                        response.data?.message ||
                        (isExisting
                            ? 'Leave is approved and shown on the calendar.'
                            : 'Request is pending. Accept or reject it from Leave Approval.'),
                });
                setModalOpen(false);
                setApproveRequest(null);
                setLeaveModalMode('apply');
            } catch (err) {
                toast({
                    title: isExisting ? 'Could not save leave' : 'Could not submit leave',
                    description: err?.response?.data?.message || err.message || 'Failed to save leave.',
                    variant: 'destructive',
                });
            } finally {
                setConfirming(false);
            }
        },
        [applyLeaveSelection, approveRequest, confirming, leaveModalMode],
    );

    const handleModalReject = useCallback(
        async ({ employeeId: nextEmployeeId, startDate, endDate, employee, leaveMode }) => {
            if (confirming || !approveRequest?.id) return;
            setConfirming(true);
            try {
                const response = await applyLeaveSelection({
                    nextEmployeeId: nextEmployeeId || approveRequest.employeeMongoId,
                    startDate: startDate || approveRequest.startDateKey,
                    endDate: endDate || approveRequest.endDateKey,
                    employee,
                    leaveMode,
                    attendanceId: approveRequest.id,
                    reject: true,
                });
                toast({
                    title: 'Leave rejected',
                    description: response.data?.message || 'Leave request was rejected.',
                });
                setModalOpen(false);
                setApproveRequest(null);
                setLeaveModalMode('apply');
            } catch (err) {
                toast({
                    title: 'Could not reject leave',
                    description: err?.response?.data?.message || err.message || 'Failed to reject leave.',
                    variant: 'destructive',
                });
            } finally {
                setConfirming(false);
            }
        },
        [applyLeaveSelection, approveRequest, confirming],
    );

    const handleConfirmLeave = useCallback(async () => {
        if (!employeeId || !isValidDateKey(from) || !isValidDateKey(to) || confirming) return;
        if (savedLeaveKey === `${employeeId}|${from}|${to}`) return;

        setConfirming(true);
        try {
            const response = await applyLeaveSelection({
                nextEmployeeId: employeeId,
                startDate: from,
                endDate: to,
                employee: { employeeName },
                leaveMode: leaveType,
            });
            toast({
                title: 'Leave request submitted',
                description:
                    response.data?.message ||
                    'Request is pending. Accept or reject it from Leave Approval.',
            });
        } catch (err) {
            toast({
                title: 'Could not submit leave',
                description: err?.response?.data?.message || err.message || 'Failed to confirm leave.',
                variant: 'destructive',
            });
        } finally {
            setConfirming(false);
        }
    }, [applyLeaveSelection, confirming, employeeId, employeeName, from, leaveType, savedLeaveKey, to]);

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

            router.replace(
                leaveDashboardHref({
                    from: row.startDateKey,
                    to: row.endDateKey,
                    approvalId: row.id,
                }),
            );
            if (row.id && row.startDateKey && row.endDateKey) {
                setSavedLeaveKey(`${row.employeeMongoId}|${row.startDateKey}|${row.endDateKey}`);
            }
        },
        [router],
    );

    const leaveBarClickTimerRef = useRef(null);

    const handleCalendarLeaveClick = useCallback((span) => {
        if (!span || span.isDraft || span.statusKey === 'draft_selection') return;
        if (leaveBarClickTimerRef.current) {
            window.clearTimeout(leaveBarClickTimerRef.current);
        }
        leaveBarClickTimerRef.current = window.setTimeout(() => {
            leaveBarClickTimerRef.current = null;
            setCalendarLeaveFocus({
                employeeMongoId: span.employeeMongoId,
                employeeName: span.employeeName,
                statusKey: span.statusKey,
                start: span.start,
                end: span.end || span.start,
                isPending: Boolean(span.isPending),
                nonce: Date.now(),
            });
            if (isValidDateKey(span.start)) {
                router.replace(
                    leaveDashboardHref({
                        from: span.start,
                        to: span.end || span.start,
                        approvalId: span.attendanceId || '',
                    }),
                );
            }
        }, 250);
    }, [router]);

    const handleCalendarLeaveDoubleClick = useCallback(
        (span) => {
            if (!span || span.isDraft || span.statusKey === 'draft_selection') return;
            if (leaveBarClickTimerRef.current) {
                window.clearTimeout(leaveBarClickTimerRef.current);
                leaveBarClickTimerRef.current = null;
            }
            const mongoId = String(span.employeeMongoId || '').trim();
            if (!mongoId) return;
            router.push(`/HRM/Leave/${encodeURIComponent(mongoId)}`);
        },
        [router],
    );

    useEffect(
        () => () => {
            if (leaveBarClickTimerRef.current) {
                window.clearTimeout(leaveBarClickTimerRef.current);
            }
        },
        [],
    );

    const handleAcceptRequest = useCallback(
        (row) => {
            if (!row?.id || !row.employeeMongoId) return;
            if (!isValidDateKey(row.startDateKey) || !isValidDateKey(row.endDateKey)) return;

            setSavedLeaveKey(`${row.employeeMongoId}|${row.startDateKey}|${row.endDateKey}`);
            router.replace(
                leaveDashboardHref({
                    from: row.startDateKey,
                    to: row.endDateKey,
                    approvalId: row.id,
                }),
            );
            setLeaveModalMode('approve');
            setApproveRequest(row);
            setModalOpen(true);
        },
        [router],
    );

    const handleEditRequest = useCallback(
        (row) => {
            if (!row?.id || !row.employeeMongoId) return;
            if (!isValidDateKey(row.startDateKey) || !isValidDateKey(row.endDateKey)) return;

            setSavedLeaveKey(`${row.employeeMongoId}|${row.startDateKey}|${row.endDateKey}`);
            router.replace(
                leaveDashboardHref({
                    from: row.startDateKey,
                    to: row.endDateKey,
                    approvalId: row.id,
                }),
            );
            setLeaveModalMode('edit');
            setApproveRequest(row);
            setModalOpen(true);
        },
        [router],
    );

    const modalEmployees = useMemo(() => {
        if (!approveRequest?.employeeMongoId) return enrolledEmployees;
        if (enrolledEmployees.some((row) => String(row._id) === String(approveRequest.employeeMongoId))) {
            return enrolledEmployees;
        }
        return [
            {
                _id: approveRequest.employeeMongoId,
                employeeId: approveRequest.employeeId || '',
                employeeName: approveRequest.name || 'Employee',
            },
            ...enrolledEmployees,
        ];
    }, [approveRequest, enrolledEmployees]);

    const isExistingLeaveModal = leaveModalMode === 'approve' || leaveModalMode === 'edit';

    return (
        <PermissionGuard moduleId="hrm_leave" permissionType="view">
            <div
                className="flex h-screen min-h-0 w-full max-w-full overflow-hidden"
                style={{ backgroundColor: '#F2F6F9' }}
            >
                <Sidebar />
                <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden">
                    <Navbar />
                    <div
                        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 sm:px-5 lg:px-8"
                        style={{ backgroundColor: '#F2F6F9' }}
                    >
                        <section className="flex min-h-full flex-col py-3 sm:py-5 lg:py-8">
                        <ErpPageHeader title="Leave Dashboard">
                            <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setPendingInboxModalOpen(true)}
                                className="relative p-1.5 sm:p-2 hover:bg-amber-50 rounded-lg transition-colors bg-white shadow-sm border border-amber-200/80 text-amber-800 shrink-0"
                                title="Leave notifications"
                            >
                                <Bell size={20} />
                                {pendingInboxCount > 0 ? (
                                    <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-black leading-none flex items-center justify-center border-2 border-white shadow-sm tabular-nums">
                                        {pendingInboxCount > 99 ? '99+' : pendingInboxCount}
                                    </span>
                                ) : null}
                            </button>
                            <label className="inline-flex items-center gap-2 text-sm text-[#555B65]">
                                <span className="font-medium">Year</span>
                                <select
                                    value={isAllLeaveYear(filterYear) ? ALL_LEAVE_YEAR : String(filterYear)}
                                    onChange={(event) => {
                                        const next = event.target.value;
                                        setFilterYear(next === ALL_LEAVE_YEAR ? ALL_LEAVE_YEAR : Number(next));
                                    }}
                                    className="min-w-[108px] rounded-lg border border-[#DDE3EA] bg-white px-3 py-2 text-sm font-medium text-[#344054] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                                    aria-label="Filter leave dashboard by year"
                                >
                                    <option value={ALL_LEAVE_YEAR}>ALL</option>
                                    {yearOptions.map((year) => (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <LeaveGroupFilterDropdown
                                groups={groupOptions}
                                employees={enrolledEmployees}
                                groupKey={filterGroup}
                                employeeId={employeeId}
                                menuLevel={groupMenuLevel}
                                onSelectGroup={handleSelectGroup}
                                onSelectEmployee={handleSelectGroupEmployee}
                                onReturn={handleReturnToGroups}
                            />
                            {selectedFilterEmployee ? (
                                <>
                                    {selectedEmployeeCode ? (
                                        <NavButton
                                            href={`/HRM/Salary/enroll/${encodeURIComponent(selectedEmployeeCode)}`}
                                            listReturnHref={leaveDashboardReturnHref}
                                            className="inline-flex items-center rounded-lg border border-[#DDE3EA] bg-white px-3 py-2 text-sm font-medium text-[#344054] shadow-sm hover:bg-slate-50"
                                        >
                                            Salary History
                                        </NavButton>
                                    ) : null}
                                    {String(selectedFilterEmployee._id || '').trim() ? (
                                        <NavButton
                                            href={`/HRM/Leave/${encodeURIComponent(String(selectedFilterEmployee._id).trim())}`}
                                            listReturnHref={leaveDashboardReturnHref}
                                            className="inline-flex items-center rounded-lg border border-[#DDE3EA] bg-white px-3 py-2 text-sm font-medium text-[#344054] shadow-sm hover:bg-slate-50"
                                        >
                                            Portal
                                        </NavButton>
                                    ) : null}
                                </>
                            ) : null}
                            </div>
                        </ErpPageHeader>

                        <LeaveDashboard
                            employees={enrolledEmployees}
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
                            yearMin={yearMin}
                            yearMax={yearMax}
                            onYearChange={setFilterYear}
                            groupKey={filterGroup}
                            groupEmployeeIds={groupEmployeeIds}
                            statusFilter={statusFilter}
                            onStatusFilterChange={setStatusFilter}
                            onApplyLeave={openApplyModal}
                            onLeaveInformation={() => router.push('/HRM/Leave')}
                            refreshKey={dashboardRefreshKey}
                            onDataChanged={() => setDashboardRefreshKey((value) => value + 1)}
                            onApprovalRowSelect={handleApprovalRowSelect}
                            onAcceptRequest={handleAcceptRequest}
                            onEditRequest={handleEditRequest}
                            calendarLeaveFocus={calendarLeaveFocus}
                        />
                        </section>

                        <section className="flex min-h-full flex-col pb-3 sm:pb-5 lg:pb-8">
                        <LeaveCalendarView
                            employeeId={employeeId}
                            from={from}
                            to={to}
                            approvalId={approvalId}
                            employeeName={employeeName}
                            year={filterYear}
                            yearMin={yearMin}
                            yearMax={yearMax}
                            onYearChange={setFilterYear}
                            groupEmployeeIds={groupEmployeeIds}
                            statusFilter={statusFilter}
                            onConfirm={openApplyModal}
                            onDraftRangeChange={handleDraftRangeChange}
                            onPendingRangeChange={handlePendingRangeChange}
                            refreshKey={dashboardRefreshKey}
                            confirming={confirming}
                            hideDraft
                            fillViewport
                            onLeaveBarClick={handleCalendarLeaveClick}
                            onLeaveBarDoubleClick={handleCalendarLeaveDoubleClick}
                        />
                        </section>
                    </div>
                </div>
            </div>

            <AnnualLeaveFilterModal
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setApproveRequest(null);
                    setLeaveModalMode('apply');
                }}
                employees={modalEmployees}
                salaryVisibility={salaryVisibility}
                initialEmployeeId={
                    isExistingLeaveModal && approveRequest?.employeeMongoId
                        ? approveRequest.employeeMongoId
                        : ''
                }
                initialStartDate={
                    isExistingLeaveModal && approveRequest?.startDateKey
                        ? approveRequest.startDateKey
                        : from
                }
                initialEndDate={
                    isExistingLeaveModal && approveRequest?.endDateKey
                        ? approveRequest.endDateKey
                        : to
                }
                initialLeaveMode={
                    isExistingLeaveModal && approveRequest
                        ? leaveModeFromStatusKey(approveRequest.requestedStatusKey)
                        : leaveType
                }
                onApply={handleModalApply}
                onReject={handleModalReject}
                showReject={isExistingLeaveModal}
                applyLabel={leaveModalMode === 'edit' ? 'Save' : leaveModalMode === 'approve' ? 'Approve' : 'Apply'}
                modalTitle={
                    leaveModalMode === 'edit'
                        ? 'Edit Leave'
                        : leaveModalMode === 'approve'
                          ? 'Approve Leave'
                          : 'Apply Leave'
                }
                requestedLeaveLabel={
                    isExistingLeaveModal ? approveRequest?.leaveType || '' : ''
                }
                requestedDateLabel={
                    isExistingLeaveModal && approveRequest?.startDate && approveRequest?.endDate
                        ? `${approveRequest.startDate} → ${approveRequest.endDate}`
                        : ''
                }
                submitting={confirming}
            />
            <PendingLeaveRequestsModal
                isOpen={pendingInboxModalOpen}
                onClose={() => setPendingInboxModalOpen(false)}
                onRefreshParent={() => setDashboardRefreshKey((value) => value + 1)}
                onPendingInboxCount={setPendingInboxCount}
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
