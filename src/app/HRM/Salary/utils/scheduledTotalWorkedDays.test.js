import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { overallWorkedDays, overtimeHoursToDays, scheduledTotalWorkedDays } from './salaryHistoricalCalculations.js';

describe('scheduledTotalWorkedDays', () => {
    it('takes leave off days marked present, then adds comp off work days', () => {
        assert.equal(
            scheduledTotalWorkedDays({
                workedDays: 21,
                leaveTaken: 15,
                compOffDays: 0,
            }),
            6,
        );
        assert.equal(
            scheduledTotalWorkedDays({
                workedDays: 21,
                leaveTaken: 0,
                compOffDays: 4,
            }),
            25,
        );
        assert.equal(
            scheduledTotalWorkedDays({
                workedDays: 21,
                leaveTaken: 15,
                compOffDays: 2,
            }),
            8,
        );
    });

    it('adds overtime only in full 10-hour days on top of total worked days', () => {
        assert.equal(overtimeHoursToDays(10), 1);
        assert.equal(overtimeHoursToDays(20), 2);
        assert.equal(overtimeHoursToDays(27), 2);
        assert.equal(
            overallWorkedDays({
                workedDays: 21,
                leaveTaken: 0,
                compOffDays: 4,
                overtimeDays: overtimeHoursToDays(15),
            }),
            26,
        );
        assert.equal(
            overallWorkedDays({
                workedDays: 21,
                leaveTaken: 0,
                compOffDays: 4,
                overtimeDays: overtimeHoursToDays(27),
            }),
            27,
        );
    });
});
