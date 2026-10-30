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
import { buildAnnualLeaveShade, describeAnnualLeaveRange } from '../utils/annualLeaveShade';
import { LeaveShadeLegend } from '../utils/LeaveShadeLegend';

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

function mergeDisabled(parts) {
    const list = parts.filter((part) => part != null);
    if (!list.length) return undefined;
    return list.length === 1 ? list[0] : list;
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
    requestedOnLabel = '',
    requestReason = '',
    requestAttachmentName = '',
    showReject = false,
    onReject,
    rejectLabel = 'Reject',
    enableAnnualEligibilityGate = false,
    embedded = false,
    note = '',
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
    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [blockersOpen, setBlockersOpen] = useState(false);
    const isApplyMode = applyLabel === 'Apply' && !showReject;
    const showHrOverride = isApplyMode && isDesignatedHr;
    const showAnnualEligibility = Boolean(
        leaveMode === 'annual' && employeeId && (enableAnnualEligibilityGate || isApplyMode),
    );
    const notEligible = Boolean(
        showAnnualEligibility && eligibility?.groupCap?.over && !hrOverride,
    );
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
    const hrCanPickEarly = Boolean(showHrOverride && hrOverride);
    const shade = useMemo(() => {
        if (!showAnnualEligibility || !eligibility?.calendar) return null;
        return buildAnnualLeaveShade(eligibility.calendar, {
            processingStart: processingStartDate,
            allowEarly: hrCanPickEarly,
        });
    }, [eligibility, hrCanPickEarly, processingStartDate, showAnnualEligibility]);
    const rangeIssue =
        shade && !hrCanPickEarly
            ? describeAnnualLeaveRange({
                  calendar: eligibility?.calendar,
                  from: startDate,
                  to: endDate,
                  processingStart: processingStartDate,
              })
            : '';
    const fetchedIssue =
        !hrCanPickEarly && startDate && endDate && !rangeIssue
            ? String(eligibility?.selectionMessage || '')
            : '';
    const guidance =
        !rangeIssue && !fetchedIssue && (!startDate || !endDate)
            ? String(eligibility?.calendar?.notice || '')
            : '';
    const redBody = rangeIssue || fetchedIssue || guidance;
    const redText = redBody ? `${redBody}${isDesignatedHr ? '' : ' For more, contact HR.'}` : '';
    const noOpenDays = Boolean(shade && !(eligibility?.calendar?.openSpans || []).length);
    const calendarBlocking = Boolean(
        isApplyMode && shade && !hrCanPickEarly && (rangeIssue || fetchedIssue || noOpenDays),
    );
    const activeWindow = eligibility?.allowance?.active || null;
    const allowanceEnd = activeWindow?.endDate || '';
    const earliestStartDate = hrCanPickEarly
        ? ''
        : laterDateKey(processingStartDate, activeWindow?.startDate || '');

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
                        eligibleOn: String(data?.eligibleOn || ''),
                        cycleNotEligible: false,
                        notEligible: Boolean(data?.notEligible),
                        allowanceBlocked: Boolean(data?.allowanceBlocked),
                        allowanceBlock: data?.allowanceBlock || null,
                        allowance: data?.allowance && typeof data.allowance === 'object' ? data.allowance : null,
                        groupCap: data?.groupCap && typeof data.groupCap === 'object' ? data.groupCap : null,
                        calendar: data?.calendar && typeof data.calendar === 'object' ? data.calendar : null,
                        selectionMessage: String(data?.selectionMessage || ''),
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
        setEligibility(null);
    }, [employeeId, leaveMode]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    useEffect(() => {
        if (!open || !earliestStartDate || hrCanPickEarly || shade) return;
        setStartDate((current) => (current && current < earliestStartDate ? '' : current));
        setEndDate((current) => (current && current < earliestStartDate ? '' : current));
    }, [open, employeeId, hrCanPickEarly, earliestStartDate, shade]);

    useEffect(() => {
        if (!open || !isApplyMode || hrCanPickEarly || !shade?.disableDate) return;
        const blocked = (value) => {
            const date = dateKeyToLocalDate(value);
            return Boolean(date && shade.disableDate(date));
        };
        setStartDate((current) => (blocked(current) ? '' : current));
        setEndDate((current) => (blocked(current) ? '' : current));
    }, [open, isApplyMode, employeeId, hrCanPickEarly, shade]);

    const submitLeave = (sendToHr = false) => {
        if (submitting) return;
        if (!employeeId) {
            setError('Please select an employee.');
            return;
        }
        if (calendarBlocking && noOpenDays) return;
        if (!startDate || !endDate) {
            setError('Please select start and end dates.');
            return;
        }
        if (calendarBlocking) return;
        if (earliestStartDate && startDate < earliestStartDate && !hrCanPickEarly && !shade) {
            setError(
                `Start date cannot be before this employee's salary processing date (${formatDateLabel(processingStartDate)}).`,
            );
            return;
        }
        if (endDate < startDate) {
            setError('End date must be on or after start date.');
            return;
        }
        if (showAnnualEligibility && eligibility?.allowanceBlocked && !isDesignatedHr) {
            setError(eligibility?.allowanceBlock?.message || 'This annual leave is outside the open 30-day period.');
            return;
        }

        if (notEligible && !sendToHr && !eligibility?.allowanceBlocked) {
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
        if (!rejecting) {
            setRejecting(true);
            setError('');
            return;
        }
        if (!String(rejectReason).trim()) {
            setError('Reject reason is required.');
            return;
        }
        onReject?.({
            employeeId,
            startDate,
            endDate,
            employee: selectedEmployee,
            leaveMode,
            rejectReason: String(rejectReason).trim(),
        });
    };

    if (!open || (!embedded && !mounted)) return null;

    const form = (
        <>
            <div
                ref={rootRef}
                className={
                    embedded
                        ? 'w-full'
                        : 'relative z-[101] w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl'
                }
                onMouseDown={(event) => event.stopPropagation()}
            >
                {embedded ? null : (
                    <h3 className="mb-4 text-center text-base font-bold text-gray-900">{modalTitle}</h3>
                )}
                {note ? (
                    <p className="mb-3 text-center text-[11px] leading-snug text-[#6B7280]">{note}</p>
                ) : null}
                {requestedLeaveLabel ? (
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[#DDE3EA] bg-[#F8FAFC] px-3 py-2">
                        <div className="min-w-0 text-left text-xs text-[#475467]">
                            <p>
                                Requested:{' '}
                                <span className="font-semibold text-[#111827]">{requestedLeaveLabel}</span>
                            </p>
                            {requestedDateLabel ? (
                                <p className="mt-0.5 text-[11px] text-[#667085]">{requestedDateLabel}</p>
                            ) : null}
                            {requestReason ? (
                                <p className="mt-1 text-[11px] text-[#344054]">
                                    Reason: <span className="font-semibold">{requestReason}</span>
                                </p>
                            ) : null}
                            {requestAttachmentName ? (
                                <p className="mt-0.5 text-[11px] text-[#344054]">
                                    Attachment: <span className="font-semibold">{requestAttachmentName}</span>
                                </p>
                            ) : null}
                        </div>
                        {requestedOnLabel ? (
                            <div className="shrink-0 border-l border-[#E5E7EB] pl-3 text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#667085]">
                                    Requested date
                                </p>
                                <p className="text-sm font-semibold text-[#111827]">{requestedOnLabel}</p>
                            </div>
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
                                    shade?.disableDate ||
                                    (hrCanPickEarly ? undefined : disabledDaysBefore(earliestStartDate))
                                }
                                modifiers={shade?.modifiers}
                                modifiersStyles={shade?.modifiersStyles}
                                calendarClassNames={shade?.calendarClassNames}
                                footer={shade ? <LeaveShadeLegend className="px-1" /> : null}
                            />
                            {employeeId && earliestStartDate && !shade ? (
                                <p className="mt-1 text-[11px] text-slate-400">
                                    Available from {formatDateLabel(earliestStartDate)}
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
                                disabledDays={mergeDisabled([
                                    shade?.disableDate,
                                    dateKeyToLocalDate(startDate)
                                        ? { before: dateKeyToLocalDate(startDate) }
                                        : null,
                                    !shade && !hrCanPickEarly
                                        ? disabledDaysBefore(laterDateKey(earliestStartDate, startDate))
                                        : null,
                                    !shade && dateKeyToLocalDate(allowanceEnd)
                                        ? { after: dateKeyToLocalDate(allowanceEnd) }
                                        : null,
                                ])}
                                modifiers={shade?.modifiers}
                                modifiersStyles={shade?.modifiersStyles}
                                calendarClassNames={shade?.calendarClassNames}
                                footer={shade ? <LeaveShadeLegend className="px-1" /> : null}
                            />
                        </div>
                    </div>
                    {shade ? <LeaveShadeLegend className="mt-2" /> : null}
                    {redText ? (
                        <p className="mt-2 text-left text-[11px] font-medium leading-snug text-red-600">
                            {redText}
                        </p>
                    ) : null}
                </div>

                {showAnnualEligibility && eligibility ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-xs text-amber-950">
                        {activeWindow ? (
                            <p>
                                Open period {formatDateLabel(activeWindow.startDate)} — {formatDateLabel(activeWindow.endDate)}
                                {' · '}allowed {activeWindow.allowedDays}
                                {' · '}taken {activeWindow.takenDays}
                                {' · '}remaining {activeWindow.remainingDays}
                            </p>
                        ) : (
                            <p>No open annual leave period yet. It opens when counted working days complete a cycle.</p>
                        )}
                        {eligibility.allowanceBlocked &&
                        eligibility.allowanceBlock?.message &&
                        redBody !== eligibility.allowanceBlock.message ? (
                            <p className="mt-1 font-semibold">
                                {eligibility.allowanceBlock.message}
                                {isDesignatedHr ? ' Shown for review. HR can still apply.' : ''}
                            </p>
                        ) : null}
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
                                        <button
                                            type="button"
                                            onClick={() => setBlockersOpen(true)}
                                            className="font-semibold text-amber-950 underline"
                                        >
                                            {eligibility.groupCap.taken}
                                        </button>
                                    </p>
                                ) : null}
                                {eligibility.groupCap.over ? (
                                    <button
                                        type="button"
                                        onClick={() => setBlockersOpen(true)}
                                        className="mt-1 block text-left font-semibold underline"
                                    >
                                        {eligibility.groupCap.message || 'Group limit reached.'} See who is on leave.
                                    </button>
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
                            <span className="block text-[12px] font-semibold leading-snug text-amber-800">
                                HR can override the calendar and these checks. Other users cannot.
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
                        <>
                            {rejecting ? (
                                <label className="min-w-full text-xs font-semibold text-slate-500">
                                    Reject reason
                                    <textarea
                                        value={rejectReason}
                                        onChange={(event) => setRejectReason(event.target.value)}
                                        rows={3}
                                        className="mt-1 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm text-slate-800"
                                    />
                                </label>
                            ) : null}
                            <button
                                type="button"
                                onClick={handleReject}
                                disabled={submitting || (rejecting && !String(rejectReason).trim())}
                                className="min-w-[110px] flex-1 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? 'Saving...' : rejecting ? 'Confirm reject' : rejectLabel}
                            </button>
                        </>
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
                                    !endDate ||
                                    Boolean(rangeIssue) ||
                                    noOpenDays
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
                                (showAnnualEligibility && eligibilityLoading) ||
                                calendarBlocking
                            }
                            className="min-w-[110px] flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? 'Saving...' : applyLabel}
                        </button>
                    )}
                </div>
            </div>
            {blockersOpen ? (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="Close who is on leave"
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setBlockersOpen(false)}
                    />
                    <div className="relative z-[121] w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
                        <h4 className="text-sm font-semibold text-gray-900">Who is on annual leave</h4>
                        <p className="mt-1 text-xs text-gray-500">
                            These people already requested or took annual leave on the selected days, so the group limit blocks this request.
                        </p>
                        <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-left text-xs text-gray-800">
                            {(eligibility?.groupCap?.blockers || []).length ? (
                                eligibility.groupCap.blockers.map((person) => (
                                    <li key={person.employeeMongoId} className="rounded-lg border border-gray-100 px-2 py-1.5">
                                        <span className="font-semibold">{person.name}</span>
                                        {person.employeeId ? ` (${person.employeeId})` : ''}
                                        <span className="mt-0.5 block text-gray-500">
                                            {person.status || 'leave'} · {(person.dates || []).map(formatDateLabel).join(', ')}
                                        </span>
                                    </li>
                                ))
                            ) : (
                                <li>No one else is recorded on these days.</li>
                            )}
                        </ul>
                        <button
                            type="button"
                            onClick={() => setBlockersOpen(false)}
                            className="mt-3 w-full rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700"
                        >
                            Close
                        </button>
                    </div>
                </div>
            ) : null}
            <style>{`
                @keyframes leave-date-blink {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); background-color: transparent; }
                    50% { box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.85); background-color: #fef3c7; }
                }
                .leave-date-blink {
                    animation: leave-date-blink 0.55s ease-in-out 4;
                }
            `}</style>
        </>
    );

    if (embedded) return form;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-black/30"
                onClick={() => onClose?.()}
            />
            {form}
        </div>,
        document.body,
    );
}
