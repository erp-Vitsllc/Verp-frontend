import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { requestDateOptions } from './punchRequestDates.js';

const todayKey = '2026-11-02';

describe('punch request dates follow the calendar month', () => {
    it('lists October late arrivals when the calendar is on October', () => {
        const { dates, listMonth } = requestDateOptions({
            todayKey,
            calendarMonth: '2026-10',
            variant: 'late',
            attendanceRecords: [
                { date: '2026-10-06', statusKey: 'late_arrived' },
                { date: '2026-10-20', statusKey: 'late_arrived' },
                { date: '2026-11-02', statusKey: 'late_arrived' },
                { date: '2026-10-08', statusKey: 'early_go' },
            ],
        });
        assert.equal(listMonth, '2026-10');
        assert.deepEqual(dates, ['2026-10-06', '2026-10-20']);
    });

    it('switches early go and mispunch when the calendar month changes', () => {
        const records = [
            { date: '2026-09-03', statusKey: 'early_go' },
            { date: '2026-10-09', statusKey: 'early_go' },
            { date: '2026-09-04', statusKey: 'mispunch' },
            { date: '2026-10-15', statusKey: 'mispunch' },
        ];
        const september = requestDateOptions({
            todayKey,
            calendarMonth: '2026-09',
            variant: 'early',
            attendanceRecords: records,
        });
        const october = requestDateOptions({
            todayKey,
            calendarMonth: '2026-10',
            variant: 'mispunch',
            attendanceRecords: records,
        });
        assert.deepEqual(september.dates, ['2026-09-03']);
        assert.equal(october.dates.includes('2026-10-15'), true);
        assert.equal(october.dates.includes('2026-09-04'), false);
        assert.equal(october.dates.every((day) => day.startsWith('2026-10')), true);
    });

    it('keeps sick leave on the current month', () => {
        const { dates, listMonth } = requestDateOptions({
            todayKey,
            calendarMonth: '2026-10',
            variant: 'sick',
            attendanceRecords: [
                { date: '2026-10-07', statusKey: 'unauthorized_leave' },
                { date: '2026-11-01', statusKey: 'unauthorized_leave' },
            ],
        });
        assert.equal(listMonth, '2026-11');
        assert.deepEqual(dates, ['2026-11-01']);
    });
});
