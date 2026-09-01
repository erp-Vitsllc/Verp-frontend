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
    const nowIso = new Date().toISOString();
    return pendingEnrollmentEmployees({ employees }).map((emp) => {
        const employeeId = String(emp.employeeId || '').trim();
        const name = String(emp.name || employeeId).trim() || employeeId;
        const href = `/HRM/Salary/enroll/${encodeURIComponent(employeeId)}`;
        return {
            dashboardActionId: `enroll-pending-${employeeId}`,
            requestType: 'Salary Enrollment',
            requestedDate: nowIso,
            requestedByName: '',
            subjectName: name,
            subjectEmployeeId: employeeId,
            extra1: `${name} is pending for enrollment`,
            extra2: 'Pending for enrollment',
            extra3: JSON.stringify({
                href,
                employeeId,
                pendingEnrollment: true,
            }),
            href,
            status: 'Pending',
        };
    });
}

function employeeInboxKey(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, '')
        .toUpperCase();
}

/** Combine HR approvals/DMF with employees whose enroll status is still Pending. */
export function mergeSalaryInboxWithPendingEnrollments(inboxItems, overview) {
    const inbox = Array.isArray(inboxItems) ? inboxItems : [];
    const existing = new Set(
        inbox.map((row) => employeeInboxKey(row?.subjectEmployeeId)).filter(Boolean),
    );
    const extra = pendingEnrollmentInboxItems(overview?.employees).filter((row) => {
        const key = employeeInboxKey(row.subjectEmployeeId);
        return key && !existing.has(key);
    });
    return [...inbox, ...extra];
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
