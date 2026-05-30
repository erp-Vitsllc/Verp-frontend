import {
    generateOwnerProfileId,
    normalizeOwnerProfileId,
    resolveOwnerProfileId,
    validateOwnerProfileIdFormat,
    collectOwnerProfileIdsFromCompanies,
    collectOwnerProfileIdsFromOwnerList,
} from './ownerProfileId';

export {
    generateOwnerProfileId,
    resolveOwnerProfileId,
    normalizeOwnerProfileId,
    collectOwnerProfileIdsFromCompanies,
    collectOwnerProfileIdsFromOwnerList,
} from './ownerProfileId';

const LICENSE_REGEX = /^[A-Z0-9/-]{5,50}$/;
const OWNER_NAME_REGEX = /^[A-Za-z\s.'-]{2,100}$/;

export function normalizeTradeLicenseNumber(value) {
    return String(value ?? '').trim().toUpperCase();
}

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

export function validateTradeLicenseNumber(value) {
    const normalized = normalizeTradeLicenseNumber(value);
    if (!normalized) return 'License Number is required';
    if (normalized.length < 5) return 'License Number must be at least 5 characters';
    if (normalized.length > 50) return 'License Number must be no more than 50 characters';
    if (!LICENSE_REGEX.test(normalized)) {
        return 'License Number may contain only letters, numbers, hyphens, and slashes';
    }
    return '';
}

export function validateTradeLicenseIssueDate(value) {
    if (!value) return 'Issue Date is required';
    const d = parseDate(value);
    if (!d) return 'Issue Date must be a valid date';
    if (d.getFullYear() < 1900) return 'Issue Date minimum year is 1900';
    if (d > new Date()) return 'Issue Date cannot be in the future';
    return '';
}

export function validateTradeLicenseExpiryDate(value, issueDate) {
    if (!value) return 'Expiry Date is required';
    const expiry = parseDate(value);
    if (!expiry) return 'Expiry Date must be a valid date';
    if (expiry.getFullYear() < 1900) return 'Expiry Date minimum year is 1900';
    const issue = parseDate(issueDate);
    if (issue && expiry <= issue) return 'Expiry Date must be greater than Issue Date';
    if (expiry < startOfDay(new Date())) return 'Expiry Date cannot be in the past';
    return '';
}

export function validateOwnerSharePercentage(value) {
    if (value === '' || value === null || value === undefined) return 'Share % is required';
    const str = String(value).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(str)) return 'Share % must be a number with up to 2 decimal places';
    const num = Number(str);
    if (num < 0.01) return 'Share % must be at least 0.01';
    if (num > 100) return 'Share % cannot exceed 100';
    return '';
}

export function validateNewOwnerName(value, { existingOwnerNames = [] } = {}) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return 'Owner name is required';
    if (trimmed.length < 2) return 'Owner name must be at least 2 characters';
    if (trimmed.length > 100) return 'Owner name must be no more than 100 characters';
    if (!OWNER_NAME_REGEX.test(trimmed)) return 'Owner name may contain only letters, spaces, and . \' -';
    const lower = trimmed.toLowerCase();
    if (existingOwnerNames.some((n) => String(n).trim().toLowerCase() === lower)) {
        return 'This name matches an existing owner — use Add Existing instead';
    }
    return '';
}

export function validateTradeLicenseOwners(owners = [], { existingOwnerNames = [] } = {}) {
    const errors = {};
    if (!Array.isArray(owners) || owners.length === 0) {
        errors.owners = 'At least one owner is required';
        return errors;
    }

    const profileIds = new Set();
    const names = new Set();
    let total = 0;

    owners.forEach((owner, index) => {
        const profileId = resolveOwnerProfileId(owner);
        const idFormatErr = profileId ? validateOwnerProfileIdFormat(profileId) : 'Owner ID must be a 4-digit number';
        if (idFormatErr) {
            errors[`owner_${index}_profileId`] = idFormatErr;
        } else if (profileIds.has(profileId)) {
            errors[`owner_${index}_profileId`] = 'Duplicate Owner ID is not allowed';
        } else {
            profileIds.add(profileId);
        }

        const nameKey = String(owner?.name ?? '').trim().toLowerCase();
        if (nameKey) {
            if (names.has(nameKey)) {
                errors[`owner_${index}_name`] = 'Duplicate owner name is not allowed';
            } else {
                names.add(nameKey);
            }
        }

        if (owner?.isNew === true) {
            const nameErr = validateNewOwnerName(owner?.name, { existingOwnerNames });
            if (nameErr) errors[`owner_${index}_name`] = nameErr;
        } else if (!String(owner?.name ?? '').trim()) {
            errors[`owner_${index}_name`] = 'Owner name is required';
        }

        const shareErr = validateOwnerSharePercentage(owner?.sharePercentage);
        if (shareErr) errors[`owner_${index}_share`] = shareErr;
        else total += Number(owner.sharePercentage);
    });

    if (Math.round(total * 100) / 100 !== 100) {
        errors.ownersTotal = `Total owner share must equal exactly 100% (currently ${Math.round(total * 100) / 100}%)`;
    }

    return errors;
}

/** @returns {Record<string, string>} */
export function validateTradeLicenseFields(data, { existingOwnerNames = [], requireAttachment = true } = {}) {
    const errors = {};
    const numberErr = validateTradeLicenseNumber(data?.number);
    if (numberErr) errors.number = numberErr;

    const issueErr = validateTradeLicenseIssueDate(data?.issueDate);
    if (issueErr) errors.issueDate = issueErr;

    const expiryErr = validateTradeLicenseExpiryDate(data?.expiryDate, data?.issueDate);
    if (expiryErr) errors.expiryDate = expiryErr;

    if (requireAttachment && !data?.attachment) {
        errors.attachment = 'PDF attachment is required';
    }

    const ownerErrors = validateTradeLicenseOwners(data?.owners || [], { existingOwnerNames });
    Object.assign(errors, ownerErrors);

    return errors;
}

export function validateTradeLicensePdfFile(file) {
    if (!file) return 'Attachment is required';
    if (file.type && file.type !== 'application/pdf') return 'Only PDF files are allowed';
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.pdf')) return 'Only PDF files are allowed';
    if (file.size > 10 * 1024 * 1024) return 'File size must not exceed 10MB';
    return '';
}

/** Ensure every owner row has a unique 4-digit ID before save. */
export function ensureOwnerProfileIds(owners = [], companies = []) {
    const used = collectOwnerProfileIdsFromCompanies(companies);
    return (owners || []).map((owner) => {
        const row = { ...owner };
        let id = resolveOwnerProfileId(row);
        if (id && !used.has(id)) {
            used.add(id);
            row.ownerProfileId = id;
            return row;
        }
        if (id && used.has(id)) {
            return row;
        }
        id = generateOwnerProfileId(used);
        used.add(id);
        row.ownerProfileId = id;
        return row;
    });
}
