import {
    isAdmin,
    hasModuleFlag,
    hasPermission,
    hasAnyPermission,
    getUserPermissions,
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

/**
 * Loan List / Advance List visibility.
 * - Loan View checked → Loan List
 * - Advance View checked → Salary Advance List
 * - Create Loan / Create Advance → can see that list
 * - Explicit child View unchecked → hide that list (even if parent Loan and Advance View is on)
 * - Legacy groups with only parent View and no child row → show both
 */
function canViewLoanBranch(branchModuleId, createModuleId) {
    if (isAdmin()) return true;
    if (hasCreateModuleAccess(createModuleId, true)) return true;

    const permissions = getUserPermissions();
    const branchRow = permissions?.[branchModuleId];

    if (branchRow?.isView === true || branchRow?.isActive === true) return true;
    if (hasAnyPermission(branchModuleId)) return true;

    // Explicitly unchecked on Loan / Advance row → do not fall back to parent
    if (branchRow && branchRow.isView === false && branchRow.isActive !== true) {
        return false;
    }

    // Legacy: child row never stored — parent View opens both lists
    if (branchRow === undefined) {
        return hasPermission('hrm_loan', 'isView') || hasAnyPermission('hrm_loan');
    }

    return false;
}

export function canViewLoanList() {
    return canViewLoanBranch('hrm_loan_loan', 'hrm_loan_loan_create');
}

export function canViewAdvanceList() {
    return canViewLoanBranch('hrm_loan_advance', 'hrm_loan_advance_create');
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
