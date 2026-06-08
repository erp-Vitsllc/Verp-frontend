import { stripDangerousText } from '@/utils/employeeAddValidation';

const LETTERS_SPACES = /^[A-Za-z\s]+$/;
export const EDUCATION_PDF_MAX_BYTES = 5 * 1024 * 1024;

const ok = (error = '') => ({ isValid: !error, error });

function validateOptionalInstitution(value, label) {
    const cleaned = stripDangerousText(value).replace(/\s+/g, ' ').trim();
    if (!cleaned) return ok();
    if (cleaned.length > 150) return ok(`${label} must be no more than 150 characters`);
    if (!LETTERS_SPACES.test(cleaned)) {
        return ok(`${label} must contain only letters and spaces`);
    }
    return ok();
}

function validateRequiredText(value, label, { min = 2, max = 100 } = {}) {
    const cleaned = stripDangerousText(value).replace(/\s+/g, ' ').trim();
    if (!cleaned) return ok(`${label} is required`);
    if (cleaned.length < min) return ok(`${label} must be at least ${min} characters`);
    if (cleaned.length > max) return ok(`${label} must be no more than ${max} characters`);
    if (!LETTERS_SPACES.test(cleaned)) {
        return ok(`${label} must contain only letters and spaces`);
    }
    return ok();
}

export function validateEducationCompletedYear(value) {
    const cleaned = String(value ?? '').trim();
    if (!cleaned) return ok('Completed Year is required');
    if (!/^\d{4}$/.test(cleaned)) return ok('Completed Year must be exactly 4 digits (YYYY)');
    const year = parseInt(cleaned, 10);
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
        return ok(`Completed Year must be between 1900 and ${currentYear}`);
    }
    return ok();
}

export function validateEducationCertificateFile(file, { requireFile = true, hasExisting = false } = {}) {
    const hasFile = Boolean(file);
    if (!hasFile) {
        return requireFile && !hasExisting ? ok('Certificate is required') : ok();
    }
    if (file.size === 0) return ok('Empty files are not allowed');
    if (file.size > EDUCATION_PDF_MAX_BYTES) return ok('File size must not exceed 5MB');
    const name = String(file.name || '').toLowerCase();
    const mime = String(file.type || '').toLowerCase();
    if (mime !== 'application/pdf' && !name.endsWith('.pdf')) {
        return ok('Only PDF files are allowed');
    }
    return ok();
}

export function validateEmployeeEducationForm(form = {}, options = {}) {
    const { requireCertificate = true, hasExistingCertificate = false } = options;
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set('universityOrBoard', validateOptionalInstitution(form.universityOrBoard, 'University / Board'));
    set('collegeOrInstitute', validateOptionalInstitution(form.collegeOrInstitute, 'College / Institute'));
    set('course', validateRequiredText(form.course, 'Course'));
    set('fieldOfStudy', validateRequiredText(form.fieldOfStudy, 'Field of Study'));
    set('completedYear', validateEducationCompletedYear(form.completedYear));

    const hasCert = Boolean(
        form.certificateData ||
        form.certificateName ||
        form.certificateFile,
    );
    if (requireCertificate && !hasCert && !hasExistingCertificate) {
        errors.certificate = 'Certificate is required';
    } else if (form.certificateFile) {
        set('certificate', validateEducationCertificateFile(form.certificateFile));
    }

    return errors;
}
