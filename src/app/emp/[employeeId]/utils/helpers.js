import { Country, State } from 'country-state-city';

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

export const calculateDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    try {
        const expiry = new Date(expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiry.setHours(0, 0, 0, 0);
        const diffTime = expiry - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    } catch (e) {
        return null;
    }
};

export const getExpiryColor = (days, redThreshold = 60, orangeThreshold = 180) => {
    if (days === null || days === undefined) return 'bg-gray-400';
    if (days < redThreshold) return 'bg-red-500'; // Using Tailwind red-500 for better visibility
    if (days < orangeThreshold) return 'bg-orange-500';
    return 'bg-green-500';
};

export const calculateTenure = (dateOfJoining) => {
    if (!dateOfJoining) return null;
    const joinDate = new Date(dateOfJoining);
    const today = new Date();
    const years = today.getFullYear() - joinDate.getFullYear();
    const months = today.getMonth() - joinDate.getMonth();
    const totalMonths = years * 12 + months;
    const finalYears = Math.floor(totalMonths / 12);
    const finalMonths = totalMonths % 12;
    return { years: finalYears, months: finalMonths };
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

