'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    format,
    getDay,
    startOfMonth,
} from 'date-fns';
import {
    AlertTriangle,
    Briefcase,
    CalendarDays,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    Fingerprint,
    Gift,
    MapPin,
    Plane,
    Stethoscope,
    UserRound,
    XCircle,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { holidayAppliesToStaff } from '@/utils/holidayScope';
import { getEmployeeInitials } from '@/utils/employeeProfileImage';
import { normalizeWorkLocationKey, workLocationLabel } from '@/utils/workLocations';
import DashboardSalaryEnrollLock, {
    EMPTY_SALARY_LOCK,
    salaryLockFromAttendancePayload,
} from '@/app/dashboard/components/DashboardSalaryEnrollLock';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DAY_STYLE = {
    present: 'bg-[#4ADE80] text-[#14532D]',
    attention: 'bg-[#FACC15] text-[#713F12]',
    absent: 'bg-[#F87171] text-white',
    sick: 'bg-[#86EFAC] text-[#14532D]',
    authorized: 'bg-[#60A5FA] text-white',
    annual: 'bg-[#A78BFA] text-white',
    compoff: 'bg-[#5EEAD4] text-[#134E4A]',
    holiday: 'bg-[#FDBA74] text-[#7C2D12]',
    weekend: 'bg-[#EEF2F6] text-[#94A3B8]',
    empty: 'bg-white text-[#64748B] border border-[#E6EAF0]',
    future: 'bg-[#F8FAFC] text-[#94A3B8] border border-[#E6EAF0]',
};

const LEGEND = [
    { key: 'present', label: 'Present', swatch: 'bg-[#4ADE80]' },
    { key: 'attention', label: 'Late / missed punch', swatch: 'bg-[#FACC15]' },
    { key: 'absent', label: 'Unauthorized / absent', swatch: 'bg-[#F87171]' },
    { key: 'sick', label: 'Sick leave', swatch: 'bg-[#86EFAC]' },
    { key: 'authorized', label: 'Authorized leave', swatch: 'bg-[#60A5FA]' },
    { key: 'annual', label: 'Annual leave', swatch: 'bg-[#A78BFA]' },
    { key: 'compoff', label: 'Comp off', swatch: 'bg-[#5EEAD4]' },
    { key: 'holiday', label: 'Holiday', swatch: 'bg-[#FDBA74]' },
    { key: 'weekend', label: 'Weekly off', swatch: 'bg-[#CBD5E1]' },
];

function n(value) {
    return Number(value) || 0;
}

function dubaiTodayKey() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function shiftDateKey(dateKey, days) {
    const raw = String(dateKey || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
    const [year, month, day] = raw.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function inclusiveDays(from, to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return 0;
    const a = Date.parse(`${from}T00:00:00Z`);
    const b = Date.parse(`${to}T00:00:00Z`);
    return Math.round((b - a) / 86400000) + 1;
}

function monthEndKey(monthKey) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    if (!year || !month) return '';
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${monthKey}-${String(last).padStart(2, '0')}`;
}

function formatDayLabel(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return '—';
    const [year, month, day] = dateKey.split('-').map(Number);
    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];
    return `${String(day).padStart(2, '0')}-${monthName}-${year}`;
}

function formatMonthLabel(monthKey) {
    if (!/^\d{4}-\d{2}$/.test(String(monthKey || ''))) return '—';
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

function formatAed(value, digits = 0) {
    const amount = Number(value) || 0;
    return `AED ${amount.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}`;
}

function formatAedNumber(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clockToMinutes(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

function formatClock12(value) {
    const minutes = clockToMinutes(value);
    if (minutes == null) return '—';
    const hour24 = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour = hour24 % 12 || 12;
    return `${hour}:${String(mins).padStart(2, '0')} ${suffix}`;
}

function formatDuration(minutes) {
    if (minutes == null || minutes < 0) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

function workedMinutes(timeIn, timeOut) {
    const start = clockToMinutes(timeIn);
    const end = clockToMinutes(timeOut);
    if (start == null || end == null) return null;
    let diff = end - start;
    if (diff <= 0) diff += 24 * 60;
    return diff;
}

function dubaiNowMinutes() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dubai',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
}

function locationOf(record) {
    const spot = record?.checkInLocation?.label
        ? record.checkInLocation
        : record?.checkOutLocation?.label
          ? record.checkOutLocation
          : record?.checkInLocation?.latitude != null
            ? record.checkInLocation
            : record?.checkOutLocation;
    const label = String(spot?.label || '').trim();
    const latitude = Number(spot?.latitude);
    const longitude = Number(spot?.longitude);
    const hasMap = Number.isFinite(latitude) && Number.isFinite(longitude);
    return {
        label: label || (hasMap ? 'Pinned location' : '—'),
        mapHref: hasMap ? `https://www.google.com/maps?q=${latitude},${longitude}` : '',
    };
}

function monthChoices(joinKey, todayKey) {
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(joinKey || ''))
        ? String(joinKey).slice(0, 7)
        : `${Number(todayKey.slice(0, 4)) - 5}-01`;
    const end = todayKey.slice(0, 7);
    const choices = [];
    let cursor = start > end ? end : start;
    while (cursor <= end && choices.length < 360) {
        choices.push(cursor);
        const [year, month] = cursor.split('-').map(Number);
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonth = month === 12 ? 1 : month + 1;
        cursor = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    }
    return choices.reverse();
}

function countEndForMonth(monthKey, todayKey) {
    const end = monthEndKey(monthKey);
    if (!end) return '';
    if (monthKey < todayKey.slice(0, 7)) return end;
    if (monthKey > todayKey.slice(0, 7)) return '';
    const yesterday = shiftDateKey(todayKey, -1);
    if (!yesterday || yesterday < `${monthKey}-01`) return '';
    return yesterday < end ? yesterday : end;
}

function bucketOf(stats, key) {
    return stats?.[key] || {};
}

function profilePeriodStats(profile) {
    const counts = profile?.summary?.counts || {};
    const card = profile?.summary?.yearCard || {};
    const stats = profile?.summary?.requestStats || {};
    const usedOf = (key) => (card?.used?.[key] != null ? n(card.used[key]) : n(counts[key]));
    const requestedOf = (key) => n(bucketOf(stats, key).request) + n(bucketOf(stats, key).approved);
    const approvedOf = (key) => n(bucketOf(stats, key).approved);
    const leave = (key) => ({
        requested: requestedOf(key),
        approved: approvedOf(key),
        used: usedOf(key),
    });
    return {
        annual: leave('on_leave'),
        sick: leave('sick_leave'),
        authorized: leave('authorized_leave'),
        unauthorized: leave('unauthorized_leave'),
        compoffUsed: usedOf('compoff_leave'),
        compoffPending: n(card?.pending?.compoff_leave) || n(bucketOf(stats, 'compoff_leave').request),
        lateIn: n(counts.late_arrived) || (n(counts.early_go) ? 0 : n(card?.used?.late_early)),
        earlyOut: n(counts.early_go),
        missed: n(counts.mispunch) || n(card?.used?.mispunch),
        present: n(card?.office) || n(profile?.summary?.enrollAttendance?.office) || n(profile?.summary?.presentDays),
        wfh: n(card?.wfh) || n(profile?.summary?.enrollAttendance?.wfh),
        absent: null,
    };
}

