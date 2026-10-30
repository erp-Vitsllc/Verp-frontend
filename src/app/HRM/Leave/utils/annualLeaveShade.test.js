import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnualLeaveShade, describeAnnualLeaveRange } from './annualLeaveShade.js';

const calendar = {
    minimumDays: 5,
    remainingDays: 12,
    openSpans: [{ from: '2027-07-16', to: '2027-07-31' }],
    yellowSpans: [{ from: '2027-07-22', to: '2027-07-24' }],
    ownLeaveDates: ['2027-07-20'],
    cappedDates: [],
};

test('open days are green, nearby leave is yellow, and closed days are grey', () => {
    const shade = buildAnnualLeaveShade(calendar);
    const day = (iso) => {
        const [year, month, date] = iso.split('-').map(Number);
        return new Date(year, month - 1, date);
    };
    assert.equal(shade.modifiers.leaveGreen(day('2027-07-18')), true);
    assert.equal(shade.modifiers.leaveYellow(day('2027-07-22')), true);
    assert.equal(shade.modifiers.leaveYellow(day('2027-07-20')), true);
    assert.equal(shade.modifiers.leaveGrey(day('2027-07-01')), true);
    assert.equal(shade.disableDate(day('2027-07-18')), false);
    assert.equal(shade.disableDate(day('2027-07-01')), true);
    assert.equal(shade.disableDate(day('2027-07-20')), true);
});

test('a range on an existing leave day is rejected the same way as apply', () => {
    assert.match(
        describeAnnualLeaveRange({ calendar, from: '2027-07-18', to: '2027-07-21' }),
        /already have leave on 20 July 2027/,
    );
    assert.equal(describeAnnualLeaveRange({ calendar, from: '2027-07-16', to: '2027-07-18' }), '');
});
