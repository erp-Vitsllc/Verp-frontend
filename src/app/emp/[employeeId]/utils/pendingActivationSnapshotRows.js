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
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleDateString();
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

function resolvePendingSection(entry = {}) {
    const section = String(entry?.section || '').toLowerCase().trim();
    if (section) return section;
    const card = String(entry?.card || '').toLowerCase();
    if (card.includes('passport')) return 'passport';
    if (card.includes('emirates')) return 'emiratesid';
    if (card.includes('labour')) return 'labourcard';
    if (card.includes('visa')) return 'visa';
    if (card.includes('work')) return 'workdetails';
    if (card.includes('basic')) return 'basicdetails';
    if (card.includes('signature')) return 'signature';
    if (card.includes('emergency')) return 'emergencycontact';
    return '';
}

function normalizeCardSnapshotData(data, entry = null) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const section = resolvePendingSection(entry);
    let next = { ...data };

    if (section === 'emiratesid' && next.emiratesId && typeof next.emiratesId === 'object') {
        next = { ...next.emiratesId };
    }
    if (section === 'labourcard' && next.labourCard && typeof next.labourCard === 'object') {
        next = { ...next.labourCard };
    }

    for (const key of ['_id', '__v', 'employeeId', 'createdAt', 'updatedAt', 'lastUpdated', 'passportExp', 'eidExp', 'medExp']) {
        delete next[key];
    }
    return next;
}

function formatEmployeeRefValue(value) {
    if (!value) return '-';
    if (typeof value === 'object') {
        const name = `${value.firstName || ''} ${value.lastName || ''}`.trim();
        const code = value.employeeId ? String(value.employeeId) : '';
        return name ? `${name}${code ? ` (${code})` : ''}` : code || toDisplayValue(value);
    }
    return String(value);
}

function formatCompanySnapshotValue(value) {
    if (!value) return '-';
    if (typeof value === 'object') {
        return (
            [value.name, value.nickName, value.companyId].filter(Boolean).join(' · ') ||
            value._id?.toString?.() ||
            toDisplayValue(value)
        );
    }
    return String(value);
}

function normalizeRefId(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'object') return String(value._id || value.id || value.$oid || '').trim();
    return String(value).trim();
}

function resolveCompanyDisplay(value, resolveContext = {}) {
    if (value == null || value === '') return '-';
    if (typeof value === 'object') return formatCompanySnapshotValue(value);

    const id = normalizeRefId(value);
    if (!id) return '-';

    const companies = Array.isArray(resolveContext.companies) ? resolveContext.companies : [];
    const fromList = companies.find((c) => normalizeRefId(c?._id || c?.id) === id);
    if (fromList) return formatCompanySnapshotValue(fromList);

    const employeeCompany = resolveContext.employee?.company;
    if (employeeCompany && normalizeRefId(employeeCompany) === id) {
        return formatCompanySnapshotValue(
            typeof employeeCompany === 'object' ? employeeCompany : { _id: employeeCompany },
        );
    }

    return id;
}

function resolveEmployeeRefDisplay(value, resolveContext = {}) {
    if (value == null || value === '') return '-';
    if (typeof value === 'object') return formatEmployeeRefValue(value);

    const id = normalizeRefId(value);
    if (!id) return '-';

    const options = resolveContext.reportingAuthorityOptions || resolveContext.employeeOptions || [];
    const fromOptions = options.find((opt) => normalizeRefId(opt?.value) === id);
    if (fromOptions?.label) return fromOptions.label;

    const employee = resolveContext.employee;
    for (const key of ['primaryReportee', 'secondaryReportee', 'reportingAuthority']) {
        const ref = employee?.[key];
        if (!ref || typeof ref !== 'object') continue;
        if (normalizeRefId(ref) === id) return formatEmployeeRefValue(ref);
    }

    return id;
}

function pushScalarRow(rows, coveredKeys, label, value, keyMarker = null) {
    if (value === undefined || value === null || value === '') return;
    rows.push({ label, value: toDisplayValue(value) });
    if (keyMarker) coveredKeys.add(keyMarker);
}

function pushAttachmentRowTo(rows, label, ref, keyMarker, coveredKeys) {
    if (!ref) return;
    const url = typeof ref === 'object' ? ref.url || ref.data || '' : typeof ref === 'string' ? ref : '';
    rows.push({
        label,
        value: getFileNameFromRef(ref),
        url: url || '',
        attachmentRef: ref,
        isAttachment: true,
    });
    if (keyMarker) coveredKeys.add(keyMarker);
}

