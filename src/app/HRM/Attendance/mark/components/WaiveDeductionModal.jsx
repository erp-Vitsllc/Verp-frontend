'use client';

import { useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

function yearOf(dateKey) {
    const match = /^(\d{4})/.exec(String(dateKey || ''));
    return match ? match[1] : '';
}

export default function WaiveDeductionModal({
    open,
    employee,
    mark,
    dateKey = '',
    onClose,
    onSaved,
}) {
    const { toast } = useToast();
    const [reason, setReason] = useState('');
    const [count, setCount] = useState(null);
    const [saving, setSaving] = useState(false);
    const year = yearOf(mark?.date || dateKey);

    useEffect(() => {
        if (!open) return;
        setReason('');
        setCount(null);
        setSaving(false);
    }, [open, mark?.attendanceId]);

    useEffect(() => {
        if (!open || !employee?.id || !year) return undefined;
        let cancelled = false;
        axiosInstance
            .get('/Attendance/deduction-waive', {
                params: { employeeMongoId: employee.id, year },
                skipToast: true,
            })
            .then((response) => {
                if (!cancelled) setCount(Number(response.data?.count) || 0);
            })
            .catch(() => {
                if (!cancelled) setCount(null);
            });
        return () => {
            cancelled = true;
        };
    }, [open, employee?.id, year]);

    if (!open || !mark) return null;

    const confirm = async () => {
        const text = String(reason || '').trim();
        if (!text) {
            toast({ variant: 'destructive', title: 'Reason for waive of deduction is required' });
            return;
        }
        setSaving(true);
        try {
            const response = await axiosInstance.post('/Attendance/deduction-waive', {
                attendanceId: mark.attendanceId,
                reason: text,
            });
            toast({
                title: 'Deduction waived',
                description: response.data?.message || 'The status is unchanged.',
            });
            onSaved?.();
            onClose?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not waive the deduction',
                description: error?.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="text-lg font-black text-slate-900">Waive of deduction</h3>
                <p className="mt-1 text-sm text-slate-600">
                    {employee?.name || 'Employee'}
                    {year ? ` · ${mark?.date || dateKey}` : ''}
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-800">
                    Currently waived deduction:{' '}
                    <span className="tabular-nums">{count == null ? '…' : count}</span>
                    {year ? ` (${year})` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                    Count of deductions waived by HR for this employee in {year || 'this year'}.
                </p>
                <label className="mt-4 block text-xs font-semibold text-slate-500">
                    Reason for waive of deduction
                    <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                    />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={confirm}
                        disabled={saving}
                        className="h-9 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        {saving ? 'Confirming' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}
