import { Country, State } from 'country-state-city';
import { add, differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns';

export const formatPhoneForInput = (value) => value ? value.replace(/^\+/, '') : '';

export const formatPhoneForSave = (value) => {
    if (!value) return '';
    return value.startsWith('+') ? value : `+${value}`;
};

export const normalizeText = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export const normalizeContactNumber = (value) => {
    if (!value) return '';
    const trimmed = value.toString().trim();
    if (!trimmed) return '';
    const cleaned = trimmed.replace(/[^\d+]/g, '');
    if (!cleaned) return '';
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

export const getCountryName = (code) => {
    if (!code) return '';
    // If it's already a full name (contains spaces or is longer than 3 chars and not a known code), return as is
    if (code.length > 3 || code.includes(' ')) {
        // Check if it's actually a code by trying to find it
        const country = Country.getCountryByCode(code);
        if (!country) {
            // Not a code, likely already a full name
            return code;
        }
    }
    // Try to get country by code
    const country = Country.getCountryByCode(code);
    return country ? country.name : code;
};

export const getStateName = (countryCode, stateCode) => {
    if (!stateCode) return '';

    // If stateCode is already a full name (contains spaces or is longer than 3 chars), return as is
    if (stateCode.length > 3 || stateCode.includes(' ')) {
        // Check if it's actually a code by trying to find it
        if (countryCode) {
            // First, try to get country code if countryCode is a full name
            let actualCountryCode = countryCode;
            if (countryCode.length > 3 || countryCode.includes(' ')) {
                const { Country } = require('country-state-city');
                const country = Country.getAllCountries().find(c =>
                    c.name.toLowerCase() === countryCode.toLowerCase()
                );
                if (country) {
                    actualCountryCode = country.isoCode;
                } else {
                    // Country is already a full name and not found, state is likely also a full name
                    return stateCode;
                }
            }

            const state = State.getStateByCodeAndCountry(stateCode, actualCountryCode);
            if (!state) {
                // Not a code, likely already a full name
                return stateCode;
            }
        } else {
            // No country code, assume it's already a full name
            return stateCode;
        }
    }

    if (!countryCode) return stateCode;

    // Get actual country code if countryCode is a full name
    let actualCountryCode = countryCode;
    if (countryCode.length > 3 || countryCode.includes(' ')) {
        const { Country } = require('country-state-city');
        const country = Country.getAllCountries().find(c =>
            c.name.toLowerCase() === countryCode.toLowerCase()
        );
        if (country) {
            actualCountryCode = country.isoCode;
        } else {
            // Country name not found, return stateCode as is (might be a full name)
            return stateCode;
        }
    }

    // UAE Emirates mapping (common abbreviations to full names)
    const uaeEmirates = {
        'DU': 'Dubai',
        'DXB': 'Dubai',
        'SHJ': 'Sharjah',
        'AJM': 'Ajman',
        'AUH': 'Abu Dhabi',
        'FUJ': 'Fujairah',
        'RAK': 'Ras Al Khaimah',
        'UMM': 'Umm Al Quwain',
        'AB': 'Abu Dhabi',
        'AD': 'Abu Dhabi'
    };

    // Check if it's a UAE emirate code
    const countryCodeUpper = actualCountryCode.toUpperCase();
    const stateCodeUpper = stateCode.toUpperCase();

    if ((countryCodeUpper === 'AE' || countryCodeUpper === 'UAE' || countryCodeUpper === 'UNITED ARAB EMIRATES') && uaeEmirates[stateCodeUpper]) {
        return uaeEmirates[stateCodeUpper];
    }

    // Try to get state name from country-state-city library
    const state = State.getStateByCodeAndCountry(stateCode, actualCountryCode);
    if (state) return state.name;

    // Return the code if no match found (fallback - but this shouldn't happen if we're saving full names)
    return stateCode;
};

export const getFullLocation = (city, state, country) => {
    const parts = [];
    if (city) parts.push(city);
    if (state && country) parts.push(getStateName(country, state));
    else if (state) parts.push(state);
    if (country) parts.push(getCountryName(country));
    return parts.join(', ');
};

export const sanitizeContact = (contact) => ({
    name: contact?.name?.trim() || '',
    relation: contact?.relation || 'Self',
    number: normalizeContactNumber(contact?.number || '')
});

export const contactsAreSame = (a, b) => {
    if (!a || !b) return false;
    const nameA = (a.name || '').trim().toLowerCase();
    const nameB = (b.name || '').trim().toLowerCase();
    return (a.number || '').trim() === (b.number || '').trim() && nameA === nameB;
};

export const getInitials = (firstName, lastName) => {
    const first = (firstName || '').charAt(0).toUpperCase();
    const last = (lastName || '').charAt(0).toUpperCase();
    return (first + last).toUpperCase();
};

/**
 * Format date consistently for both server and client (hydration-safe)
 * Uses manual formatting instead of toLocaleDateString to avoid hydration mismatches
 */
export const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    try {
        const date = new Date(dateString);

        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'N/A';
        }

        // Manual formatting to ensure consistency between server and client
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        return `${day}/${month}/${year}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'N/A';
    }
};

/**
 * Parse a date as a local calendar day (avoids UTC date-only shifts and DD/MM ambiguity).
 */
export const parseCalendarDate = (value) => {
    if (value == null || value === '') return null;
    try {
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return new Date(value.getFullYear(), value.getMonth(), value.getDate());
        }

        const raw = String(value).trim();
        if (!raw) return null;

        const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            const parsed = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        const dmyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dmyMatch) {
            const parsed = new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        const fallback = new Date(raw);
        if (Number.isNaN(fallback.getTime())) return null;
        return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
    } catch {
        return null;
    }
};

export const startOfToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

export const calculateDaysUntilExpiry = (expiryDate) => {
    const expiry = parseCalendarDate(expiryDate);
    const today = startOfToday();
    if (!expiry) return null;
    const diffTime = expiry - today;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

const VISA_TYPE_KEYS = ['employment', 'spouse', 'visit'];

/** Same priority as Visa card: valid employment → spouse → visit, else first with a number. */
export const resolveActiveVisaType = (visaDetails = {}, pendingVisa = null) => {
    const today = startOfToday();
    const isValid = (visa) => {
        const exp = parseCalendarDate(visa?.expiryDate);
        return exp && exp >= today;
    };

    if (isValid(visaDetails.employment)) return 'employment';
    if (isValid(visaDetails.spouse)) return 'spouse';
    if (isValid(visaDetails.visit)) return 'visit';

    if (String(visaDetails.employment?.number || '').trim()) return 'employment';
    if (String(visaDetails.spouse?.number || '').trim()) return 'spouse';
    if (String(visaDetails.visit?.number || '').trim()) return 'visit';
    if (String(visaDetails?.number || '').trim()) return 'employment';

    const pendingType = String(pendingVisa?.visaType || pendingVisa?.type || '').toLowerCase();
    if (VISA_TYPE_KEYS.includes(pendingType)) return pendingType;

    return null;
};

export const resolveActiveVisaRecord = (visaDetails = {}, pendingVisa = null) => {
    const activeType = resolveActiveVisaType(visaDetails, pendingVisa);
    if (!activeType) return { type: null, visa: null, expiryDate: null };

    const pendingType = String(pendingVisa?.visaType || pendingVisa?.type || '').toLowerCase();
    const usePending =
        pendingVisa?.number &&
        (!String(visaDetails?.[activeType]?.number || '').trim() || pendingType === activeType);

    const visa = usePending ? pendingVisa : (visaDetails?.[activeType] || pendingVisa || null);
    const expiryDate = visa?.expiryDate || null;

    return { type: activeType, visa, expiryDate };
};

/**
 * Years / months / days between two calendar dates.
 * Keeps the month component when expiry day-of-month is before start day-of-month.
 */
export const decomposeCalendarDurationBetween = (startDate, endDate) => {
    const start = parseCalendarDate(startDate);
    const end = parseCalendarDate(endDate);
    if (!start || !end) return null;

    const totalMonths = differenceInCalendarMonths(end, start);
    const years = Math.floor(totalMonths / 12);
    const withYears = add(start, { years });
    let months = differenceInCalendarMonths(end, withYears);
    let mid = add(withYears, { months });
    let days = differenceInCalendarDays(end, mid);

    while (days < 0 && months > 0) {
        months -= 1;
        mid = add(withYears, { months });
        days = differenceInCalendarDays(end, mid);
    }

    if (days < 0) {
        months = 0;
        days = Math.max(0, differenceInCalendarDays(end, start));
    }

    return { years, months, days };
};

export const decomposeCalendarDurationUntil = (targetDate, fromDate = new Date()) => {
    if (!targetDate) return null;
    try {
        const target = parseCalendarDate(targetDate);
        const from = parseCalendarDate(fromDate) || startOfToday();
        if (!target || !from) return null;

        const expired = target < from;
        const start = expired ? target : from;
        const end = expired ? from : target;
        const parts = decomposeCalendarDurationBetween(start, end);
        if (!parts) return null;

        return { ...parts, expired };
    } catch {
        return null;
    }
};

const pluralUnit = (count, singular, plural) => (count === 1 ? singular : plural);

/**
 * Human-readable duration; omits any unit that is 0.
 * Ex: "7 years, 1 month, and 5 days" / "10 months and 15 days" / "20 days"
 */
export const formatDurationParts = ({ years = 0, months = 0, days = 0 } = {}) => {
    const segments = [];
    if (years > 0) segments.push(`${years} ${pluralUnit(years, 'year', 'years')}`);
    if (months > 0) segments.push(`${months} ${pluralUnit(months, 'month', 'months')}`);
    if (days > 0) segments.push(`${days} ${pluralUnit(days, 'day', 'days')}`);

    if (segments.length === 0) return '0 days';
    if (segments.length === 1) return segments[0];
    if (segments.length === 2) return `${segments[0]} and ${segments[1]}`;
    return `${segments[0]}, ${segments[1]}, and ${segments[2]}`;
};

/** Tenure line in Employment Summary — omits zero units; units joined with spaces. */
export const formatTenureDuration = ({ years = 0, months = 0, days = 0 } = {}) => {
    const segments = [];
    if (years > 0) segments.push(`${years} ${pluralUnit(years, 'year', 'years')}`);
    if (months > 0) segments.push(`${months} ${pluralUnit(months, 'month', 'months')}`);
    if (days > 0) segments.push(`${days} ${pluralUnit(days, 'day', 'days')}`);
    return segments.length > 0 ? segments.join(' ') : '0 days';
};

export const formatExpiryCountdownText = (label, expiryDate) => {
    const parts = decomposeCalendarDurationUntil(expiryDate);
    if (!parts) return null;
    const duration = formatDurationParts(parts);
    if (parts.expired) {
        return `${label} Expired ${duration} ago`;
    }
    return `${label} Expires in ${duration}`;
};

/** Duration only (for compact expiry panels): "2 years and 10 days" / "14 days ago". */
export const formatExpiryDurationDisplay = (expiryDate) => {
    const parts = decomposeCalendarDurationUntil(expiryDate);
    if (!parts) return '';
    const duration = formatDurationParts(parts);
    if (parts.expired) return `${duration} ago`;
    return duration;
};

export const getExpiryColor = (days, redThreshold = 60, orangeThreshold = 180) => {
    if (days === null || days === undefined) return 'bg-gray-400';
    if (days < redThreshold) return 'bg-red-500'; // Using Tailwind red-500 for better visibility
    if (days < orangeThreshold) return 'bg-orange-500';
    return 'bg-green-500';
};

export const calculateTenure = (dateOfJoining) => {
    const parts = decomposeCalendarDurationUntil(dateOfJoining);
    if (!parts || !parts.expired) return null;
    return { years: parts.years, months: parts.months, days: parts.days };
};

// Cache for country data to avoid expensive recalculations
let _cachedCountriesOptions = null;
let _cachedCountryNames = null;

export const getAllCountriesOptions = () => {
    // Return cached result if available
    if (_cachedCountriesOptions) {
        return _cachedCountriesOptions;
    }

    const { Country } = require('country-state-city');
    _cachedCountriesOptions = Country.getAllCountries().map(country => ({
        value: country.name,
        label: country.name
    })).sort((a, b) => a.label.localeCompare(b.label));

    return _cachedCountriesOptions;
};

export const getAllCountryNames = () => {
    // Return cached result if available
    if (_cachedCountryNames) {
        return _cachedCountryNames;
    }

    const { Country } = require('country-state-city');
    _cachedCountryNames = Country.getAllCountries().map(country => country.name);

    return _cachedCountryNames;
};

