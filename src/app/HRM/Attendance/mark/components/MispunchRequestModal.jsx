'use client';

import { useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { notifyAttendancePendingInboxChanged } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';

function clockInputValue(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim());
    if (!match) return '';
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function allowanceLabel(allowance) {
    if (!allowance) return '…';
    const used = Math.max(0, Number(allowance.used) || 0);
    if (allowance.allowed == null || allowance.allowed === '') return `${used} / —`;
    return `${used} / ${Math.max(0, Number(allowance.allowed) || 0)}`;
}

function allowanceBlocked(allowance) {
    if (!allowance || allowance.allowed == null || allowance.allowed === '') return false;
    if (allowance.includesDate) return false;
    return (Number(allowance.used) || 0) >= Number(allowance.allowed);
}

export default function MispunchRequestModal({
    open,
    mode = 'request',
    rejectFirst = false,
    employee,
    mark,
    dateKey = '',
    readOnly = false,
    onClose,
    onSaved,
}) {
    const { toast } = useToast();
    const queued = mark?.pendingChange?.action === 'hour_adjust' ? mark.pendingChange : null;
    const review = mode === 'review';
    const [timeIn, setTimeIn] = useState('');
    const [timeOut, setTimeOut] = useState('');
    const [reason, setReason] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [allowance, setAllowance] = useState(null);
    const priorReject = String(queued?.rejectReason || '').trim();
    const priorBy = String(queued?.rejectedByName || '').trim();
    const requesterTurn = queued?.stage === 'pending_requester';
    const blocked = !review && allowanceBlocked(allowance);

    useEffect(() => {
        if (!open) return;
        setTimeIn(clockInputValue(queued?.timeIn || mark?.rawTimeIn));
        setTimeOut(clockInputValue(queued?.timeOut || mark?.rawTimeOut));
        setReason(review || queued?.id ? String(queued?.reason || mark?.hourAdjustReason || '') : '');
        setRejectReason('');
        setRejecting(Boolean(rejectFirst));
        setAllowance(null);
    }, [
        open,
        rejectFirst,
        review,
        mark?.attendanceId,
        mark?.rawTimeIn,
        mark?.rawTimeOut,
        mark?.hourAdjustReason,
        queued?.id,
        queued?.timeIn,
        queued?.timeOut,
        queued?.reason,
    ]);

    useEffect(() => {
        if (!open) return undefined;
        const employeeId = String(employee?.id || '').trim();
        const date = String(mark?.date || dateKey || '').trim();
        if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const response = await axiosInstance.get('/Attendance/mispunch-allowance', {
                    params: { employeeMongoId: employeeId, date },
                    skipToast: true,
                });
                if (!cancelled) setAllowance(response.data || null);
            } catch {
                if (!cancelled) setAllowance(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, employee?.id, mark?.date, dateKey]);

    if (!open || !mark) return null;

    const flowNote = review
        ? queued?.stage === 'pending_hr'
            ? 'Approving this updates the check-in and check-out.'
            : requesterTurn
                ? 'Update the times and reason, then send it again. Or reject it to remove the request.'
                : 'Approving this sends it to HR. The day stays unchanged until HR approves.'
        : mode === 'direct'
            ? 'This updates the day now.'
            : 'Sent to the primary reportee, then HR. The day stays unchanged until HR approves.';

    const submit = async () => {
        if (readOnly || blocked) return;
        if (!timeIn || !timeOut) {
            toast({ variant: 'destructive', title: 'Check-in and check-out are required' });
            return;
        }
        if (!String(reason || '').trim()) {
            toast({ variant: 'destructive', title: 'Reason is required' });
            return;
        }
        setSaving(true);
        try {
            const response = await axiosInstance.post('/Attendance/mispunch/request', {
                attendanceId: mark.attendanceId,
                timeIn,
                timeOut,
                reason: String(reason || '').trim(),
            });
            toast({
                title: mode === 'direct' ? 'Misspunch saved' : 'Request sent',
                description: response.data?.message || 'Sent to the primary reportee, then HR.',
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
        if (decision === 'approved' && (!timeIn || !timeOut || !String(reason || '').trim())) {
            toast({ variant: 'destructive', title: 'Check-in, check-out, and reason are required' });
            return;
        }
        const changeId = String(queued?.id || '').trim();
        const payload = {
            decision,
            timeIn: decision === 'approved' ? timeIn : undefined,
            timeOut: decision === 'approved' ? timeOut : undefined,
            hourReason: decision === 'approved' ? String(reason || '').trim() : undefined,
            approvedHours: decision === 'approved' ? 0 : undefined,
            rejectReason: decision === 'rejected' ? String(rejectReason || '').trim() : '',
        };
        setSaving(true);
        try {
            const response = changeId
                ? await axiosInstance.post('/Attendance/change-request/decide', { id: changeId, ...payload })
                : await axiosInstance.post('/Attendance/hour-adjust/decide', {
                    attendanceId: mark.attendanceId,
                    ...payload,
                });
            toast({
                title: decision === 'approved' ? 'Misspunch updated' : 'Request rejected',
                description: response.data?.message || 'The misspunch request was updated.',
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="text-lg font-black text-slate-900">Misspunch request</h3>
                <p className="mt-1 text-sm text-slate-500">{employee?.name}</p>
                <p className="mt-2 text-sm text-slate-500">{flowNote}</p>
                {priorReject ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                        Rejected{priorBy ? ` by ${priorBy}` : ''}: {priorReject}
                    </div>
                ) : null}
                <div className="mt-4 space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Check-in time
                        <input
                            type="time"
                            value={timeIn}
                            disabled={readOnly}
                            onChange={(event) => setTimeIn(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                        />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Check-out time
                        <input
                            type="time"
                            value={timeOut}
                            disabled={readOnly}
                            onChange={(event) => setTimeOut(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                        />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Reason
                        <textarea
                            value={reason}
                            disabled={readOnly}
                            onChange={(event) => setReason(event.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                        />
                    </label>
                    <div className="flex items-center justify-between gap-3 border-y border-slate-100 py-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Eligible mispunch this month
                        </span>
                        <span className={`text-sm font-semibold tabular-nums ${blocked ? 'text-rose-700' : 'text-slate-800'}`}>
                            {allowanceLabel(allowance)}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500">Count of mispunch / salary count, for this month.</p>
                    {blocked ? (
                        <p className="text-sm text-rose-700">
                            This month is already at the salary count, so this request cannot be sent.
                        </p>
                    ) : null}
                    {review && rejecting ? (
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Reject reason
                            <textarea
                                value={rejectReason}
                                disabled={readOnly}
                                onChange={(event) => setRejectReason(event.target.value)}
                                rows={3}
                                className="mt-1 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                            />
                        </label>
                    ) : null}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600">
                            {readOnly ? 'Close' : 'Cancel'}
                        </button>
                        {readOnly ? null : review ? (
                            <>
                                <button
                                    type="button"
                                    disabled={saving || (rejecting && !String(rejectReason || '').trim())}
                                    onClick={() => decide('rejected')}
                                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {rejecting ? 'Confirm reject' : 'Reject'}
                                </button>
                                {rejecting ? null : (
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => decide('approved')}
                                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {priorReject || requesterTurn ? 'Reapply' : 'Approve'}
                                    </button>
                                )}
                            </>
                        ) : (
                            <button
                                type="button"
                                disabled={saving || blocked}
                                onClick={submit}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Submit
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
