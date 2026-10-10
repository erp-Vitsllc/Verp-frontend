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

export default function FlexibleOtModal({
    open,
    mode = 'request',
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
    const review = mode === 'review';
    const direct = mode === 'direct';

    useEffect(() => {
        if (!open) return;
        const source = mark?.flexibleOtApprovedHours || mark?.flexibleOtHours;
        setApprovedHours(source ? String(wholeOtHours(source)) : '');
        setReason(mark?.flexibleOtReason || '');
    }, [open, mark?.attendanceId, mark?.flexibleOtApprovedHours, mark?.flexibleOtHours, mark?.flexibleOtReason]);

    if (!open || !mark) return null;

    const hoursNow = wholeOtHours(approvedHours);
    const requiredDay = Number(dayHours) > 0 ? Number(dayHours) : Number(mark?.flexibleRequiredHours) || 0;
    const creditedDay = requiredDay > 0 ? requiredDay : 10;
    const nextDayApply = coversWorkingDay(hoursNow, requiredDay);
    const remainderHours = nextDayApply ? Math.max(0, wholeOtHours(hoursNow - creditedDay)) : 0;

    const submitRequest = async () => {
        const hours = hoursNow;
        const nextDay = direct && nextDayApply;
        setSaving(true);
        try {
            await axiosInstance.post('/Attendance/flexible-ot/request', {
                attendanceId: mark.attendanceId,
                approvedHours: hours,
                reason,
                confirmNextDay: nextDay,
            });
            toast({
                title: nextDay ? 'Next day marked present' : direct ? 'Overtime applied' : 'Overtime request sent',
                description: nextDay
                    ? remainderHours > 0
                        ? `The next day is Present (On time) for ${dayHourLabel(creditedDay)} hr. The remaining ${remainderHours} hr is an overtime button on that day.`
                        : `The next day is Present (On time) for ${dayHourLabel(creditedDay)} hr.`
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
        const hours = wholeOtHours(mark.flexibleOtApprovedHours);
        const confirmNextDay = decision === 'approved' && coversWorkingDay(hours, requiredDay);
        setSaving(true);
        try {
            await axiosInstance.post('/Attendance/flexible-ot/decide', {
                attendanceId: mark.attendanceId,
                decision,
                confirmNextDay,
            });
            toast({
                title:
                    decision === 'approved'
                        ? confirmNextDay
                            ? 'Next day marked present'
                            : 'Overtime approved'
                        : 'Overtime rejected',
                description: confirmNextDay
                    ? remainderHours > 0
                        ? `The next day is Present (On time) for ${dayHourLabel(creditedDay)} hr. The remaining ${remainderHours} hr is an overtime button on that day.`
                        : `The next day is Present (On time) for ${dayHourLabel(creditedDay)} hr.`
                    : undefined,
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
                    {review
                        ? 'Review overtime'
                        : direct && nextDayApply
                          ? 'Apply next day attendance'
                          : direct
                            ? 'Apply overtime'
                            : 'Request overtime'}
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
                                {coversWorkingDay(wholeOtHours(mark.flexibleOtApprovedHours), requiredDay)
                                    ? 'Next day present'
                                    : 'Approve'}
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
                        {nextDayApply ? (
                            <p className="text-xs leading-5 text-slate-500">
                                {remainderHours > 0
                                    ? `This covers one working day (${dayHourLabel(creditedDay)} hr). The next day is Present (On time) for those hours, and an overtime button is added there for the remaining ${remainderHours} hr.`
                                    : `This matches one working day (${dayHourLabel(creditedDay)} hr). The next day is Present (On time) for those hours.`}
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
                                disabled={saving || !String(reason).trim() || !(Number(approvedHours) > 0)}
                                onClick={submitRequest}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                            >
                                {direct ? (nextDayApply ? 'Next day present' : 'Apply') : 'Submit'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