function buildPassportSnapshotRows(data) {
    const rows = [];
    const covered = new Set();
    pushScalarRow(rows, covered, 'Passport Number', data.number, 'number');
    pushScalarRow(rows, covered, 'Nationality', data.nationality, 'nationality');
    pushScalarRow(rows, covered, 'Issue Date', data.issueDate, 'issueDate');
    pushScalarRow(rows, covered, 'Expiry Date', data.expiryDate, 'expiryDate');
    pushScalarRow(rows, covered, 'Place Of Issue', data.placeOfIssue, 'placeOfIssue');
    pushAttachmentRowTo(rows, 'Passport Attachment', data.document, 'document', covered);
    return rows;
}

function buildEmiratesIdSnapshotRows(data) {
    const rows = [];
    const covered = new Set();
    pushScalarRow(rows, covered, 'Emirates ID Number', data.number, 'number');
    pushScalarRow(rows, covered, 'Issue Date', data.issueDate, 'issueDate');
    pushScalarRow(rows, covered, 'Expiry Date', data.expiryDate, 'expiryDate');
    pushAttachmentRowTo(rows, 'Emirates ID Attachment', data.document, 'document', covered);
    return rows;
}

function buildLabourCardSnapshotRows(data) {
    const rows = [];
    const covered = new Set();
    pushScalarRow(rows, covered, 'Labour Card Number', data.number, 'number');
    pushScalarRow(rows, covered, 'Issue Date', data.issueDate, 'issueDate');
    pushScalarRow(rows, covered, 'Expiry Date', data.expiryDate, 'expiryDate');
    if (data.noticePeriodMonths != null && data.noticePeriodMonths !== '') {
        pushScalarRow(rows, covered, 'Notice Period (months)', data.noticePeriodMonths, 'noticePeriodMonths');
    }
    pushAttachmentRowTo(rows, 'Labour Card Attachment', data.document, 'document', covered);
    pushAttachmentRowTo(rows, 'Labour Contract Attachment', data.labourContractAttachment, 'labourContractAttachment', covered);
    return rows;
}

function buildVisaSnapshotRows(data) {
    const rows = [];
    const covered = new Set();
    pushScalarRow(rows, covered, 'Visa Type', data.visaType, 'visaType');
    pushScalarRow(rows, covered, 'Visa Number', data.number, 'number');
    pushScalarRow(rows, covered, 'Issue Date', data.issueDate, 'issueDate');
    pushScalarRow(rows, covered, 'Expiry Date', data.expiryDate, 'expiryDate');
    pushScalarRow(rows, covered, 'Sponsor', data.sponsor, 'sponsor');
    pushAttachmentRowTo(rows, 'Visa Attachment', data.document || data.visaCopy, 'document', covered);
    return rows;
}

function buildWorkDetailsSnapshotRows(data, resolveContext = {}) {
    const rows = [];
    const covered = new Set();
    if (data.companyEmail !== undefined && data.companyEmail !== '') {
        rows.push({ label: 'Company Email', value: toDisplayValue(data.companyEmail) });
        covered.add('companyEmail');
    }
    if (data.dateOfJoining) pushScalarRow(rows, covered, 'Date Of Joining', data.dateOfJoining, 'dateOfJoining');
    if (data.contractJoiningDate) {
        pushScalarRow(rows, covered, 'Contract Joining Date', data.contractJoiningDate, 'contractJoiningDate');
    }
    if (data.company !== undefined && data.company !== null && data.company !== '') {
        rows.push({ label: 'Company', value: resolveCompanyDisplay(data.company, resolveContext) });
        covered.add('company');
    }
    pushScalarRow(rows, covered, 'Department', data.department, 'department');
    pushScalarRow(rows, covered, 'Designation', data.designation, 'designation');
    pushScalarRow(rows, covered, 'Work Status', data.status, 'status');
    if (data.probationPeriod != null && data.probationPeriod !== '') {
        pushScalarRow(rows, covered, 'Probation Period (months)', data.probationPeriod, 'probationPeriod');
    }
    if (data.overtime !== undefined && data.overtime !== null) {
        pushScalarRow(rows, covered, 'Overtime', data.overtime, 'overtime');
    }
    if (data.enablePortalAccess !== undefined && data.enablePortalAccess !== null) {
        pushScalarRow(rows, covered, 'Portal Access', data.enablePortalAccess, 'enablePortalAccess');
    }
    if (data.reportingAuthority) {
        rows.push({
            label: 'Reporting Authority',
            value: resolveEmployeeRefDisplay(data.reportingAuthority, resolveContext),
        });
        covered.add('reportingAuthority');
    }
    if (data.primaryReportee) {
        rows.push({
            label: 'Primary Reportee',
            value: resolveEmployeeRefDisplay(data.primaryReportee, resolveContext),
        });
        covered.add('primaryReportee');
    }
    if (data.secondaryReportee) {
        rows.push({
            label: 'Secondary Reportee',
            value: resolveEmployeeRefDisplay(data.secondaryReportee, resolveContext),
        });
        covered.add('secondaryReportee');
    }
    return rows;
}

