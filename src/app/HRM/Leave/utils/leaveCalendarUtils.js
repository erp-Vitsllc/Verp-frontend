export const LEAVE_STATUS_META = {
    sick_leave: { label: 'Sick Leave', short: 'SL', color: '#B45309', bg: '#FFD966', text: '#7C4A03' },
    authorized_leave: { label: 'Authorize Leave', short: 'Auth', color: '#0F766E', bg: '#5EEAD4', text: '#115E59' },
    unauthorized_leave: { label: 'Unauthorized Leave', short: 'Unauth', color: '#BE123C', bg: '#FDA4AF', text: '#9F1239' },
    compoff_leave: { label: 'Comp Off Leave', short: 'CO', color: '#6D28D9', bg: '#C4B5FD', text: '#4C1D95' },
    on_leave: { label: 'Annual Leave', short: 'AL', color: '#1D4ED8', bg: '#93C5FD', text: '#1E3A8A' },
    holiday: { label: 'Holiday', short: 'H', color: '#DB2777', bg: '#F9A8D4', text: '#9D174D' },
};

export const SELECTED_DRAFT_META = {
    label: 'Pending Leave',
    short: 'Pend',
    color: '#9CA3AF',
    bg: '#ECEFF3',
    text: '#6B7280',
};

export const FOCUSED_LEAVE_META = {
    label: 'Selected Leave',
    short: 'Sel',
    color: '#1D4ED8',
    bg: '#3B82F6',
    text: '#FFFFFF',
};

export const LEAVE_LEGEND = [
    LEAVE_STATUS_META.sick_leave,
    LEAVE_STATUS_META.authorized_leave,
    LEAVE_STATUS_META.unauthorized_leave,
    LEAVE_STATUS_META.compoff_leave,
    LEAVE_STATUS_META.on_leave,
    SELECTED_DRAFT_META,
    FOCUSED_LEAVE_META,
];

export function leaveMetaForStatus(
    statusKey,
    isDraft = false,
    isPending = false,
    isFocused = false,
) {
    if (isFocused) return FOCUSED_LEAVE_META;
    if (isDraft || isPending || statusKey === 'draft_selection') return SELECTED_DRAFT_META;
    return LEAVE_STATUS_META[statusKey] || {
        label: statusKey || 'Leave',
        short: 'LV',
        color: '#64748B',
        bg: '#E2E8F0',
        text: '#334155',
    };
}

export function buildSelectedDraftSpan({ employeeId, employeeName, from, to }) {
    if (!employeeId || !isValidDateKey(from) || !isValidDateKey(to) || to < from) {
        return null;
    }

    return {
        id: `draft-${employeeId}-${from}`,
        employeeMongoId: String(employeeId),
        employeeId: '',
        employeeName: employeeName || 'Selected Employee',
        statusKey: 'draft_selection',
        start: from,
        end: to,
        isDraft: true,
    };
}

export function firstNameFromDisplay(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return 'Employee';
    return trimmed.split(/\s+/)[0];
}

export function isValidDateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

export function nextDateKey(dateKey) {
    return addDaysToDateKey(dateKey, 1);
}

export function addDaysToDateKey(dateKey, deltaDays) {
    if (!isValidDateKey(dateKey)) return '';
    const [year, month, day] = String(dateKey).split('-').map(Number);
    return formatDateKey(new Date(year, month - 1, day + Number(deltaDays || 0)));
}

