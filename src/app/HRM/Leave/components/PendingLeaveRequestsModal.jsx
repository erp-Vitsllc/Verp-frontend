'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { navigateFromNotificationClick } from '@/utils/listReturnNavigation';
import { countVisibleLeavePendingInbox } from '../utils/leavePendingInboxCount';
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
    const itemsRef = useRef(items);
    itemsRef.current = items;

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
        load();
    }, [isOpen, load]);

    const decideRequest = async (row, decision) => {
        const raw = row?.raw || row;
        let meta = {};
        try {
            meta = typeof raw?.extra3 === 'string' ? JSON.parse(raw.extra3 || '{}') : raw?.extra3 || {};
        } catch {
            meta = {};
        }
        const attendanceId = String(meta.attendanceId || raw?.id || raw?.requestObjectId || '').trim();
        if (!attendanceId) return;
        if (decision === 'rejected' && !window.confirm('Reject this request?')) return;
        try {
            const response = await axiosInstance.post(
                '/Leave/pending-requests/decide',
                { attendanceId, decision },
                { skipToast: true },
            );
            toast({
                title: response.data?.advanced ? 'Sent to HR' : decision === 'approved' ? 'Accepted' : 'Rejected',
                description: response.data?.message || 'The request was updated.',
            });
            await load({ force: true });
            if (typeof onRefreshParent === 'function') onRefreshParent();
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Could not update request',
                description: e?.response?.data?.message || e.message || 'Failed to update this request.',
            });
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
            subtitle="Accept or reject requests that are pending with you."
            items={notificationRows}
            loading={loading && items.length === 0}
            refreshing={refreshing}
            emptyMessage="No pending leave notifications for you."
            onItemClick={handleRowActivate}
            getItemHref={(row) => buildLeaveDashboardNotificationPath(row?.raw || row) || ''}
            renderRowActions={(raw) => {
                let meta = {};
                try {
                    meta = typeof raw?.extra3 === 'string' ? JSON.parse(raw.extra3 || '{}') : raw?.extra3 || {};
                } catch {
                    meta = {};
                }
                if (meta.hubRequest || meta.canDecide === false || !meta.leaveDashboard) return null;
                return (
                    <div className="flex shrink-0 flex-col justify-center gap-1 pr-3">
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                decideRequest(raw, 'approved');
                            }}
                            className="rounded-md bg-[#16A34A] px-2 py-1 text-[11px] font-semibold text-white"
                        >
                            Accept
                        </button>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                decideRequest(raw, 'rejected');
                            }}
                            className="rounded-md bg-[#DC2626] px-2 py-1 text-[11px] font-semibold text-white"
                        >
                            Reject
                        </button>
                    </div>
                );
            }}
        />
    );
}
