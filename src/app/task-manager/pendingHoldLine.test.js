import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { completionApprovalStatus, pendingHold, taskWaitingText } from './pendingHoldLine.js';

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
        assert.equal(hold.text, 'Pending with Raseel M, Vishnu P');
    });

    it('uses the approval role when the current holder is that approver', () => {
        const hold = pendingHold({
            status: 'Pending',
            steps: [
                { key: 'assigned', status: 'Completed', personName: 'Raseel Muhammad', personId: 'a1' },
                { key: 'admin', status: 'In Progress', personName: 'Vishnu Prasad', personId: 'a2', approvalTitle: 'Admin Approval' },
            ],
        });
        assert.equal(hold.text, 'Pending with Vishnu P');
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
        assert.equal(hold.text, 'Pending with Vishnu P');
    });

    it('names HR and reportee approvals', () => {
        assert.equal(pendingHold({
            status: 'Pending Due',
            steps: [{ key: 'hr', status: 'In Progress', personName: 'Sara Ali', personId: 'h1' }],
        }).text, 'Pending with Sara A');
        assert.equal(pendingHold({
            status: 'Open',
            steps: [{ key: 'reportee', status: 'In Progress', personName: 'Ali Khan', personId: 'r1' }],
        }).text, 'Pending with Ali K');
    });

    it('falls back to the assignee when the workflow has no named step', () => {
        const hold = pendingHold({
            status: 'Pending Review',
            steps: [],
            assigneeName: 'Raseel Muhammad',
        });
        assert.equal(hold.text, 'Pending with Raseel M');
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
        assert.equal(hold.text, 'Pending with Ali K, Sara A');
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
        assert.equal(taskWaitingText(task).text, 'Pending with Vishnu P, Sara A');
        assert.equal(taskWaitingText({ ...task, displayStatus: 'Completed' }), null);
    });

    it('names the requester when the assignee is gone or the requester still has to approve', () => {
        assert.equal(taskWaitingText({
            displayStatus: 'Pending',
            assigneeName: '',
            mainAssigneeName: '—',
            requesterName: 'Raj Angadembe',
        }).text, 'Waiting for Raj A');
        assert.equal(taskWaitingText({
            displayStatus: 'Pending Review',
            reviewPending: true,
            assigneeName: 'Raseel Muhammad',
            requesterBaseName: 'Farsana Ashraf',
            holdSteps: [{ key: 'assigned', status: 'In Progress', personName: 'Raseel Muhammad' }],
        }).text, 'Waiting for Farsana A');
        assert.equal(taskWaitingText({
            displayStatus: 'Pending',
            taskCategory: 'General Task',
            reviewAccepted: true,
            assigneeName: 'SHAMEEM ABDUL KAREEM',
            requesterName: 'Raseel Muhammad',
            holdSteps: [{ key: 'assigned', status: 'In Progress', personName: 'SHAMEEM ABDUL KAREEM' }],
        }).text, 'Pending with Raseel M');
    });

    it('shows a completed line in green for the requester and a waiting line for everyone else', () => {
        const review = {
            displayStatus: 'Pending Review',
            reviewPending: true,
            assigneeName: 'Raseel Muhammad',
            requesterName: 'Farsana Ashraf',
        };
        assert.deepEqual(completionApprovalStatus(review, true), {
            tone: 'completed',
            text: 'Completed, waiting for Farsana A',
        });
        assert.deepEqual(completionApprovalStatus(review, false), {
            tone: 'waiting',
            text: 'Waiting for Farsana A',
        });
        const handedBack = {
            displayStatus: 'Pending',
            completionPending: true,
            originalAssigneeName: 'Vishnu Prasad',
            reassignedAssigneeName: 'Raseel Muhammad',
            requesterName: 'Raj Angadembe',
        };
        assert.equal(completionApprovalStatus(handedBack, true).text, 'Completed, waiting for Vishnu P');
        assert.equal(completionApprovalStatus(handedBack, true).tone, 'completed');
        assert.equal(completionApprovalStatus(handedBack, false).text, 'Waiting for Vishnu P');
        assert.equal(completionApprovalStatus(handedBack, false).tone, 'waiting');
        assert.equal(completionApprovalStatus({ ...review, displayStatus: 'Completed', status: 'Completed' }, true), null);
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
