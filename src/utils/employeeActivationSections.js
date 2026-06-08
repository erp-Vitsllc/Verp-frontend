/** Mirrors backend EMPLOYEE_ACTIVATION_SECTION_KEYS — progress-bar mandatory cards that queue on active profiles. */
export const EMPLOYEE_ACTIVATION_SECTION_KEYS = new Set([
    'basicDetails',
    'passport',
    'visa',
    'emiratesId',
    'labourCard',
    'workDetails',
    'signature',
    'emergencyContact',
]);

export const EMPLOYEE_INFORMATIVE_SECTION_KEYS = new Set([
    'medicalInsurance',
    'drivingLicense',
    'documents',
    'education',
    'experience',
    'training',
]);

const normKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function isEmployeeProfileActive(employee) {
    return String(employee?.profileStatus || 'inactive').toLowerCase() === 'active';
}

export function employeeHasPendingChange(employee, matchers = {}) {
    const list = Array.isArray(employee?.pendingReactivationChanges) ? employee.pendingReactivationChanges : [];
    return list.some((change) => {
        const section = normKey(change?.section);
        const card = normKey(change?.card);
        if (matchers.section && section === normKey(matchers.section)) return true;
        if (matchers.cardIncludes && card.includes(normKey(matchers.cardIncludes))) return true;
        if (matchers.sectionIncludes && section.includes(normKey(matchers.sectionIncludes))) return true;
        if (typeof matchers.match === 'function') return matchers.match(change, { section, card });
        return false;
    });
}

const PERSONAL_DETAIL_FIELD_KEYS = new Set([
    'dateOfBirth',
    'maritalStatus',
    'numberOfDependents',
    'fathersName',
    'gender',
    'nationality',
    'country',
]);

export function isPersonalDetailsPending(employee) {
    return employeeHasPendingChange(employee, {
        match: (change) => {
            if (normKey(change?.section) !== 'basicdetails') return false;
            const proposed = change?.proposedData || {};
            return Object.keys(proposed).some((key) => PERSONAL_DETAIL_FIELD_KEYS.has(key));
        },
    });
}

export function isSalaryDetailsPending(employee) {
    return employeeHasPendingChange(employee, { cardIncludes: 'salary' });
}

export function isBankDetailsPending(employee) {
    return employeeHasPendingChange(employee, { cardIncludes: 'bank' });
}

export function isEmergencyContactPending(employee) {
    return employeeHasPendingChange(employee, { sectionIncludes: 'emergencycontact' });
}

export function isApiResponseQueuedForHr(response) {
    const msg = String(response?.data?.message || '').toLowerCase();
    return (
        response?.data?.queuedForHrApproval === true ||
        msg.includes('queued for hr activation approval') ||
        msg.includes('queued for activation approval')
    );
}
