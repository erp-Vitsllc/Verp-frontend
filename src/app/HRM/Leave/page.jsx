'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronDown, Wallet } from 'lucide-react';
import Select from 'react-select';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import SortableTh, { compareSortValues, toggleSortState } from '@/components/SortableTh';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import axiosInstance from '@/utils/axios';
import { leaveMetaForStatus } from './utils/leaveCalendarUtils';
import {
    filterLeaveEntriesBySalary,
    useLeaveSalaryVisibility,
} from './utils/leaveSalaryVisibility';
import useWorkLocations from '@/hooks/useWorkLocations';
import { normalizeWorkLocationKey } from '@/utils/workLocations';

function isCompanyShellEmployee(emp) {
    const last = String(emp?.lastName || '').trim();
    if (/^\(company\)$/i.test(last)) return true;
    const full = `${emp?.firstName || ''} ${emp?.lastName || ''} ${emp?.employeeName || ''}`.trim();
    return /\(company\)\s*$/i.test(full);
}

function employeeDisplayName(emp) {
    if (emp?.employeeName) return String(emp.employeeName).trim();
    return [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim();
}

function normalizeStaffType(value) {
    return normalizeWorkLocationKey(value);
}

function mapEmployeeFallback(emp) {
    return {
        _id: String(emp?._id || emp?.employeeId || ''),
        employeeId: emp?.employeeId || '',
        employeeName: employeeDisplayName(emp),
        staffType: normalizeStaffType(emp?.staffType),
        dateOfJoining: (() => {
            const raw = emp?.dateOfJoining;
            if (!raw) return '';
            if (/^\d{4}-\d{2}-\d{2}/.test(String(raw))) return String(raw).slice(0, 10);
            const join = new Date(raw);
            if (Number.isNaN(join.getTime())) return '';
            return formatDateKey(join);
        })(),
        authorizedLeave: Number(emp?.authorizedLeave) || 0,
        unauthorizedLeave: Number(emp?.unauthorizedLeave) || 0,
        sickLeave: Number(emp?.sickLeave) || 0,
        compoffLeave: Number(emp?.compoffLeave) || 0,
        annualLeaveTaken: Number(emp?.annualLeaveTaken) || 0,
    };
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function formatDateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function lastDayOfMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

function monthKeyToRange(fromYm, toYm) {
    if (!/^\d{4}-\d{2}$/.test(fromYm) || !/^\d{4}-\d{2}$/.test(toYm) || fromYm > toYm) return null;
    const [toYear, toMonth] = toYm.split('-').map(Number);
    return {
        from: `${fromYm}-01`,
        to: `${toYm}-${pad2(lastDayOfMonth(toYear, toMonth - 1))}`,
    };
}

function resolvePeriodRange(periodKey, customFromMonth, customToMonth) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (periodKey === 'current_month') {
        return {
            from: `${year}-${pad2(month + 1)}-01`,
            to: `${year}-${pad2(month + 1)}-${pad2(lastDayOfMonth(year, month))}`,
        };
    }

    if (periodKey === 'prev_month') {
        const prev = new Date(year, month - 1, 1);
        const prevYear = prev.getFullYear();
        const prevMonth = prev.getMonth();
        return {
            from: `${prevYear}-${pad2(prevMonth + 1)}-01`,
            to: `${prevYear}-${pad2(prevMonth + 1)}-${pad2(lastDayOfMonth(prevYear, prevMonth))}`,
        };
    }

    if (periodKey === 'current_year') {
        return { from: `${year}-01-01`, to: `${year}-12-31` };
    }

    if (periodKey === 'prev_year') {
        const prevYear = year - 1;
        return { from: `${prevYear}-01-01`, to: `${prevYear}-12-31` };
    }

    if (periodKey === 'custom') {
        return monthKeyToRange(customFromMonth, customToMonth) || {
            from: `${year}-${pad2(month + 1)}-01`,
            to: `${year}-${pad2(month + 1)}-${pad2(lastDayOfMonth(year, month))}`,
        };
    }

    return {
        from: `${year}-${pad2(month + 1)}-01`,
        to: `${year}-${pad2(month + 1)}-${pad2(lastDayOfMonth(year, month))}`,
    };
}

const PERIOD_OPTIONS = [
    { key: 'current_month', label: 'Current month' },
    { key: 'current_year', label: 'Current year' },
    { key: 'prev_month', label: 'Previous month' },
    { key: 'prev_year', label: 'Previous year' },
    { key: 'custom', label: 'Custom' },
];

const TABLE_COLUMNS = [
    { key: 'slNo', label: 'SL No' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'authorizedLeave', label: 'Authorize Leave' },
    { key: 'unauthorizedLeave', label: 'Unauthorized Leave' },
    { key: 'sickLeave', label: 'Sick Leave' },
    { key: 'compoffLeave', label: 'Comp Off Leave' },
    { key: 'annualLeaveTaken', label: 'Annual Leave Taken' },
];

const DETAIL_COLUMNS = [
    { key: 'slNo', label: 'SL No' },
    { key: 'leaveType', label: 'Leave Type' },
    { key: 'dateTaken', label: 'Date Taken' },
];

function formatDisplayDate(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return dateKey || '—';
    try {
        const [year, month, day] = dateKey.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return dateKey;
    }
}

function formatRangeLabel(from, to) {
    if (from === to) return formatDisplayDate(from);
    return `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`;
}

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: 10,
        borderColor: state.isFocused ? '#3b82f6' : '#e5e7eb',
        backgroundColor: '#ffffff',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
        '&:hover': { borderColor: '#d1d5db' },
    }),
    valueContainer: (base) => ({ ...base, padding: '0 10px' }),
    menu: (base) => ({ ...base, borderRadius: 10, overflow: 'hidden', zIndex: 100002 }),
    menuPortal: (base) => ({ ...base, zIndex: 100002 }),
    option: (base, state) => ({
        ...base,
        fontSize: 13,
        backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : 'white',
        color: state.isSelected ? 'white' : '#111827',
    }),
    singleValue: (base) => ({ ...base, fontSize: 13, color: '#374151' }),
    placeholder: (base) => ({ ...base, fontSize: 13, color: '#9ca3af' }),
};

