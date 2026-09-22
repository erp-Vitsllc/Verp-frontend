import {
    clearPendingInboxCache,
    FINE_PENDING_INBOX_ENDPOINT,
} from '@/utils/pendingInboxFetch';
import { isFineAccountsSettlementDone } from './fineListDisplay';

export const FINE_PENDING_INBOX_CHANGED = 'fine-pending-inbox-changed';

const FINE_PENDING_APPROVAL_STATUSES = new Set([
    'Pending',
    'Pending HR',
    'Pending Review',
    'Pending Accounts',
    'Pending Finance',
    'Pending Authorization',
    'Pending Management',
]);

/** Approval stages, plus Accounts Make Payment after Management (until Zoho / employee pay). */
export function isFinePendingInboxApprovalItem(item) {
    if (!item) return false;
    if (item.hubRequest) return true;
    const status = String(item?.fine?.fineStatus || '').trim();
    if (!status) return true;
    if (FINE_PENDING_APPROVAL_STATUSES.has(status)) return true;
    if (['Approved', 'Active'].includes(status) && !isFineAccountsSettlementDone(item?.fine)) {
        return true;
    }
    return false;
}

export function filterFinePendingInboxApprovalItems(items) {
    const list = Array.isArray(items) ? items : [];
    return list.filter(isFinePendingInboxApprovalItem);
}

/** Same count as the Fine page bell icon (approval-stage rows only). */
export function countVisibleFinePendingInbox(items) {
    return filterFinePendingInboxApprovalItems(items).length;
}

export function notifyFinePendingInboxChanged() {
    clearPendingInboxCache(FINE_PENDING_INBOX_ENDPOINT);
    if (typeof window !== 'undefined') {
        const event = new CustomEvent(FINE_PENDING_INBOX_CHANGED);
        window.dispatchEvent(event);
        document.dispatchEvent(event);
    }
}
