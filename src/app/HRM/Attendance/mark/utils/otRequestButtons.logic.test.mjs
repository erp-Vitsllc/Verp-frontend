import assert from 'node:assert/strict';
import test from 'node:test';
import { otActionState } from './otRequestButtons.logic.mjs';

const jishnu = {
    date: '2026-10-15',
    rawTimeIn: '08:14:35',
    rawTimeOut: '03:46:03',
    timeOutDate: '2026-10-16',
    flexibleOtHours: 0,
    flexibleOtStatus: '',
    flexibleRequiredHours: 10,
    punchMappedFromEmployeeMongoId: 'someone-else',
};

test('a next-day 19 hour punch keeps Apply OT and next day present until overtime is added', () => {
    const state = otActionState({
        mark: jishnu,
        durationHours: 19 + 31 / 60,
        requiredHours: 10,
        checkoutNextDay: true,
    });
    assert.equal(state.otText, '');
    assert.ok(state.otHours >= 9);
    assert.equal(state.showOtRequest, true);
    assert.equal(state.showNextDayPresent, true);
});

test('a rejection puts both buttons back', () => {
    const state = otActionState({
        mark: { ...jishnu, flexibleOtStatus: 'rejected', flexibleOtHours: 0, flexibleOtApprovedHours: 0 },
        durationHours: 19.52,
        requiredHours: 10,
        checkoutNextDay: true,
    });
    assert.equal(state.showOtRequest, true);
    assert.equal(state.showNextDayPresent, true);
});

test('added overtime replaces the buttons', () => {
    const state = otActionState({
        mark: {
            ...jishnu,
            flexibleOtStatus: 'approved',
            flexibleOtApprovedHours: 9,
            flexibleOtHours: 9.53,
        },
        durationHours: 19.52,
        requiredHours: 10,
        checkoutNextDay: true,
    });
    assert.equal(state.otText, 'OT: 9 hr');
    assert.equal(state.showOtRequest, false);
    assert.equal(state.showNextDayPresent, false);
});

test('a same-day hour of overtime shows Apply OT only', () => {
    const state = otActionState({
        mark: { flexibleOtHours: 0, flexibleOtStatus: '', flexibleRequiredHours: 10 },
        durationHours: 11.05,
        requiredHours: 10,
    });
    assert.equal(state.showOtRequest, true);
    assert.equal(state.showNextDayPresent, false);
});

test('an 11 hour night shift shows overtime only', () => {
    const state = otActionState({
        mark: {
            flexibleOtHours: 0,
            flexibleOtStatus: '',
            flexibleRequiredHours: 10,
            rawTimeIn: '20:47:19',
            rawTimeOut: '08:38:45',
            timeOutDate: '2026-10-07',
            date: '2026-10-06',
        },
        durationHours: 11 + 51 / 60,
        requiredHours: 10,
    });
    assert.equal(state.showOtRequest, true);
    assert.equal(state.showNextDayPresent, false);
});

test('less than one hour past the required day has no button', () => {
    const state = otActionState({
        mark: { flexibleOtHours: 0, flexibleOtStatus: '' },
        durationHours: 10.92,
        requiredHours: 10,
    });
    assert.equal(state.showOtRequest, false);
    assert.equal(state.showNextDayPresent, false);
});
