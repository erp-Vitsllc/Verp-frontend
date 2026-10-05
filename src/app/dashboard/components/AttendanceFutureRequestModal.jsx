'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { ERP_ATTACHMENT_ACCEPT, ERP_ATTACHMENT_HINT, guardAttachmentFileChange, validateErpUploadFile } from '@/utils/uploadFileTypes';

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DAY_PART_OPTIONS = [
    { key: 'full', label: 'Full day' },
    { key: 'half', label: 'Half day' },
    { key: 'quarter', label: 'Quarter day' },
];

function dubaiTodayKey() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function laterDateKey(a, b) {
    if (!a) return b || '';
    if (!b) return a;
    return a > b ? a : b;
}

function nextDateKey(dateKey) {
    const [year, month, day] = String(dateKey).split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function formatDisplayDate(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return dateKey || '';
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

function inclusiveLeaveDays(fromDate, toDate) {
    if (!fromDate || !toDate || toDate < fromDate) return 0;
    const [fromYear, fromMonth, fromDay] = String(fromDate).split('-').map(Number);
    const [toYear, toMonth, toDay] = String(toDate).split('-').map(Number);
    if (![fromYear, fromMonth, fromDay, toYear, toMonth, toDay].every(Number.isFinite)) return 0;
    return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86400000) + 1;
}

function authorizedSpanMessage(span, fromDate, toDate) {
    if (!span || !fromDate || !toDate || toDate < fromDate) return '';
    if (span === 'single' && fromDate !== toDate) return 'Single day leave uses the same start and end date.';
    if (span === 'multiple' && fromDate === toDate) return 'Multiple days needs an end date after the start date.';
    if (inclusiveLeaveDays(fromDate, toDate) > 3) {
        return 'Maximum 3 days of authorized leave are allowed. For more information, please contact your HOD.';
    }
    return '';
}

function countLeaveDays(fromDate, toDate, holidayDates, offWeekdays) {
    if (!fromDate || !toDate || toDate < fromDate) return 0;
    let count = 0;
    for (let cursor = fromDate; cursor <= toDate; cursor = nextDateKey(cursor)) {
        if (holidayDates instanceof Set && offWeekdays instanceof Set) {
            const weekday = weekdayKeyFromDateKey(cursor);
            if (holidayDates.has(cursor) || offWeekdays.has(weekday)) continue;
        }
        count += 1;
    }
    return count;
}

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
    if (start == null || end == null || end <= start) return null;
    return { startMinutes: start, endMinutes: end };
}

