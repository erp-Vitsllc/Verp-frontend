'use client';

import { useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

/** Drop the fraction. 60 minutes is the next hour, so 11.75 (45 minutes) stays 11. */
function wholeOtHours(value) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    return Math.floor(hours + 1e-9);
}

function wholeOtLabel(value) {
    if (value == null || value === '') return '—';
    const hours = Number(value);
    if (!Number.isFinite(hours)) return '—';
    return String(wholeOtHours(hours));
}

function dayHourLabel(value) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) return '—';
    return String(Math.round(hours * 100) / 100);
}

function Row({ label, value }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
            <span className="text-sm font-semibold text-slate-800">{value || '—'}</span>
        </div>
    );
}

function coversWorkingDay(hours, dayHours) {
    const required = Number(dayHours) || 0;
    if (required > 0) return hours + 1e-9 >= required;
    return hours > 10;
}

function addDaysKey(dateKey, days) {
    const date = new Date(`${dateKey}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function isAuthLeaveRow(row) {
    const key = String(row?.statusKey || '').trim();
    const label = String(row?.statusLabel || '').trim();
    if (key === 'authorized_leave') return true;
    if (/^auth$/i.test(label)) return true;
    return /auth(?:orized)? leave/i.test(label);
}

function choiceLabel(dateKey, offset) {
    const [year, month, day] = String(dateKey || '').split('-').map(Number);
    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1] || '';
    const when = offset === 1 ? 'Next day' : offset === -1 ? 'Yesterday' : 'This day';
    return `${when} · ${String(day).padStart(2, '0')} ${monthName} ${year} · Auth`;
}

export default function FlexibleOtModal({
    open,
    mode = 'request',
    intent = 'apply',
    employee,
    mark,
    dayHours = 0,
    onClose,
    onSaved,
}) {
    const { toast } = useToast();
    const [approvedHours, setApprovedHours] = useState(() => {
        const source = mark?.flexibleOtApprovedHours || mark?.flexibleOtHours;
        return source ? String(wholeOtHours(source)) : '';
    });
    const [reason, setReason] = useState(mark?.flexibleOtReason || '');
    const [saving, setSaving] = useState(false);
    const [targetDate, setTargetDate] = useState('');
    const [dayChoices, setDayChoices] = useState([]);
    const [daysLoading, setDaysLoading] = useState(false);
    const review = mode === 'review';
    const direct = mode === 'direct';
    const nextDayIntent = intent === 'next-day' && !review;

    useEffect(() => {
        if (!open) return;
        const source = mark?.flexibleOtApprovedHours || mark?.flexibleOtHours;
        setApprovedHours(source ? String(wholeOtHours(source)) : '');
        setReason(mark?.flexibleOtReason || '');
    }, [open, mark?.attendanceId, mark?.flexibleOtApprovedHours, mark?.flexibleOtHours, mark?.flexibleOtReason]);

    useEffect(() => {
        if (!open || !nextDayIntent || !mark?.date || !employee?.id) return undefined;
        let cancelled = false;
        setDaysLoading(true);
        const dates = [1, 0, -1].map((offset) => ({ offset, date: addDaysKey(mark.date, offset) }));
        const months = [...new Set(dates.map((row) => row.date.slice(0, 7)))];
        Promise.all(
            months.map((month) =>
                axiosInstance
                    .get('/Attendance/me', {
                        params: { month, forEmployeeId: employee.id },
                        skipToast: true,
                    })
                    .then((response) => (Array.isArray(response.data?.records) ? response.data.records : []))
                    .catch(() => []),
            ),
        )
            .then((groups) => {
                if (cancelled) return;
                const byDate = new Map();
                groups.flat().forEach((row) => {
                    const date = String(row?.date || '').trim();
                    if (date) byDate.set(date, row);
                });
                const choices = dates.filter((row) => isAuthLeaveRow(byDate.get(row.date)));
                setDayChoices(choices);
                setTargetDate('');
            })
            .finally(() => {
                if (!cancelled) setDaysLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, nextDayIntent, mark?.date, employee?.id]);

    if (!open || !mark) return null;

    const hoursNow = wholeOtHours(approvedHours);
    const requiredDay = Number(dayHours) > 0 ? Number(dayHours) : Number(mark?.flexibleRequiredHours) || 0;
    const creditedDay = requiredDay > 0 ? requiredDay : 10;
    const nextDayApply = nextDayIntent && coversWorkingDay(hoursNow, requiredDay);
    const remainderHours = nextDayApply ? Math.max(0, wholeOtHours(hoursNow - creditedDay)) : 0;
    const selectedChoice = dayChoices.find((row) => row.date === targetDate);

    const submitRequest = async () => {
        const hours = hoursNow;
        if (nextDayIntent && !targetDate) {
            toast({ variant: 'destructive', title: 'Choose an authorized leave day' });
            return;
        }
        if (nextDayIntent && !nextDayApply) {
            toast({
                variant: 'destructive',
                title: 'Approved hours must cover one working day',
                description: `Enter at least ${dayHourLabel(creditedDay)} hours.`,
            });
            return;
        }
        setSaving(true);
        try {
            await axiosInstance.post('/Attendance/flexible-ot/request', {
                attendanceId: mark.attendanceId,
                approvedHours: hours,
                reason,
                confirmNextDay: nextDayIntent,
                targetDate: nextDayIntent ? targetDate : '',
            });
            toast({
                title: nextDayIntent ? 'Present set on the selected day' : direct ? 'Overtime applied' : 'Overtime request sent',
                description: nextDayIntent
                    ? remainderHours > 0
                        ? `${choiceLabel(targetDate, selectedChoice?.offset)} is Present for ${dayHourLabel(creditedDay)} hr. Apply OT stays on that day for the remaining ${remainderHours} hr.`
                        : `${choiceLabel(targetDate, selectedChoice?.offset)} is Present for ${dayHourLabel(creditedDay)} hr.`
                    : direct
                      ? 'These hours are taken now.'
                      : 'HR has been notified.',
            });
            onSaved?.();
            onClose?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not send request',
                description: error?.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    const decide = async (decision) => {
        setSaving(true);
        try {
            await axiosInstance.post('/Attendance/flexible-ot/decide', {
                attendanceId: mark.attendanceId,
                decision,
                confirmNextDay: false,
            });
            toast({
                title: decision === 'approved' ? 'Overtime approved' : 'Overtime rejected',
            });
            onSaved?.();
            onClose?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not update overtime',
                description: error?.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="text-lg font-black text-slate-900">
                    {review ? 'Review overtime' : nextDayIntent ? 'Next day present' : direct ? 'Apply overtime' : 'Request overtime'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{employee?.name}</p>
                <div className="mt-4">
                    <Row label="Total hours worked" value={wholeOtLabel(mark.flexibleWorkedHours)} />
                    <Row label="Time in" value={mark.rawTimeIn} />
                    <Row label="Time out" value={mark.rawTimeOut} />
                    <Row label="Overtime taken" value={wholeOtLabel(mark.flexibleOtHours)} />
                </div>
                {review ? (
                    <>
                        <Row label="Approved hours" value={wholeOtLabel(mark.flexibleOtApprovedHours)} />
                        <Row label="Reason" value={mark.flexibleOtReason} />
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600">
                                Close
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => decide('rejected')}
                                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600"
                            >
                                Reject
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => decide('approved')}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white"
                            >
                                Approve
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="mt-4 space-y-3">
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Approved hours
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={approvedHours}
                                onChange={(e) => setApprovedHours(e.target.value)}
                                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold"
                            />
                        </label>
                        {nextDayIntent ? (
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Day to change
                                <select
                                    value={targetDate}
                                    onChange={(event) => setTargetDate(event.target.value)}
                                    disabled={daysLoading || dayChoices.length === 0}
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
                                >
                                    <option value="">{daysLoading ? 'Loading days...' : 'Select a day'}</option>
                                    {dayChoices.map((choice) => (
                                        <option key={choice.date} value={choice.date}>
                                            {choiceLabel(choice.date, choice.offset)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ) : null}
                        {nextDayIntent && !(dayChoices.length === 0 && !daysLoading) ? (
                            <p className="text-xs leading-5 text-slate-500">
                                {nextDayApply
                                    ? remainderHours > 0
                                        ? `The selected day becomes Present for ${dayHourLabel(creditedDay)} hr. Apply OT stays on that day for the remaining ${remainderHours} hr.`
                                        : `The selected day becomes Present for ${dayHourLabel(creditedDay)} hr.`
                                    : `Approved hours must cover one working day (${dayHourLabel(creditedDay)} hr) before that day can be changed.`}
                            </p>
                        ) : null}
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Reason for giving OT
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                        </label>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600">
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={
                                    saving ||
                                    !String(reason).trim() ||
                                    !(Number(approvedHours) > 0) ||
                                    (nextDayIntent && (daysLoading || !targetDate || !nextDayApply))
                                }
                                onClick={submitRequest}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                            >
                                {nextDayIntent ? 'Set present' : direct ? 'Apply' : 'Submit'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
