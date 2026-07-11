import {
    isAdmin,
    hasModuleFlag,
    hasPermission,
    hasAnyPermission,
} from '@/utils/permissions';

function hasCreateModuleAccess(moduleId, legacyParentCreate = false) {
    if (isAdmin()) return true;
    if (
        hasModuleFlag(moduleId, 'isView') ||
        hasPermission(moduleId, 'isCreate') ||
        hasPermission(moduleId, 'isEdit') ||
        hasPermission(moduleId, 'isDelete') ||
        hasPermission(moduleId, 'isDownload')
    ) {
        return true;
    }
    if (legacyParentCreate) {
        return hasPermission('hrm_loan', 'isCreate') || hasPermission('hrm_loan', 'isEdit');
    }
    return false;
}

export function canViewLoanList() {
    return (
        isAdmin() ||
        hasPermission('hrm_loan_loan', 'isView') ||
        hasAnyPermission('hrm_loan_loan') ||
        hasPermission('hrm_loan', 'isView') ||
        hasAnyPermission('hrm_loan')
    );
}

export function canViewAdvanceList() {
    return (
        isAdmin() ||
        hasPermission('hrm_loan_advance', 'isView') ||
        hasAnyPermission('hrm_loan_advance') ||
        hasPermission('hrm_loan', 'isView') ||
        hasAnyPermission('hrm_loan')
    );
}

/** Create Loan = FULL — controls Loan option on the Loan/Advance type toggle. */
export function canCreateLoan() {
    return hasCreateModuleAccess('hrm_loan_loan_create', true);
}

/** Create Advance = FULL — controls Advance option on the Loan/Advance type toggle. */
export function canCreateAdvance() {
    return hasCreateModuleAccess('hrm_loan_advance_create', true);
}

export function canAccessAddLoanOrAdvance() {
    return canCreateLoan() || canCreateAdvance();
}

export function getDefaultLoanAdvanceType() {
    if (canCreateLoan()) return 'Loan';
    if (canCreateAdvance()) return 'Advance';
    return 'Loan';
}
