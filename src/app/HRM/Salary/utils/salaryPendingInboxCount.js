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

function parseInboxMeta(row) {
    const raw = row?.extra3;
    if (raw && typeof raw === 'object') return raw;
    try {
        return JSON.parse(String(raw || '{}'));
    } catch {
        return {};
    }
}

function inboxMonthKey(row) {
    const fromRow = String(row?.monthKey || '').trim();
    if (/^\d{4}-\d{2}$/.test(fromRow)) return fromRow;
    const meta = parseInboxMeta(row);
    const fromMeta = String(meta.monthKey || '').trim();
    if (/^\d{4}-\d{2}$/.test(fromMeta)) return fromMeta;
    const href = String(meta.href || row?.href || '');
    const match = href.match(/\/HRM\/Salary\/(\d{4}-\d{2})(?:\/|$)/i);
    return match ? match[1] : '';
}

export function pendingMonthApprovalInboxItems(months) {
    return (Array.isArray(months) ? months : [])
        .filter((row) => row?.canAct && String(row.monthKey || '').trim())
        .map((row) => {
            const monthKey = String(row.monthKey).trim();
            const href = `/HRM/Salary/${encodeURIComponent(monthKey)}`;
            const label = String(row.month || monthKey).trim() || monthKey;
            const status = String(row.processStatus || 'Pending').trim() || 'Pending';
            return {
                dashboardActionId: `salary-month-${monthKey}`,
                requestType: 'Salary DMF Approval',
                requestedDate: new Date().toISOString(),
                requestedByName: '',
                subjectName: label,
                subjectEmployeeId: '',
                extra1: `${label} ${status}`,
                extra2: status,
                extra3: JSON.stringify({ href, monthKey }),
                href,
                monthKey,
                status: 'Pending',
            };
        });
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

export function mergeSalaryInboxWithPendingMonths(inboxItems, months) {
    const inbox = Array.isArray(inboxItems) ? inboxItems : [];
    const existing = new Set(inbox.map(inboxMonthKey).filter(Boolean));
    const extra = pendingMonthApprovalInboxItems(months).filter(
        (row) => row.monthKey && !existing.has(row.monthKey),
    );
    return [...inbox, ...extra];
}

export function buildSalaryBellInbox(
    inboxItems,
    { overview = null, includePendingEnrollments = false, months = [] } = {},
) {
    let list = Array.isArray(inboxItems) ? inboxItems : [];
    if (includePendingEnrollments) {
        list = mergeSalaryInboxWithPendingEnrollments(list, overview);
    }
    return mergeSalaryInboxWithPendingMonths(list, months);
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
