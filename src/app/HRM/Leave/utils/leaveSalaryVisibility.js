'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;

function isDateKey(value) {
    return ISO_DATE.test(String(value || '').trim());
}

function processingStartFromEnrollment(row) {
    const salaryDate = String(row?.salaryDate || row?.processDate || '').trim();
    if (ISO_DATE.test(salaryDate)) return salaryDate;
    const fromMonth = String(row?.fromMonth || '').trim();
    if (!YEAR_MONTH.test(fromMonth)) return '';
    const dayNum = Number(salaryDate);
    const day = Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= 28 ? dayNum : 1;
    return `${fromMonth}-${String(day).padStart(2, '0')}`;
}

export const ALL_LEAVE_YEAR = 'all';
export const ALL_LEAVE_MONTH = 'all';

export function isAllLeaveYear(year) {
    return String(year || '').trim().toLowerCase() === ALL_LEAVE_YEAR;
}

export function isAllLeaveMonth(month) {
    return String(month || '').trim().toLowerCase() === ALL_LEAVE_MONTH;
}

export function currentLeaveMonthKey(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
    })
        .format(now)
        .slice(0, 7);
}

function shiftMonthKey(monthKey, delta) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    if (!year || !month) return monthKey;
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function leaveDashboardMonthOptions(visibility, now = new Date()) {
    const current = currentLeaveMonthKey(now);
    const startRaw = String(visibility?.earliestProcessingStartDate || '').slice(0, 7);
    const start = YEAR_MONTH.test(startRaw) && startRaw <= current ? startRaw : current;
    const months = [];
    for (let cursor = current; cursor >= start; cursor = shiftMonthKey(cursor, -1)) {
        months.push(cursor);
        if (months.length > 240) break;
    }
    return months;
}

export function formatLeaveMonthLabel(monthKey) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    if (!year || !month) return String(monthKey || '');
    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function leaveMonthBounds(monthKey) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    if (!year || month < 1 || month > 12) return null;
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mm = String(month).padStart(2, '0');
    return {
        from: `${year}-${mm}-01`,
        to: `${year}-${mm}-${String(last).padStart(2, '0')}`,
    };
}

export function leaveRangeOverlapsMonth(startKey, endKey, monthKey) {
    const bounds = leaveMonthBounds(monthKey);
    if (!bounds) return true;
    const start = String(startKey || endKey || '').trim();
    const end = String(endKey || startKey || '').trim();
    if (!start) return false;
    return start <= bounds.to && end >= bounds.from;
}

export function emptyLeaveSalaryVisibility() {
    return {
        ready: false,
        byMongoId: new Map(),
        byEmployeeId: new Map(),
        earliestProcessingStartDate: '',
    };
}

function earliestStartFromMaps(byMongoId, byEmployeeId) {
    let earliest = '';
    for (const start of byMongoId.values()) {
        if (!earliest || start < earliest) earliest = start;
    }
    for (const start of byEmployeeId.values()) {
        if (!earliest || start < earliest) earliest = start;
    }
    return earliest;
}

export function indexLeaveSalaryVisibility(items) {
    const byMongoId = new Map();
    const byEmployeeId = new Map();
    for (const row of items || []) {
        const start = String(row?.processingStartDate || '').trim();
        if (!isDateKey(start)) continue;
        const mongoId = String(row?.employeeMongoId || row?._id || '').trim();
        const code = String(row?.employeeId || '').trim();
        if (mongoId) byMongoId.set(mongoId, start);
        if (code) byEmployeeId.set(code, start);
    }
    return {
        ready: true,
        byMongoId,
        byEmployeeId,
        earliestProcessingStartDate: earliestStartFromMaps(byMongoId, byEmployeeId),
    };
}

export function processingStartForEmployee(visibility, mongoId, employeeId) {
    const start =
        visibility?.byMongoId?.get(String(mongoId || '')) ||
        visibility?.byEmployeeId?.get(String(employeeId || '').trim()) ||
        '';
    return isDateKey(start) ? start : '';
}

export function firstOfSalaryProcessingMonth(value) {
    const raw = String(value || '').trim();
    if (ISO_DATE.test(raw) || YEAR_MONTH.test(raw)) return `${raw.slice(0, 7)}-01`;
    return '';
}

