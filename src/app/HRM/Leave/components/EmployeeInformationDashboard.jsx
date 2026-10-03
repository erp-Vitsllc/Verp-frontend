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
    ArrowRight,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Fingerprint,
    MapPin,
    Plane,
    Stethoscope,
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

function StatCard({ icon: Icon, iconClass, title, onClick, children, footer }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-2xl border border-[#E7EDF5] bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[#D5DEEA] transition-colors"
        >
            <div className="flex items-center gap-2.5">
                <span className={`h-9 w-9 rounded-xl inline-flex items-center justify-center shrink-0 ${iconClass}`}>
                    <Icon size={16} />
                </span>
                <p className="text-[13px] font-bold text-[#1B2A4A] leading-tight">{title}</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">{children}</div>
            {footer ? <p className="mt-2 text-[11px] text-slate-400">{footer}</p> : null}
        </button>
    );
}

function MiniMetric({ label, value, tone = 'text-[#1B2A4A]' }) {
    return (
        <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`mt-1 text-[18px] font-bold tabular-nums leading-none ${tone}`}>{value}</p>
        </div>
    );
}

function CountCard({ icon: Icon, iconClass, title, value, unit, detail, tone, onClick }) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`rounded-2xl border p-3.5 text-left transition-all ${tone} ${
                onClick ? 'hover:brightness-[0.99]' : ''
            }`}
        >
            <div className="flex items-center gap-2">
                <span className={`h-8 w-8 rounded-lg inline-flex items-center justify-center shrink-0 ${iconClass}`}>
                    <Icon size={15} />
                </span>
                <p className="text-[13px] font-bold text-[#1B2A4A]">{title}</p>
            </div>
            <p className="mt-3 text-[22px] font-bold tabular-nums leading-none text-[#1B2A4A]">
                {value} <span className="text-[13px] font-semibold text-slate-500">{unit}</span>
            </p>
            {detail ? <p className="mt-1.5 text-[11px] text-slate-500">{detail}</p> : null}
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
    const loanTotal = loans.reduce((sum, row) => sum + n(row.total), 0);
    const loanPaid = loans.reduce(
        (sum, row) => sum + (row.paid != null && row.paid !== '' ? n(row.paid) : Math.max(0, n(row.total) - n(row.outstanding))),
        0,
    );
    const advanceOutstanding = advances.reduce((sum, row) => sum + n(row.outstanding), 0);
    const advanceTotal = advances.reduce((sum, row) => sum + n(row.total), 0);
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
        <div className="space-y-4">
            <section className="rounded-2xl border border-[#E7EDF5] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                            {employee.profilePicture ? (
                                <img
                                    src={employee.profilePicture}
                                    alt=""
                                    className="h-14 w-14 rounded-2xl object-cover bg-slate-100"
                                />
                            ) : (
                                <div className="h-14 w-14 rounded-2xl bg-[#DBEAFE] text-[#1D4ED8] inline-flex items-center justify-center text-sm font-black">
                                    {initials}
                                </div>
                            )}
                            <span
                                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                                    isActive ? 'bg-[#22C55E]' : 'bg-slate-400'
                                }`}
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl font-bold text-[#1B2A4A] truncate">{employee.name || 'Employee'}</h1>
                                <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                        isActive ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-slate-100 text-slate-500'
                                    }`}
                                >
                                    {isActive ? 'Active' : employee.status || 'Inactive'}
                                </span>
                            </div>
                            <p className="mt-0.5 text-[13px] text-slate-500 truncate">
                                {employee.employeeId || '—'}
                                {employee.designation ? ` · ${employee.designation}` : ''}
                                {employee.department ? ` | ${employee.department}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[28rem]">
                        {[
                            { label: 'Joining date', value: formatDayLabel(joinKey) },
                            { label: 'Reporting manager', value: employee.reportsTo || '—' },
                            { label: 'Work location', value: workLocationLabel(employee.staffType) || '—' },
                        ].map((item) => (
                            <div key={item.label} className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                                <p className="mt-1 text-[13px] font-semibold text-[#1B2A4A] truncate">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="inline-flex rounded-xl bg-[#F1F5F9] p-1">
                        {[
                            { id: 'month', label: 'Monthly' },
                            { id: 'year', label: 'Yearly' },
                            { id: 'all', label: 'All time' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setPeriod(item.id)}
                                className={`h-8 rounded-lg px-3 text-[12px] font-semibold ${
                                    period === item.id ? 'bg-[#2563EB] text-white shadow-sm' : 'text-slate-500'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="relative">
                            <select
                                value={choices.includes(monthKey) ? monthKey : choices[0]}
                                onChange={(event) => selectMonth(event.target.value)}
                                className="h-9 appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[12px] font-semibold text-[#1B2A4A]"
                            >
                                {choices.map((option) => (
                                    <option key={option} value={option}>
                                        {formatMonthLabel(option)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            onClick={onOpenSalary}
                            className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
                        >
                            Salary setup
                        </button>
                        <button
                            type="button"
                            onClick={onDownload}
                            className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
                        >
                            Download report
                        </button>
                    </div>
                </div>
                <p className="mt-2 text-[12px] text-slate-500">
                    {rangeLabel}
                    {period === 'month' ? ' · Current month counts stop at yesterday. Today stays on the attendance card.' : ''}
                    {period === 'all' && allTimeLoading ? ' · Loading service history…' : ''}
                    {allTimeNote ? ` · ${allTimeNote}` : ''}
                </p>
            </section>

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <section className="rounded-2xl border border-[#E7EDF5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-[15px] font-bold text-[#1B2A4A]">Attendance & leave summary</h2>
                            <p className="mt-0.5 text-[12px] text-slate-400">
                                {period === 'month' ? formatMonthLabel(monthKey) : period === 'year' ? `Year ${profile?.year || ''}` : 'From joining date'}
                                {' · '}Remaining and balance stay on the current entitlement
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <StatCard
                            icon={Plane}
                            iconClass="bg-[#DBEAFE] text-[#2563EB]"
                            title="Annual leave"
                            onClick={() => openRecords('on_leave')}
                        >
                            <MiniMetric label="Applied" value={showValue(activeStats.annual.requested)} />
                            <MiniMetric label="Approved" value={showValue(activeStats.annual.approved)} />
                            <MiniMetric label="Used" value={showValue(activeStats.annual.used)} />
                        </StatCard>
                        <StatCard
                            icon={Stethoscope}
                            iconClass="bg-[#EDE9FE] text-[#7C3AED]"
                            title="Sick leave"
                            onClick={() => openRecords('sick_leave')}
                        >
                            <MiniMetric label="Used" value={showValue(activeStats.sick.used)} />
                            <MiniMetric label="Remaining" value={sickRemaining} tone="text-[#15803D]" />
                            <MiniMetric label="Applied" value={showValue(activeStats.sick.requested)} />
                        </StatCard>
                        <CountCard
                            icon={CalendarDays}
                            iconClass="bg-[#FFEDD5] text-[#C2410C]"
                            title="Comp off"
                            value={showValue(activeStats.compoffPending)}
                            unit="pending"
                            detail={`Available balance ${compoffBalance}`}
                            tone="border-[#FDE7D0] bg-[#FFF7ED]"
                            onClick={() => openRecords('compoff_leave')}
                        />
                        <CountCard
                            icon={XCircle}
                            iconClass="bg-[#FEE2E2] text-[#DC2626]"
                            title="Unauthorized leave"
                            value={showValue(activeStats.unauthorized.used)}
                            unit={n(activeStats.unauthorized.used) === 1 ? 'day' : 'days'}
                            detail={`${showValue(activeStats.unauthorized.requested)} applied · ${showValue(activeStats.unauthorized.approved)} approved`}
                            tone="border-[#FECACA] bg-[#FEF2F2]"
                            onClick={() => openRecords('unauthorized_leave')}
                        />
                        <CountCard
                            icon={Check}
                            iconClass="bg-[#DCFCE7] text-[#15803D]"
                            title="Authorized leave"
                            value={showValue(activeStats.authorized.used)}
                            unit={n(activeStats.authorized.used) === 1 ? 'day' : 'days'}
                            detail={`${showValue(activeStats.authorized.requested)} applied · ${showValue(activeStats.authorized.approved)} approved`}
                            tone="border-[#BBF7D0] bg-[#F0FDF4]"
                            onClick={() => openRecords('authorized_leave')}
                        />
                        <CountCard
                            icon={Clock}
                            iconClass="bg-[#FEF3C7] text-[#B45309]"
                            title="Late in"
                            value={showValue(activeStats.lateIn)}
                            unit={n(activeStats.lateIn) === 1 ? 'event' : 'events'}
                            tone="border-[#FDE68A] bg-[#FFFBEB]"
                            onClick={() => openRecords('late_arrived')}
                        />
                        <CountCard
                            icon={Clock}
                            iconClass="bg-[#FFEDD5] text-[#C2410C]"
                            title="Early out"
                            value={showValue(activeStats.earlyOut)}
                            unit={n(activeStats.earlyOut) === 1 ? 'event' : 'events'}
                            tone="border-[#FDBA74] bg-[#FFF7ED]"
                            onClick={() => openRecords('early_go')}
                        />
                        <CountCard
                            icon={Fingerprint}
                            iconClass="bg-[#DBEAFE] text-[#1D4ED8]"
                            title="Missed punch"
                            value={showValue(activeStats.missed)}
                            unit={n(activeStats.missed) === 1 ? 'event' : 'events'}
                            tone="border-[#BFDBFE] bg-[#EFF6FF]"
                            onClick={() => openRecords('mispunch')}
                        />
                        <CountCard
                            icon={Check}
                            iconClass="bg-[#DCFCE7] text-[#15803D]"
                            title="Present"
                            value={showValue(n(activeStats.present) + n(activeStats.wfh))}
                            unit={n(activeStats.present) + n(activeStats.wfh) === 1 ? 'day' : 'days'}
                            detail={n(activeStats.wfh) ? `${activeStats.wfh} work from home included` : 'Office and work from home'}
                            tone="border-[#BBF7D0] bg-[#F0FDF4]"
                            onClick={() => openRecords('on_office')}
                        />
                        <CountCard
                            icon={AlertTriangle}
                            iconClass="bg-[#FEE2E2] text-[#DC2626]"
                            title="Absent"
                            value={activeStats.absent == null || statsLocked ? '—' : activeStats.absent}
                            unit="days"
                            detail={period === 'month' ? 'Working days with no mark, through yesterday' : 'Open a month to count unmarked days'}
                            tone="border-[#FECACA] bg-[#FEF2F2]"
                        />
                    </div>
                    <div className="mt-3 rounded-2xl border border-[#D1FAE5] bg-[#F0FDF4] px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[13px] font-bold text-[#1B2A4A]">Current attendance</p>
                                <p className="mt-0.5 text-[12px] text-slate-500">Today · {formatDayLabel(todayKey)}</p>
                            </div>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#15803D]">
                                {todayIn ? 'Checked in' : 'No punch yet'}
                            </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-3">
                            <MiniMetric label="Time in" value={formatClock12(todayIn)} />
                            <MiniMetric label="Working" value={todayIn ? formatDuration(todayWorked) : '—'} />
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Location</p>
                                <p className="mt-1 text-[13px] font-semibold text-[#1B2A4A] truncate">{todayLocation.label}</p>
                            </div>
                        </div>
                    </div>
                    {eligibility ? <div className="mt-3">{eligibility}</div> : null}
                </section>

                <section className="relative rounded-2xl border border-[#E7EDF5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-[15px] font-bold text-[#1B2A4A]">Attendance calendar</h2>
                            <p className="mt-0.5 text-[12px] text-slate-400">Hover a date for time in, time out, and location</p>
                        </div>
                        <div className="inline-flex h-9 items-center rounded-lg border border-[#E2E8F0] bg-white">
                            <button
                                type="button"
                                onClick={() => shiftMonth(-1)}
                                disabled={!choices.includes(format(addMonths(monthAnchor, -1), 'yyyy-MM'))}
                                className="h-9 w-8 inline-flex items-center justify-center text-slate-500 disabled:opacity-30"
                                aria-label="Previous month"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="min-w-[8.5rem] text-center text-[12px] font-semibold text-[#1B2A4A]">
                                {formatMonthLabel(monthKey)}
                            </span>
                            <button
                                type="button"
                                onClick={() => shiftMonth(1)}
                                disabled={!choices.includes(format(addMonths(monthAnchor, 1), 'yyyy-MM'))}
                                className="h-9 w-8 inline-flex items-center justify-center text-slate-500 disabled:opacity-30"
                                aria-label="Next month"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                    {monthError ? (
                        <div className="py-10 text-center">
                            <p className="text-sm text-red-500">{monthError}</p>
                            <button type="button" onClick={loadMonth} className="mt-2 text-xs font-semibold text-sky-600">
                                Retry
                            </button>
                        </div>
                    ) : monthLoading ? (
                        <p className="py-10 text-center text-sm text-slate-400">Loading calendar…</p>
                    ) : (
                        <div className="flex flex-col gap-4 lg:flex-row">
                            <div className="min-w-0 flex-1">
                                <div className="mb-1 grid grid-cols-7 gap-1.5">
                                    {WEEKDAYS.map((day) => (
                                        <div key={day} className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                            {day}
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1.5">
                                    {Array.from({ length: leadingBlanks }).map((_, index) => (
                                        <div key={`blank-${index}`} />
                                    ))}
                                    {days.map((day) => {
                                        const dateKey = format(day, 'yyyy-MM-dd');
                                        const record = recordsByDate[dateKey];
                                        const weekdayKey = WEEKDAY_KEYS[getDay(day)];
                                        const isHoliday = holidayDates.has(dateKey) || record?.statusKey === 'holiday';
                                        const isWeeklyOff =
                                            !isHoliday && (record?.statusKey === 'weekly_off' || offWeekdays.has(weekdayKey));
                                        const isFuture = dateKey > todayKey;
                                        const kind = salaryLock.locked
                                            ? 'future'
                                            : dayKind(record, {
                                                  isFuture,
                                                  isToday: dateKey === todayKey,
                                                  isHoliday,
                                                  isWeeklyOff,
                                              });
                                        const place = locationOf(record);
                                        const open = hoveredDate === dateKey;
                                        return (
                                            <div
                                                key={dateKey}
                                                className="relative"
                                                onMouseEnter={() => setHoveredDate(dateKey)}
                                                onMouseLeave={() => setHoveredDate('')}
                                            >
                                                <div
                                                    className={`flex h-11 items-center justify-center rounded-lg text-[13px] font-bold tabular-nums ${DAY_STYLE[kind] || DAY_STYLE.empty}`}
                                                >
                                                    {format(day, 'd')}
                                                </div>
                                                {open && !salaryLock.locked ? (
                                                    <div
                                                        className={`absolute left-1/2 z-30 w-52 -translate-x-1/2 rounded-xl border border-[#E2E8F0] bg-white p-3 text-left shadow-lg ${
                                                            Number(format(day, 'd')) > 20 ? 'bottom-full mb-1' : 'top-full mt-1'
                                                        }`}
                                                    >
                                                        <p className="text-[12px] font-bold text-[#1B2A4A]">
                                                            {format(day, 'd MMM yyyy')}
                                                        </p>
                                                        <p className="mt-0.5 text-[11px] text-slate-500">
                                                            {kindLabel(kind)}
                                                            {holidayNamesByDate[dateKey] ? ` · ${holidayNamesByDate[dateKey]}` : ''}
                                                        </p>
                                                        <div className="mt-2 space-y-1 text-[11px] text-[#1B2A4A]">
                                                            <p>Time in · {formatClock12(record?.timeIn)}</p>
                                                            <p>Time out · {formatClock12(record?.timeOut)}</p>
                                                            <p className="inline-flex items-start gap-1">
                                                                <MapPin size={12} className="mt-0.5 shrink-0 text-slate-400" />
                                                                <span>{place.label}</span>
                                                            </p>
                                                        </div>
                                                        {place.mapHref ? (
                                                            <a
                                                                href={place.mapHref}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="mt-2 inline-flex text-[11px] font-semibold text-[#2563EB]"
                                                            >
                                                                View on map
                                                            </a>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-y-2 lg:w-40 lg:grid-cols-1">
                                {LEGEND.map((item) => (
                                    <span key={item.key} className="inline-flex items-center gap-2 text-[11px] text-slate-500">
                                        <span className={`h-2.5 w-2.5 rounded-full ${item.swatch}`} />
                                        {item.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    <DashboardSalaryEnrollLock {...salaryLock} />
                </section>

                <section className="rounded-2xl border border-[#E7EDF5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-[15px] font-bold text-[#1B2A4A]">Salary & financial details</h2>
                            <p className="mt-0.5 text-[12px] text-slate-400">
                                {formatMonthLabel(monthKey)}
                                {monthKey === currentMonth ? ' · through yesterday' : ''}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onOpenPayroll}
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 px-3 text-[12px] font-semibold text-slate-500"
                        >
                            Payroll file
                            <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={onOpenPayroll}
                            className="rounded-2xl bg-[#EFF6FF] px-4 py-3 text-left"
                        >
                            <p className="text-[12px] text-slate-500">Monthly salary</p>
                            <p className="mt-1 text-[22px] font-bold tabular-nums text-[#1B2A4A]">{formatAed(monthlySalary)}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                                Basic {formatAed(salary.basic)} · Other {formatAed(salaryOther)}
                            </p>
                        </button>
                        <div className="rounded-2xl bg-[#ECFDF5] px-4 py-3">
                            <p className="text-[12px] text-slate-500">Current accumulated salary</p>
                            <p className="mt-1 text-[22px] font-bold tabular-nums text-[#1B2A4A]">
                                {salaryLock.locked ? '—' : formatAed(accumulated, 2)}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                                {salaryLock.locked
                                    ? 'Attendance for this month is not open yet'
                                    : `${accumulatedPct}% of ${formatAed(monthlySalary)} · ${elapsedDays} of ${daysInMonth} days`}
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button type="button" onClick={() => onOpenFinancial?.('increment')} className="rounded-2xl border border-[#E7EDF5] p-3 text-left">
                            <p className="text-[12px] font-semibold text-slate-500">Last increment</p>
                            <p className="mt-1 text-[18px] font-bold text-[#15803D]">
                                {increment?.amount ? `+ ${formatAed(increment.amount)}` : formatAed(0)}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                                {increment?.dateLabel || 'No increment recorded'}
                                {increment?.fromTotal ? ` · ${formatAed(increment.fromTotal)} to ${formatAed(increment.toTotal)}` : ''}
                            </p>
                        </button>
                        <button type="button" onClick={() => onOpenFinancial?.('advance')} className="rounded-2xl border border-[#E7EDF5] p-3 text-left">
                            <p className="text-[12px] font-semibold text-slate-500">Advance</p>
                            <p className="mt-1 text-[13px] text-[#1B2A4A]">Owed {formatAed(advanceTotal)}</p>
                            <p className="text-[13px] text-[#1B2A4A]">Paid {formatAed(advancePaid)} · Pending {formatAed(advanceOutstanding)}</p>
                            <p className="mt-1 text-[11px] text-slate-400">Current balance</p>
                        </button>
                        <button type="button" onClick={() => onOpenFinancial?.('loan')} className="rounded-2xl border border-[#E7EDF5] p-3 text-left">
                            <p className="text-[12px] font-semibold text-slate-500">Loan</p>
                            <p className="mt-1 text-[13px] text-[#1B2A4A]">Owed {formatAed(loanTotal)}</p>
                            <p className="text-[13px] text-[#1B2A4A]">Recovered {formatAed(loanPaid)} · Pending {formatAed(loanOutstanding)}</p>
                            <p className="mt-1 text-[11px] text-slate-400">Current balance</p>
                        </button>
                        <button type="button" onClick={() => onOpenFinancial?.('fines')} className="rounded-2xl border border-[#E7EDF5] p-3 text-left">
                            <p className="text-[12px] font-semibold text-slate-500">Outstanding fines</p>
                            <p className="mt-1 text-[18px] font-bold text-[#B91C1C]">{formatAed(fineOutstanding)}</p>
                        </button>
                        <button type="button" onClick={() => onOpenFinancial?.('utility')} className="rounded-2xl border border-[#E7EDF5] p-3 text-left">
                            <p className="text-[12px] font-semibold text-slate-500">Utility excess</p>
                            <p className="mt-1 text-[18px] font-bold text-[#C2410C]">{formatAed(utilityOutstanding)}</p>
                        </button>
                        <button type="button" onClick={() => onOpenFinancial?.('rewards')} className="rounded-2xl border border-[#E7EDF5] p-3 text-left">
                            <p className="text-[12px] font-semibold text-slate-500">Reward earned</p>
                            <p className="mt-1 text-[18px] font-bold text-[#1B2A4A]">{formatAed(rewardAmount)}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                                {rewardLead ? `${rewardLead.type || 'Reward'} · ${rewardLead.dateLabel || monthRewardLabel}` : `None in ${monthRewardLabel}`}
                            </p>
                        </button>
                    </div>
                    <div className="mt-3 rounded-2xl border border-[#E7EDF5] p-3">
                        <p className="text-[12px] font-semibold text-slate-500">Overtime earned</p>
                        <p className="mt-1 text-[18px] font-bold text-[#1B2A4A]">
                            {salaryLock.locked ? '—' : formatDuration(Math.round(overtime.approvedHours * 60))}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                            {overtime.daysCount} approved day{overtime.daysCount === 1 ? '' : 's'} · Pending {formatDuration(Math.round(overtime.pendingHours * 60))}
                        </p>
                    </div>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-[#E7EDF5]">
                        <div className="flex items-center justify-between px-3 py-2">
                            <p className="text-[13px] font-bold text-[#1B2A4A]">Salary deductions · {formatMonthLabel(monthKey)}</p>
                            <button type="button" onClick={() => onOpenFinancial?.('deductions')} className="text-[11px] font-semibold text-[#2563EB]">
                                View records
                            </button>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">Type</th>
                                    <th className="px-3 py-2 font-semibold">Count</th>
                                    <th className="px-3 py-2 text-right font-semibold">Amount (AED)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deductionRows.map((row) => (
                                    <tr key={row.key} className="border-t border-[#F1F5F9] text-[13px] text-[#1B2A4A]">
                                        <td className="px-3 py-2">{row.type}</td>
                                        <td className="px-3 py-2 tabular-nums">{salaryLock.locked ? '—' : row.count}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {salaryLock.locked || row.amount == null ? '—' : formatAedNumber(row.amount)}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="border-t border-[#E2E8F0] text-[13px] font-bold text-[#1B2A4A]">
                                    <td className="px-3 py-2" colSpan={2}>Total</td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                        {salaryLock.locked ? '—' : formatAedNumber(deductionTotal)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <p className="px-3 py-2 text-[11px] text-slate-400">
                            Leave amounts use monthly salary ÷ 30 and the deduction days on this profile. Late, early, and missed-punch amounts stay on the payslip policy.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="rounded-2xl border border-[#E7EDF5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-[15px] font-bold text-[#1B2A4A]">Leave details</h2>
                                <p className="mt-0.5 text-[12px] text-slate-400">{rangeLabel}</p>
                            </div>
                            <button type="button" onClick={onOpenLeaveList} className="text-[12px] font-semibold text-[#2563EB]">
                                View leave history
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl bg-[#EFF6FF] p-3">
                                <p className="text-[13px] font-bold text-[#1B2A4A]">Annual leave</p>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <MiniMetric label="Requested" value={showValue(activeStats.annual.requested)} />
                                    <MiniMetric label="Approved" value={showValue(activeStats.annual.approved)} />
                                    <MiniMetric label="Used" value={showValue(activeStats.annual.used)} />
                                    <MiniMetric label="Balance" value={annualBalance} />
                                </div>
                            </div>
                            <div className="rounded-2xl bg-[#F0FDF4] p-3">
                                <p className="text-[13px] font-bold text-[#1B2A4A]">Authorized leave</p>
                                <div className="mt-2 grid grid-cols-3 gap-2">
                                    <MiniMetric label="Requested" value={showValue(activeStats.authorized.requested)} />
                                    <MiniMetric label="Approved" value={showValue(activeStats.authorized.approved)} />
                                    <MiniMetric label="Used" value={showValue(activeStats.authorized.used)} />
                                </div>
                            </div>
                            <div className="rounded-2xl bg-[#F5F3FF] p-3">
                                <p className="text-[13px] font-bold text-[#1B2A4A]">Sick leave</p>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <MiniMetric label="Requested" value={showValue(activeStats.sick.requested)} />
                                    <MiniMetric label="Approved" value={showValue(activeStats.sick.approved)} />
                                    <MiniMetric label="Used" value={showValue(activeStats.sick.used)} />
                                    <MiniMetric label="Balance" value={sickRemaining} />
                                </div>
                            </div>
                            <div className="rounded-2xl bg-[#FFF7ED] p-3">
                                <p className="text-[13px] font-bold text-[#1B2A4A]">Comp off</p>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <MiniMetric label="Used" value={showValue(activeStats.compoffUsed)} />
                                    <MiniMetric label="Balance" value={compoffBalance} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#FECACA] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
                        <div className="bg-[#FEF2F2] px-4 py-3">
                            <p className="text-[13px] font-bold text-[#991B1B]">
                                Salary preparation {pending.length ? `blocked · ${pending.length} pending` : 'clear'}
                            </p>
                            <p className="mt-0.5 text-[12px] text-[#B91C1C]">
                                Open queries for this employee that still need a decision
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[36rem] text-left">
                                <thead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    <tr>
                                        <th className="px-3 py-2 font-semibold">#</th>
                                        <th className="px-3 py-2 font-semibold">Pending item</th>
                                        <th className="px-3 py-2 font-semibold">Reference</th>
                                        <th className="px-3 py-2 font-semibold">Status</th>
                                        <th className="px-3 py-2 font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pending.length ? (
                                        pending.map((row, index) => (
                                            <tr key={row.id} className="border-t border-[#F1F5F9] text-[12px] text-[#1B2A4A]">
                                                <td className="px-3 py-2">{index + 1}</td>
                                                <td className="px-3 py-2">
                                                    <p className="font-semibold">{row.title}</p>
                                                    <p className="text-[11px] text-slate-400">{row.subtitle}</p>
                                                </td>
                                                <td className="px-3 py-2">{row.id}</td>
                                                <td className="px-3 py-2">{row.badge || 'Pending'}</td>
                                                <td className="px-3 py-2">
                                                    <button type="button" onClick={onOpenLeaveList} className="font-semibold text-[#2563EB]">
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-slate-400">
                                                No pending queries for this employee.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#E7EDF5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                        <div className="mb-2 flex items-center justify-between">
                            <h2 className="text-[15px] font-bold text-[#1B2A4A]">Pending employee tasks</h2>
                            <span className="text-[12px] font-semibold text-slate-500">
                                {n(profile?.requests?.workTaskPendingCount)} pending
                            </span>
                        </div>
                        {n(profile?.requests?.workTaskPendingCount) ? (
                            <p className="text-[12px] text-slate-500">
                                {n(profile?.requests?.workTaskPendingCount)} assigned task
                                {n(profile?.requests?.workTaskPendingCount) === 1 ? '' : 's'} still open.
                            </p>
                        ) : (
                            <p className="text-[12px] text-slate-400">No pending tasks on this profile.</p>
                        )}
                        <Link
                            href={annualCalendarHref || '/HRM/Leave/annual-leave'}
                            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] text-[13px] font-semibold text-white"
                        >
                            <CalendarDays size={16} />
                            View annual calendar
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
}