function addPeriodStats(total, next) {
    const sumLeave = (key) => ({
        requested: n(total[key]?.requested) + n(next[key]?.requested),
        approved: n(total[key]?.approved) + n(next[key]?.approved),
        used: n(total[key]?.used) + n(next[key]?.used),
    });
    return {
        annual: sumLeave('annual'),
        sick: sumLeave('sick'),
        authorized: sumLeave('authorized'),
        unauthorized: sumLeave('unauthorized'),
        compoffUsed: n(total.compoffUsed) + n(next.compoffUsed),
        compoffPending: n(total.compoffPending) + n(next.compoffPending),
        lateIn: n(total.lateIn) + n(next.lateIn),
        earlyOut: n(total.earlyOut) + n(next.earlyOut),
        missed: n(total.missed) + n(next.missed),
        present: n(total.present) + n(next.present),
        wfh: n(total.wfh) + n(next.wfh),
        absent: null,
    };
}

function leaveTallies(records, key) {
    const groups = new Map();
    let used = 0;
    for (const row of records) {
        const status = String(row?.statusKey || '');
        const requested = String(row?.requestedStatusKey || '');
        const decision = String(row?.leaveRequestStatus || '');
        if (status === key) used += 1;
        const isRequest = decision && (requested === key || status === key);
        const isDirect = !decision && status === key;
        if (!isRequest && !isDirect) continue;
        const id = String(row?.leaveRequestGroupId || `${row?.date || ''}-${key}`);
        const prev = groups.get(id) || { status: isDirect ? 'direct' : decision };
        if (decision === 'pending') prev.status = 'pending';
        else if (prev.status !== 'pending') prev.status = isDirect ? 'direct' : decision || prev.status;
        groups.set(id, prev);
    }
    let requested = 0;
    let approved = 0;
    for (const group of groups.values()) {
        if (group.status === 'rejected') continue;
        requested += 1;
        if (group.status === 'approved' || group.status === 'direct') approved += 1;
    }
    return { requested, approved, used };
}

function recordsInWindow(records, from, to) {
    if (!from || !to) return [];
    return (records || []).filter((row) => {
        const date = String(row?.date || '');
        return date >= from && date <= to;
    });
}

function dayKind(record, { isFuture, isToday, isHoliday, isWeeklyOff }) {
    const key = String(record?.statusKey || '');
    if (key === 'on_office' || key === 'work_from_home') return 'present';
    if (key === 'late_arrived' || key === 'early_go' || key === 'mispunch') return 'attention';
    if (key === 'unauthorized_leave' || key === 'not_marked') return 'absent';
    if (key === 'sick_leave') return 'sick';
    if (key === 'authorized_leave') return 'authorized';
    if (key === 'on_leave') return 'annual';
    if (key === 'compoff_leave') return 'compoff';
    if (key === 'holiday' || isHoliday) return 'holiday';
    if (key === 'weekly_off' || isWeeklyOff) return 'weekend';
    if (isFuture || isToday) return 'future';
    if (!record) return 'absent';
    return 'empty';
}

function kindLabel(kind) {
    return LEGEND.find((item) => item.key === kind)?.label || 'No mark';
}

function eventRowsFromRecords(records, key) {
    return (records || [])
        .filter((row) => String(row?.statusKey || '') === key)
        .map((row) => ({
            id: String(row._id || `${row.date}-${key}`),
            date: row.date,
            statusKey: row.statusKey,
            statusLabel: row.statusLabel || kindLabel(dayKind(row, {})),
            reason: String(row.reason || row.leaveRequestReason || '').trim(),
            attachmentName: String(row.attachmentName || '').trim(),
            leavePayType: String(row.leavePayType || '').trim(),
        }));
}

