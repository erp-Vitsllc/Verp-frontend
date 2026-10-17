'use client';

import { useEffect, useState } from 'react';

function clockInputValue(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim());
    if (!match) return '';
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function isAttendanceClarificationRequest(row) {
    const kind = String(row?.leaveRequestKind || '').trim();
    return kind === 'yellow' || kind === 'future_late' || kind === 'future_early' || kind === 'past_late';
}

export default function LeaveRequestDecisionCard({
    row,
    submitting = false,
    startEditing = false,
    canEdit = false,
    onAccept,
    onReject,
    onSave,
    onEdit,
}) {
    const [editing, setEditing] = useState(false);
    const [editIn, setEditIn] = useState('');
    const [editOut, setEditOut] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        setEditing(Boolean(startEditing));
        setRejecting(false);
        setRejectReason('');
        setEditIn(clockInputValue(row?.timeIn));
        setEditOut(clockInputValue(row?.timeOut));
    }, [row?.id, row?.timeIn, row?.timeOut, startEditing]);

    if (!row) return null;
    const pendingWith = String(row.pendingWithName || '').trim();
    const canDecide = row.canDecide === true && String(row.statusKey || 'pending') === 'pending';
    const clarification = isAttendanceClarificationRequest(row);
    const showDecide = canDecide;
    const showEdit = canDecide || (clarification && canEdit);
    const dateLabel =
        row.startDate && row.endDate
            ? row.startDate === row.endDate
                ? row.startDate
                : `${row.startDate} → ${row.endDate}`
            : row.startDate || '';

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="rounded-lg border border-[#DDE3EA] bg-[#F8FAFC] px-3 py-3 text-center">
                <p className="text-xs text-[#475467]">
                    Requested:{' '}
                    <span className="font-semibold text-[#111827]">{row.leaveType || 'Leave'}</span>
                </p>
                {dateLabel ? (
                    <p className="mt-0.5 text-[11px] text-[#667085]">{dateLabel}</p>
                ) : null}
                {row.requestedDate ? (
                    <p className="mt-0.5 text-[11px] text-[#667085]">Requested date: {row.requestedDate}</p>
                ) : null}
                {row.name ? (
                    <p className="mt-1 text-sm font-semibold text-[#111827]">
                        {row.name}
                        {row.employeeId ? (
                            <span className="font-medium text-[#667085]"> ({row.employeeId})</span>
                        ) : null}
                    </p>
                ) : null}
                {pendingWith ? (
                    <p className="mt-2 text-xs font-semibold text-[#B45309]">Pending with {pendingWith}</p>
                ) : null}
                {clarification && (row.timeIn || row.timeOut) && !editing ? (
                    <p className="mt-2 text-xs text-[#475467]">
                        Time: {row.timeIn || '—'} – {row.timeOut || '—'}
                    </p>
                ) : null}
                {clarification && editing ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                        <label className="text-[11px] text-[#667085]">
                            Check in
                            <input
                                type="time"
                                value={editIn}
                                onChange={(event) => setEditIn(event.target.value)}
                                className="mt-1 h-9 w-full rounded-lg border border-[#DDE3EA] bg-white px-2 text-sm text-[#111827]"
                            />
                        </label>
                        <label className="text-[11px] text-[#667085]">
                            Check out
                            <input
                                type="time"
                                value={editOut}
                                onChange={(event) => setEditOut(event.target.value)}
                                className="mt-1 h-9 w-full rounded-lg border border-[#DDE3EA] bg-white px-2 text-sm text-[#111827]"
                            />
                        </label>
                    </div>
                ) : null}
            </div>
            {showEdit ? (
                <>
                    {showDecide && row.approvalStage === 'pending_reportee' ? (
                        <p className="mt-3 text-center text-[11px] leading-snug text-[#6B7280]">
                            Accepting sends this request to HR. It is applied after HR accepts.
                        </p>
                    ) : null}
                    {rejecting ? (
                        <label className="mt-3 block text-xs font-semibold text-slate-500">
                            Reject reason
                            <textarea
                                value={rejectReason}
                                onChange={(event) => setRejectReason(event.target.value)}
                                rows={3}
                                className="mt-1 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm text-slate-800"
                            />
                        </label>
                    ) : null}
                    <div className="mt-4 flex gap-2">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => {
                                if (clarification && editing) {
                                    onSave?.(row, { timeIn: editIn, timeOut: editOut });
                                    return;
                                }
                                if (clarification) {
                                    setEditing(true);
                                    return;
                                }
                                onEdit?.(row);
                            }}
                            className="min-w-[88px] rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                            {clarification && editing ? 'Save' : 'Edit'}
                        </button>
                        {showDecide ? (
                            <button
                                type="button"
                                disabled={submitting || (rejecting && !String(rejectReason).trim())}
                                onClick={() => {
                                    if (!rejecting) {
                                        setRejecting(true);
                                        return;
                                    }
                                    onReject?.(row, String(rejectReason).trim());
                                }}
                                className="min-w-[110px] flex-1 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                            >
                                {rejecting ? 'Confirm reject' : 'Reject'}
                            </button>
                        ) : null}
                        {showDecide ? (
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() =>
                                    onAccept?.(
                                        row,
                                        clarification && editing
                                            ? { timeIn: editIn, timeOut: editOut }
                                            : undefined,
                                    )
                                }
                                className="min-w-[110px] flex-1 rounded-lg bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-60"
                            >
                                Accept
                            </button>
                        ) : null}
                    </div>
                </>
            ) : (
                <p className="mt-4 text-center text-xs text-[#6B7280]">
                    {pendingWith
                        ? `Only ${pendingWith} can accept or reject this request.`
                        : 'Waiting for the assigned approver.'}
                </p>
            )}
        </div>
    );
}
