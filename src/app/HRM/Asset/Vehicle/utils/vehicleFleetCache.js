/**
 * Session cache for vehicle fleet list rows — paints details/list instantly
 * while fresh API data loads in the background.
 */

const LIST_CACHE_KEY = 'verp:vehicle-fleet-list-cache-v2';
const LIST_CACHE_AT_KEY = 'verp:vehicle-fleet-list-cache-at';
const MAX_CACHE_AGE_MS = 10 * 60 * 1000; // 10 minutes

export function saveVehicleListCache(rows) {
    if (typeof window === 'undefined' || !Array.isArray(rows)) return;
    try {
        // Keep list rows lean — enough for table + detail shell header.
        const lean = rows.slice(0, 500).map((v) => ({
            _id: v._id,
            assetId: v.assetId,
            name: v.name,
            vehicleBrand: v.vehicleBrand,
            plateEmirate: v.plateEmirate,
            plateNumber: v.plateNumber,
            modelYear: v.modelYear,
            assetValue: v.assetValue,
            status: v.status,
            vehicleDispositionStatus: v.vehicleDispositionStatus,
            vehicleProfileActivationStatus: v.vehicleProfileActivationStatus,
            assignedTo: v.assignedTo,
            assignedCompany: v.assignedCompany,
            acceptanceStatus: v.acceptanceStatus,
            pendingAction: v.pendingAction,
            pendingActionDetails: v.pendingActionDetails,
            assignedDate: v.assignedDate,
            updatedAt: v.updatedAt,
            actionRequiredBy: v.actionRequiredBy,
            onServiceActive: v.onServiceActive,
            onLeaveActive: v.onLeaveActive,
            pendingServiceCount: v.pendingServiceCount,
            completedServiceCount: v.completedServiceCount,
            activeServiceWorkflow: v.activeServiceWorkflow
                ? {
                      stage: v.activeServiceWorkflow.stage || '',
                      serviceRecordId: v.activeServiceWorkflow.serviceRecordId || '',
                      serviceTypeLabel: v.activeServiceWorkflow.serviceTypeLabel || '',
                  }
                : null,
            warrantyEnabled: v.warrantyEnabled,
            warrantyExpiryDate: v.warrantyExpiryDate,
            warrantyYears: v.warrantyYears,
            locatorDeviceId: v.locatorDeviceId,
            typeId: v.typeId,
            assetController: v.assetController,
            registrationExpiryDate: v.registrationExpiryDate,
            insuranceExpiryDate: v.insuranceExpiryDate,
            nextServiceDate: v.nextServiceDate,
            gearOilDueDate: v.gearOilDueDate,
            oilChangeDate: v.oilChangeDate,
            currentKilometer: v.currentKilometer,
            locator: v.locator,
            isLocatorOnly: v.isLocatorOnly,
            deferredAttachmentSigning: true,
            _fromListCache: true,
        }));
        sessionStorage.setItem(LIST_CACHE_KEY, JSON.stringify(lean));
        sessionStorage.setItem(LIST_CACHE_AT_KEY, String(Date.now()));
    } catch {
        // quota / private mode
    }
}

export function readVehicleListCache({ maxAgeMs = MAX_CACHE_AGE_MS } = {}) {
    if (typeof window === 'undefined') return null;
    try {
        const at = Number(sessionStorage.getItem(LIST_CACHE_AT_KEY) || 0);
        if (!at || Date.now() - at > maxAgeMs) return null;
        const raw = sessionStorage.getItem(LIST_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch {
        return null;
    }
}

export function readVehicleListCacheRow(assetId) {
    if (!assetId) return null;
    const list = readVehicleListCache({ maxAgeMs: MAX_CACHE_AGE_MS });
    if (!list) return null;
    const id = String(assetId);
    return list.find((v) => String(v._id) === id) || null;
}
