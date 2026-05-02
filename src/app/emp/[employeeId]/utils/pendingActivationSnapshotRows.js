/**
 * Shared helpers for HR / HOD / employee previews of pending profile activation rows
 * (same shaping as ProfileHeader activation review — labels, dates, document file names).
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

/** Resolves prior or proposed payload from a pendingReactivationChanges entry (multiple legacy keys). */
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

    pushIfPresentForKey('Employee Id', 'employeeId');
    pushIfPresentForKey('First Name', 'firstName');
    pushIfPresentForKey('Last Name', 'lastName');
    pushIfPresentForKey('Personal Email', 'email');
    pushIfPresentForKey('Company Email', 'companyEmail');
    pushIfPresentForKey('Contact Number', 'contactNumber');
    pushIfPresentForKey('Gender', 'gender');
    pushIfPresentForKey('Marital Status', 'maritalStatus');
    pushIfPresentForKey('Nationality', 'nationality');
    pushIfPresentForKey('Country', 'country');
    pushIfPresentForKey('Date Of Birth', 'dateOfBirth');
    pushIfPresentForKey('Date Of Joining', 'dateOfJoining');
    pushIfPresentForKey('Contract Joining Date', 'contractJoiningDate');
    pushIfPresentForKey('Contract Expiry Date', 'contractExpiryDate');
    pushIfPresentForKey('Fathers Name', 'fathersName');
    pushIfPresentForKey('Number Of Dependents', 'numberOfDependents');

    pushIfPresentForKey('Address Line 1', 'addressLine1');
    pushIfPresentForKey('Address Line 2', 'addressLine2');
    pushIfPresentForKey('City', 'city');
    pushIfPresentForKey('State', 'state');
    pushIfPresentForKey('Postal Code', 'postalCode');

    pushIfPresentForKey('Current Address Line 1', 'currentAddressLine1');
    pushIfPresentForKey('Current Address Line 2', 'currentAddressLine2');
    pushIfPresentForKey('Current City', 'currentCity');
    pushIfPresentForKey('Current State', 'currentState');
    pushIfPresentForKey('Current Country', 'currentCountry');
    pushIfPresentForKey('Current Postal Code', 'currentPostalCode');

    pushIfPresentForKey('Emergency Contact Name', 'emergencyContactName');
    pushIfPresentForKey('Emergency Contact Relation', 'emergencyContactRelation');
    pushIfPresentForKey('Emergency Contact Number', 'emergencyContactNumber');

    pushIfPresentForKey('Bank Name', 'bankName');
    pushIfPresentForKey('Account Name', 'accountName');
    pushIfPresentForKey('Account Number', 'accountNumber');
    pushIfPresentForKey('IBAN', 'ibanNumber');
    pushIfPresentForKey('SWIFT Code', 'swiftCode');
    pushIfPresentForKey('IFSC Code', 'ifscCode');
    pushIfPresentForKey('Other Bank Details', 'bankOtherDetails');

    pushIfPresentForKey('Probation Period (months)', 'probationPeriod');
    pushIfPresentForKey('Portal Access', 'enablePortalAccess');

    pushIfPresentForKey('Visa Type', 'visaType');
    pushIfPresentForKey('Number', 'number');
    pushIfPresent('Provider', data.provider, 'provider');
    pushIfPresentForKey('Sponsor', 'sponsor');
    pushIfPresentForKey('Issue Date', 'issueDate');
    pushIfPresentForKey('Expiry Date', 'expiryDate');
    pushIfPresentForKey('Place Of Issue', 'placeOfIssue');

    pushIfPresentForKey('Department', 'department');
    pushIfPresentForKey('Designation', 'designation');
    pushIfPresentForKey('Status', 'status');

    if (data.document) {
        const documentUrl = typeof data.document === 'object' ? data.document.url : typeof data.document === 'string' ? data.document : '';
        rows.push({ label: 'Document', value: getFileNameFromRef(data.document), url: documentUrl || '' });
        coveredKeys.add('document');
    }
    if (data.labourContractAttachment) {
        const contractUrl =
            typeof data.labourContractAttachment === 'object'
                ? data.labourContractAttachment.url
                : typeof data.labourContractAttachment === 'string'
                  ? data.labourContractAttachment
                  : '';
        rows.push({
            label: 'Labour Contract Attachment',
            value: getFileNameFromRef(data.labourContractAttachment),
            url: contractUrl || '',
        });
        coveredKeys.add('labourContractAttachment');
    }
    if (data.passportCopy) {
        const passportUrl =
            typeof data.passportCopy === 'object' ? data.passportCopy.url : typeof data.passportCopy === 'string' ? data.passportCopy : '';
        rows.push({ label: 'Passport Copy', value: getFileNameFromRef(data.passportCopy), url: passportUrl || '' });
        coveredKeys.add('passportCopy');
    }
    if (data.visaCopy) {
        const visaUrl = typeof data.visaCopy === 'object' ? data.visaCopy.url : typeof data.visaCopy === 'string' ? data.visaCopy : '';
        rows.push({ label: 'Visa Copy', value: getFileNameFromRef(data.visaCopy), url: visaUrl || '' });
        coveredKeys.add('visaCopy');
    }
    if (data.bankAttachment) {
        const bankUrl =
            typeof data.bankAttachment === 'object'
                ? data.bankAttachment.url || ''
                : typeof data.bankAttachment === 'string'
                  ? data.bankAttachment
                  : '';
        rows.push({
            label: 'Bank Attachment',
            value: getFileNameFromRef(data.bankAttachment),
            url: bankUrl || '',
        });
        coveredKeys.add('bankAttachment');
    }

    const skipFallthrough = new Set([
        ...coveredKeys,
        '_id',
        '__v',
        'publicId',
        'mimeType',
        'lastUpdated',
        'passportExp',
    ]);

    const handledKeys = new Set(skipFallthrough);
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
                    lower.includes('letter') ||
                    value.url ||
                    value.publicId ||
                    typeof value.mimeType === 'string'
                ) {
                    rows.push({
                        label: toLabel(key),
                        value: getFileNameFromRef(value),
                        url: typeof value === 'object' ? value.url || '' : '',
                    });
                    return;
                }
                if (key === 'company') {
                    const id = value?._id;
                    rows.push({
                        label: 'Company',
                        value:
                            [value?.name, value?.companyId, id?.toString?.()].filter(Boolean).join(' · ') || JSON.stringify(value),
                    });
                    return;
                }
                if (['reportingAuthority', 'primaryReportee', 'secondaryReportee'].includes(key)) {
                    rows.push({
                        label: toLabel(key),
                        value:
                            `${value.firstName || ''} ${value.lastName || ''} (${value.employeeId || ''})`.trim() ||
                            value.companyEmail ||
                            value.email ||
                            JSON.stringify(value),
                    });
                    return;
                }
                try {
                    const flat = JSON.stringify(value);
                    if (flat.length <= 400) rows.push({ label: toLabel(key), value: flat });
                    else rows.push({ label: toLabel(key), value: `${flat.slice(0, 360)}…` });
                } catch {
                    rows.push({ label: toLabel(key), value: String(value) });
                }
                return;
            }

            rows.push({ label: toLabel(key), value: toDisplayValue(value) });
        });

    return rows;
}

export function formatSnapshotFallbackJson(value) {
    if (value === undefined || value === null) return '—';
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}
