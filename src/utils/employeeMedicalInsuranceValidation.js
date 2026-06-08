import { validateDate } from '@/utils/validation';

const PROVIDER_REGEX = /^[A-Za-z0-9\s]{2,100}$/;
const POLICY_NUMBER_REGEX = /^[A-Za-z0-9]{3,50}$/;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ok = (error = '') => ({ isValid: !error, error });

export function normalizeMedicalProvider(value) {
    return String(value || '').trim();
}

export function normalizeMedicalPolicyNumber(value) {
    return String(value || '').replace(/\s/g, '').trim();
}

export function validateMedicalProvider(value) {
    const provider = normalizeMedicalProvider(value);
    if (!provider) return ok('Provider is required');
    if (provider.length < 2) return ok('Provider must be at least 2 characters');
    if (provider.length > 100) return ok('Provider must be no more than 100 characters');
    if (!PROVIDER_REGEX.test(provider)) {
        return ok('Provider may contain only letters, numbers, and spaces');
    }
    return ok();
}

export function validateMedicalPolicyNumber(value) {
    const number = normalizeMedicalPolicyNumber(value);
    if (!number) return ok('Policy number is required');
    if (number.length < 3) return ok('Policy number must be at least 3 characters');
    if (number.length > 50) return ok('Policy number must be no more than 50 characters');
    if (!POLICY_NUMBER_REGEX.test(number)) {
        return ok('Policy number may contain only letters and numbers');
    }
    return ok();
}

export function validateMedicalIssueDate(value) {
    if (!value) return ok('Issue date is required');
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const check = validateDate(value, true, null, today);
    if (!check.isValid) return ok(check.error || 'Issue date cannot be in the future');
    return ok();
}

export function validateMedicalExpiryDate(expiryDate, issueDate) {
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

export function validateMedicalInsuranceFile({ file, requireFile = true } = {}) {
    if (!file) return requireFile ? ok('Medical insurance document is required') : ok();
    if (file.size === 0) return ok('Empty files are not allowed');
    if (file.size > MAX_FILE_BYTES) return ok('File size must be less than 5MB');
    const ext = `.${String(file.name || '').split('.').pop().toLowerCase()}`;
    const mime = String(file.type || '').toLowerCase();
    if (mime !== 'application/pdf' && ext !== '.pdf') {
        return ok('Only PDF file format is allowed');
    }
    return ok();
}

export function validateMedicalInsuranceForm(form = {}, { requireFile = true, hasExistingFile = false } = {}) {
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set('provider', validateMedicalProvider(form.provider));
    set('number', validateMedicalPolicyNumber(form.number));
    set('issueDate', validateMedicalIssueDate(form.issueDate));
    set('expiryDate', validateMedicalExpiryDate(form.expiryDate, form.issueDate));

    const needsFile = requireFile && !hasExistingFile && !form.file;
    if (needsFile) errors.file = 'Medical insurance document is required';
    else if (form.file) set('file', validateMedicalInsuranceFile({ file: form.file, requireFile: true }));

    return errors;
}
