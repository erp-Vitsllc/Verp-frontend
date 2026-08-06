import { isAccessoryHiddenFromLiveAssetView } from '@/utils/accessoryAssetViewFilter';

/**
 * Sum amounts for accessories that still count on the live asset
 * (excludes Lost / End of Life accessories except Lost accessories on a Lost asset).
 */
export function getAttachedAccessoriesValueTotal(accessories, assetStatus = '') {
    return (accessories || []).reduce((sum, acc) => {
        if (isAccessoryHiddenFromLiveAssetView(acc, assetStatus)) return sum;
        return sum + (Number(acc?.amount) || 0);
    }, 0);
}

/** Display / summary value = assetValue + attached accessories amounts. */
export function getToolsAssetTotalValue(asset) {
    const assetValue = Number(asset?.assetValue) || 0;
    return assetValue + getAttachedAccessoriesValueTotal(asset?.accessories, asset?.status);
}
