'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { navigateFromNotificationClick } from '@/utils/listReturnNavigation';
import {
    countVisibleAttendancePendingInbox,
} from '../utils/attendancePendingInboxCount';
import { shouldUseBlockingNotificationLoader } from '@/utils/notificationModalLoad';
import {
    ATTENDANCE_PENDING_INBOX_ENDPOINT,
    fetchAttendancePendingInbox,
    getCachedPendingInbox,
} from '@/utils/pendingInboxFetch';
import { mapPendingInboxToRow } from '@/utils/notificationInboxPresentation';
import NotificationInboxModal from '@/components/notifications/NotificationInboxModal';
import { buildEmployeeHubDashboardPath, isEmployeeHubRequestItem } from '@/utils/employeeHubRequest';
import { notifyAttendancePendingInboxChanged } from '../utils/attendancePendingInboxCount';

function isAttendanceChangeItem(row) {
    const raw = row?.raw || row || {};
    return (
        raw.leaveRequestKind === 'attendance_change' ||
        raw.requestType === 'Attendance Change Request' ||
        row?.requestType === 'Attendance Change Request'
    );
}

function isCompanyShellName(name) {
    return /\(company\)\s*$/i.test(String(name || '').trim());
}

function buildAttendancePath(row) {
    if (isEmployeeHubRequestItem(row) || isEmployeeHubRequestItem(row?.raw)) {
        return buildEmployeeHubDashboardPath(row?.raw || row);
    }
    const empId = row?.employeeMongoId || row?.raw?.employeeMongoId || '';
    const date = row?.date || row?.extra1 || row?.raw?.date || '';
    if (isAttendanceChangeItem(row)) return '';
    if (row?.leaveRequestKind === 'flexible_ot' || row?.requestType === 'Flexible OT Request') {
        const qs = new URLSearchParams({
            date: String(date || ''),
            staffType: String(row?.staffType || row?.raw?.staffType || 'office'),
            otAttendanceId: String(row?.id || row?.dashboardActionId || ''),
        });
        return `/HRM/Attendance/mark?${qs.toString()}`;
    }
    if (row?.leaveRequestKind === 'hour_adjust' || row?.requestType === 'Hour Approval Request') {
        const qs = new URLSearchParams({
            date: String(date || ''),
            staffType: String(row?.staffType || row?.raw?.staffType || 'office'),
            hourAttendanceId: String(row?.id || row?.dashboardActionId || ''),
        });
        return `/HRM/Attendance/mark?${qs.toString()}`;
    }
    if (!empId) return '';
    const qs = new URLSearchParams({
        focusAttendance: '1',
        attendanceEmployeeId: String(empId),
    });
    if (date) qs.set('attendanceDate', String(date));
    return `/dashboard?${qs.toString()}`;
}

/** Shape attendance inbox API rows like Fine/Reward for the shared notification tab. */
function normalizeAttendanceInboxItem(row = {}) {
    if (isAttendanceChangeItem(row)) {
        const summary = row.extra2 || row.message || 'Attendance change waiting for approval';
        return {
            ...row,
            requestType: 'Attendance Change Request',
            type: 'Attendance Change Request',
            subjectName: row.subjectName || row.employeeName || 'Employee',
            status: row.status || 'Pending',
            extra1: summary,
            extra2: summary,
            message: summary,
        };
    }
    const isYellow = String(row.leaveRequestKind || '') === 'yellow';
    const subject = row.subjectName || row.employeeName || 'Employee';
    const summary =
        row.extra2 ||
        row.message ||
        (isYellow
            ? `Clarification: mark as Present${row.date ? ` (${row.date})` : ''}`
            : `Leave change: ${row.requestedStatusLabel || 'status update'}${row.date ? ` (${row.date})` : ''}`);

    return {
        ...row,
        requestType: row.requestType || 'Attendance Leave Request',
        type: row.requestType || row.type || 'Attendance Leave Request',
        subjectName: subject,
        requestedByName: subject,
        requestedBy: subject,
        status: row.status || 'Pending',
        extra1: row.extra1 || row.date || '',
        extra2: summary,
        reason: row.reason || row.leaveRequestReason || '',
        requestedDate: row.leaveRequestedAt || row.requestedDate || row.createdAt || null,
        employeeMongoId: row.employeeMongoId || '',
        date: row.date || '',
    };
}

