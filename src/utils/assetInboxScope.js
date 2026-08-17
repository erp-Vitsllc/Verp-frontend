/**
 * Vehicle vs Tools Asset inbox partition.
 * Shared by module bells, Command Center, and pending-inbox consumers.
 */

const VEHICLE_ONLY_TYPES = new Set([
    'Vehicle Service Request',
    'Vehicle Profile Activation',
    'Vehicle Profile Edit',
    'Vehicle Inspection',
    'Vehicle Mortgage Close',
    'Vehicle Disposition Request',
    'Vehicle Document Expiry Reminder',
]);

const FLEET_SHARED_TYPES = new Set(['Asset Approval', 'Asset Assignment', 'Asset Return']);

export function parseAssetInboxExtra3(extra3) {
    if (extra3 == null || extra3 === '') return null;
    if (typeof extra3 === 'object') return extra3;
    try {
        return JSON.parse(extra3);
    } catch {
        return null;
    }
}

function requestTypeOf(row = {}) {
    return String(row?.requestType || row?.type || '').trim();
}

function normalizeHubAssetArea(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    const low = value.toLowerCase();
    if (low === 'vehicle') return 'Vehicle';
    if (low === 'tools' || low === 'tool') return 'Tools';
    if (low === 'utility bill' || low === 'utility') return 'Utility Bill';
    return '';
}

/** Vehicle / Tools / Utility Bill chosen on an employee Assets hub request. */
export function hubAssetAreaOf(row = {}) {
    const fromField = normalizeHubAssetArea(row?.assetType);
    if (fromField) return fromField;

    const meta = parseAssetInboxExtra3(row?.extra3);
    const fromMeta = normalizeHubAssetArea(meta?.assetType);
    if (fromMeta) return fromMeta;

    const extra2 = String(row?.extra2 || '').trim();
    const extra2Match = extra2.match(/Assets\s*[·•\-–—]\s*(Vehicle|Tools|Utility Bill)/i);
    if (extra2Match) return normalizeHubAssetArea(extra2Match[1]);

    return '';
}

/** Fleet shared Asset * rows belong in Vehicle (explicit fleet flags / plate). */
export function isFleetSharedAssetInboxRow(row = {}) {
    const type = requestTypeOf(row);
    if (!FLEET_SHARED_TYPES.has(type)) return false;

    const meta = parseAssetInboxExtra3(row?.extra3);
    if (meta?.isFleetVehicle === true) return true;
    if (meta?.vehicleMongoId) return true;

    const asset = row?.asset || null;
    const plate = String(asset?.plateNumber || '').trim();
    if (plate) return true;

    return false;
}

export function isVehicleOnlyRequestType(type) {
    const t = String(type || '').trim();
    if (VEHICLE_ONLY_TYPES.has(t)) return true;
    return t.toLowerCase().startsWith('vehicle');
}

/** True when this inbox/stats row belongs in Vehicle Asset (never Tools). */
export function isVehicleAssetInboxRow(row = {}) {
    const type = requestTypeOf(row);
    if (type === 'Employee Vehicle Request') return true;
    if (type === 'Employee Asset Request') return hubAssetAreaOf(row) === 'Vehicle';
    if (isVehicleOnlyRequestType(type)) return true;
    if (FLEET_SHARED_TYPES.has(type)) return isFleetSharedAssetInboxRow(row);
    return false;
}

/** True when this row belongs in Tools Asset (never Vehicle). */
export function isToolsAssetInboxRow(row = {}) {
    const type = requestTypeOf(row);
    if (!type) return false;
    if (type === 'Employee Asset Request') {
        const area = hubAssetAreaOf(row);
        return area !== 'Vehicle' && area !== 'Utility Bill';
    }
    // Utility bill tasks belong under Utility Bills only — not Tools Asset.
    if (
        type === 'Utility Bill Payment' ||
        type === 'Utility Bill Payment Reminder' ||
        type === 'Utility Contract Expiry' ||
        type === 'Utility Entry Status Change' ||
        type === 'Employee Utility Request'
    ) {
        return false;
    }
    if (isVehicleOnlyRequestType(type)) return false;
    if (FLEET_SHARED_TYPES.has(type)) return !isFleetSharedAssetInboxRow(row);
    const low = type.toLowerCase();
    return low === 'asset' || low.startsWith('asset');
}

/** Utility Bills inbox rows (from tools-scope API feed). Contract expiry bells are disabled. */
export function isUtilityBillInboxRow(row = {}) {
    const type = requestTypeOf(row);
    if (type === 'Employee Asset Request') return hubAssetAreaOf(row) === 'Utility Bill';
    return (
        type === 'Utility Bill Payment' ||
        type === 'Utility Bill Payment Reminder' ||
        type === 'Utility Entry Status Change' ||
        type === 'Employee Utility Request'
    );
}

/** Keep only Tools-scope rows (drops Vehicle* and fleet shared). */
export function filterToolsAssetInboxRows(rows = []) {
    return (Array.isArray(rows) ? rows : []).filter((row) => isToolsAssetInboxRow(row));
}

/** Keep only Vehicle-scope rows (Vehicle* + fleet shared). */
export function filterVehicleAssetInboxRows(rows = []) {
    return (Array.isArray(rows) ? rows : []).filter((row) => isVehicleAssetInboxRow(row));
}
