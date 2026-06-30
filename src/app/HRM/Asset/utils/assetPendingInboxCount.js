import { isPendingInboxRowVisible } from './assetRequestLabels';
import {
    ASSET_PENDING_INBOX_ENDPOINT,
    clearPendingInboxCache,
} from '@/utils/pendingInboxFetch';

export const ASSET_PENDING_INBOX_CHANGED = 'asset-pending-inbox-changed';

/** Same visible-row rules as the bell icon on Tools / Vehicle Asset pages. */
export function countVisibleAssetPendingInbox(items) {
    const list = Array.isArray(items) ? items : [];
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