export function daysBetweenKeys(from, to) {
    if (!isValidDateKey(from) || !isValidDateKey(to)) return 0;
    const start = parseDateKey(from);
    const end = parseDateKey(to);
    return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function parseDateKey(dateKey) {
    const [year, month, day] = String(dateKey).split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function leaveTypeFromStatusKey(statusKey) {
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

export function compareDateKeys(a, b) {
    return String(a).localeCompare(String(b));
}

export function isDateInRange(dateKey, from, to) {
    return isValidDateKey(dateKey) && isValidDateKey(from) && isValidDateKey(to) && dateKey >= from && dateKey <= to;
}

/** Merge consecutive leave days into spans per employee + leave type. */
export function buildLeaveSpans(entries) {
    const grouped = new Map();

    for (const entry of entries || []) {
        const dateKey = String(entry.date || '').trim();
        if (!isValidDateKey(dateKey)) continue;

        const pendingGroup = String(
            entry.leaveRequestGroupId || entry.attendanceId || entry.id || '',
        ).trim();
        const groupKey = `${entry.employeeMongoId || entry.employeeId}::${entry.statusKey}::${
            entry.isPending ? `pending:${pendingGroup}` : 'approved'
        }`;
        if (!grouped.has(groupKey)) {
            grouped.set(groupKey, {
                employeeMongoId: entry.employeeMongoId,
                employeeId: entry.employeeId,
                employeeName: entry.employeeName,
                statusKey: entry.statusKey,
                isPending: Boolean(entry.isPending),
                attendanceId: String(entry.attendanceId || (entry.isPending ? entry.id : '') || ''),
                attendanceIds: [],
                leaveRequestGroupId: String(entry.leaveRequestGroupId || ''),
                rangeStart: isValidDateKey(entry.rangeStart) ? entry.rangeStart : dateKey,
                rangeEnd: isValidDateKey(entry.rangeEnd) ? entry.rangeEnd : dateKey,
                dates: new Set(),
            });
        }
        const group = grouped.get(groupKey);
        group.dates.add(dateKey);
        const entryAttendanceId = String(entry.attendanceId || entry.id || '');
        if (entryAttendanceId && !group.attendanceIds.includes(entryAttendanceId)) {
            group.attendanceIds.push(entryAttendanceId);
        }
        if (!group.attendanceId && entryAttendanceId) {
            group.attendanceId = entryAttendanceId;
        }
        if (isValidDateKey(entry.rangeStart) && entry.rangeStart < group.rangeStart) {
            group.rangeStart = entry.rangeStart;
        }
        if (isValidDateKey(entry.rangeEnd) && entry.rangeEnd > group.rangeEnd) {
            group.rangeEnd = entry.rangeEnd;
        }
    }

    const spans = [];

    for (const group of grouped.values()) {
        if (
            group.isPending &&
            isValidDateKey(group.rangeStart) &&
            isValidDateKey(group.rangeEnd)
        ) {
            spans.push({
                id: `${group.employeeMongoId}-${group.statusKey}-p-${group.attendanceId || group.rangeStart}`,
                employeeMongoId: group.employeeMongoId,
                employeeId: group.employeeId,
                employeeName: group.employeeName,
                statusKey: group.statusKey,
                isPending: true,
                attendanceId: group.attendanceId || '',
                attendanceIds: [...(group.attendanceIds || [])],
                leaveRequestGroupId: group.leaveRequestGroupId || '',
                start: group.rangeStart,
                end: group.rangeEnd,
            });
            continue;
        }

        const sortedDates = Array.from(group.dates).sort(compareDateKeys);
        if (!sortedDates.length) continue;

        let rangeStart = sortedDates[0];
        let previous = sortedDates[0];

        for (let index = 1; index < sortedDates.length; index += 1) {
            const current = sortedDates[index];
            if (current !== nextDateKey(previous)) {
                spans.push({
                    id: `${group.employeeMongoId}-${group.statusKey}-${group.isPending ? 'p' : 'a'}-${rangeStart}`,
                    employeeMongoId: group.employeeMongoId,
                    employeeId: group.employeeId,
                    employeeName: group.employeeName,
                    statusKey: group.statusKey,
                    isPending: Boolean(group.isPending),
                    attendanceId: group.attendanceId || '',
                    attendanceIds: [...(group.attendanceIds || [])],
                    leaveRequestGroupId: group.leaveRequestGroupId || '',
                    start: rangeStart,
                    end: previous,
                });
                rangeStart = current;
            }
            previous = current;
        }

        spans.push({
            id: `${group.employeeMongoId}-${group.statusKey}-${group.isPending ? 'p' : 'a'}-${rangeStart}`,
            employeeMongoId: group.employeeMongoId,
            employeeId: group.employeeId,
            employeeName: group.employeeName,
            statusKey: group.statusKey,
            isPending: Boolean(group.isPending),
            attendanceId: group.attendanceId || '',
            attendanceIds: [...(group.attendanceIds || [])],
            leaveRequestGroupId: group.leaveRequestGroupId || '',
            start: rangeStart,
            end: previous,
        });
    }

    return spans.sort((a, b) => compareDateKeys(a.start, b.start) || String(a.employeeName).localeCompare(String(b.employeeName)));
}

export function chunkWeeks(days) {
    const weeks = [];
    for (let index = 0; index < days.length; index += 7) {
        weeks.push(days.slice(index, index + 7));
    }
    return weeks;
}

export function countLeavesByDate(entries, draftSpan = null) {
    const employeesByDate = new Map();

    for (const entry of entries || []) {
        const dateKey = String(entry.date || '').trim();
        if (!isValidDateKey(dateKey)) continue;

        if (!employeesByDate.has(dateKey)) employeesByDate.set(dateKey, new Set());
        employeesByDate.get(dateKey).add(String(entry.employeeMongoId || entry.employeeId || entry.id));
    }

    if (draftSpan?.start && draftSpan?.end) {
        for (let cursor = draftSpan.start; cursor <= draftSpan.end; cursor = nextDateKey(cursor)) {
            if (!employeesByDate.has(cursor)) employeesByDate.set(cursor, new Set());
            employeesByDate.get(cursor).add(`draft-${draftSpan.employeeMongoId}`);
        }
    }

    const counts = new Map();
    for (const [dateKey, set] of employeesByDate.entries()) {
        counts.set(dateKey, set.size);
    }
    return counts;
}

function intersectsWeek(span, weekStartKey, weekEndKey) {
    return span.end >= weekStartKey && span.start <= weekEndKey;
}

/** Split spans into week segments and assign vertical lanes to avoid overlap. */
export function buildWeekBarLayout(weekDays, spans, maxVisibleLanes = 3) {
    if (!weekDays?.length) {
        return { segments: [], allSegments: [], lanesUsed: 0, hiddenCount: 0, totalCount: 0 };
    }

    const weekStartKey = formatDateKey(weekDays[0]);
    const weekEndKey = formatDateKey(weekDays[weekDays.length - 1]);
    const dateIndex = new Map(weekDays.map((day, index) => [formatDateKey(day), index]));

    const rawSegments = [];

    for (const span of spans) {
        if (!intersectsWeek(span, weekStartKey, weekEndKey)) continue;

        const segStart = compareDateKeys(span.start, weekStartKey) < 0 ? weekStartKey : span.start;
        const segEnd = compareDateKeys(span.end, weekEndKey) > 0 ? weekEndKey : span.end;
        const startIdx = dateIndex.get(segStart);
        const endIdx = dateIndex.get(segEnd);
        if (startIdx == null || endIdx == null) continue;

        rawSegments.push({
            ...span,
            segStart,
            segEnd,
            startIdx,
            endIdx,
            spanStartsHere: segStart === span.start,
            spanEndsHere: segEnd === span.end,
        });
    }

    rawSegments.sort(
        (a, b) =>
            a.startIdx - b.startIdx ||
            Number(Boolean(b.isFocused)) - Number(Boolean(a.isFocused)) ||
            a.endIdx - b.endIdx,
    );

    const laneEnds = [];
    const placed = [];

    for (const segment of rawSegments) {
        let lane = 0;
        while (laneEnds[lane] != null && laneEnds[lane] >= segment.startIdx) {
            lane += 1;
        }
        laneEnds[lane] = segment.endIdx;
        placed.push({ ...segment, lane });
    }

    const visible = placed.filter((segment) => segment.lane < maxVisibleLanes);
    const hiddenCount = Math.max(0, placed.length - visible.length);

    return {
        segments: visible,
        allSegments: placed,
        lanesUsed: Math.min(maxVisibleLanes, Math.max(0, ...placed.map((segment) => segment.lane + 1), 0)),
        hiddenCount,
        totalCount: placed.length,
    };
}

export function formatDateKey(day) {
    const year = day.getFullYear();
    const month = String(day.getMonth() + 1).padStart(2, '0');
    const date = String(day.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
}

export function countDaySegments(segments, dayIndex) {
    return segments.filter(
        (segment) => segment.startIdx <= dayIndex && segment.endIdx >= dayIndex,
    ).length;
}