export function formatSalaryProcessingLabel(value) {
    const start = firstOfSalaryProcessingMonth(value);
    const raw = start || String(value || '').trim();
    if (ISO_DATE.test(raw)) {
        const [year, month, day] = raw.split('-').map(Number);
        return new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(new Date(Date.UTC(year, month - 1, day)));
    }
    if (!YEAR_MONTH.test(raw)) return '';
    const [year, month] = raw.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function salaryUnlocksAfterMessage(value) {
    const label = formatSalaryProcessingLabel(value);
    return label ? `Your attendance will start on ${label}` : '';
}

export function isSalaryProcessingMonthOpen(compareMonth, processingStart) {
    const current = String(compareMonth || '').trim().slice(0, 7);
    const start = String(processingStart || '').trim().slice(0, 7);
    if (!YEAR_MONTH.test(start)) return true;
    if (!YEAR_MONTH.test(current)) return false;
    return current >= start;
}

export function leaveDashboardYearOptions(visibility, now = new Date()) {
    const current = now.getFullYear();
    const startRaw = Number(String(visibility?.earliestProcessingStartDate || '').slice(0, 4));
    const start =
        Number.isInteger(startRaw) && startRaw >= 2000 && startRaw <= current ? startRaw : current;
    const years = [];
    for (let year = current; year >= start; year -= 1) years.push(year);
    return years;
}

export function indexEnrollOptionsVisibility(employees) {
    const items = (employees || [])
        .filter((row) => row?.enrolled)
        .map((row) => ({
            employeeId: row.employeeId,
            processingStartDate: processingStartFromEnrollment(row),
        }));
    return indexLeaveSalaryVisibility(items);
}

export function isHistoricalLeaveEntry(entry) {
    if (!entry) return false;
    if (entry.historical === true || entry.countOnly === true) return true;
    if (String(entry.leaveRequestKind || '').trim() === 'historical') return true;
    return String(entry.source || '').trim().toLowerCase() === 'salary enrollment';
}

export function isLeaveEntrySalaryVisible(entry, visibility) {
    if (isHistoricalLeaveEntry(entry)) return true;
    if (!visibility?.ready) return true;
    const mongoId = String(entry?.employeeMongoId || '').trim();
    const code = String(entry?.employeeId || '').trim();
    const start =
        (mongoId && visibility.byMongoId.get(mongoId)) ||
        (code && visibility.byEmployeeId.get(code));
    if (!start) return false;
    const dateKey = String(entry?.date || entry?.startDateKey || '').trim();
    if (!isDateKey(dateKey)) return true;
    return dateKey >= start;
}

export function isLeaveRangeSalaryVisible(entry, visibility) {
    if (isHistoricalLeaveEntry(entry)) return true;
    if (!visibility?.ready) return true;
    const mongoId = String(entry?.employeeMongoId || '').trim();
    const code = String(entry?.employeeId || '').trim();
    const start =
        (mongoId && visibility.byMongoId.get(mongoId)) ||
        (code && visibility.byEmployeeId.get(code));
    if (!start) return false;
    const fromKey = String(entry?.startDateKey || entry?.date || '').trim();
    const toKey = String(entry?.endDateKey || fromKey).trim();
    if (!isDateKey(fromKey)) return true;
    const end = isDateKey(toKey) ? toKey : fromKey;
    return end >= start;
}

export function filterLeaveEntriesBySalary(entries, visibility) {
    if (!visibility?.ready) return entries || [];
    return (entries || []).filter((entry) => isLeaveEntrySalaryVisible(entry, visibility));
}

export function useLeaveSalaryVisibility() {
    const [visibility, setVisibility] = useState(emptyLeaveSalaryVisibility);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const response = await axiosInstance.get('/Leave/salary-visibility', {
                    skipToast: true,
                });
                if (cancelled) return;
                const items = Array.isArray(response.data?.items) ? response.data.items : [];
                setVisibility(indexLeaveSalaryVisibility(items));
                return;
            } catch {
                /* fall through to salary enroll options */
            }

            try {
                const response = await axiosInstance.get('/Employee/salary-enroll/options', {
                    skipToast: true,
                });
                if (cancelled) return;
                setVisibility(indexEnrollOptionsVisibility(response.data?.employees));
            } catch {
                if (!cancelled) setVisibility(emptyLeaveSalaryVisibility());
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    return useMemo(() => visibility, [visibility]);
}
