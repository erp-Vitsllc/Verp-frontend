'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
    Car,
    Package,
    Paperclip,
    Plane,
    Receipt,
    ShieldAlert,
    Wallet,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { HUB_KINDS } from '@/utils/employeeHubRequest';
import { notifyFinePendingInboxChanged } from '@/app/HRM/Fine/utils/finePendingInboxCount';
import { notifyLoanPendingInboxChanged } from '@/app/HRM/LoanAndAdvance/utils/loanPendingInboxCount';
import { notifyAttendancePendingInboxChanged } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';
import { notifyAssetPendingInboxChanged } from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { dashboardItem } from './dashboardMotion';

const KIND_META = {
    leave: { label: 'Leave', Icon: Plane, wrap: 'bg-sky-50 text-sky-600' },
    fine: { label: 'Fine', Icon: ShieldAlert, wrap: 'bg-rose-50 text-rose-600' },
    advance: { label: 'Advance', Icon: Wallet, wrap: 'bg-violet-50 text-violet-600' },
    assets: { label: 'Assets', Icon: Package, wrap: 'bg-slate-100 text-slate-600' },
    vehicle: { label: 'Vehicle', Icon: Car, wrap: 'bg-teal-50 text-teal-600' },
    utility: { label: 'Utility Bill', Icon: Receipt, wrap: 'bg-cyan-50 text-cyan-700' },
};

function notifyKindInboxes(kind) {
    notifyAttendancePendingInboxChanged();
    if (kind === 'fine') notifyFinePendingInboxChanged();
    if (kind === 'advance') notifyLoanPendingInboxChanged();
    if (kind === 'leave') notifyAttendancePendingInboxChanged();
    if (kind === 'assets' || kind === 'vehicle' || kind === 'utility') {
        notifyAssetPendingInboxChanged();
    }
}

