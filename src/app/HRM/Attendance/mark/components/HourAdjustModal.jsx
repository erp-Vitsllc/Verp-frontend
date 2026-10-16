'use client';

import { useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { notifyAttendancePendingInboxChanged } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';

function roundHours(value) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours < 0) return 0;
    return Math.round(hours * 100) / 100;
}

function clockToMinutes(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function isFlexibleWeek(week) {
    return String(week?.timingMode || '').toLowerCase() === 'flexible';
}

function wholeHours(value) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    return Math.floor(hours + 1e-9);
}

function requiredHoursForDate(week, dateKey) {
    if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return 0;
    const day = week[WEEKDAY_KEYS[new Date(`${dateKey}T12:00:00Z`).getUTCDay()]];
    if (!day || day.isOffDay) return 0;
    const hours = Number(day.workingHours);
    if (Number.isFinite(hours) && hours > 0) return Math.min(24, hours);
    const weekHours = Number(week.hoursPerDay);
    if (Number.isFinite(weekHours) && weekHours > 0) return Math.min(24, weekHours);
    return 9;
}

function workedHoursOf(mark) {
    const stored = Number(mark?.flexibleWorkedHours) || 0;
    if (stored > 0) return stored;
    const start = clockToMinutes(mark?.rawTimeIn);
    const end = clockToMinutes(mark?.rawTimeOut);
    if (start == null || end == null) return 0;
    const date = String(mark?.date || '').trim();
    const outDate = String(mark?.timeOutDate || '').trim();
    let minutes;
    if (outDate && date && outDate > date) {
        const days = Math.round((new Date(`${outDate}T12:00:00.000Z`) - new Date(`${date}T12:00:00.000Z`)) / 86400000);
        minutes = end - start + days * 24 * 60;
    } else {
        minutes = end - start;
        if (minutes < 0) minutes += 24 * 60;
    }
    return Math.round((Math.max(0, minutes) / 60) * 100) / 100;
}

function flexibleLossHours(mark, week) {
    const required = wholeHours(requiredHoursForDate(week, mark?.date));
    const worked = wholeHours(workedHoursOf(mark));
    return Math.max(0, required - worked);
}

function shiftMinutes(week, dateKey) {
    if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
    const day = week[WEEKDAY_KEYS[new Date(`${dateKey}T12:00:00Z`).getUTCDay()]];
    if (!day || day.isOffDay) return null;
    const part = (which) => {
        const isStart = which === 'start';
        let hour = Number(isStart ? day.startHour : day.endHour);
        const minute = Number(isStart ? day.startMinute : day.endMinute);
        const meridiem = String((isStart ? day.startMeridiem : day.endMeridiem) || 'AM').toUpperCase();
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
        if (meridiem === 'AM' && hour === 12) hour = 0;
        if (meridiem === 'PM' && hour !== 12) hour += 12;
        return hour * 60 + minute;
    };
    const start = part('start');
    const end = part('end');
    if (start == null || end == null || end <= start) return null;
    return { start, end };
}

export function hourAdjustOffer(mark) {
    const key = String(mark?.key || '').trim();
    const text = `${mark?.label || ''} ${mark?.reason || ''}`;
    const session = String(mark?.leaveRequestSession || '').trim();
    if (key === 'mispunch' || /mispunch/i.test(text)) {
        return { kind: 'mispunch', button: 'Req for Mispunch', title: 'Request mispunch approval' };
    }
    if (key === 'early_go' || (key === 'unauthorized_leave' && (session === 'pm' || /early/i.test(text) || /\(PM\)/i.test(text)))) {
        return { kind: 'early_go', button: 'Set as Auth Early Go', title: 'Set as authorized early go' };
    }
    if (
        key === 'late_arrived' ||
        (key === 'unauthorized_leave' && (session === 'am' || /\(AM\)/i.test(text) || /late arrival/i.test(text)))
    ) {
        return { kind: 'late_arrived', button: 'Set as Auth Late Arrival', title: 'Set as authorized late arrival' };
    }
    if (key === 'unauthorized_leave') {
        return { kind: 'authorized_leave', button: 'Set as Auth Leave', title: 'Set as authorized leave' };
    }
    return null;
}