function CustomMonthRangeModal({
    open,
    fromMonth,
    toMonth,
    error,
    onChangeFrom,
    onChangeTo,
    onCancel,
    onOk,
}) {
    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-black/30"
                onClick={onCancel}
            />
            <div
                className="relative z-[101] w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <h3 className="mb-4 text-center text-base font-bold text-gray-900">Custom period</h3>
                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">
                            Start month
                        </label>
                        <MonthYearPicker
                            value={fromMonth}
                            valueFormat="yyyy-MM"
                            onChange={(value) => value && onChangeFrom(String(value).slice(0, 7))}
                            placeholder="Start month"
                            className="h-10 w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">
                            End month
                        </label>
                        <MonthYearPicker
                            value={toMonth}
                            valueFormat="yyyy-MM"
                            onChange={(value) => value && onChangeTo(String(value).slice(0, 7))}
                            placeholder="End month"
                            className="h-10 w-full text-sm"
                        />
                    </div>
                    {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onOk}
                            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

export default function LeavePage() {
    const router = useRouter();
    const { tabs: staffTabs } = useWorkLocations();
    const [rows, setRows] = useState([]);
    const salaryVisibility = useLeaveSalaryVisibility();
    const [detailLeaves, setDetailLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState('slNo');
    const [sortDirection, setSortDirection] = useState('asc');
    const [staffTab, setStaffTab] = useState('all');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [periodKey, setPeriodKey] = useState('current_month');
    const [customFromMonth, setCustomFromMonth] = useState(() => `${new Date().getFullYear()}-01`);
    const [customToMonth, setCustomToMonth] = useState(() => currentMonthKey());
    const [filterOpen, setFilterOpen] = useState(false);
    const [customModalOpen, setCustomModalOpen] = useState(false);
    const [draftFromMonth, setDraftFromMonth] = useState(() => `${new Date().getFullYear()}-01`);
    const [draftToMonth, setDraftToMonth] = useState(() => currentMonthKey());
    const [customError, setCustomError] = useState('');
    const filterRef = useRef(null);

    const periodRange = useMemo(
        () => resolvePeriodRange(periodKey, customFromMonth, customToMonth),
        [periodKey, customFromMonth, customToMonth],
    );

    const isEmployeeFiltered = Boolean(selectedEmployeeId);

    const openProfilePage = useCallback(
        (mongoId) => {
            if (!mongoId) return;
            router.push(`/HRM/Leave/${mongoId}`);
        },
        [router],
    );

    const fetchDirectory = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get('/Leave/employees', {
                params: { from: periodRange.from, to: periodRange.to },
                skipToast: true,
            });
            const list = Array.isArray(response.data?.employees) ? response.data.employees : [];
            setRows(list.map(mapEmployeeFallback));
        } catch (err) {
            try {
                const fallback = await axiosInstance.get('/Employee', {
                    params: { limit: 1000 },
                    skipToast: true,
                });
                const list = (fallback.data?.employees || []).filter(
                    (emp) =>
                        emp?.employeeId !== 'VEGA-HR-0000' &&
                        emp?.status !== 'Left User' &&
                        !isCompanyShellEmployee(emp),
                );
                setRows(list.map(mapEmployeeFallback));
                setError('');
            } catch (fallbackErr) {
                setRows([]);
                setError(
                    err?.response?.data?.message ||
                        fallbackErr?.response?.data?.message ||
                        err.message ||
                        'Failed to fetch employee leave records',
                );
            }
        } finally {
            setLoading(false);
        }
    }, [periodRange.from, periodRange.to]);

    useEffect(() => {
        fetchDirectory();
    }, [fetchDirectory]);

    const fetchEmployeeLeaves = useCallback(async () => {
        if (!selectedEmployeeId) {
            setDetailLeaves([]);
            return;
        }

        setDetailLoading(true);
        try {
            const response = await axiosInstance.get('/Leave/calendar', {
                params: {
                    from: periodRange.from,
                    to: periodRange.to,
                    leaveType: 'all',
                    employeeId: selectedEmployeeId,
                },
                skipToast: true,
            });
            const entries = Array.isArray(response.data?.entries) ? response.data.entries : [];
            const leaveStatusKeys = new Set([
                'authorized_leave',
                'unauthorized_leave',
                'sick_leave',
                'compoff_leave',
                'on_leave',
            ]);
            const filtered = filterLeaveEntriesBySalary(entries, salaryVisibility)
                .filter((entry) => String(entry.employeeMongoId || '') === String(selectedEmployeeId))
                .filter((entry) => !entry.isPending)
                .filter((entry) => leaveStatusKeys.has(String(entry.statusKey || '')))
                .map((entry) => ({
                    id: entry.id || `${entry.date}-${entry.statusKey}`,
                    date: entry.date,
                    statusKey: entry.statusKey,
                    leaveType: leaveMetaForStatus(entry.statusKey).label,
                    employeeName: entry.employeeName || '',
                }))
                .sort((a, b) => String(a.date).localeCompare(String(b.date)));
            setDetailLeaves(filtered);
        } catch {
            setDetailLeaves([]);
        } finally {
            setDetailLoading(false);
        }
    }, [periodRange.from, periodRange.to, salaryVisibility, selectedEmployeeId]);

    useEffect(() => {
        fetchEmployeeLeaves();
    }, [fetchEmployeeLeaves]);

    const selectedEmployee = useMemo(
        () => rows.find((row) => String(row._id) === String(selectedEmployeeId)) || null,
        [rows, selectedEmployeeId],
    );

    const handleCustomFromMonthChange = useCallback((value) => {
        const next = String(value || '').slice(0, 7);
        setCustomFromMonth(next);
        setCustomToMonth((prev) => (prev && next > prev ? next : prev));
    }, []);

    const handleCustomToMonthChange = useCallback((value) => {
        const next = String(value || '').slice(0, 7);
        setCustomToMonth(next);
        setCustomFromMonth((prev) => (prev && next < prev ? next : prev));
    }, []);

    const openCustomModal = useCallback(() => {
        setDraftFromMonth(customFromMonth);
        setDraftToMonth(customToMonth);
        setCustomError('');
        setFilterOpen(false);
        setCustomModalOpen(true);
    }, [customFromMonth, customToMonth]);

    const handlePeriodSelect = useCallback(
        (key) => {
            if (key === 'custom') {
                openCustomModal();
                return;
            }
            setPeriodKey(key);
            setFilterOpen(false);
        },
        [openCustomModal],
    );

    const handleCustomOk = useCallback(() => {
        if (!/^\d{4}-\d{2}$/.test(draftFromMonth) || !/^\d{4}-\d{2}$/.test(draftToMonth)) {
            setCustomError('Please select start and end month.');
            return;
        }
        if (draftFromMonth > draftToMonth) {
            setCustomError('End month must be on or after start month.');
            return;
        }
        setCustomFromMonth(draftFromMonth);
        setCustomToMonth(draftToMonth);
        setPeriodKey('custom');
        setCustomError('');
        setCustomModalOpen(false);
    }, [draftFromMonth, draftToMonth]);

    const enrolledRows = useMemo(() => {
        if (!salaryVisibility.ready) return rows;
        return rows.filter(
            (row) =>
                salaryVisibility.byMongoId.has(String(row._id || '')) ||
                salaryVisibility.byEmployeeId.has(String(row.employeeId || '').trim()),
        );
    }, [rows, salaryVisibility]);

    const employeeOptions = useMemo(
        () => [
            { value: '', label: 'All employees' },
            ...enrolledRows.map((row) => ({
                value: row._id,
                label: `${row.employeeName || 'Employee'}${row.employeeId ? ` (${row.employeeId})` : ''}`,
            })),
        ],
        [enrolledRows],
    );

    const selectedEmployeeOption =
        employeeOptions.find((option) => option.value === selectedEmployeeId) || employeeOptions[0];

    const filteredRows = useMemo(() => {
        if (staffTab === 'all') return enrolledRows;
        return enrolledRows.filter((row) => normalizeStaffType(row.staffType) === staffTab);
    }, [enrolledRows, staffTab]);

    const sortedRows = useMemo(() => {
        const list = [...filteredRows];
        const getVal = (row, index) => {
            switch (sortKey) {
                case 'slNo':
                    return index;
                case 'employeeName':
                    return row.employeeName || '';
                case 'employeeId':
                    return row.employeeId || '';
                case 'authorizedLeave':
                    return Number(row.authorizedLeave) || 0;
                case 'unauthorizedLeave':
                    return Number(row.unauthorizedLeave) || 0;
                case 'sickLeave':
                    return Number(row.sickLeave) || 0;
                case 'compoffLeave':
                    return Number(row.compoffLeave) || 0;
                case 'annualLeaveTaken':
                    return Number(row.annualLeaveTaken) || 0;
                default:
                    return row.employeeName || '';
            }
        };

        if (sortKey === 'slNo') {
            if (sortDirection === 'desc') list.reverse();
            return list;
        }

        list.sort((a, b) => compareSortValues(getVal(a), getVal(b), sortDirection));
        return list;
    }, [filteredRows, sortKey, sortDirection]);

    const sortedDetailLeaves = useMemo(() => {
        const list = [...detailLeaves];
        if (sortKey === 'leaveType') {
            list.sort((a, b) => compareSortValues(a.leaveType, b.leaveType, sortDirection));
            return list;
        }
        if (sortKey === 'dateTaken') {
            list.sort((a, b) => compareSortValues(a.date, b.date, sortDirection));
            return list;
        }
        if (sortDirection === 'desc') list.reverse();
        return list;
    }, [detailLeaves, sortKey, sortDirection]);

    const handleSort = useCallback(
        (key) => {
            const next = toggleSortState(sortKey, sortDirection, key);
            setSortKey(next.sortKey);
            setSortDirection(next.sortDirection);
        },
        [sortKey, sortDirection],
    );

    const handleEmployeeChange = useCallback((option) => {
        setSelectedEmployeeId(option?.value || '');
        setSortKey('slNo');
        setSortDirection('asc');
    }, []);

    useEffect(() => {
        if (!filterOpen) return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape') setFilterOpen(false);
        };
        const onDoc = (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (filterRef.current?.contains(target)) return;
            setFilterOpen(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDoc);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDoc);
        };
    }, [filterOpen]);

    useEffect(() => {
        if (!customModalOpen) return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape') {
                setCustomModalOpen(false);
                setCustomError('');
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [customModalOpen]);

    const periodLabel = PERIOD_OPTIONS.find((option) => option.key === periodKey)?.label || 'Filter';

    const activeColumns = isEmployeeFiltered ? DETAIL_COLUMNS : TABLE_COLUMNS;
    const tableLoading = isEmployeeFiltered ? detailLoading : loading;
    const tableRows = isEmployeeFiltered ? sortedDetailLeaves : sortedRows;
    const detailTitle = selectedEmployee
        ? `${selectedEmployee.employeeName || 'Employee'}'s leaves on (${formatRangeLabel(periodRange.from, periodRange.to)})`
        : selectedEmployeeOption?.value
          ? `${String(selectedEmployeeOption.label || 'Employee').replace(/\s*\([^)]*\)\s*$/, '')}'s leaves on (${formatRangeLabel(periodRange.from, periodRange.to)})`
          : `Leaves on (${formatRangeLabel(periodRange.from, periodRange.to)})`;

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
                        <ErpPageHeader title="Employees Leave">
                            <button
                                type="button"
                                onClick={() => router.push('/HRM/Leave/annual-leave')}
                                className="bg-white hover:bg-slate-50 text-slate-700 px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap border border-gray-800/20"
                            >
                                Leave Dashboard
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/HRM/Leave/salary-policy')}
                                className="bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap"
                            >
                                <Wallet size={18} />
                                Salary Policy
                            </button>
                        </ErpPageHeader>

                        <div className="mt-3 mb-3 space-y-2">
                            {!isEmployeeFiltered ? (
                                <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 w-full sm:w-fit">
                                    <button
                                        type="button"
                                        onClick={() => setStaffTab('all')}
                                        className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition-all sm:text-sm ${
                                            staffTab === 'all'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                                        }`}
                                    >
                                        All
                                    </button>
                                    {staffTabs.map((tab) => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setStaffTab(tab.key)}
                                            className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition-all sm:text-sm ${
                                                staffTab === tab.key
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <h2 className="text-sm font-semibold text-slate-800 sm:text-base">
                                    {detailTitle}
                                </h2>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative z-20 w-[240px] min-w-[200px] shrink-0">
                                    <Select
                                        instanceId="employees-leave-filter-select"
                                        classNamePrefix="el-leave-filter"
                                        options={employeeOptions}
                                        value={selectedEmployeeOption}
                                        onChange={handleEmployeeChange}
                                        placeholder="Select employee"
                                        isSearchable
                                        styles={selectStyles}
                                        menuPortalTarget={
                                            typeof document !== 'undefined' ? document.body : null
                                        }
                                        menuPosition="fixed"
                                        menuShouldScrollIntoView={false}
                                        noOptionsMessage={() => 'No employees found'}
                                    />
                                </div>

                                <div className="relative" ref={filterRef}>
                                    <button
                                        type="button"
                                        onClick={() => setFilterOpen((open) => !open)}
                                        aria-expanded={filterOpen}
                                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                                    >
                                        <CalendarDays size={16} className="shrink-0 text-slate-500" />
                                        <span>{periodLabel}</span>
                                        <ChevronDown
                                            size={16}
                                            className={`shrink-0 text-slate-400 transition-transform ${
                                                filterOpen ? 'rotate-180' : ''
                                            }`}
                                        />
                                    </button>

                                    {filterOpen ? (
                                        <div className="absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white p-1 shadow-lg">
                                            {PERIOD_OPTIONS.map((option) => {
                                                const active = periodKey === option.key;
                                                return (
                                                    <button
                                                        key={option.key}
                                                        type="button"
                                                        onClick={() => handlePeriodSelect(option.key)}
                                                        className={`mb-1 flex w-full last:mb-0 items-center rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                                                            active
                                                                ? 'bg-blue-600 text-white'
                                                                : 'text-slate-700 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                </div>

                                {periodKey === 'custom' ? (
                                    <>
                                        <div className="w-[168px] shrink-0">
                                            <MonthYearPicker
                                                value={customFromMonth}
                                                valueFormat="yyyy-MM"
                                                onChange={(value) =>
                                                    value && handleCustomFromMonthChange(String(value).slice(0, 7))
                                                }
                                                placeholder="Start month"
                                                className="h-10 w-full rounded-lg text-sm"
                                            />
                                        </div>
                                        <div className="w-[168px] shrink-0">
                                            <MonthYearPicker
                                                value={customToMonth}
                                                valueFormat="yyyy-MM"
                                                onChange={(value) =>
                                                    value && handleCustomToMonthChange(String(value).slice(0, 7))
                                                }
                                                placeholder="End month"
                                                className="h-10 w-full rounded-lg text-sm"
                                            />
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </div>

                        <CustomMonthRangeModal
                            open={customModalOpen}
                            fromMonth={draftFromMonth}
                            toMonth={draftToMonth}
                            error={customError}
                            onChangeFrom={(value) => {
                                setDraftFromMonth(value);
                                setDraftToMonth((prev) => (prev && value > prev ? value : prev));
                                setCustomError('');
                            }}
                            onChangeTo={(value) => {
                                setDraftToMonth(value);
                                setDraftFromMonth((prev) => (prev && value < prev ? value : prev));
                                setCustomError('');
                            }}
                            onCancel={() => {
                                setCustomModalOpen(false);
                                setCustomError('');
                            }}
                            onOk={handleCustomOk}
                        />

                        {error ? (
                            <ErpErrorBanner
                                className="mb-4"
                                message={error}
                                onRetry={fetchDirectory}
                            />
                        ) : null}

                        <div className="w-full max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                            <div className="w-full max-w-full overflow-x-auto">
                                <table
                                    className={`w-full table-auto text-xs sm:text-sm lg:min-w-0 ${
                                        isEmployeeFiltered ? 'min-w-[420px]' : 'min-w-[720px]'
                                    }`}
                                >
                                    <thead className="border-b border-gray-200 bg-gray-50">
                                        <tr>
                                            {activeColumns.map((col) => (
                                                <SortableTh
                                                    key={col.key}
                                                    label={col.label}
                                                    sortKey={col.key}
                                                    activeKey={sortKey}
                                                    direction={sortDirection}
                                                    onSort={handleSort}
                                                    className={col.key === 'slNo' ? 'w-14 sm:w-16' : ''}
                                                />
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {tableLoading ? (
                                            <tr>
                                                <td
                                                    colSpan={activeColumns.length}
                                                    className="px-2 py-6 text-center text-xs text-gray-500 sm:px-4 sm:py-8 sm:text-sm lg:px-6"
                                                >
                                                    {isEmployeeFiltered
                                                        ? 'Loading leave days...'
                                                        : 'Loading employee leave...'}
                                                </td>
                                            </tr>
                                        ) : tableRows.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={activeColumns.length}
                                                    className="px-2 py-6 text-center text-xs text-gray-500 sm:px-4 sm:py-8 sm:text-sm lg:px-6"
                                                >
                                                    {isEmployeeFiltered
                                                        ? 'No leave days found for this employee in the selected period.'
                                                        : staffTab === 'all'
                                                          ? 'No employees found.'
                                                          : staffTab === 'site'
                                                            ? 'No site staffs found.'
                                                            : 'No staff found.'}
                                                </td>
                                            </tr>
                                        ) : isEmployeeFiltered ? (
                                            tableRows.map((row, index) => (
                                                <tr
                                                    key={row.id || `${row.date}-${row.statusKey}-${index}`}
                                                    className="transition-colors hover:bg-gray-50"
                                                >
                                                    <td className="whitespace-nowrap px-2 py-2 text-xs tabular-nums text-gray-500 sm:px-4 sm:py-3 sm:text-sm lg:px-6">
                                                        {index + 1}
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-xs font-medium text-gray-900 sm:px-4 sm:py-3 sm:text-sm lg:px-6">
                                                        {row.leaveType || 'Leave'}
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-700 sm:px-4 sm:py-3 sm:text-sm lg:px-6">
                                                        {formatDisplayDate(row.date)}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            tableRows.map((row, index) => (
                                                <tr
                                                    key={row._id || row.employeeId || index}
                                                    className="cursor-pointer transition-colors hover:bg-gray-50"
                                                    onClick={() => openProfilePage(row._id)}
                                                >
                                                    <td className="whitespace-nowrap px-2 py-2 text-xs tabular-nums text-gray-500 sm:px-4 sm:py-3 sm:text-sm lg:px-6">
                                                        {index + 1}
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-xs font-medium text-gray-900 sm:px-4 sm:py-3 sm:text-sm lg:px-6">
                                                        {row.employeeName || 'N/A'}
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-700 sm:px-4 sm:py-3 sm:text-sm lg:px-6">
                                                        {row.employeeId || 'N/A'}
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-xs tabular-nums text-gray-700 sm:px-4 sm:py-3 sm:text-sm lg:px-6">
                                                        {row.authorizedLeave}
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-xs tabular-nums text-gray-700 sm:px-4 sm:py-3 sm:text-sm lg:px-6">
                                                        {row.unauthorizedLeave}
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-xs tabular-nums text-gray-700 sm:px-4 sm:py-3 sm:text-sm lg:px-6">
                                                        {row.sickLeave}
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-xs tabular-nums text-gray-700 sm:px-4 sm:py-3 sm:text-sm lg:px-6">
                                                        {row.compoffLeave}
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-2 text-xs tabular-nums text-gray-700 sm:px-4 sm:py-3 sm:text-sm lg:px-6">
                                                        {row.annualLeaveTaken}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
