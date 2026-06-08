import { State } from 'country-state-city';
import { stripDangerousText } from '@/utils/employeeAddValidation';
import { validateCountryIso } from '@/utils/employeeAddValidation';

const ok = (error = '') => ({ isValid: !error, error });

export function validateEmployeeAddressLine(value) {
    const cleaned = stripDangerousText(value);
    if (!cleaned) return ok('Address is required');
    if (cleaned.length < 5) return ok('Address must be at least 5 characters');
    if (cleaned.length > 200) return ok('Address must be no more than 200 characters');
    return ok();
}

export function validateEmployeeApartment(value) {
    const cleaned = stripDangerousText(value);
    if (!cleaned) return ok();
    if (cleaned.length > 50) return ok('Apartment/Flat must be no more than 50 characters');
    return ok();
}

export function validateEmployeeAddressCity(value) {
    const cleaned = stripDangerousText(value);
    if (!cleaned) return ok('City is required');
    if (cleaned.length < 2) return ok('City must be at least 2 characters');
    if (!/^[A-Za-z0-9\s]+$/.test(cleaned)) {
        return ok('City must contain letters, numbers, and spaces only');
    }
    return ok();
}

export function validateEmployeeAddressState(value, countryIso) {
    const cleaned = stripDangerousText(value);
    if (!cleaned) return ok('Emirates/State is required');
    if (!/^[A-Za-z\s'-]+$/.test(cleaned)) {
        return ok('Emirates/State may contain only letters, spaces, hyphen and apostrophe');
    }
    if (countryIso) {
        const states = State.getStatesOfCountry(countryIso);
        const match = states.some((s) => s.isoCode === cleaned || s.name === cleaned);
        if (states.length > 0 && !match) {
            return ok('Emirates/State must match the selected country');
        }
    }
    return ok();
}

export function validateEmployeePostalCode(value) {
    const cleaned = stripDangerousText(value);
    if (!cleaned) return ok();
    if (cleaned.length > 10) return ok('ZIP Code must be no more than 10 characters');
    if (!/^[A-Za-z0-9\s-]+$/.test(cleaned)) {
        return ok('ZIP Code may contain only letters, numbers, spaces, and hyphens');
    }
    return ok();
}

export function validateEmployeeAddressForm(form = {}) {
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set('line1', validateEmployeeAddressLine(form.line1));
    set('line2', validateEmployeeApartment(form.line2));
    set('city', validateEmployeeAddressCity(form.city));
    set('country', validateCountryIso(form.country));
    set('state', validateEmployeeAddressState(form.state, form.country));
    set('postalCode', validateEmployeePostalCode(form.postalCode));

    return errors;
}
