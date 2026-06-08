import { Country } from 'country-state-city';

const PASSPORT_NUMBER_REGEX = /^[A-Z0-9]{6,15}$/;

const VALID_COUNTRY_NAMES = new Set(
    Country.getAllCountries().map((c) => String(c.name || '').trim()).filter(Boolean),
);

export function stripDangerousText(value) {
    if (value === undefined || value === null) return '';
    let str = String(value).trim();
    str = str.replace(/<[^>]*>?/gm, '');
    if (/<|>|javascript:|on\w+=/i.test(str)) return '';
    return str;
}

export function normalizePassportNumber(value) {
    return stripDangerousText(value).replace(/\s/g, '').toUpperCase();
}

export function normalizePassportNationality(value) {
    return stripDangerousText(value);
}

export function normalizePassportCountryOfIssue(value) {
    return stripDangerousText(value);
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

export function validatePassportNumber(value, { existingNumbers = [], skipNumber = '' } = {}) {
    const normalized = normalizePassportNumber(value);
    if (!normalized) return 'Passport Number is required';
    if (normalized.length < 6) return 'Passport Number must be at least 6 characters';
    if (normalized.length > 15) return 'Passport Number must be no more than 15 characters';
    if (!PASSPORT_NUMBER_REGEX.test(normalized)) {
        return 'Passport Number may contain only letters and numbers (A–Z, 0–9), no spaces';
    }
    const skip = normalizePassportNumber(skipNumber);
    for (const other of existingNumbers) {
        const n = normalizePassportNumber(other);
        if (n && n === normalized && n !== skip) {
            return 'Passport Number must be unique';
        }
    }
    return '';
}

export function validatePassportNationality(value) {
    const nationality = normalizePassportNationality(value);
    if (!nationality) return 'Passport Nationality is required';
    if (!VALID_COUNTRY_NAMES.has(nationality)) {
        return 'Passport Nationality must be selected from the country list';
    }
    return '';
}

export function validatePassportCountryOfIssue(value) {
    const country = normalizePassportCountryOfIssue(value);
    if (!country) return 'Country of Issue is required';
    if (!VALID_COUNTRY_NAMES.has(country)) {
        return 'Country of Issue must be selected from the country list';
    }
    return '';
}

export function validatePassportIssueDate(value) {
    if (!value) return 'Issue Date is required';
    const d = parseDate(value);
    if (!d) return 'Issue Date must be a valid date';
    if (d.getFullYear() < 1900) return 'Issue Date minimum year is 1900';
    const today = startOfDay(new Date());
    if (d > today) return 'Issue Date cannot be in the future';
    return '';
}

export function validatePassportExpiryDate(value, issueDate) {
    if (!value) return 'Expiry Date is required';
    const expiry = parseDate(value);
    if (!expiry) return 'Expiry Date must be a valid date';
    if (expiry.getFullYear() < 1900) return 'Expiry Date minimum year is 1900';
    const issue = parseDate(issueDate);
    if (issue && expiry <= issue) return 'Expiry Date must be greater than Issue Date';
    return '';
}

export function validatePassportPdfFile(file) {
    if (!file) return 'Passport Copy is required';
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.pdf')) return 'Only PDF files are allowed';
    const mime = String(file.type || '').toLowerCase();
    if (mime && mime !== 'application/pdf') return 'Only PDF files are allowed (application/pdf)';
    if (file.size > 10 * 1024 * 1024) return 'File size must not exceed 10MB';
    if (file.size <= 0) return 'Passport Copy cannot be empty';
    return '';
}

export function collectPassportNumbersFromOwners(owners = [], { skipOwnerIndex = -1 } = {}) {
    const numbers = [];
    owners.forEach((owner, idx) => {
        if (idx === skipOwnerIndex) return;
        const n = owner?.passport?.number;
        if (n) numbers.push(n);
    });
    return numbers;
}

export function validateOwnerPassportFields(data, opts = {}) {
    const errors = {};
    const {
        owners = [],
        ownerIndex = -1,
        isRenewal = false,
        requireAttachment = true,
    } = opts;

    const existingNumbers = collectPassportNumbersFromOwners(owners, { skipOwnerIndex: ownerIndex });
    const skipNumber = owners[ownerIndex]?.passport?.number || '';

    const numberErr = validatePassportNumber(data?.number, {
        existingNumbers,
        skipNumber,
    });
    if (numberErr) errors.number = numberErr;

    const natErr = validatePassportNationality(data?.nationality);
    if (natErr) errors.nationality = natErr;

    const issueErr = validatePassportIssueDate(data?.issueDate);
    if (issueErr) errors.issueDate = issueErr;

    const expiryErr = validatePassportExpiryDate(data?.expiryDate, data?.issueDate);
    if (expiryErr) errors.expiryDate = expiryErr;

    const countryErr = validatePassportCountryOfIssue(data?.countryOfIssue);
    if (countryErr) errors.countryOfIssue = countryErr;

    if (requireAttachment && !data?.attachment) {
        errors.attachment = 'Passport Copy is required';
    }

    return errors;
}

export function normalizeOwnerPassportPayload(data) {
    return {
        number: normalizePassportNumber(data?.number),
        nationality: normalizePassportNationality(data?.nationality),
        countryOfIssue: normalizePassportCountryOfIssue(data?.countryOfIssue),
        issueDate: data?.issueDate || '',
        expiryDate: data?.expiryDate || '',
        attachment: data?.publicId || data?.attachment || null,
    };
}
