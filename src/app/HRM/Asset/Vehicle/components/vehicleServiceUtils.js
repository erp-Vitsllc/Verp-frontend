/** Compare Mongo ObjectIds / $oid / populated shapes from JSON APIs. */
export function normalizeMongoId(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'object' && v !== null) {
        if (typeof v.$oid === 'string') return v.$oid;
        if (v._id != null) return normalizeMongoId(v._id);
    }
    return String(v).trim();
}

export function mongoIdsEqual(a, b) {
    const x = normalizeMongoId(a);
    const y = normalizeMongoId(b);
    return x !== '' && x === y;
}

/** Same list as the Service tab “add” buttons on vehicle details. */
export const VEHICLE_SERVICE_TYPES = [
    'Oil Service',
    'Tire Change',
    'Mechanical Work',
    'Body Work',
    'Accident Repair',
    'Car Wash',
];

/**
 * Service `remark` is stored as JSON on the asset (Oil / Tire / Car Wash schedule, mechanical meta, etc.).
 */
export function parseVehicleServiceRemark(srv) {
    if (!srv?.remark || typeof srv.remark !== 'string') return null;
    try {
        return JSON.parse(srv.remark);
    } catch {
        return null;
    }
}

/** `nextChangeMonth` from `<input type="month" />` e.g. "2026-04" */
export function formatNextChangeMonthDisplay(ym) {
    if (!ym || String(ym).trim() === '') return '—';
    const str = String(ym).trim();
    const m = str.match(/^(\d{4})-(\d{1,2})/);
    if (!m) return str;
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    if (!y || !mo) return str;
    return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
