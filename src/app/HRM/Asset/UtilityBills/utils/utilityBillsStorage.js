import { UTILITY_TOGGLE_FIELDS } from '../components/AddUtilityModal';

export const UTILITIES_STORAGE_KEY = 'verp_utility_bills_created';
export const UTILITY_ENTRIES_STORAGE_KEY = 'verp_utility_bill_entries';
/** Per logged-in user Add Bills drafts (private to that browser user). */
export const UTILITY_BILL_DRAFTS_STORAGE_KEY = 'verp_utility_bill_drafts';
/** Admin-managed provider dropdown options (seeded with Etisalat / Du). */
export const UTILITY_PROVIDERS_STORAGE_KEY = 'verp_utility_providers';

export const DEFAULT_UTILITY_PROVIDERS = ['Etisalat', 'Du'];

export function getLoggedInUtilityUserKey() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const key =
            user.employeeObjectId ||
            user.empObjectId ||
            user._id ||
            user.id ||
            user.employeeId ||
            user.username ||
            '';
        return String(key || '').trim();
    } catch {
        return '';
    }
}

function draftStoreKey(userKey, utilityType) {
    return `${String(userKey || '').trim()}::${String(utilityType || '').trim().toLowerCase()}`;
}

export function loadUtilityBillDraft(utilityType) {
    const userKey = getLoggedInUtilityUserKey();
    if (!userKey || !utilityType) return null;
    try {
        const raw = localStorage.getItem(UTILITY_BILL_DRAFTS_STORAGE_KEY);
        if (!raw) return null;
        const map = JSON.parse(raw);
        if (!map || typeof map !== 'object') return null;
        const draft = map[draftStoreKey(userKey, utilityType)];
        if (!draft || draft.userKey !== userKey) return null;
        return draft;
    } catch {
        return null;
    }
}

