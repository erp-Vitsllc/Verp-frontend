export const REWARD_PENDING_INBOX_CHANGED = 'reward-pending-inbox-changed';

/** Same count as the Rewards page bell icon (all pending inbox rows for the viewer). */
export function countVisibleRewardPendingInbox(items) {
    const list = Array.isArray(items) ? items : [];
    return list.length;
}

export function notifyRewardPendingInboxChanged() {
    if (typeof window !== 'undefined') {
        const event = new CustomEvent(REWARD_PENDING_INBOX_CHANGED);
        window.dispatchEvent(event);
        document.dispatchEvent(event);
    }
}
