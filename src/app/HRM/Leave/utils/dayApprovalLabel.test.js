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

    it('keeps a late punch not approved when another flag is approved', () => {
        assert.equal(
            dayApprovalLabel({
                statusKey: 'late_arrived',
                approvalStatus: 'approved',
                flexibleOtStatus: 'approved',
                hourAdjustStatus: '',
                leaveRequestStatus: '',
            }),
            'Not approved',
        );
    });

    it('keeps a late punch not approved while its request is still open', () => {
        assert.equal(
            dayApprovalLabel({
                statusKey: 'late_arrived',
                approvalStatus: 'approved',
                leaveRequestStatus: 'pending',
                hourAdjustStatus: '',
            }),
            'Not approved',
        );
    });

    it('shows a late punch as approved only after the hour decision', () => {
        assert.equal(
            dayApprovalLabel({
                statusKey: 'late_arrived',
                hourAdjustStatus: 'approved',
                approvalStatus: 'pending',
            }),
            'Approved',
        );
    });
});
