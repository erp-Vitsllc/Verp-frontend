import { validateDate } from '@/utils/validation';

const LICENSE_NUMBER_REGEX = /^[A-Za-z0-9]{3,50}$/;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ok = (error = '') => ({ isValid: !error, error });

export function normalizeDrivingLicenseNumber(value) {
    return String(value || '').replace(/\s/g, '').trim();
}

export function validateDrivingLicenseNumber(value, { existingNumbers = [], skipNumber = '' } = {}) {
    const number = normalizeDrivingLicenseNumber(value);
    if (!number) return ok('Driving license number is required');
    if (number.length < 3) return ok('Driving license number must be at least 3 characters');
    if (number.length > 50) return ok('Driving license number must be no more than 50 characters');
    if (!LICENSE_NUMBER_REGEX.test(number)) {
        return ok('Driving license number may contain only letters and numbers');
    }
    const skip = normalizeDrivingLicenseNumber(skipNumber);
    for (const other of existingNumbers) {
        const n = normalizeDrivingLicenseNumber(other);
        if (n && n === number && n !== skip) {
            return ok('Driving license number must be unique');
        }
    }
    return ok();
}

export function validateDrivingLicenseIssueDate(value) {
    if (!value) return ok('Issue date is required');
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const check = validateDate(value, true, null, today);
    if (!check.isValid) return ok(check.error || 'Issue date cannot be in the future');
    return ok();
}

export function validateDrivingLicenseExpiryDate(expiryDate, issueDate) {
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

export function validateDrivingLicenseFile({ file, requireFile = true } = {}) {
    if (!file) return requireFile ? ok('Driving license document is required') : ok();
    if (file.size === 0) return ok('Empty files are not allowed');
    if (file.size > MAX_FILE_BYTES) return ok('File size must be less than 5MB');
    const ext = `.${String(file.name || '').split('.').pop().toLowerCase()}`;
    const mime = String(file.type || '').toLowerCase();
    if (mime !== 'application/pdf' && ext !== '.pdf') {
        return ok('Only PDF file format is allowed');
    }
    return ok();
}

export function validateDrivingLicenseForm(form = {}, { requireFile = true, hasExistingFile = false, existingNumbers = [], skipNumber = '' } = {}) {
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set('number', validateDrivingLicenseNumber(form.number, { existingNumbers, skipNumber }));
    set('issueDate', validateDrivingLicenseIssueDate(form.issueDate));
    set('expiryDate', validateDrivingLicenseExpiryDate(form.expiryDate, form.issueDate));

    const needsFile = requireFile && !hasExistingFile && !form.file;
    if (needsFile) errors.file = 'Driving license document is required';
    else if (form.file) set('file', validateDrivingLicenseFile({ file: form.file, requireFile: true }));

    return errors;
}