export default function PendingAttendanceRequestsModal({
    isOpen,
    onClose,
    onRefreshParent,
    onPendingInboxCount,
}) {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [items, setItems] = useState([]);
    const [review, setReview] = useState(null);
    const [deciding, setDeciding] = useState(false);
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const notificationRows = useMemo(
        () => items.map((row, index) => mapPendingInboxToRow(row, index)),
        [items],
    );

    const load = useCallback(async ({ force = false } = {}) => {
        const cached = !force ? getCachedPendingInbox(ATTENDANCE_PENDING_INBOX_ENDPOINT) : null;
        if (cached && itemsRef.current.length === 0) {
            const peopleOnly = (Array.isArray(cached) ? cached : [])
                .filter((row) => !isCompanyShellName(row.subjectName || row.employeeName))
                .map(normalizeAttendanceInboxItem);
            setItems(peopleOnly);
            const count = countVisibleAttendancePendingInbox(peopleOnly);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(count);
            }
        }

        if (cached && !force) {
            return;
        }

        const block = shouldUseBlockingNotificationLoader(
            itemsRef.current.length || (cached?.length ?? 0),
        );
        if (block) setLoading(true);
        else setRefreshing(true);
        try {
            const list = await fetchAttendancePendingInbox(axiosInstance, { force });
            const peopleOnly = (Array.isArray(list) ? list : [])
                .filter((row) => !isCompanyShellName(row.subjectName || row.employeeName))
                .map(normalizeAttendanceInboxItem);
            setItems(peopleOnly);
            const count = countVisibleAttendancePendingInbox(peopleOnly);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(count);
            }
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: e?.response?.data?.message || 'Could not load attendance notifications.',
            });
            if (itemsRef.current.length === 0) {
                setItems([]);
            }
            if (typeof onPendingInboxCount === 'function') onPendingInboxCount(0);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast, onPendingInboxCount]);

    useEffect(() => {
        if (!isOpen) return;
        load();
    }, [isOpen, load]);

    const handleRowActivate = (row) => {
        const source = row?.raw || row;
        if (isAttendanceChangeItem(source)) {
            setReview(source);
            return;
        }
        const path = buildAttendancePath(source);
        if (!path) {
            toast({
                variant: 'destructive',
                title: 'Unable to open',
                description: 'Could not resolve this attendance notification.',
            });
            return;
        }
        navigateFromNotificationClick(router, path);
        onClose();
        if (typeof onRefreshParent === 'function') onRefreshParent();
    };

    const decideChange = async (decision) => {
        const id = String(review?.id || review?.dashboardActionId || '').trim();
        if (!id || deciding) return;
        setDeciding(true);
        try {
            const res = await axiosInstance.post('/Attendance/change-request/decide', {
                id,
                decision,
            });
            toast({
                title: decision === 'approved' ? 'Approved' : 'Rejected',
                description: res.data?.message || 'Attendance change updated.',
            });
            setReview(null);
            notifyAttendancePendingInboxChanged();
            await load({ force: true });
            if (typeof onRefreshParent === 'function') onRefreshParent();
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Could not update',
                description: e?.response?.data?.message || 'The attendance change was not updated.',
            });
        } finally {
            setDeciding(false);
        }
    };

    const waitingOnHr = review?.changeStage === 'pending_hr';

    return (
        <>
            <NotificationInboxModal
                isOpen={isOpen}
                onClose={onClose}
                title="Attendance notifications"
                subtitle="Pending attendance requests assigned to you."
                items={notificationRows}
                loading={loading && items.length === 0}
                refreshing={refreshing}
                emptyMessage="No pending attendance notifications for you."
                onItemClick={handleRowActivate}
                getItemHref={(row) => buildAttendancePath(row?.raw || row) || ''}
            />
            {review ? (
                <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/45">
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
                    >
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h2 className="text-base font-semibold text-slate-900">
                                {waitingOnHr ? 'HR approval' : 'Primary reportee approval'}
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">
                                {waitingOnHr
                                    ? 'Approving this updates the attendance day.'
                                    : 'Approving this sends the change to HR. The day stays as it is until HR approves.'}
                            </p>
                        </div>
                        <div className="px-5 py-4 space-y-2 text-sm text-slate-700">
                            <p>
                                <span className="text-slate-500">Employee: </span>
                                <strong>{review.subjectName || 'Employee'}</strong>
                                {review.employeeId ? ` (${review.employeeId})` : ''}
                            </p>
                            <p>
                                <span className="text-slate-500">Date: </span>
                                {review.date || '—'}
                            </p>
                            <p>
                                <span className="text-slate-500">Changed by: </span>
                                {review.requestedByName || '—'}
                            </p>
                            <p>
                                <span className="text-slate-500">Currently: </span>
                                {review.previousStatusLabel || 'Not marked'}
                            </p>
                            <p>
                                <span className="text-slate-500">Requested: </span>
                                {review.requestedStatusLabel || 'Updated'}
                            </p>
                            {review.timeIn || review.timeOut ? (
                                <p>
                                    <span className="text-slate-500">Time: </span>
                                    {review.timeIn || '—'} – {review.timeOut || '—'}
                                </p>
                            ) : null}
                            {review.reason ? (
                                <p>
                                    <span className="text-slate-500">Reason: </span>
                                    {review.reason}
                                </p>
                            ) : null}
                        </div>
                        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                disabled={deciding}
                                onClick={() => setReview(null)}
                                className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-600"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                disabled={deciding}
                                onClick={() => decideChange('rejected')}
                                className="h-9 px-3 rounded-lg border border-rose-200 text-sm font-semibold text-rose-700"
                            >
                                Reject
                            </button>
                            <button
                                type="button"
                                disabled={deciding}
                                onClick={() => decideChange('approved')}
                                className="h-9 px-4 rounded-lg bg-[#EA3D2F] text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {deciding ? 'Saving…' : 'Approve'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
