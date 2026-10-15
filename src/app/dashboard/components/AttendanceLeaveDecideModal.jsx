'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

const REPORTEE_LEAVE_OPTIONS = [
    {
        key: 'authorized_leave',
        label: 'Authorized Leave',
        swatch: 'bg-[#2563EB]',
        selected: 'border-[#2563EB] bg-blue-50/80',
    },
    {
        key: 'sick_leave',
        label: 'Sick Leave',
        swatch: 'bg-[#22C55E]',
        selected: 'border-[#22C55E] bg-emerald-50/80',
    },
    {
        key: 'compoff_leave',
        label: 'Comp Off Leave',
        swatch: 'bg-[#9333EA]',
        selected: 'border-[#9333EA] bg-violet-50/80',
    },
    {
        key: 'unauthorized_leave',
        label: 'Unauthorized Leave',
        swatch: 'bg-[#E74C3C]',
        selected: 'border-[#E74C3C] bg-rose-50/80',
    },
];

function isPunchCorrectionKind(kind) {
    const key = String(kind || '');
    return key === 'yellow' || key === 'past_late' || key === 'future_late' || key === 'future_early';
}

function clockInputValue(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim());
    if (!match) return '';
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export default function AttendanceLeaveDecideModal({
    isOpen,
    dateKey,
    employeeName = '',
    currentLabel = '',
    requestedLabel = '',
    reason = '',
    attachmentName = '',
    kind = 'leave',
    fromDate = '',
    toDate = '',
    dayPart = '',
    session = '',
    requestTimeIn = '',
    requestTimeOut = '',
    timeIn = '',
    timeOut = '',
    changedBy = '',
    hrReview = false,
    deciding = false,
    rejectFirst = false,
    error = '',
    onClose,
    onDecide,
}) {
    const [chosenKey, setChosenKey] = useState('');
    const [localError, setLocalError] = useState('');
    const [editingTimes, setEditingTimes] = useState(false);
    const [editIn, setEditIn] = useState('');
    const [editOut, setEditOut] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setChosenKey('');
        setLocalError('');
        setEditingTimes(false);
        setRejecting(Boolean(rejectFirst));
        setRejectReason('');
        setEditIn(clockInputValue(timeIn || requestTimeIn));
        setEditOut(clockInputValue(timeOut || requestTimeOut));
    }, [isOpen, dateKey, rejectFirst, timeIn, timeOut, requestTimeIn, requestTimeOut]);

    if (!isOpen) return null;

    const kindKey = String(kind || '');
    const isMultiDay = Boolean(fromDate && toDate && fromDate !== toDate);
    const rangeLabel = isMultiDay ? `${fromDate} → ${toDate}` : '';
    const side = session === 'pm' ? 'PM' : session === 'am' ? 'AM' : '';
    const workWindow = requestTimeIn && requestTimeOut ? `work ${requestTimeIn}–${requestTimeOut}` : '';
    const dayPartLabel =
        dayPart === 'half' || dayPart === 'quarter'
            ? [dayPart === 'quarter' ? 'Quarter day' : 'Half day', side, workWindow].filter(Boolean).join(' · ')
            : dayPart === 'full'
              ? 'Full day'
              : '';
    const isYellow = kindKey === 'yellow';
    const isPastLate = kindKey === 'past_late';
    const isFutureKind = kindKey.startsWith('future_');
    const skipStatusPicker = isYellow || isFutureKind || isPastLate;

    const title =
        kindKey === 'future_annual'
            ? 'Annual leave request'
            : isPastLate || kindKey === 'future_late'
            ? 'Late arrival request'
            : kindKey === 'future_early'
              ? 'Early go request'
              : kindKey === 'future_leave'
                ? 'Leave request'
                : isYellow
                  ? 'Confirm yellow day'
                  : 'Leave request';

    const helpText = isYellow
        ? 'Confirm turns this day green (Present). Reject keeps the yellow status.'
        : kindKey === 'future_annual'
          ? `Approve marks ${isMultiDay ? 'every working day in this range' : 'this future day'} as Annual Leave. Reject keeps ${isMultiDay ? 'them' : 'it'} upcoming.`
        : kindKey === 'future_leave'
          ? dayPart === 'half' || dayPart === 'quarter'
              ? `Approve marks this day as ${dayPart === 'quarter' ? 'Authorized Quarter Day' : 'Authorized Half Day'}${side ? ` (${side})` : ''}. The salary deduction uses that portion. Reject keeps it upcoming.`
              : `Approve marks ${isMultiDay ? 'every working day in this range' : 'this future day'} as Authorized Leave. Authorized leave is unpaid. Reject keeps ${isMultiDay ? 'them' : 'it'} upcoming.`
          : isPastLate
            ? `Approve marks this day as Late Arrival${
                  requestTimeIn || requestTimeOut
                      ? ` (check in ${requestTimeIn || '—'}, check out ${requestTimeOut || '—'})`
                      : ''
              }. Reject keeps the unauthorized leave.`
            : kindKey === 'future_late'
            ? `Approve shows ${isMultiDay ? 'every working day in this range' : 'this future day'} green as Late arrival approved${
                  dayPart === 'half' && requestTimeIn && requestTimeOut
                      ? ` (${requestTimeIn} – ${requestTimeOut})`
                      : ''
              }.`
            : kindKey === 'future_early'
              ? 'Approve shows this future day green as Early go approved.'
              : 'Approve applies the status you choose. Reject keeps the current status.';

    const handleReject = () => {
        if (!rejecting) {
            setRejecting(true);
            setLocalError('');
            return;
        }
        if (!String(rejectReason).trim()) {
            setLocalError('Reject reason is required.');
            return;
        }
        setLocalError('');
        onDecide?.('rejected', '', '', { rejectReason: String(rejectReason).trim() });
    };

    const rejectReasonField = rejecting ? (
        <label className="block text-xs font-semibold text-slate-500">
            Reject reason
            <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-slate-800"
            />
        </label>
    ) : null;

    const handleApprove = () => {
        if (!skipStatusPicker && !chosenKey) {
            setLocalError('Choose Authorized, Sick, or Unauthorized leave before approving.');
            return;
        }
        setLocalError('');
        onDecide?.(
            'approved',
            chosenKey,
            '',
            isPunchCorrectionKind(kindKey) && (editIn || editOut)
                ? { timeIn: editIn, timeOut: editOut }
                : undefined,
        );
    };

    if (isPunchCorrectionKind(kindKey)) {
        const punchIn = String(timeIn || requestTimeIn || '').trim();
        const punchOut = String(timeOut || requestTimeOut || '').trim();
        const requestedText = requestedLabel || (kindKey === 'yellow' ? 'Present' : 'Updated');
        return (
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                <button
                    type="button"
                    className="absolute inset-0 bg-black/40"
                    aria-label="Close"
                    onClick={onClose}
                    disabled={deciding}
                />
                <div
                    role="dialog"
                    aria-modal="true"
                    className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl"
                >
                    <div className="border-b border-slate-100 px-5 py-4">
                        <h2 className="text-base font-semibold text-slate-900">
                            {hrReview ? 'HR approval' : 'Primary reportee approval'}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Approving this updates the attendance day.
                        </p>
                    </div>
                    <div className="space-y-2 px-5 py-4 text-sm text-slate-700">
                        <p>
                            <span className="text-slate-500">Employee: </span>
                            <strong>{employeeName || 'Employee'}</strong>
                        </p>
                        <p>
                            <span className="text-slate-500">Date: </span>
                            {dateKey || '—'}
                        </p>
                        <p>
                            <span className="text-slate-500">Changed by: </span>
                            {changedBy || employeeName || '—'}
                        </p>
                        <p>
                            <span className="text-slate-500">Currently: </span>
                            {currentLabel || 'Not marked'}
                        </p>
                        <p>
                            <span className="text-slate-500">Requested: </span>
                            {requestedText}
                        </p>
                        {editingTimes ? (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <label className="text-xs text-slate-500">
                                    Check in
                                    <input
                                        type="time"
                                        value={editIn}
                                        onChange={(event) => setEditIn(event.target.value)}
                                        className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-800"
                                    />
                                </label>
                                <label className="text-xs text-slate-500">
                                    Check out
                                    <input
                                        type="time"
                                        value={editOut}
                                        onChange={(event) => setEditOut(event.target.value)}
                                        className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-800"
                                    />
                                </label>
                            </div>
                        ) : punchIn || punchOut ? (
                            <p>
                                <span className="text-slate-500">Time: </span>
                                {punchIn || '—'} – {punchOut || '—'}
                            </p>
                        ) : null}
                        {reason ? (
                            <p>
                                <span className="text-slate-500">Reason: </span>
                                {reason}
                            </p>
                        ) : null}
                        {attachmentName ? (
                            <p>
                                <span className="text-slate-500">Attachment: </span>
                                {attachmentName}
                            </p>
                        ) : null}
                        {rejectReasonField}
                        {error || localError ? <p className="text-xs text-rose-500">{localError || error}</p> : null}
                    </div>
                    <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                        <button
                            type="button"
                            disabled={deciding}
                            onClick={onClose}
                            className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-600"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            disabled={deciding}
                            onClick={() => setEditingTimes((value) => !value)}
                            className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
                        >
                            {editingTimes ? 'Done' : 'Edit'}
                        </button>
                        <button
                            type="button"
                            disabled={deciding || (rejecting && !String(rejectReason).trim())}
                            onClick={handleReject}
                            className="h-9 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-700 disabled:opacity-50"
                        >
                            {rejecting ? 'Confirm reject' : 'Reject'}
                        </button>
                        <button
                            type="button"
                            disabled={deciding}
                            onClick={handleApprove}
                            className="h-9 rounded-lg bg-[#EA3D2F] px-4 text-sm font-semibold text-white disabled:opacity-50"
                        >
                            {deciding ? 'Saving…' : 'Approve'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Close"
                onClick={onClose}
                disabled={deciding}
            />
            <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">{title}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {employeeName ? `${employeeName} · ` : ''}
                            {dateKey}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={deciding}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-sm">
                        <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold">
                            Current
                        </p>
                        <p className="font-semibold text-slate-800">{currentLabel || '—'}</p>
                        <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mt-2">
                            {isYellow ? 'If confirmed' : 'Employee requested'}
                        </p>
                        <p className="font-semibold text-slate-800">
                            {requestedLabel || (isYellow ? 'Present' : '—')}
                        </p>
                        {isPastLate ? (
                            <>
                                <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mt-2">
                                    Check in
                                </p>
                                <p className="text-slate-700 text-sm">{requestTimeIn || '—'}</p>
                                <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mt-2">
                                    Check out
                                </p>
                                <p className="text-slate-700 text-sm">{requestTimeOut || '—'}</p>
                            </>
                        ) : null}
                        {rangeLabel || dayPartLabel ? (
                            <>
                                <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mt-2">
                                    {rangeLabel ? 'Dates' : 'Duration'}
                                </p>
                                <p className="text-slate-700 text-sm">
                                    {[rangeLabel, dayPartLabel].filter(Boolean).join(' · ')}
                                </p>
                            </>
                        ) : null}
                        {reason ? (
                            <>
                                <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mt-2">
                                    Reason
                                </p>
                                <p className="text-slate-700 text-sm whitespace-pre-wrap">{reason}</p>
                            </>
                        ) : null}
                        {attachmentName ? (
                            <>
                                <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mt-2">
                                    Attachment
                                </p>
                                <p className="text-slate-700 text-sm">{attachmentName}</p>
                            </>
                        ) : null}
                    </div>

                    {!skipStatusPicker ? (
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Set status
                            </p>
                            <div className="space-y-2">
                                {REPORTEE_LEAVE_OPTIONS.map((opt) => {
                                    const active = chosenKey === opt.key;
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            disabled={deciding}
                                            onClick={() => {
                                                setChosenKey(opt.key);
                                                setLocalError('');
                                            }}
                                            className={`w-full flex items-center gap-3 h-11 px-3 rounded-xl border text-left transition-all disabled:opacity-50 ${
                                                active
                                                    ? `${opt.selected} shadow-sm`
                                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${opt.swatch}`} />
                                            <span className={`flex-1 text-sm font-medium ${active ? 'text-slate-900' : 'text-slate-700'}`}>
                                                {opt.label}
                                            </span>
                                            {active ? (
                                                <span className="h-5 w-5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center shrink-0">
                                                    <Check size={12} strokeWidth={3} />
                                                </span>
                                            ) : (
                                                <span className="h-5 w-5 rounded-full border border-slate-200 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}

                    <p className="text-xs text-slate-500">{helpText}</p>
                    {rejectReasonField}
                    {localError || error ? (
                        <p className="text-xs text-rose-500">{localError || error}</p>
                    ) : null}
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            disabled={deciding || (rejecting && !String(rejectReason).trim())}
                            onClick={handleReject}
                            className="flex-1 h-10 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            {rejecting ? 'Confirm reject' : 'Reject'}
                        </button>
                        <button
                            type="button"
                            disabled={deciding}
                            onClick={handleApprove}
                            className={`flex-1 h-10 rounded-xl text-sm font-semibold disabled:opacity-50 ${
                                isYellow || kindKey === 'future_late' || kindKey === 'future_early'
                                    ? 'text-white bg-[#2ECC71] hover:bg-[#27ae60]'
                                    : 'text-white bg-[#EA3D2F] hover:bg-[#d43528]'
                            }`}
                        >
                            {deciding
                                ? 'Saving…'
                                : isYellow
                                  ? 'Confirm'
                                  : 'Approve'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
