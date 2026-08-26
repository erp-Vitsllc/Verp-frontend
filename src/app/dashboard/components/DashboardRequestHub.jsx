'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
    BadgeDollarSign,
    Car,
    HandCoins,
    Package,
    Paperclip,
    Plane,
    Receipt,
    ScrollText,
    ShieldAlert,
    Wallet,
    Wrench,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { holidayAppliesToStaff } from '@/utils/holidayScope';
import { normalizeWorkLocationKey, weekForStaffType } from '@/utils/workLocations';
import { useToast } from '@/hooks/use-toast';
import { HUB_ASSET_TYPES, HUB_KINDS } from '@/utils/employeeHubRequest';
import { ERP_ATTACHMENT_ACCEPT, ERP_ATTACHMENT_HINT, guardAttachmentFileChange, validateErpUploadFile } from '@/utils/uploadFileTypes';
import { notifyFinePendingInboxChanged } from '@/app/HRM/Fine/utils/finePendingInboxCount';
import { notifyLoanPendingInboxChanged } from '@/app/HRM/LoanAndAdvance/utils/loanPendingInboxCount';
import { notifyAttendancePendingInboxChanged } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';
import { notifyAssetPendingInboxChanged } from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { dashboardItem } from './dashboardMotion';
import AttendanceFutureRequestModal from './AttendanceFutureRequestModal';
import LeaveRequestTypeModal from './LeaveRequestTypeModal';
import { MY_REQUESTS_CHANGED } from './DashboardMyRequestsCard';
import { ATTENDANCE_CHECK_CHANGED } from './DashboardCheckInOutCard';
import AddLoanModal from '@/app/HRM/LoanAndAdvance/components/AddLoanModal';

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getDubaiDateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function nextDateKey(dateKey) {
    const [year, month, day] = String(dateKey).split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function firstEligibleAdvanceRequestDate(todayKey, holidayDates, offWeekdays) {
    let cursor = todayKey;
    let workingSeen = 0;
    for (let i = 0; i < 90; i += 1) {
        cursor = nextDateKey(cursor);
        const [year, month, day] = cursor.split('-').map(Number);
        const weekdayKey =
            WEEKDAY_KEYS[new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay()];
        if (holidayDates.has(cursor) || offWeekdays.has(weekdayKey)) continue;
        workingSeen += 1;
        if (workingSeen >= 2) return cursor;
    }
    return null;
}

const KIND_META = {
    leave: { label: 'Leave', Icon: Plane, wrap: 'bg-sky-50 text-sky-600' },
    advance: { label: 'Advance', Icon: Wallet, wrap: 'bg-violet-50 text-violet-600' },
    loan: { label: 'Loan', Icon: HandCoins, wrap: 'bg-blue-50 text-blue-600' },
    salary: { label: 'Early Salary', Icon: BadgeDollarSign, wrap: 'bg-emerald-50 text-emerald-600' },
    certificate: { label: 'Salary Certificate', Icon: ScrollText, wrap: 'bg-amber-50 text-amber-600' },
    assets: { label: 'Assets', Icon: Package, wrap: 'bg-slate-100 text-slate-600' },
    // Retired kinds — kept so existing requests still render.
    fine: { label: 'Fine', Icon: ShieldAlert, wrap: 'bg-rose-50 text-rose-600' },
    vehicle: { label: 'Vehicle', Icon: Car, wrap: 'bg-teal-50 text-teal-600' },
    utility: { label: 'Utility Bill', Icon: Receipt, wrap: 'bg-cyan-50 text-cyan-700' },
};

const ASSET_TYPE_META = {
    Vehicle: { Icon: Car, wrap: 'bg-teal-50 text-teal-600' },
    Tools: { Icon: Wrench, wrap: 'bg-slate-100 text-slate-600' },
    'Utility Bill': { Icon: Receipt, wrap: 'bg-cyan-50 text-cyan-700' },
};

function notifyKindInboxes(kind) {
    notifyAttendancePendingInboxChanged();
    if (kind === 'fine') notifyFinePendingInboxChanged();
    if (kind === 'advance' || kind === 'loan') notifyLoanPendingInboxChanged();
    if (kind === 'leave') notifyAttendancePendingInboxChanged();
    if (kind === 'assets' || kind === 'vehicle' || kind === 'utility') {
        notifyAssetPendingInboxChanged();
    }
}

function ComposeModal({ kind, submitting, error, onClose, onSubmit }) {
    const fileRef = useRef(null);
    const [description, setDescription] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [assetType, setAssetType] = useState('');
    const [localError, setLocalError] = useState('');
    const meta = KIND_META[kind] || KIND_META.leave;
    const Icon = meta.Icon;
    const needsAssetType = kind === 'assets';
    const showDetails = !needsAssetType || Boolean(assetType);

    const handleAttachmentChange = (event) => {
        const result = guardAttachmentFileChange(event, (_, file) => {
            setAttachment(file);
            if (file) setLocalError('');
        });
        if (result?.blocked) setLocalError(result.message);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (attachment) {
            const check = validateErpUploadFile(attachment);
            if (!check.ok) {
                setLocalError(check.message);
                return;
            }
        }
        setLocalError('');
        onSubmit?.({
            assetType: needsAssetType ? assetType : '',
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
                    {needsAssetType ? (
                        <div>
                            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Asset type
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                                {HUB_ASSET_TYPES.map((type) => {
                                    const TypeIcon = ASSET_TYPE_META[type.key]?.Icon || Package;
                                    const active = assetType === type.key;
                                    return (
                                        <button
                                            key={type.key}
                                            type="button"
                                            disabled={submitting}
                                            onClick={() => setAssetType(type.key)}
                                            className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-3 transition-all ${
                                                active
                                                    ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                                                    : 'border-slate-100 bg-slate-50/80 hover:bg-white hover:border-blue-200'
                                            }`}
                                        >
                                            <span
                                                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                                    ASSET_TYPE_META[type.key]?.wrap || meta.wrap
                                                }`}
                                            >
                                                <TypeIcon size={16} />
                                            </span>
                                            <span
                                                className={`text-[11px] font-bold text-center leading-tight ${
                                                    active ? 'text-blue-700' : 'text-slate-600'
                                                }`}
                                            >
                                                {type.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                    {showDetails ? (
                        <>
                            <label className="block">
                                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                    {needsAssetType ? 'Reason' : 'Description'}
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
                                    Attachment{' '}
                                    <span className="normal-case tracking-normal font-medium">(optional)</span>
                                </span>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept={ERP_ATTACHMENT_ACCEPT}
                                    className="hidden"
                                    onChange={handleAttachmentChange}
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
                                <p className="mt-1.5 text-xs text-slate-400">{ERP_ATTACHMENT_HINT}</p>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-slate-500">
                            Choose an asset type to add your reason and attachment.
                        </p>
                    )}
                    {localError || error ? <p className="text-sm text-rose-600">{localError || error}</p> : null}
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
                            disabled={submitting || !showDetails}
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
    const typeMeta = request?.kind === 'assets' ? ASSET_TYPE_META[request?.assetType] : null;
    const Icon = typeMeta?.Icon || meta.Icon;
    const wrap = typeMeta?.wrap || meta.wrap;

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
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${wrap}`}>
                            <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {request?.status || 'Pending'}
                            </p>
                            <h2 className="text-lg font-semibold text-slate-900 tracking-tight truncate">
                                {request?.label || meta.label} · {request?.requesterName || 'Employee'}
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

    const [leaveDateKey, setLeaveDateKey] = useState('');
    const [leaveEarliestDate, setLeaveEarliestDate] = useState('');
    const [leaveScheduleWeek, setLeaveScheduleWeek] = useState(null);
    const [leaveHolidayDates, setLeaveHolidayDates] = useState(null);
    const [leaveOffWeekdays, setLeaveOffWeekdays] = useState(null);
    const [leaveVariant, setLeaveVariant] = useState('');
    const [selfLoanEmployee, setSelfLoanEmployee] = useState(null);

    const hubRequestId = String(searchParams?.get('hubRequestId') || '').trim();

    const closeDecide = useCallback(() => {
        setDecide(null);
        if (hubRequestId) {
            router.replace('/dashboard');
        }
    }, [hubRequestId, router]);

    useEffect(() => {
        if (composeKind !== 'leave') return undefined;
        let cancelled = false;
        (async () => {
            const todayKey = getDubaiDateKey();
            const monthKey = todayKey.slice(0, 7);
            const year = Number(todayKey.slice(0, 4));
            try {
                const [attendanceRes, holidayRes] = await Promise.all([
                    axiosInstance.get('/Attendance/me', {
                        params: { month: monthKey },
                        skipToast: true,
                    }),
                    axiosInstance.get('/Holiday', {
                        params: { year },
                        skipToast: true,
                    }),
                ]);
                if (cancelled) return;
                const staffType = normalizeWorkLocationKey(attendanceRes.data?.employee?.staffType);
                const offWeekdays = new Set(
                    Array.isArray(attendanceRes.data?.offWeekdays)
                        ? attendanceRes.data.offWeekdays
                        : [],
                );
                const holidayList = Array.isArray(holidayRes.data?.holidays)
                    ? holidayRes.data.holidays
                    : [];
                const holidayDates = new Set(
                    holidayList
                        .filter((h) => holidayAppliesToStaff(h, staffType))
                        .map((h) => h.date)
                        .filter(Boolean),
                );
                const earliest =
                    firstEligibleAdvanceRequestDate(todayKey, holidayDates, offWeekdays) || '';
                setLeaveScheduleWeek(weekForStaffType(attendanceRes.data?.workingTime, staffType) || null);
                setLeaveEarliestDate(earliest);
                setLeaveDateKey(earliest);
                setLeaveHolidayDates(holidayDates);
                setLeaveOffWeekdays(offWeekdays);
            } catch {
                if (!cancelled) {
                    const fallback = nextDateKey(nextDateKey(todayKey));
                    setLeaveScheduleWeek(null);
                    setLeaveEarliestDate(fallback);
                    setLeaveDateKey(fallback);
                    setLeaveHolidayDates(null);
                    setLeaveOffWeekdays(null);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [composeKind]);

    useEffect(() => {
        if (composeKind !== 'loan' && composeKind !== 'advance') {
            setSelfLoanEmployee(null);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get('/Employee/dashboard/my-loan-profile', {
                    skipToast: true,
                });
                if (cancelled) return;
                const employee = res.data?.employee || null;
                if (!employee?.employeeId) {
                    toast({
                        variant: 'destructive',
                        title: 'Profile not found',
                        description: 'No linked employee profile was found for your account.',
                    });
                    setComposeKind('');
                    return;
                }
                setSelfLoanEmployee(employee);
            } catch (err) {
                if (cancelled) return;
                toast({
                    variant: 'destructive',
                    title: 'Could not open request',
                    description:
                        err?.response?.data?.message || 'Failed to load your employee profile.',
                });
                setComposeKind('');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [composeKind, toast]);

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

    const sendLeaveRequest = async ({
        kind,
        fromDate,
        toDate,
        dayPart,
        timeIn,
        timeOut,
        reason,
        attachmentName,
    }) => {
        setSubmitting(true);
        setError('');
        try {
            const res = await axiosInstance.post(
                '/Attendance/me/future-request',
                {
                    date: fromDate || leaveDateKey,
                    fromDate: fromDate || leaveDateKey,
                    toDate: toDate || fromDate || leaveDateKey,
                    kind: kind || (leaveVariant === 'annual' ? 'annual_leave' : 'leave'),
                    dayPart: dayPart || 'full',
                    timeIn: timeIn || '',
                    timeOut: timeOut || '',
                    reason,
                    attachmentName: attachmentName || '',
                },
                { skipToast: true },
            );
            notifyAttendancePendingInboxChanged();
            window.dispatchEvent(new CustomEvent(ATTENDANCE_CHECK_CHANGED));
            window.dispatchEvent(new CustomEvent(MY_REQUESTS_CHANGED));
            toast({
                title: 'Request sent',
                description: res.data?.message || 'Your primary reportee has been notified.',
            });
            setComposeKind('');
            setLeaveVariant('');
            setOpen(false);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not send this request.');
        } finally {
            setSubmitting(false);
        }
    };

    const sendRequest = async ({ assetType, description, attachmentName }) => {
        if (composeKind === 'assets' && !assetType) {
            setError('Choose which asset this request is about.');
            return;
        }
        if (!description) {
            setError('Description is required.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const res = await axiosInstance.post('/Employee/dashboard/hub-request', {
                kind: composeKind,
                assetType: assetType || '',
                description,
                attachmentName,
            });
            notifyKindInboxes(composeKind);
            window.dispatchEvent(new CustomEvent(MY_REQUESTS_CHANGED));
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

            {composeKind === 'leave' && !leaveVariant ? (
                <LeaveRequestTypeModal
                    isOpen
                    submitting={submitting}
                    icon={
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-sky-50 text-sky-600">
                            <Plane size={18} />
                        </div>
                    }
                    onClose={() => {
                        if (!submitting) {
                            setComposeKind('');
                            setLeaveVariant('');
                            setError('');
                        }
                    }}
                    onSelect={(type) => {
                        setError('');
                        setLeaveVariant(type);
                    }}
                />
            ) : composeKind === 'leave' && leaveVariant ? (
                <AttendanceFutureRequestModal
                    key={`${leaveVariant}-${leaveDateKey || 'hub-leave'}`}
                    isOpen
                    dateKey={leaveDateKey}
                    earliestDate={leaveEarliestDate}
                    scheduleWeek={leaveScheduleWeek}
                    variant={leaveVariant === 'annual' ? 'annual' : 'authorized'}
                    holidayDates={leaveHolidayDates}
                    offWeekdays={leaveOffWeekdays}
                    submitting={submitting}
                    error={error}
                    heading={leaveVariant === 'annual' ? 'Annual leave' : 'Authorized leave'}
                    eyebrow="Request"
                    icon={
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-sky-50 text-sky-600">
                            <Plane size={18} />
                        </div>
                    }
                    onClose={() => {
                        if (!submitting) {
                            setComposeKind('');
                            setLeaveVariant('');
                            setError('');
                        }
                    }}
                    onSubmit={sendLeaveRequest}
                />
            ) : composeKind === 'leave' ? null : composeKind === 'loan' || composeKind === 'advance' ? (
                <AddLoanModal
                    key={`${composeKind}-${selfLoanEmployee?.employeeId || 'loading'}`}
                    isOpen={Boolean(selfLoanEmployee)}
                    forcedType={composeKind === 'advance' ? 'Advance' : 'Loan'}
                    lockApplicant
                    selfService
                    employees={selfLoanEmployee ? [selfLoanEmployee] : []}
                    onClose={() => {
                        setComposeKind('');
                        setSelfLoanEmployee(null);
                        setError('');
                    }}
                    onSuccess={() => {
                        notifyLoanPendingInboxChanged();
                        window.dispatchEvent(new CustomEvent(MY_REQUESTS_CHANGED));
                        setComposeKind('');
                        setSelfLoanEmployee(null);
                        setOpen(false);
                    }}
                />
            ) : composeKind ? (
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
