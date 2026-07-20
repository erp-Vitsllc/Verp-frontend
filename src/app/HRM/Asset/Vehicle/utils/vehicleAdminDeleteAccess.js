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

/** @deprecated Prefer canShowVehicleDeleteControl — kept for service-record admin deletes. */
export function canAdminDeleteActivatedVehicleRecord({ isAdminUser = false, profileActive = false } = {}) {
    return Boolean(isAdminUser && profileActive);
}
