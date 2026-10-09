'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Search, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { notifyAttendancePendingInboxChanged } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';
import { nonHrMarkableDateKeys } from '@/app/HRM/Attendance/utils/nonHrMarkWindow';
import { weekForStaffType } from '@/utils/workLocations';
import MarkAttendanceDetailsModal, {
    getMarkFormConfig,
} from './MarkAttendanceDetailsModal';
import { PunchLocationPinCell, PunchTypeCell } from './MarkAttendancePunchCells';
import FlexibleOtModal from './FlexibleOtModal';
import CompOffSettleModal from '../../components/CompOffSettleModal';

const MARK_OPTIONS = [
    { key: 'on_office', label: 'On work' },
    {
        key: 'on_leave',
        label: 'On leave',
        children: [
            { key: 'sick_leave', label: 'Sick leave' },
            { key: 'authorized_leave', label: 'Authorized leave' },
            { key: 'compoff_leave', label: 'Comp off leave' },
        ],
    },
    { key: 'clear_attendance', label: 'Clear attendance' },
];

function shiftMarks(timeIn, timeOut, timeOutDate, date) {
    const toMinutes = (value) => {
        const parts = String(value || '').split(':').map(Number);
        if (parts.length < 2 || parts.slice(0, 2).some((n) => Number.isNaN(n))) return null;
        return parts[0] * 60 + parts[1];
    };
    const inMin = toMinutes(timeIn);
    const outMin = toMinutes(timeOut);
    if (inMin == null || outMin == null) return { sun: false, moon: false };
    // Same calendar day is a day shift, including late arrival and early go.
    // Night is only a check-out after the next midnight.
    const crossesMidnight = Boolean(timeOutDate && date && timeOutDate !== date) || outMin < inMin;
    if (crossesMidnight) return { sun: false, moon: true };
    return { sun: true, moon: false };
}

function currentEmployeeMongoId() {
    if (typeof window === 'undefined') return '';
    try {
        for (const key of ['employeeUser', 'user']) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const user = JSON.parse(raw);
            const id = user?.employeeObjectId || user?.employeeMongoId || '';
            if (id) return String(id);
        }
    } catch {
        return '';
    }
    return '';
}

function otCellLabel(mark) {
    const status = String(mark?.flexibleOtStatus || '');
    const approved = Number(mark?.flexibleOtApprovedHours) || 0;
    if (status === 'approved') {
        if (approved > 10) return 'Next day';
        return `OT: ${Math.floor(approved + 1e-9)} hr`;
    }
    if (status === 'rejected') return 'OT: 0 hr';
    if (status === 'pending') return 'Pending';
    return '';
}

function formatDisplayTime(value) {
    if (!value) return '—';
    return value;
}

function shortEmployeeName(name) {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return '—';
    if (parts.length === 1) return parts[0];
    const letter = parts[1].charAt(0).toUpperCase();
    return letter ? `${parts[0]} ${letter}` : parts[0];
}

function punchDurationLabel(timeIn, timeOut, timeOutDate, date) {
    const toSeconds = (value) => {
        const text = String(value || '').trim();
        if (!text || text === '—') return null;
        const parts = text.split(':').map(Number);
        if (parts.length < 2 || parts.slice(0, 2).some((n) => Number.isNaN(n))) return null;
        const seconds = parts.length > 2 && !Number.isNaN(parts[2]) ? parts[2] : 0;
        return parts[0] * 3600 + parts[1] * 60 + seconds;
    };
    const start = toSeconds(timeIn);
    const end = toSeconds(timeOut);
    if (start == null || end == null) return '—';
    let diff = end - start;
    const nextDay = Boolean(timeOutDate && date && timeOutDate !== date);
    if (nextDay || diff < 0) diff += 24 * 3600;
    if (diff < 0) return '—';
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

function dubaiDateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function shiftDateKey(dateKey, deltaDays) {
    const [year, month, day] = String(dateKey).split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1, day + deltaDays, 12, 0, 0));
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const HR_ONLY_MARK_TITLE =
    'Only the flowchart HR assignee can mark attendance outside today and the two previous days, including future days. Holidays are skipped.';
const HR_ONLY_CLEAR_TITLE = 'Only the flowchart HR assignee can clear attendance.';
const RECENT_MARK_NOTE =
    'Any status can be marked for today and the two previous days. Holidays are skipped.';

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
    const myIds = [user.employeeObjectId, user.empObjectId, user._id, user.id]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    if (holderId && myIds.includes(holderId)) return true;
    const myEid = String(user.employeeId || '').trim().toLowerCase().replace(/\s+/g, '');
    const hrEid = String(holder.employeeId || '').trim().toLowerCase().replace(/\s+/g, '');
    return Boolean(myEid && hrEid && myEid === hrEid);
}

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function weekdayKeyFromDate(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return '';
    const dayIndex = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
    return WEEKDAY_KEYS[dayIndex] || '';
}

