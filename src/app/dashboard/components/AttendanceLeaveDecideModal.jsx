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
        key: 'unauthorized_leave',
        label: 'Unauthorized Leave',
        swatch: 'bg-[#E74C3C]',
        selected: 'border-[#E74C3C] bg-rose-50/80',
    },
];

const PAY_OPTIONS = [
    { key: 'paid', label: 'Paid' },
    { key: 'unpaid', label: 'Unpaid' },
];

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
    requestTimeIn = '',
    requestTimeOut = '',
    deciding = false,
    error = '',
    onClose,
    onDecide,
}) {
    const [chosenKey, setChosenKey] = useState('');
    const [leavePayType, setLeavePayType] = useState('');
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setChosenKey('');
        setLeavePayType('');
        setLocalError('');
    }, [isOpen, dateKey]);

    if (!isOpen) return null;

    const kindKey = String(kind || '');
    const isMultiDay = Boolean(fromDate && toDate && fromDate !== toDate);
    const rangeLabel = isMultiDay ? `${fromDate} → ${toDate}` : '';
    const dayPartLabel =
        dayPart === 'half'
            ? requestTimeIn && requestTimeOut
                ? `Half day · ${requestTimeIn} – ${requestTimeOut}`
                : 'Half day'
            : dayPart === 'full'
              ? 'Full day'
              : '';
    const isYellow = kindKey === 'yellow';
    const isFutureKind = kindKey.startsWith('future_');
    const skipStatusPicker = isYellow || isFutureKind;
    const needsPayType = kindKey === 'future_leave' || chosenKey === 'authorized_leave';

    const title =
        kindKey === 'future_late'
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
        : kindKey === 'future_leave'
          ? `Approve marks ${isMultiDay ? 'every working day in this range' : 'this future day'} as Authorized Leave (Paid or Unpaid). Reject keeps ${isMultiDay ? 'them' : 'it'} upcoming.`
          : kindKey === 'future_late'
            ? `Approve shows ${isMultiDay ? 'every working day in this range' : 'this future day'} green as Late arrival approved${
                  dayPart === 'half' && requestTimeIn && requestTimeOut
                      ? ` (${requestTimeIn} – ${requestTimeOut})`
                      : ''
              }.`
            : kindKey === 'future_early'
              ? 'Approve shows this future day green as Early go approved.'
              : 'Approve applies the status you choose. Reject keeps the current status.';

    const handleApprove = () => {
        if (!skipStatusPicker && !chosenKey) {
            setLocalError('Choose Authorized, Sick, or Unauthorized leave before approving.');
            return;
        }
        if (needsPayType && !leavePayType) {
            setLocalError('Choose Paid or Unpaid for authorized leave.');
            return;
        }
        setLocalError('');
        onDecide?.('approved', chosenKey, needsPayType ? leavePayType : '');
    };

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
                                                if (opt.key !== 'authorized_leave') setLeavePayType('');
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

                    {needsPayType ? (
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Leave pay
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {PAY_OPTIONS.map((opt) => {
                                    const active = leavePayType === opt.key;
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            disabled={deciding}
                                            onClick={() => {
                                                setLeavePayType(opt.key);
                                                setLocalError('');
                                            }}
                                            className={`h-11 rounded-xl border text-sm font-semibold transition-all disabled:opacity-50 ${
                                                active
                                                    ? opt.key === 'paid'
                                                        ? 'border-[#2563EB] bg-blue-50 text-blue-800 shadow-sm'
                                                        : 'border-[#4F46E5] bg-indigo-50 text-indigo-800 shadow-sm'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}

                    <p className="text-xs text-slate-500">{helpText}</p>
                    {localError || error ? (
                        <p className="text-xs text-rose-500">{localError || error}</p>
                    ) : null}
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            disabled={deciding}
                            onClick={() => onDecide?.('rejected')}
                            className="flex-1 h-10 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Reject
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
