import { validateInternationalPhone } from '@/utils/employeeAddValidation';
import { stripDangerousText } from '@/utils/employeeAddValidation';

const RELATION_VALUES = ['Self', 'Father', 'Mother', 'Spouse', 'Friend', 'Other'];

const ok = (error = '') => ({ isValid: !error, error });

export { RELATION_VALUES };

export function validateEmergencyContactName(value) {
    const cleaned = stripDangerousText(value).replace(/\s+/g, ' ').trim();
    if (!cleaned) return ok('Name is required');
    if (cleaned.length < 2) return ok('Name must be at least 2 characters');
    if (cleaned.length > 100) return ok('Name must be no more than 100 characters');
    if (!/^[A-Za-z\s]+$/.test(cleaned)) {
        return ok('Name must contain only letters and spaces');
    }
    return ok();
}

export function validateEmergencyContactRelation(value) {
    const cleaned = String(value || '').trim();
    if (!cleaned) return ok('Relation is required');
    if (!RELATION_VALUES.includes(cleaned)) {
        return ok('Please select a valid relation');
    }
    return ok();
}

export function validateEmergencyContactPhone(value, { defaultCountry = 'AE', employeeContactNumber } = {}) {
    const phoneResult = validateInternationalPhone(value, defaultCountry);
    if (!phoneResult.isValid) return phoneResult;

    const normalize = (n) => String(n || '').replace(/\D/g, '');
    const incoming = normalize(value);
    const employee = normalize(employeeContactNumber);
    if (employee && incoming && incoming === employee) {
        return ok('Emergency contact number must not be the same as the employee contact number');
    }
    return ok();
}

export function validateEmergencyContactForm(contact = {}, options = {}) {
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set('name', validateEmergencyContactName(contact.name));
    set('relation', validateEmergencyContactRelation(contact.relation));
    set('number', validateEmergencyContactPhone(contact.number, options));

    return errors;
}
