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

const SKIPPED = new Set(['done', 'created', 'leaveBalance']);

function isApprovalStep(step) {
    if (!step) return false;
    if (String(step.approvalTitle || '').trim()) return true;
    return ROLE_KEYS.has(step.key) || step.key === 'reportee';
}

/** People the task is still waiting on: the current holder, then later approvals. */
function waitingSteps(steps) {
    const list = Array.isArray(steps) ? steps : [];
    return list.filter((step) => {
        if (!step?.personName || SKIPPED.has(step.key)) return false;
        if (step.status === 'In Progress' || step.current) return true;
        return step.status === 'Not Started' && isApprovalStep(step);
    });
}

function lineFor(step, steps) {
    const name = String(step?.personName || '').trim();
    if (!name) return null;
    const approval = approvalName(step, steps);
    const text = approval
        ? `Task pending ${approval} with ${name}`
        : `Task pending with ${name}`;
    return { approval, name, text };
}

/**
 * Who an open task is waiting on. Every approval that is still waiting is named.
 * Example: "Task pending HR Approval with Raseel Muhammad, Accounts Approval with Sara Ali".
 * A completed or closed task does not show this line.
 */
export function pendingHold({ status, steps, assigneeName, finished = false } = {}) {
    if (finished) return null;
    const label = String(status || '').trim();
    if (label === 'Closed' || label === 'Completed' || label === 'Approved' || label === 'Rejected' || label === 'Cancelled' || label === 'Dismissed') return null;
    if (!isWaitingTaskStatus(label)) return null;
    if (steps == null) return null;
    const lines = [];
    for (const step of waitingSteps(steps)) {
        const line = lineFor(step, steps);
        if (!line || lines.some((item) => item.text === line.text)) continue;
        lines.push(line);
    }
    if (!lines.length) {
        const name = String(assigneeName || '').trim();
        if (!name) return null;
        lines.push({ approval: '', name, text: `Task pending with ${name}` });
    }
    const text = lines.map((line, index) => (
        index === 0 ? line.text : line.text.replace(/^Task pending /, '')
    )).join(', ');
    return { lines, approval: lines[0].approval, name: lines[0].name, text };
}

/** Same waiting sentence for the task list and the task details. */
export function taskWaitingText(task, steps) {
    if (!task) return null;
    const raw = String(task.displayStatus || task.status || '').trim();
    const shown = raw === 'Closed' || raw === 'Completed' ? 'Completed' : raw;
    const finished = Boolean(task.closeScheduled)
        || shown === 'Completed'
        || shown === 'Rejected'
        || shown === 'Cancelled'
        || shown === 'Dismissed'
        || task.status === 'Completed'
        || task.status === 'Cancelled'
        || task.status === 'Rejected';
    const source = Array.isArray(steps) ? steps : task.holdSteps;
    const assigneeName = task.completionPending
        ? (task.originalAssigneeName || task.mainAssigneeName || task.assigneeName || '')
        : task.reviewPending
            ? (task.requesterName || task.assigneeName || '')
            : (task.reassignedAssigneeName || task.assigneeName || '');
    return pendingHold({
        status: shown || 'Pending',
        steps: Array.isArray(source) ? source : [],
        assigneeName,
        finished,
    });
}
