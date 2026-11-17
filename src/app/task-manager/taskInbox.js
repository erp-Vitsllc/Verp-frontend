import { basePersonName } from './taskRolePeople.js';

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
 * The requester still has to act: a completion is waiting, the assignee was cleared,
 * or nobody is assigned. The last assignee name stays visible separately.
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
 * After the assignee completes, and after the requester accepts, the last
 * assignee stays in the assignee slot. They are not listed as a reassignee
 * and the slot is not left blank.
 */
export function pinnedAssignee(task) {
    const review = Boolean(task?.reviewPending)
        || String(task?.displayStatus || '').trim() === 'Pending Review'
        || String(task?.status || '').trim() === 'Pending Review';
    const accepted = Boolean(task?.reviewAccepted);
    if (finishedTask(task) || (!review && !accepted)) return null;
    const reassigned = personLabel(task?.reassignedAssigneeName);
    const raw = reassigned
        || personLabel(task?.mainAssigneeName)
        || personLabel(task?.assigneeName)
        || personLabel(task?.listedAssigneeName);
    if (!raw) return null;
    return {
        name: basePersonName(raw) || raw,
        photo: reassigned
            ? (task?.reassignedAssigneePhoto || task?.assigneePhoto || '')
            : (task?.mainAssigneePhoto || task?.assigneePhoto || ''),
        role: reassigned
            ? (task?.assigneeRole || '')
            : (task?.mainAssigneeRole || task?.assigneeRole || ''),
    };
}

function identityHit(identity, { id = '', empId = '', name = '' } = {}) {
    const ids = identity?.ids || [];
    const codes = (identity?.codes || []).map((value) => String(value || '').trim().toLowerCase());
    const names = (identity?.names || []).map((value) => basePersonName(value).toLowerCase()).filter(Boolean);
    const personId = String(id || '');
    const personCode = String(empId || '').trim().toLowerCase();
    const personName = basePersonName(name).toLowerCase();
    if (personId && ids.includes(personId)) return true;
    if (personCode && codes.includes(personCode)) return true;
    return Boolean(personName && names.includes(personName));
}

function viewerHoldsOpenTask(task, identity) {
    if (finishedTask(task) || task?.reviewAccepted) return false;
    if (personLabel(task?.reassignedAssigneeName) || String(task?.reassignedAssigneeId || '').trim()) {
        return identityHit(identity, {
            id: task.reassignedAssigneeId,
            name: task.reassignedAssigneeName,
        });
    }
    return identityHit(identity, {
        id: task?.assigneeId || task?.listedAssigneeId,
        empId: task?.assigneeEmpId || task?.listedAssigneeEmpId,
        name: task?.mainAssigneeName || task?.assigneeName || task?.listedAssigneeName,
    });
}

/**
 * Roles whose own work on this task is finished.
 * An open task still held by that person is not finished, unless the requester already accepted it.
 */
export function finishedWorkRoles(task, identity = {}) {
    const people = Array.isArray(task?.finishedBy) ? task.finishedBy : [];
    const roles = [];
    for (const person of people) {
        if (!identityHit(identity, { id: person?.id || person?.employeeId, empId: person?.empId, name: person?.name })) continue;
        const role = String(person?.role || '').trim();
        if (role && !roles.includes(role)) roles.push(role);
    }
    if (viewerHoldsOpenTask(task, identity)) return roles.filter((role) => role === 'requester');
    return roles;
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
