import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scheduledTotalWorkedDays } from './salaryHistoricalCalculations.js';

describe('scheduledTotalWorkedDays', () => {
    it('takes leave off the scheduled working days, not off days already marked present', () => {
        assert.equal(
            scheduledTotalWorkedDays({
                scheduledWorkingDays: 25,
                leaveTaken: 15,
                compOffDays: 0,
                overtimeDays: 0,
            }),
            10,
        );
    });

    it('lets comp off and overtime days reduce the leave before that subtraction', () => {
        assert.equal(
            scheduledTotalWorkedDays({
                scheduledWorkingDays: 25,
                leaveTaken: 15,
                compOffDays: 2,
                overtimeDays: 1,
            }),
            13,
        );
    });
});
