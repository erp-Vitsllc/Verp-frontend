import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnualLeaveShade, buildAnnualLeaveValidationLines, describeAnnualLeaveRange } from './annualLeaveShade.js';

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

test('validation lines keep one size and split yellow information from red blocks', () => {
    const future = buildAnnualLeaveValidationLines({
        calendar: {
            minimumDays: 5,
            eligibleOn: '2027-09-24',
            openSpans: [{ from: '2027-09-24', to: '2028-09-23', remainingDays: 30 }],
            remainingDays: 0,
        },
        allowance: { allowedDays: 30, windows: [{ status: 'Inactive', eligibleOn: '2027-09-24', takenDays: 0 }] },
        today: '2026-10-31',
    });
    assert.deepEqual(future.map((line) => line.tone), ['yellow', 'yellow']);
    assert.equal(future[0].text, 'Annual leave opens on 24 September 2027. Days before that stay closed.');
    assert.equal(future[1].text, 'For more info, contact HR.');

    const short = buildAnnualLeaveValidationLines({
        calendar: { minimumDays: 5, openSpans: [], remainingDays: 4 },
        allowance: { allowedDays: 30, windows: [{ status: 'Active', remainingDays: 4 }] },
        today: '2026-10-31',
    });
    assert.equal(short.find((line) => line.code === 'minimum')?.text, 'You need at least 5 days remaining to apply.');
    assert.equal(short.some((line) => line.code === 'opens'), false);

    const nearby = buildAnnualLeaveValidationLines({
        calendar: {
            minimumDays: 5,
            eligibleOn: '2026-01-01',
            openSpans: [{ from: '2026-01-01', to: '2026-12-31', remainingDays: 20 }],
            remainingDays: 20,
        },
        otherLeaves: [{ name: 'Ravi Kumar', dates: ['2027-09-22'] }],
        from: '2027-09-24',
        to: '2027-09-24',
        today: '2026-10-31',
    });
    assert.equal(
        nearby.find((line) => line.code === 'coworker')?.text,
        "You can't go because Ravi Kumar already took leave on that.",
    );
    assert.equal(nearby.some((line) => line.code === 'minimum'), false);

    const clear = buildAnnualLeaveValidationLines({
        calendar: {
            minimumDays: 5,
            eligibleOn: '2026-01-01',
            openSpans: [{ from: '2026-01-01', to: '2026-12-31', remainingDays: 20 }],
            remainingDays: 20,
        },
        otherLeaves: [{ name: 'Ravi Kumar', dates: ['2027-09-22'] }],
        from: '2027-09-25',
        to: '2027-09-25',
        today: '2026-10-31',
    });
    assert.equal(clear.length, 0);
});
