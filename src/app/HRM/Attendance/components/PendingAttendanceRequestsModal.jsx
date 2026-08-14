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

function isCompanyShellName(name) {
    return /\(company\)\s*$/i.test(String(name || '').trim());
}

function buildAttendancePath(row) {
    if (isEmployeeHubRequestItem(row) || isEmployeeHubRequestItem(row?.raw)) {
        return buildEmployeeHubDashboardPath(row?.raw || row);
    }
    const empId = row?.employeeMongoId || row?.raw?.employeeMongoId || '';
    const date = row?.date || row?.extra1 || row?.raw?.date || '';
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
        const path = buildAttendancePath(row?.raw || row);
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

    return (
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
    );
}
