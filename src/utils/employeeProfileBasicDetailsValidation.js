import { Country } from 'country-state-city';
import {
    stripDangerousText,
    validateEmployeeEmail,
    validateDateOfBirth,
    validateInternationalPhone,
} from '@/utils/employeeAddValidation';

export const EMPLOYEE_MARITAL_STATUS_VALUES = [
    'single',
    'married',
    'divorced',
    'widowed',
];

const COUNTRY_ISO_CODES = new Set(Country.getAllCountries().map((c) => c.isoCode));
const PROFILE_NAME_PART = /^[A-Za-z\s'-]+$/;
const PROFILE_FATHER_NAME = /^[A-Za-z\s]+$/;

function ok(error = '') {
    return { isValid: !error, error };
}

export function normalizeProfileNamePart(value) {
    return stripDangerousText(value).replace(/\s+/g, ' ').trim();
}

export function sanitizeProfileNameInput(value) {
    return stripDangerousText(value).replace(/[^A-Za-z\s'-]/g, '').slice(0, 100);
}

export function sanitizeProfileFatherNameInput(value) {
    return stripDangerousText(value).replace(/[^A-Za-z\s'-]/g, '').slice(0, 100);
}

export function validateProfileNamePart(value, label = 'Name') {
    const cleaned = normalizeProfileNamePart(value);
    if (!cleaned) return ok(`${label} is required`);
    if (cleaned.length < 2 || cleaned.length > 100) {
        return ok(`${label} must be 2–100 characters`);
    }
    if (!PROFILE_NAME_PART.test(cleaned)) {
        return ok(`${label} must contain only letters, spaces, apostrophe and hyphen`);
    }
    return ok();
}

export function validateProfileFullName(firstName, lastName) {
    const first = validateProfileNamePart(firstName, 'First name');
    if (!first.isValid) return first;
    const last = validateProfileNamePart(lastName, 'Last name');
    if (!last.isValid) return last;
    const combined = `${normalizeProfileNamePart(firstName)} ${normalizeProfileNamePart(lastName)}`.trim();
    if (combined.length > 100) {
        return ok('Full name must be no more than 100 characters');
    }
    return ok();
}

export function validateProfileMaritalStatus(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return ok('Marital Status is required');
    if (!EMPLOYEE_MARITAL_STATUS_VALUES.includes(normalized)) {
        return ok('Please select a valid marital status option');
    }
    return ok();
}

export function validateProfileNumberOfDependents(maritalStatus, value) {
    if (String(maritalStatus || '').toLowerCase() !== 'married') return ok();
    const raw = value === undefined || value === null ? '' : String(value).trim();
    if (raw === '') return ok('Number of Dependents is required when marital status is Married');
    if (!/^\d+$/.test(raw)) return ok('Number of Dependents must be a whole number');
    const n = parseInt(raw, 10);
    if (n < 0) return ok('Number of Dependents must be 0 or greater');
    if (n > 50) return ok('Number of Dependents cannot exceed 50');
    return ok();
}

export function validateProfileFathersName(value) {
    const cleaned = normalizeProfileNamePart(value);
    if (!cleaned) return ok("Father's Name is required");
    if (cleaned.length < 2 || cleaned.length > 100) {
        return ok("Father's Name must be 2–100 characters");
    }
    if (!PROFILE_FATHER_NAME.test(cleaned)) {
        return ok("Father's Name must contain only letters and spaces");
    }
    return ok();
}

export function validateProfileNationality(isoCode) {
    const code = String(isoCode || '').trim().toUpperCase();
    if (!code) return ok('Nationality is required');
    if (!COUNTRY_ISO_CODES.has(code)) {
        return ok('Please select a valid nationality from the list');
    }
    return ok();
}

/** Validates employee profile Basic Details card (modal save). */
export function validateEmployeeProfileBasicDetailsForm(form = {}, { defaultCountry = 'AE' } = {}) {
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set('firstName', validateProfileNamePart(form.firstName, 'First name'));
    set('lastName', validateProfileNamePart(form.lastName, 'Last name'));
    const fullNameCheck = validateProfileFullName(form.firstName, form.lastName);
    if (!fullNameCheck.isValid && !errors.firstName && !errors.lastName) {
        errors.lastName = fullNameCheck.error;
    }

    set('email', validateEmployeeEmail(form.email));
    set('contactNumber', validateInternationalPhone(form.contactNumber, defaultCountry));
    set('dateOfBirth', validateDateOfBirth(form.dateOfBirth));
    set('maritalStatus', validateProfileMaritalStatus(form.maritalStatus));
    set('numberOfDependents', validateProfileNumberOfDependents(form.maritalStatus, form.numberOfDependents));
    set('fathersName', validateProfileFathersName(form.fathersName));
    set('nationality', validateProfileNationality(form.nationality));

    return errors;
}

/** True when all mandatory Basic Details fields are filled for profile activation. */
export function isEmployeeProfileBasicDetailsComplete(employee) {
    if (!employee?.employeeId) return false;
    const errors = validateEmployeeProfileBasicDetailsForm({
        firstName: employee?.firstName,
        lastName: employee?.lastName,
        email: employee?.email || employee?.workEmail,
        contactNumber: employee?.contactNumber,
        dateOfBirth: employee?.dateOfBirth,
        maritalStatus: employee?.maritalStatus,
        numberOfDependents: employee?.numberOfDependents,
        fathersName: employee?.fathersName,
        nationality: employee?.nationality || employee?.country,
    });
    return Object.keys(errors).length === 0;
}
