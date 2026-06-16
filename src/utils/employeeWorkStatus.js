export const WORK_STATUS_EXIT_OPTIONS = ['Termination', 'Resignation', 'Left User'];

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
