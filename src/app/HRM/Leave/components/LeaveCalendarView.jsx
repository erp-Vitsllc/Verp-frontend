'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameMonth,
    parseISO,
    startOfMonth,
    startOfWeek,
    subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import { filterLeaveEntriesBySalary, isAllLeaveYear, isSalaryProcessingMonthOpen, processingStartForEmployee, useLeaveSalaryVisibility } from '../utils/leaveSalaryVisibility';
import {
    addDaysToDateKey,
    buildLeaveSpans,
    buildSelectedDraftSpan,
    buildWeekBarLayout,
    chunkWeeks,
    countDaySegments,
    countLeavesByDate,
    daysBetweenKeys,
    firstNameFromDisplay,
    formatDateKey,
    isValidDateKey,
    LEAVE_LEGEND,
    leaveMetaForStatus,
    leaveTypeFromStatusKey,
    nextDateKey,
} from '../utils/leaveCalendarUtils';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MAX_VISIBLE_LANES = 3;
const LANE_HEIGHT = 26;
const CELL_PADDING_Y = 8;
const DATE_ROW_HEIGHT = 28;
const DATE_BAR_GAP = 6;
const BAR_TOP = CELL_PADDING_Y + DATE_ROW_HEIGHT + DATE_BAR_GAP;
const CELL_MIN_HEIGHT = 168;

function clampRangeToMin(fromKey, toKey, minDate) {
    if (!minDate || !isValidDateKey(minDate) || !isValidDateKey(fromKey) || !isValidDateKey(toKey)) {
        return { from: fromKey, to: toKey };
    }
    if (fromKey >= minDate) return { from: fromKey, to: toKey };
    const length = daysBetweenKeys(fromKey, toKey);
    return { from: minDate, to: addDaysToDateKey(minDate, length) };
}

function rangeFromPendingDrag(drag, hoverKey) {
    if (!drag || !isValidDateKey(hoverKey)) {
        return { from: drag?.from || '', to: drag?.to || '' };
    }
    if (drag.edge === 'start') {
        const nextFrom = hoverKey > drag.originTo ? drag.originTo : hoverKey;
        return clampRangeToMin(nextFrom, drag.originTo, drag.minDate);
    }
    if (drag.edge === 'end') {
        const nextTo = hoverKey < drag.originFrom ? drag.originFrom : hoverKey;
        return clampRangeToMin(drag.originFrom, nextTo, drag.minDate);
    }
    const length = daysBetweenKeys(drag.originFrom, drag.originTo);
    const nextFrom = addDaysToDateKey(hoverKey, -Number(drag.grabOffset || 0));
    const nextTo = addDaysToDateKey(nextFrom, length);
    return clampRangeToMin(nextFrom, nextTo, drag.minDate);
}