/** Flatten queued change payloads into label/value rows for read-only tables. */
export function buildActivationSnapshotRows(data, options = {}) {
    const entry = options.entry || null;
    const resolveContext = options.resolveContext || {};
    const normalized = normalizeCardSnapshotData(data, entry);
    if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) return [];

    const section = resolvePendingSection(entry);
    if (section === 'passport') return buildPassportSnapshotRows(normalized);
    if (section === 'emiratesid') return buildEmiratesIdSnapshotRows(normalized);
    if (section === 'labourcard') return buildLabourCardSnapshotRows(normalized);
    if (section === 'visa') return buildVisaSnapshotRows(normalized);
    if (section === 'workdetails') return buildWorkDetailsSnapshotRows(normalized, resolveContext);

    const rows = [];
    const coveredKeys = new Set();

    const pushIfPresentForKey = (label, key) => {
        const value = normalized[key];
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
    pushIfPresent('Provider', normalized.provider, 'provider');
    pushIfPresentForKey('Sponsor', 'sponsor');
    pushIfPresentForKey('Issue Date', 'issueDate');
    pushIfPresentForKey('Expiry Date', 'expiryDate');
    pushIfPresentForKey('Place Of Issue', 'placeOfIssue');

    pushIfPresentForKey('Department', 'department');
    pushIfPresentForKey('Designation', 'designation');
    pushIfPresentForKey('Status', 'status');

    const pushAttachmentRow = (label, ref, keyMarker) => {
        if (!ref) return;
        const url =
            typeof ref === 'object' ? ref.url || ref.data || '' : typeof ref === 'string' ? ref : '';
        rows.push({
            label,
            value: getFileNameFromRef(ref),
            url: url || '',
            attachmentRef: ref,
            isAttachment: true,
        });
        if (keyMarker) coveredKeys.add(keyMarker);
    };

    pushAttachmentRow('Document', normalized.document, 'document');
    pushAttachmentRow('Labour Contract Attachment', normalized.labourContractAttachment, 'labourContractAttachment');
    pushAttachmentRow('Passport Copy', normalized.passportCopy, 'passportCopy');
    pushAttachmentRow('Visa Copy', normalized.visaCopy, 'visaCopy');
    pushAttachmentRow('Bank Attachment', normalized.bankAttachment, 'bankAttachment');

    const skipFallthrough = new Set([
        ...coveredKeys,
        '_id',
        '__v',
        'publicId',
        'mimeType',
        'lastUpdated',
        'passportExp',
        'createdAt',
        'updatedAt',
    ]);

    const handledKeys = new Set(skipFallthrough);
    Object.keys(normalized)
        .sort((a, b) => a.localeCompare(b))
        .forEach((key) => {
            if (handledKeys.has(key)) return;
            const value = normalized[key];
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
                        url: typeof value === 'object' ? value.url || value.data || '' : '',
                        attachmentRef: value,
                        isAttachment: true,
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

/** Compare row display + attachment URL (query stripped) for diffing prior vs proposed tables. */
export function activationSnapshotRowSignature(row) {
    if (!row || typeof row !== 'object') return '';
    const v = row.value != null ? String(row.value).trim() : '';
    const u = row.url != null ? String(row.url).split('?')[0].trim() : '';
    const ref = row.attachmentRef;
    const refStr =
        ref != null
            ? typeof ref === 'string'
                ? ref.split('?')[0].trim()
                : String(ref?.url || ref?.publicId || ref?.data || '')
                      .split('?')[0]
                      .trim()
            : '';
    return `${v}||${u}||${refStr}`;
}

/**
 * Prior / proposed row lists limited to labels where displayed value or document URL differs.
 * Falls back to full rows if no differences are detected (legacy / shape mismatch).
 */
export function filterSnapshotRowsToChangesOnly(entry, options = {}) {
    const prevData = resolveActivationSnapshot(entry, 'previous');
    const propData = resolveActivationSnapshot(entry, 'proposed');
    const rowOpts = { entry, resolveContext: options.resolveContext || {} };
    const prevRows = buildActivationSnapshotRows(prevData, rowOpts);
    const propRows = buildActivationSnapshotRows(propData, rowOpts);
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
