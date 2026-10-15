import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { employeePendingRequests } from './pendingCalendarDays.js';

describe('employeePendingRequests', () => {
    it('blinks every day of an open leave and the day of an hour request', () => {
        const map = employeePendingRequests({
            monthKey: '2026-10',
            employeeName: 'Raseel Muhammad',
            pending: [
                {
                    title: 'Annual leave request',
                    appliedKey: 'on_leave',
                    owner: 'Sara Manager',
                    fromDate: '2026-10-09',
                    toDate: '2026-10-11',
                    spanAllMonths: true,
                },
                {
                    title: 'Hour Approval Request',
                    appliedKey: 'hour_adjust',
                    owner: 'Nesmi HR',
                    fromDate: '2026-10-10',
                    toDate: '2026-10-10',
                },
                {
                    title: 'Utility bill clarification',
                    appliedKey: 'utility',
                },
            ],
            records: [
                { date: '2026-10-10', leaveRequestStatus: 'pending', requestedStatusKey: 'on_leave' },
                { date: '2026-10-12', leaveRequestStatus: 'approved', requestedStatusKey: 'sick_leave' },
            ],
        });

        assert.deepEqual(
            map.get('2026-10-09').map((line) => line.label),
            ['Annual leave request'],
        );
        assert.equal(map.get('2026-10-09')[0].pendingWith, 'Sara Manager');
        assert.deepEqual(
            map.get('2026-10-10').map((line) => `${line.label}|${line.pendingWith}`),
            ['Annual leave request|Sara Manager', 'Hour Approval Request|Nesmi HR'],
        );
        assert.equal(map.get('2026-10-11')[0].requestedBy, 'Raseel Muhammad');
        assert.equal(map.has('2026-10-12'), false);
        assert.equal(map.has('2026-10-01'), false);
    });

    it('keeps a leave that crosses into the visible month on the days inside that month', () => {
        const map = employeePendingRequests({
            monthKey: '2026-10',
            employeeName: 'Raseel Muhammad',
            pending: [
                {
                    title: 'Sick leave request',
                    appliedKey: 'sick_leave',
                    owner: 'Sara Manager',
                    fromDate: '2026-09-30',
                    toDate: '2026-10-02',
                },
            ],
            records: [],
        });

        assert.deepEqual([...map.keys()], ['2026-10-01', '2026-10-02']);
    });

    it('uses the attendance day when the profile list has not arrived yet', () => {
        const map = employeePendingRequests({
            monthKey: '2026-10',
            employeeName: 'Raseel Muhammad',
            pending: [],
            records: [
                { date: '2026-10-08', leaveRequestStatus: 'pending', leaveRequestKind: 'future_early' },
                { date: '2026-10-14', flexibleOtStatus: 'pending' },
                { date: '2026-11-01', hourAdjustStatus: 'pending' },
            ],
        });

        assert.equal(map.get('2026-10-08')[0].label, 'Early out request');
        assert.equal(map.get('2026-10-14')[0].label, 'Overtime request');
        assert.equal(map.has('2026-11-01'), false);
    });
});
