import { isPendingInboxRowVisible } from './assetRequestLabels';
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

/** One inbox row per asset assignment (fleet handover keeps one row per viewer role). */
export function dedupeAssetPendingInboxItems(items) {
    const list = Array.isArray(items) ? items : [];
    const seen = new Set();
    const sorted = [...list].sort(
        (a, b) => new Date(b.requestedDate || 0) - new Date(a.requestedDate || 0),
    );
    return sorted.filter((row) => {
        const requestType = String(row?.requestType || '').trim();
        if (requestType !== 'Asset Assignment' || row?.isBulk) return true;
        const assetId = row?.primaryAssetId || row?.requestObjectId;
        if (!assetId) return true;
        const meta = parseInboxExtra3(row?.extra3);
        const handoverRole = meta?.handoverViewerRole;
        const key = handoverRole ? `${assetId}:${handoverRole}` : String(assetId);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/** Same visible-row rules as the bell icon on Tools / Vehicle Asset pages. */
export function countVisibleAssetPendingInbox(items) {
    const list = dedupeAssetPendingInboxItems(items);
    return list.filter(isPendingInboxRowVisible).length;
}

export function notifyAssetPendingInboxChanged() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(ASSET_PENDING_INBOX_CHANGED));
    }
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
