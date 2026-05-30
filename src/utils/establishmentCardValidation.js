const CARD_NUMBER_REGEX = /^[A-Z0-9-]{4,30}$/;

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
]);

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

export function normalizeEstablishmentCardNumber(value) {
    return String(value ?? '').trim().toUpperCase();
}

export function sanitizeEstablishmentFileName(name) {
    const base = String(name || 'document')
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[._-]+|[._-]+$/g, '');
    return (base || 'document').slice(0, 200);
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

export function validateEstablishmentCardNumber(value) {
    const normalized = normalizeEstablishmentCardNumber(value);
    if (!normalized) return 'Card Number is required';
    if (normalized.length < 4) return 'Card Number must be at least 4 characters';
    if (normalized.length > 30) return 'Card Number must be no more than 30 characters';
    if (!CARD_NUMBER_REGEX.test(normalized)) {
        return 'Card Number may contain only letters, numbers, and hyphens (A–Z, 0–9, -)';
    }
    return '';
}

export function validateEstablishmentCardNumberUnique(
    value,
    { companies = [], excludeCompanyId = null, excludeCompanyMongoId = null } = {},
) {
    const normalized = normalizeEstablishmentCardNumber(value);
    if (!normalized) return '';
    for (const comp of companies) {
        const compId = comp?._id != null ? String(comp._id) : '';
        const compCode = comp?.companyId != null ? String(comp.companyId) : '';
        if (
            (excludeCompanyMongoId && compId === String(excludeCompanyMongoId)) ||
            (excludeCompanyId && compCode === String(excludeCompanyId))
        ) {
            continue;
        }
        if (normalizeEstablishmentCardNumber(comp?.establishmentCardNumber) === normalized) {
            return 'Card Number already exists';
        }
    }
    return '';
}

/** Expiry must be strictly in the future (after today). */
export function validateEstablishmentCardExpiryDate(value) {
    if (!value) return 'Expiry Date is required';
    const expiry = parseDate(value);
    if (!expiry) return 'Expiry Date must be a valid date';
    if (expiry.getFullYear() < 1900) return 'Expiry Date minimum year is 1900';
    const today = startOfDay(new Date());
    if (expiry <= today) return 'Expiry Date must be a future date';
    return '';
}

export function validateEstablishmentCardAttachmentFile(file) {
    if (!file) return 'Attachment is required';
    const name = String(file.name || '').toLowerCase();
    const extOk = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
    const mime = String(file.type || '').toLowerCase();
    const mimeOk = !mime || ALLOWED_MIME_TYPES.has(mime);
    if (!extOk) return 'Only PDF, JPG, JPEG, or PNG files are allowed';
    if (!mimeOk) return 'Invalid file type. Only PDF, JPG, JPEG, or PNG are allowed';
    if (file.size > 5 * 1024 * 1024) return 'File size must not exceed 5MB';
    return '';
}

/** @returns {Record<string, string>} */
export function validateEstablishmentCardFields(
    data,
    { requireAttachment = true, companies = [], excludeCompanyId = null, excludeCompanyMongoId = null } = {},
) {
    const errors = {};
    const numberErr = validateEstablishmentCardNumber(data?.number);
    if (numberErr) errors.number = numberErr;

    const uniqueErr = validateEstablishmentCardNumberUnique(data?.number, {
        companies,
        excludeCompanyId,
        excludeCompanyMongoId,
    });
    if (uniqueErr) errors.number = uniqueErr;

    const expiryErr = validateEstablishmentCardExpiryDate(data?.expiryDate);
    if (expiryErr) errors.expiryDate = expiryErr;

    if (requireAttachment && !data?.attachment) {
        errors.attachment = 'Attachment is required (PDF, JPG, JPEG, or PNG, max 5MB)';
    }

    return errors;
}
