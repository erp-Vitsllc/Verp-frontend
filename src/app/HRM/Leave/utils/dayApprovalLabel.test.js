import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dayApprovalLabel } from './dayApprovalLabel.js';

describe('dayApprovalLabel', () => {
    it('treats a saved sick day as approved when the mark still says pending', () => {
        assert.equal(
            dayApprovalLabel({
                statusKey: 'sick_leave',
                approvalStatus: 'pending',
                leaveRequestStatus: '',
            }),
            'Approved',
        );
    });

    it('keeps an open sick request as not approved', () => {
        assert.equal(
            dayApprovalLabel({
                statusKey: 'not_marked',
                requestedStatusKey: 'sick_leave',
                leaveRequestStatus: 'pending',
                approvalStatus: 'pending',
            }),
            'Not approved',
        );
    });

    it('keeps a sick day not approved while that leave request is still open', () => {
        assert.equal(
            dayApprovalLabel({
                statusKey: 'sick_leave',
                leaveRequestStatus: 'pending',
                approvalStatus: 'pending',
            }),
            'Not approved',
        );
    });

    it('shows an approved leave request as approved', () => {
        assert.equal(
            dayApprovalLabel({
                statusKey: 'sick_leave',
                leaveRequestStatus: 'approved',
                approvalStatus: 'approved',
            }),
            'Approved',
        );
    });
});
