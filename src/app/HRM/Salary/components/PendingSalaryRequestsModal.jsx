'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { navigateFromNotificationClick } from '@/utils/listReturnNavigation';
import { shouldUseBlockingNotificationLoader } from '@/utils/notificationModalLoad';
import { mapPendingInboxToRow } from '@/utils/notificationInboxPresentation';
import NotificationInboxModal from '@/components/notifications/NotificationInboxModal';
import {
    SALARY_PENDING_INBOX_ENDPOINT,
    fetchSalaryPendingInbox,
    getCachedPendingInbox,
} from '@/utils/pendingInboxFetch';
import { countVisibleSalaryPendingInbox, mergeSalaryInboxWithPendingEnrollments } from '../utils/salaryPendingInboxCount';

function salaryHref(row) {
    const raw = row?.raw || row;
    if (raw?.href) return String(raw.href);
    const employeeId =
        raw?.subjectEmployeeId ||
        raw?.employeeId ||
        row?.subjectEmployeeId ||
        '';
    if (employeeId) return `/HRM/Salary/enroll/${encodeURIComponent(employeeId)}`;
    const monthKey = raw?.monthKey || '';
    if (monthKey) return `/HRM/Salary/${encodeURIComponent(monthKey)}`;
    return '';
}

export default function PendingSalaryRequestsModal({
    isOpen,
    onClose,
    onRefreshParent,
    onPendingInboxCount,
    enrollmentOverview = null,
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
        const cached = !force ? getCachedPendingInbox(SALARY_PENDING_INBOX_ENDPOINT) : null;
        if (cached && itemsRef.current.length === 0) {
            const merged = mergeSalaryInboxWithPendingEnrollments(cached, enrollmentOverview);
            setItems(merged);
            const count = countVisibleSalaryPendingInbox(merged);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(count);
            }
        }

        if (cached && !force) {
            const merged = mergeSalaryInboxWithPendingEnrollments(cached, enrollmentOverview);
            setItems(merged);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(countVisibleSalaryPendingInbox(merged));
            }
            return;
        }

        const block = shouldUseBlockingNotificationLoader(
            itemsRef.current.length || (cached?.length ?? 0),
        );
        if (block) setLoading(true);
        else setRefreshing(true);
        try {
            const list = await fetchSalaryPendingInbox(axiosInstance, { force });
            const merged = mergeSalaryInboxWithPendingEnrollments(list, enrollmentOverview);
            setItems(merged);
            const count = countVisibleSalaryPendingInbox(merged);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(count);
            }
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: e?.response?.data?.message || 'Could not load salary notifications.',
            });
            const fallback = mergeSalaryInboxWithPendingEnrollments([], enrollmentOverview);
            if (itemsRef.current.length === 0) setItems(fallback);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(countVisibleSalaryPendingInbox(fallback));
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast, onPendingInboxCount, enrollmentOverview]);

    useEffect(() => {
        if (!isOpen) return;
        load();
    }, [isOpen, load]);

    const handleRowActivate = (row) => {
        const path = salaryHref(row);
        if (!path) {
            toast({
                variant: 'destructive',
                title: 'Unable to open',
                description: 'Could not open this salary notification.',
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
            title="Salary notifications"
            subtitle="Pending enrollments, salary profile approvals, and payroll waiting for you."
            items={notificationRows}
            loading={loading && items.length === 0}
            refreshing={refreshing}
            emptyMessage="No pending salary notifications for you."
            onItemClick={handleRowActivate}
            getItemHref={(row) => salaryHref(row)}
        />
    );
}
