import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { overallWorkedDays, overtimeHoursToDays, scheduledTotalWorkedDays } from './salaryHistoricalCalculations.js';

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

    it('adds comp off work days and does not turn overtime hours into extra days', () => {
        assert.equal(
            scheduledTotalWorkedDays({
                scheduledWorkingDays: 25,
                leaveTaken: 0,
                compOffDays: 4,
            }),
            29,
        );
        assert.equal(
            scheduledTotalWorkedDays({
                scheduledWorkingDays: 25,
                leaveTaken: 15,
                compOffDays: 2,
            }),
            12,
        );
    });

    it('adds overtime only in full 10-hour days on top of total worked days', () => {
        assert.equal(overtimeHoursToDays(10), 1);
        assert.equal(overtimeHoursToDays(20), 2);
        assert.equal(overtimeHoursToDays(27), 2);
        assert.equal(
            overallWorkedDays({
                scheduledWorkingDays: 25,
                leaveTaken: 0,
                compOffDays: 4,
                overtimeDays: overtimeHoursToDays(15),
            }),
            30,
        );
        assert.equal(
            overallWorkedDays({
                scheduledWorkingDays: 25,
                leaveTaken: 0,
                compOffDays: 4,
                overtimeDays: overtimeHoursToDays(27),
            }),
            31,
        );
    });
});
