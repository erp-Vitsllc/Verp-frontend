'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { navigateFromNotificationClick } from '@/utils/listReturnNavigation';
import { buildLoanNotificationPath } from '@/utils/loanNotificationRouting';
import { shouldUseBlockingNotificationLoader } from '@/utils/notificationModalLoad';
import { mapPendingInboxToRow } from '@/utils/notificationInboxPresentation';
import NotificationInboxModal from '@/components/notifications/NotificationInboxModal';
import {
    LOAN_PENDING_INBOX_ENDPOINT,
    fetchLoanPendingInbox,
    getCachedPendingInbox,
} from '@/utils/pendingInboxFetch';
import {
    countVisibleLoanPendingInbox,
    notifyLoanPendingInboxChanged,
} from '../utils/loanPendingInboxCount';

function loanHref(row) {
    return buildLoanNotificationPath(row) || '';
}

export default function PendingLoanRequestsModal({
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
        const cached = !force ? getCachedPendingInbox(LOAN_PENDING_INBOX_ENDPOINT) : null;
        if (cached && itemsRef.current.length === 0) {
            setItems(cached);
            const count = countVisibleLoanPendingInbox(cached);
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
            const list = await fetchLoanPendingInbox(axiosInstance, { force });
            setItems(list);
            const count = countVisibleLoanPendingInbox(list);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(count);
            }
            notifyLoanPendingInboxChanged();
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: e?.response?.data?.message || 'Could not load loan notifications.',
            });
            if (itemsRef.current.length === 0) setItems([]);
            if (typeof onPendingInboxCount === 'function') onPendingInboxCount(0);
            notifyLoanPendingInboxChanged();
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast, onPendingInboxCount]);

    useEffect(() => {
        // Warm count for page bell + sidebar/dashboard on mount
        load({ force: true });
    }, [load]);

    useEffect(() => {
        if (!isOpen) return;
        load({ force: true });
    }, [isOpen, load]);

    const handleRowActivate = (row) => {
        const path = loanHref(row);
        if (!path) {
            toast({
                variant: 'destructive',
                title: 'Unable to open',
                description: 'Could not resolve this loan notification.',
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
            title="Loan & Advance notifications"
            subtitle="Approvals and pay-to-employee tasks pending with your account."
            items={notificationRows}
            loading={loading && items.length === 0}
            refreshing={refreshing}
            emptyMessage="No pending loan/advance notifications for you."
            onItemClick={handleRowActivate}
            getItemHref={(row) => loanHref(row)}
        />
    );
}
