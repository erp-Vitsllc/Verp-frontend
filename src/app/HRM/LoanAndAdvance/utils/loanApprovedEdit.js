export const APPROVED_LOAN_STATUSES = ['Approved', 'Paid'];

export function isApprovedLoanStatus(status) {
    return APPROVED_LOAN_STATUSES.includes(status);
}

function collectIdentityIds(user) {
    if (!user) return [];
    return [user._id, user.id, user.employeeObjectId, user.employeeId]
        .filter(Boolean)
        .map(String);
}

function identityMatches(user, target) {
    const userIds = collectIdentityIds(user);
    if (!userIds.length || !target) return false;
    const targetIds =
        typeof target === 'object' ? collectIdentityIds(target) : [String(target)];
    return userIds.some((id) => targetIds.includes(id));
}

import { isAdmin } from '@/utils/permissions';

/** HR department, flowchart HR, or HR who approved the loan. */
export function isHrUser(user, loan) {
    if (!user) return false;

    if (isAdmin()) return true;

    const dept = (user.department || '').toLowerCase();
    const des = (user.designation || '').toLowerCase();
    if (
        dept === 'hr' ||
        dept.includes('human resource') ||
        des.includes('human resource') ||
        /\bhr\b/.test(des)
    ) {
        return true;
    }

    if (loan?.hrHODId && user.employeeId && String(loan.hrHODId) === String(user.employeeId)) {
        return true;
    }

    if (loan?.hrApprovedBy && identityMatches(user, loan.hrApprovedBy)) {
        return true;
    }

    const hrStep = (loan?.workflow || []).find((w) => w.role === 'HR' || w.role === 'HR Admin');
    if (hrStep?.assignedTo && identityMatches(user, hrStep.assignedTo)) {
        return true;
    }

    return false;
}

export function canEditApprovedLoanSchedule(user, loan) {
    const status = loan?.approvalStatus || loan?.status;
    return Boolean(user && loan && isApprovedLoanStatus(status) && isHrUser(user, loan));
}

export async function submitApprovedLoanScheduleEdit({
    axiosInstance,
    loanId,
    duration,
    monthStart,
    toast,
    onSuccess,
    setSubmitting,
}) {
    try {
        setSubmitting?.(true);
        await axiosInstance.put(`/Employee/loans/${loanId}`, {
            duration: parseInt(duration, 10) || 1,
            monthStart: monthStart || '',
            scheduleOnlyEdit: true,
        });
        toast?.({
            title: 'Success',
            description: 'Repayment schedule updated successfully.',
            className: 'bg-green-50 border-green-200 text-green-800',
        });
        onSuccess?.();
    } catch (error) {
        toast?.({
            variant: 'destructive',
            title: 'Error',
            description: error.response?.data?.message || error.message || 'Update failed.',
        });
    } finally {
        setSubmitting?.(false);
    }
}
