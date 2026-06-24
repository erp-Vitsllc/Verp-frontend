/**
 * Keep in sync with VERP_backend/utils/assetPendingAccessoryVisibility.js
 * isAccessoryExcludedFromLiveAssetView — embedded accessories that no longer count as attached on the asset.
 */
/** Lost / End of Life accessories are hidden from the live attached list (except Lost on a Lost asset). */
export function isAccessoryHiddenFromLiveAssetView(acc, assetStatus = '') {
    const accNorm = String(acc?.status || '').trim().toLowerCase().replace(/\s+/g, '');
    const assetNorm = String(assetStatus || '').trim().toLowerCase().replace(/\s+/g, '');
    if (accNorm === 'lost' && assetNorm === 'lost') return false;
    return accNorm === 'lost' || accNorm === 'endoflife' || accNorm === 'eol';
}

/** Unattach is blocked only when the parent asset is End of Life (Lost assets allow manual detach). */
export function isAssetStatusBlockingUnattach(assetStatus = '') {
    const norm = String(assetStatus || '').trim().toLowerCase().replace(/\s+/g, '');
    return norm === 'endoflife' || norm === 'eol';
}

/** Adding accessories is blocked for everyone when the parent asset is Lost or End of Life. */
export function isAssetStatusBlockingAccessoryAdd(assetStatus = '') {
    const norm = String(assetStatus || '').trim().toLowerCase().replace(/\s+/g, '');
    return norm === 'lost' || norm === 'endoflife' || norm === 'eol';
}
