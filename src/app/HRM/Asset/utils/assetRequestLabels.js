/** User-facing labels for DashboardAction.requestType (tools & equipment inbox). */
export function formatAssetDashboardRequestType(requestType, row = null) {
    const t = String(requestType || '').trim();
    if (t === 'Asset Overdue') return 'Asset Service overdue';
    if (t === 'Asset Leave') {
        try {
            const meta = typeof row?.extra3 === 'string' ? JSON.parse(row.extra3) : row?.extra3;
            if (meta?.focusCard === 'operationalExpiry') return 'On Leave duration expired';
        } catch {
            /* ignore */
        }
        return 'Leave request pending approval';
    }
    if (t === 'Asset Owner On Duty') return 'Owner on duty review';
    if (t === 'Asset On Duty Request') return 'On duty request (owner → AC)';
    return t;
}

export function isAssetServiceOverdueRequestType(requestType) {
    return String(requestType || '').trim() === 'Asset Overdue';
}

/** Pending inbox rows without a resolved AssetItem (e.g. owner on-duty review). */
export function isPendingInboxRowVisible(row) {
    if (!row) return false;
    if (String(row.requestType || '').trim() === 'Asset Owner On Duty') return true;
    if (String(row.requestType || '').trim() === 'Asset On Duty Request') return true;
    if (row.asset) return true;
    if (row.isBulk && row.bulkAssetIds?.length) return true;
    return false;
}
