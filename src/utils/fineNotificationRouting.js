import { appendAssetQueryParams } from '@/utils/assetNotificationRouting';
import {
    NOTIFICATION_FOCUS_HIGHLIGHT_CLASSES,
    runNotificationFocusScroll,
} from '@/utils/notificationFocusNavigation';

export const FINE_FOCUS_PREFIX = 'fine-focus-';

export function buildFineFocusElementId(fineMongoId = '') {
    const id = String(fineMongoId || '').trim();
    return id ? `${FINE_FOCUS_PREFIX}${id}` : '';
}

export function normalizeFineNotificationItem(item = {}) {
    return {
        id: item?.id || item?.primaryFineId || item?.requestObjectId || item?.fine?._id || '',
        type: String(item?.type || item?.requestType || '').trim(),
        extra1: item?.extra1 || item?.fine?.fineType || '',
        extra2: item?.extra2 || '',
        extra3: item?.extra3 || '',
        isGroup: item?.isGroup === true || item?.requestType === 'Group Fine Request',
        fine: item?.fine || null,
    };
}

export function buildFineListPath(params = {}) {
    return appendAssetQueryParams('/HRM/Fine', params);
}

/** Prefer human-readable fineId; group requests open the shared base id. */
export function resolveFineDetailRouteId(rawItem) {
    const item = normalizeFineNotificationItem(rawItem);
    if (item.isGroup && item.fine?.baseFineId) return String(item.fine.baseFineId);
    if (item.fine?.fineId) return String(item.fine.fineId);
    return item.id ? String(item.id) : '';
}

export function buildFineDetailPath(rawItem, extraParams = {}) {
    const routeId = resolveFineDetailRouteId(rawItem);
    if (!routeId) return buildFineListPath({ status: 'Pending' });
    const item = normalizeFineNotificationItem(rawItem);
    return appendAssetQueryParams(`/HRM/Fine/${encodeURIComponent(routeId)}`, {
        focusCard: 'pendingApproval',
        ...(item.isGroup ? { view: 'group' } : {}),
        ...extraParams,
    });
}

/** Fine notifications open the fine detail page (approve / review actions). */
export function buildFineNotificationPath(rawItem) {
    const item = normalizeFineNotificationItem(rawItem);
    const type = item.type.toLowerCase();
    if (!type.includes('fine')) return '';
    return buildFineDetailPath(item);
}

/** Scroll + highlight a fine list row (supports group rows via data-fine-focus-ids). */
export function runFineListFocusScroll(focusFine, options) {
    const id = String(focusFine || '').trim();
    if (!id || typeof document === 'undefined') return () => {};

    let tries = 0;
    const { attempts = 14, intervalMs = 150, highlightMs = 3000 } = options || {};

    const timer = setInterval(() => {
        let el = document.getElementById(buildFineFocusElementId(id));
        if (!el) {
            el = Array.from(document.querySelectorAll('tr[data-fine-focus-ids]')).find((row) => {
                const ids = (row.getAttribute('data-fine-focus-ids') || '').split(',').filter(Boolean);
                return ids.includes(id);
            });
        }
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add(...NOTIFICATION_FOCUS_HIGHLIGHT_CLASSES);
            setTimeout(() => {
                el.classList.remove(...NOTIFICATION_FOCUS_HIGHLIGHT_CLASSES);
            }, highlightMs);
            clearInterval(timer);
        }
        tries += 1;
        if (tries >= attempts) clearInterval(timer);
    }, intervalMs);

    return () => clearInterval(timer);
}
