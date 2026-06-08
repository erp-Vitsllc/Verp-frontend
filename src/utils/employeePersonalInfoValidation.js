import {
    validateEmployeeEmail,
    validateInternationalPhone,
    validateDateOfBirth,
    validateGender,
    validateNationality,
    stripDangerousText,
} from '@/utils/employeeAddValidation';
import {
    validateProfileMaritalStatus,
    validateProfileNumberOfDependents,
    validateProfileFathersName,
    EMPLOYEE_MARITAL_STATUS_VALUES,
} from '@/utils/employeeProfileBasicDetailsValidation';

const ok = (error = '') => ({ isValid: !error, error });

export { EMPLOYEE_MARITAL_STATUS_VALUES };

export function validateEmployeePersonalInfoForm(form = {}, { defaultCountry = 'AE' } = {}) {
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set('email', validateEmployeeEmail(form.email));
    set('contactNumber', validateInternationalPhone(form.contactNumber, defaultCountry));
    set('dateOfBirth', validateDateOfBirth(form.dateOfBirth));
    set('maritalStatus', validateProfileMaritalStatus(form.maritalStatus));
    set('numberOfDependents', validateProfileNumberOfDependents(form.maritalStatus, form.numberOfDependents));
    set('fathersName', validateProfileFathersName(form.fathersName));
    set('gender', validateGender(form.gender));
    set('nationality', validateNationality(form.nationality));

    return errors;
}

export function normalizePersonalInfoPayload(form = {}) {
    return {
        email: stripDangerousText(form.email).toLowerCase(),
        contactNumber: form.contactNumber,
        dateOfBirth: form.dateOfBirth || null,
        maritalStatus: String(form.maritalStatus || '').trim().toLowerCase(),
        fathersName: stripDangerousText(form.fathersName).replace(/\s+/g, ' ').trim(),
        gender: String(form.gender || '').trim().toLowerCase(),
        nationality: String(form.nationality || '').trim(),
        numberOfDependents:
            String(form.maritalStatus || '').toLowerCase() === 'married' &&
            form.numberOfDependents !== '' &&
            form.numberOfDependents != null
                ? parseInt(String(form.numberOfDependents).trim(), 10)
                : null,
    };
}
