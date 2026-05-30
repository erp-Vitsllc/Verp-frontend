import { Country, State } from 'country-state-city';

const ADDRESS_REGEX = /^[A-Za-z0-9\s,./#-]{5,255}$/;
const CITY_REGEX = /^[A-Za-z\s]{2,100}$/;
const PO_BOX_REGEX = /^[A-Za-z0-9-]{1,20}$/;

export function resolveCountryIso(stored) {
    const raw = String(stored ?? '').trim();
    if (!raw) return '';
    const byCode = Country.getCountryByCode(raw);
    if (byCode) return byCode.isoCode;
    const lower = raw.toLowerCase();
    const byName = Country.getAllCountries().find(
        (c) => c.name.toLowerCase() === lower || c.isoCode.toLowerCase() === lower,
    );
    return byName?.isoCode || '';
}

export function resolveStateIso(stored, countryIso) {
    const raw = String(stored ?? '').trim();
    if (!raw || !countryIso) return '';
    const states = State.getStatesOfCountry(countryIso);
    const byCode = states.find((s) => s.isoCode === raw);
    if (byCode) return byCode.isoCode;
    const lower = raw.toLowerCase();
    const byName = states.find((s) => s.name.toLowerCase() === lower);
    return byName?.isoCode || '';
}

export function formatCompanyAddressSummary(company) {
    const parts = [
        company?.address,
        company?.city,
        company?.state,
        company?.country,
        company?.postalCode ? `PO Box: ${company.postalCode}` : '',
    ].filter((p) => p != null && String(p).trim() !== '');
    return parts.join(' • ') || '—';
}

export function hasCompleteCompanyAddress(company) {
    return Boolean(
        String(company?.address ?? '').trim() &&
            String(company?.country ?? '').trim() &&
            String(company?.state ?? '').trim(),
    );
}

/** @returns {Record<string, string>} field errors */
export function validateCompanyAddressFields({ address, country, state, city, postalCode }) {
    const errors = {};
    const trimmedAddress = typeof address === 'string' ? address.trim() : '';

    if (!trimmedAddress) {
        errors.address = 'Address is required';
    } else if (trimmedAddress.length < 5) {
        errors.address = 'Address must be at least 5 characters';
    } else if (trimmedAddress.length > 255) {
        errors.address = 'Address must be no more than 255 characters';
    } else if (!ADDRESS_REGEX.test(trimmedAddress)) {
        errors.address = 'Address contains invalid characters';
    }

    if (!country) {
        errors.country = 'Country is required';
    } else {
        const isValid = Country.getCountryByCode(country);
        if (!isValid) {
            errors.country = 'Please select a valid country from the list';
        }
    }

    if (!state) {
        errors.state = 'State / Emirates is required';
    } else if (country) {
        const states = State.getStatesOfCountry(country);
        const isValid = states.some((s) => s.isoCode === state);
        if (!isValid) {
            errors.state = 'Please select a valid State / Emirate from the list';
        }
    }

    const trimmedCity = typeof city === 'string' ? city.trim() : '';
    if (trimmedCity) {
        if (trimmedCity.length < 2) {
            errors.city = 'City must be at least 2 characters';
        } else if (trimmedCity.length > 100) {
            errors.city = 'City must be no more than 100 characters';
        } else if (!CITY_REGEX.test(trimmedCity)) {
            errors.city = 'City must contain only letters and spaces';
        }
    }

    const trimmedPo = typeof postalCode === 'string' ? postalCode.trim() : '';
    if (trimmedPo) {
        if (trimmedPo.length < 1) {
            errors.postalCode = 'PO Box must be at least 1 character';
        } else if (trimmedPo.length > 20) {
            errors.postalCode = 'PO Box must be no more than 20 characters';
        } else if (!PO_BOX_REGEX.test(trimmedPo)) {
            errors.postalCode = 'PO Box may contain only letters, numbers, and hyphens';
        }
    }

    return errors;
}
