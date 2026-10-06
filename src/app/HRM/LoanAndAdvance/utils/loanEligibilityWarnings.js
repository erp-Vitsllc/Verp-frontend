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

function requestKind(type) {
    return isAdvanceType(type) ? 'advance' : 'loan';
}

function requestLabel(type) {
    return isAdvanceType(type) ? 'Advance' : 'Loan';
}

const OPEN_APPLICATION_STATUSES = new Set([
    'pending',
    'pending hr',
    'pending accounts',
    'pending authorization',
]);

function loanStatus(loan) {
    return String(loan?.applicationStatus || loan?.approvalStatus || loan?.status || '')
        .trim()
        .toLowerCase();
}

function isFullyRepaidByEmployee(loan) {
    const amount = Number(loan?.amount) || 0;
    const repaid = Number(loan?.repaidAmount) || 0;
    return amount > 0.01 && repaid >= amount - 0.01;
}

function blocksAnotherRequest(loan) {
    const status = loanStatus(loan);
    if (!status || status === 'draft' || status === 'rejected' || status === 'cancelled') {
        return false;
    }
    if (OPEN_APPLICATION_STATUSES.has(status)) return true;
    if (
        status === 'approved' ||
        status === 'paid' ||
        status === 'pending payment to employee'
    ) {
        return !isFullyRepaidByEmployee(loan);
    }
    if (status.includes('pending')) return true;
    return !isFullyRepaidByEmployee(loan);
}

function sameTypeBlockMessage(blocking) {
    const kind = requestLabel(blocking?.type);
    const ref = blocking?.loanId ? ` (${blocking.loanId})` : '';
    if (OPEN_APPLICATION_STATUSES.has(loanStatus(blocking))) {
        return `This employee already has a ${kind} application in progress${ref}. Another ${kind} cannot be added until that application is finished.`;
    }
    return `This employee still has an unpaid ${kind}${ref}. Another ${kind} can be added only after this ${kind} is fully repaid.`;
}

/**
 * Employee eligibility for Add Loan / Advance.
 * A second advance, or a second loan, can be overridden by flowchart HR.
 * A loan does not block an advance, and an advance does not block a loan.
 * Visa / status issues are overrideable by the flowchart HR assigned user.
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
        const blocking = existingLoans
            .filter(
                (l) =>
                    l.employeeId === employee.employeeId &&
                    requestKind(l.type) === requestKind(type) &&
                    (!initialData || (l.id !== initialData.id && l._id !== initialData._id)) &&
                    blocksAnotherRequest(l),
            )
            .sort((a, b) => {
                const aOpen = OPEN_APPLICATION_STATUSES.has(loanStatus(a)) ? 0 : 1;
                const bOpen = OPEN_APPLICATION_STATUSES.has(loanStatus(b)) ? 0 : 1;
                return aOpen - bOpen;
            })[0];
        if (blocking) {
            overrideable.push(sameTypeBlockMessage(blocking));
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
