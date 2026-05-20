/** User-facing labels for DashboardAction.requestType (tools & equipment inbox). */
export function formatAssetDashboardRequestType(requestType) {
    const t = String(requestType || '').trim();
    if (t === 'Asset Overdue') return 'Asset Service overdue';
    return t;
}

export function isAssetServiceOverdueRequestType(requestType) {
    return String(requestType || '').trim() === 'Asset Overdue';
}
