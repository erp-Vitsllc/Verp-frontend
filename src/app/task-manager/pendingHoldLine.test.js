import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pendingHold, taskWaitingText } from './pendingHoldLine.js';

describe('pending hold line', () => {
    it('names the approval and the employee the task is waiting on', () => {
        const hold = pendingHold({
            status: 'Pending',
            steps: [
                { key: 'created', status: 'Completed', personName: 'Nesmi Shamsudeen' },
                { key: 'reassigned', status: 'In Progress', personName: 'Raseel Muhammad', personId: 'a1' },
                { key: 'admin', status: 'Not Started', personName: 'Vishnu Prasad', personId: 'a2', approvalTitle: 'Admin Approval' },
            ],
        });
        assert.equal(hold.text, 'Task pending Reassigned with Raseel Muhammad, Admin Approval with Vishnu Prasad');
    });

    it('uses the approval role when the current holder is that approver', () => {
        const hold = pendingHold({
            status: 'Pending',
            steps: [
                { key: 'assigned', status: 'Completed', personName: 'Raseel Muhammad', personId: 'a1' },
                { key: 'admin', status: 'In Progress', personName: 'Vishnu Prasad', personId: 'a2', approvalTitle: 'Admin Approval' },
            ],
        });
        assert.equal(hold.text, 'Task pending Admin Approval with Vishnu Prasad');
    });

    it('keeps the approval title when that step was folded into the current assignee', () => {
        const hold = pendingHold({
            status: 'In Progress',
            steps: [
                {
                    key: 'reassigned',
                    status: 'In Progress',
                    personName: 'Vishnu Prasad',
                    personId: 'a2',
                    approvalTitle: 'Admin Approval',
                },
            ],
        });
        assert.equal(hold.text, 'Task pending Admin Approval with Vishnu Prasad');
    });

    it('names HR and reportee approvals', () => {
        assert.equal(pendingHold({
            status: 'Pending Due',
            steps: [{ key: 'hr', status: 'In Progress', personName: 'Sara Ali', personId: 'h1' }],
        }).text, 'Task pending HR Approval with Sara Ali');
        assert.equal(pendingHold({
            status: 'Open',
            steps: [{ key: 'reportee', status: 'In Progress', personName: 'Ali Khan', personId: 'r1' }],
        }).text, 'Task pending Reportee Approval with Ali Khan');
    });

    it('falls back to the assignee when the workflow has no named step', () => {
        const hold = pendingHold({
            status: 'Pending Review',
            steps: [],
            assigneeName: 'Raseel Muhammad',
        });
        assert.equal(hold.text, 'Task pending with Raseel Muhammad');
    });

    it('names every approval that is still waiting', () => {
        const hold = pendingHold({
            status: 'Pending',
            steps: [
                { key: 'reportee', status: 'In Progress', personName: 'Ali Khan', personId: 'r1' },
                { key: 'hr', status: 'Not Started', personName: 'Sara Ali', personId: 'h1', approvalTitle: 'HR Approval' },
                { key: 'assigned', status: 'Not Started', personName: 'Nobody', personId: 'x' },
            ],
        });
        assert.equal(hold.text, 'Task pending Reportee Approval with Ali Khan, HR Approval with Sara Ali');
    });

    it('uses the same sentence from the task fields on the list and the details', () => {
        const task = {
            displayStatus: 'Pending',
            completionPending: true,
            originalAssigneeName: 'Vishnu Prasad',
            reassignedAssigneeName: 'Raseel Muhammad',
            holdSteps: [
                { key: 'completion', status: 'In Progress', personName: 'Vishnu Prasad' },
                { key: 'hr', status: 'Not Started', personName: 'Sara Ali', approvalTitle: 'HR Approval' },
            ],
        };
        assert.equal(taskWaitingText(task).text, 'Task pending with Vishnu Prasad, HR Approval with Sara Ali');
        assert.equal(taskWaitingText({ ...task, displayStatus: 'Completed' }), null);
    });

    it('stays hidden once the task is finished', () => {
        const steps = [{ key: 'reassigned', status: 'In Progress', personName: 'Raseel Muhammad', personId: 'a1' }];
        assert.equal(pendingHold({ status: 'Completed', steps }), null);
        assert.equal(pendingHold({ status: 'Closed', steps }), null);
        assert.equal(pendingHold({ status: 'Cancelled', steps }), null);
        assert.equal(pendingHold({ status: 'Rejected', steps }), null);
        assert.equal(pendingHold({ status: 'Pending', steps, finished: true }), null);
        assert.equal(pendingHold({ status: 'Pending', steps: null }), null);
    });
});
