import { calculateEmployeeProfileCompletion } from '@/utils/employeeProfileCompletion';
import { isEmployeeProfileLiveActive } from '@/utils/employeeActivationSections';
import { buildEmployeePathWithFocus } from '@/utils/notificationFocusNavigation';

export const PROFILE_INCOMPLETE_TYPE = 'Profile Incomplete';

const SECTION_ROUTE = {
    'Basic Details': { tab: 'basic' },
    Passport: { tab: 'basic', focusCard: 'passport' },
    Visa: { tab: 'basic', focusCard: 'visa' },
    'Emirates ID': { tab: 'basic', focusCard: 'emiratesId' },
    'Labour Card': { tab: 'basic', focusCard: 'labourCard' },
    'Salary Details': { tab: 'salary' },
    'Bank Details': { tab: 'salary', focusCard: 'bankAccount' },
    'Emergency Contact': { tab: 'personal', subTab: 'personal-info', focusCard: 'emergencyContact' },
    'Work Details': { tab: 'work-details' },
};

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
    const section = String(meta?.section || '').trim();
    const field = String(meta?.field || '').trim();
    const route = SECTION_ROUTE[section] || { tab: 'basic' };
    const params = new URLSearchParams();
    params.set('tab', route.tab);
    if (route.subTab) params.set('subTab', route.subTab);
    let path = `/emp/${encodeURIComponent(String(employeeKey))}?${params.toString()}`;
    const focusText = [field, section, meta?.focusCard, route.focusCard].filter(Boolean).join(' ');
    return buildEmployeePathWithFocus(path, focusText);
}

export function formatEmployeeProfileIncompleteDisplay(item = {}) {
    if (String(item?.type || '').trim() !== PROFILE_INCOMPLETE_TYPE) return null;
    const label = String(item?.extra1 || '')
        .replace(/^Complete:\s*/i, '')
        .trim();
    const employeeLine = String(item?.extra2 || '').trim();
    return {
        headline: label ? `Complete ${label}` : 'Complete profile',
        detail: employeeLine,
    };
}

/**
 * Synthetic HR tasks mirroring the employee profile progress bar — live-active profiles below 100% only.
 */
export function collectEmployeeProfileIncompleteNotifications(employees = []) {
    const items = [];
    const nowIso = new Date().toISOString();

    for (const employee of employees || []) {
        if (!employee?._id || !isEmployeeProfileLiveActive(employee)) continue;

        const { percentage, pendingFields } = calculateEmployeeProfileCompletion(employee);
        if (!Number.isFinite(percentage) || percentage >= 100) continue;
        if (!Array.isArray(pendingFields) || !pendingFields.length) continue;

        const empKey = employee.employeeId || employee._id;
        const displayName = employeeDisplayName(employee);

        for (const row of pendingFields) {
            const section = String(row?.section || '').trim();
            const field = String(row?.field || '').trim();
            if (!section || !field) continue;

            const route = SECTION_ROUTE[section] || { tab: 'basic' };
            const meta = {
                section,
                field,
                ...(route.focusCard ? { focusCard: route.focusCard } : {}),
                ...(row?.reason ? { reason: row.reason } : {}),
            };

            items.push({
                id: employee._id,
                actionId: null,
                type: PROFILE_INCOMPLETE_TYPE,
                requestedBy: 'System',
                requestedDate: nowIso,
                status: 'Pending',
                extra1: `Complete: ${field}`,
                extra2: `${displayName} (${empKey})`.trim(),
                extra3: JSON.stringify(meta),
                targetEmployeeId: empKey,
                scope: 'inbox',
            });
        }
    }

    return items;
}
