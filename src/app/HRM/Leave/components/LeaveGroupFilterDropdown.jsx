'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export const ALL_LEAVE_GROUP = 'all';

function employeeLabel(emp) {
    const name = emp?.employeeName || 'Employee';
    return emp?.employeeId ? `${name} (${emp.employeeId})` : name;
}

export default function LeaveGroupFilterDropdown({
    groups = [],
    employees = [],
    groupKey = ALL_LEAVE_GROUP,
    employeeId = '',
    menuLevel = 'groups',
    onSelectGroup,
    onSelectEmployee,
    onReturn,
}) {
    const rootRef = useRef(null);
    const [open, setOpen] = useState(false);

    const selectedGroup = useMemo(
        () => groups.find((row) => row.key === groupKey) || null,
        [groupKey, groups],
    );
    const selectedEmployee = useMemo(
        () => employees.find((emp) => String(emp._id) === String(employeeId)) || null,
        [employeeId, employees],
    );

    const closedLabel = selectedEmployee
        ? employeeLabel(selectedEmployee)
        : selectedGroup?.label || 'ALL';

    const groupEmployees = useMemo(() => {
        if (groupKey === ALL_LEAVE_GROUP) return employees;
        return employees
            .filter((emp) => emp.staffType === groupKey)
            .slice()
            .sort((a, b) =>
                String(a.employeeName || '').localeCompare(String(b.employeeName || '')),
            );
    }, [employees, groupKey]);

    useEffect(() => {
        if (!open) return undefined;

        const handlePointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    const optionClass = (active) =>
        `flex w-full items-center px-3 py-2 text-left text-sm ${
            active
                ? 'bg-[#2563EB] text-white'
                : 'text-[#111827] hover:bg-[#EFF6FF]'
        }`;

    return (
        <label className="relative inline-flex items-center gap-2 text-sm text-[#555B65]">
            <span className="font-medium">Group</span>
            <div ref={rootRef} className="relative">
                <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    className="inline-flex min-w-[168px] max-w-[280px] items-center justify-between gap-2 rounded-lg border border-[#DDE3EA] bg-white px-3 py-2 text-sm font-medium text-[#344054] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-label="Filter leave dashboard by group"
                >
                    <span className="truncate">{groupKey === ALL_LEAVE_GROUP && !selectedEmployee ? 'ALL' : closedLabel}</span>
                    <ChevronDown size={16} className={`shrink-0 text-[#9CA3AF] ${open ? 'rotate-180' : ''}`} />
                </button>

                {open ? (
                    <div
                        className="absolute right-0 z-30 mt-1 max-h-72 min-w-[220px] overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg"
                        role="listbox"
                    >
                        {menuLevel !== 'employees' ? (
                            <>
                                <button
                                    type="button"
                                    className={optionClass(groupKey === ALL_LEAVE_GROUP && !employeeId)}
                                    onClick={() => {
                                        onSelectGroup?.(ALL_LEAVE_GROUP);
                                        setOpen(false);
                                    }}
                                >
                                    ALL
                                </button>
                                {groups.map((group) => (
                                    <button
                                        type="button"
                                        key={group.key}
                                        className={optionClass(groupKey === group.key && !employeeId)}
                                        onClick={() => onSelectGroup?.(group.key)}
                                    >
                                        {group.label}
                                    </button>
                                ))}
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="flex w-full items-center px-3 py-2 text-left text-sm font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
                                    onClick={() => onReturn?.()}
                                >
                                    Return
                                </button>
                                <button
                                    type="button"
                                    className={optionClass(!employeeId)}
                                    onClick={() => {
                                        onSelectEmployee?.('');
                                        setOpen(false);
                                    }}
                                >
                                    ALL
                                </button>
                                {groupEmployees.length ? (
                                    groupEmployees.map((emp) => (
                                        <button
                                            type="button"
                                            key={emp._id}
                                            className={optionClass(String(emp._id) === String(employeeId))}
                                            onClick={() => {
                                                onSelectEmployee?.(emp);
                                                setOpen(false);
                                            }}
                                        >
                                            {employeeLabel(emp)}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-3 py-2 text-sm text-[#9CA3AF]">No employees in this group</div>
                                )}
                            </>
                        )}
                    </div>
                ) : null}
            </div>
        </label>
    );
}
