import { validateDate } from '@/utils/validation';
import { stripDangerousText } from '@/utils/employeeAddValidation';

const COMPANY_DESIGNATION = /^[A-Za-z0-9\s]+$/;
export const EXPERIENCE_FILE_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXPERIENCE_MIMES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

const ok = (error = '') => ({ isValid: !error, error });

function validateCompanyOrDesignation(value, label) {
    const cleaned = stripDangerousText(value).replace(/\s+/g, ' ').trim();
    if (!cleaned) return ok(`${label} is required`);
    if (cleaned.length < 2) return ok(`${label} must be at least 2 characters`);
    const max = label === 'Company' ? 150 : 100;
    if (cleaned.length > max) return ok(`${label} must be no more than ${max} characters`);
    if (!COMPANY_DESIGNATION.test(cleaned)) {
        return ok(`${label} must contain only letters, numbers, and spaces`);
    }
    return ok();
}

export function validateExperienceStartDate(value) {
    if (!value) return ok('Start Date is required');
    const check = validateDate(value, true);
    if (!check.isValid) return ok(check.error || 'Start Date must be a valid date');
    const d = new Date(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d > today) return ok('Start Date cannot be in the future');
    return ok();
}

export function validateExperienceEndDate(value, startDate) {
    if (!value) return ok('End Date is required');
    const check = validateDate(value, true);
    if (!check.isValid) return ok(check.error || 'End Date must be a valid date');
    const end = new Date(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (end > today) return ok('End Date cannot be in the future');
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        if (end <= start) return ok('End Date must be after Start Date');
    }
    return ok();
}

export function validateExperienceCertificateFile(file, { requireFile = true, hasExisting = false } = {}) {
    if (!file) {
        return requireFile && !hasExisting ? ok('Certificate is required') : ok();
    }
    if (file.size === 0) return ok('Empty files are not allowed');
    if (file.size > EXPERIENCE_FILE_MAX_BYTES) return ok('File size must not exceed 5MB');
    const name = String(file.name || '').toLowerCase();
    const mime = String(file.type || '').toLowerCase();
    const ext = name.split('.').pop();
    const allowedExt = ['pdf', 'jpg', 'jpeg', 'png'];
    if (!allowedExt.includes(ext) || (mime && !ALLOWED_EXPERIENCE_MIMES.includes(mime))) {
        return ok('Certificate must be PDF, JPEG, or PNG');
    }
    return ok();
}

export function validateEmployeeExperienceForm(form = {}, options = {}) {
    const { requireCertificate = true, hasExistingCertificate = false } = options;
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set('company', validateCompanyOrDesignation(form.company, 'Company'));
    set('designation', validateCompanyOrDesignation(form.designation, 'Designation'));
    set('startDate', validateExperienceStartDate(form.startDate));
    set('endDate', validateExperienceEndDate(form.endDate, form.startDate));

    const hasCert = Boolean(form.certificateData || form.certificateName || form.certificateFile);
    if (requireCertificate && !hasCert && !hasExistingCertificate) {
        errors.certificate = 'Certificate is required';
    } else if (form.certificateFile) {
        set('certificate', validateExperienceCertificateFile(form.certificateFile));
    }

    return errors;
}
