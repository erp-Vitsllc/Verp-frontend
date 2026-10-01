'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { notifyAttendancePendingInboxChanged } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';
import MarkAttendanceDetailsModal, {
    getMarkFormConfig,
} from './MarkAttendanceDetailsModal';
import { PunchLocationPinCell, PunchTypeCell } from './MarkAttendancePunchCells';

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

function formatDisplayTime(value) {
    if (!value) return '—';
    // HTML time input is HH:mm — show as-is
    return value;
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
    'Only the flowchart HR assignee can mark attendance more than 2 days ago.';
const HR_ONLY_CLEAR_TITLE = 'Only the flowchart HR assignee can clear attendance.';
const ABSENT_ONLY_MARK_TITLE =
    'Only absent attendance from the last 2 days can be changed to Authorized leave or marked present.';

const NON_HR_RECENT_ABSENT_OPTIONS = [
    { key: 'on_office', label: 'On work' },
    { key: 'authorized_leave', label: 'Authorized leave' },
];

function isAbsentMark(mark, timeIn) {
    const key = String(mark?.key || '').trim();
    const punched = Boolean(timeIn && timeIn !== '—');
    if (key === 'unauthorized_leave') return true;
    if (!key || key === 'not_marked' || key === 'absent') return !punched;
    return false;
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
    const myIds = [user.employeeObjectId, user.empObjectId, user._id, user.id]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    if (holderId && myIds.includes(holderId)) return true;
    const myEid = String(user.employeeId || '').trim().toLowerCase().replace(/\s+/g, '');
    const hrEid = String(holder.employeeId || '').trim().toLowerCase().replace(/\s+/g, '');
    return Boolean(myEid && hrEid && myEid === hrEid);
}

const APPROVED_LEAVE_KEYS = new Set([
    'on_leave',
    'authorized_leave',
    'sick_leave',
    'compoff_leave',
]);

function isApprovedLeaveMark(mark) {
    if (!mark) return false;
    if (String(mark.leaveRequestStatus || '').trim() !== 'approved') return false;
    return APPROVED_LEAVE_KEYS.has(String(mark.key || '').trim());
}

function formatStatusLabel(mark, timeIn, pastDay = false) {
    const key = String(mark?.key || '').trim();
    const raw = String(mark?.label || '').trim();
    const kind = String(mark?.leaveRequestKind || '').trim();
    const punchedIn = Boolean(timeIn && timeIn !== '—');
    const missedDay = pastDay ? 'Unauthorized Leave' : 'Absent';

    if (key === 'late_arrived' || /late arrival/i.test(raw)) return 'Present (Late Arrival)';
    if (key === 'early_go' || /early go/i.test(raw)) return 'Present (Early Go)';
    if (key === 'mispunch') return raw || 'Mispunched';
    if (key === 'unauthorized_leave') return raw || 'Unauthorized Leave';
    if (key === 'authorized_leave') return raw || 'Authorized Leave';
    if (key === 'sick_leave') return raw || 'Sick Leave';
    if (key === 'compoff_leave') return raw || 'Comp Off Leave';
    if (key === 'on_leave' || kind === 'future_annual') {
        if (!raw || /^on leave$/i.test(raw) || /annual/i.test(raw)) return 'Annual Leave';
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

function statusChipClass(mark, label) {
    const key = String(mark?.key || '').trim();
    if (
        label === 'Absent' ||
        label === 'Unauthorized Leave' ||
        key === 'absent' ||
        key === 'unauthorized_leave'
    ) {
        return 'text-rose-700 bg-rose-50';
    }
    if (key === 'on_leave' || /annual leave/i.test(label)) return 'text-indigo-700 bg-indigo-50';
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
    pastDay = false,
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
    const statusText = formatStatusLabel(mark, timeIn, pastDay);
    const leaveLocked = isApprovedLeaveMark(mark);
    const rowLocked = leaveLocked || actionLocked;
    const lockTitle = leaveLocked
        ? `${statusText} is approved for this day`
        : actionLocked
          ? actionTitle
          : undefined;

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
            <td className="px-3 py-3 text-sm font-medium text-gray-900 align-middle">{employee.name}</td>
            <td className="px-3 py-3 text-sm text-gray-600 tabular-nums align-middle">{employee.empNo}</td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle">{timeIn}</td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle">{timeOut}</td>
            <td className="px-3 py-3 align-middle min-w-[140px]">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                        className={`inline-flex w-fit text-[11px] font-medium px-2 py-1 rounded max-w-full truncate ${statusChipClass(mark, statusText)}`}
                        title={[statusText, mark?.reason].filter(Boolean).join(' — ')}
                    >
                        {statusText}
                    </span>
                    {mark?.reason ? (
                        <span className="text-[10px] text-gray-500 max-w-[180px] truncate" title={mark.reason}>
                            {mark.reason}
                        </span>
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
            <td className="px-3 py-3 align-middle text-right min-w-[150px]">
                <div className="relative inline-flex items-center justify-end min-h-[36px]">
                    <button
                        ref={buttonRef}
                        type="button"
                        disabled={rowLocked}
                        title={lockTitle}
                        onClick={() => {
                            if (rowLocked) return;
                            if (menuOpen) closeMenu();
                            else openMenu();
                        }}
                        className="h-8 px-3 rounded-lg bg-[#EA3D2F] text-white text-xs font-semibold whitespace-nowrap transition-colors hover:bg-[#d43528] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[#EA3D2F]"
                    >
                        Mark Attendance
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

export default function MarkAttendanceTable({ dateKey, staffType = 'office' }) {
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
    const [dayReload, setDayReload] = useState(0);
    const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
    const [bulkAnchorRect, setBulkAnchorRect] = useState(null);
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
    }, [dateKey, loading, allEmployees, dayReload]);

    useEffect(() => {
        if (selectedIds.size <= 1) {
            setBulkMenuOpen(false);
            setBulkAnchorRect(null);
        }
    }, [selectedIds.size]);

    const todayKey = dubaiDateKey();
    const earliestMarkKey = shiftDateKey(todayKey, -2);
    const pastDay = Boolean(dateKey) && dateKey < todayKey;
    const dayMode = isFlowchartHr
        ? 'full'
        : !hrReady && dateKey < earliestMarkKey
          ? 'locked'
          : dateKey === todayKey
            ? 'full'
            : dateKey >= earliestMarkKey && dateKey < todayKey
              ? 'absent-only'
              : 'locked';
    const baseMenuOptions =
        dayMode === 'absent-only' ? NON_HR_RECENT_ABSENT_OPTIONS : MARK_OPTIONS;
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
    const rowIsActionLocked = (employee) => {
        if (dayMode === 'locked') return true;
        if (dayMode === 'absent-only') {
            return !isAbsentMark(marks[employee.id], employee.timeIn);
        }
        return false;
    };
    const markableEmployees = employees.filter(
        (employee) => !isApprovedLeaveMark(marks[employee.id]) && !rowIsActionLocked(employee),
    );
    const allChecked = markableEmployees.length > 0 && selectedIds.size === markableEmployees.length;
    const someChecked = selectedIds.size > 0 && selectedIds.size < markableEmployees.length;
    const showBulkMark = selectedIds.size > 1;

    const toggleAll = () => {
        if (allChecked) {
            setSelectedIds(new Set());
            return;
        }
        setSelectedIds(new Set(markableEmployees.map((e) => e.id)));
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
        const allowedRecentKey =
            payload?.markKey === 'on_office' || payload?.markKey === 'authorized_leave';
        const idSet = new Set(
            ids.filter((id) => {
                if (isApprovedLeaveMark(marks[id])) return false;
                if (dayMode !== 'absent-only') return true;
                if (!allowedRecentKey) return false;
                const employee = employeesRef.current.find((row) => row.id === id);
                return isAbsentMark(marks[id], employee?.timeIn);
            }),
        );
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
        if (saving || isApprovedLeaveMark(marks[employee.id]) || rowIsActionLocked(employee)) return;
        if (key === 'clear_attendance' && !isFlowchartHr) return;
        if (
            dayMode === 'absent-only' &&
            key !== 'on_office' &&
            key !== 'authorized_leave'
        ) {
            return;
        }
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
        if (
            dayMode === 'absent-only' &&
            key !== 'on_office' &&
            key !== 'authorized_leave'
        ) {
            return;
        }
        const ids = Array.from(selectedIds).filter((id) => {
            if (isApprovedLeaveMark(marks[id])) return false;
            if (dayMode !== 'absent-only') return true;
            const employee = employees.find((row) => row.id === id);
            return isAbsentMark(marks[id], employee?.timeIn);
        });
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
            {dayMode === 'absent-only' ? (
                <div className="px-1 pb-2 text-xs text-slate-500">
                    Absent attendance from the last 2 days can be set to Authorized leave or marked present.
                </div>
            ) : null}

            {showBulkMark ? (
                <div className="flex items-center justify-between gap-3 px-1 pb-3">
                    <p className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-900">{selectedIds.size}</span> employees
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
                            className="h-9 px-4 rounded-lg bg-[#EA3D2F] hover:bg-[#d43528] text-white text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-60"
                        >
                            Mark Attendance All
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
                                Status
                            </th>
                            <th className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500 border-l border-gray-200" colSpan={2}>
                                Location
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 border-l border-gray-200" rowSpan={2}>
                                Type
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
                        {employees.map((employee, index) => (
                            <EmployeeRow
                                key={employee.id}
                                index={index + 1}
                                employee={employee}
                                checked={selectedIds.has(employee.id)}
                                onToggle={toggleOne}
                                mark={marks[employee.id] || null}
                                pastDay={pastDay}
                                actionLocked={rowIsActionLocked(employee)}
                                actionTitle={
                                    dayMode === 'locked' ? HR_ONLY_MARK_TITLE : ABSENT_ONLY_MARK_TITLE
                                }
                                menuOptions={menuOptions}
                                onRequestMark={handleRequestMark}
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
        </>
    );
}
