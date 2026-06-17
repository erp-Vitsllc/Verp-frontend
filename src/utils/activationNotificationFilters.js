const ACTIVATION_NOTIFICATION_TYPES = new Set([
    'Profile Activation',
    'Company Activation',
    'Vehicle Profile Activation',
    'Vehicle Disposition Request',
]);

function parseExtra3Meta(extra3) {
    if (extra3 == null || extra3 === '') return null;
    if (typeof extra3 === 'object') return extra3;
    try {
        return JSON.parse(extra3);
    } catch {
        return null;
    }
}

/** Creator must see Asset Approval Rejected outcomes (resubmit / remove draft). */
export function isSubmitterRejectedAssetCreationFollowup(item) {
    if (!item || item.type !== 'Asset Approval' || item.status !== 'Rejected') return false;
    if (item.scope === 'outgoing' || item.requestedBy === 'Me') return true;
    const meta = parseExtra3Meta(item.extra3);
    return meta?.assetCreationViewerRole === 'creator' && meta?.outcome === 'reject';
}

/** Requester must see Loss & Damage Rejected outcomes (resubmit). */
export function isSubmitterRejectedLossDamageFollowup(item) {
    if (!item || item.type !== 'Asset Loss Damage' || item.status !== 'Rejected') return false;
    if (item.scope === 'outgoing' || item.requestedBy === 'Me') return true;
    const meta = parseExtra3Meta(item.extra3);
    return meta?.lossDamageViewerRole === 'requester' && meta?.outcome === 'reject';
}

/** Company activation on hold is only for the employee who submitted the changes. */
function isCompanyActivationHoldForSubmitter(item) {
    if (!item || item.type !== 'Company Activation' || item.status !== 'On Hold') return false;
    const meta = parseExtra3Meta(item.extra3);
    if (meta?.companyActivationViewerRole === 'submitter') return true;
    return item.requestedBy === 'Me' || item.scope === 'outgoing';
}

/** Submitter must see HR Rejected outcomes; HR inbox uses Pending only (not On Hold). */
export function isActivationNotificationActionable(item) {
    if (!item || !ACTIVATION_NOTIFICATION_TYPES.has(item.type)) return false;
    if (item.status === 'On Hold') {
        if (item.type === 'Company Activation') {
            return isCompanyActivationHoldForSubmitter(item);
        }
        return true;
    }
    if (item.status === 'Pending') return true;
    if (item.status === 'Rejected') {
        return item.scope === 'outgoing' || item.requestedBy === 'Me';
    }
    return false;
}

function isAssetApprovalActionable(item) {
    if (!item || item.type !== 'Asset Approval') return false;
    if (item.status === 'Pending') return true;
    return isSubmitterRejectedAssetCreationFollowup(item);
}

/** Pending task bar / notification modal: activation + creator asset-reject follow-ups. */
export function filterActionableDashboardItems(items) {
    const list = Array.isArray(items) ? items : [];
    return list.filter((item) => {
        if (ACTIVATION_NOTIFICATION_TYPES.has(item.type)) {
            return isActivationNotificationActionable(item);
        }
        if (item.type === 'Asset Approval') {
            return isAssetApprovalActionable(item);
        }
        if (item.type === 'Asset Loss Damage') {
            if (item.status === 'Pending') return true;
            return isSubmitterRejectedLossDamageFollowup(item);
        }
        return item.status === 'Pending';
    });
}

/** Dashboard "Pending" stat/filter: same rules as sidebar notifications. */
export function isDashboardPendingItem(item) {
    if (ACTIVATION_NOTIFICATION_TYPES.has(item?.type)) {
        return isActivationNotificationActionable(item);
    }
    if (item?.type === 'Asset Approval') {
        return isAssetApprovalActionable(item);
    }
    if (item?.type === 'Asset Loss Damage') {
        if (item.status === 'Pending') return true;
        return isSubmitterRejectedLossDamageFollowup(item);
    }
    return item?.status === 'Pending' || item?.status === 'On Hold';
}

/** Rejected activation for the submitter — still needs follow-up, not "completed" in dashboard totals. */
export function isSubmitterRejectedActivationFollowup(item) {
    if (!item || !ACTIVATION_NOTIFICATION_TYPES.has(item.type)) return false;
    return item.status === 'Rejected' && item.scope === 'outgoing';
}

/** Rejected creation or activation for submitter — still needs follow-up. */
export function isSubmitterRejectedFollowup(item) {
    return (
        isSubmitterRejectedActivationFollowup(item) ||
        isSubmitterRejectedAssetCreationFollowup(item) ||
        isSubmitterRejectedLossDamageFollowup(item)
    );
}
