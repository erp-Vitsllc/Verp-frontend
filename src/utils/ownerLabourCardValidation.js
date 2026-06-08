const LABOUR_CARD_NUMBER_REGEX = /^[A-Za-z0-9]{5,20}$/;

export function stripDangerousText(value) {
    if (value === undefined || value === null) return '';
    let str = String(value).trim();
    str = str.replace(/<[^>]*>?/gm, '');
    if (/<|>|javascript:|on\w+=/i.test(str)) return '';
    return str;
}

export function normalizeLabourCardNumber(value) {
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

export function validateLabourCardNumber(value) {
    const normalized = normalizeLabourCardNumber(value);
    if (!normalized) return 'Labour Card Number is required';
    if (normalized.length < 5) return 'Labour Card Number must be at least 5 characters';
    if (normalized.length > 20) return 'Labour Card Number must be no more than 20 characters';
    if (!LABOUR_CARD_NUMBER_REGEX.test(normalized)) {
        return 'Labour Card Number may contain only letters and numbers (A–Z, a–z, 0–9)';
    }
    return '';
}

export function validateLabourCardExpiryDate(value) {
    if (!value) return 'Expiry Date is required';
    const expiry = parseDate(value);
    if (!expiry) return 'Expiry Date must be a valid date';
    if (expiry.getFullYear() < 1900) return 'Expiry Date minimum year is 1900';
    return '';
}

export function validateLabourCardPdfFile(file) {
    if (!file) return 'Labour Card document is required';
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.pdf')) return 'Only PDF files are allowed';
    const mime = String(file.type || '').toLowerCase();
    if (mime && mime !== 'application/pdf') return 'Only PDF files are allowed (application/pdf)';
    if (file.size > 10 * 1024 * 1024) return 'File size must not exceed 10MB';
    if (file.size <= 0) return 'Labour Card document cannot be empty';
    return '';
}

export function validateOwnerLabourCardFields(data, opts = {}) {
    const errors = {};
    const { requireAttachment = true } = opts;

    const numberErr = validateLabourCardNumber(data?.number);
    if (numberErr) errors.number = numberErr;

    const expiryErr = validateLabourCardExpiryDate(data?.expiryDate);
    if (expiryErr) errors.expiryDate = expiryErr;

    if (requireAttachment && !data?.attachment) {
        errors.attachment = 'Labour Card document is required';
    }

    return errors;
}

export function normalizeOwnerLabourCardPayload(data) {
    return {
        number: normalizeLabourCardNumber(data?.number),
        expiryDate: data?.expiryDate || '',
        lastUpdated: new Date().toISOString(),
        attachment: data?.publicId || data?.attachment || null,
    };
}
