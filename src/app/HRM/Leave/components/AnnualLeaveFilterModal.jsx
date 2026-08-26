'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Select from 'react-select';
import { DatePicker } from '@/components/ui/date-picker';

const AUTHORIZE_LEAVE_MAX = 5;

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

function resolveLeaveMode(employee) {
    const annualCount = Number(employee?.annualLeaveTaken) || 0;
    return annualCount <= AUTHORIZE_LEAVE_MAX ? 'authorized' : 'annual';
}

export default function AnnualLeaveFilterModal({
    open,
    onClose,
    employees = [],
    initialEmployeeId = '',
    initialStartDate = '',
    initialEndDate = '',
    onApply,
    applyLabel = 'Apply',
}) {
    const rootRef = useRef(null);
    const [employeeId, setEmployeeId] = useState(initialEmployeeId);
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);

    const selectedEmployee = useMemo(
        () => employees.find((emp) => String(emp._id) === String(employeeId)) || null,
        [employeeId, employees],
    );

    const leaveMode = useMemo(
        () => (selectedEmployee ? resolveLeaveMode(selectedEmployee) : 'annual'),
        [selectedEmployee],
    );
    const modalTitle =
        leaveMode === 'authorized' ? 'Authorize Leave Calendar' : 'Annual Leave Calendar';

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
        setError('');
    }, [open, initialEmployeeId, initialStartDate, initialEndDate]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    const handleSubmit = () => {
        if (!employeeId) {
            setError('Please select an employee.');
            return;
        }
        if (!startDate || !endDate) {
            setError('Please select start and end dates.');
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
                                setEmployeeId(option?.value || '');
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
                            />
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
                                disabledDays={
                                    startDate
                                        ? { before: new Date(`${startDate}T12:00:00`) }
                                        : undefined
                                }
                            />
                        </div>
                    </div>
                </div>

                {error ? (
                    <p className="mt-3 text-center text-xs font-medium text-red-600">{error}</p>
                ) : null}

                <button
                    type="button"
                    onClick={handleSubmit}
                    className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                    {applyLabel}
                </button>
            </div>
        </div>,
        document.body,
    );
}

export { resolveLeaveMode, AUTHORIZE_LEAVE_MAX };
