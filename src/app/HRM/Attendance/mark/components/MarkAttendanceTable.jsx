'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import MarkAttendanceDetailsModal, {
    getMarkFormConfig,
} from './MarkAttendanceDetailsModal';

const MARK_OPTIONS = [
    { key: 'work_from_home', label: 'Work from home' },
    { key: 'on_office', label: 'On office' },
    {
        key: 'on_leave',
        label: 'On leave',
        children: [
            { key: 'sick_leave', label: 'Sick leave' },
            { key: 'authorized_leave', label: 'Authorized leave' },
            { key: 'unauthorized_leave', label: 'Unauthorized leave' },
        ],
    },
    { key: 'late_arrived', label: 'Late arrived' },
    { key: 'clear_attendance', label: 'Clear attendance' },
];

function formatDisplayTime(value) {
    if (!value) return '—';
    // HTML time input is HH:mm — show as-is
    return value;
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
    return {
        id,
        empNo: String(empNo),
        name,
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

function MarkAttendanceMenu({ anchorRect, onSelect, onClose }) {
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
            {MARK_OPTIONS.map((opt) => {
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

                return (
                    <button
                        key={opt.key}
                        type="button"
                        role="menuitem"
                        onClick={() => onSelect(opt.key, opt.label)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                            opt.key === 'clear_attendance'
                                ? 'text-gray-500 border-t border-gray-100 mt-0.5'
                                : 'text-gray-700'
                        }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>,
        document.body,
    );
}

function EmployeeRow({ index, employee, checked, onToggle, mark, onRequestMark }) {
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

    return (
        <tr className="border-b border-gray-100 hover:bg-slate-50/80 transition-colors">
            <td className="px-3 py-3 align-middle">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(employee.id)}
                    className="h-4 w-4 rounded border-gray-300 text-[#EA3D2F] focus:ring-[#EA3D2F]/30 cursor-pointer"
                    aria-label={`Select ${employee.name}`}
                />
            </td>
            <td className="px-3 py-3 text-sm text-gray-600 tabular-nums align-middle">{index}</td>
            <td className="px-3 py-3 text-sm font-medium text-gray-900 align-middle">{employee.name}</td>
            <td className="px-3 py-3 text-sm text-gray-600 tabular-nums align-middle">{employee.empNo}</td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle">{timeIn}</td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle">{timeOut}</td>
            <td className="px-3 py-3 align-middle min-w-[140px]">
                {mark?.label ? (
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span
                            className="inline-flex w-fit text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded max-w-full truncate"
                            title={[mark.label, mark.reason].filter(Boolean).join(' — ')}
                        >
                            {mark.label}
                        </span>
                        {mark?.reason ? (
                            <span className="text-[10px] text-gray-500 max-w-[180px] truncate" title={mark.reason}>
                                {mark.reason}
                            </span>
                        ) : null}
                    </div>
                ) : (
                    <span className="text-sm text-gray-400">—</span>
                )}
            </td>
            <td className="px-3 py-3 align-middle text-right min-w-[150px]">
                <div className="relative inline-flex items-center justify-end min-h-[36px]">
                    <button
                        ref={buttonRef}
                        type="button"
                        onClick={() => (menuOpen ? closeMenu() : openMenu())}
                        className="h-8 px-3 rounded-lg bg-[#EA3D2F] hover:bg-[#d43528] text-white text-xs font-semibold whitespace-nowrap transition-colors"
                    >
                        Mark Attendance
                    </button>
                    {menuOpen && anchorRect ? (
                        <MarkAttendanceMenu
                            anchorRect={anchorRect}
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

export default function MarkAttendanceTable({ dateKey }) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dayLoading, setDayLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [marks, setMarks] = useState({});
    const [formState, setFormState] = useState(null);
    const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
    const [bulkAnchorRect, setBulkAnchorRect] = useState(null);
    const bulkButtonRef = useRef(null);
    const employeesRef = useRef([]);

    useEffect(() => {
        employeesRef.current = employees;
    }, [employees]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError('');
            try {
                const res = await axiosInstance.get('/Employee', {
                    params: { profileStatus: 'active', limit: 5000 },
                    skipToast: true,
                });
                const rows = extractEmployeeRows(res.data)
                    .filter(isActiveEmployee)
                    .map(mapActiveEmployee)
                    .filter((e) => e.id);
                rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
                if (!cancelled) setEmployees(rows);
            } catch (err) {
                if (!cancelled) {
                    setEmployees([]);
                    setLoadError(err?.response?.data?.message || 'Could not load active employees.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

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
                const { nextEmployees, nextMarks } = applyDayRecordsToState(
                    employeesRef.current,
                    records,
                );
                setEmployees(nextEmployees);
                setMarks(nextMarks);
            } catch (err) {
                if (cancelled) return;
                // Keep employees list; clear day marks if day fetch fails
                setMarks({});
                setEmployees((prev) =>
                    prev.map((e) => ({
                        ...e,
                        timeIn: '—',
                        timeOut: '—',
                    })),
                );
                console.error('Failed to load day attendance', err);
            } finally {
                if (!cancelled) setDayLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [dateKey, loading]);

    useEffect(() => {
        if (selectedIds.size <= 1) {
            setBulkMenuOpen(false);
            setBulkAnchorRect(null);
        }
    }, [selectedIds.size]);

    const allChecked = employees.length > 0 && selectedIds.size === employees.length;
    const someChecked = selectedIds.size > 0 && selectedIds.size < employees.length;
    const showBulkMark = selectedIds.size > 1;

    const toggleAll = () => {
        if (allChecked) {
            setSelectedIds(new Set());
            return;
        }
        setSelectedIds(new Set(employees.map((e) => e.id)));
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
        const idSet = new Set(ids);
        const { markKey, markLabel, timeIn, timeOut, reason, attachmentName } = payload;
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
            }));

        setSaving(true);
        try {
            await axiosInstance.post('/Attendance/mark', {
                date: dateKey,
                marks: marksPayload,
            });
        } catch (err) {
            console.error('Failed to save attendance', err);
            // Reload day from server to stay consistent
            try {
                const res = await axiosInstance.get('/Attendance', {
                    params: { date: dateKey },
                    skipToast: true,
                });
                const records = Array.isArray(res.data?.records) ? res.data.records : [];
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
        if (saving) return;
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
        if (saving) return;
        const ids = Array.from(selectedIds);
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
        return <div className="py-12 text-center text-sm text-gray-400">No active employees found.</div>;
    }

    return (
        <>
            {dayLoading ? (
                <div className="px-1 pb-2 text-xs text-gray-400">Loading day attendance…</div>
            ) : null}
            {saving ? (
                <div className="px-1 pb-2 text-xs text-gray-400">Saving attendance…</div>
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
                            disabled={saving}
                            onClick={() => (bulkMenuOpen ? closeBulkMenu() : openBulkMenu())}
                            className="h-9 px-4 rounded-lg bg-[#EA3D2F] hover:bg-[#d43528] text-white text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-60"
                        >
                            Mark Attendance All
                        </button>
                        {bulkMenuOpen && bulkAnchorRect ? (
                            <MarkAttendanceMenu
                                anchorRect={bulkAnchorRect}
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
                <table className="w-full min-w-[900px] border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-3 py-3 text-left w-10">
                                <input
                                    type="checkbox"
                                    checked={allChecked}
                                    ref={(el) => {
                                        if (el) el.indeterminate = someChecked;
                                    }}
                                    onChange={toggleAll}
                                    className="h-4 w-4 rounded border-gray-300 text-[#EA3D2F] focus:ring-[#EA3D2F]/30 cursor-pointer"
                                    aria-label="Select all employees"
                                    title={allChecked ? 'Uncheck all' : 'Check all'}
                                />
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                Sl No
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                Emp Name
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                Emp No
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                Time In
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                Time Out
                            </th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                Status
                            </th>
                            <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                Action
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
                markKey={formState?.markKey}
                markLabel={formState?.markLabel}
                onClose={() => setFormState(null)}
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
