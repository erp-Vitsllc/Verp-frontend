import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { openTaskTabs, taskHasReassignee, taskWaitingOnRequester } from './taskInbox.js';

const requester = {
    requester: true,
    reassignedHolder: false,
    originalAssignee: false,
    assignee: false,
};

describe('task inbox tabs', () => {
    it('puts a task with no assignee on Review Pending for the requester', () => {
        const task = {
            displayStatus: 'Pending',
            assigneeName: '',
            mainAssigneeName: '—',
            requesterName: 'Raj Angadembe',
        };
        assert.equal(taskWaitingOnRequester(task), true);
        assert.deepEqual(openTaskTabs(task, requester), { mine: false, requests: false, review: true });
        assert.deepEqual(openTaskTabs(task, { ...requester, requester: false }), {
            mine: false,
            requests: false,
            review: false,
        });
    });

    it('puts a completion waiting for the requester on Review Pending, even if an assignee is still stored', () => {
        const task = {
            displayStatus: 'Pending Review',
            reviewPending: true,
            assigneeName: 'Raseel Muhammad',
            assigneeId: 'a1',
            requesterName: 'Raj Angadembe',
        };
        assert.equal(taskWaitingOnRequester(task), true);
        assert.equal(openTaskTabs(task, { ...requester, assignee: true }).review, true);
        assert.equal(openTaskTabs(task, { ...requester, assignee: true }).mine, false);
        assert.equal(openTaskTabs(task, { ...requester, assignee: true }).requests, false);
    });

    it('keeps a finished task off Review Pending', () => {
        const task = { displayStatus: 'Completed', assigneeName: '', reviewPending: true };
        assert.equal(taskWaitingOnRequester(task), false);
    });

    it('gives a task with no reassignee to the assignee on My Task', () => {
        const task = { displayStatus: 'Pending', assigneeName: 'Raseel Muhammad', assigneeId: 'a1' };
        assert.equal(taskHasReassignee(task), false);
        assert.deepEqual(openTaskTabs(task, { assignee: true }), { mine: true, requests: false, review: false });
    });

    it('gives a reassigned task to the reassignee on My Task and the original assignee on My Requests', () => {
        const task = {
            displayStatus: 'Pending',
            assigneeName: 'Akhila Prasad',
            mainAssigneeName: 'Raseel Muhammad',
            originalAssigneeName: 'Raseel Muhammad',
            reassignedAssigneeName: 'Akhila Prasad',
            reassignedAssigneeId: 'b2',
        };
        assert.equal(taskHasReassignee(task), true);
        assert.deepEqual(openTaskTabs(task, { reassignedHolder: true, assignee: true }), {
            mine: true,
            requests: false,
            review: false,
        });
        assert.deepEqual(openTaskTabs(task, { originalAssignee: true, assignee: true }), {
            mine: false,
            requests: true,
            review: false,
        });
    });

    it('still lists a reassigned task under My Requests when the original assignee also requested it', () => {
        const task = {
            displayStatus: 'Pending',
            reassignedAssigneeName: 'Akhila Prasad',
            originalAssigneeName: 'Raseel Muhammad',
        };
        assert.deepEqual(openTaskTabs(task, { requester: true, originalAssignee: true, assignee: true }), {
            mine: false,
            requests: true,
            review: false,
        });
    });
});
