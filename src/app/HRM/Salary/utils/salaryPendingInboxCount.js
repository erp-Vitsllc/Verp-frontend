import {
    clearPendingInboxCache,
    SALARY_PENDING_INBOX_ENDPOINT,
} from '@/utils/pendingInboxFetch';

export const SALARY_PENDING_INBOX_CHANGED = 'salary-pending-inbox-changed';

export function pendingEnrollmentEmployees(overview) {
    return (Array.isArray(overview?.employees) ? overview.employees : []).filter(
        (emp) => emp && !emp.enrolled && String(emp.employeeId || '').trim(),
    );
}

export function pendingEnrollmentMessage(count) {
    const n = Number(count) || 0;
    return `${n} is pending for enrollment`;
}

export function pendingEnrollmentInboxItems(employees) {
    return pendingEnrollmentEmployees({ employees }).map((emp) => {
        const employeeId = String(emp.employeeId || '').trim();
        const name = String(emp.name || employeeId).trim() || employeeId;
        return {
            dashboardActionId: `enroll-pending-${employeeId}`,
            requestType: 'Salary Enrollment',
            requestedDate: null,
            requestedByName: '',
            subjectName: name,
            subjectEmployeeId: employeeId,
            extra1: `${name} is pending for enrollment`,
            extra2: 'Pending for enrollment',
            extra3: JSON.stringify({
                href: `/HRM/Salary/enroll/${encodeURIComponent(employeeId)}`,
                employeeId,
            }),
            href: `/HRM/Salary/enroll/${encodeURIComponent(employeeId)}`,
            status: 'Pending',
        };
    });
}

/** Same count as the Salary page bell (pending salary-profile approvals for the viewer). */
export function countVisibleSalaryPendingInbox(items) {
    const list = Array.isArray(items) ? items : [];
    return list.length;
}

export function notifySalaryPendingInboxChanged() {
    clearPendingInboxCache(SALARY_PENDING_INBOX_ENDPOINT);
    if (typeof window !== 'undefined') {
        const event = new CustomEvent(SALARY_PENDING_INBOX_CHANGED);
        window.dispatchEvent(event);
        document.dispatchEvent(event);
    }
}
