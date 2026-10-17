export function parseTaskInboxExtra3(extra3) {
    if (extra3 == null || extra3 === '') return {};
    if (typeof extra3 === 'object') return extra3;
    try {
        const parsed = JSON.parse(String(extra3));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function isExpiryFollowUpTaskText(value = '') {
    return /^Expiry follow-up required:/i.test(String(value || '').trim());
}

/**
 * Document expiry already has its own reminder row.
 * A Task Manager copy of that follow-up does not belong in the module bell.
 */
export function isExpiryFollowUpTaskInboxRow(row = {}) {
    const type = String(row?.requestType || row?.type || '').trim();
    if (type !== 'Task Manager') return false;
    return isExpiryFollowUpTaskText(row?.extra1 || row?.taskName || '');
}

function expiryDocumentLabel(extra1 = '') {
    const raw = String(extra1 || '').trim();
    if (!raw) return '';
    const prefix = 'Expiry follow-up required:';
    const body = raw.toLowerCase().startsWith(prefix.toLowerCase())
        ? raw.slice(prefix.length).trim()
        : raw;
    return body.replace(/\s*\(Exp:\s*[^)]+\)\s*$/i, '').trim();
}

/**
 * Older reminders stored only the vehicle name, for example "YARIS (VEGA-VHCL-006)".
 * Renew and Not Renew finish the document task, so that copy must leave the bell.
 * A real card still uses its document name (Insurance Card, Mulkia, Warranty, …).
 */
export function isLegacyVehicleNameExpiryRow(row = {}) {
    const type = String(row?.requestType || row?.type || '').trim();
    if (type !== 'Vehicle Document Expiry Reminder') return false;
    const raw = String(row?.extra1 || '').trim();
    const prefix = 'Expiry follow-up required:';
    const hasPrefix = raw.toLowerCase().startsWith(prefix.toLowerCase());
    const label = expiryDocumentLabel(raw);
    if (!label) return true;
    if (/(mulkia|registration|insurance|warranty|permit|petrol|toll|mortgage)/i.test(label)) {
        return false;
    }
    if (!hasPrefix) return true;
    const name = String(row?.subjectName || '').trim().toLowerCase();
    const code = String(row?.subjectEmployeeId || '').trim().toLowerCase();
    const extra2 = String(row?.extra2 || '').trim().toLowerCase();
    const labelLower = label.toLowerCase();
    if (code && labelLower.includes(code)) return true;
    if (name && (labelLower === name || labelLower.startsWith(`${name} (`))) return true;
    if (extra2 && labelLower === extra2) return true;
    return false;
}

/** Same underlying task, even when several notices were saved for it. */
export function taskInboxIdentity(row = {}) {
    const meta = parseTaskInboxExtra3(row?.extra3);
    return String(meta.taskManagerId || meta.taskKey || '').trim();
}
