const WAITING = new Set([
    'Pending',
    'Pending Due',
    'Pending Review',
    'In Progress',
    'Open',
    'On Hold',
    'Reopened',
    'Overdue',
]);

const APPROVAL_BY_KEY = {
    manager: 'Manager Approval',
    hr: 'HR Approval',
    accounts: 'Accounts Approval',
    admin: 'Admin Approval',
    reportee: 'Reportee Approval',
    assigned: 'Assignee',
    reassigned: 'Reassigned',
    leaveBalance: 'Leave Balance',
};

const ROLE_KEYS = new Set(['manager', 'hr', 'accounts', 'admin', 'reportee']);

export function isWaitingTaskStatus(status) {
    return WAITING.has(String(status || '').trim());
}

function approvalName(step, steps) {
    if (!step) return '';
    const titled = String(step.approvalTitle || '').trim();
    if (titled) return titled;
    if (APPROVAL_BY_KEY[step.key] && ROLE_KEYS.has(step.key)) return APPROVAL_BY_KEY[step.key];
    const samePerson = (Array.isArray(steps) ? steps : []).find((other) => (
        other
        && other !== step
        && other.personId
        && String(other.personId) === String(step.personId || '')
        && (other.approvalTitle || ROLE_KEYS.has(other.key))
    ));
    if (samePerson?.approvalTitle) return String(samePerson.approvalTitle).trim();
    if (samePerson && ROLE_KEYS.has(samePerson.key)) return APPROVAL_BY_KEY[samePerson.key];
    if (step.key === 'reassigned' || /^reassigned to\b/i.test(step.title || '')) return 'Reassigned';
    if (step.key === 'assigned' || /^assignee\b/i.test(step.title || '')) return 'Assignee';
    if (step.key === 'leaveBalance') return 'Leave Balance';
    if (step.key === 'reportee') return 'Reportee Approval';
    return '';
}

function currentStep(steps) {
    const list = Array.isArray(steps) ? steps : [];
    return list.find((step) => step?.status === 'In Progress' && step.key !== 'done' && step.key !== 'created')
        || list.find((step) => step?.current && step.key !== 'done' && step.key !== 'created')
        || null;
}

/**
 * Sentence shown after the task number and status while the task is still open.
 * Example: "Task pending Admin Approval with Raseel Muhammad".
 * A completed or closed task does not show this line.
 */
export function pendingHold({ status, steps, assigneeName, finished = false } = {}) {
    if (finished) return null;
    const label = String(status || '').trim();
    if (label === 'Closed' || label === 'Completed' || label === 'Approved') return null;
    if (!isWaitingTaskStatus(label)) return null;
    if (steps == null) return null;
    const step = currentStep(steps);
    const name = String(step?.personName || assigneeName || '').trim();
    if (!name) return null;
    const approval = approvalName(step, steps);
    const text = approval
        ? `Task pending ${approval} with ${name}`
        : `Task pending with ${name}`;
    return { approval, name, text };
}
