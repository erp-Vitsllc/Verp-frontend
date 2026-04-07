/**
 * Keep in sync with VERP_backend/utils/assetPendingAccessoryVisibility.js
 * isAccessoryExcludedFromLiveAssetView — embedded accessories that no longer count as attached on the asset.
 */
export function isAccessoryHiddenFromLiveAssetView(acc) {
    const n = String(acc?.status || '').trim().toLowerCase().replace(/\s+/g, '');
    return n === 'lost' || n === 'endoflife' || n === 'eol';
}
