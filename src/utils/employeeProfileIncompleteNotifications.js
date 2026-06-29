import { calculateEmployeeProfileCompletion } from '@/utils/employeeProfileCompletion';
import { isEmployeeProfileLiveActive } from '@/utils/employeeActivationSections';
import { buildEmployeePathWithFocus } from '@/utils/notificationFocusNavigation';
import { formatEmployeeProfileIncompleteDisplay } from '@/utils/employeeProfileNotificationMessages';

export const PROFILE_INCOMPLETE_TYPE = 'Profile Incomplete';

export { formatEmployeeProfileIncompleteDisplay };

const employeeDisplayName = (employee = {}) =>
    `${employee.firstName || ''} ${employee.lastName || ''}`.trim() ||
    employee.employeeId ||
    'Employee';

export function buildEmployeeProfileIncompletePath(employeeKey, extra3Raw) {
    if (!employeeKey) return '';
    let meta = {};
    if (extra3Raw) {
        try {
            meta = typeof extra3Raw === 'string' ? JSON.parse(extra3Raw) : extra3Raw;
        } catch {
            meta = {};
        }
    }
    if (String(meta?.kind || '') === 'mandatory-cards') {
        return `/emp/${encodeURIComponent(String(employeeKey))}?tab=basic`;
    }
    const section = String(meta?.section || '').trim();
    const field = String(meta?.field || '').trim();
    const params = new URLSearchParams();
    params.set('tab', 'basic');
    let path = `/emp/${encodeURIComponent(String(employeeKey))}?${params.toString()}`;
    const focusText = [field, section, meta?.focusCard].filter(Boolean).join(' ');
    return buildEmployeePathWithFocus(path, focusText);
}

export function isMandatoryCardsProfileIncompleteItem(item = {}) {
    if (String(item?.type || '').trim() !== PROFILE_INCOMPLETE_TYPE) return false;
    if (/missing mandatory cards|profile incomplete/i.test(String(item?.extra1 || ''))) return true;
    try {
        const meta = typeof item.extra3 === 'string' ? JSON.parse(item.extra3) : item.extra3;
        return String(meta?.kind || '') === 'mandatory-cards';
    } catch {
        return false;
    }
}

function resolveEmployeeForNotification(employees = [], item = {}) {
    const key = String(item.targetEmployeeId ?? item.id ?? '').trim();
    if (!key) return null;
    return (employees || []).find(
        (emp) =>
            String(emp?.employeeId || '') === key ||
            String(emp?._id || '') === key ||
            String(emp?.id || '') === key,
    );
}

/** Drop mandatory-cards alerts when progress is 100%+; never invent alerts from list API rows. */
export function filterMandatoryCardsNotificationsByProgress(items = [], employees = []) {
    return (items || []).filter((item) => {
        if (!isMandatoryCardsProfileIncompleteItem(item)) return true;
        const employee = resolveEmployeeForNotification(employees, item);
        if (!employee) return true;
        if (!isEmployeeProfileLiveActive(employee)) return false;
        const { percentage } = calculateEmployeeProfileCompletion(employee);
        return Number.isFinite(percentage) && percentage < 100;
    });
}

/** @deprecated List API rows are incomplete — mandatory-cards alerts come from user-stats only. */
export function collectEmployeeProfileIncompleteNotifications() {
    return [];
}
