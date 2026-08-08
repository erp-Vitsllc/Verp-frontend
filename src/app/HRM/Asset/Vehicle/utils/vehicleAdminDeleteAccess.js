export function isVehicleProfileActivationActive(vehicleOrStatus) {
    if (typeof vehicleOrStatus === 'string') {
        return vehicleOrStatus.toLowerCase().trim() === 'active';
    }
    return String(vehicleOrStatus?.vehicleProfileActivationStatus || '')
        .toLowerCase()
        .trim() === 'active';
}

export function isVehicleProfileInactive(vehicleOrStatus) {
    return !isVehicleProfileActivationActive(vehicleOrStatus);
}

/**
 * Inactive fleet vehicles: permission-group users may delete directly (no HR).
 * Active fleet vehicles: hard-delete is HR/admin only; others submit a delete request for HR.
 */
export function canShowVehicleDeleteControl({
    hasDeletePermission = false,
    profileActive = false,
    canApproveAsHrOrAdmin = false,
} = {}) {
    if (canApproveAsHrOrAdmin) return true;
    if (!hasDeletePermission) return false;
    return true;
}

/**
 * Vehicle card / document / service-record delete visibility:
 * Portal Super User only — never Flowchart Admin Officer.
 * (profileActive kept for call-site compatibility; does not grant access to others.)
 */
export function canDeleteVehicleProfileRecord({
    isAdminUser = false,
    profileActive: _profileActive = false,
} = {}) {
    return Boolean(isAdminUser);
}

/** @deprecated Prefer canDeleteVehicleProfileRecord. */
export function canAdminDeleteActivatedVehicleRecord({ isAdminUser = false, profileActive = false } = {}) {
    return canDeleteVehicleProfileRecord({ isAdminUser, profileActive });
}
