'use client';

import { useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { notifyAttendancePendingInboxChanged } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

function coversWorkingDay(hours, dayHours) {
    const required = Number(dayHours) || 0;
    if (required > 0) return hours + 1e-9 >= required;
    return hours > 10;
}

function isAuthLeaveRow(row) {
    const key = String(row?.statusKey || '').trim();
    const label = String(row?.statusLabel || '').trim();
    if (key === 'authorized_leave') return true;
    if (/^auth$/i.test(label)) return true;
    return /auth(?:orized)? leave/i.test(label);
}

function choiceLabel(dateKey) {
    const [year, month, day] = String(dateKey || '').split('-').map(Number);
    const monthName = MONTHS[month - 1] || '';
    return `${String(day).padStart(2, '0')} ${monthName} ${year} · Auth leave`;
}

function clockInputValue(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim());
    if (!match) return '';
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function formatTrailDate(value) {
    if (!value) return '';
    const key = String(value).slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (match) {
        return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1] || ''} ${match[1]}`;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function viewerDisplayName() {
    if (typeof window === 'undefined') return '';
    try {
        const raw = localStorage.getItem('user') || localStorage.getItem('employeeUser');
        const user = raw ? JSON.parse(raw) : null;
        return (
            [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
            user?.name ||
            user?.employeeName ||
            ''
        );
    } catch {
        return '';
    }
}

function TrailLine({ label, name, when }) {
    if (!name) return null;
    return (
        <p className="text-sm text-slate-700">
            <span className="text-slate-500">{label} </span>
            <span className="font-semibold text-slate-900">{name}</span>
            {when ? <span className="text-slate-500"> ({when})</span> : null}
        </p>
    );
}

export default function FlexibleOtModal({
    open,
    mode = 'request',
    intent = 'apply',
    employee,
    mark,
    dayHours = 0,
    hrName = '',
    viewerIsReportee = false,
    rejectFirst = false,
    readOnly = false,
    onClose,
    onSaved,
}) {
    const { toast } = useToast();
    const [approvedHours, setApprovedHours] = useState('');
    const [reason, setReason] = useState('');
    const [timeIn, setTimeIn] = useState('');
    const [timeOut, setTimeOut] = useState('');
    const [saving, setSaving] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [dayChoices, setDayChoices] = useState([]);
    const [daysLoading, setDaysLoading] = useState(false);
    const review = mode === 'review';
    const direct = mode === 'direct';
    const nextDayIntent = intent === 'next-day' && !review;
    const change = mark?.pendingChange?.action === 'flexible_ot' ? mark.pendingChange : null;

    useEffect(() => {
        if (!open) return;
        const source = change?.flexibleOtApprovedHours || mark?.flexibleOtApprovedHours || mark?.flexibleOtHours;
        setApprovedHours(source ? String(wholeOtHours(source)) : '');
        setReason(change?.reason || mark?.flexibleOtReason || '');
        setTimeIn(clockInputValue(change?.timeIn || mark?.rawTimeIn));
        setTimeOut(clockInputValue(change?.timeOut || mark?.rawTimeOut));
        setRejecting(Boolean(rejectFirst));
        setRejectReason('');
    }, [
        open,
        rejectFirst,
        mark?.attendanceId,
        mark?.flexibleOtApprovedHours,
        mark?.flexibleOtHours,
        mark?.flexibleOtReason,
        mark?.rawTimeIn,
        mark?.rawTimeOut,
        change?.id,
        change?.flexibleOtApprovedHours,
        change?.reason,
        change?.timeIn,
        change?.timeOut,
    ]);

    useEffect(() => {
        if (!open || !nextDayIntent || !mark?.date || !employee?.id) return undefined;
        let cancelled = false;
        setDaysLoading(true);
        const month = String(mark.date).slice(0, 7);
        axiosInstance
            .get('/Attendance/me', {
                params: { month, forEmployeeId: employee.id },
                skipToast: true,
            })
            .then((response) => {
                if (cancelled) return;
                const records = Array.isArray(response.data?.records) ? response.data.records : [];
                const seen = new Set();
                const choices = records
                    .filter((row) => {
                        const date = String(row?.date || '').trim();
                        if (!date.startsWith(month) || seen.has(date) || !isAuthLeaveRow(row)) return false;
                        seen.add(date);
                        return true;
                    })
                    .map((row) => ({ date: String(row.date).trim() }))
                    .sort((a, b) => a.date.localeCompare(b.date));
                setDayChoices(choices);
                setTargetDate('');
            })
            .catch(() => {
                if (!cancelled) setDayChoices([]);
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
    const actualHours = change?.flexibleOtHours || mark?.flexibleOtHours;
    const requestDate = change?.date || mark?.date || '';
    const requestedName = change?.requestedByName || viewerDisplayName() || employee?.name || 'Employee';
    const requestedWhen = formatTrailDate(change?.createdAt) || formatTrailDate(requestDate);
    const reporteeDone = Boolean(change?.decidedAtReportee);
    const pendingName = change
        ? change.stage === 'pending_hr'
            ? change.hrName || hrName || 'HR'
            : change.stage === 'pending_requester'
              ? change.requestedByName || 'Requester'
              : change.reporteeName || employee?.primaryReporteeName || 'Primary reportee'
        : review
          ? hrName || 'HR'
          : viewerIsReportee
            ? hrName || 'HR'
            : employee?.primaryReporteeName || 'Primary reportee';
    const sendBackTo = change
        ? change.stage === 'pending_hr'
            ? change.reporteeName || 'the primary reportee'
            : change.stage === 'pending_reportee'
              ? change.requestedByName || 'the requester'
              : ''
        : '';
    const priorReject = String(change?.rejectReason || '').trim();
    const sentBack = Boolean(String(change?.rejectReason || '').trim()) || change?.stage === 'pending_requester';
    const approveLabel = sentBack
        ? 'Reapply'
        : review
          ? 'Approve'
          : nextDayIntent
            ? 'Set present'
            : 'Submit';

    const submitRequest = async () => {
        if (readOnly) return;
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
        if (!String(reason).trim()) {
            toast({ variant: 'destructive', title: 'Reason for OT is required' });
            return;
        }
        setSaving(true);
        try {
            const response = await axiosInstance.post('/Attendance/flexible-ot/request', {
                attendanceId: mark.attendanceId,
                approvedHours: hours,
                reason,
                timeIn,
                timeOut,
                confirmNextDay: nextDayIntent,
                targetDate: nextDayIntent ? targetDate : '',
            });
            const appliedNow = Boolean(response.data?.applied);
            const presentCopy = remainderHours > 0
                ? `${choiceLabel(targetDate)} is Present for ${dayHourLabel(creditedDay)} hr. Apply OT stays on that day for the remaining ${remainderHours} hr.`
                : `${choiceLabel(targetDate)} is Present for ${dayHourLabel(creditedDay)} hr.`;
            toast({
                title: appliedNow ? 'Present set on the selected day' : 'Request sent',
                description: appliedNow
                    ? presentCopy
                    : response.data?.message || 'Sent to the primary reportee. It is applied after HR approves.',
            });
            if (!appliedNow) notifyAttendancePendingInboxChanged();
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
        if (decision === 'rejected' && !String(rejectReason).trim()) {
            toast({ variant: 'destructive', title: 'Reject reason is required' });
            return;
        }
        if (decision === 'approved' && !(hoursNow > 0)) {
            toast({ variant: 'destructive', title: 'Approved hours are required' });
            return;
        }
        if (decision === 'approved' && change?.stage === 'pending_requester' && !String(reason).trim()) {
            toast({ variant: 'destructive', title: 'Reason for OT is required' });
            return;
        }
        setSaving(true);
        try {
            const payload = {
                decision,
                approvedHours: hoursNow,
                reason,
                timeIn,
                timeOut,
                rejectReason: decision === 'rejected' ? String(rejectReason).trim() : '',
            };
            const response = change?.id
                ? await axiosInstance.post('/Attendance/change-request/decide', {
                      id: change.id,
                      ...payload,
                  })
                : await axiosInstance.post('/Attendance/flexible-ot/decide', {
                      attendanceId: mark.attendanceId,
                      ...payload,
                      confirmNextDay: false,
                  });
            toast({
                title: decision === 'approved' ? 'Overtime updated' : 'Overtime rejected',
                description: response.data?.message || '',
            });
            notifyAttendancePendingInboxChanged();
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
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="text-lg font-black text-slate-900">OT Approval</h3>
                <div className="mt-3 space-y-1">
                    <TrailLine label="Requested by" name={requestedName} when={requestedWhen} />
                    {reporteeDone ? (
                        <TrailLine
                            label="Approved by"
                            name={change?.reporteeName || 'Primary reportee'}
                            when={formatTrailDate(change.decidedAtReportee)}
                        />
                    ) : null}
                    <p className="text-sm text-slate-700">
                        <span className="text-slate-500">Pending on: </span>
                        <span className="font-semibold text-slate-900">{pendingName}</span>
                    </p>
                </div>
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-700">
                    <p>
                        <span className="text-slate-500">Request type: </span>
                        <span className="font-semibold">OT Approval</span>
                    </p>
                    <p>
                        <span className="text-slate-500">Request date and time: </span>
                        <span className="font-semibold">
                            {formatTrailDate(requestDate) || '—'}
                            {timeIn || timeOut ? ` · ${timeIn || '—'} – ${timeOut || '—'}` : ''}
                        </span>
                    </p>
                </div>
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                    <div className="grid grid-cols-2 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        <span className="px-3 py-2">Date</span>
                        <span className="px-3 py-2">Time</span>
                    </div>
                    <div className="grid grid-cols-2 items-center border-t border-slate-100">
                        <span className="px-3 py-2 text-sm font-semibold text-slate-800">
                            {formatTrailDate(requestDate) || '—'}
                        </span>
                        <span className="flex gap-2 px-3 py-2">
                            <input
                                type="time"
                                aria-label="Time in"
                                value={timeIn}
                                disabled={readOnly}
                                onChange={(event) => setTimeIn(event.target.value)}
                                className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50"
                            />
                            <input
                                type="time"
                                aria-label="Time out"
                                value={timeOut}
                                disabled={readOnly}
                                onChange={(event) => setTimeOut(event.target.value)}
                                className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50"
                            />
                        </span>
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Actual OT (hr)
                        <input
                            value={wholeOtLabel(actualHours)}
                            readOnly
                            disabled={readOnly}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed"
                        />
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Approved (hr)
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={approvedHours}
                            disabled={readOnly}
                            onChange={(event) => setApprovedHours(event.target.value)}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-50"
                        />
                    </label>
                </div>
                {priorReject ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                        Rejected{change?.rejectedByName ? ` by ${change.rejectedByName}` : ''}: {priorReject}
                    </div>
                ) : null}
                {review && change?.stage !== 'pending_requester' ? (
                    <p className="mt-3 text-sm text-slate-700">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Requester reason: </span>
                        <span className="whitespace-pre-wrap">{String(reason || '').trim() || '—'}</span>
                    </p>
                ) : (
                    <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Reason for OT
                        <textarea
                            value={reason}
                            disabled={readOnly}
                            required
                            onChange={(event) => setReason(event.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                        />
                    </label>
                )}
                {nextDayIntent ? (
                    <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Day to change
                        <select
                            value={targetDate}
                            onChange={(event) => setTargetDate(event.target.value)}
                            disabled={readOnly || daysLoading || dayChoices.length === 0}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-800"
                        >
                            <option value="">
                                {daysLoading
                                    ? 'Loading days...'
                                    : dayChoices.length
                                      ? 'Select an authorized leave day'
                                      : 'No authorized leave this month'}
                            </option>
                            {dayChoices.map((choice) => (
                                <option key={choice.date} value={choice.date}>
                                    {choiceLabel(choice.date)}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : null}
                {nextDayIntent && !(dayChoices.length === 0 && !daysLoading) ? (
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                        {nextDayApply
                            ? remainderHours > 0
                                ? `The selected day becomes Present for ${dayHourLabel(creditedDay)} hr. Apply OT stays on that day for the remaining ${remainderHours} hr.`
                                : `The selected day becomes Present for ${dayHourLabel(creditedDay)} hr.`
                            : `Approved hours must cover one working day (${dayHourLabel(creditedDay)} hr) before that day can be changed.`}
                    </p>
                ) : null}
                {review && rejecting ? (
                    <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Reject reason
                        <textarea
                            value={rejectReason}
                            disabled={readOnly}
                            onChange={(event) => setRejectReason(event.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                        />
                    </label>
                ) : null}
                {review && sendBackTo ? (
                    <p className="mt-2 text-xs text-slate-500">Reject sends this back to {sendBackTo}.</p>
                ) : null}
                {review && sentBack && change?.stage !== 'pending_requester' ? (
                    <p className="mt-2 text-xs text-slate-500">
                        Reapply sends this on. Reject sends it back to the previous person.
                    </p>
                ) : null}
                {review && change?.stage === 'pending_requester' ? (
                    <p className="mt-2 text-xs text-slate-500">Reject removes this request.</p>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600">
                        Close
                    </button>
                    {review ? (
                        <button
                            type="button"
                            disabled={readOnly || saving || (rejecting && !String(rejectReason).trim())}
                            onClick={() => decide('rejected')}
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {rejecting ? 'Confirm reject' : 'Reject'}
                        </button>
                    ) : null}
                    {review && rejecting ? null : (
                        <button
                            type="button"
                            disabled={
                                readOnly ||
                                saving ||
                                !(Number(approvedHours) > 0) ||
                                (!review && !String(reason).trim()) ||
                                (nextDayIntent && (daysLoading || !targetDate || !nextDayApply))
                            }
                            onClick={() => (review ? decide('approved') : submitRequest())}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {direct && !review && !nextDayIntent ? 'Submit' : approveLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