function Panel({ title, aside, children }) {
    return (
        <section className="relative rounded-2xl border border-[#E6EDF5] bg-white p-3">
            {title ? (
                <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-[13px] font-bold text-[#1B2A4A]">{title}</h2>
                    {aside ? <div className="shrink-0 text-[12px] font-medium text-[#94A3B8]">{aside}</div> : null}
                </div>
            ) : null}
            {children}
        </section>
    );
}

function Metric({ label, value }) {
    return (
        <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
            <p className="mt-0.5 text-[15px] font-bold leading-none tabular-nums text-[#1B2A4A]">{value}</p>
        </div>
    );
}

function SummaryTile({ icon: Icon, iconClass, title, onClick, children }) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className="rounded-xl border border-[#E7EEF6] bg-white px-2.5 py-2 text-left"
        >
            <div className="flex items-center gap-1.5">
                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${iconClass}`}>
                    <Icon size={13} />
                </span>
                <span className="truncate text-[12px] font-semibold text-[#1B2A4A]">{title}</span>
            </div>
            <div className="mt-1.5">{children}</div>
        </Tag>
    );
}

export default function EmployeeInformationDashboard({
    employeeMongoId,
    profile,
    eligibility,
    annualCalendarHref,
    onYearChange,
    onOpenAnnual,
    onOpenCategory,
    onOpenFinancial,
    onDownload,
    onOpenPayroll,
    onOpenSalary,
    onOpenLeaveList,
}) {
    const todayKey = dubaiTodayKey();
    const currentMonth = todayKey.slice(0, 7);
    const employee = profile?.employee || {};
    const joinKey = String(employee.dateOfJoining || '').trim();
    const [period, setPeriod] = useState('month');
    const [monthKey, setMonthKey] = useState(currentMonth);
    const [recordsByDate, setRecordsByDate] = useState({});
    const [monthRecords, setMonthRecords] = useState([]);
    const [offWeekdays, setOffWeekdays] = useState(() => new Set(['saturday', 'sunday']));
    const [staffType, setStaffType] = useState('office');
    const [holidayRows, setHolidayRows] = useState([]);
    const [monthLoading, setMonthLoading] = useState(true);
    const [monthError, setMonthError] = useState('');
    const [salaryLock, setSalaryLock] = useState(EMPTY_SALARY_LOCK);
    const [todayRecord, setTodayRecord] = useState(null);
    const [allTimeStats, setAllTimeStats] = useState(null);
    const [allTimeLoading, setAllTimeLoading] = useState(false);
    const [allTimeNote, setAllTimeNote] = useState('');
    const [hoveredDate, setHoveredDate] = useState('');

    const monthAnchor = useMemo(() => new Date(`${monthKey}-01T12:00:00`), [monthKey]);
    const choices = useMemo(() => monthChoices(joinKey, todayKey), [joinKey, todayKey]);

    const loadMonth = useCallback(async () => {
        if (!employeeMongoId || !/^\d{4}-\d{2}$/.test(monthKey)) return;
        setMonthLoading(true);
        setMonthError('');
        try {
            const response = await axiosInstance.get('/Attendance/me', {
                params: { month: monthKey, forEmployeeId: employeeMongoId },
                skipToast: true,
            });
            const rows = Array.isArray(response.data?.records) ? response.data.records : [];
            const map = {};
            rows.forEach((row) => {
                if (row?.date) map[row.date] = row;
            });
            setMonthRecords(rows);
            setRecordsByDate(map);
            setStaffType(normalizeWorkLocationKey(response.data?.employee?.staffType || employee.staffType));
            setOffWeekdays(
                new Set(
                    Array.isArray(response.data?.offWeekdays) && response.data.offWeekdays.length
                        ? response.data.offWeekdays
                        : ['saturday', 'sunday'],
                ),
            );
            setSalaryLock(salaryLockFromAttendancePayload(response.data));
            if (monthKey === currentMonth) {
                setTodayRecord(response.data?.todayRecord || map[todayKey] || null);
            }
        } catch (err) {
            setMonthRecords([]);
            setRecordsByDate({});
            if (err?.response?.data?.salaryEnrolled === false || err?.response?.data?.attendanceLocked) {
                setSalaryLock(salaryLockFromAttendancePayload(err.response.data));
                setMonthError('');
            } else {
                setSalaryLock(EMPTY_SALARY_LOCK);
                setMonthError(err?.response?.data?.message || 'Could not load attendance.');
            }
        } finally {
            setMonthLoading(false);
        }
    }, [employeeMongoId, monthKey, currentMonth, todayKey, employee.staffType]);

    useEffect(() => {
        loadMonth();
    }, [loadMonth]);

    useEffect(() => {
        if (monthKey === currentMonth) return undefined;
        let cancelled = false;
        axiosInstance
            .get('/Attendance/me', {
                params: { month: currentMonth, forEmployeeId: employeeMongoId },
                skipToast: true,
            })
            .then((response) => {
                if (cancelled) return;
                const rows = Array.isArray(response.data?.records) ? response.data.records : [];
                const found = response.data?.todayRecord || rows.find((row) => row?.date === todayKey) || null;
                setTodayRecord(found);
            })
            .catch(() => {
                if (!cancelled) setTodayRecord(null);
            });
        return () => {
            cancelled = true;
        };
    }, [monthKey, currentMonth, employeeMongoId, todayKey]);

    useEffect(() => {
        const year = Number(monthKey.slice(0, 4));
        if (!year) return undefined;
        let cancelled = false;
        axiosInstance
            .get('/Holiday', { params: { year }, skipToast: true })
            .then((response) => {
                if (!cancelled) setHolidayRows(Array.isArray(response.data?.holidays) ? response.data.holidays : []);
            })
            .catch(() => {
                if (!cancelled) setHolidayRows([]);
            });
        return () => {
            cancelled = true;
        };
    }, [monthKey]);

    useEffect(() => {
        if (period !== 'all' || !employeeMongoId) return undefined;
        const nowYear = Number(todayKey.slice(0, 4));
        const joinYear = Number(String(joinKey).slice(0, 4));
        const start = Number.isFinite(joinYear) && joinYear >= 2000 ? joinYear : nowYear;
        const years = [];
        for (let year = start; year <= nowYear; year += 1) years.push(year);
        let cancelled = false;
        setAllTimeStats(null);
        setAllTimeLoading(true);
        setAllTimeNote('');
        Promise.all(
            years.map((year) =>
                axiosInstance
                    .get(`/Leave/employees/${employeeMongoId}/attendance-profile`, {
                        params: { year },
                        skipToast: true,
                    })
                    .then((response) => response.data)
                    .catch(() => null),
            ),
        )
            .then((rows) => {
                if (cancelled) return;
                const loaded = rows.filter(Boolean);
                const missing = rows.length - loaded.length;
                const summed = loaded.reduce(
                    (total, row) => addPeriodStats(total, profilePeriodStats(row)),
                    addPeriodStats({}, {}),
                );
                setAllTimeStats(summed);
                setAllTimeNote(missing ? `${missing} year${missing === 1 ? '' : 's'} could not be loaded.` : '');
            })
            .finally(() => {
                if (!cancelled) setAllTimeLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [period, employeeMongoId, joinKey, todayKey]);

    const { holidayDates, holidayNamesByDate } = useMemo(() => {
        const dates = new Set();
        const names = {};
        holidayRows.forEach((row) => {
            if (!row?.date || !holidayAppliesToStaff(row, staffType)) return;
            dates.add(row.date);
            names[row.date] = row.name || row.note || 'Holiday';
        });
        return { holidayDates: dates, holidayNamesByDate: names };
    }, [holidayRows, staffType]);

    const days = useMemo(
        () => eachDayOfInterval({ start: startOfMonth(monthAnchor), end: endOfMonth(monthAnchor) }),
        [monthAnchor],
    );

    const countFrom = joinKey.startsWith(monthKey) && joinKey > `${monthKey}-01` ? joinKey : `${monthKey}-01`;
    const countTo = countEndForMonth(monthKey, todayKey);
    const countedRecords = useMemo(
        () => recordsInWindow(monthRecords, countFrom, countTo),
        [monthRecords, countFrom, countTo],
    );

    const monthStats = useMemo(() => {
        const annual = leaveTallies(countedRecords, 'on_leave');
        const sick = leaveTallies(countedRecords, 'sick_leave');
        const authorized = leaveTallies(countedRecords, 'authorized_leave');
        const unauthorized = leaveTallies(countedRecords, 'unauthorized_leave');
        let present = 0;
        let wfh = 0;
        let lateIn = 0;
        let earlyOut = 0;
        let missed = 0;
        let compoffUsed = 0;
        let compoffPending = 0;
        countedRecords.forEach((row) => {
            const key = String(row?.statusKey || '');
            if (key === 'on_office') present += 1;
            if (key === 'work_from_home') wfh += 1;
            if (key === 'late_arrived') lateIn += 1;
            if (key === 'early_go') earlyOut += 1;
            if (key === 'mispunch') missed += 1;
            if (key === 'compoff_leave') {
                compoffUsed += 1;
                const state = String(row?.compOff?.state || '');
                if (!state || state === 'open') compoffPending += 1;
            }
        });
        let absent = 0;
        if (countTo) {
            days.forEach((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                if (dateKey < countFrom || dateKey > countTo) return;
                if (joinKey && dateKey < joinKey) return;
                const record = recordsByDate[dateKey];
                const weekdayKey = WEEKDAY_KEYS[getDay(day)];
                const isHoliday = holidayDates.has(dateKey) || record?.statusKey === 'holiday';
                const isWeeklyOff = !isHoliday && (record?.statusKey === 'weekly_off' || offWeekdays.has(weekdayKey));
                if (isHoliday || isWeeklyOff) return;
                const key = String(record?.statusKey || '');
                if (!record || key === 'not_marked') absent += 1;
            });
        }
        return {
            annual,
            sick,
            authorized,
            unauthorized,
            compoffUsed,
            compoffPending,
            lateIn,
            earlyOut,
            missed,
            present,
            wfh,
            absent,
        };
    }, [countedRecords, days, recordsByDate, holidayDates, offWeekdays, countFrom, countTo, joinKey]);

    const yearStats = useMemo(() => profilePeriodStats(profile), [profile]);
    const activeStats = period === 'all' ? allTimeStats || profilePeriodStats(null) : period === 'year' ? yearStats : monthStats;
    const statsLocked = period === 'month' && salaryLock.locked;
    const showValue = (value) => (statsLocked ? '—' : value);

    const balances = profile?.leaveBalances || {};
    const annualLeave = profile?.annualLeave || {};
    const sickRemaining = balances.sick_leave?.remaining == null ? '—' : n(balances.sick_leave.remaining);
    const annualBalance = balances.on_leave?.remaining == null ? n(annualLeave.remainingDays) : n(balances.on_leave.remaining);
    const compoffBalance = n(balances.compoff_leave?.remaining);

    const financial = profile?.financial || {};
    const salary = financial.salary || {};
    const monthlySalary = n(salary.monthlySalary) || n(salary.totalSalary);
    const salaryOther = n(salary.other) || Math.max(0, monthlySalary - n(salary.basic));
    const dailyRate = monthlySalary > 0 ? monthlySalary / 30 : 0;
    const increment = financial.increment;
    const loans = Array.isArray(financial.loans) ? financial.loans : [];
    const advances = Array.isArray(financial.advances) ? financial.advances : [];
    const fines = Array.isArray(financial.fines) ? financial.fines : [];
    const rewards = Array.isArray(financial.rewards) ? financial.rewards : [];
    const utilityItems = Array.isArray(financial.utilityItems) ? financial.utilityItems : [];
    const loanOutstanding = loans.reduce((sum, row) => sum + n(row.outstanding), 0);
    const loanPaid = loans.reduce(
        (sum, row) => sum + (row.paid != null && row.paid !== '' ? n(row.paid) : Math.max(0, n(row.total) - n(row.outstanding))),
        0,
    );
    const advanceOutstanding = advances.reduce((sum, row) => sum + n(row.outstanding), 0);
    const advancePaid = advances.reduce(
        (sum, row) => sum + (row.paid != null && row.paid !== '' ? n(row.paid) : Math.max(0, n(row.total) - n(row.outstanding))),
        0,
    );
    const fineOutstanding = fines.reduce((sum, row) => sum + n(row.outstanding), 0);
    const utilityOutstanding = utilityItems.length
        ? utilityItems.reduce((sum, row) => sum + n(row.amount), 0)
        : n(financial.utility?.outstanding);

    const monthRewardLabel = formatMonthLabel(monthKey);
    const monthRewards = rewards.filter(
        (row) => String(row?.dateLabel || '').trim().toLowerCase() === monthRewardLabel.toLowerCase(),
    );
    const rewardAmount = monthRewards.reduce((sum, row) => sum + n(row.amount), 0);
    const rewardLead = monthRewards[0];

    const overtime = useMemo(() => {
        let approvedHours = 0;
        let pendingHours = 0;
        let daysCount = 0;
        countedRecords.forEach((row) => {
            const status = String(row?.flexibleOtStatus || '');
            const approved = n(row?.flexibleOtApprovedHours);
            const requested = n(row?.flexibleOtHours);
            if (status === 'approved' && approved > 0) {
                approvedHours += approved;
                daysCount += 1;
            } else if (status === 'pending' && (requested > 0 || approved > 0)) {
                pendingHours += requested || approved;
            }
        });
        return { approvedHours, pendingHours, daysCount };
    }, [countedRecords]);

    const deductionRows = useMemo(() => {
        const policy = profile?.leavePolicy || {};
        const authDays = n(leaveTallies(countedRecords, 'authorized_leave').used);
        const unauthDays = n(leaveTallies(countedRecords, 'unauthorized_leave').used);
        const authValue = authDays * (n(policy.authorizedDeductionDays) || 1) * dailyRate;
        const unauthValue = unauthDays * (n(policy.unauthorizedDeductionDays) || 1) * dailyRate;
        return [
            { key: 'late_arrived', type: 'Late in', count: monthStats.lateIn, amount: null },
            { key: 'early_go', type: 'Early out', count: monthStats.earlyOut, amount: null },
            { key: 'mispunch', type: 'Missed punch', count: monthStats.missed, amount: null },
            { key: 'authorized_leave', type: 'Authorized leave', count: authDays, amount: authValue },
            { key: 'unauthorized_leave', type: 'Unauthorized leave', count: unauthDays, amount: unauthValue },
        ];
    }, [countedRecords, profile?.leavePolicy, dailyRate, monthStats]);
    const deductionTotal = deductionRows.reduce((sum, row) => sum + (row.amount == null ? 0 : row.amount), 0);

    const elapsedDays = countFrom && countTo ? inclusiveDays(countFrom, countTo) : 0;
    const daysInMonth = days.length || 0;
    const accumulated = !salaryLock.locked && monthlySalary > 0 && daysInMonth
        ? monthlySalary * (elapsedDays / daysInMonth)
        : 0;
    const accumulatedPct = monthlySalary > 0 ? Math.round((accumulated / monthlySalary) * 1000) / 10 : 0;

    const pending = profile?.requests?.pending || [];
    const rangeLabel = (() => {
        if (period === 'year') {
            const year = profile?.year || monthKey.slice(0, 4);
            return `01-Jan-${year} – 31-Dec-${year}`;
        }
        if (period === 'all') {
            return `${formatDayLabel(joinKey)} – ${formatDayLabel(shiftDateKey(todayKey, -1))}`;
        }
        if (!countTo) return `${formatMonthLabel(monthKey)} · no completed days yet`;
        return `${formatDayLabel(countFrom)} – ${formatDayLabel(countTo)}`;
    })();

    const nameParts = String(employee.name || '').trim().split(/\s+/);
    const initials = getEmployeeInitials(nameParts[0], nameParts.slice(1).join(' '));
    const isActive = employee.isActive !== false;
    const leadingBlanks = (getDay(startOfMonth(monthAnchor)) + 6) % 7;

    function selectMonth(nextKey) {
        if (!choices.includes(nextKey)) return;
        setMonthKey(nextKey);
        setPeriod('month');
        const nextYear = Number(String(nextKey).slice(0, 4));
        if (nextYear) onYearChange?.(nextYear);
    }

    function shiftMonth(delta) {
        selectMonth(format(addMonths(monthAnchor, delta), 'yyyy-MM'));
    }

    function openRecords(key) {
        if (key === 'on_leave') {
            onOpenAnnual?.();
            return;
        }
        const keys = key === 'on_office' ? ['on_office', 'work_from_home'] : [key];
        const source = period === 'month' ? countedRecords : profile?.events || [];
        const rows = (source || []).filter((row) => keys.includes(String(row?.statusKey || '')));
        onOpenCategory?.(
            key,
            period === 'month' ? rows.flatMap((row) => eventRowsFromRecords([row], row.statusKey)) : rows,
        );
    }

    const todayLocation = locationOf(todayRecord);
    const todayIn = todayRecord?.timeIn;
    const todayOut = todayRecord?.timeOut;
    const openMinutes = !todayOut && clockToMinutes(todayIn) != null
        ? Math.max(0, (dubaiNowMinutes() ?? 0) - clockToMinutes(todayIn))
        : null;
    const todayWorked = todayIn ? workedMinutes(todayIn, todayOut) ?? openMinutes : null;

    return (
        <div className="space-y-3">
            <section className="rounded-2xl border border-[#E6EDF5] bg-white px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="relative shrink-0">
                            {employee.profilePicture ? (
                                <img src={employee.profilePicture} alt="" className="h-11 w-11 rounded-xl object-cover" />
                            ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DBEAFE] text-sm font-black text-[#1D4ED8]">
                                    {initials}
                                </div>
                            )}
                            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${isActive ? 'bg-[#22C55E]' : 'bg-slate-400'}`} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="truncate text-[16px] font-bold text-[#1B2A4A]">{employee.name || 'Employee'}</h1>
                                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${isActive ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-slate-100 text-slate-500'}`}>
                                    {isActive ? 'Active' : employee.status || 'Inactive'}
                                </span>
                            </div>
                            <p className="truncate text-[12px] text-[#64748B]">
                                {employee.employeeId || '—'}
                                {employee.designation ? ` · ${employee.designation}` : ''}
                                {employee.department ? ` | ${employee.department}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="hidden min-w-0 items-center divide-x divide-[#E6EDF5] md:flex">
                        {[
                            { icon: CalendarDays, label: 'Joining date', value: formatDayLabel(joinKey) },
                            { icon: UserRound, label: 'Reporting manager', value: employee.reportsTo || '—' },
                            { icon: Briefcase, label: 'Work location', value: workLocationLabel(employee.staffType) || '—' },
                        ].map((item) => (
                            <div key={item.label} className="flex items-center gap-1.5 px-3">
                                <item.icon size={13} className="text-[#94A3B8]" />
                                <div className="min-w-0">
                                    <p className="text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">{item.label}</p>
                                    <p className="truncate text-[12px] font-semibold text-[#1B2A4A]">{item.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="ml-auto flex items-end gap-2">
                        <div>
                            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">Period</p>
                            <div className="inline-flex rounded-lg bg-[#F1F5F9] p-0.5">
                                {[
                                    { id: 'month', label: 'Monthly' },
                                    { id: 'year', label: 'Yearly' },
                                    { id: 'all', label: 'All time' },
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setPeriod(item.id)}
                                        className={`h-7 rounded-md px-2.5 text-[11px] font-semibold ${period === item.id ? 'bg-[#2563EB] text-white' : 'text-[#64748B]'}`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">Month</p>
                            <div className="relative">
                                <select
                                    value={choices.includes(monthKey) ? monthKey : choices[0]}
                                    onChange={(event) => selectMonth(event.target.value)}
                                    className="h-7 appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-2 pr-6 text-[11px] font-semibold text-[#1B2A4A]"
                                >
                                    {choices.map((option) => (
                                        <option key={option} value={option}>{formatMonthLabel(option)}</option>
                                    ))}
                                </select>
                                <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                            </div>
                        </div>
                        <button type="button" onClick={onOpenSalary} className="h-7 rounded-lg border border-[#E2E8F0] px-2 text-[11px] font-semibold text-[#64748B]">
                            Salary setup
                        </button>
                        <button type="button" onClick={onDownload} className="h-7 rounded-lg border border-[#E2E8F0] px-2 text-[11px] font-semibold text-[#64748B]">
                            Report
                        </button>
                    </div>
                </div>
                <p className="mt-1 text-right text-[10px] text-[#94A3B8]">
                    {rangeLabel}
                    {period === 'month' ? ' · counts through yesterday' : ''}
                    {period === 'all' && allTimeLoading ? ' · loading…' : ''}
                    {allTimeNote ? ` · ${allTimeNote}` : ''}
                </p>
            </section>

            <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-3">
                    <Panel
                        title="Attendance & leave summary"
                        aside={period === 'month' ? formatMonthLabel(monthKey) : period === 'year' ? `Year ${profile?.year || ''}` : 'All time'}
                    >
                        <div className="grid grid-cols-3 gap-2">
                            <SummaryTile icon={Plane} iconClass="bg-[#DBEAFE] text-[#2563EB]" title="Annual leave" onClick={() => openRecords('on_leave')}>
                                <div className="grid grid-cols-3 gap-1">
                                    <Metric label="Applied" value={showValue(activeStats.annual.requested)} />
                                    <Metric label="Approved" value={showValue(activeStats.annual.approved)} />
                                    <Metric label="Used" value={showValue(activeStats.annual.used)} />
                                </div>
                            </SummaryTile>
                            <SummaryTile icon={Stethoscope} iconClass="bg-[#EDE9FE] text-[#7C3AED]" title="Sick leave" onClick={() => openRecords('sick_leave')}>
                                <div className="grid grid-cols-2 gap-1">
                                    <Metric label="Used" value={showValue(activeStats.sick.used)} />
                                    <Metric label="Remaining" value={sickRemaining} />
                                </div>
                            </SummaryTile>
                            <SummaryTile icon={CalendarDays} iconClass="bg-[#FFEDD5] text-[#C2410C]" title="Comp off" onClick={() => openRecords('compoff_leave')}>
                                <div className="grid grid-cols-2 gap-1">
                                    <Metric label="Pending" value={showValue(activeStats.compoffPending)} />
                                    <Metric label="Available" value={compoffBalance} />
                                </div>
                            </SummaryTile>
                            <SummaryTile icon={XCircle} iconClass="bg-[#FEE2E2] text-[#DC2626]" title="Unauthorized leave" onClick={() => openRecords('unauthorized_leave')}>
                                <p className="text-[16px] font-bold leading-none text-[#1B2A4A]">{showValue(activeStats.unauthorized.used)} <span className="text-[11px] font-medium text-[#64748B]">days</span></p>
                                <p className="mt-1 text-[10px] text-[#94A3B8]">{showValue(activeStats.unauthorized.approved)} approved</p>
                            </SummaryTile>
                            <SummaryTile icon={Check} iconClass="bg-[#DCFCE7] text-[#15803D]" title="Authorized leave" onClick={() => openRecords('authorized_leave')}>
                                <p className="text-[16px] font-bold leading-none text-[#1B2A4A]">{showValue(activeStats.authorized.used)} <span className="text-[11px] font-medium text-[#64748B]">days</span></p>
                                <p className="mt-1 text-[10px] text-[#94A3B8]">{showValue(activeStats.authorized.approved)} approved</p>
                            </SummaryTile>
                            <SummaryTile icon={Clock} iconClass="bg-[#FEF3C7] text-[#B45309]" title="Late in" onClick={() => openRecords('late_arrived')}>
                                <p className="text-[16px] font-bold leading-none text-[#1B2A4A]">{showValue(activeStats.lateIn)} <span className="text-[11px] font-medium text-[#64748B]">events</span></p>
                            </SummaryTile>
                            <SummaryTile icon={Clock} iconClass="bg-[#FFEDD5] text-[#C2410C]" title="Early out" onClick={() => openRecords('early_go')}>
                                <p className="text-[16px] font-bold leading-none text-[#1B2A4A]">{showValue(activeStats.earlyOut)} <span className="text-[11px] font-medium text-[#64748B]">events</span></p>
                            </SummaryTile>
                            <SummaryTile icon={Fingerprint} iconClass="bg-[#DBEAFE] text-[#1D4ED8]" title="Missed punch" onClick={() => openRecords('mispunch')}>
                                <p className="text-[16px] font-bold leading-none text-[#1B2A4A]">{showValue(activeStats.missed)} <span className="text-[11px] font-medium text-[#64748B]">events</span></p>
                            </SummaryTile>
                            <SummaryTile icon={Check} iconClass="bg-[#DCFCE7] text-[#15803D]" title="Present" onClick={() => openRecords('on_office')}>
                                <p className="text-[16px] font-bold leading-none text-[#1B2A4A]">{showValue(n(activeStats.present) + n(activeStats.wfh))} <span className="text-[11px] font-medium text-[#64748B]">days</span></p>
                            </SummaryTile>
                            <div className="col-span-2 rounded-xl border border-[#D1FAE5] bg-[#F0FDF4] px-2.5 py-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[12px] font-semibold text-[#1B2A4A]">Current attendance</p>
                                    <span className="text-[10px] font-semibold text-[#15803D]">{todayIn ? 'Checked in' : 'No punch yet'}</span>
                                </div>
                                <div className="mt-1.5 grid grid-cols-3 gap-1">
                                    <Metric label="Time in" value={formatClock12(todayIn)} />
                                    <Metric label="Working" value={todayIn ? formatDuration(todayWorked) : '—'} />
                                    <Metric label="Location" value={todayLocation.label} />
                                </div>
                            </div>
                            <SummaryTile icon={AlertTriangle} iconClass="bg-[#FEE2E2] text-[#DC2626]" title="Absent">
                                <p className="text-[16px] font-bold leading-none text-[#1B2A4A]">{activeStats.absent == null || statsLocked ? '—' : activeStats.absent} <span className="text-[11px] font-medium text-[#64748B]">days</span></p>
                            </SummaryTile>
                        </div>
                        {eligibility ? <div className="mt-2">{eligibility}</div> : null}
                    </Panel>

                    <Panel title="Salary & financial details" aside={formatMonthLabel(monthKey)}>
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={onOpenPayroll} className="rounded-xl bg-[#EFF6FF] px-3 py-2 text-left">
                                <p className="text-[11px] text-[#64748B]">Monthly salary</p>
                                <p className="mt-0.5 text-[18px] font-bold leading-none tabular-nums text-[#1B2A4A]">{formatAed(monthlySalary)}</p>
                                <p className="mt-1 text-[10px] text-[#94A3B8]">Basic {formatAed(salary.basic)} · Other {formatAed(salaryOther)}</p>
                            </button>
                            <div className="rounded-xl bg-[#ECFDF5] px-3 py-2">
                                <p className="text-[11px] text-[#64748B]">Current accumulated salary</p>
                                <p className="mt-0.5 text-[18px] font-bold leading-none tabular-nums text-[#1B2A4A]">{salaryLock.locked ? '—' : formatAed(accumulated, 2)}</p>
                                <p className="mt-1 text-[10px] text-[#94A3B8]">{salaryLock.locked ? 'Month not open' : `${accumulatedPct}% of ${formatAed(monthlySalary)}`}</p>
                            </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => onOpenFinancial?.('increment')} className="rounded-xl border border-[#E7EEF6] px-2.5 py-2 text-left">
                                <p className="text-[11px] font-semibold text-[#64748B]">Last increment</p>
                                <div className="mt-1 space-y-0.5 text-[11px] text-[#1B2A4A]">
                                    <p className="flex justify-between"><span className="text-[#94A3B8]">Previous</span><span>{increment?.fromTotal ? formatAed(increment.fromTotal) : '—'}</span></p>
                                    <p className="flex justify-between"><span className="text-[#94A3B8]">Increment</span><span className="font-semibold text-[#15803D]">{increment?.amount ? `+${formatAed(increment.amount)}` : formatAed(0)}</span></p>
                                    <p className="flex justify-between"><span className="text-[#94A3B8]">New</span><span>{increment?.toTotal ? formatAed(increment.toTotal) : formatAed(monthlySalary)}</span></p>
                                    <p className="flex justify-between"><span className="text-[#94A3B8]">Effective</span><span>{increment?.dateLabel || '—'}</span></p>
                                </div>
                            </button>
                            <div className="rounded-xl border border-[#E7EEF6] px-2.5 py-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[11px] font-semibold text-[#64748B]">Financial obligations</p>
                                    <button type="button" onClick={onOpenPayroll} className="text-[10px] font-semibold text-[#2563EB]">View details</button>
                                </div>
                                <div className="mt-1 grid grid-cols-2 gap-1.5">
                                    <button type="button" onClick={() => onOpenFinancial?.('advance')} className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-left">
                                        <p className="text-[10px] text-[#64748B]">Advance</p>
                                        <p className="text-[12px] font-bold text-[#1B2A4A]">{formatAed(advanceOutstanding)}</p>
                                        <p className="text-[10px] text-[#94A3B8]">Paid {formatAed(advancePaid)}</p>
                                    </button>
                                    <button type="button" onClick={() => onOpenFinancial?.('loan')} className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-left">
                                        <p className="text-[10px] text-[#64748B]">Loan</p>
                                        <p className="text-[12px] font-bold text-[#1B2A4A]">{formatAed(loanOutstanding)}</p>
                                        <p className="text-[10px] text-[#94A3B8]">Recovered {formatAed(loanPaid)}</p>
                                    </button>
                                    <button type="button" onClick={() => onOpenFinancial?.('fines')} className="rounded-lg bg-[#FEF2F2] px-2 py-1.5 text-left">
                                        <p className="text-[10px] text-[#64748B]">Fines</p>
                                        <p className="text-[12px] font-bold text-[#B91C1C]">{formatAed(fineOutstanding)}</p>
                                    </button>
                                    <button type="button" onClick={() => onOpenFinancial?.('utility')} className="rounded-lg bg-[#FFF7ED] px-2 py-1.5 text-left">
                                        <p className="text-[10px] text-[#64748B]">Utility excess</p>
                                        <p className="text-[12px] font-bold text-[#C2410C]">{formatAed(utilityOutstanding)}</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => onOpenFinancial?.('rewards')} className="rounded-xl border border-[#E7EEF6] px-2.5 py-2 text-left">
                                <p className="flex items-center gap-1 text-[11px] font-semibold text-[#64748B]"><Gift size={12} /> Rewards earned</p>
                                <p className="mt-1 text-[16px] font-bold leading-none text-[#1B2A4A]">{formatAed(rewardAmount)}</p>
                                <p className="mt-1 text-[10px] text-[#94A3B8]">{rewardLead ? `${rewardLead.dateLabel || monthRewardLabel} · ${rewardLead.type || 'Reward'}` : `None in ${monthRewardLabel}`}</p>
                            </button>
                            <div className="rounded-xl border border-[#E7EEF6] px-2.5 py-2">
                                <p className="flex items-center gap-1 text-[11px] font-semibold text-[#64748B]"><Clock size={12} /> Overtime</p>
                                <p className="mt-1 text-[16px] font-bold leading-none text-[#1B2A4A]">{salaryLock.locked ? '—' : formatDuration(Math.round(overtime.approvedHours * 60))}</p>
                                <p className="mt-1 text-[10px] text-[#94A3B8]">{overtime.daysCount} days · pending {formatDuration(Math.round(overtime.pendingHours * 60))}</p>
                            </div>
                        </div>
                        <div className="mt-2 overflow-hidden rounded-xl border border-[#E7EEF6]">
                            <div className="flex items-center justify-between px-2.5 py-1.5">
                                <p className="text-[12px] font-bold text-[#1B2A4A]">Salary deduction for {formatMonthLabel(monthKey)}</p>
                                <button type="button" onClick={() => onOpenFinancial?.('deductions')} className="text-[10px] font-semibold text-[#2563EB]">View records</button>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-[#F8FAFC] text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                                    <tr>
                                        <th className="px-2.5 py-1 font-semibold">#</th>
                                        <th className="px-2 py-1 font-semibold">Deduction type</th>
                                        <th className="px-2 py-1 font-semibold">Count</th>
                                        <th className="px-2.5 py-1 text-right font-semibold">Amount (AED)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deductionRows.map((row, index) => (
                                        <tr key={row.key} className="border-t border-[#F1F5F9] text-[11px] text-[#1B2A4A]">
                                            <td className="px-2.5 py-1">{index + 1}</td>
                                            <td className="px-2 py-1">{row.type}</td>
                                            <td className="px-2 py-1 tabular-nums">{salaryLock.locked ? '—' : row.count}</td>
                                            <td className="px-2.5 py-1 text-right tabular-nums">{salaryLock.locked || row.amount == null ? '—' : formatAedNumber(row.amount)}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-t border-[#E2E8F0] text-[11px] font-bold text-[#1B2A4A]">
                                        <td className="px-2.5 py-1" colSpan={3}>Total deduction</td>
                                        <td className="px-2.5 py-1 text-right tabular-nums">{salaryLock.locked ? '—' : formatAedNumber(deductionTotal)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                    <Panel title="Attendance calendar">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="inline-flex h-7 items-center rounded-lg border border-[#E2E8F0]">
                                <button type="button" onClick={() => shiftMonth(-1)} className="inline-flex h-7 w-6 items-center justify-center text-[#64748B]" aria-label="Previous month"><ChevronLeft size={14} /></button>
                                <span className="min-w-[6.5rem] text-center text-[11px] font-semibold text-[#1B2A4A]">{formatMonthLabel(monthKey)}</span>
                                <button type="button" onClick={() => shiftMonth(1)} className="inline-flex h-7 w-6 items-center justify-center text-[#64748B]" aria-label="Next month"><ChevronRight size={14} /></button>
                            </div>
                            <button type="button" onClick={() => selectMonth(currentMonth)} className="h-7 rounded-lg border border-[#E2E8F0] px-2 text-[11px] font-semibold text-[#2563EB]">Today</button>
                        </div>
                        {monthError ? (
                            <button type="button" onClick={loadMonth} className="py-6 text-[12px] text-red-500">{monthError} · Retry</button>
                        ) : monthLoading ? (
                            <p className="py-6 text-center text-[12px] text-[#94A3B8]">Loading calendar…</p>
                        ) : (
                            <div className="flex gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1 grid grid-cols-7 gap-1">
                                        {WEEKDAYS.map((day) => (
                                            <div key={day} className="text-center text-[9px] font-semibold uppercase text-[#94A3B8]">{day}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1">
                                        {Array.from({ length: leadingBlanks }).map((_, index) => <div key={`blank-${index}`} />)}
                                        {days.map((day) => {
                                            const dateKey = format(day, 'yyyy-MM-dd');
                                            const record = recordsByDate[dateKey];
                                            const weekdayKey = WEEKDAY_KEYS[getDay(day)];
                                            const isHoliday = holidayDates.has(dateKey) || record?.statusKey === 'holiday';
                                            const isWeeklyOff = !isHoliday && (record?.statusKey === 'weekly_off' || offWeekdays.has(weekdayKey));
                                            const isFuture = dateKey > todayKey;
                                            const kind = salaryLock.locked ? 'future' : dayKind(record, { isFuture, isToday: dateKey === todayKey, isHoliday, isWeeklyOff });
                                            const place = locationOf(record);
                                            const worked = record?.timeIn ? workedMinutes(record.timeIn, record.timeOut) : null;
                                            return (
                                                <div key={dateKey} className="relative" onMouseEnter={() => setHoveredDate(dateKey)} onMouseLeave={() => setHoveredDate('')}>
                                                    <div className={`flex h-8 items-center justify-center rounded-md text-[12px] font-bold tabular-nums ${DAY_STYLE[kind] || DAY_STYLE.empty}`}>{format(day, 'd')}</div>
                                                    {hoveredDate === dateKey && !salaryLock.locked ? (
                                                        <div className={`absolute left-1/2 z-30 w-48 -translate-x-1/2 rounded-xl border border-[#E6EDF5] bg-white p-2.5 text-left shadow-lg ${Number(format(day, 'd')) > 20 ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                                                            <p className="text-[12px] font-bold text-[#1B2A4A]">{format(day, 'd MMMM yyyy')}</p>
                                                            <p className="mt-0.5 text-[11px] text-[#64748B]">{kindLabel(kind)}{holidayNamesByDate[dateKey] ? ` · ${holidayNamesByDate[dateKey]}` : ''}</p>
                                                            <div className="mt-1.5 space-y-0.5 text-[11px] text-[#1B2A4A]">
                                                                <p className="flex justify-between"><span className="text-[#94A3B8]">Time in</span><span>{formatClock12(record?.timeIn)}</span></p>
                                                                <p className="flex justify-between"><span className="text-[#94A3B8]">Time out</span><span>{formatClock12(record?.timeOut)}</span></p>
                                                                <p className="flex justify-between"><span className="text-[#94A3B8]">Worked</span><span>{worked == null ? '—' : formatDuration(worked)}</span></p>
                                                                <p className="flex items-start justify-between gap-2"><span className="text-[#94A3B8]">Location</span><span className="text-right">{place.label}</span></p>
                                                            </div>
                                                            {place.mapHref ? <a href={place.mapHref} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB]"><MapPin size={11} /> View on map</a> : null}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="w-[7.5rem] shrink-0 space-y-1 pt-4">
                                    <p className="text-[10px] font-semibold text-[#94A3B8]">Legend</p>
                                    {LEGEND.map((item) => (
                                        <span key={item.key} className="flex items-center gap-1.5 text-[10px] leading-tight text-[#64748B]">
                                            <span className={`h-2 w-2 shrink-0 rounded-full ${item.swatch}`} />
                                            {item.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <DashboardSalaryEnrollLock {...salaryLock} />
                    </Panel>

                    <Panel
                        title={`Leave details (${period === 'month' ? formatMonthLabel(monthKey) : period === 'year' ? profile?.year || '' : 'all time'})`}
                        aside={<button type="button" onClick={onOpenLeaveList} className="text-[11px] font-semibold text-[#2563EB]">View leave history</button>}
                    >
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl bg-[#F5F8FF] px-2.5 py-2">
                                <p className="mb-1.5 flex items-center gap-1 text-[12px] font-bold text-[#1B2A4A]"><Plane size={13} className="text-[#2563EB]" /> Annual leave</p>
                                <div className="grid grid-cols-4 gap-1">
                                    <Metric label="Requested" value={showValue(activeStats.annual.requested)} />
                                    <Metric label="Approved" value={showValue(activeStats.annual.approved)} />
                                    <Metric label="Used" value={showValue(activeStats.annual.used)} />
                                    <Metric label="Balance" value={annualBalance} />
                                </div>
                            </div>
                            <div className="rounded-xl bg-[#F3FBF6] px-2.5 py-2">
                                <p className="mb-1.5 flex items-center gap-1 text-[12px] font-bold text-[#1B2A4A]"><Check size={13} className="text-[#15803D]" /> Authorized leave</p>
                                <div className="grid grid-cols-3 gap-1">
                                    <Metric label="Requested" value={showValue(activeStats.authorized.requested)} />
                                    <Metric label="Approved" value={showValue(activeStats.authorized.approved)} />
                                    <Metric label="Used" value={showValue(activeStats.authorized.used)} />
                                </div>
                            </div>
                            <div className="rounded-xl bg-[#F7F5FF] px-2.5 py-2">
                                <p className="mb-1.5 flex items-center gap-1 text-[12px] font-bold text-[#1B2A4A]"><Stethoscope size={13} className="text-[#7C3AED]" /> Sick leave</p>
                                <div className="grid grid-cols-4 gap-1">
                                    <Metric label="Requested" value={showValue(activeStats.sick.requested)} />
                                    <Metric label="Approved" value={showValue(activeStats.sick.approved)} />
                                    <Metric label="Used" value={showValue(activeStats.sick.used)} />
                                    <Metric label="Balance" value={sickRemaining} />
                                </div>
                            </div>
                            <div className="rounded-xl bg-[#F4FBFA] px-2.5 py-2">
                                <p className="mb-1.5 flex items-center gap-1 text-[12px] font-bold text-[#1B2A4A]"><CalendarDays size={13} className="text-[#0F766E]" /> Comp off</p>
                                <div className="grid grid-cols-2 gap-1">
                                    <Metric label="Used" value={showValue(activeStats.compoffUsed)} />
                                    <Metric label="Balance" value={compoffBalance} />
                                </div>
                            </div>
                        </div>
                    </Panel>

                    <section className="overflow-hidden rounded-2xl border border-[#FECACA] bg-white">
                        <div className="flex items-center justify-between bg-[#FEF2F2] px-3 py-2">
                            <p className="text-[13px] font-bold text-[#991B1B]">Salary preparation status</p>
                            <span className="text-[11px] font-semibold text-[#B91C1C]">{pending.length ? `${pending.length} pending` : 'Clear'}</span>
                        </div>
                        <table className="w-full text-left">
                            <thead className="text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                                <tr>
                                    <th className="px-2.5 py-1 font-semibold">#</th>
                                    <th className="px-2 py-1 font-semibold">Pending item</th>
                                    <th className="px-2 py-1 font-semibold">Reference</th>
                                    <th className="px-2 py-1 font-semibold">Status</th>
                                    <th className="px-2.5 py-1 font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pending.length ? pending.map((row, index) => (
                                    <tr key={row.id} className="border-t border-[#F8FAFC] text-[11px] text-[#1B2A4A]">
                                        <td className="px-2.5 py-1.5">{index + 1}</td>
                                        <td className="px-2 py-1.5">
                                            <p className="font-semibold">{row.title}</p>
                                            <p className="text-[10px] text-[#94A3B8]">{row.subtitle}</p>
                                        </td>
                                        <td className="px-2 py-1.5">{row.id}</td>
                                        <td className="px-2 py-1.5">{row.badge || 'Pending'}</td>
                                        <td className="px-2.5 py-1.5"><button type="button" onClick={onOpenLeaveList} className="font-semibold text-[#2563EB]">View</button></td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={5} className="px-3 py-2 text-[11px] text-[#94A3B8]">No pending queries.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-[#E6EDF5] bg-white">
                        <div className="flex items-center justify-between px-3 py-2">
                            <p className="text-[13px] font-bold text-[#1B2A4A]">Pending employee tasks</p>
                            <span className="text-[11px] text-[#64748B]">{n(profile?.requests?.workTaskPendingCount)} pending</span>
                        </div>
                        <p className="border-t border-[#F1F5F9] px-3 py-2 text-[11px] text-[#94A3B8]">
                            {n(profile?.requests?.workTaskPendingCount) ? `${n(profile.requests.workTaskPendingCount)} assigned task${n(profile.requests.workTaskPendingCount) === 1 ? '' : 's'} still open.` : 'No pending tasks.'}
                        </p>
                    </section>

                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E6EDF5] bg-white px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]"><CalendarDays size={15} /></span>
                            <div className="min-w-0">
                                <p className="text-[13px] font-bold text-[#1B2A4A]">Annual attendance calendar</p>
                                <p className="truncate text-[11px] text-[#94A3B8]">Full-year attendance for this employee</p>
                            </div>
                        </div>
                        <Link href={annualCalendarHref || '/HRM/Leave/annual-leave'} className="inline-flex h-8 shrink-0 items-center rounded-lg bg-[#2563EB] px-3 text-[12px] font-semibold text-white">
                            View annual calendar
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
