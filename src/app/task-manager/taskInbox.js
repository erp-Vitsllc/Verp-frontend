const FINISHED = new Set(['Completed', 'Closed', 'Rejected', 'Cancelled', 'Dismissed']);
const BLANK_ASSIGNEE = new Set(['', '-', '—', '–']);

function personLabel(value) {
    const text = String(value || '').trim();
    return BLANK_ASSIGNEE.has(text) ? '' : text;
}

function finishedTask(task) {
    if (!task || task.closeScheduled) return true;
    const display = String(task.displayStatus || '').trim();
    const raw = String(task.status || '').trim();
    return FINISHED.has(display) || FINISHED.has(raw);
}

/** The task was handed to someone else. That person is the current holder. */
export function taskHasReassignee(task) {
    return Boolean(
        personLabel(task?.reassignedAssigneeName)
        || String(task?.reassignedAssigneeId || '').trim(),
    );
}

function taskHasAssignee(task) {
    if (task?.assigneeCleared) return false;
    return Boolean(
        personLabel(task?.assigneeName)
        || personLabel(task?.mainAssigneeName)
        || personLabel(task?.reassignedAssigneeName)
        || personLabel(task?.listedAssigneeName)
        || String(task?.assigneeId || '').trim()
        || String(task?.reassignedAssigneeId || '').trim()
        || String(task?.listedAssigneeId || '').trim(),
    );
}

/**
 * The assignee column is blank because the requester still has to act.
 * That covers a cleared assignee and a completion the requester has not approved yet.
 */
export function taskWaitingOnRequester(task) {
    if (finishedTask(task)) return false;
    if (task.reviewPending) return true;
    const display = String(task.displayStatus || '').trim();
    const raw = String(task.status || '').trim();
    if (display === 'Pending Review' || raw === 'Pending Review') return true;
    if (task.assigneeCleared) return true;
    return !taskHasAssignee(task);
}

/**
 * Open-task tabs for one viewer.
 * Review Pending: nobody is assigned, or the assignee finished and the requester has not approved.
 * My Task: the person who has the work now. A reassignee holds it.
 * My Requests: tasks this person requested, and tasks they handed to a reassignee.
 */
export function openTaskTabs(task, role = {}) {
    const requester = Boolean(role.requester);
    const holder = Boolean(role.reassignedHolder);
    const original = Boolean(role.originalAssignee);
    const assignee = Boolean(role.assignee);
    if (taskWaitingOnRequester(task)) {
        return { mine: false, requests: false, review: requester };
    }
    const reassigned = taskHasReassignee(task);
    return {
        mine: reassigned ? holder : assignee,
        requests: requester || (reassigned && original && !holder),
        review: false,
    };
}
