import { UTILITY_TOGGLE_FIELDS } from '../components/AddUtilityModal';

export const UTILITIES_STORAGE_KEY = 'verp_utility_bills_created';
export const UTILITY_ENTRIES_STORAGE_KEY = 'verp_utility_bill_entries';

export function loadJsonArray(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveJsonArray(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
}

export function normalizeUtilityFields(fields = {}) {
    const next = { ...fields };
    if (next.paymentDetails != null && next.paymentDate == null) {
        next.paymentDate = next.paymentDetails;
    }
    delete next.paymentDetails;
    return next;
}

export function getUtilityEntryById(id) {
    const entries = loadJsonArray(UTILITY_ENTRIES_STORAGE_KEY);
    return entries.find((e) => String(e.id) === String(id)) || null;
}

export function getUtilityConfigForType(type) {
    const utilities = loadJsonArray(UTILITIES_STORAGE_KEY);
    const match = utilities.find(
        (u) => String(u.type || '').toLowerCase() === String(type || '').toLowerCase(),
    );
    if (!match) return null;
    return { ...match, fields: normalizeUtilityFields(match.fields || {}) };
}

export function updateUtilityEntry(id, patch) {
    const entries = loadJsonArray(UTILITY_ENTRIES_STORAGE_KEY);
    const next = entries.map((e) =>
        String(e.id) === String(id) ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e,
    );
    saveJsonArray(UTILITY_ENTRIES_STORAGE_KEY, next);
    return next.find((e) => String(e.id) === String(id)) || null;
}

export function formatEntryFieldLabel(key) {
    if (key === 'contractStart') return 'Contract Start';
    if (key === 'contractEnd') return 'Contract End';
    if (key === 'billingType') return 'Billing Type';
    const found = UTILITY_TOGGLE_FIELDS.find((f) => f.key === key);
    return found?.label || key;
}

export function formatCellValue(key, values) {
    const v = values || {};
    if (key === 'contractPeriod') {
        const start = v.contractStart || '—';
        const end = v.contractEnd || '—';
        return `${start} → ${end}`;
    }
    if (key === 'monthlyRental') {
        if (v.monthlyRental === '' || v.monthlyRental == null) return '—';
        const n = Number(v.monthlyRental);
        return Number.isFinite(n)
            ? `${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`
            : String(v.monthlyRental);
    }
    if (key === 'paymentDate') {
        const typeLabel =
            v.billingType === 'usage' ? 'Usage' : v.billingType === 'fixed' ? 'Fixed (Package)' : '';
        if (v.billingType === 'usage') return typeLabel || 'Usage';
        if (v.paymentDate) return typeLabel ? `${typeLabel}: ${v.paymentDate}` : v.paymentDate;
        return typeLabel || '—';
    }
    if (key === 'billingType') {
        if (v.billingType === 'usage') return 'Usage';
        if (v.billingType === 'fixed') return 'Fixed (Package)';
        return v.billingType || '—';
    }
    if (key === 'assignment') return null;
    return v[key] || '—';
}

/** Detail rows derived from enabled toggles + saved values. */
export function buildDetailFieldRows(entry, utilityConfig) {
    const fields = utilityConfig?.fields || {};
    const values = entry?.values || {};
    const rows = [];

    UTILITY_TOGGLE_FIELDS.forEach((def) => {
        if (fields[def.key] !== 'yes' || def.key === 'assignment') return;
        if (def.key === 'contractPeriod') {
            rows.push({
                key: 'contractStart',
                label: 'Contract Start',
                value: values.contractStart || '—',
            });
            rows.push({
                key: 'contractEnd',
                label: 'Contract End',
                value: values.contractEnd || '—',
            });
            return;
        }
        if (def.key === 'paymentDate') {
            rows.push({
                key: 'billingType',
                label: 'Billing Type',
                value: formatCellValue('billingType', values),
            });
            if (values.billingType === 'fixed') {
                rows.push({
                    key: 'paymentDate',
                    label: 'Payment Date',
                    value: values.paymentDate || '—',
                });
            }
            return;
        }
        rows.push({
            key: def.key,
            label: def.label,
            value: formatCellValue(def.key, values),
            isDescription: def.key === 'location' || def.key === 'planDetails',
        });
    });

    if (entry?.assignedTo) {
        rows.push({
            key: 'assignedTo',
            label: entry.assignedToType === 'Company' ? 'Assigned Company' : 'Assigned Employee',
            value: entry.assignedTo,
        });
    }

    return rows;
}

export function getMonthlyRentalAmount(entry) {
    const n = Number(entry?.values?.monthlyRental);
    return Number.isFinite(n) ? n : 0;
}
