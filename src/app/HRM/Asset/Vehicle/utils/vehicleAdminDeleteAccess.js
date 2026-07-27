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
 * - Inactive profile → any user (option shown to all)
 * - Active profile → portal Super User only (not Flowchart Admin Officer)
 */
export function canDeleteVehicleProfileRecord({
    isAdminUser = false,
    profileActive = false,
} = {}) {
    if (profileActive) return Boolean(isAdminUser);
    return true;
}

/** @deprecated Prefer canDeleteVehicleProfileRecord. */
export function canAdminDeleteActivatedVehicleRecord({ isAdminUser = false, profileActive = false } = {}) {
    return canDeleteVehicleProfileRecord({ isAdminUser, profileActive });
}
