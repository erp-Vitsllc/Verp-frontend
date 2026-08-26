export const FALLBACK_WORK_LOCATIONS = [
    { key: 'office', label: 'Office', isSystem: true },
    { key: 'site', label: 'Site', isSystem: true },
];

export function normalizeWorkLocationKey(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key || key === 'staff') return key === 'staff' ? 'site' : 'office';
    return key;
}

export function workLocationLabel(key, locations = FALLBACK_WORK_LOCATIONS) {
    const k = normalizeWorkLocationKey(key);
    const found = (locations || []).find((row) => row.key === k);
    if (found?.label) return found.label;
    if (k === 'site') return 'Site';
    if (k === 'office') return 'Office';
    return k.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function workLocationBadgeClass(key) {
    const k = normalizeWorkLocationKey(key);
    if (k === 'site') return 'bg-amber-50 text-amber-700';
    if (k === 'office') return 'bg-sky-50 text-sky-700';
    return 'bg-violet-50 text-violet-700';
}

function toTitleCase(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function workLocationStaffTabLabel(location) {
    if (!location) return 'Staff';
    if (location.key === 'site') return 'Site Staffs';
    if (location.key === 'office') return 'Office Staff';
    const name = String(location.label || location.key || 'group').replace(/\s+staffs?$/i, '').trim();
    return toTitleCase(`${name || 'group'} Staff`);
}

function normalizeRow(row) {
    if (!row) return null;
    const key = normalizeWorkLocationKey(row.key || row.value);
    const label = String(row.label || row.name || '').trim() || workLocationLabel(key);
    return {
        _id: row._id,
        key,
        label,
        isSystem: Boolean(row.isSystem) || key === 'office' || key === 'site',
        status: row.status || 'Active',
        sortOrder: Number(row.sortOrder) || 0,
    };
}

let cache = null;
let inflight = null;

export function invalidateWorkLocationsCache() {
    cache = null;
}

export async function fetchWorkLocations(axiosInstance, { force = false } = {}) {
    if (!force && cache) return cache;
    if (!force && inflight) return inflight;

    inflight = axiosInstance
        .get('/WorkLocation', { skipToast: true })
        .then((res) => {
            const rows = res.data?.workLocations || res.data || [];
            const list = (Array.isArray(rows) ? rows : [])
                .map(normalizeRow)
                .filter(Boolean);
            cache = list.length ? list : FALLBACK_WORK_LOCATIONS;
            return cache;
        })
        .catch(() => cache || FALLBACK_WORK_LOCATIONS)
        .finally(() => {
            inflight = null;
        });

    return inflight;
}

export function weekForStaffType(workingTime, staffType) {
    const key = normalizeWorkLocationKey(staffType);
    if (workingTime?.[key] && typeof workingTime[key] === 'object' && key !== 'extra') {
        return workingTime[key];
    }
    const extra = workingTime?.extra && typeof workingTime.extra === 'object' ? workingTime.extra : {};
    if (extra[key] && typeof extra[key] === 'object') return extra[key];
    return workingTime?.office || {};
}
