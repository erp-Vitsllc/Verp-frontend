/**
 * Keep in sync with VERP_backend/utils/assetPendingAccessoryVisibility.js
 * isAccessoryExcludedFromLiveAssetView — embedded accessories that no longer count as attached on the asset.
 */
/** Lost / End of Life accessories are hidden from the live attached list. */
export function isAccessoryHiddenFromLiveAssetView(acc, assetStatus = '') {
    const accNorm = String(acc?.status || '').trim().toLowerCase().replace(/\s+/g, '');
    return accNorm === 'lost' || accNorm === 'endoflife' || accNorm === 'eol';
}

/** Unattach is not offered when the parent asset is Lost or End of Life. */
export function isAssetStatusBlockingUnattach(assetStatus = '') {
    const norm = String(assetStatus || '').trim().toLowerCase().replace(/\s+/g, '');
    return norm === 'lost' || norm === 'endoflife' || norm === 'eol';
}

/** Adding accessories is blocked for everyone when the parent asset is Lost or End of Life. */
export function isAssetStatusBlockingAccessoryAdd(assetStatus = '') {
    return isAssetStatusBlockingUnattach(assetStatus);
}
