import { isPendingInboxRowVisible, isAcceptedAssignmentOutcomeInboxRow } from './assetRequestLabels';
import { isDisplayableAssetPendingInboxRow } from '@/utils/assetNotificationRouting';
import {
    ASSET_PENDING_INBOX_ENDPOINT,
    clearPendingInboxCache,
} from '@/utils/pendingInboxFetch';

export const ASSET_PENDING_INBOX_CHANGED = 'asset-pending-inbox-changed';

function parseInboxExtra3(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(String(raw));
    } catch {
        return null;
    }
}

/** Prefer API pending-inbox rows; drop duplicate DashboardAction copies from module merge. */
export function dedupeAssetPendingInboxItems(items) {
    const list = Array.isArray(items) ? items : [];
    const seenActionIds = new Set();
    const seenAssignmentAssets = new Set();
    const vehicleServiceBest = new Map();

    for (const row of list) {
        const requestType = String(row?.requestType || row?.type || '').trim();
        if (requestType !== 'Vehicle Service Request') continue;
        const meta = parseInboxExtra3(row?.extra3);
        const serviceId = String(meta?.serviceRecordId || '').trim();
        const assetId = String(row?.requestObjectId || row?.requestId || row?.id || '').trim();
        if (!serviceId || !assetId) continue;
        const key = `${assetId}:${serviceId}`;
        const prev = vehicleServiceBest.get(key);
        if (!prev) {
            vehicleServiceBest.set(key, row);
            continue;
        }
        const prevMeta = parseInboxExtra3(prev.extra3);
        const prevTrack = Boolean(prevMeta?.adminOfficerServiceTrack);
        const curTrack = Boolean(meta?.adminOfficerServiceTrack);
        if (curTrack && !prevTrack) {
            vehicleServiceBest.set(key, row);
            continue;
        }
        if (prevTrack && !curTrack) continue;
        const prevMs = new Date(prev.requestedDate || 0).getTime();
        const curMs = new Date(row.requestedDate || 0).getTime();
        if (curMs >= prevMs) vehicleServiceBest.set(key, row);
    }

    const rowIdentity = (row) =>
        String(row?.dashboardActionId || row?.actionId || row?._id || '').trim();

    const sorted = [...list].sort(
        (a, b) => new Date(b.requestedDate || 0) - new Date(a.requestedDate || 0),
    );

    return sorted.filter((row) => {
        const requestType = String(row?.requestType || row?.type || '').trim();
        const actionId = rowIdentity(row);
        if (actionId) {
            if (seenActionIds.has(actionId)) return false;
            seenActionIds.add(actionId);
        }

        if (requestType === 'Vehicle Service Request') {
            const meta = parseInboxExtra3(row?.extra3);
            const serviceId = String(meta?.serviceRecordId || '').trim();
            const assetId = String(row?.requestObjectId || row?.requestId || row?.id || '').trim();
            if (serviceId && assetId) {
                const best = vehicleServiceBest.get(`${assetId}:${serviceId}`);
                if (best && rowIdentity(best) && rowIdentity(row) && rowIdentity(best) !== rowIdentity(row)) {
                    return false;
                }
            }
        }

        // One inbox row per asset assignment task (same user with multiple roles still sees it once).
        if (requestType !== 'Asset Assignment' || row?.isBulk) return true;
        if (isAcceptedAssignmentOutcomeInboxRow(row)) return false;
        const meta = parseInboxExtra3(row?.extra3);
        if (meta?.isBulkAssignment === true) return true;
        const assetId = row?.primaryAssetId || row?.requestObjectId;
        if (!assetId) return true;
        const key = String(assetId);
        if (seenAssignmentAssets.has(key)) return false;
        seenAssignmentAssets.add(key);
        return true;
    });
}

/** Same visible-row rules as the bell icon on Tools / Vehicle Asset pages. */
export function countVisibleAssetPendingInbox(items) {
    const list = dedupeAssetPendingInboxItems(items);
    return list.filter(isPendingInboxRowVisible).length;
}

/**
 * Count rows that the Vehicle/Tools pending modal will actually list
 * (visible + has a navigable path / vehicle fallback).
 */
export function countDisplayableAssetPendingInbox(items) {
    const list = dedupeAssetPendingInboxItems(items);
    return list.filter(isPendingInboxRowVisible).filter(isDisplayableAssetPendingInboxRow).length;
}

export function notifyAssetPendingInboxChanged() {
    if (typeof window === 'undefined') return;
    // Match Fine/Payment/Reward: both targets so Sidebar (document) + pages (window) refresh.
    const event = new CustomEvent(ASSET_PENDING_INBOX_CHANGED);
    window.dispatchEvent(event);
    document.dispatchEvent(event);
}

/** Clear cached inbox rows and notify listeners (sidebar + vehicle bell) to refetch. */
export function invalidateAssetPendingInbox(scope = 'all') {
    if (scope === 'all' || scope === 'vehicle') {
        clearPendingInboxCache(ASSET_PENDING_INBOX_ENDPOINT, { scope: 'vehicle' });
    }
    if (scope === 'all' || scope === 'tools') {
        clearPendingInboxCache(ASSET_PENDING_INBOX_ENDPOINT, { scope: 'tools' });
    }
    if (scope === 'all') {
        clearPendingInboxCache(ASSET_PENDING_INBOX_ENDPOINT, {});
    }
    notifyAssetPendingInboxChanged();
}
