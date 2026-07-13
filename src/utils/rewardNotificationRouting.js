import { appendAssetQueryParams } from '@/utils/assetNotificationRouting';

export function normalizeRewardNotificationItem(item = {}) {
    return {
        id: item?.id || item?.requestObjectId || item?.reward?._id || '',
        type: String(item?.type || item?.requestType || '').trim(),
        extra1: item?.extra1 || item?.reward?.rewardType || '',
        extra2: item?.extra2 || '',
        extra3: item?.extra3 || '',
        reward: item?.reward || null,
    };
}

export function resolveRewardDetailRouteId(rawItem) {
    const item = normalizeRewardNotificationItem(rawItem);
    if (item.reward?.rewardId) return String(item.reward.rewardId);
    return item.id ? String(item.id) : '';
}

export function buildRewardDetailPath(rawItem, extraParams = {}) {
    const routeId = resolveRewardDetailRouteId(rawItem);
    if (!routeId) return '/HRM/Reward';
    return appendAssetQueryParams(`/HRM/Reward/rewrd.${encodeURIComponent(routeId)}`, extraParams);
}

/** Reward notifications open the reward detail page for the current track stage. */
export function buildRewardNotificationPath(rawItem) {
    const item = normalizeRewardNotificationItem(rawItem);
    const type = item.type.toLowerCase();
    if (!type.includes('reward')) return '';
    return buildRewardDetailPath(item);
}
