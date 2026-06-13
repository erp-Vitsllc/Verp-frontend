/** User-facing labels for DashboardAction.requestType (tools & equipment inbox). */
export function formatAssetDashboardRequestType(requestType) {
    const t = String(requestType || '').trim();
    if (t === 'Asset Overdue') return 'Asset Service overdue';
    if (t === 'Asset Owner On Duty') return 'Owner on duty review';
    return t;
}

export function isAssetServiceOverdueRequestType(requestType) {
    return String(requestType || '').trim() === 'Asset Overdue';
}

/** Pending inbox rows without a resolved AssetItem (e.g. owner on-duty review). */
export function isPendingInboxRowVisible(row) {
    if (!row) return false;
    if (String(row.requestType || '').trim() === 'Asset Owner On Duty') return true;
    if (row.asset) return true;
    if (row.isBulk && row.bulkAssetIds?.length) return true;
    return false;
}
