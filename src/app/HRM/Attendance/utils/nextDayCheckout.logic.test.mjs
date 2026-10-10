import test from 'node:test';
import assert from 'node:assert/strict';
import { isNextDayCheckout } from './nextDayCheckout.logic.mjs';

test('overnight punch with a later checkout date is next day', () => {
    assert.equal(
        isNextDayCheckout({
            date: '2026-10-07',
            timeIn: '21:33',
            timeOut: '08:11',
            timeOutDate: '2026-10-08',
        }),
        true,
    );
});

test('overnight punch without a checkout date still wraps past midnight', () => {
    assert.equal(
        isNextDayCheckout({
            date: '2026-10-07',
            timeIn: '21:33:00',
            timeOut: '08:11:00',
        }),
        true,
    );
});

test('same-day checkout stays a normal time', () => {
    assert.equal(
        isNextDayCheckout({
            date: '2026-10-07',
            timeIn: '09:33',
            timeOut: '18:11',
            timeOutDate: '2026-10-07',
        }),
        false,
    );
});

test('missing checkout is not next day', () => {
    assert.equal(
        isNextDayCheckout({
            date: '2026-10-07',
            timeIn: '21:33',
            timeOut: '',
        }),
        false,
    );
});
