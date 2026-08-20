export const VISA_REPAYMENT_LIMIT_MSG =
    'Repayment period exceeds visa expiry limit (Expiry - 2 months). Please reduce duration or change start date.';

function monthsUntil(dateValue) {
    const expiryDate = new Date(dateValue);
    const today = new Date();
    return (
        (expiryDate.getFullYear() - today.getFullYear()) * 12 +
        (expiryDate.getMonth() - today.getMonth())
    );
}

function isDateInPast(dateValue) {
    const expiry = new Date(dateValue);
    if (Number.isNaN(expiry.getTime())) return false;
    const today = new Date();
    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return expiry < today;
}

export function isVisitVisaType(visaType) {
    const t = String(visaType || '')
        .toLowerCase()
        .replace(/\s+/g, '');
    return t === 'visit' || t === 'visitvisa';
}

function isAdvanceType(type) {
    return String(type || '')
        .toLowerCase()
        .includes('advance');
}

/**
 * Employee eligibility for Add Loan / Advance.
 * Duplicate active records stay hard-blocked. Visa / status issues are
 * overrideable by the flowchart HR assigned user after confirmation.
 */
export function collectLoanEligibilityIssues(
    employee,
    type,
    { existingLoans = [], initialData = null } = {},
) {
    const hardBlocks = [];
    const overrideable = [];
    const kindLabel = isAdvanceType(type) ? 'an Advance' : 'a Loan';
    let newMaxDuration = isAdvanceType(type) ? 1 : 12;

    if (!employee) {
        return { hardBlocks, overrideable, maxDuration: newMaxDuration };
    }

    if (existingLoans.length > 0) {
        const hasActiveOfType = existingLoans.some(
            (l) =>
                l.employeeId === employee.employeeId &&
                l.type === type &&
                l.activeStatus !== 'Closed' &&
                l.applicationStatus !== 'Rejected' &&
                (!initialData || (l.id !== initialData.id && l._id !== initialData._id)),
        );
        if (hasActiveOfType) {
            hardBlocks.push(`Employee already has an active or pending ${type}.`);
        }
    }

    const status = String(employee.status || '').toLowerCase();
    if (status === 'notice') {
        overrideable.push('This employee is in Notice period.');
    }
    if (status === 'probation' && !isAdvanceType(type)) {
        overrideable.push('This employee is in Probation period (personal loans are not normally allowed).');
    }

    if (isVisitVisaType(employee.visaType)) {
        overrideable.push(
            `This employee is on a Visit Visa, which is not normally allowed for ${kindLabel}.`,
        );
    }

    if (employee.visaExpiry) {
        if (isDateInPast(employee.visaExpiry)) {
            overrideable.push("This employee's visa has expired.");
        } else if (!isAdvanceType(type)) {
            const monthsUntilExpiry = monthsUntil(employee.visaExpiry);
            if (monthsUntilExpiry < 3) {
                overrideable.push("This employee's visa expires in less than 3 months.");
            }
            const adjustedMax = monthsUntilExpiry - 2;
            newMaxDuration = Math.min(6, Math.max(1, adjustedMax));
        }
    }

    if (isAdvanceType(type)) {
        newMaxDuration = 1;
    }

    return { hardBlocks, overrideable, maxDuration: newMaxDuration };
}

export function formatOverrideConfirmDescription(messages) {
    const unique = [...new Set((messages || []).filter(Boolean))];
    if (!unique.length) return 'Do you want to continue the process?';
    return `${unique.join('\n\n')}\n\nDo you want to continue the process?`;
}
