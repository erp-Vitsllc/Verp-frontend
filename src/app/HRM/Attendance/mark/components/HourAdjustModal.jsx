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

export default function HourAdjustModal({ open, mode = 'request', employee, mark, week, onClose, onSaved }) {
    const { toast } = useToast();
    const preview = hourAdjustPreview(mark, week);
    const [approvedHours, setApprovedHours] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const review = mode === 'review';

    useEffect(() => {
        if (!open) return;
        const source = mark?.hoursApproved || preview?.taken || '';
        setApprovedHours(source ? String(source) : '');
        setReason(mark?.hourAdjustReason || '');
    }, [open, mark?.attendanceId, mark?.hoursApproved, mark?.hourAdjustReason, preview?.taken]);

    if (!open || !mark || !preview) return null;

    const submit = async () => {
        const hours = roundHours(approvedHours);
        if (!String(reason || '').trim()) {
            toast({ variant: 'destructive', title: 'Description is required' });
            return;
        }
        if (hours <= 0 || hours > preview.max + 0.001) {
            toast({
                variant: 'destructive',
                title: 'Check approved hours',
                description: `Enter hours from 0.01 up to ${preview.max}.`,
            });
            return;
        }
        setSaving(true);
        try {
            await axiosInstance.post('/Attendance/hour-adjust/request', {
                attendanceId: mark.attendanceId,
                approvedHours: hours,
                reason,
            });
            toast({
                title: mode === 'direct' ? 'Hours approved' : 'Request sent to HR',
                description: mode === 'direct' ? 'Deduction uses the approved hours.' : 'HR can approve or reject it.',
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
        setSaving(true);
        try {
            await axiosInstance.post('/Attendance/hour-adjust/decide', {
                attendanceId: mark.attendanceId,
                decision,
            });
            toast({
                title: decision === 'approved' ? 'Hours approved' : 'Request rejected',
                description: decision === 'approved' ? 'Deduction uses the approved hours.' : 'Deduction stays unchanged.',
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
                <h3 className="text-lg font-black text-slate-900">{review ? 'Review hour request' : preview.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{employee?.name}</p>
                <div className="mt-4">
                    <Row label="Hours taken" value={String(preview.taken)} />
                    <Row label="Maximum hours" value={`${preview.max} (${preview.taken} × 2)`} />
                </div>
                {review ? (
                    <>
                        <Row label="Approved hours" value={String(mark.hoursApproved || '—')} />
                        <Row label="Description" value={mark.hourAdjustReason} />
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600">Close</button>
                            <button type="button" disabled={saving} onClick={() => decide('rejected')} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600">Reject</button>
                            <button type="button" disabled={saving} onClick={() => decide('approved')} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white">Approve</button>
                        </div>
                    </>
                ) : (
                    <div className="mt-4 space-y-3">
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Approved to (hrs)
                            <input
                                type="number"
                                min="0.01"
                                max={preview.max}
                                step="0.5"
                                value={approvedHours}
                                onChange={(event) => setApprovedHours(event.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800"
                            />
                        </label>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Description
                            <textarea
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                rows={3}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                            />
                        </label>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600">Cancel</button>
                            <button type="button" disabled={saving} onClick={submit} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white">
                                {mode === 'direct' ? 'Approve' : 'Send to HR'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