function markForNonWorkingDay(mark, timeIn, timeOut, dayBaseline) {
    const punched =
        (timeIn && timeIn !== '—') || (timeOut && timeOut !== '—');
    const key = String(mark?.key || '').trim();
    const blank = !key || key === 'not_marked' || key === 'absent' || key === 'unauthorized_leave';
    if (!dayBaseline || punched || !blank) return mark;
    if (dayBaseline === 'holiday') {
        return { ...(mark || {}), key: 'holiday', label: 'Holiday', reason: 'Holiday' };
    }
    return { ...(mark || {}), key: 'weekly_off', label: 'Off Day', reason: 'Weekly off' };
}

function formatStatusLabel(mark, timeIn, pastDay = false) {
    const key = String(mark?.key || '').trim();
    const raw = String(mark?.label || '').trim();
    const kind = String(mark?.leaveRequestKind || '').trim();
    const punchedIn = Boolean(timeIn && timeIn !== '—');
    const missedDay = pastDay ? 'Unauth' : 'Absent';

    if (key === 'late_arrived' || /late arrival/i.test(raw)) return 'Present (Late Arrival)';
    if (key === 'early_go' || /early go/i.test(raw)) return 'Present (Early Go)';
    if (key === 'mispunch') return raw || 'Mispunched';
    if (key === 'unauthorized_leave') return 'Unauth';
    if (key === 'authorized_leave') {
        const halfAt = raw.indexOf('·');
        if (halfAt >= 0) return `Auth ${raw.slice(halfAt).trim()}`;
        return 'Auth';
    }
    if (key === 'sick_leave') return raw || 'Sick Leave';
    if (key === 'compoff_leave') return raw || 'Comp Off Leave';
    if (key === 'on_leave' || kind === 'future_annual') {
        if (!raw || /^on leave$/i.test(raw) || /annual/i.test(raw)) return 'Annual';
        return raw;
    }
    if (key === 'work_from_home') return raw || 'Work from home';
    if (key === 'weekly_off') return 'Off Day';
    if (key === 'holiday') return raw || 'Holiday';
    if (!punchedIn && (key === '' || key === 'not_marked' || key === 'absent')) return missedDay;
    if (
        key === 'on_office' ||
        key === 'not_marked' ||
        /^(on time|present|on work|on office)$/i.test(raw)
    ) {
        return 'Present (On time)';
    }
    return raw || missedDay;
}

function statusHoverTitle(statusText) {
    const text = String(statusText || '');
    if (text === 'Unauth') return 'Unauthorized Leave';
    if (text === 'Annual') return 'Annual Leave';
    if (text === 'Auth' || text.startsWith('Auth ')) return text.replace(/^Auth/, 'Authorized Leave');
    return text;
}

function statusChipClass(mark, label) {
    const key = String(mark?.key || '').trim();
    if (
        label === 'Absent' ||
        label === 'Unauth' ||
        label === 'Unauthorized Leave' ||
        key === 'absent' ||
        key === 'unauthorized_leave'
    ) {
        return 'text-rose-700 bg-rose-50';
    }
    if (key === 'on_leave' || /^annual$/i.test(label) || /annual leave/i.test(label)) {
        return 'text-indigo-700 bg-indigo-50';
    }
    if (key === 'authorized_leave') return 'text-orange-700 bg-orange-50';
    if (key === 'compoff_leave') return 'text-violet-700 bg-violet-50';
    if (key === 'weekly_off' || key === 'holiday') return 'text-[#9B59B6] bg-purple-50';
    if (key === 'late_arrived' || key === 'early_go' || key === 'mispunch' || label.startsWith('Present (')) {
        if (label === 'Present (On time)') return 'text-emerald-700 bg-emerald-50';
        return 'text-amber-800 bg-amber-50';
    }
    return 'text-emerald-700 bg-emerald-50';
}

function applyDayRecordsToState(employees, records) {
    const byId = new Map(
        (Array.isArray(records) ? records : []).map((r) => [String(r.employeeMongoId), r]),
    );
    const nextMarks = {};
    const nextEmployees = employees.map((e) => {
        const rec = byId.get(e.id);
        if (!rec) {
            return { ...e, timeIn: '—', timeOut: '—' };
        }
        nextMarks[e.id] = {
            key: rec.statusKey,
            label: rec.statusLabel,
            reason: rec.reason || '',
            attachmentName: rec.attachmentName || '',
            punchSource: rec.punchSource || '',
            checkOutSource: rec.checkOutSource || '',
            checkInLocation: rec.checkInLocation || null,
            checkOutLocation: rec.checkOutLocation || null,
            leaveRequestStatus: rec.leaveRequestStatus || '',
            leaveRequestKind: rec.leaveRequestKind || '',
            approvalStatus: rec.approvalStatus || '',
            attendanceId: String(rec._id || ''),
            date: rec.date || '',
            rawTimeIn: rec.timeIn || '',
            rawTimeOut: rec.timeOut || '',
            timeOutDate: rec.timeOutDate || '',
            flexibleWorkedHours: rec.flexibleWorkedHours || 0,
            flexibleOtHours: rec.flexibleOtHours || 0,
            flexibleOtStatus: rec.flexibleOtStatus || '',
            flexibleOtApprovedHours: rec.flexibleOtApprovedHours || 0,
            flexibleOtReason: rec.flexibleOtReason || '',
            flexibleFromOtDate: rec.flexibleFromOtDate || '',
        };
        return {
            ...e,
            timeIn: rec.timeIn ? formatDisplayTime(rec.timeIn) : '—',
            timeOut: rec.timeOut ? formatDisplayTime(rec.timeOut) : '—',
        };
    });
    return { nextEmployees, nextMarks };
}

