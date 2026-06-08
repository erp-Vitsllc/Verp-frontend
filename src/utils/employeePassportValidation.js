import { validateDate } from '@/utils/validation';

const PASSPORT_NUMBER_REGEX = /^[A-Z0-9]{6,15}$/;
const SAFE_FILE_NAME_REGEX = /^[A-Za-z0-9._ -]+$/;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ok = (error = '') => ({ isValid: !error, error });

export function normalizePassportNumber(value) {
    return String(value || '').replace(/\s/g, '').toUpperCase();
}

export function validateEmployeePassportNumber(value) {
    const normalized = normalizePassportNumber(value);
    if (!normalized) return ok('Passport number is required');
    if (!PASSPORT_NUMBER_REGEX.test(normalized)) {
        return ok('Passport number must be 6–15 letters or digits with no special characters');
    }
    return ok();
}

export function validateEmployeePassportCountryName(value, label, allowedNames = []) {
    const name = String(value || '').trim();
    if (!name) return ok(`${label} is required`);
    if (Array.isArray(allowedNames) && allowedNames.length && !allowedNames.includes(name)) {
        return ok(`Please select a valid ${label.toLowerCase()} from the list`);
    }
    return ok();
}

export function validateEmployeePassportIssueDate(value) {
    if (!value) return ok('Issue date is required');
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const check = validateDate(value, true, null, today);
    if (!check.isValid) {
        return ok(check.error || 'Issue date cannot be in the future');
    }
    return ok();
}

export function validateEmployeePassportExpiryDate(expiryDate, issueDate, { profileActive = false } = {}) {
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

export function validateEmployeePassportFile({ file, fileName, fileBase64, requireFile = true } = {}) {
    const hasFile = Boolean(file || fileBase64 || fileName);
    if (!hasFile) {
        return requireFile ? ok('Passport copy is required') : ok();
    }

    const name = String(file?.name || fileName || '').trim();
    if (name && !SAFE_FILE_NAME_REGEX.test(name)) {
        return ok('File name must not contain special characters');
    }

    if (file) {
        if (file.size === 0) return ok('Empty files are not allowed');
        if (file.size > MAX_FILE_BYTES) return ok('File size must be less than 5MB');
        const ext = `.${String(file.name || '').split('.').pop().toLowerCase()}`;
        const mime = String(file.type || '').toLowerCase();
        if (mime !== 'application/pdf' && ext !== '.pdf') {
            return ok('Only PDF file format is allowed');
        }
    }

    return ok();
}

export function validateEmployeePassportForm(form = {}, { allowedCountryNames = [], profileActive = false, requireFile = true } = {}) {
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set('number', validateEmployeePassportNumber(form.number));
    set('nationality', validateEmployeePassportCountryName(form.nationality, 'Passport nationality', allowedCountryNames));
    set('issueDate', validateEmployeePassportIssueDate(form.issueDate));
    set('expiryDate', validateEmployeePassportExpiryDate(form.expiryDate, form.issueDate, { profileActive }));
    set('countryOfIssue', validateEmployeePassportCountryName(form.countryOfIssue, 'Country of issue', allowedCountryNames));
    set('file', validateEmployeePassportFile({
        file: form.file,
        fileName: form.fileName,
        fileBase64: form.fileBase64,
        requireFile,
    }));

    return errors;
}
