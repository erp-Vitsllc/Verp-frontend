import { validateDate } from '@/utils/validation';

const VISA_NUMBER_REGEX = /^[A-Za-z0-9]{5,20}$/;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ok = (error = '') => ({ isValid: !error, error });

export const EMPLOYEE_VISA_TYPES = [
    { key: 'visit', label: 'Visit Visa' },
    { key: 'employment', label: 'Employment Visa' },
    { key: 'spouse', label: 'Third Party' },
];

export function visaTypeLabel(key) {
    return EMPLOYEE_VISA_TYPES.find((t) => t.key === key)?.label || 'Visa';
}

export function normalizeVisaNumber(value) {
    return String(value || '').replace(/\s/g, '').trim();
}

export function normalizeVisaSponsor(value) {
    return String(value || '').trim();
}

export function validateEmployeeVisaNumber(value, { requireUnique = false, existingNumbers = [], skipNumber = '' } = {}) {
    const normalized = normalizeVisaNumber(value);
    if (!normalized) return ok('Visa number is required');
    if (normalized.length < 5) return ok('Visa number must be at least 5 characters');
    if (normalized.length > 20) return ok('Visa number must be no more than 20 characters');
    if (!VISA_NUMBER_REGEX.test(normalized)) {
        return ok('Visa number may contain only letters and numbers (A–Z, 0–9)');
    }
    if (requireUnique) {
        const skip = normalizeVisaNumber(skipNumber);
        for (const other of existingNumbers) {
            const n = normalizeVisaNumber(other);
            if (n && n === normalized && n !== skip) {
                return ok('Visa number must be unique');
            }
        }
    }
    return ok();
}

export function validateEmployeeVisaIssueDate(value) {
    if (!value) return ok('Issue date is required');
    const check = validateDate(value, true);
    if (!check.isValid) return ok(check.error || 'Issue date must be a valid date');
    return ok();
}

export function validateEmployeeVisaExpiryDate(expiryDate, issueDate) {
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

export function validateEmployeeVisaSponsor(value) {
    const sponsor = normalizeVisaSponsor(value);
    if (!sponsor) return ok('Visa sponsor is required');
    if (sponsor.length < 2) return ok('Visa sponsor must be at least 2 characters');
    if (sponsor.length > 100) return ok('Visa sponsor must be no more than 100 characters');
    return ok();
}

export function validateEmployeeVisaFile({ file, fileName, fileBase64, requireFile = true } = {}) {
    const hasFile = Boolean(file || fileBase64 || fileName);
    if (!hasFile) {
        return requireFile ? ok('Visa copy is required') : ok();
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

export function validateEmployeeVisaForm(form = {}, visaType = 'visit', options = {}) {
    const {
        requireUniqueEmploymentNumber = false,
        existingEmploymentNumbers = [],
        existingEmploymentNumber = '',
        requireFile = true,
    } = options;
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set(
        'number',
        validateEmployeeVisaNumber(form.number, {
            requireUnique: visaType === 'employment' && requireUniqueEmploymentNumber,
            existingNumbers: existingEmploymentNumbers,
            skipNumber: existingEmploymentNumber,
        }),
    );
    set('issueDate', validateEmployeeVisaIssueDate(form.issueDate));
    set('expiryDate', validateEmployeeVisaExpiryDate(form.expiryDate, form.issueDate));

    if (visaType === 'employment' || visaType === 'spouse') {
        set('sponsor', validateEmployeeVisaSponsor(form.sponsor));
    }

    set(
        'file',
        validateEmployeeVisaFile({
            file: form.file,
            fileName: form.fileName,
            fileBase64: form.fileBase64,
            requireFile,
        }),
    );

    return errors;
}
