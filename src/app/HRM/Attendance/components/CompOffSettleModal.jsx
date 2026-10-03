'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import axiosInstance from '@/utils/axios';

function hoursLabel(value) {
    const hours = Math.round((Number(value) || 0) * 100) / 100;
    return `${hours.toFixed(2)} h`;
}

function Calculation({ before, deducted, after }) {
    return (
        <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-3 text-sm text-slate-700">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Overtime calculation</p>
            <p className="mt-1 tabular-nums">
                {hoursLabel(before)} − {hoursLabel(deducted)} = <span className="font-semibold text-slate-900">{hoursLabel(after)}</span>
            </p>
        </div>
    );
}

export default function CompOffSettleModal({
    open,
    employeeMongoId,
    date,
    onClose,
    onChanged,
}) {
    const [activeDate, setActiveDate] = useState(date || '');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState('');
    const [error, setError] = useState('');
    const [detail, setDetail] = useState(null);

    useEffect(() => {
        if (open) setActiveDate(date || '');
    }, [open, date]);

    useEffect(() => {
        if (!open || !employeeMongoId || !activeDate) return undefined;
        let cancelled = false;
        setLoading(true);
        setError('');
        (async () => {
            try {
                const { data } = await axiosInstance.get('/Attendance/compoff', {
                    params: { employeeMongoId, date: activeDate },
                    skipToast: true,
                });
                if (!cancelled) setDetail(data || null);
            } catch (err) {
                if (!cancelled) {
                    setDetail(null);
                    setError(err?.response?.data?.message || 'Could not load this comp-off.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, employeeMongoId, activeDate]);

    if (!open) return null;

    async function settle(action) {
        setSaving(action);
        setError('');
        try {
            const { data } = await axiosInstance.post(
                '/Attendance/compoff/settle',
                { employeeMongoId, date: activeDate, action },
                { skipToast: true },
            );
            onChanged?.();
            if (!data?.compOff) {
                onClose?.();
                return;
            }
            setDetail(data.compOff);
            if (data.compOff.date && data.compOff.date !== activeDate) {
                setActiveDate(data.compOff.date);
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not update this comp-off.');
        } finally {
            setSaving('');
        }
    }

    const previewAfter = Math.max(0, (Number(detail?.overtimeHours) || 0) - (Number(detail?.dayHours) || 10));

    return (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
            <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">Comp-off</p>
                        <h2 className="text-lg font-semibold text-slate-900">{detail?.label || 'Comp Off Leave'}</h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {detail?.employeeName || 'Employee'}
                            {detail?.date ? ` · ${detail.date}` : activeDate ? ` · ${activeDate}` : ''}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {loading ? <p className="text-sm text-slate-500">Loading comp-off…</p> : null}
                    {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                    {detail ? (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-slate-200 px-3 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        {detail.chargeMonthName || 'This month'} overtime
                                    </p>
                                    <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">{hoursLabel(detail.overtimeHours)}</p>
                                    <p className="mt-1 text-xs text-slate-500">Overtime already counted as a full present day is not shown.</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 px-3 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        {detail.chargeMonthName || 'This month'} comp-off
                                    </p>
                                    <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">{detail.compOffCount || 0}</p>
                                </div>
                            </div>

                            {detail.calculation ? (
                                <Calculation
                                    before={detail.calculation.before}
                                    deducted={detail.calculation.deducted}
                                    after={detail.calculation.after}
                                />
                            ) : null}

                            {detail.canAdjust ? (
                                <Calculation before={detail.overtimeHours} deducted={detail.dayHours || 10} after={previewAfter} />
                            ) : null}

                            {!detail.locked && !detail.canAdjust && detail.state !== 'adjusted' ? (
                                <p className="text-sm text-slate-600">
                                    Adjust from OT is available only when overtime is {detail.dayHours || 10} hours or more.
                                    This month has {hoursLabel(detail.overtimeHours)}.
                                </p>
                            ) : null}

                            {detail.locked ? <p className="text-sm text-amber-800">{detail.lockReason}</p> : null}

                            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                                {(detail.compOffs || []).map((row) => (
                                    <li key={row.date}>
                                        <button
                                            type="button"
                                            onClick={() => setActiveDate(row.date)}
                                            className={`w-full px-3 py-2.5 text-left ${row.date === detail.date ? 'bg-violet-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <span className="block text-sm font-medium text-slate-900">{row.label}</span>
                                            <span className="block text-xs text-slate-500">{row.date}</span>
                                            {row.calculation ? (
                                                <span className="block text-xs text-violet-700 mt-1 tabular-nums">
                                                    {hoursLabel(row.calculation.before)} − {hoursLabel(row.calculation.deducted)} = {hoursLabel(row.calculation.after)}
                                                </span>
                                            ) : null}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : null}
                </div>

                <div className="flex flex-wrap justify-end gap-2 px-5 py-3 border-t border-slate-100">
                    <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600">
                        Close
                    </button>
                    {detail?.canJump ? (
                        <button
                            type="button"
                            disabled={Boolean(saving)}
                            onClick={() => settle('jump')}
                            className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-semibold text-slate-800 disabled:opacity-50"
                        >
                            {saving === 'jump' ? 'Moving…' : `Jump to next month`}
                        </button>
                    ) : null}
                    {detail?.canAuthorize ? (
                        <button
                            type="button"
                            disabled={Boolean(saving)}
                            onClick={() => settle('authorize')}
                            className="h-10 px-4 rounded-lg border border-orange-200 text-sm font-semibold text-orange-800 disabled:opacity-50"
                        >
                            {saving === 'authorize' ? 'Saving…' : 'Change to authorized leave'}
                        </button>
                    ) : null}
                    {detail?.canAdjust ? (
                        <button
                            type="button"
                            disabled={Boolean(saving)}
                            onClick={() => settle('adjust')}
                            className="h-10 px-4 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50"
                        >
                            {saving === 'adjust' ? 'Adjusting…' : 'Adjust from OT'}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
