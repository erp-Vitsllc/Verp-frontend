export const LEFT_USER_STATUS = 'Left User';

export const WORK_STATUS_EXIT_OPTIONS = ['Termination', 'Resignation', LEFT_USER_STATUS];

export function isEmployeeLeftUser(employeeOrStatus) {
    if (employeeOrStatus && typeof employeeOrStatus === 'object') {
        return String(employeeOrStatus.status || '').trim() === LEFT_USER_STATUS;
    }
    return String(employeeOrStatus || '').trim() === LEFT_USER_STATUS;
}

/** Left User profiles are view-only — no edit, create, renew, or delete actions. */
export function resolveEmployeeCardCanEdit(employee, canEditProp, accessEdit = false) {
    if (isEmployeeLeftUser(employee)) return false;
    return canEditProp !== undefined ? Boolean(canEditProp) : Boolean(accessEdit);
}

export function resolveEmployeeCardCanCreate(employee, canCreateProp, accessCreate = false) {
    if (isEmployeeLeftUser(employee)) return false;
    return canCreateProp !== undefined ? Boolean(canCreateProp) : Boolean(accessCreate);
}

export function applyLeftUserReadOnlySectionPermissions(permissions) {
    if (!permissions) return permissions;
    const lock = (section) => ({
        ...section,
        edit: false,
        create: false,
        delete: false,
    });
    return {
        basic: lock(permissions.basic),
        work: lock(permissions.work),
        salary: lock(permissions.salary),
        personal: lock(permissions.personal),
        documents: lock(permissions.documents),
        training: lock(permissions.training),
    };
}

export const DISABLED_WORK_STATUS_EXIT_OPTIONS = ['Termination', 'Resignation'];

export function buildWorkStatusExitDropdownOptions({
    leftUserEligible = false,
    leftUserLoading = false,
    isAlreadyLeftUser = false,
    isAdmin = false,
} = {}) {
    const baseOptions = [];
    if (isAdmin) {
        baseOptions.push(
            { value: 'Probation', label: 'Probation', disabled: false }
        );
        if (!isAlreadyLeftUser) {
            baseOptions.push(
                { value: 'Permanent', label: 'Permanent', disabled: false }
            );
        }
    }

    const exitOptions = WORK_STATUS_EXIT_OPTIONS.map((value) => {
        if (DISABLED_WORK_STATUS_EXIT_OPTIONS.includes(value)) {
            return { value, label: `${value} (disabled)`, disabled: true };
        }
        if (value === 'Left User') {
            if (isAlreadyLeftUser) {
                return { value, label: 'Left User', disabled: false };
            }
            if (leftUserLoading) {
                return { value, label: 'Left User (checking...)', disabled: true };
            }
            return {
                value,
                label: leftUserEligible ? 'Left User' : 'Left User (not eligible)',
                disabled: !leftUserEligible,
            };
        }
        return { value, label: value, disabled: false };
    });

    return [...baseOptions, ...exitOptions];
}

export function resolveWorkStatusDropdownValue(employee, formStatus) {
    const status = formStatus || employee?.status;
    if (['Left User', 'Probation', 'Permanent'].includes(status)) {
        return status;
    }
    return '';
}

export const DISABLED_NOTICE_REASONS = ['Termination', 'Resignation'];
export const ENABLED_NOTICE_REASONS = ['Notice Period'];

export const WORK_STATUS_READ_ONLY_VALUES = [
    'Probation',
    'Permanent',
    'Temporary',
    'Notice',
    'Left User',
];

export function formatWorkStatusDisplay(employee) {
    const status = employee?.status || 'Probation';
    if (status === 'Notice') {
        const reason = employee?.noticeRequest?.reason;
        if (reason && !DISABLED_NOTICE_REASONS.includes(reason)) {
            return `Notice (${reason})`;
        }
        if (reason && DISABLED_NOTICE_REASONS.includes(reason)) {
            return 'Notice';
        }
        return 'Notice';
    }
    return status;
}

export function canRequestNoticeFromWorkDetails(employee) {
    const status = employee?.status;
    if (!status || status === 'Notice' || status === 'Left User') return false;
    if (employee?.noticeRequest?.status === 'Pending') return false;
    return ['Probation', 'Permanent', 'Temporary'].includes(status);
}

export function formatNoticeExitDate(employee) {
    const exitDate = employee?.noticeRequest?.exitDate;
    if (!exitDate) return '';
    const d = new Date(exitDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
