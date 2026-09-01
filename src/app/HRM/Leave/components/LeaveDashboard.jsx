'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import axiosInstance from '@/utils/axios';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import { navigateFromList } from '@/utils/listReturnNavigation';
import { notifyLeavePendingInboxChanged } from '../utils/leavePendingInboxCount';
import {
    ALL_LEAVE_YEAR,
    filterLeaveEntriesBySalary,
    isAllLeaveYear,
    isLeaveRangeSalaryVisible,
    processingStartForEmployee,
    useLeaveSalaryVisibility,
} from '../utils/leaveSalaryVisibility';

export const ALL_LEAVE_STATUS = 'all';

const AVAILABILITY_CARDS = [
    { key: 'sickLeave', statusKey: 'sick_leave', label: 'Sick Leave', color: '#F5C842', track: '#FFF3CC' },
    { key: 'authorizedLeave', statusKey: 'authorized_leave', label: 'Authorize Leave', color: '#16B8A5', track: '#D7FAF4' },
    { key: 'unauthorizedLeave', statusKey: 'unauthorized_leave', label: 'Unauthorized Leave', color: '#EC4899', track: '#FCE7F3' },
    { key: 'compoffLeave', statusKey: 'compoff_leave', label: 'Comp Off Leave', color: '#8B5CF6', track: '#EDE9FE' },
    { key: 'annualLeaveTaken', statusKey: 'on_leave', label: 'Annual Leave', color: '#38BDF8', track: '#E0F2FE' },
];

const GROUP_BAR_COLORS = ['#2563EB', '#14B8A6', '#8B5CF6', '#F59E0B', '#EC4899', '#0EA5E9'];

const RING_SCALE = 8;

const ARC_RATIO = 0.75;
const GAUGE_SIZE = 76;
const GAUGE_STROKE = 6;

function LeaveAvailabilityRing({ taken, color, track, label, selected = false, scale = RING_SCALE, onClick }) {
    const safeTaken = Math.max(0, Number(taken) || 0);
    const pct = Math.min(1, safeTaken / Math.max(scale, safeTaken, 1));
    const radius = (GAUGE_SIZE - GAUGE_STROKE) / 2;
    const center = GAUGE_SIZE / 2;
    const circumference = 2 * Math.PI * radius;
    const arcLength = circumference * ARC_RATIO;
    const gapLength = circumference - arcLength;
    const progressLength = arcLength * pct;

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={`flex min-w-0 flex-1 basis-0 flex-col rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition-shadow hover:shadow-md ${
                selected ? 'border-2 shadow-md' : 'border-[#E5E7EB]'
            }`}
            style={selected ? { borderColor: color } : undefined}
        >
            <div className="mb-1 text-[11px] font-medium text-[#9CA3AF]">Days taken</div>
            <div className="flex flex-1 items-center justify-between gap-2">
                <div className="min-w-0 text-[13px] font-bold leading-tight text-[#111827] sm:text-[14px]">
                    {label}
                </div>
                <div className="relative h-[76px] w-[76px] shrink-0">
                    <svg width={GAUGE_SIZE} height={GAUGE_SIZE} viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}>
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke={track}
                            strokeWidth={GAUGE_STROKE}
                            strokeLinecap="round"
                            strokeDasharray={`${arcLength} ${gapLength}`}
                            transform={`rotate(135 ${center} ${center})`}
                        />
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke={color}
                            strokeWidth={GAUGE_STROKE}
                            strokeLinecap="round"
                            strokeDasharray={`${progressLength} ${circumference - progressLength}`}
                            transform={`rotate(135 ${center} ${center})`}
                        />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-[#111827]">
                        {safeTaken}
                    </span>
                </div>
            </div>
        </button>
    );
}

const EMPTY_AVAILABILITY = {
    sickLeave: 0,
    authorizedLeave: 0,
    unauthorizedLeave: 0,
    compoffLeave: 0,
    annualLeaveTaken: 0,
};

function formatLeaveDateLabel(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return '';
    try {
        return format(parseISO(dateKey), 'd MMMM yyyy');
    } catch {
        return dateKey;
    }
}

const APPROVAL_PREVIEW_LIMIT = 5;
const APPROVAL_CATEGORY_PENDING = 'pending';
const APPROVAL_CATEGORY_APPROVED = 'approved';

function approvalStatusBadgeClass(statusKey) {
    const key = String(statusKey || '').toLowerCase();
    if (key === 'approved') return 'bg-[#DCFCE7] text-[#15803D]';
    if (key === 'rejected') return 'bg-[#FEE2E2] text-[#B91C1C]';
    return 'bg-[#FEF3C7] text-[#B45309]';
}

function rowMatchesLeaveSpan(row, span) {
    if (!row || !span) return false;
    if (String(row.employeeMongoId || '') !== String(span.employeeMongoId || '')) return false;
    const rowStart = String(row.startDateKey || '');
    const rowEnd = String(row.endDateKey || rowStart);
    const spanStart = String(span.start || span.date || '');
    const spanEnd = String(span.end || span.start || span.date || '');
    if (!rowStart || !spanStart) return false;
    if (rowEnd < spanStart || rowStart > spanEnd) return false;
    if (span.statusKey && row.requestedStatusKey && row.requestedStatusKey !== span.statusKey) {
        return false;
    }
    return true;
}