function minutesToLabel(minutes) {
    const value = Math.round(Number(minutes) || 0);
    const hour24 = Math.floor(value / 60) % 24;
    const meridiem = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${String(value % 60).padStart(2, '0')} ${meridiem}`;
}

function formatDurationMinutes(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    const hourLabel = `${hours} hr${hours === 1 ? '' : 's'}`;
    return mins ? `${hourLabel} ${mins} min` : hourLabel;
}

function partialLeaveMessage(scheduleWeek, dateKey, dayPart, session) {
    if (dayPart !== 'half' && dayPart !== 'quarter') return '';
    if (session !== 'am' && session !== 'pm') return '';
    const portion = dayPart === 'half' ? 0.5 : 0.25;
    const name = dayPart === 'half' ? 'half day' : 'quarter day';
    const side = session.toUpperCase();
    const flexible = String(scheduleWeek?.timingMode || '').toLowerCase() === 'flexible';
    const day = scheduleWeek?.[weekdayKeyFromDateKey(dateKey)] || null;
    const flexibleHours = Number(day?.workingHours) > 0
        ? Number(day.workingHours)
        : Number(scheduleWeek?.hoursPerDay) > 0
          ? Number(scheduleWeek.hoursPerDay)
          : 9;
    const duration = flexible
        ? Math.round(Math.min(24, flexibleHours) * 60)
        : (() => {
            const shift = resolveShift(scheduleWeek, dateKey);
            return shift ? shift.endMinutes - shift.startMinutes : 0;
        })();
    if (duration <= 0) return 'Working hours are not set for this day.';
    const leaveMinutes = Math.round(duration * portion);
    const workMinutes = duration - leaveMinutes;
    const hoursLabel = formatDurationMinutes(leaveMinutes);
    if (flexible) {
        return `You have ${hoursLabel} authorized ${name} (${side}). Complete the other ${formatDurationMinutes(workMinutes)}. If you do not, the deduction is 2×.`;
    }
    const shift = resolveShift(scheduleWeek, dateKey);
    const leaveStart = session === 'am' ? shift.startMinutes : shift.endMinutes - leaveMinutes;
    const leaveEnd = leaveStart + leaveMinutes;
    const workStart = session === 'am' ? leaveEnd : shift.startMinutes;
    const workEnd = session === 'am' ? shift.endMinutes : leaveStart;
    const penalty = session === 'am'
        ? `If you punch in after ${minutesToLabel(workStart)}, the deduction is 2×.`
        : `If you punch out before ${minutesToLabel(workEnd)}, the deduction is 2×.`;
    return `You have ${hoursLabel} authorized ${name} (${side}). Authorized leave is ${minutesToLabel(leaveStart)}–${minutesToLabel(leaveEnd)}. Work ${minutesToLabel(workStart)}–${minutesToLabel(workEnd)}. ${penalty}`;
}

export default function AttendanceFutureRequestModal({
    isOpen,
    dateKey,
    earliestDate = '',
    scheduleWeek = null,
    variant = 'authorized',
    holidayDates = null,
    offWeekdays = null,
    submitting = false,
    error = '',
    heading = 'Request for a future day',
    eyebrow = '',
    icon = null,
    onClose,
    onSubmit,
}) {
    const fileRef = useRef(null);
    const isAnnualLeave = variant === 'annual';
    const dayAfterTomorrow = nextDateKey(nextDateKey(dubaiTodayKey()));
    const minimumDate = isAnnualLeave ? earliestDate || '' : laterDateKey(earliestDate, dayAfterTomorrow);
    const [fromDate, setFromDate] = useState(dateKey || '');
    const [toDate, setToDate] = useState(dateKey || '');
    const [leaveDuration, setLeaveDuration] = useState('');
    const [dayPart, setDayPart] = useState('full');
    const [session, setSession] = useState('');
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const start = dateKey && minimumDate && dateKey < minimumDate ? minimumDate : dateKey || minimumDate || '';
        setFromDate(start);
        setToDate(start);
        setLeaveDuration('');
        setDayPart('full');
        setSession('');
        setReason('');
        setAttachment(null);
        setLocalError('');
    }, [isOpen, dateKey, minimumDate]);
    const isMultiDay = Boolean(fromDate && toDate && fromDate !== toDate);
    const leaveDayCount = useMemo(
        () => countLeaveDays(fromDate, toDate, holidayDates, offWeekdays),
        [fromDate, toDate, holidayDates, offWeekdays],
    );

    useEffect(() => {
        if (isMultiDay && dayPart !== 'full') setDayPart('full');
    }, [isMultiDay, dayPart]);

    useEffect(() => {
        if (isAnnualLeave && dayPart !== 'full') setDayPart('full');
    }, [isAnnualLeave, dayPart]);

    if (!isOpen) return null;

    const isPartial = !isAnnualLeave && leaveDuration === 'single' && (dayPart === 'half' || dayPart === 'quarter');
    const partialMessage = isPartial
        ? partialLeaveMessage(scheduleWeek, fromDate || dateKey, dayPart, session)
        : '';
    const authorizedBlock = !isAnnualLeave ? authorizedSpanMessage(leaveDuration, fromDate, toDate) : '';
    const requestKind = isAnnualLeave ? 'annual_leave' : 'leave';
    const requestTypeLabel = isAnnualLeave
        ? 'Annual Leave'
        : dayPart === 'half' && leaveDuration === 'single'
          ? 'Half day leave'
          : dayPart === 'quarter' && leaveDuration === 'single'
            ? 'Quarter day leave'
            : 'Authorized Leave';
    const durationLabel =
        fromDate && toDate && toDate >= fromDate && leaveDayCount > 0
            ? fromDate === toDate
                ? `Leave request for ${formatDisplayDate(fromDate)} · ${leaveDayCount} day${leaveDayCount === 1 ? '' : 's'}`
                : `Leave request for ${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)} · ${leaveDayCount} day${leaveDayCount === 1 ? '' : 's'}`
            : '';

    const handleClose = () => {
        if (submitting) return;
        onClose?.();
    };

    const handleFromDateChange = (value) => {
        setFromDate(value);
        setLocalError('');
        if (!isAnnualLeave && leaveDuration === 'single') {
            setToDate(value);
            return;
        }
        if (value && toDate && value > toDate) setToDate(value);
        if (value && toDate && value !== toDate) setDayPart('full');
    };

    const chooseLeaveDuration = (next) => {
        setLeaveDuration(next);
        setLocalError('');
        if (next === 'single') {
            setToDate(fromDate);
            return;
        }
        setDayPart('full');
    };

    const handleAttachmentChange = (event) => {
        const result = guardAttachmentFileChange(event, (_, file) => {
            setAttachment(file);
            if (file) setLocalError('');
        });
        if (result?.blocked) setLocalError(result.message);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!isAnnualLeave && !leaveDuration) {
            setLocalError('Choose single day or multiple days.');
            return;
        }
        if (authorizedBlock) {
            setLocalError(authorizedBlock);
            return;
        }
        if (!fromDate || !toDate) {
            setLocalError('Choose a start date and an end date.');
            return;
        }
        if (toDate < fromDate) {
            setLocalError('To date cannot be before the from date.');
            return;
        }
        if (!isAnnualLeave && (fromDate < dayAfterTomorrow || toDate < dayAfterTomorrow)) {
            setLocalError('Authorized leave cannot be requested for today or tomorrow.');
            return;
        }
        if (minimumDate && fromDate < minimumDate) {
            setLocalError(`The earliest date you can request is ${minimumDate}.`);
            return;
        }
        const effectiveDayPart = isMultiDay || isAnnualLeave ? 'full' : dayPart;
        if ((effectiveDayPart === 'half' || effectiveDayPart === 'quarter') && session !== 'am' && session !== 'pm') {
            setLocalError('Choose AM or PM for a half day or quarter day.');
            return;
        }
        const trimmed = String(reason || '').trim();
        if (attachment) {
            const check = validateErpUploadFile(attachment);
            if (!check.ok) {
                setLocalError(check.message);
                return;
            }
        }
        setLocalError('');
        onSubmit?.({
            kind: requestKind,
            fromDate,
            toDate,
            dayPart: effectiveDayPart,
            session: effectiveDayPart === 'full' ? '' : session,
            timeIn: '',
            timeOut: '',
            reason: trimmed,
            attachmentName: attachment?.name || '',
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
                            {!isAnnualLeave ? (
                                <p className="text-xs text-slate-400 mt-1">
                                    Today and tomorrow cannot be requested.
                                    {minimumDate ? ` Earliest date is ${minimumDate}.` : ''}
                                </p>
                            ) : earliestDate ? (
                                <p className="text-xs text-slate-400 mt-1">
                                    Earliest allowed date is {earliestDate}. Holidays and weekly offs are skipped.
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
                        {isMultiDay && !isAnnualLeave ? (
                            <p className="mt-1.5 text-[11px] text-slate-500">
                                Multi-day requests are full day only.
                            </p>
                        ) : null}
                    </div>

                    {!isAnnualLeave ? (
                        <div>
                            <span className={labelClass}>Leave duration</span>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { key: 'single', label: 'Single day' },
                                    { key: 'multiple', label: 'Multiple days' },
                                ].map((option) => {
                                    const selected = leaveDuration === option.key;
                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            disabled={submitting}
                                            onClick={() => chooseLeaveDuration(option.key)}
                                            className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${
                                                selected
                                                    ? 'border-slate-900 bg-slate-900 text-white'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}

                    {isAnnualLeave || leaveDuration ? (
                    <>
                    {durationLabel ? (
                        <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3.5 py-2.5">
                            <p className="text-sm font-semibold text-sky-900">{durationLabel}</p>
                            {holidayDates instanceof Set && offWeekdays instanceof Set ? (
                                <p className="text-[11px] text-sky-700/80 mt-1">
                                    Working days only — holidays and weekly offs are excluded.
                                </p>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className={labelClass}>Start date</span>
                            <input
                                type="date"
                                value={fromDate}
                                min={minimumDate || earliestDate || undefined}
                                onChange={(e) => handleFromDateChange(e.target.value)}
                                disabled={submitting}
                                className={fieldClass}
                            />
                        </label>
                        <label className="block">
                            <span className={labelClass}>End date</span>
                            <input
                                type="date"
                                value={toDate}
                                min={leaveDuration === 'multiple' ? fromDate || minimumDate || earliestDate || undefined : minimumDate || earliestDate || undefined}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setLocalError('');
                                    if (!isAnnualLeave && leaveDuration === 'single') {
                                        setFromDate(value);
                                        setToDate(value);
                                        return;
                                    }
                                    setToDate(value);
                                    if (fromDate && value && fromDate !== value) setDayPart('full');
                                }}
                                disabled={submitting}
                                className={fieldClass}
                            />
                        </label>
                    </div>

                    {authorizedBlock ? (
                        <p className="text-sm font-medium text-rose-600">{authorizedBlock}</p>
                    ) : null}

                    {!isAnnualLeave && leaveDuration === 'single' ? (
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
                    ) : null}

                    {isPartial ? (
                        <div>
                            <span className={labelClass}>AM / PM</span>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { key: 'am', label: 'AM' },
                                    { key: 'pm', label: 'PM' },
                                ].map((option) => {
                                    const selected = session === option.key;
                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            disabled={submitting}
                                            onClick={() => {
                                                setSession(option.key);
                                                setLocalError('');
                                            }}
                                            className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${
                                                selected
                                                    ? 'border-slate-900 bg-slate-900 text-white'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {partialMessage ? (
                                <p className="mt-2 text-sm font-medium text-rose-600">{partialMessage}</p>
                            ) : null}
                        </div>
                    ) : null}

                    <label className="block">
                        <span className={labelClass}>Description (optional)</span>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            placeholder="Briefly explain this request…"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-y min-h-[88px]"
                        />
                    </label>

                    <div>
                        <span className={labelClass}>Attachment (optional)</span>
                        <input
                            ref={fileRef}
                            type="file"
                            accept={ERP_ATTACHMENT_ACCEPT}
                            className="hidden"
                            onChange={handleAttachmentChange}
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
                                    {attachment ? 'Click to change' : ERP_ATTACHMENT_HINT}
                                </span>
                            </span>
                        </button>
                    </div>
                    </>
                    ) : null}

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
                            disabled={submitting || Boolean(authorizedBlock)}
                            className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                        >
                            {submitting ? 'Sending…' : 'Send to HR'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
