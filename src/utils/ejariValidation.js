const EJARI_TYPE_REGEX = /^[A-Za-z0-9\s&(),.-]{3,100}$/;

export function normalizeEjariType(value) {
    return String(value ?? '').trim();
}

export function normalizeEjariNote(value) {
    return String(value ?? '').trim();
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

export function validateEjariType(value) {
    const normalized = normalizeEjariType(value);
    if (!normalized) return 'Ejari Type is required';
    if (normalized.length < 3) return 'Ejari Type must be at least 3 characters';
    if (normalized.length > 100) return 'Ejari Type must be no more than 100 characters';
    if (!EJARI_TYPE_REGEX.test(normalized)) {
        return 'Ejari Type may contain only letters, numbers, spaces, and & ( ) , . -';
    }
    return '';
}

export function validateEjariAddValue(value, hasValue) {
    if (hasValue === false) return '';
    if (value === '' || value === null || value === undefined) {
        return 'Add Value (AED) is required when Add Value is Yes';
    }
    const str = String(value).trim();
    if (!/^\d+(\.\d+)?$/.test(str)) return 'Add Value must be a valid number';
    const num = Number(str);
    if (num < 0) return 'Add Value must be at least 0';
    return '';
}

export function validateEjariNote(value) {
    const note = normalizeEjariNote(value);
    if (!note) return '';
    if (note.length > 500) return 'Note must be no more than 500 characters';
    return '';
}

export function validateEjariIssueDate(value) {
    if (!value) return '';
    const d = parseDate(value);
    if (!d) return 'Issue Date must be a valid date';
    if (d.getFullYear() < 1900) return 'Issue Date minimum year is 1900';
    return '';
}

export function validateEjariExpiryDate(value, issueDate) {
    if (!value) return 'Expiry Date is required';
    const expiry = parseDate(value);
    if (!expiry) return 'Expiry Date must be a valid date';
    if (expiry.getFullYear() < 1900) return 'Expiry Date minimum year is 1900';
    const issue = parseDate(issueDate);
    if (issue && expiry <= issue) return 'Expiry Date must be greater than Issue Date';
    return '';
}

export function validateEjariPdfFile(file) {
    if (!file) return 'Attachment is required';
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.pdf')) return 'Only PDF files are allowed';
    const mime = String(file.type || '').toLowerCase();
    if (mime && mime !== 'application/pdf') return 'Only PDF files are allowed';
    if (file.size > 5 * 1024 * 1024) return 'File size must not exceed 5MB';
    return '';
}

/** @returns {Record<string, string>} */
export function validateEjariFields(data, { requireAttachment = true } = {}) {
    const errors = {};
    const typeErr = validateEjariType(data?.type);
    if (typeErr) errors.type = typeErr;

    const noteErr = validateEjariNote(data?.description);
    if (noteErr) errors.description = noteErr;

    const issueRaw = data?.startDate || data?.issueDate || '';
    const issueErr = validateEjariIssueDate(issueRaw);
    if (issueErr) errors.issueDate = issueErr;

    const expiryErr = validateEjariExpiryDate(data?.expiryDate, issueRaw);
    if (expiryErr) errors.expiryDate = expiryErr;

    const valueErr = validateEjariAddValue(data?.value, data?.hasValue);
    if (valueErr) errors.value = valueErr;

    if (requireAttachment && !data?.attachment) {
        errors.attachment = 'PDF attachment is required (max 5MB)';
    }

    return errors;
}

export function isEjariModalContext(modalData, modalType) {
    return modalData?.context === 'ejari' || modalType === 'addEjari';
}
