import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mispunchDayAmounts, mispunchPolicyRule } from './mispunchDeduction.js';

const DAILY = 407.41;

describe('missed punch salary deduction', () => {
    it('does not use the unauthorized two-day rate when the policy day is not set', () => {
        const amounts = mispunchDayAmounts(
            [{ date: '2026-10-03' }],
            {
                unauthorizedDeductionDays: 2,
                missedPunchRule: { events: 0, deduct: '' },
            },
            DAILY,
        );
        assert.equal(amounts.get('2026-10-03'), 0);
        assert.equal(mispunchPolicyRule({ missedPunchRule: { events: 0, deduct: '' } }), null);
    });

    it('deducts one day fraction once, not twice the daily rate', () => {
        const full = mispunchDayAmounts(
            [{ date: '2026-10-03' }],
            { missedPunchRule: { events: 0, deduct: 'full' }, unauthorizedDeductionDays: 2 },
            DAILY,
        );
        assert.equal(full.get('2026-10-03'), 407.41);

        const half = mispunchDayAmounts(
            [{ date: '2026-10-03' }],
            { missedPunchRule: { events: 0, deduct: 'half' } },
            DAILY,
        );
        assert.equal(half.get('2026-10-03'), 203.71);
    });

    it('keeps the policy event count free and charges the next missed punch', () => {
        const amounts = mispunchDayAmounts(
            [{ date: '2026-10-03' }, { date: '2026-10-06' }, { date: '2026-10-08' }],
            { missedPunchRule: { events: 1, deduct: 'quarter' } },
            400,
        );
        assert.equal(amounts.get('2026-10-03'), 0);
        assert.equal(amounts.get('2026-10-06'), 100);
        assert.equal(amounts.get('2026-10-08'), 100);
    });

    it('does not charge a missed punch whose loss hours were waived to zero', () => {
        const amounts = mispunchDayAmounts(
            [
                { date: '2026-10-17', hourAdjustStatus: 'approved', hoursApproved: 0 },
                { date: '2026-10-24' },
            ],
            { missedPunchRule: { events: 0, deduct: 'half' } },
            387.1,
        );
        assert.equal(amounts.get('2026-10-17'), undefined);
        assert.equal(amounts.get('2026-10-24'), 193.55);
    });

    it('lets the next missed punch use the free count the waived day no longer takes', () => {
        const amounts = mispunchDayAmounts(
            [
                { date: '2026-10-17', hourAdjustStatus: 'approved', hoursApproved: 0 },
                { date: '2026-10-24' },
            ],
            { missedPunchRule: { events: 1, deduct: 'half' } },
            400,
        );
        assert.equal(amounts.has('2026-10-17'), false);
        assert.equal(amounts.get('2026-10-24'), 0);
    });

    it('starts the free count again each month', () => {
        const amounts = mispunchDayAmounts(
            [{ date: '2026-10-03' }, { date: '2026-11-02' }],
            { missedPunchRule: { events: 1, deduct: 'full' } },
            100,
        );
        assert.equal(amounts.get('2026-10-03'), 0);
        assert.equal(amounts.get('2026-11-02'), 0);
    });
});