function ComposeModal({ kind, submitting, error, onClose, onSubmit }) {
    const fileRef = useRef(null);
    const [description, setDescription] = useState('');
    const [attachment, setAttachment] = useState(null);
    const meta = KIND_META[kind] || KIND_META.leave;
    const Icon = meta.Icon;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit?.({
            description: String(description || '').trim(),
            attachmentName: attachment?.name || '',
        });
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
                aria-label="Close"
                onClick={onClose}
                disabled={submitting}
            />
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.wrap}`}>
                            <Icon size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Request</p>
                            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{meta.label}</h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    >
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                    <label className="block">
                        <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Description
                        </span>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            required
                            disabled={submitting}
                            placeholder="Describe the request for your primary reportee"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none"
                        />
                    </label>
                    <div>
                        <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Attachment <span className="normal-case tracking-normal font-medium">(optional)</span>
                        </span>
                        <input
                            ref={fileRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                        />
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => fileRef.current?.click()}
                            className="w-full flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                        >
                            <Paperclip size={15} className="text-slate-400" />
                            <span className="truncate">{attachment?.name || 'Choose file'}</span>
                        </button>
                    </div>
                    {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                    <div className="flex justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                        >
                            {submitting ? 'Sending…' : 'Send'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function DecideModal({ request, canDecide, submitting, error, onClose, onDecide }) {
    const [note, setNote] = useState('');
    const meta = KIND_META[request?.kind] || KIND_META.leave;
    const Icon = meta.Icon;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
                aria-label="Close"
                onClick={onClose}
                disabled={submitting}
            />
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.wrap}`}>
                            <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {request?.status || 'Pending'}
                            </p>
                            <h2 className="text-lg font-semibold text-slate-900 tracking-tight truncate">
                                {meta.label} · {request?.requesterName || 'Employee'}
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="px-5 py-4 space-y-4">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Description</p>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{request?.description || '—'}</p>
                    </div>
                    {request?.attachmentName ? (
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                            <Paperclip size={14} />
                            {request.attachmentName}
                        </p>
                    ) : null}
                    {canDecide ? (
                        <label className="block">
                            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Note <span className="normal-case tracking-normal font-medium">(optional)</span>
                            </span>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={2}
                                disabled={submitting}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none"
                            />
                        </label>
                    ) : null}
                    {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                    {canDecide ? (
                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() => onDecide('Rejected', note)}
                                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60"
                            >
                                Reject
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() => onDecide('Approved', note)}
                                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
                            >
                                Accept
                            </button>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500">Waiting for your primary reportee to respond.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function DashboardRequestHub() {
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [open, setOpen] = useState(false);
    const [composeKind, setComposeKind] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [decide, setDecide] = useState(null);

    const hubRequestId = String(searchParams?.get('hubRequestId') || '').trim();

    const closeDecide = useCallback(() => {
        setDecide(null);
        if (hubRequestId) {
            router.replace('/dashboard');
        }
    }, [hubRequestId, router]);

    useEffect(() => {
        if (!hubRequestId) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get(`/Employee/dashboard/hub-request/${hubRequestId}`, {
                    skipToast: true,
                });
                if (cancelled || !res?.data?.request) return;
                setDecide({
                    request: res.data.request,
                    canDecide: Boolean(res.data.canDecide),
                });
            } catch {
                if (!cancelled) {
                    toast({
                        variant: 'destructive',
                        title: 'Request not found',
                        description: 'This request is missing or you cannot view it.',
                    });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [hubRequestId, toast]);

    const sendRequest = async ({ description, attachmentName }) => {
        if (!description) {
            setError('Description is required.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const res = await axiosInstance.post('/Employee/dashboard/hub-request', {
                kind: composeKind,
                description,
                attachmentName,
            });
            notifyKindInboxes(composeKind);
            toast({
                title: 'Request sent',
                description: res.data?.message || 'Your primary reportee has been notified.',
            });
            setComposeKind('');
            setOpen(false);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not send this request.');
        } finally {
            setSubmitting(false);
        }
    };

    const submitDecision = async (decision, note) => {
        if (!decide?.request?.id) return;
        setSubmitting(true);
        setError('');
        try {
            const res = await axiosInstance.post(
                `/Employee/dashboard/hub-request/${decide.request.id}/decide`,
                { decision, note },
            );
            notifyKindInboxes(decide.request.kind);
            toast({
                title: decision === 'Approved' ? 'Accepted' : 'Rejected',
                description: res.data?.message || `Request ${decision.toLowerCase()}.`,
            });
            closeDecide();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not update this request.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <motion.div variants={dashboardItem}>
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6 lg:mb-8">
                <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight min-w-0">
                    Hi, welcome back!
                </h1>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span className="hidden md:block text-slate-400 font-bold text-sm">
                        {new Date().toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </span>
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className="shrink-0 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold tracking-wide"
                    >
                        Request
                    </button>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {open ? (
                    <motion.div
                        key="request-card"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="mb-4 sm:mb-6 rounded-2xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-3">Request</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                {HUB_KINDS.map((item) => {
                                    const meta = KIND_META[item.key];
                                    const Icon = meta.Icon;
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => {
                                                setError('');
                                                setComposeKind(item.key);
                                            }}
                                            className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 hover:bg-white hover:border-blue-200 hover:shadow-sm px-2 py-3 transition-all"
                                        >
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${meta.wrap}`}>
                                                <Icon size={16} />
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-600 text-center leading-tight">
                                                {meta.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            {composeKind ? (
                <ComposeModal
                    kind={composeKind}
                    submitting={submitting}
                    error={error}
                    onClose={() => {
                        if (!submitting) {
                            setComposeKind('');
                            setError('');
                        }
                    }}
                    onSubmit={sendRequest}
                />
            ) : null}

            {decide?.request ? (
                <DecideModal
                    request={decide.request}
                    canDecide={decide.canDecide}
                    submitting={submitting}
                    error={error}
                    onClose={() => {
                        if (!submitting) closeDecide();
                    }}
                    onDecide={submitDecision}
                />
            ) : null}
        </motion.div>
    );
}