export function saveUtilityBillDraft(utilityType, draftPayload) {
    const userKey = getLoggedInUtilityUserKey();
    if (!userKey || !utilityType) return false;
    try {
        const raw = localStorage.getItem(UTILITY_BILL_DRAFTS_STORAGE_KEY);
        const map = raw ? JSON.parse(raw) : {};
        const next = map && typeof map === 'object' ? map : {};
        next[draftStoreKey(userKey, utilityType)] = {
            ...draftPayload,
            userKey,
            utilityType,
            updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(UTILITY_BILL_DRAFTS_STORAGE_KEY, JSON.stringify(next));
        return true;
    } catch {
        return false;
    }
}

export function clearUtilityBillDraft(utilityType) {
    const userKey = getLoggedInUtilityUserKey();
    if (!userKey || !utilityType) return;
    try {
        const raw = localStorage.getItem(UTILITY_BILL_DRAFTS_STORAGE_KEY);
        if (!raw) return;
        const map = JSON.parse(raw);
        if (!map || typeof map !== 'object') return;
        delete map[draftStoreKey(userKey, utilityType)];
        localStorage.setItem(UTILITY_BILL_DRAFTS_STORAGE_KEY, JSON.stringify(map));
    } catch {
        /* ignore */
    }
}

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

function normalizeProviderList(list) {
    const unique = [];
    (Array.isArray(list) ? list : []).forEach((t) => {
        const name = String(t || '').trim();
        if (name && !unique.some((x) => x.toLowerCase() === name.toLowerCase())) {
            unique.push(name);
        }
    });
    return unique;
}

/** Load provider dropdown options; seed Etisalat / Du on first use. */
export function loadUtilityProviders() {
    try {
        const raw = localStorage.getItem(UTILITY_PROVIDERS_STORAGE_KEY);
        if (!raw) {
            saveUtilityProviders(DEFAULT_UTILITY_PROVIDERS);
            return [...DEFAULT_UTILITY_PROVIDERS];
        }
        const parsed = JSON.parse(raw);
        const list = normalizeProviderList(parsed);
        if (!list.length) {
            saveUtilityProviders(DEFAULT_UTILITY_PROVIDERS);
            return [...DEFAULT_UTILITY_PROVIDERS];
        }
        return list;
    } catch {
        return [...DEFAULT_UTILITY_PROVIDERS];
    }
}

export function saveUtilityProviders(list) {
    const next = normalizeProviderList(list);
    localStorage.setItem(UTILITY_PROVIDERS_STORAGE_KEY, JSON.stringify(next));
    return next;
}

export function addUtilityProvider(name) {
    const label = String(name || '').trim();
    if (!label) return { ok: false, message: 'Enter a provider name.', providers: loadUtilityProviders() };
    const current = loadUtilityProviders();
    if (current.some((p) => p.toLowerCase() === label.toLowerCase())) {
        return { ok: false, message: 'That provider already exists.', providers: current };
    }
    const providers = saveUtilityProviders([...current, label]);
    return { ok: true, providers };
}

export function removeUtilityProvider(name) {
    const label = String(name || '').trim();
    const current = loadUtilityProviders();
    if (isUtilityProviderInUse(label)) {
        return {
            ok: false,
            message: `“${label}” is in use and cannot be removed.`,
            providers: current,
        };
    }
    const providers = saveUtilityProviders(
        current.filter((p) => p.toLowerCase() !== label.toLowerCase()),
    );
    return { ok: true, providers };
}

export function isUtilityProviderInUse(name) {
    const key = String(name || '').trim().toLowerCase();
    if (!key) return false;
    const entries = loadJsonArray(UTILITY_ENTRIES_STORAGE_KEY);
    return entries.some(
        (e) => String(e?.values?.provider || '').trim().toLowerCase() === key,
    );
}

export function normalizeUtilityFields(fields = {}) {
    const next = { ...fields };
    if (next.paymentDetails != null && next.paymentDate == null) {
        next.paymentDate = next.paymentDetails;
    }
    delete next.paymentDetails;
    if (next.attachment != null && next.attachment !== 'yes' && next.attachment !== 'no') {
        delete next.attachment;
    }
    return next;
}

/** Entry / utility config lifecycle: Active | Inactive (defaults Active). */
export function entryLifecycleStatus(record) {
    const s = String(record?.status || 'Active').trim().toLowerCase();
    return s === 'inactive' ? 'Inactive' : 'Active';
}

export function isEntryActive(record) {
    return entryLifecycleStatus(record) === 'Active';
}

/** Normalize stored paymentDay (1–31); migrate legacy full dates. */
export function normalizePaymentDay(values = {}) {
    const next = { ...(values || {}) };
    let day = Number(next.paymentDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
        const legacy = String(next.paymentDate || '').trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(legacy)) {
            const d = new Date(legacy);
            if (!Number.isNaN(d.getTime())) day = d.getDate();
        } else if (/^\d{1,2}$/.test(legacy)) {
            day = Number(legacy);
        }
    }
    if (Number.isInteger(day) && day >= 1 && day <= 31) {
        next.paymentDay = day;
    } else {
        delete next.paymentDay;
    }
    delete next.paymentDate;
    return next;
}

export function formatPaymentDayLabel(day) {
    const n = Number(day);
    if (!Number.isInteger(n) || n < 1 || n > 31) return '—';
    return `Day ${n} every month`;
}

export function normalizeUtilityEntry(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    return {
        ...entry,
        status: entryLifecycleStatus(entry),
        values: normalizePaymentDay(entry.values || {}),
    };
}

export function normalizeUtilityEntries(list) {
    return (Array.isArray(list) ? list : []).map(normalizeUtilityEntry);
}

export function getUtilityEntryById(id) {
    const entries = normalizeUtilityEntries(loadJsonArray(UTILITY_ENTRIES_STORAGE_KEY));
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
    if (key === 'paymentDate' || key === 'paymentDay') {
        return formatPaymentDayLabel(v.paymentDay ?? v.paymentDate);
    }
    if (key === 'assignment') return null;
    if (key === 'attachment') {
        const file = v.attachment;
        if (file && typeof file === 'object' && file.name) return String(file.name);
        return '—';
    }
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
                key: 'paymentDay',
                label: 'Payment Day',
                value: formatPaymentDayLabel(values.paymentDay ?? values.paymentDate),
            });
            return;
        }
        rows.push({
            key: def.key,
            label: def.label,
            value: formatCellValue(def.key, values),
            isDescription: def.key === 'location' || def.key === 'planDetails',
        });
    });

    if (fields.attachment === 'yes') {
        const file =
            values.attachment && typeof values.attachment === 'object'
                ? values.attachment
                : null;
        rows.push({
            key: 'attachment',
            label: 'Attachment',
            value: file?.name || '—',
            isAttachment: true,
            attachment: file?.name ? file : null,
        });
    }

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
