/**
 * Comprehensive Validation Utility
 * Provides validation functions for all common field types
 */

import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

// Regex patterns
export const VALIDATION_PATTERNS = {
    // Name: letters and spaces only, 2-50 characters
    NAME: /^[A-Za-z\s]{2,50}$/,

    // Email: standard email format
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

    // Number: positive numbers only (integers and decimals)
    NUMBER: /^[0-9]+(\.[0-9]+)?$/,

    // Integer: whole numbers only
    INTEGER: /^[0-9]+$/,

    // Phone: basic phone format (will be validated with country codes separately)
    PHONE_BASIC: /^\+?[1-9]\d{1,14}$/,

    // Alphanumeric: letters and numbers
    ALPHANUMERIC: /^[A-Za-z0-9]+$/,

    // Text with spaces: letters, numbers, spaces, and common punctuation
    TEXT: /^[A-Za-z0-9\s.,!?;:'"()-]+$/,

    // Password: at least 8 characters, 1 uppercase, 1 lowercase, 1 number
    PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,

    // Date: YYYY-MM-DD format
    DATE: /^\d{4}-\d{2}-\d{2}$/,

    // Postal code: alphanumeric, 4-10 characters
    POSTAL_CODE: /^[A-Za-z0-9]{4,10}$/,

    // Employee ID: alphanumeric with optional hyphens
    EMPLOYEE_ID: /^[A-Za-z0-9-]+$/,

    // IBAN: 2 letters (country code) + 2 digits (check digits) + 4-30 alphanumeric characters
    // Note: Spaces are allowed and will be removed before validation
    IBAN: /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/i,

    // SWIFT Code: 8 or 11 characters (4 letters + 2 letters + 2 alphanumeric + optional 3 characters)
    SWIFT: /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/,
};

// Phone number validation by country code (built from all international calling codes)
// Format: { [callingCode]: { countries: string[] } }
const buildCountryCallingCodeMap = () => {
    const map = {};
    getCountries().forEach((iso) => {
        const callingCode = getCountryCallingCode(iso); // numeric string like "971"
        if (!map[callingCode]) {
            map[callingCode] = { countries: [] };
        }
        map[callingCode].countries.push(iso);
    });
    return map;
};

export const PHONE_VALIDATION_BY_COUNTRY = buildCountryCallingCodeMap();
export const PHONE_CALLING_CODES = Object.keys(PHONE_VALIDATION_BY_COUNTRY);

/**
 * Validates if a value is not empty
 * @param {any} value - The value to check
 * @param {string} fieldName - Name of the field for error message
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateRequired = (value, fieldName = 'This field') => {
    if (value === null || value === undefined || value === '') {
        return { isValid: false, error: `${fieldName} is required` };
    }
    if (typeof value === 'string' && value.trim() === '') {
        return { isValid: false, error: `${fieldName} is required` };
    }
    return { isValid: true, error: '' };
};

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @param {boolean} required - Whether field is required
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateEmail = (email, required = true) => {
    if (required) {
        const requiredCheck = validateRequired(email, 'Email');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (!email || email.trim() === '') {
        return { isValid: true, error: '' }; // Optional field, empty is valid
    }

    if (!VALIDATION_PATTERNS.EMAIL.test(email.trim())) {
        return { isValid: false, error: 'Please enter a valid email address' };
    }

    return { isValid: true, error: '' };
};

/**
 * Validates email or username format
 * @param {string} emailOrUsername - Email or username to validate
 * @param {boolean} required - Whether field is required
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateEmailOrUsername = (emailOrUsername, required = true) => {
    if (required) {
        const requiredCheck = validateRequired(emailOrUsername, 'Email/Username');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (!emailOrUsername || emailOrUsername.trim() === '') {
        return { isValid: true, error: '' }; // Optional field, empty is valid
    }

    const trimmed = emailOrUsername.trim();

    // Check if it's a valid email format
    const isEmail = VALIDATION_PATTERNS.EMAIL.test(trimmed);

    // Check if it's a valid username (alphanumeric, 3-30 characters)
    const isUsername = /^[A-Za-z0-9_]{3,30}$/.test(trimmed);

    if (!isEmail && !isUsername) {
        return { isValid: false, error: 'Please enter a valid email or username' };
    }

    return { isValid: true, error: '' };
};

/**
 * Validates phone number with a simple numeric check.
 * Rules: required (unless optional), digits only with optional leading +.
 */
export const validatePhoneNumber = (phoneNumber, _countryCode = null, required = true) => {
    if (required) {
        const requiredCheck = validateRequired(phoneNumber, 'Phone number');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (!phoneNumber || phoneNumber.trim() === '') {
        return { isValid: true, error: '' }; // Optional field
    }

    const cleaned = phoneNumber.trim();

    if (!/^\+?\d+$/.test(cleaned)) {
        return { isValid: false, error: 'Phone number must contain digits only' };
    }

    return { isValid: true, error: '' };
};

/**
 * Helper function to get country name from ISO code
 * @param {string} isoCode - ISO country code (e.g., 'AE', 'IN')
 * @returns {string} Country name
 */
const getCountryName = (isoCode) => {
    const countryNames = {
        'AE': 'UAE',
        'IN': 'India',
        'US': 'USA',
        'GB': 'UK',
        'AU': 'Australia',
        'PH': 'Philippines',
        'PK': 'Pakistan',
        'BD': 'Bangladesh',
        'LK': 'Sri Lanka',
        'NP': 'Nepal',
        'SA': 'Saudi Arabia',
        'QA': 'Qatar',
        'KW': 'Kuwait',
        'BH': 'Bahrain',
        'OM': 'Oman',
    };
    return countryNames[isoCode] || 'phone';
};

/**
 * Validates if value is a valid number
 * @param {any} value - Value to validate
 * @param {boolean} required - Whether field is required
 * @param {number} min - Minimum value (optional)
 * @param {number} max - Maximum value (optional)
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateNumber = (value, required = true, min = null, max = null) => {
    if (required) {
        const requiredCheck = validateRequired(value, 'Number');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (value === null || value === undefined || value === '') {
        return { isValid: true, error: '' }; // Optional field
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) {
        return { isValid: false, error: 'Please enter a valid number' };
    }

    if (min !== null && numValue < min) {
        return { isValid: false, error: `Number must be at least ${min}` };
    }

    if (max !== null && numValue > max) {
        return { isValid: false, error: `Number must be no more than ${max}` };
    }

    return { isValid: true, error: '' };
};

/**
 * Validates if value is a valid integer
 * @param {any} value - Value to validate
 * @param {boolean} required - Whether field is required
 * @param {number} min - Minimum value (optional)
 * @param {number} max - Maximum value (optional)
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateInteger = (value, required = true, min = null, max = null) => {
    if (required) {
        const requiredCheck = validateRequired(value, 'Number');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (value === null || value === undefined || value === '') {
        return { isValid: true, error: '' };
    }

    const intValue = typeof value === 'string' ? parseInt(value, 10) : value;

    if (isNaN(intValue) || !Number.isInteger(intValue)) {
        return { isValid: false, error: 'Please enter a valid whole number' };
    }

    if (min !== null && intValue < min) {
        return { isValid: false, error: `Number must be at least ${min}` };
    }

    if (max !== null && intValue > max) {
        return { isValid: false, error: `Number must be no more than ${max}` };
    }

    return { isValid: true, error: '' };
};

/**
 * Validates name field (letters and spaces only)
 * @param {string} name - Name to validate
 * @param {boolean} required - Whether field is required
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateName = (name, required = true) => {
    if (required) {
        const requiredCheck = validateRequired(name, 'Name');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (!name || name.trim() === '') {
        return { isValid: true, error: '' };
    }

    if (!VALIDATION_PATTERNS.NAME.test(name.trim())) {
        return { isValid: false, error: 'Name must contain only letters and spaces, 2-50 characters' };
    }

    return { isValid: true, error: '' };
};

/**
 * Validates date field
 * @param {string} date - Date string (YYYY-MM-DD format)
 * @param {boolean} required - Whether field is required
 * @param {Date} minDate - Minimum allowed date (optional)
 * @param {Date} maxDate - Maximum allowed date (optional)
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateDate = (date, required = true, minDate = null, maxDate = null) => {
    if (required) {
        const requiredCheck = validateRequired(date, 'Date');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (!date || date.trim() === '') {
        return { isValid: true, error: '' };
    }

    if (!VALIDATION_PATTERNS.DATE.test(date)) {
        return { isValid: false, error: 'Please enter a valid date (YYYY-MM-DD)' };
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
        return { isValid: false, error: 'Please enter a valid date' };
    }

    if (minDate && dateObj < minDate) {
        return { isValid: false, error: `Date must be on or after ${minDate.toLocaleDateString()}` };
    }

    if (maxDate && dateObj > maxDate) {
        return { isValid: false, error: `Date must be on or before ${maxDate.toLocaleDateString()}` };
    }

    return { isValid: true, error: '' };
};

/**
 * Validates password field
 * @param {string} password - Password to validate
 * @param {boolean} required - Whether field is required
 * @returns {object} { isValid: boolean, error: string }
 */
export const validatePassword = (password, required = true) => {
    if (required) {
        const requiredCheck = validateRequired(password, 'Password');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (!password || password.trim() === '') {
        return { isValid: true, error: '' };
    }

    if (password.length < 8) {
        return { isValid: false, error: 'Password must be at least 8 characters long' };
    }

    if (!VALIDATION_PATTERNS.PASSWORD.test(password)) {
        return {
            isValid: false,
            error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        };
    }

    return { isValid: true, error: '' };
};

/**
 * Validates text length
 * @param {string} text - Text to validate
 * @param {number} minLength - Minimum length
 * @param {number} maxLength - Maximum length
 * @param {boolean} required - Whether field is required
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateTextLength = (text, minLength = null, maxLength = null, required = true) => {
    if (required) {
        const requiredCheck = validateRequired(text, 'Text');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (!text || text.trim() === '') {
        return { isValid: true, error: '' };
    }

    const trimmed = text.trim();

    if (minLength !== null && trimmed.length < minLength) {
        return { isValid: false, error: `Text must be at least ${minLength} characters` };
    }

    if (maxLength !== null && trimmed.length > maxLength) {
        return { isValid: false, error: `Text must be no more than ${maxLength} characters` };
    }

    return { isValid: true, error: '' };
};

/**
 * Validates multiple fields at once
 * @param {object} fields - Object with field names as keys and validation config as values
 * @example
 * validateFields({
 *   email: { value: 'test@example.com', validator: validateEmail },
 *   name: { value: 'John Doe', validator: validateName },
 *   phone: { value: '+971501234567', validator: (v) => validatePhoneNumber(v, '971') }
 * })
 * @returns {object} { isValid: boolean, errors: object }
 */
export const validateFields = (fields) => {
    const errors = {};
    let isValid = true;

    for (const [fieldName, config] of Object.entries(fields)) {
        const { value, validator, ...validatorArgs } = config;
        const result = validator(value, ...Object.values(validatorArgs));

        if (!result.isValid) {
            errors[fieldName] = result.error;
            isValid = false;
        }
    }

    return { isValid, errors };
};

/**
 * Extracts country code from phone number
 * @param {string} phoneNumber - Phone number with or without country code
 * @returns {string|null} - Country code or null if not found
 */
export const extractCountryCode = (phoneNumber) => {
    if (!phoneNumber) return null;

    const cleaned = phoneNumber.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('+')) {
        // Try to match known country codes (longest first to avoid partial matches)
        const sortedCodes = [...PHONE_CALLING_CODES].sort((a, b) => b.length - a.length);

        for (const code of sortedCodes) {
            if (cleaned.startsWith(`+${code}`)) {
                return code;
            }
        }
    }

    return null;
};

/**
 * Formats phone number for display
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} - Formatted phone number
 */
export const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';

    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');

    // If it starts with country code, format it
    if (digits.length > 10) {
        const countryCode = extractCountryCode(phoneNumber);
        if (countryCode) {
            const numberPart = digits.substring(countryCode.length);
            return `+${countryCode} ${numberPart}`;
        }
    }

    return phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
};

/**
 * Validates IBAN (International Bank Account Number) format
 * Format: 2 letters (country code) + 2 digits (check digits) + up to 30 alphanumeric characters
 * @param {string} iban - IBAN to validate
 * @param {boolean} required - Whether field is required
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateIBAN = (iban, required = true) => {
    if (required) {
        const requiredCheck = validateRequired(iban, 'IBAN Number');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (!iban || iban.trim() === '') {
        return { isValid: true, error: '' }; // Optional field
    }

    // Remove spaces and convert to uppercase
    const cleaned = iban.replace(/\s/g, '').toUpperCase();

    // Basic format check: 2 letters + 2 digits + 4-30 alphanumeric
    if (cleaned.length < 15 || cleaned.length > 34) {
        return { isValid: false, error: 'IBAN must be between 15 and 34 characters' };
    }

    if (!VALIDATION_PATTERNS.IBAN.test(cleaned)) {
        return { isValid: false, error: 'Please enter a valid IBAN format (e.g., AE123456789012345678901)' };
    }

    return { isValid: true, error: '' };
};

/**
 * Validates SWIFT/BIC code format
 * Format: 8 or 11 characters (4 letters + 2 letters + 2 alphanumeric + optional 3 characters)
 * @param {string} swiftCode - SWIFT code to validate
 * @param {boolean} required - Whether field is required
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateSWIFT = (swiftCode, required = false) => {
    if (required) {
        const requiredCheck = validateRequired(swiftCode, 'SWIFT Code');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (!swiftCode || swiftCode.trim() === '') {
        return { isValid: true, error: '' }; // Optional field
    }

    // Convert to uppercase and remove spaces
    const cleaned = swiftCode.replace(/\s/g, '').toUpperCase();

    // SWIFT code must be 8 or 11 characters
    if (cleaned.length !== 8 && cleaned.length !== 11) {
        return { isValid: false, error: 'SWIFT code must be 8 or 11 characters' };
    }

    if (!VALIDATION_PATTERNS.SWIFT.test(cleaned)) {
        return { isValid: false, error: 'Please enter a valid SWIFT code format (e.g., ABCDUS33 or ABCDUS33XXX)' };
    }

    return { isValid: true, error: '' };
};

/**
 * Validates account number (alphanumeric, typically 6-20 characters)
 * @param {string} accountNumber - Account number to validate
 * @param {boolean} required - Whether field is required
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateAccountNumber = (accountNumber, required = true) => {
    if (required) {
        const requiredCheck = validateRequired(accountNumber, 'Account Number');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (!accountNumber || accountNumber.trim() === '') {
        return { isValid: true, error: '' };
    }

    const cleaned = accountNumber.trim();

    // Account number must be numeric only
    if (!/^\d+$/.test(cleaned)) {
        return { isValid: false, error: 'Account number must contain only numbers' };
    }

    if (cleaned.length < 1) {
        return { isValid: false, error: 'Account number is required' };
    }

    if (cleaned.length > 30) {
        return { isValid: false, error: 'Account number must be no more than 30 digits' };
    }

    return { isValid: true, error: '' };
};

/**
 * Validates bank name (text with spaces, 2-100 characters)
 * @param {string} bankName - Bank name to validate
 * @param {boolean} required - Whether field is required
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateBankName = (bankName, required = true) => {
    if (required) {
        const requiredCheck = validateRequired(bankName, 'Bank Name');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (!bankName || bankName.trim() === '') {
        return { isValid: true, error: '' };
    }

    const cleaned = bankName.trim();

    if (cleaned.length < 2) {
        return { isValid: false, error: 'Bank name must be at least 2 characters' };
    }

    if (cleaned.length > 100) {
        return { isValid: false, error: 'Bank name must be no more than 100 characters' };
    }

    // Only letters and spaces allowed, no numbers or special characters
    if (!/^[A-Za-z\s]+$/.test(cleaned)) {
        return { isValid: false, error: 'Bank name must contain only letters and spaces' };
    }

    return { isValid: true, error: '' };
};

/**
 * Validates account name (text with spaces, 2-100 characters)
 * @param {string} accountName - Account name to validate
 * @param {boolean} required - Whether field is required
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateAccountName = (accountName, required = true) => {
    if (required) {
        const requiredCheck = validateRequired(accountName, 'Account Name');
        if (!requiredCheck.isValid) return requiredCheck;
    } else if (!accountName || accountName.trim() === '') {
        return { isValid: true, error: '' };
    }

    const cleaned = accountName.trim();

    if (cleaned.length < 2) {
        return { isValid: false, error: 'Account name must be at least 2 characters' };
    }

    if (cleaned.length > 100) {
        return { isValid: false, error: 'Account name must be no more than 100 characters' };
    }

    // Only letters and spaces allowed, no numbers or special characters
    if (!/^[A-Za-z\s]+$/.test(cleaned)) {
        return { isValid: false, error: 'Account name must contain only letters and spaces' };
    }

    return { isValid: true, error: '' };
};

