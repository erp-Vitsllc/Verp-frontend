'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { notifySalaryPendingInboxChanged } from '../utils/salaryPendingInboxCount';
import { payrollApprovalStatusLabel } from '../utils/payrollApprovalStatus';

const MONTH_STEP_ORDER = ['accounts', 'hr', 'management'];
const FULL_STEP_ORDER = ['user1', 'accounts', 'hr', 'management'];

function monthChainCopy() {
    return 'Accounts → HR → Management. Salary slots open after Management approves.';
}

function prettyDate(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function stepTone(status) {
    if (status === 'approved') return 'bg-emerald-500 border-emerald-500 text-white';
    if (status === 'rejected') return 'bg-red-500 border-red-500 text-white';
    if (status === 'pending') return 'bg-white border-blue-500 text-blue-600 ring-4 ring-blue-50';
    return 'bg-white border-slate-200 text-slate-400';
}

function connectorTone(status) {
    return status === 'approved' ? 'bg-emerald-400' : 'bg-slate-200';
}

export default function SalaryDmfApprovalPanel({
    kind,
    employeeId = '',
    monthKey = '',
    dmf,
    ready = false,
    saving = false,
    onUpdated,
    variant = 'card',
    showActions = true,
    startButtonClass = '',
    hideStart = false,
    openStartConfirm = false,
    onOpenStartConfirmChange,
}) {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);
    const [confirmStart, setConfirmStart] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const isMonth = kind === 'month';
    const stepOrder = isMonth ? MONTH_STEP_ORDER : FULL_STEP_ORDER;

    const status = String(dmf?.status || 'idle');
    const showStart = Boolean(ready && (dmf?.canStart || status === 'idle' || status === 'rejected' || !status));
    const inFlight = status === 'pending' || status === 'approved' || status === 'rejected';
    const showPanel = isMonth || showStart || inFlight || confirmStart || openStartConfirm;

    const steps = useMemo(() => {
        const rows = (Array.isArray(dmf?.steps) ? dmf.steps : []).filter((step) => {
            if (step.key === 'user2') return false;
            if (isMonth && step.key === 'user1') return false;
            return true;
        });
        if (rows.length) return rows;
        if (isMonth) {
            return [
                { key: 'accounts', label: 'Accounts', status: 'scheduled' },
                { key: 'hr', label: 'HR', status: 'scheduled' },
                { key: 'management', label: 'Management', status: 'scheduled' },
            ];
        }
        return [
            { key: 'user1', label: 'User', status: 'scheduled' },
            { key: 'accounts', label: 'Accounts', status: 'scheduled' },
            { key: 'hr', label: 'HR', status: 'scheduled' },
            { key: 'management', label: 'Management', status: 'scheduled' },
        ];
    }, [dmf?.steps, isMonth]);

    const current = steps.find((step) => step.key === dmf?.currentStepKey) || steps.find((s) => s.status === 'pending');

    useEffect(() => {
        if (!openStartConfirm || !showStart) return undefined;
        setConfirmStart(true);
        onOpenStartConfirmChange?.(false);
        return undefined;
    }, [openStartConfirm, showStart, onOpenStartConfirmChange]);

    async function call(path, extra = {}) {
        const url =
            kind === 'month'
                ? `/Employee/salary-register/${encodeURIComponent(monthKey)}/dmf/${path}`
                : `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical/dmf/${path}`;
        setBusy(true);
        try {
            const res = await axiosInstance.post(url, extra);
            const payload = res.data;
            onUpdated?.(payload);
            notifySalaryPendingInboxChanged();
            return payload;
        } catch (err) {
            toast({
                title: err?.response?.data?.message || 'Request failed',
                variant: 'destructive',
            });
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function handleStart() {
        const payload = await call('start');
        if (payload) {
            setConfirmStart(false);
            const next = payload?.dmf || payload;
            toast({ title: payrollApprovalStatusLabel(next) || 'Pending Accounts' });
        }
    }

    async function handleApprove() {
        const payload = await call('approve');
        if (!payload) return;
        const next = payload?.dmf || payload;
        toast({ title: payrollApprovalStatusLabel(next) || 'Approved' });
    }

    async function handleReject() {
        const reason = String(rejectReason || '').trim();
        if (!reason) {
            toast({ title: 'Enter a rejection reason', variant: 'destructive' });
            return;
        }
        const ok = await call('reject', { reason });
        if (ok) {
            setRejectOpen(false);
            setRejectReason('');
            toast({ title: 'Rejected' });
        }
    }

    if (!showPanel) return null;

    const disabled = busy || saving;
    const startBtn = (
        <button
            type="button"
            onClick={() => setConfirmStart(true)}
            disabled={disabled}
            className={
                startButtonClass ||
                'inline-flex h-10 items-center gap-2 rounded-xl bg-[#0F766E] px-4 text-sm font-semibold text-white disabled:opacity-60'
            }
        >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Approval
        </button>
    );

    const actBtns = dmf?.canAct ? (
        <>
            <button
                type="button"
                onClick={() => setRejectOpen(true)}
                disabled={disabled}
                className="h-10 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 disabled:opacity-60"
            >
                Reject
            </button>
            <button
                type="button"
                onClick={handleApprove}
                disabled={disabled}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Approve
            </button>
        </>
    ) : (
        <span className="inline-flex h-10 items-center rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800">
            {payrollApprovalStatusLabel(dmf)}
        </span>
    );

    const headerActions =
        status === 'approved' ? (
            <span className="inline-flex h-10 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800">
                Approved
            </span>
        ) : status === 'pending' ? (
            actBtns
        ) : showStart && !hideStart ? (
            startBtn
        ) : (
            <span className="inline-flex h-10 items-center rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800">
                Pending
            </span>
        );

    const modals = (
        <>
            {confirmStart ? (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/30"
                        onClick={() => setConfirmStart(false)}
                        aria-label="Close"
                    />
                    <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
                        <h3 className="text-base font-bold text-slate-800">Send for approval?</h3>
                        <p className="mt-3 text-sm text-slate-600">
                            {isMonth
                                ? monthChainCopy()
                                : 'This starts User → Accounts → HR → Management. After Management approves, VERP creates a Zoho Books bill.'}
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmStart(false)}
                                className="h-10 rounded-xl border px-4 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleStart}
                                disabled={disabled}
                                className="h-10 rounded-xl bg-[#0F766E] px-4 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {busy ? 'Sending…' : 'Send'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {rejectOpen ? (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/30"
                        onClick={() => setRejectOpen(false)}
                        aria-label="Close"
                    />
                    <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
                        <h3 className="text-base font-bold text-slate-800">Reject?</h3>
                        <textarea
                            value={rejectReason}
                            onChange={(event) => setRejectReason(event.target.value)}
                            rows={4}
                            placeholder="Reason"
                            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setRejectOpen(false)}
                                className="h-10 rounded-xl border px-4 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReject}
                                disabled={disabled}
                                className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );

    if (variant === 'actions') {
        return (
            <>
                {headerActions}
                {modals}
            </>
        );
    }

    const zohoLabel = dmf?.zohoBillNumber
        ? `Zoho Books bill ${dmf.zohoBillNumber}`
        : dmf?.zohoSkipped
          ? dmf.zohoSyncError || 'Zoho Books bill skipped'
          : dmf?.zohoSyncError
            ? dmf.zohoSyncError
            : status === 'approved'
              ? 'Zoho Books'
              : 'Zoho Books';

    return (
        <>
            <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="text-[15px] font-semibold text-[#0F172A]">Approval</h3>
                        <p className="mt-0.5 text-[12px] text-[#64748B]">
                            {isMonth
                                ? monthChainCopy()
                                : 'User → Accounts → HR → Management, then Zoho Books'}
                            {Number(dmf?.amount) > 0
                                ? ` · ${Number(dmf.amount).toLocaleString()} ${dmf.currency || 'AED'}`
                                : ''}
                            .
                        </p>
                    </div>
                    {showActions ? (
                        <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-start gap-0">
                    {steps.map((step, index) => {
                        const actor = step.actionedByName || step.assignedToName || '';
                        return (
                            <div key={`${step.key}-${index}`} className="flex items-start">
                                {index > 0 ? (
                                    <div
                                        className={`mt-4 h-0.5 w-6 sm:w-10 ${connectorTone(
                                            steps[index - 1]?.status,
                                        )}`}
                                    />
                                ) : null}
                                <div className="flex w-[4.5rem] flex-col items-center text-center sm:w-24">
                                    <div
                                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold ${stepTone(
                                            step.status,
                                        )}`}
                                    >
                                        {step.status === 'approved' ? (
                                            <Check size={14} strokeWidth={3} />
                                        ) : (
                                            stepOrder.indexOf(step.key) + 1 || index + 1
                                        )}
                                    </div>
                                    <p className="mt-2 text-[11px] font-semibold text-slate-700">{step.label}</p>
                                    {actor ? (
                                        <p className="mt-0.5 max-w-[6rem] truncate text-[10px] text-slate-400">
                                            {actor}
                                        </p>
                                    ) : null}
                                    {step.actionedAt ? (
                                        <p className="mt-0.5 text-[10px] text-slate-400">
                                            {prettyDate(step.actionedAt)}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex items-start">
                        <div
                            className={`mt-4 h-0.5 w-6 sm:w-10 ${connectorTone(
                                status === 'approved' ? 'approved' : '',
                            )}`}
                        />
                        <div className="flex w-[5.5rem] flex-col items-center text-center sm:w-28">
                            <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                                    status === 'approved'
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'bg-white border-slate-200 text-slate-400'
                                }`}
                            >
                                {status === 'approved' ? (
                                    <Check size={14} strokeWidth={3} />
                                ) : isMonth ? (
                                    'S'
                                ) : (
                                    'Z'
                                )}
                            </div>
                            <p className="mt-2 text-[11px] font-semibold text-slate-700">
                                {isMonth ? 'Salary slots' : 'Zoho Books'}
                            </p>
                            <p className="mt-0.5 max-w-[7rem] text-[10px] text-slate-400">
                                {isMonth
                                    ? status === 'approved'
                                        ? 'Open'
                                        : 'After management'
                                    : zohoLabel}
                            </p>
                        </div>
                    </div>
                </div>

                {status === 'rejected' && dmf?.rejectReason ? (
                    <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Rejected: {dmf.rejectReason}
                    </p>
                ) : null}
            </section>
            {showActions ? modals : null}
        </>
    );
}
