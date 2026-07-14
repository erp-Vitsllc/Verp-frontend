'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
    buildRewardNotificationPath,
    normalizeRewardNotificationItem,
} from '@/utils/rewardNotificationRouting';
import { navigateFromNotificationClick } from '@/utils/listReturnNavigation';
import {
    countVisibleRewardPendingInbox,
    notifyRewardPendingInboxChanged,
} from '../utils/rewardPendingInboxCount';
import { shouldUseBlockingNotificationLoader } from '@/utils/notificationModalLoad';
import {
    REWARD_PENDING_INBOX_ENDPOINT,
    fetchRewardPendingInbox,
    getCachedPendingInbox,
} from '@/utils/pendingInboxFetch';
import { mapPendingInboxToRow } from '@/utils/notificationInboxPresentation';
import NotificationInboxModal from '@/components/notifications/NotificationInboxModal';

export default function PendingRewardRequestsModal({
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
        const cached = !force ? getCachedPendingInbox(REWARD_PENDING_INBOX_ENDPOINT) : null;
        if (cached && itemsRef.current.length === 0) {
            setItems(cached);
            const count = countVisibleRewardPendingInbox(cached);
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
            const list = await fetchRewardPendingInbox(axiosInstance, { force });
            setItems(list);
            const count = countVisibleRewardPendingInbox(list);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(count);
            }
            notifyRewardPendingInboxChanged();
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: e?.response?.data?.message || 'Could not load reward notifications.',
            });
            if (itemsRef.current.length === 0) {
                setItems([]);
            }
            if (typeof onPendingInboxCount === 'function') onPendingInboxCount(0);
            notifyRewardPendingInboxChanged();
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
        const path = buildRewardNotificationPath(normalizeRewardNotificationItem(row));
        if (!path) {
            toast({
                variant: 'destructive',
                title: 'Unable to open',
                description: 'Could not resolve this reward notification.',
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
            title="Reward notifications"
            subtitle="Track steps assigned to you: requester, reportee, accounts, management, and payment."
            items={notificationRows}
            loading={loading && items.length === 0}
            refreshing={refreshing}
            emptyMessage="No pending reward notifications for you."
            onItemClick={handleRowActivate}
            getItemHref={(row) => buildRewardNotificationPath(normalizeRewardNotificationItem(row)) || ''}
        />
    );
}