function buildCalendarDays(monthDate) {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

function DayLabel({ day, isSelected, inMonth }) {
    const isFirstOfMonth = day.getDate() === 1;
    const label = isFirstOfMonth ? format(day, 'MMMM d') : format(day, 'd');

    if (isSelected) {
        return (
            <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-[#5B9BD5] px-1.5 text-[12px] font-semibold text-white shadow-sm">
                {format(day, 'd')}
            </span>
        );
    }

    return (
        <span
            className={`text-center text-[12px] font-medium leading-none ${
                inMonth ? 'text-[#111827]' : 'text-[#9CA3AF]'
            }`}
        >
            {label}
        </span>
    );
}

function spanMatchesFocus(segment, { from, to, approvalId, employeeId } = {}) {
    if (!segment || segment.isDraft || segment.statusKey === 'draft_selection') return false;
    const approval = String(approvalId || '').trim();
    if (approval) {
        if (String(segment.attendanceId || '') === approval) return true;
        if (Array.isArray(segment.attendanceIds) && segment.attendanceIds.some((id) => String(id) === approval)) {
            return true;
        }
        if (String(segment.leaveRequestGroupId || '') === approval) return true;
    }
    if (!approval && !employeeId) return false;
    if (!isValidDateKey(from) || !isValidDateKey(to)) return false;
    const start = segment.start;
    const end = segment.end || segment.start;
    if (start !== from || end !== to) return false;
    if (employeeId && String(segment.employeeMongoId || '') !== String(employeeId)) return false;
    return true;
}

function LeaveEventBar({
    segment,
    isDraft = false,
    isFocused = false,
    onResizeStart,
    onPendingDragStart,
    onSelect,
    onDoubleSelect,
}) {
    const isPending = Boolean(segment.isPending) && !isDraft;
    const meta = leaveMetaForStatus(segment.statusKey, isDraft, isPending, isFocused);
    const name = firstNameFromDisplay(segment.employeeName);
    const showLabel = segment.spanStartsHere;
    const canDragPending = Boolean(isPending && onPendingDragStart);
    const canResizeStart = Boolean(
        (isDraft && segment.spanStartsHere && onResizeStart) ||
            (canDragPending && segment.spanStartsHere),
    );
    const canResizeEnd = Boolean(
        (isDraft && segment.spanEndsHere && onResizeStart) ||
            (canDragPending && segment.spanEndsHere),
    );

    const handleBarPointerDown = (event) => {
        if (event.button != null && event.button !== 0) return;

        if (canDragPending) {
            event.preventDefault();
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1);
            const edge =
                ratio <= 0.22 && segment.spanStartsHere
                    ? 'start'
                    : ratio >= 0.78 && segment.spanEndsHere
                      ? 'end'
                      : 'move';
            onPendingDragStart(edge, event, segment);
            return;
        }

        if (!isDraft || !onResizeStart) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const edge = offsetX <= rect.width * 0.25 ? 'start' : offsetX >= rect.width * 0.75 ? 'end' : null;
        if (!edge) return;
        if (edge === 'start' && !canResizeStart) return;
        if (edge === 'end' && !canResizeEnd) return;
        onResizeStart(edge, event);
    };

    return (
        <div
            className={`group relative flex h-[22px] w-full items-center justify-between overflow-visible px-1.5 text-[11px] font-medium leading-none ${
                isDraft || canDragPending
                    ? 'cursor-grab touch-none active:cursor-grabbing'
                    : onSelect || onDoubleSelect
                      ? 'cursor-pointer'
                      : ''
            }`}
            style={{
                backgroundColor: meta.bg,
                color: meta.text || meta.color,
                boxShadow: isFocused ? '0 0 0 2px #1D4ED8' : undefined,
                borderRadius: segment.spanStartsHere && segment.spanEndsHere
                    ? '4px'
                    : segment.spanStartsHere
                      ? '4px 0 0 4px'
                      : segment.spanEndsHere
                        ? '0 4px 4px 0'
                        : '0',
            }}
            title={
                isDraft
                    ? 'Drag the left or right edge to change start and end dates'
                    : canDragPending
                      ? `${segment.employeeName || name} / ${meta.label}${isFocused ? ' (Selected)' : ' (Pending)'} — drag to move, edges to resize`
                      : `${segment.employeeName || name} / ${meta.label}${isFocused ? ' (Selected)' : ''} — click to highlight, double-click for leave overview`
            }
            onPointerDown={isDraft || canDragPending ? handleBarPointerDown : undefined}
            onClick={(event) => {
                if (isDraft || canDragPending || !onSelect) return;
                event.preventDefault();
                event.stopPropagation();
                onSelect(segment);
            }}
            onDoubleClick={(event) => {
                if (isDraft || !onDoubleSelect) return;
                event.preventDefault();
                event.stopPropagation();
                onDoubleSelect(segment);
            }}
        >
            {canResizeStart ? (
                <span
                    aria-hidden
                    className="absolute -left-1.5 top-0 z-10 h-full w-3 cursor-w-resize rounded-sm bg-[#9CA3AF]/0 group-hover:bg-[#9CA3AF]/30"
                />
            ) : null}

            {showLabel ? (
                <>
                    <span className="truncate pl-1 pointer-events-none">
                        <span className="mr-0.5">•</span>
                        {name} / {meta.short}
                    </span>
                    <span className="ml-1 shrink-0 text-[13px] leading-none opacity-80 pointer-events-none">›</span>
                </>
            ) : (
                <span className="opacity-0 pointer-events-none">.</span>
            )}

            {canResizeEnd ? (
                <span
                    aria-hidden
                    className="absolute -right-1.5 top-0 z-10 h-full w-3 cursor-e-resize rounded-sm bg-[#9CA3AF]/0 group-hover:bg-[#9CA3AF]/30"
                />
            ) : null}
        </div>
    );
}

function LeaveWeekRow({
    weekDays,
    monthDate,
    approvedLayout,
    draftLayout,
    countsByDate,
    leavesByDate,
    selectedDateKey,
    expandedDateKey,
    onSelectDate,
    onToggleExpandDay,
    onDraftResizeStart,
    onPendingDragStart,
    onLeaveBarClick,
    onLeaveBarDoubleClick,
    isDraggingDraft = false,
    focusFrom = '',
    focusTo = '',
    focusApprovalId = '',
    focusEmployeeId = '',
    stretchWeeks = false,
}) {
    const focus = {
        from: focusFrom,
        to: focusTo,
        approvalId: focusApprovalId,
        employeeId: focusEmployeeId,
    };
    const { segments: approvedSegments, allSegments: approvedAll, lanesUsed: approvedLanes } =
        approvedLayout;
    const { segments: draftSegments, lanesUsed: draftLanes } = draftLayout;
    const compactBarHeight = Math.max(approvedLanes + draftLanes, 1) * LANE_HEIGHT;
    const expandedDayIndex = weekDays.findIndex(
        (day) => formatDateKey(day) === expandedDateKey,
    );
    const isWeekExpanded = expandedDayIndex >= 0;
    const expandedLeaves = isWeekExpanded ? leavesByDate.get(expandedDateKey) || [] : [];
    const expandedListHeight = Math.max(
        compactBarHeight,
        expandedLeaves.length * 28 + 12,
    );
    const barAreaHeight = isWeekExpanded ? expandedListHeight : compactBarHeight;

    return (
        <div className={`relative border-b border-[#E5E7EB] ${stretchWeeks ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
            <div className={`grid grid-cols-7 ${stretchWeeks ? 'h-full min-h-0 flex-1' : ''}`}>
                {weekDays.map((day, dayIndex) => {
                    const dateKey = formatDateKey(day);
                    const inMonth = isSameMonth(day, monthDate);
                    const isExpanded = expandedDateKey === dateKey;
                    const dailyCount = countsByDate.get(dateKey) || 0;
                    const dayLeaves = leavesByDate.get(dateKey) || [];
                    const segmentsOnDay =
                        countDaySegments(approvedAll, dayIndex) +
                        countDaySegments(draftLayout.allSegments || [], dayIndex);
                    const dayHidden = Math.max(0, segmentsOnDay - MAX_VISIBLE_LANES);

                    return (
                        <button
                            key={dateKey}
                            type="button"
                            data-date-key={dateKey}
                            onClick={() => {
                                onSelectDate?.(dateKey);
                                onToggleExpandDay?.(dateKey);
                            }}
                            className={`relative flex flex-col border-r border-[#E5E7EB] bg-white px-1 py-2 last:border-r-0 text-left transition-shadow ${
                                stretchWeeks ? 'h-full' : ''
                            } ${
                                isExpanded
                                    ? 'z-[4] bg-[#F8FAFC] ring-2 ring-inset ring-[#5B9BD5] shadow-md'
                                    : ''
                            }`}
                            style={{
                                minHeight: stretchWeeks
                                    ? undefined
                                    : isExpanded
                                      ? Math.max(CELL_MIN_HEIGHT, DATE_ROW_HEIGHT + expandedListHeight + 40)
                                      : isWeekExpanded
                                        ? Math.max(CELL_MIN_HEIGHT, DATE_ROW_HEIGHT + barAreaHeight + 40)
                                        : CELL_MIN_HEIGHT,
                            }}
                        >
                            <div
                                className="flex shrink-0 items-center justify-center"
                                style={{ height: DATE_ROW_HEIGHT }}
                            >
                                <DayLabel
                                    day={day}
                                    isSelected={isExpanded}
                                    inMonth={inMonth}
                                />
                            </div>

                            {isExpanded ? (
                                <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-0.5 pb-1">
                                    {dayLeaves.length === 0 ? (
                                        <span className="px-1 text-[10px] text-[#9CA3AF]">No leave on this day</span>
                                    ) : (
                                        dayLeaves.map((leave) => {
                                            const leaveFocused = spanMatchesFocus(
                                                {
                                                    ...leave,
                                                    start: leave.rangeStart || dateKey,
                                                    end: leave.rangeEnd || dateKey,
                                                },
                                                focus,
                                            );
                                            const meta = leaveMetaForStatus(
                                                leave.statusKey,
                                                leave.isDraft,
                                                Boolean(leave.isPending),
                                                leaveFocused,
                                            );
                                            return (
                                                <div
                                                    key={`${leave.id}-${leave.statusKey}`}
                                                    role={leave.isDraft ? undefined : 'button'}
                                                    className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium leading-tight"
                                                    style={{
                                                        backgroundColor: meta.bg,
                                                        color: meta.text || meta.color,
                                                    }}
                                                    title={`${leave.employeeName} / ${meta.label}`}
                                                    onClick={(event) => {
                                                        if (leave.isDraft) return;
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        onLeaveBarClick?.({
                                                            employeeMongoId: leave.employeeMongoId,
                                                            employeeId: leave.employeeId,
                                                            employeeName: leave.employeeName,
                                                            statusKey: leave.statusKey,
                                                            start: dateKey,
                                                            end: dateKey,
                                                            isPending: leave.isPending,
                                                        });
                                                    }}
                                                    onDoubleClick={(event) => {
                                                        if (leave.isDraft) return;
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        onLeaveBarDoubleClick?.({
                                                            employeeMongoId: leave.employeeMongoId,
                                                            employeeId: leave.employeeId,
                                                            employeeName: leave.employeeName,
                                                            statusKey: leave.statusKey,
                                                            start: dateKey,
                                                            end: dateKey,
                                                            isPending: leave.isPending,
                                                        });
                                                    }}
                                                >
                                                    <span className="truncate">
                                                        • {firstNameFromDisplay(leave.employeeName)} / {meta.short}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            ) : (
                                <div className="flex-1" style={{ minHeight: barAreaHeight }} aria-hidden />
                            )}

                            <div className="mt-auto flex shrink-0 items-end justify-between gap-1 px-0.5 pb-0.5">
                                {dailyCount > 0 ? (
                                    <span className="text-[10px] font-medium text-[#6B7280]">
                                        Total Leaves: {dailyCount}
                                    </span>
                                ) : (
                                    <span />
                                )}
                                {isExpanded ? (
                                    <span className="rounded bg-[#2563EB] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                        Close
                                    </span>
                                ) : dayHidden > 0 ? (
                                    <span className="rounded bg-[#2563EB] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                        +{dayHidden} more
                                    </span>
                                ) : null}
                            </div>
                        </button>
                    );
                })}
            </div>

            {!isWeekExpanded ? (
            <div
                className={`absolute inset-x-0 px-[2px] ${isDraggingDraft ? 'pointer-events-none' : ''}`}
                style={{ top: BAR_TOP, height: barAreaHeight }}
            >
                    {approvedSegments.map((segment) => {
                        const colWidth = 100 / 7;
                        const left = segment.startIdx * colWidth;
                        const width = (segment.endIdx - segment.startIdx + 1) * colWidth;
                        const isFocused = Boolean(segment.isFocused) || spanMatchesFocus(segment, focus);

                        return (
                            <div
                                key={`approved-${segment.id}-${segment.segStart}`}
                                className={`absolute px-[3px] ${
                                    segment.isPending ? '' : 'cursor-pointer'
                                }`}
                                style={{
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    top: segment.lane * LANE_HEIGHT,
                                    zIndex: isFocused ? 6 : 2,
                                }}
                                onClick={(event) => {
                                    if (segment.isPending) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onLeaveBarClick?.(segment);
                                }}
                                onDoubleClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onLeaveBarDoubleClick?.(segment);
                                }}
                            >
                                <LeaveEventBar
                                    segment={segment}
                                    isFocused={isFocused}
                                    onSelect={onLeaveBarClick}
                                    onDoubleSelect={onLeaveBarDoubleClick}
                                    onPendingDragStart={
                                        segment.isPending ? onPendingDragStart : undefined
                                    }
                                />
                            </div>
                        );
                    })}

                    {draftSegments.map((segment) => {
                        const colWidth = 100 / 7;
                        const left = segment.startIdx * colWidth;
                        const width = (segment.endIdx - segment.startIdx + 1) * colWidth;

                        return (
                            <div
                                key={`draft-${segment.id}-${segment.segStart}`}
                                className="absolute px-[3px]"
                                style={{
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    top: (approvedLanes + segment.lane) * LANE_HEIGHT,
                                    zIndex: 3,
                                }}
                            >
                                <LeaveEventBar
                                    segment={segment}
                                    isDraft
                                    onResizeStart={onDraftResizeStart}
                                />
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

export default function LeaveCalendarView({
    employeeId,
    from,
    to,
    employeeName,
    year,
    yearMin,
    yearMax,
    onYearChange,
    groupEmployeeIds = null,
    statusFilter = 'all',
    onConfirm,
    onDraftRangeChange,
    onPendingRangeChange,
    refreshKey = 0,
    confirming = false,
    hideDraft = false,
    onLeaveBarClick,
    onLeaveBarDoubleClick,
    approvalId = '',
    fillViewport = false,
}) {
    const gridRef = useRef(null);
    const draftRangeRef = useRef({ from, to });
    const prevFromRef = useRef(from);
    const monthNavTimerRef = useRef(null);
    const [entries, setEntries] = useState([]);
    const salaryVisibility = useLeaveSalaryVisibility();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedDateKey, setSelectedDateKey] = useState(from || '');
    const [expandedDateKey, setExpandedDateKey] = useState('');
    const [draftFrom, setDraftFrom] = useState(from || '');
    const [draftTo, setDraftTo] = useState(to || '');
    const [dragEdge, setDragEdge] = useState(null);
    const pendingDragRef = useRef(null);
    const [pendingDrag, setPendingDrag] = useState(null);
    const isAllYear = isAllLeaveYear(year);
    const currentYear = new Date().getFullYear();
    const calendarMinYear = Number.isInteger(Number(yearMin)) ? Number(yearMin) : currentYear;
    const calendarMaxYear = Number.isInteger(Number(yearMax)) ? Number(yearMax) : currentYear;
    const selectedYear = isAllYear
        ? currentYear
        : Number.isInteger(Number(year))
          ? Number(year)
          : currentYear;
    const [monthDate, setMonthDate] = useState(() => {
        if (isValidDateKey(from)) return parseISO(from);
        const now = new Date();
        if (isAllYear || selectedYear === now.getFullYear()) return now;
        return new Date(selectedYear, 0, 1);
    });

    const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);
    const weeks = useMemo(() => chunkWeeks(calendarDays), [calendarDays]);
    const monthFrom = calendarDays[0] ? formatDateKey(calendarDays[0]) : from;
    const monthTo = calendarDays.length
        ? formatDateKey(calendarDays[calendarDays.length - 1])
        : to;

    draftRangeRef.current = { from: draftFrom, to: draftTo };

    const fetchCalendar = useCallback(async () => {
        if (!isValidDateKey(monthFrom) || !isValidDateKey(monthTo)) {
            setEntries([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get('/Leave/calendar', {
                params: { from: monthFrom, to: monthTo, leaveType: 'all' },
                skipToast: true,
            });
            setEntries(Array.isArray(response.data?.entries) ? response.data.entries : []);
        } catch (err) {
            setEntries([]);
            setError(err?.response?.data?.message || err.message || 'Failed to load leave calendar.');
        } finally {
            setLoading(false);
        }
    }, [monthFrom, monthTo]);

    useEffect(() => {
        fetchCalendar();
    }, [fetchCalendar, refreshKey]);

    useEffect(() => {
        if (dragEdge) return;

        setDraftFrom(from || '');
        setDraftTo(to || '');
        setExpandedDateKey('');
        if (isValidDateKey(from)) {
            setSelectedDateKey(from);
        }

        if (isValidDateKey(from) && from !== prevFromRef.current) {
            setMonthDate(parseISO(from));
        }
        prevFromRef.current = from;
    }, [from, to, approvalId, dragEdge]);

    useEffect(() => {
        if (isAllYear) return;
        setMonthDate((current) => {
            if (current.getFullYear() === selectedYear) return current;
            return new Date(selectedYear, current.getMonth(), 1);
        });
    }, [isAllYear, selectedYear]);

    const dateFromClientPoint = useCallback(
        (clientX, clientY) => {
            const elements = document.elementsFromPoint(clientX, clientY);
            for (const element of elements) {
                const cell = element.closest?.('[data-date-key]');
                if (cell) {
                    const dateKey = cell.getAttribute('data-date-key');
                    if (isValidDateKey(dateKey)) return dateKey;
                }
            }

            const grid = gridRef.current;
            if (!grid || !calendarDays.length) return null;

            const rect = grid.getBoundingClientRect();
            if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
                return null;
            }

            const x = Math.max(rect.left + 1, Math.min(rect.right - 1, clientX));
            const y = Math.max(rect.top + 1, Math.min(rect.bottom - 1, clientY));
            const col = Math.max(0, Math.min(6, Math.floor(((x - rect.left) / rect.width) * 7)));
            const rowCount = Math.max(1, weeks.length);
            const row = Math.max(
                0,
                Math.min(rowCount - 1, Math.floor(((y - rect.top) / rect.height) * rowCount)),
            );
            const day = calendarDays[row * 7 + col];
            return day ? formatDateKey(day) : null;
        },
        [calendarDays, weeks.length],
    );

    const shiftDraftEdgeByDay = useCallback(
        (edge, deltaDays) => {
            const current = draftRangeRef.current;
            const anchor = edge === 'start' ? current.from : current.to;
            if (!isValidDateKey(anchor)) return;

            const [year, month, day] = anchor.split('-').map(Number);
            const shifted = new Date(year, month - 1, day + deltaDays);
            const nextKey = formatDateKey(shifted);

            if (edge === 'start') {
                const nextFrom = nextKey > current.to ? current.to : nextKey;
                draftRangeRef.current = { from: nextFrom, to: current.to };
                setDraftFrom(nextFrom);
                setSelectedDateKey(nextFrom);
            } else {
                const nextTo = nextKey < current.from ? current.from : nextKey;
                draftRangeRef.current = { from: current.from, to: nextTo };
                setDraftTo(nextTo);
                setSelectedDateKey(nextTo);
            }
        },
        [],
    );

    const maybeAutoNavigateMonth = useCallback(
        (clientX, clientY, edge) => {
            const grid = gridRef.current;
            if (!grid) return;

            const rect = grid.getBoundingClientRect();
            const edgeThreshold = 28;
            let deltaMonths = 0;

            if (clientY < rect.top + edgeThreshold || clientX < rect.left + edgeThreshold) {
                deltaMonths = edge === 'start' ? -1 : 0;
            } else if (clientY > rect.bottom - edgeThreshold || clientX > rect.right - edgeThreshold) {
                deltaMonths = edge === 'end' ? 1 : 0;
            }

            if (deltaMonths === 0) return;

            if (monthNavTimerRef.current) return;

            monthNavTimerRef.current = window.setTimeout(() => {
                monthNavTimerRef.current = null;
            }, 180);

            setMonthDate((value) => {
                const next = deltaMonths < 0 ? subMonths(value, 1) : addMonths(value, 1);
                const nextYear = next.getFullYear();
                if (nextYear < calendarMinYear || nextYear > calendarMaxYear) return value;
                if (!isAllYear && nextYear !== selectedYear) {
                    onYearChange?.(nextYear);
                }
                return next;
            });
            shiftDraftEdgeByDay(edge, deltaMonths < 0 ? -1 : 1);
        },
        [
            calendarMaxYear,
            calendarMinYear,
            isAllYear,
            onYearChange,
            selectedYear,
            shiftDraftEdgeByDay,
        ],
    );

    const handleDraftResizeStart = useCallback((edge, event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget?.setPointerCapture?.(event.pointerId);
        setDragEdge(edge);
    }, []);

    const handlePendingDragStart = useCallback(
        (edge, event, segment) => {
            if (!segment?.isPending) return;
            event.preventDefault();
            event.stopPropagation();

            const hoverKey = dateFromClientPoint(event.clientX, event.clientY) || segment.start;
            const drag = {
                edge,
                spanId: segment.id,
                attendanceId: String(segment.attendanceId || ''),
                employeeMongoId: String(segment.employeeMongoId || ''),
                employeeId: String(segment.employeeId || ''),
                employeeName: segment.employeeName || '',
                statusKey: segment.statusKey,
                originFrom: segment.start,
                originTo: segment.end,
                from: segment.start,
                to: segment.end,
                grabOffset: Math.max(0, daysBetweenKeys(segment.start, hoverKey)),
                minDate: processingStartForEmployee(
                    salaryVisibility,
                    segment.employeeMongoId,
                    segment.employeeId,
                ),
                active: false,
                startX: event.clientX,
                startY: event.clientY,
            };
            pendingDragRef.current = drag;

            const handleMove = (moveEvent) => {
                const current = pendingDragRef.current;
                if (!current) return;
                const dx = Math.abs(moveEvent.clientX - current.startX);
                const dy = Math.abs(moveEvent.clientY - current.startY);
                if (!current.active && dx < 6 && dy < 6) return;
                current.active = true;
                const hover = dateFromClientPoint(moveEvent.clientX, moveEvent.clientY);
                if (!hover) return;
                const next = rangeFromPendingDrag(current, hover);
                current.from = next.from;
                current.to = next.to;
                setPendingDrag({ ...current });
                setSelectedDateKey(hover);
            };

            const handleUp = (upEvent) => {
                window.removeEventListener('pointermove', handleMove);
                window.removeEventListener('pointerup', handleUp);
                window.removeEventListener('pointercancel', handleUp);
                document.body.style.userSelect = '';
                document.body.style.cursor = '';

                const current = pendingDragRef.current;
                pendingDragRef.current = null;
                setPendingDrag(null);
                if (!current) return;

                if (!current.active) {
                    onLeaveBarClick?.(segment);
                    return;
                }

                const hover = dateFromClientPoint(upEvent.clientX, upEvent.clientY);
                const next = hover
                    ? rangeFromPendingDrag(current, hover)
                    : { from: current.from, to: current.to };
                if (
                    !current.attendanceId ||
                    !current.employeeMongoId ||
                    (next.from === current.originFrom && next.to === current.originTo)
                ) {
                    return;
                }

                onPendingRangeChange?.({
                    attendanceId: current.attendanceId,
                    employeeMongoId: current.employeeMongoId,
                    from: next.from,
                    to: next.to,
                    leaveType: leaveTypeFromStatusKey(current.statusKey),
                });
            };

            window.addEventListener('pointermove', handleMove);
            window.addEventListener('pointerup', handleUp);
            window.addEventListener('pointercancel', handleUp);
            document.body.style.userSelect = 'none';
            document.body.style.cursor =
                edge === 'move' ? 'grabbing' : edge === 'start' ? 'w-resize' : 'e-resize';
        },
        [dateFromClientPoint, onLeaveBarClick, onPendingRangeChange, salaryVisibility],
    );

    useEffect(() => {
        if (!dragEdge) return undefined;

        const handleMove = (event) => {
            const dateKey = dateFromClientPoint(event.clientX, event.clientY);

            if (dateKey) {
                const current = draftRangeRef.current;
                if (dragEdge === 'start') {
                    const nextFrom = dateKey > current.to ? current.to : dateKey;
                    draftRangeRef.current = { from: nextFrom, to: current.to };
                    setDraftFrom(nextFrom);
                    setSelectedDateKey(nextFrom);
                } else {
                    const nextTo = dateKey < current.from ? current.from : dateKey;
                    draftRangeRef.current = { from: current.from, to: nextTo };
                    setDraftTo(nextTo);
                    setSelectedDateKey(nextTo);
                }
                return;
            }

            maybeAutoNavigateMonth(event.clientX, event.clientY, dragEdge);
        };

        const handleUp = (event) => {
            const dateKey = dateFromClientPoint(event.clientX, event.clientY);
            const current = draftRangeRef.current;

            if (dateKey) {
                if (dragEdge === 'start') {
                    const nextFrom = dateKey > current.to ? current.to : dateKey;
                    draftRangeRef.current = { from: nextFrom, to: current.to };
                } else {
                    const nextTo = dateKey < current.from ? current.from : dateKey;
                    draftRangeRef.current = { from: current.from, to: nextTo };
                }
            }

            const nextRange = draftRangeRef.current;
            setDragEdge(null);

            if (
                isValidDateKey(nextRange.from) &&
                isValidDateKey(nextRange.to) &&
                (nextRange.from !== from || nextRange.to !== to)
            ) {
                setDraftFrom(nextRange.from);
                setDraftTo(nextRange.to);
                onDraftRangeChange?.({ from: nextRange.from, to: nextRange.to });
            }
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('pointercancel', handleUp);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = dragEdge === 'start' ? 'w-resize' : 'e-resize';

        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            window.removeEventListener('pointercancel', handleUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            if (monthNavTimerRef.current) {
                window.clearTimeout(monthNavTimerRef.current);
                monthNavTimerRef.current = null;
            }
        };
    }, [dateFromClientPoint, dragEdge, from, maybeAutoNavigateMonth, onDraftRangeChange, to]);

    const approvedEntries = useMemo(() => {
        let visible = filterLeaveEntriesBySalary(entries, salaryVisibility).filter(
            (entry) => String(entry.statusKey || '') !== 'holiday',
        );
        if (groupEmployeeIds) {
            visible = visible.filter((entry) =>
                groupEmployeeIds.has(String(entry.employeeMongoId || '')),
            );
        }
        if (statusFilter && statusFilter !== 'all') {
            visible = visible.filter((entry) => String(entry.statusKey || '') === statusFilter);
        }
        return visible;
    }, [entries, groupEmployeeIds, salaryVisibility, statusFilter]);

    const draftSpan = useMemo(
        () =>
            hideDraft
                ? null
                : buildSelectedDraftSpan({
                      employeeId,
                      employeeName,
                      from: draftFrom,
                      to: draftTo,
                  }),
        [draftFrom, draftTo, employeeId, employeeName, hideDraft],
    );
    const approvedSpans = useMemo(() => buildLeaveSpans(approvedEntries), [approvedEntries]);
    const displayApprovedSpans = useMemo(() => {
        const next =
            pendingDrag?.from && pendingDrag?.to
                ? approvedSpans.map((span) => {
                      const sameAttendance =
                          pendingDrag.attendanceId &&
                          String(span.attendanceId || '') === String(pendingDrag.attendanceId);
                      const sameId = String(span.id) === String(pendingDrag.spanId);
                      if (!sameAttendance && !sameId) return span;
                      return { ...span, start: pendingDrag.from, end: pendingDrag.to };
                  })
                : approvedSpans;

        const focus = { from, to, approvalId, employeeId };
        const tagged = next.map((span) => ({
            ...span,
            isFocused: Boolean(span.isFocused) || spanMatchesFocus(span, focus),
        }));
        if (tagged.some((span) => span.isFocused)) return tagged;
        if (!String(approvalId || '').trim() || !isValidDateKey(from) || !isValidDateKey(to)) {
            return tagged;
        }

        const sample = (approvedEntries || []).find((entry) => {
            const entryId = String(entry.attendanceId || entry.id || '');
            if (entryId === String(approvalId)) return true;
            if (String(entry.leaveRequestGroupId || '') === String(approvalId)) return true;
            return (
                isValidDateKey(entry.date) &&
                entry.date >= from &&
                entry.date <= to &&
                (!employeeId || String(entry.employeeMongoId || '') === String(employeeId))
            );
        });

        return [
            ...tagged,
            {
                id: `focused-${approvalId}`,
                employeeMongoId: sample?.employeeMongoId || employeeId || '',
                employeeId: sample?.employeeId || '',
                employeeName: sample?.employeeName || employeeName || 'Selected Leave',
                statusKey: sample?.statusKey || 'on_leave',
                isPending: false,
                isFocused: true,
                attendanceId: String(approvalId),
                attendanceIds: [String(approvalId)],
                start: from,
                end: to,
            },
        ];
    }, [approvalId, approvedEntries, approvedSpans, employeeId, employeeName, from, pendingDrag, to]);
    const draftSpans = useMemo(() => (draftSpan ? [draftSpan] : []), [draftSpan]);

    const countsByDate = useMemo(
        () => countLeavesByDate(approvedEntries, draftSpan),
        [approvedEntries, draftSpan],
    );

    const leavesByDate = useMemo(() => {
        const map = new Map();

        for (const entry of approvedEntries || []) {
            const dateKey = String(entry.date || '').trim();
            if (!isValidDateKey(dateKey)) continue;
            if (!map.has(dateKey)) map.set(dateKey, []);
            map.get(dateKey).push({
                id: entry.id || `${entry.employeeMongoId}-${dateKey}`,
                employeeMongoId: entry.employeeMongoId,
                employeeId: entry.employeeId,
                employeeName: entry.employeeName || 'Employee',
                statusKey: entry.statusKey,
                attendanceId: String(entry.attendanceId || entry.id || ''),
                attendanceIds: entry.attendanceId ? [String(entry.attendanceId)] : [String(entry.id || '')],
                leaveRequestGroupId: String(entry.leaveRequestGroupId || ''),
                rangeStart: entry.rangeStart || dateKey,
                rangeEnd: entry.rangeEnd || dateKey,
                isDraft: false,
                isPending: Boolean(entry.isPending),
            });
        }

        if (draftSpan?.start && draftSpan?.end) {
            for (let cursor = draftSpan.start; cursor <= draftSpan.end; cursor = nextDateKey(cursor)) {
                if (!map.has(cursor)) map.set(cursor, []);
                map.get(cursor).push({
                    id: `draft-${draftSpan.employeeMongoId}-${cursor}`,
                    employeeName: draftSpan.employeeName || 'Selected Employee',
                    statusKey: 'draft_selection',
                    isDraft: true,
                });
            }
        }

        return map;
    }, [approvedEntries, draftSpan]);

    const handleToggleExpandDay = useCallback((dateKey) => {
        if (String(approvalId || '').trim()) {
            setExpandedDateKey('');
            return;
        }
        setExpandedDateKey((current) => (current === dateKey ? '' : dateKey));
    }, [approvalId]);

    const weekLayouts = useMemo(
        () =>
            weeks.map((weekDays) => ({
                weekDays,
                approvedLayout: buildWeekBarLayout(weekDays, displayApprovedSpans, MAX_VISIBLE_LANES),
                draftLayout: buildWeekBarLayout(weekDays, draftSpans, 1),
            })),
        [displayApprovedSpans, draftSpans, weeks],
    );

    const processingStartDate = processingStartForEmployee(
        salaryVisibility,
        employeeId,
        employeeId,
    );
    const viewedMonth = format(monthDate, 'yyyy-MM');
    const todayMonth = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
        .format(new Date())
        .slice(0, 7);
    const liveOpen =
        !processingStartDate || isSalaryProcessingMonthOpen(todayMonth, processingStartDate);
    const monthOpen =
        !processingStartDate || isSalaryProcessingMonthOpen(viewedMonth, processingStartDate);
    const salaryLocked = Boolean(employeeId && processingStartDate && (!liveOpen || !monthOpen));

    return (
        <div
            className={`relative overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm ${
                fillViewport ? 'flex min-h-0 flex-1 flex-col' : ''
            }`}
        >
                <div className="flex shrink-0 flex-col gap-4 border-b border-[#E5E7EB] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <h2 className="text-[15px] font-semibold text-[#111827]">Leave Calendar</h2>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                        <div className="flex items-center justify-center gap-3 text-sm font-medium text-[#374151]">
                            <button
                                type="button"
                                onClick={() => {
                                    setExpandedDateKey('');
                                    setMonthDate((value) => {
                                        const next = subMonths(value, 1);
                                        const nextYear = next.getFullYear();
                                        if (nextYear < calendarMinYear || nextYear > calendarMaxYear) {
                                            return value;
                                        }
                                        if (!isAllYear && nextYear !== selectedYear) {
                                            onYearChange?.(nextYear);
                                        }
                                        return next;
                                    });
                                }}
                                className="rounded p-0.5 text-[#6B7280] hover:bg-[#F3F4F6]"
                                aria-label="Previous month"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span>{format(monthDate, 'MMMM yyyy')}</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setExpandedDateKey('');
                                    setMonthDate((value) => {
                                        const next = addMonths(value, 1);
                                        const nextYear = next.getFullYear();
                                        if (nextYear < calendarMinYear || nextYear > calendarMaxYear) {
                                            return value;
                                        }
                                        if (!isAllYear && nextYear !== selectedYear) {
                                            onYearChange?.(nextYear);
                                        }
                                        return next;
                                    });
                                }}
                                className="rounded p-0.5 text-[#6B7280] hover:bg-[#F3F4F6]"
                                aria-label="Next month"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            {LEAVE_LEGEND.map((item) => (
                                <span
                                    key={item.label}
                                    className="inline-flex items-center gap-1.5 text-[11px] text-[#6B7280]"
                                >
                                    <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ backgroundColor: item.bg }}
                                    />
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className="px-5 pt-4">
                        <ErpErrorBanner message={error} onRetry={fetchCalendar} />
                    </div>
                ) : null}

                <div className={fillViewport ? 'flex min-h-0 flex-1 flex-col overflow-x-auto' : 'overflow-x-auto'}>
                    <div className={fillViewport ? 'flex min-h-0 min-w-[820px] flex-1 flex-col' : 'min-w-[820px]'}>
                        <div className="grid shrink-0 grid-cols-7 border-b border-[#E5E7EB] bg-[#FAFAFA]">
                            {WEEKDAYS.map((day) => (
                                <div
                                    key={day}
                                    className="px-2 py-2.5 text-center text-[11px] font-semibold tracking-wide text-[#9CA3AF]"
                                >
                                    {day}
                                </div>
                            ))}
                        </div>

                        {loading ? (
                            <div className="flex flex-1 items-center justify-center px-4 py-12 text-center text-sm text-[#6B7280]">
                                Loading leave calendar...
                            </div>
                        ) : (
                            <div
                                ref={gridRef}
                                className={`${dragEdge ? 'cursor-ew-resize' : ''} ${
                                    fillViewport ? 'flex min-h-0 flex-1 flex-col' : ''
                                }`}
                            >
                                {weekLayouts.map(({ weekDays, approvedLayout, draftLayout }) => (
                                    <LeaveWeekRow
                                        key={formatDateKey(weekDays[0])}
                                        weekDays={weekDays}
                                        monthDate={monthDate}
                                        approvedLayout={approvedLayout}
                                        draftLayout={draftLayout}
                                        countsByDate={countsByDate}
                                        leavesByDate={leavesByDate}
                                        selectedDateKey={selectedDateKey}
                                        expandedDateKey={expandedDateKey}
                                        onSelectDate={setSelectedDateKey}
                                        onToggleExpandDay={handleToggleExpandDay}
                                        onDraftResizeStart={handleDraftResizeStart}
                                        onPendingDragStart={handlePendingDragStart}
                                        onLeaveBarClick={onLeaveBarClick}
                                        onLeaveBarDoubleClick={onLeaveBarDoubleClick}
                                        isDraggingDraft={Boolean(dragEdge || pendingDrag?.active)}
                                        focusFrom={from}
                                        focusTo={to}
                                        focusApprovalId={approvalId}
                                        focusEmployeeId={employeeId}
                                        stretchWeeks={fillViewport}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="shrink-0 border-t border-[#E5E7EB] px-5 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-[#6B7280]">
                            {isValidDateKey(draftFrom) && isValidDateKey(draftTo)
                                ? (() => {
                                      const dayCount =
                                          Math.round(
                                              (parseISO(draftTo).getTime() - parseISO(draftFrom).getTime()) /
                                                  (24 * 60 * 60 * 1000),
                                          ) + 1;
                                      return dayCount < 5
                                          ? `${dayCount} day${dayCount === 1 ? '' : 's'} (incl. holidays) → Authorize Leave`
                                          : `${dayCount} days (incl. holidays) → Annual Leave`;
                                  })()
                                : 'Use Apply Leave to select an employee and date range. The grey bar will show on this calendar.'}
                        </p>
                        <button
                            type="button"
                            onClick={() => onConfirm?.()}
                            disabled={
                                confirming ||
                                salaryLocked ||
                                (Boolean(employeeId) &&
                                    (!isValidDateKey(draftFrom) || !isValidDateKey(draftTo)))
                            }
                            className="rounded-md bg-[#14B8A6] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0D9488] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {confirming
                                ? 'Saving...'
                                : !hideDraft && isValidDateKey(draftFrom) && isValidDateKey(draftTo)
                                  ? 'Confirm'
                                  : 'Apply Leave'}
                        </button>
                    </div>
                </div>
            </div>
    );
}
