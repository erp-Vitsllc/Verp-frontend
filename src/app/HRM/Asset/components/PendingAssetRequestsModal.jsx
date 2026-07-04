'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import ConfirmAlertDialog from '@/components/ConfirmAlertDialog';
import { useRouter } from 'next/navigation';
import BulkPendingResolveModal from './BulkPendingResolveModal';
import OwnerOnDutyReviewModal from './OwnerOnDutyReviewModal';
import { isPendingInboxRowVisible } from '../utils/assetRequestLabels';
import { countVisibleAssetPendingInbox, dedupeAssetPendingInboxItems, invalidateAssetPendingInbox } from '../utils/assetPendingInboxCount';
import { buildAssetNotificationPath, normalizeAssetNotificationItem } from '@/utils/assetNotificationRouting';
import { navigateFromNotificationClick } from '@/utils/listReturnNavigation';
import { canDismissAssetInboxNotifications } from '@/utils/permissions';
import { shouldUseBlockingNotificationLoader } from '@/utils/notificationModalLoad';
import {
    ASSET_PENDING_INBOX_ENDPOINT,
    fetchAssetPendingInbox,
    getCachedPendingInbox,
    rememberPendingInbox,
} from '@/utils/pendingInboxFetch';
import { mapAssetPendingInboxToRow } from '@/utils/notificationInboxPresentation';
import NotificationInboxModal from '@/components/notifications/NotificationInboxModal';

/**
 * Pending inbox: one row per dashboard item. Single-asset rows navigate to the asset.
 * Bulk groups open a sub-modal to approve/reject per asset.
 */
/**
 * @param {'all'|'tools'|'vehicle'} inboxScope — tools = equipment inbox (excludes vehicle service workflow); vehicle = fleet only.
 */
