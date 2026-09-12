'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Select from 'react-select';
import { DatePicker } from '@/components/ui/date-picker';
import axiosInstance from '@/utils/axios';
import {
    processingStartForEmployee,
    useLeaveSalaryVisibility,
} from '../utils/leaveSalaryVisibility';

function dateKeyToLocalDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day);
}

function laterDateKey(a, b) {
    if (a && b) return a >= b ? a : b;
    return a || b || '';
}

function formatDateLabel(value) {
    const date = dateKeyToLocalDate(value);
    if (!date) return value || '';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function disabledDaysBefore(dateKey) {
    const date = dateKeyToLocalDate(dateKey);
    return date ? { before: date } : undefined;
}

function storedViewerUser() {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem('user') || localStorage.getItem('employeeUser');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function viewerIsDesignatedFlowchartHr(user, holder) {
    if (!user || !holder?.ok) return false;
    const holderId = String(holder.empObjectId || '').trim();
    const myIds = [
        user.employeeObjectId,
        user.empObjectId,
        user._id,
        user.id,
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    if (holderId && myIds.includes(holderId)) return true;
    const myEid = String(user.employeeId || '').trim().toLowerCase().replace(/\s+/g, '');
    const hrEid = String(holder.employeeId || '').trim().toLowerCase().replace(/\s+/g, '');
    return Boolean(myEid && hrEid && myEid === hrEid);
}

const LEAVE_TYPE_OPTIONS = [
    { value: 'annual', label: 'Annual Leave' },
    { value: 'authorized', label: 'Authorized Leave' },
];

const LEAVE_TYPE_VALUES = new Set(LEAVE_TYPE_OPTIONS.map((opt) => opt.value));

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: 10,
        borderColor: state.isFocused ? '#3b82f6' : '#e5e7eb',
        backgroundColor: '#f9fafb',
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

export default function AnnualLeaveFilterModal({
    open,
    onClose,
    employees = [],
    initialEmployeeId = '',
    initialStartDate = '',
    initialEndDate = '',
    initialLeaveMode = 'annual',
    onApply,
    applyLabel = 'Apply',
    modalTitle = 'Apply Leave',
    submitting = false,
    salaryVisibility: salaryVisibilityProp,
    requestedLeaveLabel = '',
    requestedDateLabel = '',
    showReject = false,
    onReject,
    rejectLabel = 'Reject',
    enableAnnualEligibilityGate = false,
}) {
    const rootRef = useRef(null);
    const loadedSalaryVisibility = useLeaveSalaryVisibility();
    const salaryVisibility = salaryVisibilityProp?.ready ? salaryVisibilityProp : loadedSalaryVisibility;
    const [employeeId, setEmployeeId] = useState(initialEmployeeId);
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [leaveMode, setLeaveMode] = useState('annual');
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);
    const [isDesignatedHr, setIsDesignatedHr] = useState(false);
    const [hrOverride, setHrOverride] = useState(false);
    const [eligibility, setEligibility] = useState(null);
    const [eligibilityLoading, setEligibilityLoading] = useState(false);
    const [datesBlink, setDatesBlink] = useState(false);
    const [dateEditMode, setDateEditMode] = useState(false);
    const isApplyMode = applyLabel === 'Apply' && !showReject;
    const showHrOverride = isApplyMode && isDesignatedHr;
    const showAnnualEligibility =
        enableAnnualEligibilityGate && leaveMode === 'annual' && Boolean(employeeId);
    const notEligible = Boolean(showAnnualEligibility && eligibility?.notEligible && !hrOverride);
    const showNotEligibleGate = Boolean(notEligible && !dateEditMode);

    const selectedEmployee = useMemo(
        () => employees.find((emp) => String(emp._id) === String(employeeId)) || null,
        [employeeId, employees],
    );

    const processingStartDate = useMemo(
        () =>
            processingStartForEmployee(
                salaryVisibility,
                employeeId,
                selectedEmployee?.employeeId,
            ),
        [employeeId, salaryVisibility, selectedEmployee?.employeeId],
    );

    const selectedLeaveTypeOption =
        LEAVE_TYPE_OPTIONS.find((opt) => opt.value === leaveMode) || LEAVE_TYPE_OPTIONS[0];

    const employeeOptions = useMemo(
        () =>
            employees.map((emp) => ({
                value: emp._id,
                label: `${emp.employeeName || 'Employee'}${emp.employeeId ? ` (${emp.employeeId})` : ''}`,
            })),
        [employees],
    );

    const selectedEmployeeOption =
        employeeOptions.find((opt) => opt.value === employeeId) || null;

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) return;
        setEmployeeId(initialEmployeeId || '');
        setStartDate(initialStartDate || '');
        setEndDate(initialEndDate || '');
        setLeaveMode(LEAVE_TYPE_VALUES.has(initialLeaveMode) ? initialLeaveMode : 'annual');
        setError('');
        setHrOverride(false);
        setEligibility(null);
        setDatesBlink(false);
        setDateEditMode(false);
    }, [open, initialEmployeeId, initialStartDate, initialEndDate, initialLeaveMode]);

    useEffect(() => {
        if (!open || !isApplyMode) {
            setIsDesignatedHr(false);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            try {
                const { data } = await axiosInstance.get('/Flowchart/active-holder/hr', { skipToast: true });
                if (!cancelled) setIsDesignatedHr(viewerIsDesignatedFlowchartHr(storedViewerUser(), data));
            } catch {
                if (!cancelled) setIsDesignatedHr(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isApplyMode, open]);

    useEffect(() => {
        if (!open || !showAnnualEligibility) {
            setEligibility(null);
            return undefined;
        }
        let cancelled = false;
        setEligibilityLoading(true);
        (async () => {
            try {
                const { data } = await axiosInstance.get(
                    `/Leave/employees/${employeeId}/annual-eligibility`,
                    {
                        skipToast: true,
                        params:
                            startDate && endDate
                                ? { from: startDate, to: endDate }
                                : {},
                    },
                );
                if (!cancelled) {
                    setEligibility({
                        lastAnnualLeaveEnd: String(data?.lastAnnualLeaveEnd || ''),
                        lastAnnualLeaveDays: Number(data?.lastAnnualLeaveDays) || 0,
                        eligibleDays: Number(data?.eligibleDays) || 0,
                        requiredDays: Number(data?.requiredDays) || 0,
                        notEligible: Boolean(data?.notEligible),
                        groupCap: data?.groupCap && typeof data.groupCap === 'object' ? data.groupCap : null,
                    });
                }
            } catch {
                if (!cancelled) setEligibility(null);
            } finally {
                if (!cancelled) setEligibilityLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [employeeId, endDate, open, showAnnualEligibility, startDate]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    useEffect(() => {
        if (!open || !processingStartDate || hrOverride) return;
        setStartDate((current) => (current && current < processingStartDate ? '' : current));
        setEndDate((current) => (current && current < processingStartDate ? '' : current));
    }, [open, employeeId, hrOverride, processingStartDate]);

    const submitLeave = (sendToHr = false) => {
        if (submitting) return;
        if (!employeeId) {
            setError('Please select an employee.');
            return;
        }
        if (!startDate || !endDate) {
            setError('Please select start and end dates.');
            return;
        }
        if (processingStartDate && startDate < processingStartDate && !hrOverride) {
            setError(
                `Start date cannot be before this employee's salary processing date (${formatDateLabel(processingStartDate)}).`,
            );
            return;
        }
        if (endDate < startDate) {
            setError('End date must be on or after start date.');
            return;
        }

        if (notEligible && !sendToHr) {
            setDateEditMode(false);
            return;
        }

        setError('');
        onApply?.({
            employeeId,
            startDate,
            endDate,
            employee: selectedEmployee,
            leaveMode,
            hrOverride: Boolean(showHrOverride && hrOverride),
            sendToHr: Boolean(sendToHr && notEligible),
        });
    };

    const handleSubmit = () => submitLeave(false);

    const handleChangeDate = () => {
        setDateEditMode(true);
        setDatesBlink(true);
        window.setTimeout(() => setDatesBlink(false), 2200);
    };

    const handleReject = () => {
        if (submitting) return;
        onReject?.({
            employeeId,
            startDate,
            endDate,
            employee: selectedEmployee,
            leaveMode,
        });
    };

    if (!mounted || !open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-black/30"
                onClick={() => onClose?.()}
            />
            <div
                ref={rootRef}
                className="relative z-[101] w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <h3 className="mb-4 text-center text-base font-bold text-gray-900">{modalTitle}</h3>
                {requestedLeaveLabel ? (
                    <div className="mb-3 rounded-lg border border-[#DDE3EA] bg-[#F8FAFC] px-3 py-2 text-center text-xs text-[#475467]">
                        Requested:{' '}
                        <span className="font-semibold text-[#111827]">{requestedLeaveLabel}</span>
                        {requestedDateLabel ? (
                            <span className="mt-0.5 block text-[11px] text-[#667085]">
                                {requestedDateLabel}
                            </span>
                        ) : null}
                    </div>
                ) : null}

                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">
                            Employee
                        </label>
                        <Select
                            instanceId="annual-leave-employee-select"
                            options={employeeOptions}
                            value={selectedEmployeeOption}
                            onChange={(option) => {
                                const nextId = option?.value || '';
                                const emp =
                                    employees.find((row) => String(row._id) === String(nextId)) ||
                                    null;
                                const minDate = processingStartForEmployee(
                                    salaryVisibility,
                                    nextId,
                                    emp?.employeeId,
                                );
                                setEmployeeId(nextId);
                                setDateEditMode(false);
                                setStartDate((current) =>
                                    hrOverride || !(minDate && current && current < minDate) ? current : '',
                                );
                                setEndDate((current) =>
                                    hrOverride || !(minDate && current && current < minDate) ? current : '',
                                );
                                setError('');
                            }}
                            placeholder="Select employee"
                            isClearable
                            isSearchable
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                            menuPlacement="auto"
                            noOptionsMessage={() => 'No employees found'}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">
                            Leave type
                        </label>
                        <Select
                            instanceId="annual-leave-type-select"
                            options={LEAVE_TYPE_OPTIONS}
                            value={selectedLeaveTypeOption}
                            onChange={(option) => {
                                setLeaveMode(
                                    LEAVE_TYPE_VALUES.has(option?.value) ? option.value : 'annual',
                                );
                                setDateEditMode(false);
                                setError('');
                            }}
                            isSearchable={false}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                            menuPlacement="auto"
                        />
                    </div>

                    <div
                        className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
                            datesBlink ? 'leave-date-blink rounded-lg p-1' : ''
                        }`}
                    >
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-600">
                                From
                            </label>
                            <DatePicker
                                value={startDate}
                                onChange={(value) => {
                                    setStartDate(value);
                                    setError('');
                                }}
                                placeholder="Start date"
                                className="h-10 rounded-lg border-gray-200 bg-gray-50 text-sm"
                                disabled={!employeeId}
                                disabledDays={
                                    hrOverride ? undefined : disabledDaysBefore(processingStartDate)
                                }
                            />
                            {employeeId && processingStartDate ? (
                                <p className="mt-1 text-[11px] text-slate-400">
                                    {hrOverride
                                        ? `Salary processing date ${formatDateLabel(processingStartDate)} (override on)`
                                        : `Available from ${formatDateLabel(processingStartDate)}`}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-600">
                                To
                            </label>
                            <DatePicker
                                value={endDate}
                                onChange={(value) => {
                                    setEndDate(value);
                                    setError('');
                                }}
                                placeholder="End date"
                                className="h-10 rounded-lg border-gray-200 bg-gray-50 text-sm"
                                disabled={!employeeId}
                                disabledDays={
                                    hrOverride
                                        ? disabledDaysBefore(startDate)
                                        : disabledDaysBefore(laterDateKey(processingStartDate, startDate))
                                }
                            />
                        </div>
                    </div>
                </div>

                {showAnnualEligibility && eligibility ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-xs text-amber-950">
                        <p>
                            Previous annual leave taken:{' '}
                            {eligibility.lastAnnualLeaveEnd
                                ? `${formatDateLabel(eligibility.lastAnnualLeaveEnd)}${
                                      eligibility.lastAnnualLeaveDays
                                          ? ` (${eligibility.lastAnnualLeaveDays} day${
                                                eligibility.lastAnnualLeaveDays === 1 ? '' : 's'
                                            })`
                                          : ''
                                  }`
                                : 'None'}
                        </p>
                        <p className="mt-1">
                            Eligible days{' '}
                            {eligibility.lastAnnualLeaveEnd
                                ? 'from previous annual leave'
                                : 'from joining'}{' '}
                            to today:{' '}
                            <span className="font-semibold">
                                {eligibility.eligibleDays} / {eligibility.requiredDays}
                            </span>
                        </p>
                        {eligibility.groupCap?.enabled ? (
                            <>
                                <p className="mt-1">
                                    {eligibility.groupCap.groupLabel || 'Group'} group:{' '}
                                    {eligibility.groupCap.employeeCount} employee
                                    {eligibility.groupCap.employeeCount === 1 ? '' : 's'}
                                    {eligibility.groupCap.minPercent != null
                                        ? ` · min allowed ${eligibility.groupCap.minAllowed} (${eligibility.groupCap.minPercent}%)`
                                        : ''}
                                    {eligibility.groupCap.maxPercent != null
                                        ? ` · max allowed ${eligibility.groupCap.maxAllowed} (${eligibility.groupCap.maxPercent}%)`
                                        : ''}
                                </p>
                                {startDate && endDate ? (
                                    <p className="mt-1">
                                        Annual leave already requested or approved in this group
                                        on the selected days:{' '}
                                        <span className="font-semibold">{eligibility.groupCap.taken}</span>
                                    </p>
                                ) : null}
                            </>
                        ) : null}
                    </div>
                ) : null}

                {showAnnualEligibility && eligibilityLoading && !eligibility ? (
                    <p className="mt-3 text-center text-[11px] text-slate-400">
                        Checking annual leave eligibility...
                    </p>
                ) : null}

                {showNotEligibleGate ? (
                    <p className="mt-3 text-center text-sm font-semibold text-red-600">
                        You are not eligible. Do you want to continue?
                    </p>
                ) : null}

                {error ? (
                    <p className="mt-3 text-center text-xs font-medium text-red-600">{error}</p>
                ) : null}

                {showHrOverride ? (
                    <label className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left">
                        <input
                            type="checkbox"
                            checked={hrOverride}
                            onChange={(event) => {
                                setHrOverride(event.target.checked);
                                setError('');
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>
                            <span className="block text-sm font-semibold text-amber-900">
                                Override validations
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-tight text-amber-800">
                                Add this leave without processing-date, balance, or existing-leave checks.
                            </span>
                        </span>
                    </label>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => onClose?.()}
                        disabled={submitting}
                        className="min-w-[110px] flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    {showReject ? (
                        <button
                            type="button"
                            onClick={handleReject}
                            disabled={submitting}
                            className="min-w-[110px] flex-1 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? 'Saving...' : rejectLabel}
                        </button>
                    ) : null}
                    {showNotEligibleGate ? (
                        <>
                            <button
                                type="button"
                                onClick={handleChangeDate}
                                disabled={submitting}
                                className="min-w-[110px] flex-1 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-800 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Change date
                            </button>
                            <button
                                type="button"
                                onClick={() => submitLeave(true)}
                                disabled={
                                    submitting ||
                                    !employeeId ||
                                    eligibilityLoading ||
                                    !startDate ||
                                    !endDate
                                }
                                className="min-w-[110px] flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? 'Saving...' : 'Send to HR'}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={
                                submitting ||
                                !employeeId ||
                                (showAnnualEligibility && eligibilityLoading)
                            }
                            className="min-w-[110px] flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? 'Saving...' : applyLabel}
                        </button>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes leave-date-blink {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); background-color: transparent; }
                    50% { box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.85); background-color: #fef3c7; }
                }
                .leave-date-blink {
                    animation: leave-date-blink 0.55s ease-in-out 4;
                }
            `}</style>
        </div>,
        document.body,
    );
}
