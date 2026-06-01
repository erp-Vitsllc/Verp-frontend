const LICENSE_NUMBER_REGEX = /^[A-Za-z0-9]{5,20}$/;

export function stripDangerousText(value) {
    if (value === undefined || value === null) return '';
    let str = String(value).trim();
    str = str.replace(/<[^>]*>?/gm, '');
    if (/<|>|javascript:|on\w+=/i.test(str)) return '';
    return str;
}

export function normalizeDrivingLicenseNumber(value) {
    return stripDangerousText(value).replace(/\s/g, '');
}

export function normalizeIssuingCountry(value) {
    return stripDangerousText(value).replace(/\s+/g, ' ').trim();
}

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function validateDrivingLicenseNumber(value) {
    const normalized = normalizeDrivingLicenseNumber(value);
    if (!normalized) return 'License Number is required';
    if (normalized.length < 5) return 'License Number must be at least 5 characters';
    if (normalized.length > 20) return 'License Number must be no more than 20 characters';
    if (!LICENSE_NUMBER_REGEX.test(normalized)) {
        return 'License Number may contain only letters and numbers (A–Z, a–z, 0–9)';
    }
    return '';
}

export function validateDrivingLicenseIssueDate(value) {
    if (!value) return 'Issue Date is required';
    const d = parseDate(value);
    if (!d) return 'Issue Date must be a valid date';
    if (d.getFullYear() < 1900) return 'Issue Date minimum year is 1900';
    return '';
}

export function validateDrivingLicenseExpiryDate(value, issueDate) {
    if (!value) return 'Expiry Date is required';
    const expiry = parseDate(value);
    if (!expiry) return 'Expiry Date must be a valid date';
    if (expiry.getFullYear() < 1900) return 'Expiry Date minimum year is 1900';
    const issue = parseDate(issueDate);
    if (issue && expiry <= issue) return 'Expiry Date must be greater than Issue Date';
    return '';
}

export function validateIssuingCountry(value) {
    const normalized = normalizeIssuingCountry(value);
    if (!normalized) return 'Issuing Country is required';
    if (normalized.length < 2) return 'Issuing Country must be at least 2 characters';
    if (normalized.length > 100) return 'Issuing Country must be no more than 100 characters';
    return '';
}

export function validateDrivingLicensePdfFile(file) {
    if (!file) return 'Driving License document is required';
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.pdf')) return 'Only PDF files are allowed';
    const mime = String(file.type || '').toLowerCase();
    if (mime && mime !== 'application/pdf') return 'Only PDF files are allowed (application/pdf)';
    if (file.size > 10 * 1024 * 1024) return 'File size must not exceed 10MB';
    if (file.size <= 0) return 'Driving License document cannot be empty';
    return '';
}

export function validateOwnerDrivingLicenseFields(data, opts = {}) {
    const errors = {};
    const { requireAttachment = true } = opts;

    const numberErr = validateDrivingLicenseNumber(data?.number);
    if (numberErr) errors.number = numberErr;

    const issueErr = validateDrivingLicenseIssueDate(data?.issueDate);
    if (issueErr) errors.issueDate = issueErr;

    const expiryErr = validateDrivingLicenseExpiryDate(data?.expiryDate, data?.issueDate);
    if (expiryErr) errors.expiryDate = expiryErr;

    const countryErr = validateIssuingCountry(data?.issuingCountry);
    if (countryErr) errors.issuingCountry = countryErr;

    if (requireAttachment && !data?.attachment) {
        errors.attachment = 'Driving License document is required';
    }

    return errors;
}

export function normalizeOwnerDrivingLicensePayload(data) {
    return {
        number: normalizeDrivingLicenseNumber(data?.number),
        issueDate: data?.issueDate || '',
        expiryDate: data?.expiryDate || '',
        issuingCountry: normalizeIssuingCountry(data?.issuingCountry),
        attachment: data?.publicId || data?.attachment || null,
    };
}
