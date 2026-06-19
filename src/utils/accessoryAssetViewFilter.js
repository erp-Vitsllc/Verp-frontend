/**
 * Keep in sync with VERP_backend/utils/assetPendingAccessoryVisibility.js
 * isAccessoryExcludedFromLiveAssetView — embedded accessories that no longer count as attached on the asset.
 */
/** Lost / End of Life stay hidden unless parent asset is Lost (then Lost rows show for unattach-only UI). */
export function isAccessoryHiddenFromLiveAssetView(acc, assetStatus = '') {
    const accNorm = String(acc?.status || '').trim().toLowerCase().replace(/\s+/g, '');
    const assetNorm = String(assetStatus || '').trim().toLowerCase();
    if (accNorm === 'lost' && assetNorm === 'lost') return false;
    return accNorm === 'lost' || accNorm === 'endoflife' || accNorm === 'eol';
}
