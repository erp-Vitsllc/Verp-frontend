'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';

const SLOT_STEP_MINUTES = 30;
const DEFAULT_START_MINUTES = 9 * 60;
const DEFAULT_END_MINUTES = 18 * 60;

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DAY_PART_OPTIONS = [
    { key: 'full', label: 'Full day' },
    { key: 'half', label: 'Half day' },
];

function weekdayKeyFromDateKey(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
    return WEEKDAY_KEYS[new Date(`${dateKey}T12:00:00.000Z`).getUTCDay()] || null;
}

/** Flowchart working time stores 12h parts (startHour/startMinute/startMeridiem). */
function dayPartToMinutes(day, which) {
    if (!day) return null;
    const isStart = which === 'start';
    let hour = Number(isStart ? day.startHour : day.endHour);
    const minute = Number(isStart ? day.startMinute : day.endMinute);
    const meridiem = String((isStart ? day.startMeridiem : day.endMeridiem) || 'AM').toUpperCase();
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    return hour * 60 + minute;
}

function resolveShift(scheduleWeek, dateKey) {
    const day = scheduleWeek?.[weekdayKeyFromDateKey(dateKey)] || null;
    const start = dayPartToMinutes(day, 'start');
    const end = dayPartToMinutes(day, 'end');
    if (start == null || end == null || end <= start) {
        return { startMinutes: DEFAULT_START_MINUTES, endMinutes: DEFAULT_END_MINUTES };
    }
    return { startMinutes: start, endMinutes: end };
}

function minutesToClock(minutes) {
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return `${h}:${m}`;
}

