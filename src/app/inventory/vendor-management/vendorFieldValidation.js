import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailProblem(value) {
    const email = String(value || '').trim();
    if (!email) return '';
    if (email.length > 120 || !EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';
    return '';
}

export function normalizePhone(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (raw.startsWith('+') || digits.startsWith('971')) {
        const international = parsePhoneNumberFromString(`+${digits}`);
        return international?.number || `+${digits}`;
    }
    const local = parsePhoneNumberFromString(digits.startsWith('0') ? digits : `0${digits}`, 'AE')
        || parsePhoneNumberFromString(digits, 'AE');
    if (local?.number) return local.number;
    return `+971${digits.replace(/^0/, '')}`;
}

export function phoneProblem(value) {
    const phone = String(value || '').trim();
    if (!phone) return '';
    if (!isValidPhoneNumber(phone)) return 'Enter a valid phone number for the selected country.';
    return '';
}