function findApprovalRowForSpan(rows, span) {
    const matches = (rows || []).filter((row) => rowMatchesLeaveSpan(row, span));
    if (!matches.length) return null;
    const exact = matches.find(
        (row) => row.startDateKey === span.start && (row.endDateKey || row.startDateKey) === (span.end || span.start),
    );
    return exact || matches[0];
}

function rowMatchesApprovalId(row, approvalId) {
    if (!approvalId || !row) return false;
    if (String(row.id) === String(approvalId)) return true;
    return Array.isArray(row.attendanceIds) && row.attendanceIds.some((id) => String(id) === String(approvalId));
}

function findApprovalRowById(rows, approvalId) {
    if (!approvalId) return null;
    return (rows || []).find((row) => rowMatchesApprovalId(row, approvalId)) || null;
}

function rowStatusKey(row) {
    const key = String(row?.statusKey || '').toLowerCase();
    if (key === 'approved' || key === 'rejected' || key === 'pending') return key;
    const label = String(row?.status || '').toLowerCase();
    if (label === 'approved') return 'approved';
    if (label === 'rejected') return 'rejected';
    return 'pending';
}

function LeaveApprovalTable({
    rows,
    decidingId,
    isRowSelected,
    isEmployeeHighlighted,
    blinkRowId = '',
    onRowSelect,
    onRowDoubleClick,
    onDecide,
    onAccept,
    onEdit,
    emptyLabel,
}) {
    if (!rows.length) {
        return (
            <tr>
                <td colSpan={6} className="px-2 py-8 text-center text-[#6B7280]">
                    {emptyLabel}
                </td>
            </tr>
        );
    }

    return rows.map((row) => {
        const selected = isRowSelected(row);
        const employeeMatch = isEmployeeHighlighted(row);
        const statusKey = rowStatusKey(row);
        const canDecide = statusKey === 'pending' && row.canDecide !== false;
        const canEdit = row.canEdit === true;
        const blinking = String(blinkRowId || '') === String(row.id);

        return (
            <tr
                key={row.id}
                data-approval-id={row.id}
                role="button"
                tabIndex={0}
                onClick={() => onRowSelect(row)}
                onDoubleClick={(event) => {
                    event.preventDefault();
                    onRowDoubleClick?.(row);
                }}
                title="Double-click to open leave portal"
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowSelect(row);
                    }
                }}
                className={`border-b border-[#F3F4F6] text-[#374151] cursor-pointer transition-colors hover:bg-[#F3F4F6] ${
                    blinking
                        ? 'leave-approval-row-blink'
                        : selected
                          ? 'bg-[#ECEFF3] ring-1 ring-inset ring-[#9CA3AF]'
                          : employeeMatch
                            ? 'bg-[#F9FAFB]'
                            : ''
                }`}
            >
                <td className="px-2 py-3 font-medium text-[#111827]">{row.name}</td>
                <td className="px-2 py-3">{row.leaveType}</td>
                <td className="px-2 py-3">{row.startDate}</td>
                <td className="px-2 py-3">{row.endDate}</td>
                <td className="px-2 py-3">
                    <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${approvalStatusBadgeClass(statusKey)}`}
                    >
                        {row.status || 'Pending'}
                    </span>
                </td>
                <td className="px-2 py-3">
                    {canDecide || canEdit ? (
                        <div className="flex items-center justify-center gap-2">
                            {canDecide ? (
                                <>
                                    <button
                                        type="button"
                                        disabled={decidingId === row.id}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            if (onAccept) onAccept(row);
                                            else onDecide(row, 'approved');
                                        }}
                                        onDoubleClick={(event) => event.stopPropagation()}
                                        className="flex h-7 w-7 items-center justify-center rounded-md bg-[#22C55E] text-white disabled:opacity-50"
                                        aria-label="Accept"
                                    >
                                        <Check size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={decidingId === row.id}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onDecide(row, 'rejected');
                                        }}
                                        onDoubleClick={(event) => event.stopPropagation()}
                                        className="flex h-7 w-7 items-center justify-center rounded-md bg-[#EF4444] text-white disabled:opacity-50"
                                        aria-label="Reject"
                                    >
                                        <X size={14} />
                                    </button>
                                </>
                            ) : null}
                            {canEdit ? (
                                <button
                                    type="button"
                                    disabled={decidingId === row.id}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onEdit?.(row);
                                    }}
                                    onDoubleClick={(event) => event.stopPropagation()}
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
                                    aria-label="Edit leave"
                                    title="Edit leave"
                                >
                                    <Pencil size={13} />
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <div className="text-center text-[#9CA3AF]">—</div>
                    )}
                </td>
            </tr>
        );
    });
}

function ApprovalCategoryFilters({ value, pendingCount, approvedCount, onChange }) {
    const tabs = [
        { key: APPROVAL_CATEGORY_PENDING, label: 'Pending', count: pendingCount },
        { key: APPROVAL_CATEGORY_APPROVED, label: 'Approved', count: approvedCount },
    ];

    return (
        <div className="inline-flex rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-0.5">
            {tabs.map((tab) => {
                const active = value === tab.key;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => onChange?.(tab.key)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                                ? 'bg-white text-[#111827] shadow-sm'
                                : 'text-[#6B7280] hover:text-[#111827]'
                        }`}
                    >
                        {tab.label}
                        <span className={`tabular-nums ${active ? 'text-[#2563EB]' : 'text-[#9CA3AF]'}`}>
                            {tab.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function buildAvailability(selectedEmployee) {
    return {
        sickLeave: Number(selectedEmployee?.sickLeave) || 0,
        authorizedLeave: Number(selectedEmployee?.authorizedLeave) || 0,
        unauthorizedLeave: Number(selectedEmployee?.unauthorizedLeave) || 0,
        compoffLeave: Number(selectedEmployee?.compoffLeave) || 0,
        annualLeaveTaken: Number(selectedEmployee?.annualLeaveTaken) || 0,
    };
}

function countAvailabilityFromEntries(entries, employeeMongoId) {
    const counts = { ...EMPTY_AVAILABILITY };
    for (const entry of entries || []) {
        if (String(entry.employeeMongoId || '') !== String(employeeMongoId)) continue;
        if (entry.isPending) continue;
        switch (String(entry.statusKey || '')) {
            case 'sick_leave':
                counts.sickLeave += 1;
                break;
            case 'authorized_leave':
                counts.authorizedLeave += 1;
                break;
            case 'unauthorized_leave':
                counts.unauthorizedLeave += 1;
                break;
            case 'compoff_leave':
                counts.compoffLeave += 1;
                break;
            case 'on_leave':
                counts.annualLeaveTaken += 1;
                break;
            default:
                break;
        }
    }
    return counts;
}

export default function LeaveDashboard({
    employees = [],
    employeeId = '',
    employeeName = '',
    selectedFrom = '',
    selectedTo = '',
    selectedApprovalId = '',
    sourceEmployeeId = '',
    sourceEmployeeName = '',
    sourceFrom = '',
    sourceTo = '',
    year,
    yearMin,
    yearMax,
    onYearChange,
    groupKey = '',
    groupEmployeeIds = null,
    statusFilter = ALL_LEAVE_STATUS,
    onStatusFilterChange,
    onApplyLeave,
    onLeaveInformation,
    refreshKey = 0,
    onDataChanged,
    onApprovalRowSelect,
    onAcceptRequest,
    onEditRequest,
    calendarLeaveFocus = null,
}) {
    const router = useRouter();
    const selectedEmployee = useMemo(
        () => employees.find((emp) => String(emp._id) === String(employeeId)) || null,
        [employeeId, employees],
    );

    const salaryVisibility = useLeaveSalaryVisibility();
    const isAllYear = isAllLeaveYear(year);
    const currentYear = new Date().getFullYear();
    const selectedYear = isAllYear
        ? currentYear
        : Number.isInteger(Number(year))
          ? Number(year)
          : currentYear;
    const trackMinYear = Number.isInteger(Number(yearMin)) ? Number(yearMin) : selectedYear;
    const trackMaxYear = Number.isInteger(Number(yearMax)) ? Number(yearMax) : currentYear;
    const yearLabel = isAllYear ? 'ALL' : String(selectedYear);

    const displayEmployeeName =
        employeeName || selectedEmployee?.employeeName || '';
    const sourceDisplayName = sourceEmployeeName || '';

    const selectedFromLabel = formatLeaveDateLabel(selectedFrom);
    const selectedToLabel = formatLeaveDateLabel(selectedTo);
    const sourceFromLabel = formatLeaveDateLabel(sourceFrom);
    const sourceToLabel = formatLeaveDateLabel(sourceTo);
    const canReturnToSource =
        Boolean(sourceEmployeeId && sourceDisplayName) &&
        (
            String(sourceEmployeeId) !== String(employeeId) ||
            String(sourceFrom || '') !== String(selectedFrom || '') ||
            String(sourceTo || '') !== String(selectedTo || '')
        );

    const availabilityRange = useMemo(() => {
        if (isAllYear) {
            const empStart = processingStartForEmployee(
                salaryVisibility,
                employeeId,
                selectedEmployee?.employeeId,
            );
            const from =
                empStart ||
                salaryVisibility.earliestProcessingStartDate ||
                `${currentYear}-01-01`;
            return { from, to: `${currentYear}-12-31` };
        }
        return {
            from: `${selectedYear}-01-01`,
            to: `${selectedYear}-12-31`,
        };
    }, [
        currentYear,
        employeeId,
        isAllYear,
        salaryVisibility,
        selectedEmployee?.employeeId,
        selectedYear,
    ]);

    const [availability, setAvailability] = useState(EMPTY_AVAILABILITY);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);

    const scopedEmployees = useMemo(() => {
        if (!groupEmployeeIds) return employees;
        return employees.filter((emp) => groupEmployeeIds.has(String(emp._id)));
    }, [employees, groupEmployeeIds]);

    const teamAvailability = useMemo(() => {
        const counts = { ...EMPTY_AVAILABILITY };
        for (const emp of scopedEmployees) {
            counts.sickLeave += Number(emp.sickLeave) || 0;
            counts.authorizedLeave += Number(emp.authorizedLeave) || 0;
            counts.unauthorizedLeave += Number(emp.unauthorizedLeave) || 0;
            counts.compoffLeave += Number(emp.compoffLeave) || 0;
            counts.annualLeaveTaken += Number(emp.annualLeaveTaken) || 0;
        }
        return counts;
    }, [scopedEmployees]);

    const displayAvailability = employeeId
        ? availabilityLoading
            ? buildAvailability(selectedEmployee)
            : availability
        : teamAvailability;

    const ringScale = Math.max(
        RING_SCALE,
        displayAvailability.sickLeave,
        displayAvailability.authorizedLeave,
        displayAvailability.unauthorizedLeave,
        displayAvailability.compoffLeave,
        displayAvailability.annualLeaveTaken,
        1,
    );

    const fetchAvailability = useCallback(async () => {
        if (!employeeId) {
            setAvailability(EMPTY_AVAILABILITY);
            setAvailabilityLoading(false);
            return;
        }

        setAvailabilityLoading(true);
        try {
            const response = await axiosInstance.get('/Leave/calendar', {
                params: {
                    from: availabilityRange.from,
                    to: availabilityRange.to,
                    leaveType: 'all',
                    employeeId,
                },
                skipToast: true,
            });
            const entries = filterLeaveEntriesBySalary(
                Array.isArray(response.data?.entries) ? response.data.entries : [],
                salaryVisibility,
            );
            setAvailability(countAvailabilityFromEntries(entries, employeeId));
        } catch {
            setAvailability(EMPTY_AVAILABILITY);
        } finally {
            setAvailabilityLoading(false);
        }
    }, [availabilityRange.from, availabilityRange.to, employeeId, salaryVisibility]);

    useEffect(() => {
        fetchAvailability();
    }, [fetchAvailability, refreshKey]);

    const [pendingItems, setPendingItems] = useState([]);
    const [pendingLoading, setPendingLoading] = useState(true);
    const [pendingError, setPendingError] = useState('');
    const [decidingId, setDecidingId] = useState('');
    const [approvalCategory, setApprovalCategory] = useState(APPROVAL_CATEGORY_PENDING);
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [blinkRowId, setBlinkRowId] = useState('');
    const [pinnedApprovalRow, setPinnedApprovalRow] = useState(null);

    const [trackYear, setTrackYear] = useState(isAllYear ? ALL_LEAVE_YEAR : selectedYear);
    const [trackMonths, setTrackMonths] = useState([]);
    const [trackRangeLabel, setTrackRangeLabel] = useState('');
    const [trackLoading, setTrackLoading] = useState(true);
    const [trackError, setTrackError] = useState('');

    const fetchPendingRequests = useCallback(async () => {
        setPendingLoading(true);
        setPendingError('');
        try {
            const response = await axiosInstance.get('/Leave/pending-requests', {
                params: { year: isAllYear ? ALL_LEAVE_YEAR : selectedYear },
                skipToast: true,
            });
            setPendingItems(Array.isArray(response.data?.items) ? response.data.items : []);
        } catch (err) {
            setPendingItems([]);
            setPendingError(err?.response?.data?.message || err.message || 'Failed to load leave requests.');
        } finally {
            setPendingLoading(false);
        }
    }, [isAllYear, selectedYear]);

    const fetchTeamTrack = useCallback(async (yearArg) => {
        const yearParam = isAllLeaveYear(yearArg) ? ALL_LEAVE_YEAR : yearArg;
        setTrackLoading(true);
        setTrackError('');
        try {
            const response = await axiosInstance.get('/Leave/team-track', {
                params: {
                    year: yearParam,
                    leaveType: statusFilter && statusFilter !== ALL_LEAVE_STATUS ? statusFilter : 'all',
                },
                skipToast: true,
            });
            const responseYear = response.data?.year;
            setTrackYear(isAllLeaveYear(responseYear) ? ALL_LEAVE_YEAR : Number(responseYear) || yearArg);
            setTrackMonths(Array.isArray(response.data?.months) ? response.data.months : []);
            setTrackRangeLabel(String(response.data?.rangeLabel || ''));
        } catch (err) {
            setTrackMonths([]);
            setTrackRangeLabel('');
            setTrackError(err?.response?.data?.message || err.message || 'Failed to load team leave track.');
        } finally {
            setTrackLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchPendingRequests();
    }, [fetchPendingRequests, refreshKey]);

    useEffect(() => {
        fetchTeamTrack(isAllYear ? ALL_LEAVE_YEAR : selectedYear);
    }, [fetchTeamTrack, isAllYear, refreshKey, selectedYear]);

    useEffect(() => {
        setTrackYear(isAllYear ? ALL_LEAVE_YEAR : selectedYear);
    }, [isAllYear, selectedYear]);

    const handleAccept = useCallback(
        (row) => {
            if (!row?.id) return;
            onAcceptRequest?.(row);
        },
        [onAcceptRequest],
    );

    const handleEdit = useCallback(
        (row) => {
            if (!row?.id) return;
            onEditRequest?.(row);
        },
        [onEditRequest],
    );

    const handleDecide = useCallback(
        async (row, decision) => {
            if (!row?.id || decidingId) return;
            setDecidingId(row.id);
            try {
                await axiosInstance.post(
                    '/Leave/pending-requests/decide',
                    {
                        attendanceId: row.id,
                        decision,
                        approvedStatusKey: row.requestedStatusKey || '',
                        leavePayType: 'paid',
                    },
                    { skipToast: true },
                );
                await fetchPendingRequests();
                await fetchTeamTrack(trackYear);
                notifyLeavePendingInboxChanged();
                onDataChanged?.();
            } catch (err) {
                setPendingError(err?.response?.data?.message || err.message || 'Failed to update leave request.');
            } finally {
                setDecidingId('');
            }
        },
        [decidingId, fetchPendingRequests, fetchTeamTrack, onDataChanged, trackYear],
    );

    const yearPendingItems = useMemo(
        () =>
            pendingItems.filter((row) => {
                if (!isAllYear && !String(row.startDateKey || '').startsWith(`${selectedYear}-`)) {
                    return false;
                }
                if (groupEmployeeIds && !groupEmployeeIds.has(String(row.employeeMongoId || ''))) {
                    return false;
                }
                if (
                    statusFilter &&
                    statusFilter !== ALL_LEAVE_STATUS &&
                    String(row.requestedStatusKey || '') !== statusFilter
                ) {
                    return false;
                }
                return isLeaveRangeSalaryVisible(row, salaryVisibility);
            }),
        [groupEmployeeIds, isAllYear, pendingItems, salaryVisibility, selectedYear, statusFilter],
    );

    const pendingCount = useMemo(
        () => yearPendingItems.filter((row) => rowStatusKey(row) === APPROVAL_CATEGORY_PENDING).length,
        [yearPendingItems],
    );
    const approvedCount = useMemo(
        () => yearPendingItems.filter((row) => rowStatusKey(row) === APPROVAL_CATEGORY_APPROVED).length,
        [yearPendingItems],
    );

    const sortedPendingItems = useMemo(() => {
        const list = [...yearPendingItems];
        list.sort((a, b) => {
            const aPend = rowStatusKey(a) === 'pending' ? 0 : 1;
            const bPend = rowStatusKey(b) === 'pending' ? 0 : 1;
            if (aPend !== bPend) return aPend - bPend;
            if (employeeId) {
                const aSel = String(a.employeeMongoId) === String(employeeId) ? 0 : 1;
                const bSel = String(b.employeeMongoId) === String(employeeId) ? 0 : 1;
                if (aSel !== bSel) return aSel - bSel;
            }
            return String(b.startDateKey || '').localeCompare(String(a.startDateKey || ''));
        });
        return list;
    }, [employeeId, yearPendingItems]);

    const categoryApprovalItems = useMemo(() => {
        const list = yearPendingItems.filter((row) => rowStatusKey(row) === approvalCategory);
        list.sort((a, b) => {
            if (employeeId) {
                const aSel = String(a.employeeMongoId) === String(employeeId) ? 0 : 1;
                const bSel = String(b.employeeMongoId) === String(employeeId) ? 0 : 1;
                if (aSel !== bSel) return aSel - bSel;
            }
            return String(b.startDateKey || '').localeCompare(String(a.startDateKey || ''));
        });
        return list;
    }, [approvalCategory, employeeId, yearPendingItems]);

    const previewApprovalItems = useMemo(() => {
        const preview = categoryApprovalItems.slice(0, APPROVAL_PREVIEW_LIMIT);
        const selected =
            findApprovalRowById(categoryApprovalItems, selectedApprovalId) ||
            (pinnedApprovalRow && rowStatusKey(pinnedApprovalRow) === approvalCategory
                ? findApprovalRowById(categoryApprovalItems, pinnedApprovalRow.id) || pinnedApprovalRow
                : null);
        if (!selected || preview.some((row) => String(row.id) === String(selected.id))) {
            return preview;
        }
        return [selected, ...preview.filter((row) => String(row.id) !== String(selected.id))].slice(
            0,
            APPROVAL_PREVIEW_LIMIT,
        );
    }, [approvalCategory, categoryApprovalItems, pinnedApprovalRow, selectedApprovalId]);

    const approvalEmptyLabel =
        approvalCategory === APPROVAL_CATEGORY_PENDING
            ? `No pending leave requests${isAllYear ? '' : ` for ${selectedYear}`}.`
            : `No approved leave requests${isAllYear ? '' : ` for ${selectedYear}`}.`;

    const isRowSelected = useCallback(
        (row) => {
            if (selectedApprovalId && rowMatchesApprovalId(row, selectedApprovalId)) return true;
            if (!employeeId || String(row.employeeMongoId) !== String(employeeId)) return false;
            if (selectedFrom && selectedTo) {
                return row.startDateKey === selectedFrom && row.endDateKey === selectedTo;
            }
            return false;
        },
        [employeeId, selectedApprovalId, selectedFrom, selectedTo],
    );

    const isEmployeeHighlighted = useCallback(
        (row) => Boolean(employeeId && String(row.employeeMongoId) === String(employeeId)),
        [employeeId],
    );

    const approvalRowsRef = useRef([]);
    approvalRowsRef.current = (() => {
        const pool = [];
        const seen = new Set();
        for (const row of [...sortedPendingItems, ...pendingItems]) {
            if (!row?.id || seen.has(row.id)) continue;
            seen.add(row.id);
            pool.push(row);
        }
        return pool;
    })();

    const approvalRowClickTimerRef = useRef(null);

    const handleRowSelect = useCallback(
        (row) => {
            if (approvalRowClickTimerRef.current) {
                window.clearTimeout(approvalRowClickTimerRef.current);
            }
            approvalRowClickTimerRef.current = window.setTimeout(() => {
                approvalRowClickTimerRef.current = null;
                onApprovalRowSelect?.(row);
            }, 250);
        },
        [onApprovalRowSelect],
    );

    const handleRowDoubleClick = useCallback(
        (row) => {
            if (approvalRowClickTimerRef.current) {
                window.clearTimeout(approvalRowClickTimerRef.current);
                approvalRowClickTimerRef.current = null;
            }
            const fromRow = String(row?.employeeMongoId || '').trim();
            const code = String(row?.employeeId || '').trim();
            const listed = employees.find(
                (emp) =>
                    (fromRow && String(emp._id) === fromRow) ||
                    (code && String(emp.employeeId || '').trim() === code),
            );
            const mongoId = fromRow || String(listed?._id || '').trim();
            if (!mongoId) return;
            navigateFromList(router, `/HRM/Leave/${encodeURIComponent(mongoId)}`);
        },
        [employees, router],
    );

    useEffect(
        () => () => {
            if (approvalRowClickTimerRef.current) {
                window.clearTimeout(approvalRowClickTimerRef.current);
            }
        },
        [],
    );

    useEffect(() => {
        if (!calendarLeaveFocus?.nonce || calendarLeaveFocus.isDraft) return undefined;

        const row = findApprovalRowForSpan(approvalRowsRef.current, calendarLeaveFocus);
        if (!row) return undefined;

        const nextCategory = rowStatusKey(row);
        if (nextCategory === APPROVAL_CATEGORY_PENDING || nextCategory === APPROVAL_CATEGORY_APPROVED) {
            setApprovalCategory(nextCategory);
        }
        setPinnedApprovalRow(row);
        setBlinkRowId(row.id);
        onApprovalRowSelect?.(row);

        const timer = window.setTimeout(() => setBlinkRowId(''), 1800);
        return () => window.clearTimeout(timer);
    }, [calendarLeaveFocus, onApprovalRowSelect]);

    useEffect(() => {
        if (!selectedApprovalId) return undefined;
        const row = findApprovalRowById(approvalRowsRef.current, selectedApprovalId);
        if (row) {
            const nextCategory = rowStatusKey(row);
            if (nextCategory === APPROVAL_CATEGORY_PENDING || nextCategory === APPROVAL_CATEGORY_APPROVED) {
                setApprovalCategory(nextCategory);
            }
            setPinnedApprovalRow(row);
        }
        setBlinkRowId(row?.id || selectedApprovalId);
        const timer = window.setTimeout(() => setBlinkRowId(''), 1800);
        return () => window.clearTimeout(timer);
    }, [selectedApprovalId, pendingItems]);

    useEffect(() => {
        if (!blinkRowId) return undefined;
        const node = document.querySelector(`[data-approval-id="${blinkRowId}"]`);
        node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return undefined;
    }, [approvalModalOpen, blinkRowId]);

    const handleReturnToSource = useCallback(() => {
        if (!sourceEmployeeId || !sourceFrom || !sourceTo) return;
        onApprovalRowSelect?.({
            id: '',
            employeeMongoId: sourceEmployeeId,
            name: sourceDisplayName,
            startDateKey: sourceFrom,
            endDateKey: sourceTo,
            requestedStatusKey: 'on_leave',
        });
    }, [onApprovalRowSelect, sourceDisplayName, sourceEmployeeId, sourceFrom, sourceTo]);

    useEffect(() => {
        if (!approvalModalOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setApprovalModalOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [approvalModalOpen]);

    const chartGroups = useMemo(() => {
        const labels = new Map();
        for (const month of trackMonths) {
            for (const group of month.groups || []) {
                const key = String(group.key || group.label || '').trim();
                if (!key || labels.has(key)) continue;
                labels.set(key, group.label || key);
            }
        }
        const list = [...labels.entries()].map(([key, label]) => ({ key, label }));
        if (groupKey && groupKey !== 'all') {
            const found = list.find((row) => row.key === groupKey);
            return found ? [found] : [{ key: groupKey, label: groupKey }];
        }
        return list;
    }, [groupKey, trackMonths]);

    const chartData = useMemo(
        () =>
            trackMonths.map((item) => {
                const row = { month: item.month };
                if (chartGroups.length) {
                    for (const group of chartGroups) {
                        const found = (item.groups || []).find(
                            (entry) => String(entry.key || entry.label || '') === group.key,
                        );
                        row[group.key] = Number(found?.total) || 0;
                    }
                } else {
                    row.total = Number(item.total) || 0;
                }
                return row;
            }),
        [chartGroups, trackMonths],
    );

    const shiftTrackYear = useCallback(
        (direction) => {
            if (isAllYear) return;
            const nextYear = Number(trackYear) + direction;
            if (nextYear < trackMinYear || nextYear > trackMaxYear) return;
            setTrackYear(nextYear);
            onYearChange?.(nextYear);
            fetchTeamTrack(nextYear);
        },
        [fetchTeamTrack, isAllYear, onYearChange, trackMaxYear, trackMinYear, trackYear],
    );

    return (
        <div className="space-y-5">
            <style>{`
                @keyframes leave-approval-blink {
                    0%, 100% { background-color: #DBEAFE; }
                    50% { background-color: #93C5FD; }
                }
                .leave-approval-row-blink {
                    animation: leave-approval-blink 0.4s ease-in-out 4;
                }
            `}</style>
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-[15px] font-semibold text-[#111827]">Leave Availability</h3>
                        {displayEmployeeName ? (
                            <p className="mt-1 text-xs text-[#6B7280]">
                                {yearLabel} days taken for{' '}
                                <span className="font-semibold text-[#111827]">{displayEmployeeName}</span>
                                {availabilityLoading ? ' · updating…' : ''}
                            </p>
                        ) : (
                            <p className="mt-1 text-xs text-[#6B7280]">
                                {yearLabel} days taken for the team. Calendar shows everyone on leave
                                {statusFilter !== ALL_LEAVE_STATUS ? ' · filtered' : ''}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={onApplyLeave}
                            className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
                        >
                            Apply Leave
                        </button>
                        <button
                            type="button"
                            onClick={onLeaveInformation}
                            className="rounded-md border border-[#D1D5DB] bg-white px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                        >
                            Leave Information
                        </button>
                    </div>
                </div>

                <div className="flex min-w-0 gap-3">
                    {AVAILABILITY_CARDS.map((card) => (
                        <LeaveAvailabilityRing
                            key={card.key}
                            label={card.label}
                            taken={displayAvailability[card.key]}
                            color={card.color}
                            track={card.track}
                            selected={statusFilter === card.statusKey}
                            scale={ringScale}
                            onClick={() =>
                                onStatusFilterChange?.(
                                    statusFilter === card.statusKey ? ALL_LEAVE_STATUS : card.statusKey,
                                )
                            }
                        />
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-[15px] font-semibold text-[#111827]">Leave Approval</h3>
                            {displayEmployeeName ? (
                                <p className="mt-1 text-xs text-[#6B7280]">
                                    Selected employee:{' '}
                                    <span className="font-semibold text-[#111827]">{displayEmployeeName}</span>
                                </p>
                            ) : selectedFromLabel || selectedToLabel ? (
                                <p className="mt-1 text-xs text-[#6B7280]">
                                    Showing all employees on the selected dates
                                </p>
                            ) : null}
                            {selectedFromLabel || selectedToLabel ? (
                                <p className="mt-1 text-xs text-[#6B7280]">
                                    Start date:{' '}
                                    <span className="font-semibold text-[#111827]">
                                        {selectedFromLabel || '—'}
                                    </span>
                                    <span className="mx-2 text-[#D1D5DB]">|</span>
                                    End date:{' '}
                                    <span className="font-semibold text-[#111827]">
                                        {selectedToLabel || '—'}
                                    </span>
                                </p>
                            ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            <ApprovalCategoryFilters
                                value={approvalCategory}
                                pendingCount={pendingCount}
                                approvedCount={approvedCount}
                                onChange={setApprovalCategory}
                            />
                            {categoryApprovalItems.length > APPROVAL_PREVIEW_LIMIT ? (
                                <button
                                    type="button"
                                    onClick={() => setApprovalModalOpen(true)}
                                    className="text-xs font-semibold text-[#2563EB] hover:underline"
                                >
                                    See more
                                </button>
                            ) : null}
                            {canReturnToSource ? (
                                <button
                                    type="button"
                                    onClick={handleReturnToSource}
                                    className="rounded-md border border-[#D1D5DB] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                                >
                                    Back to {sourceDisplayName}
                                    {sourceFromLabel && sourceToLabel ? ` (${sourceFromLabel} - ${sourceToLabel})` : ''}
                                </button>
                            ) : null}
                        </div>
                    </div>
                    {pendingError ? (
                        <div className="mb-3">
                            <ErpErrorBanner message={pendingError} onRetry={fetchPendingRequests} />
                        </div>
                    ) : null}
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[620px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                                    <th className="px-2 py-2">Name</th>
                                    <th className="px-2 py-2">Leave Type</th>
                                    <th className="px-2 py-2">Start Date</th>
                                    <th className="px-2 py-2">End Date</th>
                                    <th className="px-2 py-2">Status</th>
                                    <th className="px-2 py-2 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-2 py-8 text-center text-[#6B7280]">
                                            Loading leave requests...
                                        </td>
                                    </tr>
                                ) : (
                                    <LeaveApprovalTable
                                        rows={previewApprovalItems}
                                        decidingId={decidingId}
                                        isRowSelected={isRowSelected}
                                        isEmployeeHighlighted={isEmployeeHighlighted}
                                        onRowSelect={handleRowSelect}
                                        onRowDoubleClick={handleRowDoubleClick}
                                        onDecide={handleDecide}
                                        onAccept={handleAccept}
                                        onEdit={handleEdit}
                                        blinkRowId={blinkRowId}
                                        emptyLabel={approvalEmptyLabel}
                                    />
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="self-end rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-[15px] font-semibold text-[#111827]">Team Leave Track</h3>
                        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                            <button
                                type="button"
                                onClick={() => shiftTrackYear(-1)}
                                disabled={isAllYear || Number(trackYear) <= trackMinYear}
                                className="rounded p-0.5 hover:bg-[#F3F4F6] disabled:cursor-default disabled:opacity-40"
                                aria-label="Previous year"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span>
                                {isAllLeaveYear(trackYear)
                                    ? trackRangeLabel || 'Last 12 months'
                                    : trackYear}
                            </span>
                            <button
                                type="button"
                                onClick={() => shiftTrackYear(1)}
                                disabled={isAllYear || Number(trackYear) >= trackMaxYear}
                                className="rounded p-0.5 hover:bg-[#F3F4F6] disabled:cursor-default disabled:opacity-40"
                                aria-label="Next year"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                    {trackError ? (
                        <div className="mb-3">
                            <ErpErrorBanner message={trackError} onRetry={() => fetchTeamTrack(isAllYear ? ALL_LEAVE_YEAR : trackYear)} />
                        </div>
                    ) : null}
                    <div className="h-[220px] w-full min-h-[220px] min-w-0">
                        {trackLoading ? (
                            <div className="flex h-full items-center justify-center text-sm text-[#6B7280]">
                                Loading team leave track...
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                                <BarChart
                                    data={chartData}
                                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                                    barCategoryGap="42%"
                                    barGap={1}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                        axisLine={false}
                                        tickLine={false}
                                        interval={0}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                        axisLine={false}
                                        tickLine={false}
                                        allowDecimals={false}
                                        label={{
                                            value: 'Total Leaves',
                                            angle: -90,
                                            position: 'insideLeft',
                                            style: { fontSize: 11, fill: '#9CA3AF' },
                                        }}
                                    />
                                    <Tooltip
                                        formatter={(value, name) => [Number(value) || 0, name]}
                                        contentStyle={{ borderRadius: 10, borderColor: '#E5E7EB' }}
                                    />
                                    {chartGroups.length ? (
                                        <Legend
                                            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                                            iconType="circle"
                                            iconSize={8}
                                        />
                                    ) : null}
                                    {chartGroups.length
                                        ? chartGroups.map((group, index) => (
                                              <Bar
                                                  key={group.key}
                                                  dataKey={group.key}
                                                  name={group.label}
                                                  fill={GROUP_BAR_COLORS[index % GROUP_BAR_COLORS.length]}
                                                  radius={[2, 2, 0, 0]}
                                                  barSize={7}
                                                  maxBarSize={7}
                                                  minPointSize={6}
                                              />
                                          ))
                                        : (
                                              <Bar
                                                  dataKey="total"
                                                  name="Total leave taken"
                                                  fill="#2563EB"
                                                  radius={[2, 2, 0, 0]}
                                                  barSize={7}
                                                  maxBarSize={7}
                                                  minPointSize={6}
                                              />
                                          )}
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </section>
            </div>
            {approvalModalOpen && typeof document !== 'undefined'
                ? createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <button
                            type="button"
                            aria-label="Close leave requests"
                            className="absolute inset-0 bg-black/30"
                            onClick={() => setApprovalModalOpen(false)}
                        />
                        <div className="relative z-[101] flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
                            <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
                                <h3 className="text-[15px] font-semibold text-[#111827]">Leave Approval</h3>
                                <div className="flex items-center gap-3">
                                    <ApprovalCategoryFilters
                                        value={approvalCategory}
                                        pendingCount={pendingCount}
                                        approvedCount={approvedCount}
                                        onChange={setApprovalCategory}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setApprovalModalOpen(false)}
                                        className="rounded-md px-2 py-1 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6]"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                            <div className="min-h-0 flex-1 overflow-auto p-4">
                                <table className="w-full min-w-[620px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                                            <th className="px-2 py-2">Name</th>
                                            <th className="px-2 py-2">Leave Type</th>
                                            <th className="px-2 py-2">Start Date</th>
                                            <th className="px-2 py-2">End Date</th>
                                            <th className="px-2 py-2">Status</th>
                                            <th className="px-2 py-2 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <LeaveApprovalTable
                                            rows={categoryApprovalItems}
                                            decidingId={decidingId}
                                            isRowSelected={isRowSelected}
                                            isEmployeeHighlighted={isEmployeeHighlighted}
                                            onRowSelect={(row) => {
                                                handleRowSelect(row);
                                                setApprovalModalOpen(false);
                                            }}
                                            onRowDoubleClick={handleRowDoubleClick}
                                            onDecide={handleDecide}
                                            onAccept={(row) => {
                                                setApprovalModalOpen(false);
                                                handleAccept(row);
                                            }}
                                            onEdit={(row) => {
                                                setApprovalModalOpen(false);
                                                handleEdit(row);
                                            }}
                                            blinkRowId={blinkRowId}
                                            emptyLabel={approvalEmptyLabel}
                                        />
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )
                : null}
        </div>
    );
}