function minutesToLabel(minutes) {
    const hour24 = Math.floor(minutes / 60);
    const meridiem = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${String(minutes % 60).padStart(2, '0')} ${meridiem}`;
}

function clockToMinutes(clock) {
    const [h, m] = String(clock || '')
        .split(':')
        .map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
}

export default function AttendanceFutureRequestModal({
    isOpen,
    dateKey,
    earliestDate = '',
    scheduleWeek = null,
    submitting = false,
    error = '',
    heading = 'Request for a future day',
    eyebrow = '',
    icon = null,
    onClose,
    onSubmit,
}) {
    const fileRef = useRef(null);
    const [fromDate, setFromDate] = useState(dateKey || '');
    const [toDate, setToDate] = useState(dateKey || '');
    const [dayPart, setDayPart] = useState('full');
    const [timeIn, setTimeIn] = useState('');
    const [timeOut, setTimeOut] = useState('');
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [localError, setLocalError] = useState('');

    const shift = useMemo(
        () => resolveShift(scheduleWeek, fromDate || dateKey),
        [scheduleWeek, fromDate, dateKey],
    );

    const slots = useMemo(() => {
        const out = [];
        for (let m = shift.startMinutes; m <= shift.endMinutes; m += SLOT_STEP_MINUTES) {
            out.push({ value: minutesToClock(m), label: minutesToLabel(m), minutes: m });
        }
        return out;
    }, [shift]);

    useEffect(() => {
        if (!isOpen) return;
        setFromDate(dateKey || '');
        setToDate(dateKey || '');
        setDayPart('full');
        setReason('');
        setAttachment(null);
        setLocalError('');
    }, [isOpen, dateKey]);

    // Shift hours are the source of truth for the half-day window, same as the Check In / Out card.
    useEffect(() => {
        if (!isOpen) return;
        setTimeIn(minutesToClock(shift.startMinutes));
        setTimeOut(minutesToClock(shift.endMinutes));
    }, [isOpen, shift.startMinutes, shift.endMinutes]);

    if (!isOpen) return null;

    const timeInMinutes = clockToMinutes(timeIn);
    const isHalfDay = dayPart === 'half';
    // Half day means part of a working day is missed, which the calendar tracks as a late arrival.
    const requestKind = isHalfDay ? 'late_arrived' : 'leave';
    const requestTypeLabel = isHalfDay ? 'Late arrival' : 'Authorized Leave';

    const handleClose = () => {
        if (submitting) return;
        onClose?.();
    };

    const handleFromDateChange = (value) => {
        setFromDate(value);
        setLocalError('');
        if (value && toDate && value > toDate) setToDate(value);
    };

    const handleTimeInChange = (value) => {
        setTimeIn(value);
        setLocalError('');
        const nextIn = clockToMinutes(value);
        const currentOut = clockToMinutes(timeOut);
        if (nextIn != null && (currentOut == null || currentOut <= nextIn)) {
            const nextSlot = slots.find((slot) => slot.minutes > nextIn);
            setTimeOut(nextSlot ? nextSlot.value : '');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!fromDate || !toDate) {
            setLocalError('Choose a from and to date.');
            return;
        }
        if (toDate < fromDate) {
            setLocalError('To date cannot be before the from date.');
            return;
        }
        if (earliestDate && fromDate < earliestDate) {
            setLocalError(`The earliest date you can request is ${earliestDate}.`);
            return;
        }
        if (isHalfDay) {
            const inMinutes = clockToMinutes(timeIn);
            const outMinutes = clockToMinutes(timeOut);
            if (inMinutes == null || outMinutes == null) {
                setLocalError('Choose a time in and time out for the half day.');
                return;
            }
            if (outMinutes <= inMinutes) {
                setLocalError('Time out must be after time in.');
                return;
            }
        }
        const trimmed = String(reason || '').trim();
        if (!trimmed) {
            setLocalError('Description is required.');
            return;
        }
        if (!attachment?.name) {
            setLocalError('Attachment is required.');
            return;
        }
        setLocalError('');
        onSubmit?.({
            kind: requestKind,
            fromDate,
            toDate,
            dayPart,
            timeIn: isHalfDay ? timeIn : '',
            timeOut: isHalfDay ? timeOut : '',
            reason: trimmed,
            attachmentName: attachment.name,
        });
    };

    const fieldClass =
        'w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 disabled:opacity-60';
    const labelClass =
        'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2';

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
                aria-label="Close"
                onClick={handleClose}
                disabled={submitting}
            />
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200/80">
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                        {icon}
                        <div className="min-w-0">
                            {eyebrow ? (
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    {eyebrow}
                                </p>
                            ) : null}
                            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                                {heading}
                            </h2>
                            {!eyebrow && dateKey ? (
                                <p className="text-sm text-slate-500 mt-1">{dateKey}</p>
                            ) : null}
                            {earliestDate ? (
                                <p className="text-xs text-slate-400 mt-1">
                                    Earliest allowed date is {earliestDate} (not tomorrow; holidays and
                                    weekly offs are skipped).
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                    <div>
                        <span className={labelClass}>Request type</span>
                        <div className="flex items-center h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-100/70 text-sm font-semibold text-slate-700">
                            {requestTypeLabel}
                        </div>
                        {isHalfDay ? (
                            <p className="mt-1.5 text-[11px] text-slate-500">
                                A half day is requested as a late arrival — pick Full day for authorized leave.
                            </p>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className={labelClass}>From date</span>
                            <input
                                type="date"
                                value={fromDate}
                                min={earliestDate || undefined}
                                onChange={(e) => handleFromDateChange(e.target.value)}
                                disabled={submitting}
                                className={fieldClass}
                            />
                        </label>
                        <label className="block">
                            <span className={labelClass}>To date</span>
                            <input
                                type="date"
                                value={toDate}
                                min={fromDate || earliestDate || undefined}
                                onChange={(e) => {
                                    setToDate(e.target.value);
                                    setLocalError('');
                                }}
                                disabled={submitting}
                                className={fieldClass}
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className={labelClass}>Time</span>
                        <select
                            value={dayPart}
                            onChange={(e) => {
                                setDayPart(e.target.value);
                                setLocalError('');
                            }}
                            disabled={submitting}
                            className={fieldClass}
                        >
                            {DAY_PART_OPTIONS.map((opt) => (
                                <option key={opt.key} value={opt.key}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    {isHalfDay ? (
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className={labelClass}>Time in</span>
                                <select
                                    value={timeIn}
                                    onChange={(e) => handleTimeInChange(e.target.value)}
                                    disabled={submitting}
                                    className={fieldClass}
                                >
                                    {slots.map((slot) => (
                                        <option
                                            key={slot.value}
                                            value={slot.value}
                                            disabled={slot.minutes >= shift.endMinutes}
                                        >
                                            {slot.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className={labelClass}>Time out</span>
                                <select
                                    value={timeOut}
                                    onChange={(e) => {
                                        setTimeOut(e.target.value);
                                        setLocalError('');
                                    }}
                                    disabled={submitting}
                                    className={fieldClass}
                                >
                                    {slots.map((slot) => (
                                        <option
                                            key={slot.value}
                                            value={slot.value}
                                            disabled={
                                                timeInMinutes != null && slot.minutes <= timeInMinutes
                                            }
                                        >
                                            {slot.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    ) : null}

                    <label className="block">
                        <span className={labelClass}>Description</span>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            required
                            placeholder="Briefly explain this request…"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-y min-h-[88px]"
                        />
                    </label>

                    <div>
                        <span className={labelClass}>Attachment</span>
                        <input
                            ref={fileRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                        />
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="w-full flex items-center gap-3 h-12 px-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-400 transition-colors text-left"
                        >
                            <span className="h-8 w-8 rounded-lg bg-white border border-slate-200 inline-flex items-center justify-center text-slate-500 shrink-0">
                                <Paperclip size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-slate-800 truncate">
                                    {attachment ? attachment.name : 'Choose a file'}
                                </span>
                                <span className="block text-xs text-slate-400 mt-0.5">
                                    {attachment ? 'Click to change' : 'Required · PDF, image, or document'}
                                </span>
                            </span>
                        </button>
                    </div>

                    {localError || error ? (
                        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                            {localError || error}
                        </p>
                    ) : null}

                    <div className="flex items-center gap-2.5 pt-1 pb-1">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={handleClose}
                            className="flex-1 h-11 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                        >
                            {submitting ? 'Sending…' : 'Send to reportee'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