export function hourAdjustPreview(mark, week) {
    const offer = hourAdjustOffer(mark);
    if (!offer) return null;
    if (isFlexibleWeek(week)) {
        const taken = flexibleLossHours(mark, week);
        return { ...offer, flexible: true, taken, unauth: taken * 2, max: taken };
    }
    const shift = shiftMinutes(week, mark?.date);
    const dayHours = shift ? (shift.end - shift.start) / 60 : 8;
    let taken = dayHours;
    if (offer.kind === 'early_go' && shift) {
        const out = clockToMinutes(mark?.rawTimeOut);
        if (out != null) taken = Math.max(0, (shift.end - out) / 60);
    }
    if (offer.kind === 'late_arrived' && shift) {
        const inn = clockToMinutes(mark?.rawTimeIn);
        if (inn != null) taken = Math.max(0, (inn - shift.start) / 60);
    }
    taken = roundHours(taken);
    const max = roundHours(taken * 2);
    return { ...offer, taken, max };
}

function Row({ label, value }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
            <span className="text-sm font-semibold text-slate-800">{value || '—'}</span>
        </div>
    );
}

export default function HourAdjustModal({
    open,
    mode = 'request',
    rejectFirst = false,
    employee,
    mark,
    week,
    readOnly = false,
    onClose,
    onSaved,
}) {
    const { toast } = useToast();
    const preview = hourAdjustPreview(mark, week);
    const queued = mark?.pendingChange?.action === 'hour_adjust' ? mark.pendingChange : null;
    const [approvedHours, setApprovedHours] = useState('');
    const [reason, setReason] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const [saving, setSaving] = useState(false);
    const review = mode === 'review';
    const flexible = Boolean(preview?.flexible);
    const maxHours =
        queued && queued.hoursMax != null && queued.hoursMax !== ''
            ? Number(queued.hoursMax)
            : preview?.max;
    const lossHours =
        queued && queued.hoursTaken != null && queued.hoursTaken !== ''
            ? Number(queued.hoursTaken)
            : preview?.taken;
    const priorReject = String(queued?.rejectReason || '').trim();
    const priorBy = String(queued?.rejectedByName || '').trim();
    const requesterTurn = queued?.stage === 'pending_requester';

    useEffect(() => {
        if (!open) return;
        const queuedHours = queued?.hoursApproved;
        const source =
            queuedHours != null && queuedHours !== ''
                ? queuedHours
                : preview?.flexible
                    ? preview?.taken
                    : mark?.hoursApproved || preview?.taken || '';
        setApprovedHours(source || source === 0 ? String(source) : '');
        setReason(preview?.flexible ? '' : String(queued?.reason || mark?.hourAdjustReason || ''));
        setRejectReason('');
        setRejecting(Boolean(rejectFirst));
    }, [
        open,
        rejectFirst,
        mark?.attendanceId,
        mark?.hoursApproved,
        mark?.hourAdjustReason,
        queued?.id,
        queued?.hoursApproved,
        queued?.reason,
        preview?.taken,
        preview?.flexible,
    ]);

    if (!open || !mark || !preview) return null;

    const readHours = () => {
        const typed = String(approvedHours ?? '').trim();
        const hours = flexible ? wholeHours(approvedHours) : roundHours(approvedHours);
        const limit = Number(maxHours);
        if (!flexible && !String(reason || '').trim()) {
            return { error: 'Description is required' };
        }
        if (flexible) {
            if (!/^\d+$/.test(typed) || hours > limit) {
                return { error: `Enter a whole number from 0 up to ${limit}.` };
            }
        } else if (hours > limit + 0.001) {
            return { error: `Enter hours from 0 up to ${limit}.` };
        }
        return { hours };
    };

    const submit = async () => {
        if (readOnly) return;
        const parsed = readHours();
        if (parsed.error) {
            toast({ variant: 'destructive', title: 'Check the request', description: parsed.error });
            return;
        }
        setSaving(true);
        try {
            const response = await axiosInstance.post('/Attendance/hour-adjust/request', {
                attendanceId: mark.attendanceId,
                approvedHours: parsed.hours,
                reason: flexible ? '' : reason,
            });
            toast({
                title: mode === 'direct' ? 'Hours approved' : 'Request sent',
                description:
                    mode === 'direct'
                        ? 'Deduction uses the approved hours.'
                        : response.data?.message || 'Attendance stays unchanged until HR approves.',
            });
            notifyAttendancePendingInboxChanged();
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
        if (readOnly) return;
        if (decision === 'rejected' && !rejecting) {
            setRejecting(true);
            return;
        }
        if (decision === 'rejected' && !String(rejectReason || '').trim()) {
            toast({ variant: 'destructive', title: 'Reject reason is required' });
            return;
        }
        let hours = 0;
        if (decision === 'approved') {
            const parsed = readHours();
            if (parsed.error) {
                toast({ variant: 'destructive', title: 'Check the request', description: parsed.error });
                return;
            }
            hours = parsed.hours;
        }
        setSaving(true);
        try {
            const changeId = String(queued?.id || '').trim();
            const payload = {
                decision,
                approvedHours: decision === 'approved' ? hours : undefined,
                hourReason: decision === 'approved' ? (flexible ? '' : reason) : undefined,
                rejectReason: decision === 'rejected' ? String(rejectReason || '').trim() : '',
            };
            const response = changeId
                ? await axiosInstance.post('/Attendance/change-request/decide', { id: changeId, ...payload })
                : await axiosInstance.post('/Attendance/hour-adjust/decide', {
                    attendanceId: mark.attendanceId,
                    ...payload,
                });
            toast({
                title: decision === 'approved' ? (requesterTurn ? 'Request sent' : 'Hours approved') : 'Request rejected',
                description:
                    response.data?.message ||
                    (decision === 'approved' ? 'The hour request was updated.' : 'The hour request was sent back.'),
            });
            notifyAttendancePendingInboxChanged();
            onSaved?.();
            onClose?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not update request',
                description: error?.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    const shownLoss = flexible ? wholeHours(lossHours) : lossHours;
    const approveLabel = priorReject || requesterTurn ? 'Reapply' : 'Approve';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="text-lg font-black text-slate-900">{review ? 'Review hour request' : preview.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{employee?.name}</p>
                {requesterTurn ? (
                    <p className="mt-2 text-sm text-slate-500">
                        Update the hours and send the request again, or reject it to remove the request.
                    </p>
                ) : null}
                <div className="mt-4">
                    {flexible ? (
                        <>
                            <Row label="Loss of hours" value={`${shownLoss} hrs`} />
                            <Row label="Unauth taken" value={`${shownLoss * 2} hrs`} />
                        </>
                    ) : (
                        <>
                            <Row label="Hours taken" value={String(preview.taken)} />
                            <Row label="Maximum hours" value={`${maxHours} (${preview.taken} × 2)`} />
                        </>
                    )}
                </div>
                {priorReject ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                        Rejected{priorBy ? ` by ${priorBy}` : ''}: {priorReject}
                    </div>
                ) : null}
                <div className="mt-4 space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                        {flexible ? 'Approved hours' : 'Approved to (hrs)'}
                        <input
                            type="number"
                            inputMode={flexible ? 'numeric' : 'decimal'}
                            min="0"
                            max={maxHours}
                            step={flexible ? '1' : '0.5'}
                            value={approvedHours}
                            disabled={readOnly}
                            onChange={(event) => {
                                const next = event.target.value;
                                if (flexible && next !== '' && !/^\d+$/.test(next)) return;
                                setApprovedHours(next);
                            }}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                        />
                    </label>
                    {flexible ? null : (
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Description
                            <textarea
                                value={reason}
                                disabled={readOnly}
                                onChange={(event) => setReason(event.target.value)}
                                rows={3}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                            />
                        </label>
                    )}
                    {review && rejecting ? (
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Reject reason
                            <textarea
                                value={rejectReason}
                                disabled={readOnly}
                                onChange={(event) => setRejectReason(event.target.value)}
                                rows={3}
                                required
                                className="mt-1 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                            />
                        </label>
                    ) : null}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600">
                            Cancel
                        </button>
                        {review ? (
                            <>
                                <button
                                    type="button"
                                    disabled={readOnly || saving || (rejecting && !String(rejectReason || '').trim())}
                                    onClick={() => decide('rejected')}
                                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {rejecting ? 'Confirm reject' : 'Reject'}
                                </button>
                                {rejecting ? null : (
                                    <button
                                        type="button"
                                        disabled={readOnly || saving}
                                        onClick={() => decide('approved')}
                                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {approveLabel}
                                    </button>
                                )}
                            </>
                        ) : (
                            <button
                                type="button"
                                disabled={readOnly || saving}
                                onClick={submit}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {mode === 'direct' ? 'Approve' : 'Send request'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