export default function PendingAssetRequestsModal({
    isOpen,
    onClose,
    onRefreshParent,
    inboxScope = 'all',
    onPendingInboxCount,
}) {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [items, setItems] = useState([]);
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const [bulkRow, setBulkRow] = useState(null);
    const [ownerOnDutyRow, setOwnerOnDutyRow] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [canDeleteNotifications, setCanDeleteNotifications] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setCanDeleteNotifications(canDismissAssetInboxNotifications());
    }, [isOpen]);

    const load = useCallback(async ({ force = false, sync = false } = {}) => {
        const cacheParams =
            inboxScope === 'tools' || inboxScope === 'vehicle' ? { scope: inboxScope } : {};
        const cached = !force ? getCachedPendingInbox(ASSET_PENDING_INBOX_ENDPOINT, cacheParams) : null;

        if (cached?.length && itemsRef.current.length === 0) {
            const dedupedCached = dedupeAssetPendingInboxItems(cached);
            setItems(dedupedCached);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(countVisibleAssetPendingInbox(dedupedCached));
            }
        }

        const hasVisibleItems =
            itemsRef.current.length > 0 || (cached?.length ?? 0) > 0;
        const block = shouldUseBlockingNotificationLoader(hasVisibleItems ? 1 : 0);
        if (block) setLoading(true);
        else setRefreshing(true);
        try {
            const list = dedupeAssetPendingInboxItems(
                await fetchAssetPendingInbox(axiosInstance, {
                inboxScope,
                skipSync: !sync,
                skipToast: true,
                force,
            }),
            );
            setItems(list);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(countVisibleAssetPendingInbox(list));
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message || 'Could not load pending requests.' });
            if (itemsRef.current.length === 0) {
                setItems([]);
            }
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(0);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast, inboxScope, onPendingInboxCount]);

    useEffect(() => {
        if (!isOpen) return;
        load({ sync: inboxScope === 'vehicle' });
        setBulkRow(null);
    }, [isOpen, load, inboxScope]);

    const handleRowActivate = (row) => {
        if (row.requestType === 'Asset Owner On Duty' && row.dashboardActionId) {
            setOwnerOnDutyRow(row);
            return;
        }

        const path = buildAssetNotificationPath(normalizeAssetNotificationItem(row));
        if (path) {
            navigateFromNotificationClick(router, path);
            onClose();
            return;
        }

        if (
            row.isBulk &&
            row.bulkKind !== 'assignment' &&
            Array.isArray(row.bulkAssetIds) &&
            row.bulkAssetIds.length > 1
        ) {
            setBulkRow(row);
            return;
        }

        toast({
            variant: 'destructive',
            title: 'Missing asset',
            description: 'Could not resolve this request.',
        });
    };

    const executeDeleteNotification = async () => {
        const row = deleteTarget;
        if (!row) return;
        const actionId = row.dashboardActionId;
        if (!actionId) return;
        setDeletingId(actionId);
        try {
            await axiosInstance.delete(`/AssetItem/dashboard/pending-inbox/${actionId}`);
            setItems((prev) => {
                const next = prev.filter((item) => item.dashboardActionId !== actionId);
                const cacheParams =
                    inboxScope === 'tools' || inboxScope === 'vehicle' ? { scope: inboxScope } : {};
                rememberPendingInbox(ASSET_PENDING_INBOX_ENDPOINT, cacheParams, next);
                if (typeof onPendingInboxCount === 'function') {
                    onPendingInboxCount(countVisibleAssetPendingInbox(next));
                }
                return next;
            });
            invalidateAssetPendingInbox(inboxScope === 'vehicle' ? 'vehicle' : inboxScope === 'tools' ? 'tools' : 'all');
            toast({ title: 'Notification removed' });
            setBulkRow((prev) => (prev?.dashboardActionId === actionId ? null : prev));
            await load({ force: true });
            onRefreshParent?.();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not remove',
                description: err?.response?.data?.message || 'Try again.',
            });
        } finally {
            setDeletingId(null);
            setDeleteTarget(null);
        }
    };

    const visibleRows = dedupeAssetPendingInboxItems(items).filter(isPendingInboxRowVisible);
    const notificationRows = useMemo(
        () => visibleRows.map((row, index) => mapAssetPendingInboxToRow(row, index)),
        [visibleRows],
    );

    const modalTitle =
        inboxScope === 'vehicle'
            ? 'Vehicle pending'
            : inboxScope === 'tools'
              ? 'Tools & equipment pending'
              : 'Pending requests';

    if (!isOpen) return null;

    return (
        <>
            {!bulkRow && !ownerOnDutyRow && (
                <NotificationInboxModal
                    isOpen={isOpen}
                    onClose={onClose}
                    title={modalTitle}
                    items={notificationRows}
                    loading={loading && visibleRows.length === 0}
                    refreshing={refreshing}
                    hideItemTitle
                    emptyMessage={
                        inboxScope === 'vehicle'
                            ? 'No pending vehicle tasks in your inbox.'
                            : 'No pending asset requests in your inbox.'
                    }
                    onItemClick={handleRowActivate}
                    onDelete={
                        canDeleteNotifications
                            ? (row) => setDeleteTarget(row)
                            : undefined
                    }
                />
            )}

            <BulkPendingResolveModal
                isOpen={!!bulkRow}
                row={bulkRow}
                onClose={() => setBulkRow(null)}
                onSuccess={() => {
                    load();
                    onRefreshParent?.();
                }}
            />
            <OwnerOnDutyReviewModal
                isOpen={!!ownerOnDutyRow}
                dashboardActionId={ownerOnDutyRow?.dashboardActionId}
                onClose={() => {
                    setOwnerOnDutyRow(null);
                }}
                onCompleted={() => {
                    setOwnerOnDutyRow(null);
                    load();
                    onRefreshParent?.();
                }}
            />
            <ConfirmAlertDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => !open && !deletingId && setDeleteTarget(null)}
                title="Remove notification?"
                description={
                    deleteTarget?.isCreatorOutcome
                        ? 'Remove this notification from your list? You can still edit or delete the draft asset from its detail page.'
                        : 'Remove this notification from the inbox? Only administrators can dismiss items assigned to other users.'
                }
                confirmLabel="Remove"
                destructive
                loading={Boolean(deletingId)}
                onConfirm={executeDeleteNotification}
            />
        </>
    );
}
