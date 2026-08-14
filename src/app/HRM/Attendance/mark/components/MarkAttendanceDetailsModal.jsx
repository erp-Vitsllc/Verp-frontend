'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Paperclip, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';

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
        const category = staffType === 'site' ? 'site' : 'office';
        const week = workingTime[category] || {};
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

export default function MarkAttendanceDetailsModal({
    open,
    employee,
    employeeIds = null,
    markKey,
    markLabel,
    dateKey = '',
    staffType = 'office',
    onClose,
    onSave,
}) {
    const config = getMarkFormConfig(markKey);
    const [timeIn, setTimeIn] = useState('');
    const [timeOut, setTimeOut] = useState('');
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [error, setError] = useState('');
    const fileRef = useRef(null);
    const bulkCount = Array.isArray(employeeIds) ? employeeIds.length : 0;
    const isBulk = bulkCount > 1;
    const resolvedStaffType =
        employee?.staffType === 'site' || employee?.staffType === 'office'
            ? employee.staffType
            : staffType === 'site'
              ? 'site'
              : 'office';

    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        setReason('');
        setAttachment(null);
        setError('');
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
        </div>,
        document.body,
    );
}
