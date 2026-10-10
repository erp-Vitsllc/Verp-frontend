'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Paperclip, X } from 'lucide-react';
import Select from 'react-select';
import axiosInstance from '@/utils/axios';
import { weekForStaffType, normalizeWorkLocationKey } from '@/utils/workLocations';

const WEEKDAY_KEYS = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
];

/** Field rules per mark type. */
export function getMarkFormConfig(markKey) {
    if (markKey === 'work_from_home' || markKey === 'on_office') {
        return {
            showTimes: true,
            showReason: false,
            showAttachment: false,
            timesRequired: true,
            reasonOptional: true,
            useWorkingTimeDefaults: true,
        };
    }
    if (markKey === 'late_arrived') {
        return {
            showTimes: true,
            showReason: true,
            showAttachment: false,
            timesRequired: true,
            reasonOptional: true,
            useWorkingTimeDefaults: false,
        };
    }
    if (
        markKey === 'sick_leave' ||
        markKey === 'compoff_leave' ||
        markKey === 'authorized_leave' ||
        markKey === 'unauthorized_leave' ||
        markKey === 'on_leave'
    ) {
        return {
            showTimes: false,
            showReason: true,
            showAttachment: true,
            timesRequired: false,
            reasonOptional: true,
            useWorkingTimeDefaults: false,
        };
    }
    return null;
}

/** Convert Flowchart HR 12h schedule fields → HTML time input `HH:mm`. */
function scheduleToHHmm(hour, minute, meridiem) {
    let h = Number.parseInt(String(hour || '9'), 10);
    if (!Number.isFinite(h) || h < 1 || h > 12) h = 9;
    const m = String(minute || '00').padStart(2, '0').slice(0, 2);
    const mer = String(meridiem || 'AM').toUpperCase() === 'PM' ? 'PM' : 'AM';
    if (mer === 'AM') {
        if (h === 12) h = 0;
    } else if (h !== 12) {
        h += 12;
    }
    return `${String(h).padStart(2, '0')}:${m}`;
}

function weekdayKeyFromDateKey(dateKey) {
    const date = String(dateKey || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    // Noon UTC keeps calendar day stable for Asia/Dubai (matches backend).
    const dayIndex = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    return WEEKDAY_KEYS[dayIndex] || null;
}

async function loadDefaultPunchTimes({ dateKey, staffType }) {
    const dayKey = weekdayKeyFromDateKey(dateKey);
    if (!dayKey) return { timeIn: '', timeOut: '' };

    try {
        const res = await axiosInstance.get('/WorkingTime', { skipToast: true });
        const workingTime = res.data?.workingTime || {};
        const week = weekForStaffType(workingTime, staffType);
        if (String(week?.timingMode || '').toLowerCase() === 'flexible') {
            return { timeIn: '', timeOut: '' };
        }
        const day = week[dayKey] || {};
        return {
            timeIn: scheduleToHHmm(day.startHour, day.startMinute, day.startMeridiem),
            timeOut: scheduleToHHmm(day.endHour, day.endMinute, day.endMeridiem),
        };
    } catch {
        return {
            timeIn: scheduleToHHmm('09', '00', 'AM'),
            timeOut: scheduleToHHmm('06', '00', 'PM'),
        };
    }
}

const mapSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: 10,
        borderColor: state.isFocused ? '#EA3D2F' : '#e5e7eb',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(234, 61, 47, 0.2)' : 'none',
        '&:hover': { borderColor: '#d1d5db' },
    }),
    menu: (base) => ({ ...base, borderRadius: 10, zIndex: 10060 }),
    menuPortal: (base) => ({ ...base, zIndex: 10060 }),
    option: (base, state) => ({
        ...base,
        fontSize: 13,
        backgroundColor: state.isSelected ? '#EA3D2F' : state.isFocused ? '#fff1f0' : 'white',
        color: state.isSelected ? 'white' : '#111827',
    }),
    singleValue: (base) => ({ ...base, fontSize: 13 }),
    placeholder: (base) => ({ ...base, fontSize: 13, color: '#9ca3af' }),
};

