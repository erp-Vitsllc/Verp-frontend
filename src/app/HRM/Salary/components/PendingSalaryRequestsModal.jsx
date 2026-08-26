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
import { countVisibleSalaryPendingInbox } from '../utils/salaryPendingInboxCount';

function salaryHref(row) {
    const raw = row?.raw || row;
    if (raw?.href) return String(raw.href);
    const employeeId =
        raw?.subjectEmployeeId ||
        raw?.employeeId ||
        row?.subjectEmployeeId ||
        '';
    if (!employeeId) return '';
    return `/HRM/Salary/enroll/${encodeURIComponent(employeeId)}`;
}

export default function PendingSalaryRequestsModal({
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

    const load = useCallback(
        async ({ force = false } = {}) => {
            const cached = !force ? getCachedPendingInbox(SALARY_PENDING_INBOX_ENDPOINT) : null;
            if (cached && itemsRef.current.length === 0) {
                setItems(cached);
                const count = countVisibleSalaryPendingInbox(cached);
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
                const list = await fetchSalaryPendingInbox(axiosInstance, { force });
                setItems(list);
                const count = countVisibleSalaryPendingInbox(list);
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
                if (itemsRef.current.length === 0) setItems([]);
                if (typeof onPendingInboxCount === 'function') onPendingInboxCount(0);
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [toast, onPendingInboxCount],
    );

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
                description: 'Could not resolve this salary notification.',
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
            subtitle="Salary profile approvals pending with flowchart HR."
            items={notificationRows}
            loading={loading && items.length === 0}
            refreshing={refreshing}
            emptyMessage="No pending salary profile approvals for you."
            onItemClick={handleRowActivate}
            getItemHref={(row) => salaryHref(row)}
        />
    );
}
