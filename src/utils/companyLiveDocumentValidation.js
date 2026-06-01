import {
    COMPANY_LIVE_DOCUMENT_TYPE_OPTIONS,
    buildCompanyLiveDocumentTypeOptions,
} from '@/utils/companyLiveDocumentUtils';

const NOTE_REGEX = /^[A-Za-z0-9\s.,\-()/'"]*$/;

export function stripDangerousText(value) {
    if (value === undefined || value === null) return '';
    let str = String(value).trim();
    str = str.replace(/<[^>]*>?/gm, '');
    if (/<|>|javascript:|on\w+=/i.test(str)) return '';
    return str;
}

export function normalizeLiveDocumentType(value, allowedOptions = COMPANY_LIVE_DOCUMENT_TYPE_OPTIONS) {
    const v = stripDangerousText(value);
    return allowedOptions.includes(v) ? v : v;
}

export function normalizeLiveDocumentNote(value) {
    return stripDangerousText(value).slice(0, 500);
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

export function validateLiveDocumentType(value, allowedOptions = COMPANY_LIVE_DOCUMENT_TYPE_OPTIONS) {
    const normalized = normalizeLiveDocumentType(value, allowedOptions);
    if (!normalized) return 'Document Type is required';
    if (!allowedOptions.includes(normalized)) {
        return 'Document Type must be selected from the list';
    }
    return '';
}

export function validateLiveDocumentHasExpiry(value) {
    if (value === true || value === false) return '';
    return 'Has Expiry Date is required';
}

export function validateLiveDocumentHasValue(value) {
    if (value === true || value === false) return '';
    return 'Add Value is required';
}

export function validateLiveDocumentValue(value, hasValue) {
    if (hasValue === false) return '';
    if (value === '' || value === null || value === undefined) {
        return 'Value (AED) is required when Add Value is Yes';
    }
    const str = String(value).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(str)) return 'Value must contain numbers only';
    const num = Number(str);
    if (num <= 0) return 'Value must be greater than 0';
    return '';
}

export function validateLiveDocumentNote(value) {
    if (value == null || String(value).trim() === '') return '';
    const normalized = normalizeLiveDocumentNote(value);
    if (normalized.length > 500) return 'Note must be no more than 500 characters';
    if (!NOTE_REGEX.test(normalized)) {
        return 'Note contains invalid special characters';
    }
    return '';
}

export function validateLiveDocumentIssueDate(value) {
    if (value == null || String(value).trim() === '') return '';
    const d = parseDate(value);
    if (!d) return 'Issue Date must be a valid date';
    if (d.getFullYear() < 1900) return 'Issue Date minimum year is 1900';
    const today = startOfDay(new Date());
    if (d > today) return 'Issue Date cannot be in the future';
    return '';
}

export function validateLiveDocumentExpiryDate(value, issueDate, hasExpiry) {
    if (hasExpiry === false) return '';
    if (!value) return 'Expiry Date is required when Has Expiry Date is Yes';
    const expiry = parseDate(value);
    if (!expiry) return 'Expiry Date must be a valid date';
    if (expiry.getFullYear() < 1900) return 'Expiry Date minimum year is 1900';
    const issue = parseDate(issueDate);
    if (issue && expiry <= issue) return 'Expiry Date must be greater than Issue Date';
    return '';
}

export function validateLiveDocumentPdfFile(file, { requireAttachment = true, existingAttachment = null } = {}) {
    if (!file && !existingAttachment) {
        return requireAttachment ? 'Attachment is required' : '';
    }
    if (!file) return '';
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.pdf')) return 'Only PDF files are allowed';
    const mime = String(file.type || '').toLowerCase();
    if (mime && mime !== 'application/pdf') return 'Only PDF files are allowed (application/pdf)';
    if (file.size > 10 * 1024 * 1024) return 'File size must not exceed 10MB';
    if (file.size <= 0) return 'Attachment cannot be empty';
    return '';
}

export function validateDuplicateLiveDocumentFileName(
    fileName,
    documents = [],
    { editingIndex = null, excludeContexts = ['memo', 'moa', 'certificate'] } = {},
) {
    const norm = String(fileName || '').trim().toLowerCase();
    if (!norm) return '';
    for (let i = 0; i < documents.length; i++) {
        if (editingIndex !== null && editingIndex === i) continue;
        const doc = documents[i];
        const ctx = String(doc?.context || '').toLowerCase();
        if (excludeContexts.includes(ctx)) continue;
        const existing = String(doc?.document?.name || '').trim().toLowerCase();
        if (existing && existing === norm) return 'Duplicate files are not allowed';
    }
    return '';
}

export function validateCompanyLiveDocumentFields(data, opts = {}) {
    const errors = {};
    const {
        requireAttachment = true,
        existingAttachment = null,
        existingDocuments = [],
        editingIndex = null,
        allowedTypeOptions = buildCompanyLiveDocumentTypeOptions(existingDocuments, data?.type),
    } = opts;

    const typeErr = validateLiveDocumentType(data?.type, allowedTypeOptions);
    if (typeErr) errors.type = typeErr;

    const hasExpiry = data?.hasExpiry !== false;
    const hasExpiryErr = validateLiveDocumentHasExpiry(data?.hasExpiry !== undefined ? data.hasExpiry : false);
    if (hasExpiryErr) errors.hasExpiry = hasExpiryErr;

    const hasValue = data?.hasValue !== false;
    const hasValueErr = validateLiveDocumentHasValue(data?.hasValue !== undefined ? data.hasValue : false);
    if (hasValueErr) errors.hasValue = hasValueErr;

    const valueErr = validateLiveDocumentValue(data?.value, hasValue);
    if (valueErr) errors.value = valueErr;

    const noteErr = validateLiveDocumentNote(data?.description);
    if (noteErr) errors.description = noteErr;

    const issueRaw = data?.issueDate || data?.startDate || '';
    const issueErr = validateLiveDocumentIssueDate(issueRaw);
    if (issueErr) errors.issueDate = issueErr;

    const expiryErr = validateLiveDocumentExpiryDate(data?.expiryDate, issueRaw, hasExpiry);
    if (expiryErr) errors.expiryDate = expiryErr;

    const fileErr = validateLiveDocumentPdfFile(data?.attachmentFile, {
        requireAttachment,
        existingAttachment: data?.attachment || existingAttachment,
    });
    if (fileErr) errors.attachment = fileErr;

    const dupErr = validateDuplicateLiveDocumentFileName(data?.fileName, existingDocuments, {
        editingIndex,
    });
    if (dupErr) errors.attachment = dupErr;

    return errors;
}

export function normalizeCompanyLiveDocumentPayload(data) {
    const hasExpiry = data?.hasExpiry !== false;
    const hasValue = data?.hasValue !== false;
    const issueDate = data?.issueDate || data?.startDate || '';
    return {
        type: normalizeLiveDocumentType(data?.type),
        description: normalizeLiveDocumentNote(data?.description),
        context: hasExpiry ? 'document_with_expiry' : 'document_without_expiry',
        issueDate: issueDate || '',
        startDate: issueDate || '',
        expiryDate: hasExpiry ? (data?.expiryDate || '') : '',
        value: hasValue ? String(data?.value ?? '').trim() : '',
    };
}
