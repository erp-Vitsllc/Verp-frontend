'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { navigateFromNotificationClick } from '@/utils/listReturnNavigation';
import { countVisibleLeavePendingInbox, notifyLeavePendingInboxChanged } from '../utils/leavePendingInboxCount';
import { isAdmin } from '@/utils/permissions';
import { buildLeaveDashboardNotificationPath } from '../utils/leaveNotificationRouting';
import { shouldUseBlockingNotificationLoader } from '@/utils/notificationModalLoad';
import {
    LEAVE_PENDING_INBOX_ENDPOINT,
    fetchLeavePendingInbox,
    getCachedPendingInbox,
} from '@/utils/pendingInboxFetch';
import { mapPendingInboxToRow } from '@/utils/notificationInboxPresentation';
import NotificationInboxModal from '@/components/notifications/NotificationInboxModal';

export default function PendingLeaveRequestsModal({
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
    const [canDelete, setCanDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const itemsRef = useRef(items);
    itemsRef.current = items;

    useEffect(() => {
        setCanDelete(isAdmin());
    }, []);

    const notificationRows = useMemo(
        () => items.map((row, index) => mapPendingInboxToRow(row, index)),
        [items],
    );

    const load = useCallback(
        async ({ force = false } = {}) => {
            const cached = !force ? getCachedPendingInbox(LEAVE_PENDING_INBOX_ENDPOINT) : null;
            if (cached && itemsRef.current.length === 0) {
                setItems(cached);
                const count = countVisibleLeavePendingInbox(cached);
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
                const list = await fetchLeavePendingInbox(axiosInstance, { force });
                setItems(list);
                const count = countVisibleLeavePendingInbox(list);
                if (typeof onPendingInboxCount === 'function') {
                    onPendingInboxCount(count);
                }
            } catch (e) {
                console.error(e);
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: e?.response?.data?.message || 'Could not load leave notifications.',
                });
                if (itemsRef.current.length === 0) {
                    setItems([]);
                }
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
        load({ force: true });
    }, [isOpen, load]);

    const handleDelete = async (raw) => {
        if (!canDelete || deleting) return;
        const name = String(raw?.subjectName || raw?.requestedByName || 'this request').trim();
        const confirmed = window.confirm(
            `Delete ${name}? The request, its task, and the bell notification are removed.`,
        );
        if (!confirmed) return;
        setDeleting(true);
        try {
            await axiosInstance.post(
                '/Leave/dashboard/pending-inbox/delete',
                {
                    id: raw?.id,
                    dashboardActionId: raw?.dashboardActionId,
                    requestObjectId: raw?.requestObjectId,
                    requestType: raw?.requestType || raw?.type,
                    extra3: raw?.extra3,
                    hubRequest: raw?.hubRequest,
                },
                { skipToast: true },
            );
            toast({
                title: 'Deleted',
                description: 'The request, its task, and the notification were removed.',
            });
            notifyLeavePendingInboxChanged();
            await load({ force: true });
            if (typeof onRefreshParent === 'function') onRefreshParent();
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Could not delete',
                description: e?.response?.data?.message || e.message || 'Failed to delete this request.',
            });
        } finally {
            setDeleting(false);
        }
    };

    const handleRowActivate = (row) => {
        const path = buildLeaveDashboardNotificationPath(row?.raw || row);
        if (!path) {
            toast({
                variant: 'destructive',
                title: 'Unable to open',
                description: 'Could not resolve this leave notification.',
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
            title="Leave notifications"
            subtitle="Open a request to accept or reject it in Leave Approval."
            items={notificationRows}
            loading={loading && items.length === 0}
            refreshing={refreshing}
            emptyMessage="No pending leave notifications for you."
            onItemClick={handleRowActivate}
            getItemHref={(row) => buildLeaveDashboardNotificationPath(row?.raw || row) || ''}
            showHoverChevron={false}
            onDelete={canDelete ? handleDelete : undefined}
            deleteTitle="Delete request, task, and notification"
        />
    );
}
