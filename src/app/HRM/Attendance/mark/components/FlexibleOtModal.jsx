'use client';

import { useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

function Row({ label, value }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
            <span className="text-sm font-semibold text-slate-800">{value || '—'}</span>
        </div>
    );
}

export default function FlexibleOtModal({
    open,
    mode = 'request',
    employee,
    mark,
    onClose,
    onSaved,
}) {
    const { toast } = useToast();
    const [approvedHours, setApprovedHours] = useState(mark?.flexibleOtApprovedHours || mark?.flexibleOtHours || '');
    const [reason, setReason] = useState(mark?.flexibleOtReason || '');
    const [saving, setSaving] = useState(false);
    const review = mode === 'review';

    useEffect(() => {
        if (!open) return;
        setApprovedHours(mark?.flexibleOtApprovedHours || mark?.flexibleOtHours || '');
        setReason(mark?.flexibleOtReason || '');
    }, [open, mark?.attendanceId, mark?.flexibleOtApprovedHours, mark?.flexibleOtHours, mark?.flexibleOtReason]);

    if (!open || !mark) return null;

    const submitRequest = async () => {
        setSaving(true);
        try {
            await axiosInstance.post('/Attendance/flexible-ot/request', {
                attendanceId: mark.attendanceId,
                approvedHours: Number(approvedHours),
                reason,
            });
            toast({ title: 'Overtime request sent', description: 'HR has been notified.' });
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
        const hours = Number(mark.flexibleOtApprovedHours) || 0;
        const confirmNextDay = decision === 'approved' && hours >= 9
            ? window.confirm('Approving 9 hours or more will mark the next day as Present. Continue?')
            : false;
        if (decision === 'approved' && hours >= 9 && !confirmNextDay) return;
        setSaving(true);
        try {
            await axiosInstance.post('/Attendance/flexible-ot/decide', {
                attendanceId: mark.attendanceId,
                decision,
                confirmNextDay,
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
                    {review ? 'Review overtime' : 'Request overtime'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{employee?.name}</p>
                <div className="mt-4">
                    <Row label="Total hours worked" value={mark.flexibleWorkedHours} />
                    <Row label="Time in" value={mark.rawTimeIn} />
                    <Row label="Time out" value={mark.rawTimeOut} />
                    <Row label="Overtime taken" value={mark.flexibleOtHours} />
                </div>
                {review ? (
                    <>
                        <Row label="Approved hours" value={mark.flexibleOtApprovedHours} />
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
                                min="0.5"
                                step="0.5"
                                value={approvedHours}
                                onChange={(e) => setApprovedHours(e.target.value)}
                                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold"
                            />
                        </label>
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
                                Submit
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
