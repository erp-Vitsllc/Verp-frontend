import { isPendingInboxRowVisible } from './assetRequestLabels';

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
