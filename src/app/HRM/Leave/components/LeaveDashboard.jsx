'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import axiosInstance from '@/utils/axios';
import ErpErrorBanner from '@/components/ErpErrorBanner';

const AVAILABILITY_CARDS = [
    { key: 'sickLeave', label: 'Sick Leave', color: '#F5C842', track: '#FFF3CC' },
    { key: 'authorizedLeave', label: 'Authorize Leave', color: '#16B8A5', track: '#D7FAF4' },
    { key: 'unauthorizedLeave', label: 'Unauthorized Leave', color: '#EC4899', track: '#FCE7F3' },
    { key: 'compoffLeave', label: 'Comp Off Leave', color: '#8B5CF6', track: '#EDE9FE' },
    { key: 'annualLeaveTaken', label: 'Annual Leave', color: '#38BDF8', track: '#E0F2FE' },
];

const RING_SCALE = 8;

const ARC_RATIO = 0.75;
const GAUGE_SIZE = 56;
const GAUGE_STROKE = 5;

function LeaveAvailabilityRing({ taken, color, track, label }) {
    const safeTaken = Math.max(0, Number(taken) || 0);
    const pct = Math.min(1, safeTaken / Math.max(RING_SCALE, safeTaken, 1));
    const radius = (GAUGE_SIZE - GAUGE_STROKE) / 2;
    const center = GAUGE_SIZE / 2;
    const circumference = 2 * Math.PI * radius;
    const arcLength = circumference * ARC_RATIO;
    const gapLength = circumference - arcLength;
    const progressLength = arcLength * pct;

    return (
        <div className="flex min-w-0 flex-1 basis-0 flex-col rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm">
            <div className="mb-1 text-[11px] font-medium text-[#9CA3AF]">Days taken</div>
            <div className="flex flex-1 items-center justify-between gap-2">
                <div className="min-w-0 text-[13px] font-bold leading-tight text-[#111827] sm:text-[14px]">
                    {label}
                </div>
                <div className="relative h-14 w-14 shrink-0">
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
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#111827]">
                        {safeTaken}
                    </span>
                </div>
            </div>
        </div>
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
    onYearChange,
    onApplyLeave,
    onLeaveInformation,
    refreshKey = 0,
    onDataChanged,
    onApprovalRowSelect,
}) {
    const selectedEmployee = useMemo(
        () => employees.find((emp) => String(emp._id) === String(employeeId)) || null,
        [employeeId, employees],
    );

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

    const selectedYear = Number.isInteger(Number(year)) ? Number(year) : new Date().getFullYear();

    const availabilityRange = useMemo(
        () => ({
            from: `${selectedYear}-01-01`,
            to: `${selectedYear}-12-31`,
        }),
        [selectedYear],
    );

    const [availability, setAvailability] = useState(EMPTY_AVAILABILITY);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);

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
            const entries = Array.isArray(response.data?.entries) ? response.data.entries : [];
            setAvailability(countAvailabilityFromEntries(entries, employeeId));
        } catch {
            setAvailability(buildAvailability(selectedEmployee));
        } finally {
            setAvailabilityLoading(false);
        }
    }, [availabilityRange.from, availabilityRange.to, employeeId, selectedEmployee]);

    useEffect(() => {
        fetchAvailability();
    }, [fetchAvailability, refreshKey]);

    const [pendingItems, setPendingItems] = useState([]);
    const [pendingLoading, setPendingLoading] = useState(true);
    const [pendingError, setPendingError] = useState('');
    const [decidingId, setDecidingId] = useState('');

    const [trackYear, setTrackYear] = useState(selectedYear);
    const [trackMonths, setTrackMonths] = useState([]);
    const [trackLoading, setTrackLoading] = useState(true);
    const [trackError, setTrackError] = useState('');
    const [trackMonthIndex, setTrackMonthIndex] = useState(() => {
        const now = new Date();
        return selectedYear === now.getFullYear() ? now.getMonth() : 0;
    });

    const availabilityScrollRef = useRef(null);

    const fetchPendingRequests = useCallback(async () => {
        setPendingLoading(true);
        setPendingError('');
        try {
            const response = await axiosInstance.get('/Leave/pending-requests', {
                params: { year: selectedYear },
                skipToast: true,
            });
            setPendingItems(Array.isArray(response.data?.items) ? response.data.items : []);
        } catch (err) {
            setPendingItems([]);
            setPendingError(err?.response?.data?.message || err.message || 'Failed to load leave requests.');
        } finally {
            setPendingLoading(false);
        }
    }, [selectedYear]);

    const fetchTeamTrack = useCallback(async (year) => {
        setTrackLoading(true);
        setTrackError('');
        try {
            const response = await axiosInstance.get('/Leave/team-track', {
                params: { year },
                skipToast: true,
            });
            setTrackYear(Number(response.data?.year) || year);
            setTrackMonths(Array.isArray(response.data?.months) ? response.data.months : []);
        } catch (err) {
            setTrackMonths([]);
            setTrackError(err?.response?.data?.message || err.message || 'Failed to load team leave track.');
        } finally {
            setTrackLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPendingRequests();
        fetchTeamTrack(selectedYear);
    }, [fetchPendingRequests, fetchTeamTrack, refreshKey, selectedYear]);

    useEffect(() => {
        setTrackYear(selectedYear);
    }, [selectedYear]);

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
            pendingItems.filter((row) =>
                String(row.startDateKey || '').startsWith(`${selectedYear}-`),
            ),
        [pendingItems, selectedYear],
    );

    const sortedPendingItems = useMemo(() => {
        if (!employeeId) return yearPendingItems;

        const selectedRows = yearPendingItems.filter(
            (row) => String(row.employeeMongoId) === String(employeeId),
        );
        const otherRows = yearPendingItems.filter(
            (row) => String(row.employeeMongoId) !== String(employeeId),
        );
        return [...selectedRows, ...otherRows];
    }, [employeeId, yearPendingItems]);

    const isRowSelected = useCallback(
        (row) => {
            if (selectedApprovalId && String(row.id) === String(selectedApprovalId)) return true;
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

    const handleRowSelect = useCallback(
        (row) => {
            onApprovalRowSelect?.(row);
        },
        [onApprovalRowSelect],
    );

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

    const scrollAvailability = useCallback((direction) => {
        const container = availabilityScrollRef.current;
        if (!container) return;
        const cardWidth = container.firstElementChild?.offsetWidth || 180;
        container.scrollBy({ left: direction * (cardWidth + 12), behavior: 'smooth' });
    }, []);

    const chartMonthLabel = useMemo(() => {
        const monthDate = new Date(trackYear, trackMonthIndex, 1);
        return format(monthDate, 'MMMM, yyyy');
    }, [trackMonthIndex, trackYear]);

    const chartData = useMemo(
        () =>
            trackMonths.map((item) => {
                const authorizedLeave = Number(item.authorizedLeave) || 0;
                const unauthorizedLeave = Number(item.unauthorizedLeave) || 0;
                const sickLeave = Number(item.sickLeave) || 0;
                const compoffLeave = Number(item.compoffLeave) || 0;
                const annualLeave = Number(item.annualLeave) || 0;
                const total =
                    Number(item.total) ||
                    authorizedLeave + unauthorizedLeave + sickLeave + compoffLeave + annualLeave;

                return {
                    month: item.month,
                    total,
                    authorizedLeave,
                    unauthorizedLeave,
                    sickLeave,
                    compoffLeave,
                    annualLeave,
                };
            }),
        [trackMonths],
    );

    const shiftTrackMonth = useCallback(
        (direction) => {
            setTrackMonthIndex((current) => {
                const next = current + direction;
                if (next < 0) {
                    const prevYear = trackYear - 1;
                    setTrackYear(prevYear);
                    onYearChange?.(prevYear);
                    return 11;
                }
                if (next > 11) {
                    const nextYear = trackYear + 1;
                    setTrackYear(nextYear);
                    onYearChange?.(nextYear);
                    return 0;
                }
                return next;
            });
        },
        [onYearChange, trackYear],
    );

    return (
        <div className="mb-5 space-y-5">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-[15px] font-semibold text-[#111827]">Leave Availability</h3>
                        {displayEmployeeName ? (
                            <p className="mt-1 text-xs text-[#6B7280]">
                                {selectedYear} days taken for{' '}
                                <span className="font-semibold text-[#111827]">{displayEmployeeName}</span>
                                {availabilityLoading ? ' · updating…' : ''}
                            </p>
                        ) : (
                            <p className="mt-1 text-xs text-[#6B7280]">
                                Select an employee to view sick, authorize, unauthorized, comp off, and annual
                                leave for {selectedYear}
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

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => scrollAvailability(-1)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6]"
                        aria-label="Scroll leave cards left"
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <div
                        ref={availabilityScrollRef}
                        className="flex min-w-0 flex-1 gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {AVAILABILITY_CARDS.map((card) => (
                            <LeaveAvailabilityRing
                                key={card.key}
                                label={card.label}
                                taken={availability[card.key]}
                                color={card.color}
                                track={card.track}
                            />
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => scrollAvailability(1)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6]"
                        aria-label="Scroll leave cards right"
                    >
                        <ChevronRight size={18} />
                    </button>
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
                        {canReturnToSource ? (
                            <button
                                type="button"
                                onClick={handleReturnToSource}
                                className="shrink-0 rounded-md border border-[#D1D5DB] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                            >
                                Back to {sourceDisplayName}
                                {sourceFromLabel && sourceToLabel ? ` (${sourceFromLabel} - ${sourceToLabel})` : ''}
                            </button>
                        ) : null}
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
                                ) : sortedPendingItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-2 py-8 text-center text-[#6B7280]">
                                            No pending leave requests for {selectedYear}.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedPendingItems.map((row) => {
                                        const selected = isRowSelected(row);
                                        const employeeMatch = isEmployeeHighlighted(row);

                                        return (
                                            <tr
                                                key={row.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => handleRowSelect(row)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        handleRowSelect(row);
                                                    }
                                                }}
                                                className={`border-b border-[#F3F4F6] text-[#374151] cursor-pointer transition-colors hover:bg-[#F3F4F6] ${
                                                    selected
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
                                                    <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-xs font-semibold text-[#B45309]">
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-3">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={decidingId === row.id}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                handleDecide(row, 'approved');
                                                            }}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md bg-[#22C55E] text-white disabled:opacity-50"
                                                            aria-label="Approve"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={decidingId === row.id}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                handleDecide(row, 'rejected');
                                                            }}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md bg-[#EF4444] text-white disabled:opacity-50"
                                                            aria-label="Reject"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-[15px] font-semibold text-[#111827]">Team Leave Track</h3>
                        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                            <button
                                type="button"
                                onClick={() => shiftTrackMonth(-1)}
                                className="rounded p-0.5 hover:bg-[#F3F4F6]"
                                aria-label="Previous month"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span>{chartMonthLabel}</span>
                            <button
                                type="button"
                                onClick={() => shiftTrackMonth(1)}
                                className="rounded p-0.5 hover:bg-[#F3F4F6]"
                                aria-label="Next month"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                    {trackError ? (
                        <div className="mb-3">
                            <ErpErrorBanner message={trackError} onRetry={() => fetchTeamTrack(trackYear)} />
                        </div>
                    ) : null}
                    <div className="h-[220px] w-full">
                        {trackLoading ? (
                            <div className="flex h-full items-center justify-center text-sm text-[#6B7280]">
                                Loading team leave track...
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={chartData}
                                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                                    barCategoryGap={28}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                        axisLine={false}
                                        tickLine={false}
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
                                        formatter={(value) => [Number(value) || 0, 'Total leave taken']}
                                        contentStyle={{ borderRadius: 10, borderColor: '#E5E7EB' }}
                                    />
                                    <Bar
                                        dataKey="total"
                                        name="Total leave taken"
                                        fill="#2563EB"
                                        radius={[4, 4, 0, 0]}
                                        barSize={18}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
