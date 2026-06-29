const MS_DAY = 24 * 60 * 60 * 1000;

export function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function vehicleRegistrationExpiryDate(vehicle) {
    if (vehicle?.registrationExpiryDate) return new Date(vehicle.registrationExpiryDate);
    const reg = (vehicle?.documents || []).find(
        (doc) => String(doc?.type || '').toLowerCase() === 'registration',
    );
    if (reg?.expiryDate) return new Date(reg.expiryDate);
    return null;
}

export function vehicleNextMaintenanceDate(vehicle) {
    const raw = vehicle?.nextMaintenanceDate || vehicle?.nextServiceDate || vehicle?.gearOilDueDate;
    const dates = [vehicle?.nextServiceDate, vehicle?.gearOilDueDate, raw]
        .filter(Boolean)
        .map((d) => new Date(d))
        .filter((d) => !Number.isNaN(d.getTime()));
    if (!dates.length) return null;
    return new Date(Math.min(...dates.map((d) => d.getTime())));
}

export function isVehicleServiceDue(vehicle, now = new Date()) {
    const due = vehicleNextMaintenanceDate(vehicle);
    if (!due) return false;
    return startOfDay(due).getTime() < startOfDay(now).getTime();
}

export function isVehicleServiceDueSoon(vehicle, now = new Date(), withinDays = 30) {
    const due = vehicleNextMaintenanceDate(vehicle);
    if (!due) return false;
    const today = startOfDay(now).getTime();
    const dueDay = startOfDay(due).getTime();
    if (dueDay < today) return false;
    const soonEnd = today + withinDays * MS_DAY;
    return dueDay <= soonEnd;
}

export function isVehicleRegistrationDue(vehicle, now = new Date()) {
    const due = vehicleRegistrationExpiryDate(vehicle);
    if (!due) return false;
    return startOfDay(due).getTime() < startOfDay(now).getTime();
}

export function isVehicleRegistrationDueSoon(vehicle, now = new Date(), withinDays = 30) {
    const due = vehicleRegistrationExpiryDate(vehicle);
    if (!due) return false;
    const today = startOfDay(now).getTime();
    const dueDay = startOfDay(due).getTime();
    if (dueDay < today) return false;
    const soonEnd = today + withinDays * MS_DAY;
    return dueDay <= soonEnd;
}

export function isVehicleHandoverPending(vehicle) {
    return Boolean(vehicle?.assignedTo) && String(vehicle?.acceptanceStatus || '') === 'Pending';
}

export function isVehicleHandoverAccepted(vehicle) {
    return Boolean(vehicle?.assignedTo) && String(vehicle?.acceptanceStatus || '') === 'Accepted';
}

export function isVehicleAssetRequestPending(vehicle) {
    return vehicle?.hasPendingAssetRequest === true;
}

export function isVehicleAssetRequestApproved(vehicle) {
    return vehicle?.hasApprovedAssetRequest === true;
}
