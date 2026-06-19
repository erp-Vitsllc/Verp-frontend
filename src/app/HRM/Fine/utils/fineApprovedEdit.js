export const APPROVED_FINE_STATUSES = ['Approved', 'Active', 'Paid', 'Completed'];

const SCHEDULE_FIELDS = new Set(['monthStart', 'payableDuration']);

export function isApprovedFineStatus(status) {
    return APPROVED_FINE_STATUSES.includes(status);
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
    const targetIds = typeof target === 'object'
        ? collectIdentityIds(target)
        : [String(target)];
    return userIds.some((id) => targetIds.includes(id));
}

/** HR department, flowchart HR on fine, or HR who approved the fine. */
export function isHrUser(user, fine) {
    if (!user) return false;

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

    if (fine?.hrHODId && identityMatches(user, { employeeId: fine.hrHODId })) {
        return true;
    }

    if (fine?.hrApprovedBy && identityMatches(user, fine.hrApprovedBy)) {
        return true;
    }

    const hrStep = (fine?.workflow || []).find((w) => w.role === 'HR');
    if (hrStep?.assignedTo && identityMatches(user, hrStep.assignedTo)) {
        return true;
    }

    return false;
}

export function canEditApprovedFineSchedule(user, fine) {
    return Boolean(user && fine && isApprovedFineStatus(fine.fineStatus) && isHrUser(user, fine));
}

export function isFieldLockedForApprovedEdit(scheduleOnlyEdit, fieldName) {
    if (!scheduleOnlyEdit) return false;
    return !SCHEDULE_FIELDS.has(fieldName);
}

export async function submitApprovedFineScheduleEdit({
    axiosInstance,
    fineId,
    monthStart,
    payableDuration,
    toast,
    onSuccess,
    onClose,
    setSubmitting,
}) {
    try {
        setSubmitting?.(true);
        await axiosInstance.put(`/Fine/${fineId}`, {
            monthStart: monthStart || '',
            payableDuration: parseInt(payableDuration, 10) || 1,
        });
        toast?.({
            title: 'Success',
            description: 'Deduction schedule updated successfully.',
        });
        onSuccess?.();
        onClose?.();
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
