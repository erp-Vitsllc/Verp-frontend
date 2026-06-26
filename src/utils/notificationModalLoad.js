/** When reopening a notification modal, keep showing cached rows instead of a full-screen loader. */
export function shouldUseBlockingNotificationLoader(cachedCount) {
    return !cachedCount || cachedCount <= 0;
}
