const PROVIDER_REGEX = /^[A-Za-z0-9\s&().,-]{2,100}$/;
const POLICY_NUMBER_REGEX = /^[A-Za-z0-9]{5,30}$/;

export function stripDangerousText(value) {
    if (value === undefined || value === null) return '';
    let str = String(value).trim();
    str = str.replace(/<[^>]*>?/gm, '');
    if (/<|>|javascript:|on\w+=/i.test(str)) return '';
    return str;
}

export function normalizeMedicalProvider(value) {
    return stripDangerousText(value).replace(/\s+/g, ' ').trim();
}

export function normalizeMedicalPolicyNumber(value) {
    return stripDangerousText(value).replace(/\s/g, '');
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

export function validateMedicalProvider(value) {
    const normalized = normalizeMedicalProvider(value);
    if (!normalized) return 'Insurance Provider is required';
    if (normalized.length < 2) return 'Insurance Provider must be at least 2 characters';
    if (normalized.length > 100) return 'Insurance Provider must be no more than 100 characters';
    if (!PROVIDER_REGEX.test(normalized)) {
        return 'Insurance Provider may contain only letters, numbers, spaces, and & ( ) . , -';
    }
    return '';
}

export function validateMedicalPolicyNumber(value) {
    const normalized = normalizeMedicalPolicyNumber(value);
    if (!normalized) return 'Policy Number is required';
    if (normalized.length < 5) return 'Policy Number must be at least 5 characters';
    if (normalized.length > 30) return 'Policy Number must be no more than 30 characters';
    if (!POLICY_NUMBER_REGEX.test(normalized)) {
        return 'Policy Number may contain only letters and numbers (A–Z, a–z, 0–9)';
    }
    return '';
}

export function validateMedicalIssueDate(value) {
    if (!value) return 'Issue Date is required';
    const d = parseDate(value);
    if (!d) return 'Issue Date must be a valid date';
    if (d.getFullYear() < 1900) return 'Issue Date minimum year is 1900';
    return '';
}

export function validateMedicalExpiryDate(value, issueDate) {
    if (!value) return 'Expiry Date is required';
    const expiry = parseDate(value);
    if (!expiry) return 'Expiry Date must be a valid date';
    if (expiry.getFullYear() < 1900) return 'Expiry Date minimum year is 1900';
    const issue = parseDate(issueDate);
    if (issue && expiry <= issue) return 'Expiry Date must be greater than Issue Date';
    return '';
}

export function validateMedicalPdfFile(file) {
    if (!file) return 'Medical Insurance document is required';
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.pdf')) return 'Only PDF files are allowed';
    const mime = String(file.type || '').toLowerCase();
    if (mime && mime !== 'application/pdf') return 'Only PDF files are allowed (application/pdf)';
    if (file.size > 10 * 1024 * 1024) return 'File size must not exceed 10MB';
    if (file.size <= 0) return 'Medical Insurance document cannot be empty';
    return '';
}

export function validateOwnerMedicalInsuranceFields(data, opts = {}) {
    const errors = {};
    const { requireAttachment = true } = opts;

    const providerErr = validateMedicalProvider(data?.provider);
    if (providerErr) errors.provider = providerErr;

    const numberErr = validateMedicalPolicyNumber(data?.number);
    if (numberErr) errors.number = numberErr;

    const issueErr = validateMedicalIssueDate(data?.issueDate);
    if (issueErr) errors.issueDate = issueErr;

    const expiryErr = validateMedicalExpiryDate(data?.expiryDate, data?.issueDate);
    if (expiryErr) errors.expiryDate = expiryErr;

    if (requireAttachment && !data?.attachment) {
        errors.attachment = 'Medical Insurance document is required';
    }

    return errors;
}

export function normalizeOwnerMedicalInsurancePayload(data) {
    return {
        provider: normalizeMedicalProvider(data?.provider),
        number: normalizeMedicalPolicyNumber(data?.number),
        issueDate: data?.issueDate || '',
        expiryDate: data?.expiryDate || '',
        attachment: data?.publicId || data?.attachment || null,
    };
}
