/**
 * Shared helpers for HR / employee previews of pending company activation rows.
 */

export function toSerializable(value) {
    if (value == null) return null;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
}

export function isEffectivelyEmptyObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.keys(value).length === 0;
}

/** Resolves prior or proposed payload from a pendingReactivationChanges entry. */
export function resolveActivationSnapshot(entry, kind = 'proposed') {
    if (!entry || typeof entry !== 'object') return {};
    const candidates =
        kind === 'previous'
            ? [entry.previousData, entry.previous, entry.oldData, entry.fromData]
            : [entry.proposedData, entry.proposed, entry.newData, entry.toData, entry.payload];
    for (const candidate of candidates) {
        const serial = toSerializable(candidate);
        if (serial == null) continue;
        if (typeof serial === 'object') {
            if (!isEffectivelyEmptyObject(serial) || Array.isArray(serial)) return serial;
        } else {
            return serial;
        }
    }
    return {};
}

export function toLabel(key = '') {
    return String(key)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function toDisplayValue(value) {
    if (value == null || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}t/i.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const d = new Date(value);
            if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
        }
        if (value.startsWith('http://') || value.startsWith('https://')) {
            return value.length > 90 ? `${value.slice(0, 90)}...` : value;
        }
        return value;
    }
    return JSON.stringify(value);
}

export function getFileNameFromRef(value) {
    if (!value) return '-';
    if (typeof value === 'string') {
        const clean = value.split('?')[0];
        const last = clean.split('/').filter(Boolean).pop();
        return last || clean;
    }
    if (typeof value === 'object') {
        if (value.name) return value.name;
        if (value.url) return getFileNameFromRef(value.url);
    }
    return '-';
}

/** Flatten queued change payloads into label/value rows for read-only tables. */
export function buildActivationSnapshotRows(data) {
    if (!data || typeof data !== 'object') return [];
    const rows = [];
    const coveredKeys = new Set();

    const pushIfPresentForKey = (label, key) => {
        const value = data[key];
        if (value === undefined || value === null || value === '') return;
        rows.push({ label, value: toDisplayValue(value) });
        coveredKeys.add(key);
    };

    const pushIfPresent = (label, value, keyMarker = null) => {
        if (value === undefined || value === null || value === '') return;
        rows.push({ label, value: toDisplayValue(value) });
        if (keyMarker) coveredKeys.add(keyMarker);
    };

    // Company specific fields
    pushIfPresentForKey('Company Name', 'name');
    pushIfPresentForKey('Nick Name', 'nickName');
    pushIfPresentForKey('Company Id', 'companyId');
    pushIfPresentForKey('Email', 'email');
    pushIfPresentForKey('Phone', 'phone');
    pushIfPresentForKey('Established Date', 'establishedDate');
    pushIfPresentForKey('Trade License #', 'tradeLicenseNumber');
    pushIfPresentForKey('TL Issue Date', 'tradeLicenseIssueDate');
    pushIfPresentForKey('TL Expiry', 'tradeLicenseExpiry');
    pushIfPresentForKey('TL Owner', 'tradeLicenseOwnerName');
    pushIfPresentForKey('Establishment Card #', 'establishmentCardNumber');
    pushIfPresentForKey('EC Expiry', 'establishmentCardExpiry');

    // Documents
    if (data.tradeLicenseAttachment) {
        rows.push({ label: 'Trade License Attachment', value: getFileNameFromRef(data.tradeLicenseAttachment), url: data.tradeLicenseAttachment.url || '' });
        coveredKeys.add('tradeLicenseAttachment');
    }
    if (data.establishmentCardAttachment) {
        rows.push({ label: 'EC Attachment', value: getFileNameFromRef(data.establishmentCardAttachment), url: data.establishmentCardAttachment.url || '' });
        coveredKeys.add('establishmentCardAttachment');
    }

    const handledKeys = new Set([...coveredKeys, '_id', '__v', 'publicId', 'mimeType', 'lastUpdated', 'createdAt', 'updatedAt']);
    Object.keys(data)
        .sort((a, b) => a.localeCompare(b))
        .forEach((key) => {
            if (handledKeys.has(key)) return;
            const value = data[key];
            if (value === undefined || value === null || value === '') return;
            handledKeys.add(key);

            if (Array.isArray(value)) {
                rows.push({ label: toLabel(key), value: `${value.length} item(s)` });
                return;
            }

            if (typeof value === 'object') {
                const lower = key.toLowerCase();
                if (
                    lower.includes('document') ||
                    lower.includes('attachment') ||
                    value.url ||
                    value.publicId ||
                    typeof value.mimeType === 'string'
                ) {
                    rows.push({
                        label: toLabel(key),
                        value: getFileNameFromRef(value),
                        url: value.url || '',
                    });
                    return;
                }
                try {
                    const flat = JSON.stringify(value);
                    rows.push({ label: toLabel(key), value: flat.length > 200 ? `${flat.slice(0, 190)}...` : flat });
                } catch {
                    rows.push({ label: toLabel(key), value: String(value) });
                }
                return;
            }

            rows.push({ label: toLabel(key), value: toDisplayValue(value) });
        });

    return rows;
}

export function activationSnapshotRowSignature(row) {
    if (!row || typeof row !== 'object') return '';
    const v = row.value != null ? String(row.value).trim() : '';
    const u = row.url != null ? String(row.url).split('?')[0].trim() : '';
    return `${v}||${u}`;
}

export function filterSnapshotRowsToChangesOnly(entry) {
    const prevData = resolveActivationSnapshot(entry, 'previous');
    const propData = resolveActivationSnapshot(entry, 'proposed');
    const prevRows = buildActivationSnapshotRows(prevData);
    const propRows = buildActivationSnapshotRows(propData);
    if (!propRows.length && !prevRows.length) {
        return { previousRows: prevRows, proposedRows: propRows, usedFullFallback: false };
    }

    const prevByLabel = new Map();
    for (const r of prevRows) {
        if (!prevByLabel.has(r.label)) prevByLabel.set(r.label, r);
    }
    const propLabels = new Set(propRows.map((r) => r.label));
    const changed = new Set();

    for (const pr of propRows) {
        const oldR = prevByLabel.get(pr.label);
        if (!oldR) {
            changed.add(pr.label);
            continue;
        }
        if (activationSnapshotRowSignature(oldR) !== activationSnapshotRowSignature(pr)) {
            changed.add(pr.label);
        }
    }
    for (const r of prevRows) {
        if (!propLabels.has(r.label)) changed.add(r.label);
    }

    if (changed.size === 0) {
        return { previousRows: prevRows, proposedRows: propRows, usedFullFallback: true };
    }
    return {
        previousRows: prevRows.filter((r) => changed.has(r.label)),
        proposedRows: propRows.filter((r) => changed.has(r.label)),
        usedFullFallback: false,
    };
}

export function formatSnapshotFallbackJson(value) {
    if (value === undefined || value === null) return '—';
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}
