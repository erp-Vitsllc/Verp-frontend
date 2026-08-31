'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Select from 'react-select';
import { DatePicker } from '@/components/ui/date-picker';
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
    }, [open, initialEmployeeId, initialStartDate, initialEndDate, initialLeaveMode]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    useEffect(() => {
        if (!open || !processingStartDate) return;
        setStartDate((current) => (current && current < processingStartDate ? '' : current));
        setEndDate((current) => (current && current < processingStartDate ? '' : current));
    }, [open, employeeId, processingStartDate]);

    const handleSubmit = () => {
        if (submitting) return;
        if (!employeeId) {
            setError('Please select an employee.');
            return;
        }
        if (!startDate || !endDate) {
            setError('Please select start and end dates.');
            return;
        }
        if (processingStartDate && startDate < processingStartDate) {
            setError(
                `Start date cannot be before this employee's salary processing date (${formatDateLabel(processingStartDate)}).`,
            );
            return;
        }
        if (endDate < startDate) {
            setError('End date must be on or after start date.');
            return;
        }

        setError('');
        onApply?.({
            employeeId,
            startDate,
            endDate,
            employee: selectedEmployee,
            leaveMode,
        });
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
                                setStartDate((current) =>
                                    minDate && current && current < minDate ? '' : current,
                                );
                                setEndDate((current) =>
                                    minDate && current && current < minDate ? '' : current,
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
                                setError('');
                            }}
                            isSearchable={false}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                            menuPlacement="auto"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                                disabledDays={disabledDaysBefore(processingStartDate)}
                            />
                            {employeeId && processingStartDate ? (
                                <p className="mt-1 text-[11px] text-slate-400">
                                    Available from {formatDateLabel(processingStartDate)}
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
                                disabledDays={disabledDaysBefore(
                                    laterDateKey(processingStartDate, startDate),
                                )}
                            />
                        </div>
                    </div>
                </div>

                {error ? (
                    <p className="mt-3 text-center text-xs font-medium text-red-600">{error}</p>
                ) : null}

                <div className={showReject ? 'mt-4 grid grid-cols-2 gap-2' : 'mt-4'}>
                    {showReject ? (
                        <button
                            type="button"
                            onClick={handleReject}
                            disabled={submitting}
                            className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? 'Saving...' : rejectLabel}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? 'Saving...' : applyLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
