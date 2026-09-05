/** User-facing labels for DashboardAction.requestType (tools & equipment inbox). */
export function formatAssetDashboardRequestType(requestType, row = null) {
    const t = String(requestType || '').trim();
    if (t === 'Utility Bill Payment Reminder') return 'Utility bill payment day, please pay the bill';
    if (t === 'Utility Contract Expiry') return 'Utility Contract Expiry — Renew / Deactivate';
    if (t === 'Utility Bill Payment') return 'Utility Bill Payment — Review / Pay';
    if (t === 'Utility Entry Status Change') return 'Utility Activate / Deactivate';
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
const VEHICLE_INBOX_TYPES_WITHOUT_ASSET = new Set([
    'Vehicle Inspection',
    'Vehicle Assignment Photo Review',
    'Vehicle Profile Activation',
    'Vehicle Profile Edit',
    'Vehicle Mortgage Close',
    'Vehicle Service Request',
    'Vehicle Disposition Request',
]);

export function isAcceptedAssignmentOutcomeInboxRow(row = {}) {
    const requestType = String(row?.requestType || row?.type || '').trim();
    if (requestType && requestType !== 'Asset Assignment' && requestType !== 'Asset') {
        return false;
    }
    let meta = null;
    try {
        meta = typeof row?.extra3 === 'string' ? JSON.parse(row.extra3) : row?.extra3;
    } catch {
        meta = null;
    }
    if (meta?.isBulkAssignment === true) return false;
    const extra1 = String(row?.extra1 || '').trim();
    const extra2 = String(row?.extra2 || '').trim();
    const outcome = String(meta?.outcome || '').toLowerCase();
    if (meta?.assignmentOutcome === true && (outcome === 'accept' || outcome === 'accepted')) {
        return true;
    }
    if (/\bassignment accepted\b/i.test(extra1) && !/^bulk assignment\b/i.test(extra1)) return true;
    if (/^assignment accepted$/i.test(extra2)) return true;
    return false;
}

function isAssignmentAcknowledgmentStillPending(asset) {
    if (!asset) return false;
    if (asset.pendingAction) return false;
    if (asset.fleetHandoverActive) return true;
    return (
        String(asset.acceptanceStatus || '').trim() === 'Pending' &&
        ['Pending', 'Assigned'].includes(String(asset.status || '').trim())
    );
}

export function isPendingInboxRowVisible(row) {
    if (!row) return false;
    if (isAcceptedAssignmentOutcomeInboxRow(row)) return false;
    const requestType = String(row.requestType || row.type || '').trim();
    if (requestType === 'Asset Assignment' || requestType === 'Asset') {
        let meta = null;
        try {
            meta = typeof row?.extra3 === 'string' ? JSON.parse(row.extra3) : row?.extra3;
        } catch {
            meta = null;
        }
        if (meta?.isBulkAssignment === true) {
            const bulkAssets = Array.isArray(row.bulkAssets) ? row.bulkAssets : [];
            if (bulkAssets.length && !bulkAssets.some((asset) => isAssignmentAcknowledgmentStillPending(asset))) {
                return false;
            }
        } else if (row.asset && !isAssignmentAcknowledgmentStillPending(row.asset)) {
            return false;
        }
    }
    // Utility contract expiry bells are disabled — keep payment / status-change rows.
    if (requestType === 'Utility Contract Expiry') return false;
    if (requestType === 'Asset Owner On Duty') return true;
    if (requestType === 'Asset On Duty Request') return true;
    if (
        requestType === 'Employee Asset Request' ||
        requestType === 'Employee Vehicle Request' ||
        requestType === 'Employee Utility Request'
    ) {
        return true;
    }
    if (
        requestType === 'Utility Bill Payment' ||
        requestType === 'Utility Bill Payment Reminder' ||
        requestType === 'Utility Entry Status Change'
    ) {
        return true;
    }
    if (
        VEHICLE_INBOX_TYPES_WITHOUT_ASSET.has(requestType) &&
        (row.primaryAssetId || row.requestObjectId)
    ) {
        return true;
    }
    if (row.asset) return true;
    if (row.isBulk && row.bulkAssetIds?.length) return true;
    return false;
}