function mapActiveEmployee(emp) {
    const id = String(emp?._id || emp?.id || emp?.employeeId || '');
    const name =
        [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim() ||
        emp?.name ||
        emp?.employeeName ||
        '—';
    const empNo = emp?.employeeId || emp?.empNo || emp?.employeeNo || emp?.employeeCode || '—';
    const staffType = String(emp?.staffType || '').trim().toLowerCase() || 'office';
    return {
        id,
        empNo: String(empNo),
        name,
        staffType,
        primaryReportee: String(emp?.primaryReportee || ''),
        timeIn: '—',
        timeOut: '—',
    };
}

function extractEmployeeRows(payload) {
    if (Array.isArray(payload?.employees)) return payload.employees;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    return [];
}

function isActiveEmployee(emp) {
    const profile = String(emp?.profileStatus || '').trim().toLowerCase();
    const status = String(emp?.status || '').trim().toLowerCase();
    return profile === 'active' || status === 'active' || (!profile && !status);
}

function matchesStaffType(emp, staffType) {
    const wanted = String(staffType || 'office').trim().toLowerCase() || 'office';
    const actual = String(emp?.staffType || '').trim().toLowerCase() || 'office';
    return actual === wanted;
}

function employeeMatchesSearch(employee, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    const name = String(employee?.name || '').toLowerCase();
    const empNo = String(employee?.empNo || '').toLowerCase();
    return name.includes(q) || empNo.includes(q);
}

function MarkAttendanceMenu({ anchorRect, onSelect, onClose, options = MARK_OPTIONS }) {
    const [openLeave, setOpenLeave] = useState(false);
    const menuRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });

    useLayoutEffect(() => {
        if (!anchorRect) return;
        const menuWidth = 210;
        const gap = 4;
        let left = anchorRect.right - menuWidth;
        let top = anchorRect.bottom + gap;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        if (top + 220 > window.innerHeight) {
            top = Math.max(8, anchorRect.top - 220 - gap);
        }
        setPos({ top, left });
    }, [anchorRect]);

    useEffect(() => {
        const onDocClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) onClose?.();
        };
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[200px] rounded-lg border border-gray-200 bg-white shadow-lg py-1"
            style={{ top: pos.top, left: pos.left }}
            role="menu"
        >
            {options.map((opt) => {
                if (opt.children?.length) {
                    return (
                        <div
                            key={opt.key}
                            className="relative"
                            onMouseEnter={() => setOpenLeave(true)}
                            onMouseLeave={() => setOpenLeave(false)}
                        >
                            <button
                                type="button"
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => setOpenLeave((v) => !v)}
                            >
                                <span>{opt.label}</span>
                                <ChevronRight size={14} className="text-gray-400 shrink-0" />
                            </button>
                            {openLeave ? (
                                <div className="absolute right-full top-0 mr-0.5 min-w-[190px] rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                                    {opt.children.map((child) => (
                                        <button
                                            key={child.key}
                                            type="button"
                                            role="menuitem"
                                            onClick={() => onSelect(child.key, child.label)}
                                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            {child.label}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    );
                }

                const itemDisabled = Boolean(opt.disabled);
                return (
                    <button
                        key={opt.key}
                        type="button"
                        role="menuitem"
                        disabled={itemDisabled}
                        title={itemDisabled ? opt.disabledTitle || undefined : undefined}
                        onClick={() => {
                            if (itemDisabled) return;
                            onSelect(opt.key, opt.label);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm ${
                            itemDisabled
                                ? 'cursor-not-allowed text-gray-300'
                                : 'hover:bg-gray-50'
                        } ${
                            opt.key === 'clear_attendance'
                                ? 'border-t border-gray-100 mt-0.5'
                                : ''
                        } ${itemDisabled ? '' : opt.key === 'clear_attendance' ? 'text-gray-500' : 'text-gray-700'}`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>,
        document.body,
    );
}

function EmployeeRow({
    index,
    employee,
    checked,
    onToggle,
    mark,
    onRequestMark,
    onRequestOt,
    onSettleCompOff,
    canRequestOt = false,
    otDirect = false,
    canReviewOt = false,
    pastDay = false,
    dayBaseline = '',
    actionLocked = false,
    actionTitle = '',
    menuOptions = MARK_OPTIONS,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [anchorRect, setAnchorRect] = useState(null);
    const buttonRef = useRef(null);

    const openMenu = () => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) setAnchorRect(rect);
        setMenuOpen(true);
    };

    const closeMenu = () => {
        setMenuOpen(false);
        setAnchorRect(null);
    };

    const timeIn = employee.timeIn || '—';
    const timeOut = employee.timeOut || '—';
    const shownMark = markForNonWorkingDay(mark, timeIn, timeOut, dayBaseline);
    const statusText = formatStatusLabel(shownMark, timeIn, pastDay);
    const statusFull = statusHoverTitle(statusText);
    const duration = punchDurationLabel(
        mark?.rawTimeIn || timeIn,
        mark?.rawTimeOut || timeOut,
        mark?.timeOutDate,
        mark?.date,
    );
    const rowLocked = actionLocked;
    const lockTitle = actionLocked ? actionTitle : undefined;

    const shift = shiftMarks(mark?.rawTimeIn, mark?.rawTimeOut, mark?.timeOutDate, mark?.date);
    const otText = otCellLabel(mark);
    const showOtRequest = Number(mark?.flexibleOtHours) > 0 && !otText;
    const nextDayOt = Number(mark?.flexibleOtHours) > 10;

    return (
        <tr className="border-b border-gray-100 hover:bg-slate-50/80 transition-colors">
            <td className="px-3 py-3 align-middle">
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={rowLocked}
                    onChange={() => {
                        if (!rowLocked) onToggle(employee.id);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-[#EA3D2F] focus:ring-[#EA3D2F]/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Select ${employee.name}`}
                />
            </td>
            <td className="px-3 py-3 text-sm text-gray-600 tabular-nums align-middle">{index}</td>
            <td className="px-3 py-3 text-sm font-medium text-gray-900 align-middle whitespace-nowrap" title={employee.name}>
                {shortEmployeeName(employee.name)}
            </td>
            <td className="px-3 py-3 text-sm text-gray-600 tabular-nums align-middle">{employee.empNo}</td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle">{timeIn}</td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle">{timeOut}</td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle whitespace-nowrap">{duration}</td>
            <td className="px-3 py-3 align-middle min-w-[140px]">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                        className={`inline-flex w-fit text-[11px] font-medium px-2 py-1 rounded max-w-full truncate ${statusChipClass(shownMark, statusText)}`}
                        title={[statusFull, mark?.reason].filter(Boolean).join(' — ')}
                    >
                        {statusText}
                    </span>
                    {shownMark?.reason ? (
                        <span className="text-[10px] text-gray-500 max-w-[180px] truncate" title={shownMark.reason}>
                            {shownMark.reason}
                        </span>
                    ) : null}
                    {mark?.key === 'compoff_leave' ? (
                        <button
                            type="button"
                            onClick={() => onSettleCompOff?.(employee)}
                            className="w-fit text-[11px] font-semibold text-violet-700 hover:underline"
                        >
                            Settle comp-off
                        </button>
                    ) : null}
                </div>
            </td>
            <td className="px-3 py-3 align-middle text-center min-w-[88px]">
                <PunchLocationPinCell location={mark?.checkInLocation} time={timeIn} kind="in" />
            </td>
            <td className="px-3 py-3 align-middle text-center min-w-[88px]">
                <PunchLocationPinCell location={mark?.checkOutLocation} time={timeOut} kind="out" />
            </td>
            <td className="px-3 py-3 align-middle min-w-[90px]">
                <PunchTypeCell
                    punchSource={mark?.punchSource}
                    checkOutSource={mark?.checkOutSource}
                    timeOut={timeOut}
                />
            </td>
            <td className="px-3 py-3 align-middle text-center text-base">
                {shift.sun ? <span title="Day shift">☀</span> : null}
                {shift.moon ? <span title="Night shift">☾</span> : null}
                {!shift.sun && !shift.moon ? <span className="text-gray-300">—</span> : null}
            </td>
            <td className="px-3 py-3 align-middle">
                {canReviewOt ? (
                    <button
                        type="button"
                        onClick={() => onRequestOt?.(employee, mark)}
                        className="rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-bold text-blue-700"
                    >
                        Review
                    </button>
                ) : otText ? (
                    <span className="text-xs font-bold text-slate-700">{otText}</span>
                ) : showOtRequest ? (
                    <button
                        type="button"
                        disabled={!canRequestOt}
                        title={
                            canRequestOt
                                ? otDirect
                                    ? nextDayOt
                                        ? 'Mark the next day Present (On time). This day’s overtime is fully used.'
                                        : 'Apply overtime now'
                                    : 'Request overtime for HR approval'
                                : 'Only the primary reportee or flowchart HR can use overtime'
                        }
                        onClick={() => {
                            if (canRequestOt) onRequestOt?.(employee, mark);
                        }}
                        className="rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-bold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {otDirect ? (nextDayOt ? 'Next day present' : 'Apply OT') : 'Req OT'}
                    </button>
                ) : (
                    <span className="text-gray-300">—</span>
                )}
            </td>
            <td className="px-2 py-3 align-middle text-right">
                <div className="relative inline-flex items-center justify-end min-h-[32px]">
                    <button
                        ref={buttonRef}
                        type="button"
                        disabled={rowLocked}
                        title={lockTitle || 'Mark Attendance'}
                        aria-label={`Mark attendance for ${employee.name}`}
                        onClick={() => {
                            if (rowLocked) return;
                            if (menuOpen) closeMenu();
                            else openMenu();
                        }}
                        className="h-7 px-2 rounded-md bg-[#EA3D2F] text-white text-[11px] font-semibold whitespace-nowrap transition-colors hover:bg-[#d43528] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[#EA3D2F]"
                    >
                        Mark
                    </button>
                    {menuOpen && anchorRect ? (
                        <MarkAttendanceMenu
                            anchorRect={anchorRect}
                            options={menuOptions}
                            onClose={closeMenu}
                            onSelect={(key, label) => {
                                closeMenu();
                                onRequestMark(employee, key, label);
                            }}
                        />
                    ) : null}
                </div>
            </td>
        </tr>
    );
}

export default function MarkAttendanceTable({ dateKey, staffType = 'office', otAttendanceId = '' }) {
    const [allEmployees, setAllEmployees] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dayLoading, setDayLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [marks, setMarks] = useState({});
    const [formState, setFormState] = useState(null);
    const [isFlowchartHr, setIsFlowchartHr] = useState(false);
    const [hrReady, setHrReady] = useState(false);
    const [holidayDates, setHolidayDates] = useState([]);
    const [offWeekdays, setOffWeekdays] = useState([]);
    const [holidaysReady, setHolidaysReady] = useState(false);
    const [dayReload, setDayReload] = useState(0);
    const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
    const [bulkAnchorRect, setBulkAnchorRect] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [otModal, setOtModal] = useState(null);
    const [compOffEmployee, setCompOffEmployee] = useState(null);
    const viewerId = useMemo(() => currentEmployeeMongoId(), []);
    const bulkButtonRef = useRef(null);
    const employeesRef = useRef([]);
    const dayRecordsRef = useRef([]);

    useEffect(() => {
        employeesRef.current = employees;
    }, [employees]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await axiosInstance.get('/Flowchart/active-holder/hr', {
                    skipToast: true,
                });
                if (!cancelled) {
                    setIsFlowchartHr(viewerIsDesignatedFlowchartHr(storedViewerUser(), data));
                }
            } catch {
                if (!cancelled) setIsFlowchartHr(false);
            } finally {
                if (!cancelled) setHrReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setHolidaysReady(false);
        const year = Number(dubaiDateKey().slice(0, 4));
        (async () => {
            try {
                const [currentYear, previousYear] = await Promise.all([
                    axiosInstance.get('/Holiday', {
                        params: { year, staffType },
                        skipToast: true,
                    }),
                    axiosInstance.get('/Holiday', {
                        params: { year: year - 1, staffType },
                        skipToast: true,
                    }),
                ]);
                const dates = [currentYear, previousYear].flatMap((res) => {
                    const rows = Array.isArray(res.data?.holidays) ? res.data.holidays : [];
                    return rows.map((row) => String(row?.date || '').trim()).filter(Boolean);
                });
                const timeRes = await axiosInstance.get('/WorkingTime', { skipToast: true });
                const week = weekForStaffType(timeRes.data?.workingTime || timeRes.data || {}, staffType);
                const offs = WEEKDAY_KEYS.filter((key) => Boolean(week?.[key]?.isOffDay));
                if (!cancelled) {
                    setHolidayDates(dates);
                    setOffWeekdays(offs);
                }
            } catch {
                if (!cancelled) {
                    setHolidayDates([]);
                    setOffWeekdays([]);
                }
            } finally {
                if (!cancelled) setHolidaysReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [staffType]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError('');
            try {
                // Lean roster — avoids heavy /Employee aggregation that timed out / lagged.
                const res = await axiosInstance.get('/Attendance/mark-roster', {
                    params: { staffType, date: dateKey },
                    skipToast: true,
                });
                const rows = extractEmployeeRows(res.data)
                    .filter((e) => !/\(company\)\s*$/i.test(
                        `${e?.firstName || ''} ${e?.lastName || ''} ${e?.name || ''}`.trim(),
                    ))
                    .map(mapActiveEmployee)
                    .filter((e) => e.id);
                rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
                if (!cancelled) setAllEmployees(rows);
            } catch (err) {
                if (!cancelled) {
                    setAllEmployees([]);
                    setLoadError(err?.response?.data?.message || 'Could not load active employees.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [staffType, dateKey]);

    // Load stored attendance for the selected day
    useEffect(() => {
        if (loading) return;
        let cancelled = false;

        setSelectedIds(new Set());
        setFormState(null);
        setBulkMenuOpen(false);
        setBulkAnchorRect(null);

        (async () => {
            setDayLoading(true);
            try {
                const res = await axiosInstance.get('/Attendance', {
                    params: { date: dateKey },
                    skipToast: true,
                });
                if (cancelled) return;
                const records = Array.isArray(res.data?.records) ? res.data.records : [];
                dayRecordsRef.current = records;
                // Roster is already filtered by staffType from API
                const { nextEmployees, nextMarks } = applyDayRecordsToState(allEmployees, records);
                setEmployees(nextEmployees);
                setMarks(nextMarks);
                if (otAttendanceId) {
                    const match = nextEmployees.find(
                        (row) => nextMarks[row.id]?.attendanceId === String(otAttendanceId),
                    );
                    if (match && nextMarks[match.id]?.flexibleOtStatus === 'pending') {
                        setOtModal({ employee: match, mark: nextMarks[match.id], mode: 'review' });
                    }
                }
            } catch {
                if (!cancelled) {
                    dayRecordsRef.current = [];
                    setEmployees(allEmployees.map((e) => ({ ...e, timeIn: '—', timeOut: '—' })));
                    setMarks({});
                }
            } finally {
                if (!cancelled) setDayLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [dateKey, loading, allEmployees, dayReload, otAttendanceId]);

    useEffect(() => {
        setSearchQuery('');
    }, [dateKey, staffType]);

    useEffect(() => {
        if (selectedIds.size <= 1) {
            setBulkMenuOpen(false);
            setBulkAnchorRect(null);
        }
    }, [selectedIds.size]);

    const todayKey = dubaiDateKey();
    const earliestMarkKey = shiftDateKey(todayKey, -2);
    const allowedMarkDates = useMemo(
        () => nonHrMarkableDateKeys(todayKey, holidayDates),
        [todayKey, holidayDates],
    );
    const pastDay = Boolean(dateKey) && dateKey < todayKey;
    const dayBaseline = holidayDates.includes(dateKey)
        ? 'holiday'
        : offWeekdays.includes(weekdayKeyFromDate(dateKey))
          ? 'weekly_off'
          : '';
    const windowReady = hrReady && holidaysReady;
    const recentDayOpen = windowReady
        ? allowedMarkDates.has(dateKey)
        : Boolean(dateKey) && dateKey <= todayKey && dateKey >= earliestMarkKey;
    const dayMode = isFlowchartHr || dateKey === todayKey || recentDayOpen ? 'full' : 'locked';
    const baseMenuOptions = MARK_OPTIONS;
    const menuOptions = (
        baseMenuOptions.some((option) => option.key === 'clear_attendance')
            ? baseMenuOptions
            : [...baseMenuOptions, MARK_OPTIONS.find((option) => option.key === 'clear_attendance')]
    ).map((option) =>
        option.key === 'clear_attendance'
            ? {
                  ...option,
                  disabled: !isFlowchartHr,
                  disabledTitle: HR_ONLY_CLEAR_TITLE,
              }
            : option,
    );
    const rowIsActionLocked = () => dayMode === 'locked';
    const filteredEmployees = useMemo(
        () => employees.filter((employee) => employeeMatchesSearch(employee, searchQuery)),
        [employees, searchQuery],
    );
    const filteredIdSet = useMemo(
        () => new Set(filteredEmployees.map((employee) => employee.id)),
        [filteredEmployees],
    );
    const markableEmployees = filteredEmployees.filter((employee) => !rowIsActionLocked(employee));
    const allChecked =
        markableEmployees.length > 0 && markableEmployees.every((employee) => selectedIds.has(employee.id));
    const someChecked =
        markableEmployees.some((employee) => selectedIds.has(employee.id)) && !allChecked;
    const visibleSelectedCount = filteredEmployees.filter((employee) => selectedIds.has(employee.id)).length;
    const showBulkMark = visibleSelectedCount > 1;

    const toggleAll = () => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allChecked) {
                markableEmployees.forEach((employee) => next.delete(employee.id));
                return next;
            }
            markableEmployees.forEach((employee) => next.add(employee.id));
            return next;
        });
    };

    const toggleOne = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const applyMarkToIds = async (ids, payload) => {
        if (dayMode === 'locked') return;
        if (payload?.markKey === 'clear_attendance' && !isFlowchartHr) return;
        const idSet = new Set(ids);
        if (idSet.size === 0) return;
        const { markKey, markLabel, timeIn, timeOut, reason, attachmentName, leavePayType } = payload;
        const isClear = markKey === 'clear_attendance';

        if (isClear) {
            setMarks((prev) => {
                const next = { ...prev };
                idSet.forEach((id) => {
                    delete next[id];
                });
                return next;
            });
            setEmployees((prev) =>
                prev.map((e) => (idSet.has(e.id) ? { ...e, timeIn: '—', timeOut: '—' } : e)),
            );
        } else {
            const optimisticMarks = {};
            idSet.forEach((id) => {
                optimisticMarks[id] = {
                    key: markKey,
                    label: markLabel,
                    reason: reason || '',
                    attachmentName: attachmentName || '',
                    punchSource: 'manual',
                    checkOutSource: timeOut ? 'manual' : '',
                    checkInLocation: null,
                    checkOutLocation: null,
                };
            });

            setMarks((prev) => ({ ...prev, ...optimisticMarks }));
            setEmployees((prev) =>
                prev.map((e) => {
                    if (!idSet.has(e.id)) return e;
                    if (timeIn != null && timeOut != null) {
                        return {
                            ...e,
                            timeIn: formatDisplayTime(timeIn),
                            timeOut: formatDisplayTime(timeOut),
                        };
                    }
                    return { ...e, timeIn: '—', timeOut: '—' };
                }),
            );
        }

        const marksPayload = employeesRef.current
            .filter((e) => idSet.has(e.id))
            .map((e) => ({
                employeeMongoId: e.id,
                employeeId: e.empNo,
                employeeName: e.name,
                statusKey: markKey,
                statusLabel: markLabel,
                timeIn: timeIn != null ? timeIn : '',
                timeOut: timeOut != null ? timeOut : '',
                reason: reason || '',
                attachmentName: attachmentName || '',
                leavePayType: leavePayType || '',
            }));

        setSaving(true);
        try {
            const res = await axiosInstance.post('/Attendance/mark', {
                date: dateKey,
                marks: marksPayload,
            });
            const records = Array.isArray(res.data?.records) ? res.data.records : [];
            if (records.length) {
                const { nextEmployees, nextMarks } = applyDayRecordsToState(
                    employeesRef.current,
                    [
                        ...dayRecordsRef.current.filter(
                            (r) => !idSet.has(String(r.employeeMongoId)),
                        ),
                        ...records.filter((r) => !r.cleared),
                    ],
                );
                dayRecordsRef.current = [
                    ...dayRecordsRef.current.filter((r) => !idSet.has(String(r.employeeMongoId))),
                    ...records.filter((r) => !r.cleared),
                ];
                setEmployees(nextEmployees);
                setMarks(nextMarks);
            }
            notifyAttendancePendingInboxChanged();
        } catch (err) {
            console.error('Failed to save attendance', err);
            // Reload day from server to stay consistent
            try {
                const res = await axiosInstance.get('/Attendance', {
                    params: { date: dateKey },
                    skipToast: true,
                });
                const records = Array.isArray(res.data?.records) ? res.data.records : [];
                dayRecordsRef.current = records;
                const { nextEmployees, nextMarks } = applyDayRecordsToState(
                    employeesRef.current,
                    records,
                );
                setEmployees(nextEmployees);
                setMarks(nextMarks);
            } catch {
                /* ignore */
            }
        } finally {
            setSaving(false);
        }
    };

    const handleRequestMark = (employee, key, label) => {
        if (saving || rowIsActionLocked(employee)) return;
        if (key === 'clear_attendance' && !isFlowchartHr) return;
        const config = getMarkFormConfig(key);
        if (!config) {
            applyMarkToIds([employee.id], {
                markKey: key,
                markLabel: label,
                timeIn: null,
                timeOut: null,
                reason: '',
                attachmentName: '',
            });
            return;
        }
        setFormState({
            mode: 'single',
            employee,
            employeeIds: [employee.id],
            markKey: key,
            markLabel: label,
        });
    };

    const handleBulkRequestMark = (key, label) => {
        if (saving || dayMode === 'locked') return;
        if (key === 'clear_attendance' && !isFlowchartHr) return;
        const ids = Array.from(selectedIds).filter((id) => filteredIdSet.has(id));
        if (ids.length === 0) return;
        const config = getMarkFormConfig(key);
        if (!config) {
            applyMarkToIds(ids, {
                markKey: key,
                markLabel: label,
                timeIn: null,
                timeOut: null,
                reason: '',
                attachmentName: '',
            });
            return;
        }
        setFormState({
            mode: 'bulk',
            employee: null,
            employeeIds: ids,
            markKey: key,
            markLabel: label,
        });
    };

    const openBulkMenu = () => {
        const rect = bulkButtonRef.current?.getBoundingClientRect();
        if (rect) setBulkAnchorRect(rect);
        setBulkMenuOpen(true);
    };

    const closeBulkMenu = () => {
        setBulkMenuOpen(false);
        setBulkAnchorRect(null);
    };

    if (loading) {
        return <div className="py-12 text-center text-sm text-gray-400">Loading active employees…</div>;
    }

    if (loadError) {
        return <div className="py-12 text-center text-sm text-red-500">{loadError}</div>;
    }

    if (employees.length === 0) {
        return (
            <div className="py-12 text-center text-sm text-gray-400">
                No enrolled staff for this date.
            </div>
        );
    }

    return (
        <>
            {dayLoading ? (
                <div className="px-1 pb-2 text-xs text-gray-400">Loading day attendance…</div>
            ) : null}
            {saving ? (
                <div className="px-1 pb-2 text-xs text-gray-400">Saving attendance…</div>
            ) : null}
            {dayMode === 'locked' ? (
                <div className="px-1 pb-2 text-xs text-amber-700">{HR_ONLY_MARK_TITLE}</div>
            ) : null}
            {!isFlowchartHr && dayMode === 'full' && dateKey && dateKey < todayKey ? (
                <div className="px-1 pb-2 text-xs text-slate-500">{RECENT_MARK_NOTE}</div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 pb-3">
                <div className="relative w-full sm:max-w-xs">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search name or emp no"
                        aria-label="Search employees by name or employee number"
                        className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-9 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#EA3D2F]/40 focus:outline-none focus:ring-2 focus:ring-[#EA3D2F]/20"
                    />
                    {searchQuery ? (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            aria-label="Clear search"
                        >
                            <X size={14} />
                        </button>
                    ) : null}
                </div>
                {searchQuery.trim() ? (
                    <p className="text-xs text-gray-500 tabular-nums">
                        {filteredEmployees.length} of {employees.length}
                    </p>
                ) : null}
            </div>

            {showBulkMark ? (
                <div className="flex items-center justify-between gap-3 px-1 pb-3">
                    <p className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-900">{visibleSelectedCount}</span> employees
                        selected
                    </p>
                    <div className="relative">
                        <button
                            ref={bulkButtonRef}
                            type="button"
                            disabled={saving || dayMode === 'locked'}
                            onClick={() => {
                                if (dayMode === 'locked') return;
                                if (bulkMenuOpen) closeBulkMenu();
                                else openBulkMenu();
                            }}
                            className="h-8 px-2.5 rounded-md bg-[#EA3D2F] hover:bg-[#d43528] text-white text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-60"
                        >
                            Mark all
                        </button>
                        {bulkMenuOpen && bulkAnchorRect ? (
                            <MarkAttendanceMenu
                                anchorRect={bulkAnchorRect}
                                options={menuOptions}
                                onClose={closeBulkMenu}
                                onSelect={(key, label) => {
                                    closeBulkMenu();
                                    handleBulkRequestMark(key, label);
                                }}
                            />
                        ) : null}
                    </div>
                </div>
            ) : null}

            <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full min-w-[1040px] border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-3 py-3 text-left w-10" rowSpan={2}>
                                <input
                                    type="checkbox"
                                    checked={allChecked}
                                    ref={(el) => {
                                        if (el) el.indeterminate = someChecked;
                                    }}
                                    onChange={toggleAll}
                                    disabled={dayMode === 'locked' || markableEmployees.length === 0}
                                    className="h-4 w-4 rounded border-gray-300 text-[#EA3D2F] focus:ring-[#EA3D2F]/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label="Select all employees"
                                    title={allChecked ? 'Uncheck all' : 'Check all'}
                                />
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500" rowSpan={2}>
                                Sl No
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500" rowSpan={2}>
                                Emp Name
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500" rowSpan={2}>
                                Emp No
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500" rowSpan={2}>
                                Time In
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500" rowSpan={2}>
                                Time Out
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500" rowSpan={2}>
                                Duration
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500" rowSpan={2}>
                                Status
                            </th>
                            <th className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500 border-l border-gray-200" colSpan={2}>
                                Location
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 border-l border-gray-200" rowSpan={2}>
                                Type
                            </th>
                            <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500" rowSpan={2}>
                                Shift
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500" rowSpan={2}>
                                OT
                            </th>
                            <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500" rowSpan={2}>
                                Action
                            </th>
                        </tr>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-500 border-l border-t border-gray-200">
                                Check-in
                            </th>
                            <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-500 border-t border-gray-200">
                                Check-out
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.length === 0 ? (
                            <tr>
                                <td colSpan={14} className="px-3 py-12 text-center text-sm text-gray-400">
                                    No employees match “{searchQuery.trim()}”.
                                </td>
                            </tr>
                        ) : null}
                        {filteredEmployees.map((employee, index) => (
                            <EmployeeRow
                                key={employee.id}
                                index={index + 1}
                                employee={employee}
                                checked={selectedIds.has(employee.id)}
                                onToggle={toggleOne}
                                mark={marks[employee.id] || null}
                                pastDay={pastDay}
                                dayBaseline={dayBaseline}
                                actionLocked={rowIsActionLocked(employee)}
                                actionTitle={dayMode === 'locked' ? HR_ONLY_MARK_TITLE : ''}
                                menuOptions={menuOptions}
                                onRequestMark={handleRequestMark}
                                canRequestOt={
                                    isFlowchartHr ||
                                    (Boolean(viewerId) &&
                                        viewerId === String(employee.primaryReportee || ''))
                                }
                                otDirect={isFlowchartHr}
                                canReviewOt={
                                    isFlowchartHr &&
                                    String(marks[employee.id]?.flexibleOtStatus || '') === 'pending'
                                }
                                onRequestOt={(row, mark) =>
                                    setOtModal({
                                        employee: row,
                                        mark,
                                        mode:
                                            isFlowchartHr &&
                                            String(mark?.flexibleOtStatus || '') === 'pending'
                                                ? 'review'
                                                : isFlowchartHr
                                                  ? 'direct'
                                                  : 'request',
                                    })
                                }
                                onSettleCompOff={setCompOffEmployee}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            <MarkAttendanceDetailsModal
                open={Boolean(formState)}
                employee={formState?.employee}
                employeeIds={formState?.employeeIds}
                employees={employees}
                markKey={formState?.markKey}
                markLabel={formState?.markLabel}
                dateKey={dateKey}
                staffType={staffType}
                onClose={() => setFormState(null)}
                onMapped={() => setDayReload((value) => value + 1)}
                onSave={(payload) => {
                    const ids = formState?.employeeIds?.length
                        ? formState.employeeIds
                        : formState?.employee?.id
                          ? [formState.employee.id]
                          : [];
                    setFormState(null);
                    if (ids.length) applyMarkToIds(ids, payload);
                }}
            />
            <CompOffSettleModal
                open={Boolean(compOffEmployee)}
                employeeMongoId={compOffEmployee?.id || ''}
                date={dateKey}
                onClose={() => setCompOffEmployee(null)}
                onChanged={() => setDayReload((value) => value + 1)}
            />
            <FlexibleOtModal
                open={Boolean(otModal)}
                mode={otModal?.mode || 'request'}
                employee={otModal?.employee}
                mark={otModal?.mark}
                onClose={() => setOtModal(null)}
                onSaved={() => setDayReload((value) => value + 1)}
            />
        </>
    );
}
