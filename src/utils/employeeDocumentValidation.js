import { stripDangerousText } from '@/utils/employeeAddValidation';
import { validateDate } from '@/utils/validation';

const TYPE_REGEX = /^[A-Za-z0-9\s.,\-()/'"]+$/;
const NOTE_REGEX = /^[A-Za-z0-9\s.,\-()/'"]*$/;
export const EMPLOYEE_DOC_PDF_MAX_BYTES = 10 * 1024 * 1024;
const VALUE_REGEX = /^\d+(\.\d{1,2})?$/;

const ok = (error = '') => ({ isValid: !error, error });

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function validateEmployeeDocumentType(value) {
    const normalized = stripDangerousText(value);
    if (!normalized) return ok('Document Type is required');
    if (normalized.length < 2) return ok('Document Type must be at least 2 characters');
    if (normalized.length > 50) return ok('Document Type must be no more than 50 characters');
    if (!TYPE_REGEX.test(normalized)) return ok('Document Type contains invalid characters');
    return ok();
}

export function validateEmployeeDocumentDescription(value) {
    const normalized = stripDangerousText(value);
    if (!normalized) return ok();
    if (normalized.length < 2) return ok('Note must be at least 2 characters when provided');
    if (normalized.length > 500) return ok('Note must be no more than 500 characters');
    if (!NOTE_REGEX.test(normalized)) return ok('Note contains invalid characters');
    return ok();
}

export function validateEmployeeDocumentIssueDate(value) {
    if (!value || String(value).trim() === '') return ok();
    const check = validateDate(value, true);
    if (!check.isValid) return ok(check.error || 'Issue Date must be a valid date');
    const d = parseDate(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d > today) return ok('Issue Date cannot be in the future');
    return ok();
}

export function validateEmployeeDocumentExpiryDate(value, issueDate, hasExpiry) {
    if (hasExpiry === false) return ok();
    if (!value || String(value).trim() === '') {
        return ok('Expiry date is required when Has Expiry Date is Yes');
    }
    const check = validateDate(value, true);
    if (!check.isValid) return ok(check.error || 'Expiry Date must be a valid date');
    const expiry = parseDate(value);
    const issue = parseDate(issueDate);
    if (issue) {
        issue.setHours(0, 0, 0, 0);
        expiry.setHours(0, 0, 0, 0);
        if (expiry <= issue) return ok('Expiry Date must be after Issue Date');
    }
    return ok();
}

export function validateEmployeeDocumentValue(value, hasValue) {
    if (hasValue === false) return ok();
    if (value === '' || value === null || value === undefined) {
        return ok('Value is required when Add Value is Yes');
    }
    const str = String(value).trim();
    if (!VALUE_REGEX.test(str)) return ok('Value must be a number with up to 2 decimal places');
    const num = parseFloat(str);
    if (num < 0) return ok('Value must be 0 or greater');
    if (num > 10000000) return ok('Value must not exceed 10,000,000');
    return ok();
}

export function validateEmployeeDocumentPdfFile(file, { requireFile = true, hasExisting = false } = {}) {
    if (!file && !hasExisting) {
        return requireFile ? ok('Document File is required') : ok();
    }
    if (!file) return ok();
    if (file.size === 0) return ok('Empty files are not allowed');
    if (file.size > EMPLOYEE_DOC_PDF_MAX_BYTES) return ok('File size must not exceed 10MB');
    const name = String(file.name || '').toLowerCase();
    const mime = String(file.type || '').toLowerCase();
    if (mime !== 'application/pdf' && !name.endsWith('.pdf')) {
        return ok('Only PDF files are allowed');
    }
    return ok();
}

export function validateEmployeeDocumentForm(form = {}, options = {}) {
    const {
        isLabourModal = false,
        requireFile = true,
        hasExistingFile = false,
    } = options;

    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    if (!isLabourModal) {
        set('type', validateEmployeeDocumentType(form.type));
        set('description', validateEmployeeDocumentDescription(form.description));
        set('issueDate', validateEmployeeDocumentIssueDate(form.issueDate));
        const hasExpiry = form.hasExpiry !== false;
        set('expiryDate', validateEmployeeDocumentExpiryDate(form.expiryDate, form.issueDate, hasExpiry));
        set('value', validateEmployeeDocumentValue(form.value, form.hasValue));
    }

    const hasFile = Boolean(form.file || form.fileName || form.fileBase64);
    if (requireFile && !hasFile && !hasExistingFile) {
        errors.file = 'Document File is required';
    } else if (form.file) {
        set('file', validateEmployeeDocumentPdfFile(form.file));
    }

    return errors;
}