export default function MarkAttendanceDetailsModal({
    open,
    employee,
    employeeIds = null,
    employees = [],
    markKey,
    markLabel,
    dateKey = '',
    staffType = 'office',
    onClose,
    onSave,
    onMapped,
}) {
    const config = getMarkFormConfig(markKey);
    const [timeIn, setTimeIn] = useState('');
    const [timeOut, setTimeOut] = useState('');
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [error, setError] = useState('');
    const [mapOpen, setMapOpen] = useState(false);
    const [mapEmployeeId, setMapEmployeeId] = useState('');
    const [mapError, setMapError] = useState('');
    const [mapNotice, setMapNotice] = useState('');
    const [mapSaving, setMapSaving] = useState(false);
    const fileRef = useRef(null);
    const bulkCount = Array.isArray(employeeIds) ? employeeIds.length : 0;
    const isBulk = bulkCount > 1;
    const resolvedStaffType = normalizeWorkLocationKey(employee?.staffType || staffType);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        setReason('');
        setAttachment(null);
        setError('');
        setMapOpen(false);
        setMapEmployeeId('');
        setMapError('');
        setMapNotice('');
        setMapSaving(false);
        if (fileRef.current) fileRef.current.value = '';

        const needsDefaults = Boolean(config?.useWorkingTimeDefaults);

        if (!needsDefaults) {
            setTimeIn('');
            setTimeOut('');
            return () => {
                cancelled = true;
            };
        }

        setTimeIn('');
        setTimeOut('');
        (async () => {
            const defaults = await loadDefaultPunchTimes({
                dateKey,
                staffType: resolvedStaffType,
            });
            if (cancelled) return;
            setTimeIn(defaults.timeIn || '');
            setTimeOut(defaults.timeOut || '');
        })();

        return () => {
            cancelled = true;
        };
    }, [
        open,
        markKey,
        employee?.id,
        bulkCount,
        dateKey,
        resolvedStaffType,
        config?.useWorkingTimeDefaults,
    ]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const mapOptions = useMemo(
        () =>
            (Array.isArray(employees) ? employees : [])
                .filter((row) => row?.id && String(row.id) !== String(employee?.id || ''))
                .map((row) => ({
                    value: row.id,
                    label: `${row.name || 'Employee'}${row.empNo ? ` (${row.empNo})` : ''}`,
                })),
        [employees, employee?.id],
    );
    const selectedMapOption = mapOptions.find((option) => option.value === mapEmployeeId) || null;

    const handleMap = async () => {
        if (!employee?.id || !mapEmployeeId || !dateKey) {
            setMapError('Select an employee.');
            return;
        }
        setMapSaving(true);
        setMapError('');
        try {
            const res = await axiosInstance.post(
                '/Attendance/map-punch',
                {
                    date: dateKey,
                    targetEmployeeMongoId: employee.id,
                    sourceEmployeeMongoId: mapEmployeeId,
                },
                { skipToast: true },
            );
            const pending = Array.isArray(res.data?.pending) ? res.data.pending : [];
            onMapped?.();
            if (pending.length) {
                setMapNotice(
                    res.data?.message || 'Sent for approval. Attendance stays unchanged until HR approves.',
                );
                return;
            }
            setMapNotice('');
            setMapOpen(false);
        } catch (err) {
            setMapError(err?.response?.data?.message || 'Could not map this employee.');
        } finally {
            setMapSaving(false);
        }
    };

    if (!open || !config || typeof document === 'undefined') return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (config.showTimes && config.timesRequired) {
            if (!timeIn || !timeOut) {
                setError('Please enter Time In and Time Out.');
                return;
            }
        }
        onSave?.({
            markKey,
            markLabel,
            timeIn: config.showTimes ? timeIn : null,
            timeOut: config.showTimes ? timeOut : null,
            reason: config.showReason ? reason.trim() : '',
            attachmentName: attachment?.name || '',
            attachmentFile: attachment || null,
            leavePayType: '',
        });
    };

    const subtitle = isBulk
        ? `Applying to ${bulkCount} selected employees`
        : [employee?.name, employee?.empNo].filter(Boolean).join(' · ');

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Close"
                onClick={onClose}
            />
            <div
                role="dialog"
                aria-modal="true"
                className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200"
            >
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-900">{markLabel}</h2>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                    {config.showTimes ? (
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    Time In
                                </span>
                                <input
                                    type="time"
                                    value={timeIn}
                                    onChange={(e) => setTimeIn(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#EA3D2F]/25 focus:border-[#EA3D2F]"
                                    required={config.timesRequired}
                                />
                            </label>
                            <label className="block">
                                <span className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    Time Out
                                </span>
                                <input
                                    type="time"
                                    value={timeOut}
                                    onChange={(e) => setTimeOut(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#EA3D2F]/25 focus:border-[#EA3D2F]"
                                    required={config.timesRequired}
                                />
                            </label>
                            {config.useWorkingTimeDefaults ? (
                                <p className="col-span-2 text-[11px] text-gray-400">
                                    Defaults from Flowchart HR Working Time (
                                    {resolvedStaffType === 'site' ? 'Site' : 'Office'}) — editable.
                                </p>
                            ) : null}
                        </div>
                    ) : null}

                    {config.showReason ? (
                        <label className="block">
                            <span className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Reason
                                {config.reasonOptional ? (
                                    <span className="font-normal text-gray-400"> (optional)</span>
                                ) : null}
                            </span>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                placeholder="Enter reason…"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#EA3D2F]/25 focus:border-[#EA3D2F] resize-y min-h-[80px]"
                            />
                        </label>
                    ) : null}

                    {config.showAttachment ? (
                        <div>
                            <span className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Attachment{' '}
                                <span className="font-normal text-gray-400">(optional)</span>
                            </span>
                            <input
                                ref={fileRef}
                                type="file"
                                className="hidden"
                                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    <Paperclip size={14} className="text-gray-500" />
                                    {attachment ? 'Change file' : 'Choose file'}
                                </button>
                                {attachment ? (
                                    <span className="text-xs text-gray-600 truncate max-w-[12rem]">
                                        {attachment.name}
                                    </span>
                                ) : (
                                    <span className="text-xs text-gray-400">No file selected</span>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {error ? <p className="text-sm text-red-500">{error}</p> : null}

                    <div className="flex items-center justify-end gap-2 pt-1">
                        {markKey === 'on_office' && !isBulk ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setMapError('');
                                    setMapOpen(true);
                                }}
                                className="h-9 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Map with other user
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="h-9 px-4 rounded-lg bg-[#EA3D2F] hover:bg-[#d43528] text-white text-sm font-semibold"
                        >
                            {isBulk ? `Save for ${bulkCount}` : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
            {mapOpen ? (
                <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/40"
                        aria-label="Close"
                        onClick={() => {
                            if (!mapSaving) setMapOpen(false);
                        }}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200"
                    >
                        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
                            <div className="min-w-0">
                                <h2 className="text-base font-semibold text-gray-900">Map with other user</h2>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Copy this day’s check-in, check-out, and location onto{' '}
                                    {employee?.name || 'this employee'}. A later check-out on the
                                    selected employee is copied here for this day only.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!mapSaving) setMapOpen(false);
                                }}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                                aria-label="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-4">
                            <label className="block">
                                <span className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    Employee
                                </span>
                                <Select
                                    instanceId="mark-attendance-map-employee"
                                    options={mapOptions}
                                    value={selectedMapOption}
                                    onChange={(option) => {
                                        setMapEmployeeId(option?.value || '');
                                        setMapError('');
                                    }}
                                    placeholder="Select employee"
                                    isSearchable
                                    styles={mapSelectStyles}
                                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                    menuPosition="fixed"
                                />
                            </label>
                            {mapNotice ? <p className="text-sm text-amber-700">{mapNotice}</p> : null}
                            {mapError ? <p className="text-sm text-red-500">{mapError}</p> : null}
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    disabled={mapSaving}
                                    onClick={() => setMapOpen(false)}
                                    className="h-9 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={mapSaving || !mapEmployeeId}
                                    onClick={handleMap}
                                    className="h-9 px-4 rounded-lg bg-[#EA3D2F] hover:bg-[#d43528] text-white text-sm font-semibold disabled:opacity-50"
                                >
                                    {mapSaving ? 'Mapping…' : 'Map'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>,
        document.body,
    );
}
