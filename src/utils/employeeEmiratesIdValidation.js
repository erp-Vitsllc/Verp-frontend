import { validateDate } from '@/utils/validation';

const EMIRATES_ID_REGEX = /^[0-9]{15}$/;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ok = (error = '') => ({ isValid: !error, error });

export function normalizeEmiratesIdNumber(value) {
    return String(value || '')
        .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
        .replace(/\D/g, '')
        .slice(0, 15);
}

export function formatEmiratesIdDisplay(value) {
    const digits = normalizeEmiratesIdNumber(value);
    if (digits.length !== 15) return digits;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`;
}

export function validateEmployeeEmiratesIdNumber(value, { existingNumbers = [], skipNumber = '' } = {}) {
    const normalized = normalizeEmiratesIdNumber(value);
    if (!normalized) return ok('Emirates ID number is required');
    if (normalized.length !== 15) return ok('Emirates ID number must be exactly 15 digits');
    if (!EMIRATES_ID_REGEX.test(normalized)) {
        return ok('Emirates ID number must contain digits only');
    }
    const skip = normalizeEmiratesIdNumber(skipNumber);
    for (const other of existingNumbers) {
        const n = normalizeEmiratesIdNumber(other);
        if (n && n === normalized && n !== skip) {
            return ok('Emirates ID number must be unique');
        }
    }
    return ok();
}

export function validateEmployeeEmiratesIdIssueDate(value) {
    if (!value) return ok('Issue date is required');
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const check = validateDate(value, true, null, today);
    if (!check.isValid) {
        return ok(check.error || 'Issue date cannot be in the future');
    }
    return ok();
}

export function validateEmployeeEmiratesIdExpiryDate(expiryDate, issueDate) {
    if (!expiryDate) return ok('Expiry date is required');
    const expiryCheck = validateDate(expiryDate, true);
    if (!expiryCheck.isValid) return ok(expiryCheck.error || 'Expiry date must be a valid date');
    if (issueDate) {
        const issue = new Date(issueDate);
        const expiry = new Date(expiryDate);
        issue.setHours(0, 0, 0, 0);
        expiry.setHours(0, 0, 0, 0);
        if (expiry <= issue) return ok('Expiry date must be later than the issue date');
    }
    return ok();
}

export function validateEmployeeEmiratesIdFile({ file, fileName, fileBase64, requireFile = true } = {}) {
    const hasFile = Boolean(file || fileBase64 || fileName);
    if (!hasFile) {
        return requireFile ? ok('Emirates ID document is required') : ok();
    }
    if (file) {
        if (file.size === 0) return ok('Empty files are not allowed');
        if (file.size > MAX_FILE_BYTES) return ok('File size must not exceed 10MB');
        const ext = `.${String(file.name || '').split('.').pop().toLowerCase()}`;
        const mime = String(file.type || '').toLowerCase();
        if (mime !== 'application/pdf' && ext !== '.pdf') {
            return ok('Only PDF file format is allowed');
        }
    }
    return ok();
}

export function validateEmployeeEmiratesIdForm(form = {}, { existingNumbers = [], skipNumber = '', requireFile = true } = {}) {
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set('number', validateEmployeeEmiratesIdNumber(form.number, { existingNumbers, skipNumber }));
    set('issueDate', validateEmployeeEmiratesIdIssueDate(form.issueDate));
    set('expiryDate', validateEmployeeEmiratesIdExpiryDate(form.expiryDate, form.issueDate));
    set('file', validateEmployeeEmiratesIdFile({
        file: form.file,
        fileName: form.fileName,
        fileBase64: form.fileBase64,
        requireFile,
    }));

    return errors;
}
