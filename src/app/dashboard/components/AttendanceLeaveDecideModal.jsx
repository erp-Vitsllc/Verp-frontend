'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import axiosInstance from '@/utils/axios';

function isPunchCorrectionKind(kind) {
    const key = String(kind || '');
    return key === 'yellow' || key === 'past_late' || key === 'future_late' || key === 'future_early';
}

function displayRequestDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
    if (!match) return String(value || '').trim() || '—';
    return `${match[3]}-${match[2]}-${match[1]}`;
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
    employeeMongoId = '',
    currentLabel = '',
    requestedLabel = '',
    requestedStatusKey = '',
    reason = '',
    attachmentName = '',
    attachmentUrl = '',
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
    readOnly = false,
    rejectFirst = false,
    error = '',
    onClose,
    onDecide,
    layerClassName = 'z-[90]',
}) {
    const [localError, setLocalError] = useState('');
    const [editingTimes, setEditingTimes] = useState(false);
    const [editIn, setEditIn] = useState('');
    const [editOut, setEditOut] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [sickAllowance, setSickAllowance] = useState(null);

    const isSickRequest =
        String(requestedStatusKey || '') === 'sick_leave' || /sick/i.test(String(requestedLabel || ''));

    useEffect(() => {
        if (!isOpen) return;
        setLocalError('');
        setEditingTimes(false);
        setRejecting(Boolean(rejectFirst));
        setRejectReason('');
        setEditIn(clockInputValue(timeIn || requestTimeIn));
        setEditOut(clockInputValue(timeOut || requestTimeOut));
    }, [isOpen, dateKey, rejectFirst, timeIn, timeOut, requestTimeIn, requestTimeOut]);

    useEffect(() => {
        if (!isOpen || !isSickRequest || !employeeMongoId) {
            setSickAllowance(null);
            return undefined;
        }
        let cancelled = false;
        setSickAllowance(null);
        (async () => {
            try {
                const response = await axiosInstance.get(
                    `/Leave/employees/${employeeMongoId}/attendance-profile`,
                    { skipToast: true },
                );
                const card = response.data?.summary?.yearCard || {};
                if (!cancelled) {
                    setSickAllowance({
                        used: Number(card?.used?.sick_leave) || 0,
                        allowed:
                            card?.sickAllowed == null || card?.sickAllowed === ''
                                ? null
                                : Number(card.sickAllowed) || 0,
                    });
                }
            } catch {
                if (!cancelled) setSickAllowance({ used: null, allowed: null });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, isSickRequest, employeeMongoId, dateKey]);

    if (!isOpen) return null;

    const kindKey = String(kind || '');
    const isMispunchRequest =
        String(requestedStatusKey || '') === 'mispunch' ||
        /mispunch/i.test(String(requestedLabel || '')) ||
        (kindKey === 'yellow' && (!String(timeIn || '').trim() || !String(timeOut || '').trim()));
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
    const handleReject = () => {
        if (readOnly) return;
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
                disabled={readOnly}
                onChange={(event) => setRejectReason(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-slate-800"
            />
        </label>
    ) : null;

    const sickUsedUp =
        isSickRequest &&
        sickAllowance &&
        sickAllowance.allowed != null &&
        Number(sickAllowance.used) >= Number(sickAllowance.allowed);

    if (isSickRequest) {
        const allowanceText = !sickAllowance
            ? 'Loading…'
            : `${sickAllowance.used == null ? '—' : sickAllowance.used} / ${sickAllowance.allowed == null ? '—' : sickAllowance.allowed}`;
        return (
            <div className={`fixed inset-0 ${layerClassName} flex items-center justify-center p-4`}>
                <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} disabled={deciding} />
                <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="border-b border-slate-100 px-5 py-4">
                        <h2 className="text-base font-semibold text-slate-900">Sick leave Request</h2>
                    </div>
                    <div className="space-y-2 px-5 py-4 text-sm text-slate-700">
                        <p><span className="text-slate-500">Employee Name: </span><strong>{employeeName || 'Employee'}</strong></p>
                        <p><span className="text-slate-500">Requested Date: </span>{displayRequestDate(dateKey)}</p>
                        <p><span className="text-slate-500">Current status: </span>{currentLabel || '—'}</p>
                        <p><span className="text-slate-500">Previous sick leaves: </span>{allowanceText}</p>
                        <p>
                            <span className="text-slate-500">Reason: </span>
                            <span className="whitespace-pre-wrap">{String(reason || '').trim() || '—'}</span>
                        </p>
                        <p>
                            <span className="text-slate-500">Attachment: </span>
                            {attachmentName || '—'}
                            {attachmentUrl ? (
                                <a href={attachmentUrl} target="_blank" rel="noreferrer" className="ml-2 font-semibold text-blue-600 hover:underline">
                                    Open
                                </a>
                            ) : null}
                        </p>
                        {sickUsedUp ? (
                            <p className="text-xs text-rose-600">
                                This year’s sick leave allowance is already used. Approve is unavailable.
                            </p>
                        ) : null}
                        {rejectReasonField}
                        {error || localError ? <p className="text-xs text-rose-500">{localError || error}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                        <button type="button" disabled={deciding} onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-600">Close</button>
                        <button type="button" disabled={readOnly || deciding || (rejecting && !String(rejectReason).trim())} onClick={handleReject} className="h-9 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-700 disabled:opacity-50">
                            {rejecting ? 'Confirm reject' : 'Reject'}
                        </button>
                        <button type="button" disabled={readOnly || deciding || rejecting} onClick={() => onDecide?.('approved', 'authorized_leave')} className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50">
                            Change to Auth
                        </button>
                        <button type="button" disabled={readOnly || deciding || rejecting || sickUsedUp || !sickAllowance} onClick={() => onDecide?.('approved', 'sick_leave')} className="h-9 rounded-lg bg-[#EA3D2F] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                            {deciding ? 'Saving…' : 'Approve'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const handleApprove = () => {
        if (readOnly) return;
        setLocalError('');
        onDecide?.(
            'approved',
            requestedStatusKey || '',
            '',
            isPunchCorrectionKind(kindKey) && (editIn || editOut) ? { timeIn: editIn, timeOut: editOut } : undefined,
        );
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} disabled={deciding} />
            <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Leave request</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{employeeName ? `${employeeName} · ` : ''}{dateKey}</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={deciding} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-sm">
                        <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold">Current status</p>
                        <p className="font-semibold text-slate-800">{currentLabel || '—'}</p>
                        <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mt-2">Status change to</p>
                        <p className="font-semibold text-slate-800">{requestedLabel || '—'}</p>
                        {rangeLabel || dayPartLabel ? <p className="text-slate-700 text-sm mt-2">{[rangeLabel, dayPartLabel].filter(Boolean).join(' · ')}</p> : null}
                        <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mt-2">Reason</p>
                        <p className="text-slate-700 text-sm whitespace-pre-wrap">{String(reason || '').trim() || '—'}</p>
                        {attachmentName ? (
                            <p className="text-slate-700 text-sm mt-2">
                                <span className="text-slate-500 text-xs uppercase tracking-wide font-semibold">Attachment </span>
                                {attachmentUrl ? (
                                    <a href={attachmentUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline">
                                        {attachmentName}
                                    </a>
                                ) : attachmentName}
                            </p>
                        ) : null}
                        {hrReview ? null : changedBy ? <p className="text-xs text-slate-500 mt-2">Changed by {changedBy}</p> : null}
                    </div>
                    {isMispunchRequest ? (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="text-xs text-slate-500">Check in
                                <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-semibold text-slate-800">{clockInputValue(timeIn) || 'Misspunched'}</p>
                            </div>
                            <div className="text-xs text-slate-500">Check out
                                <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-semibold text-slate-800">{clockInputValue(timeOut) || 'Misspunched'}</p>
                            </div>
                        </div>
                    ) : isPunchCorrectionKind(kindKey) ? (
                        <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs text-slate-500">Check in
                                <input type="time" value={editIn} disabled={readOnly} onChange={(event) => setEditIn(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" />
                            </label>
                            <label className="text-xs text-slate-500">Check out
                                <input type="time" value={editOut} disabled={readOnly} onChange={(event) => setEditOut(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" />
                            </label>
                        </div>
                    ) : null}
                    {rejectReasonField}
                    {localError || error ? <p className="text-xs text-rose-500">{localError || error}</p> : null}
                    <div className="flex items-center gap-2 pt-1">
                        <button type="button" disabled={readOnly || deciding || (rejecting && !String(rejectReason).trim())} onClick={handleReject} className="flex-1 h-10 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 disabled:opacity-50">
                            {rejecting ? 'Confirm reject' : 'Reject'}
                        </button>
                        <button type="button" disabled={deciding || readOnly || editingTimes} onClick={() => setEditingTimes(false)} className="hidden" />
                        <button type="button" disabled={deciding || readOnly} onClick={handleApprove} className="flex-1 h-10 rounded-xl text-sm font-semibold text-white bg-[#EA3D2F] disabled:opacity-50">
                            {deciding ? 'Saving…' : 'Approve'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
