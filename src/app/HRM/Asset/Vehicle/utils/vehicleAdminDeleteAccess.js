export function isVehicleProfileActivationActive(vehicleOrStatus) {
    if (typeof vehicleOrStatus === 'string') {
        return vehicleOrStatus.toLowerCase().trim() === 'active';
    }
    return String(vehicleOrStatus?.vehicleProfileActivationStatus || '')
        .toLowerCase()
        .trim() === 'active';
}

/** Admin may delete fleet rows only when the vehicle profile is activated. */
export function canAdminDeleteActivatedVehicleRecord({ isAdminUser = false, profileActive = false } = {}) {
    return Boolean(isAdminUser && profileActive);
}
