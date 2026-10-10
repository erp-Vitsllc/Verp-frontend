import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildMonthAdditionChoices,
    buildMonthWorkWeeks,
    buildWeeklySalaryAddition,
    defaultWorkWeekIndex,
    formatHourMeasure,
} from './weeklySalaryAddition.js';

const DAILY = 1000;

function dayInfoFor(countTo, { offSaturday = false, holidays = [], join = '2026-10-01' } = {}) {
    const holidaySet = new Set(holidays);
    return (date) => {
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        const holiday = holidaySet.has(date);
        const weeklyOff = !holiday && (weekday === 0 || (offSaturday && weekday === 6));
        const required = date >= join && date <= countTo && date.startsWith('2026-10') && !holiday && !weeklyOff;
        return {
            required,
            scheduledHours: required ? 8 : 0,
            weeklyOff,
            holiday,
        };
    };
}

function report(week, records, options = {}) {
    const countTo = options.countTo || '2026-10-31';
    return buildWeeklySalaryAddition({
        monthKey: '2026-10',
        countTo,
        joinKey: options.join || '2026-10-01',
        records,
        daily: DAILY,
        flexible: options.flexible !== false,
        weekDates: week.dates,
        extraDates: week.extraDates,
        dayInfo: dayInfoFor(countTo, options),
    });
}

function weeksOfOctober() {
    return buildMonthWorkWeeks('2026-10');
}

describe('salary addition weeks', () => {
    it('clips October 2026 to Thursday–Saturday, then Monday–Saturday', () => {
        const weeks = weeksOfOctober();
        assert.deepEqual(weeks.map((week) => [week.index, week.from, week.to]), [
            [1, '2026-10-01', '2026-10-03'],
            [2, '2026-10-05', '2026-10-10'],
            [3, '2026-10-12', '2026-10-17'],
            [4, '2026-10-19', '2026-10-24'],
            [5, '2026-10-26', '2026-10-31'],
        ]);
        assert.deepEqual(weeks[0].extraDates, []);
        assert.deepEqual(weeks[1].extraDates, ['2026-10-04']);
        assert.deepEqual(weeks[2].extraDates, ['2026-10-11']);
    });

    it('ends a month on its last weekday when that day is before Saturday', () => {
        const weeks = buildMonthWorkWeeks('2026-09');
        assert.equal(weeks[0].from, '2026-09-01');
        assert.equal(weeks[0].to, '2026-09-05');
        assert.equal(weeks.at(-1).from, '2026-09-28');
        assert.equal(weeks.at(-1).to, '2026-09-30');
    });

    it('keeps a leading Sunday with the first Monday week without changing the Monday start', () => {
        assert.equal(new Date('2026-02-01T00:00:00Z').getUTCDay(), 0);
        const weeks = buildMonthWorkWeeks('2026-02');
        assert.equal(weeks[0].from, '2026-02-02');
        assert.equal(weeks[0].to, '2026-02-07');
        assert.deepEqual(weeks[0].extraDates, ['2026-02-01']);
        assert.equal(weeks.at(-1).to, '2026-02-28');
    });

    it('offers the 1st through yesterday as All, ahead of the weeks', () => {
        const choices = buildMonthAdditionChoices('2026-10', '2026-10-10');
        assert.equal(choices[0].id, 'all');
        assert.equal(choices[0].from, '2026-10-01');
        assert.equal(choices[0].to, '2026-10-09');
        assert.equal(choices[0].empty, false);
        assert.ok(choices[0].dates.includes('2026-10-01'));
        assert.ok(choices[0].dates.includes('2026-10-09'));
        assert.equal(choices[0].dates.includes('2026-10-04'), false);
        assert.deepEqual(choices[0].extraDates, ['2026-10-04']);
        assert.equal(choices[1].from, '2026-10-01');
        assert.equal(choices.at(-1).to, '2026-10-31');
    });

    it('uses the full month for All once that month is finished', () => {
        const choices = buildMonthAdditionChoices('2026-09', '2026-10-10');
        assert.equal(choices[0].from, '2026-09-01');
        assert.equal(choices[0].to, '2026-09-30');
        assert.equal(choices[0].empty, false);
    });

    it('writes hours and minutes instead of a decimal hour', () => {
        assert.equal(formatHourMeasure(1.75), '1 Hour 45 Minutes');
        assert.equal(formatHourMeasure(1), '1 Hour');
        assert.equal(formatHourMeasure(2), '2 Hours');
        assert.equal(formatHourMeasure(0.5), '30 Minutes');
        assert.equal(formatHourMeasure(0), '0 Hours');
        assert.equal(formatHourMeasure(-1.5), '-1 Hour 30 Minutes');
    });

    it('defaults to the previous Monday–Saturday week', () => {
        const weeks = weeksOfOctober();
        assert.equal(weeks[defaultWorkWeekIndex(weeks, '2026-10-10')].from, '2026-10-01');
        assert.equal(weeks[defaultWorkWeekIndex(weeks, '2026-10-06')].from, '2026-10-01');
        assert.equal(weeks[defaultWorkWeekIndex(weeks, '2026-10-12')].from, '2026-10-05');
        assert.equal(weeks[defaultWorkWeekIndex(weeks, '2026-10-11')].from, '2026-10-05');
        assert.equal(weeks[defaultWorkWeekIndex(weeks, '2026-10-01')].from, '2026-10-01');
        assert.equal(weeks[defaultWorkWeekIndex(weeks, '2026-11-02')].from, '2026-10-26');
    });
});

describe('weekly salary addition counts', () => {
    const weeks = weeksOfOctober();

    it('pays approved overtime that was not adjusted', () => {
        const records = [{
            date: '2026-10-05',
            statusKey: 'on_office',
            timeIn: '08:00',
            timeOut: '12:00',
            flexibleWorkedHours: 4,
            flexibleRequiredHours: 8,
            flexibleOtStatus: 'approved',
            flexibleOtApprovedHours: 4,
        }];
        const result = report(weeks[1], records);
        assert.equal(result.overtime.approved, 4);
        assert.equal(result.overtime.adjusted, 0);
        assert.equal(result.overtime.balance, 4);
        assert.equal(result.overtime.approved - result.overtime.adjusted, result.overtime.balance);
        assert.equal(result.total, 400);
        assert.equal(result.details.find((row) => row.date === '2026-10-05').amount, 400);
        assert.equal(result.details.reduce((sum, row) => sum + row.amount, 0), result.total);
    });

    it('moves next-day overtime into that day and pays one day rate', () => {
        const records = [
            {
                date: '2026-10-05',
                statusKey: 'on_office',
                timeIn: '08:00',
                timeOut: '18:00',
                flexibleWorkedHours: 12,
                flexibleRequiredHours: 10,
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 12,
                flexibleOtNextDayDate: '2026-10-06',
            },
            {
                date: '2026-10-06',
                statusKey: 'on_office',
                timeIn: 'OT',
                timeOut: 'OT',
                flexibleFromOtDate: '2026-10-05',
            },
        ];
        const result = report(weeks[1], records);
        assert.equal(result.overtime.approved, 2);
        assert.equal(result.overtime.adjusted, 0);
        assert.equal(result.overtime.balance, 2);
        assert.equal(result.total, DAILY + 200);
        assert.equal(result.overtime.title, '');
        assert.equal(result.compOff.approved, 1);
        assert.equal(result.compOff.adjusted, 1);
        assert.equal(result.compOff.balance, 0);
        assert.match(result.compOff.title, /06-Oct-2026 adjusted with 05-Oct-2026/);
        assert.equal(result.workingDay.worked, 1);
        assert.equal(result.workingDay.compOffDays, 1);
        assert.match(result.workingDay.compOffTitle, /06-Oct-2026 adjusted with 05-Oct-2026/);
        assert.equal(result.workingHours.title, '');
        assert.equal(result.details.find((row) => row.date === '2026-10-06').amount, DAILY);
        assert.equal(result.details.find((row) => row.date === '2026-10-06').adjustedDays, 1);
        assert.match(result.details.find((row) => row.date === '2026-10-06').calculation, /1 Day × AED 1,000.00/);
        assert.equal(result.details.find((row) => row.date === '2026-10-05').amount, 200);
        assert.equal(result.details.find((row) => row.date === '2026-10-05').adjustedDays, 0);
        assert.match(result.details.find((row) => row.date === '2026-10-05').calculation, /2 Hours × AED 1,000.00 ÷ 10 Hours/);
    });

    it('keeps a next-day payment on the covered week when the overtime was the week before', () => {
        const records = [{
            date: '2026-10-10',
            statusKey: 'on_office',
            timeIn: '08:00',
            timeOut: '18:00',
            flexibleWorkedHours: 10,
            flexibleRequiredHours: 8,
            flexibleOtStatus: 'approved',
            flexibleOtApprovedHours: 9,
            flexibleOtNextDayDate: '2026-10-12',
        }];
        const sourceWeek = report(weeks[1], records);
        const coveredWeek = report(weeks[2], records);
        assert.equal(sourceWeek.overtime.approved, 1);
        assert.equal(sourceWeek.overtime.adjusted, 0);
        assert.equal(sourceWeek.overtime.balance, 1);
        assert.equal(sourceWeek.compOff.approved, 1);
        assert.equal(sourceWeek.compOff.adjusted, 1);
        assert.equal(sourceWeek.compOff.balance, 0);
        assert.equal(coveredWeek.compOff.approved, 0);
        assert.equal(sourceWeek.total, 100);
        assert.equal(coveredWeek.total, DAILY);
        assert.equal(coveredWeek.workingDay.worked, 0);
        assert.equal(coveredWeek.workingDay.compOffDays, 1);
        assert.match(coveredWeek.workingDay.compOffTitle, /12-Oct-2026 adjusted with 10-Oct-2026/);
        assert.equal(sourceWeek.total + coveredWeek.total, DAILY + 100);
    });

    it('reduces the earliest overtime when comp off is adjusted, including across weeks', () => {
        const records = [
            {
                date: '2026-10-05',
                statusKey: 'on_office',
                timeIn: '08:00',
                timeOut: '20:00',
                flexibleWorkedHours: 12,
                flexibleRequiredHours: 8,
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 12,
            },
            {
                date: '2026-10-12',
                statusKey: 'compoff_leave',
                compOff: { state: 'adjusted', chargeMonth: '2026-10', otHoursDeducted: 10 },
            },
        ];
        const otWeek = report(weeks[1], records);
        const compWeek = report(weeks[2], records);
        assert.equal(otWeek.overtime.approved, 12);
        assert.equal(otWeek.overtime.adjusted, 10);
        assert.equal(otWeek.overtime.balance, 2);
        assert.equal(otWeek.total, 200);
        assert.match(otWeek.overtime.title, /05-Oct-2026 adjusted with comp off on 12-Oct-2026 \(10 Hours\)/);
        assert.equal(compWeek.compOff.approved, 1);
        assert.equal(compWeek.compOff.adjusted, 1);
        assert.equal(compWeek.compOff.balance, 0);
        assert.match(compWeek.compOff.title, /12-Oct-2026 adjusted from overtime on 05-Oct-2026 \(10 Hours\)/);
        assert.equal(compWeek.total, 0);
        assert.equal(otWeek.total + compWeek.total, 200);
        assert.equal(compWeek.details.find((row) => row.date === '2026-10-12').adjustedHours, 10);
    });

    it('does not let an open comp off reduce overtime pay', () => {
        const records = [
            {
                date: '2026-10-05',
                statusKey: 'on_office',
                timeIn: '08:00',
                timeOut: '18:00',
                flexibleWorkedHours: 10,
                flexibleRequiredHours: 8,
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 10,
            },
            {
                date: '2026-10-06',
                statusKey: 'compoff_leave',
                compOff: { state: 'open', chargeMonth: '2026-10' },
            },
        ];
        const result = report(weeks[1], records);
        assert.equal(result.overtime.balance, 10);
        assert.equal(result.compOff.approved, 1);
        assert.equal(result.compOff.adjusted, 0);
        assert.equal(result.compOff.balance, 1);
        assert.equal(result.total, DAILY);
    });

    it('covers comp off from overtime in date order and leaves the shortfall visible', () => {
        const records = [
            {
                date: '2026-10-05',
                statusKey: 'on_office',
                timeIn: '08:00',
                timeOut: '18:00',
                flexibleWorkedHours: 10,
                flexibleRequiredHours: 8,
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 10,
            },
            {
                date: '2026-10-06',
                statusKey: 'on_office',
                timeIn: '08:00',
                timeOut: '14:00',
                flexibleWorkedHours: 6,
                flexibleRequiredHours: 8,
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 6,
            },
            {
                date: '2026-10-07',
                statusKey: 'compoff_leave',
                compOff: { state: 'adjusted', chargeMonth: '2026-10', otHoursDeducted: 10 },
            },
            {
                date: '2026-10-08',
                statusKey: 'compoff_leave',
                compOff: { state: 'adjusted', chargeMonth: '2026-10', otHoursDeducted: 10 },
            },
        ];
        const result = report(weeks[1], records);
        assert.equal(result.overtime.approved, 16);
        assert.equal(result.overtime.adjusted, 16);
        assert.equal(result.overtime.balance, 0);
        assert.equal(result.compOff.approved, 2);
        assert.equal(result.compOff.adjusted, 2);
        assert.equal(result.compOff.balance, 0);
        assert.equal(result.total, 0);
        assert.match(result.compOff.title, /08-Oct-2026 adjusted from overtime on 06-Oct-2026 \(6 Hours\)/);
    });

    it('counts present and late days as worked and leaves comp off in the balance', () => {
        const records = [
            { date: '2026-10-05', statusKey: 'on_office', timeIn: '08:00', timeOut: '16:00', flexibleWorkedHours: 8 },
            { date: '2026-10-06', statusKey: 'late_arrived', timeIn: '09:30', timeOut: '16:00', flexibleWorkedHours: 6.5 },
            { date: '2026-10-07', statusKey: 'early_go', timeIn: '08:00', timeOut: '14:00', flexibleWorkedHours: 6 },
            {
                date: '2026-10-08',
                statusKey: 'on_office',
                timeIn: 'OT',
                timeOut: 'OT',
                flexibleFromOtDate: '2026-10-05',
            },
            {
                date: '2026-10-09',
                statusKey: 'compoff_leave',
                compOff: { state: 'open', chargeMonth: '2026-10' },
            },
        ];
        const result = report(weeks[1], records, { countTo: '2026-10-10' });
        assert.equal(result.workingDay.required, 6);
        assert.equal(result.workingDay.worked, 3);
        assert.equal(result.workingDay.balance, 3);
        assert.equal(result.workingDay.compOffDays, 2);
        assert.equal(result.workingDay.title, '');
        assert.match(result.workingDay.compOffTitle, /08-Oct-2026/);
        assert.match(result.workingDay.compOffTitle, /09-Oct-2026 is comp off/);
    });

    it('counts required and worked days only inside the week and through the cutoff', () => {
        const records = [
            { date: '2026-10-05', statusKey: 'on_office', timeIn: '08:00', timeOut: '16:00', flexibleWorkedHours: 8 },
            { date: '2026-10-06', statusKey: 'on_office', timeIn: '08:00', timeOut: '14:00', flexibleWorkedHours: 6 },
            { date: '2026-10-10', statusKey: 'on_office', timeIn: '08:00', timeOut: '16:00', flexibleWorkedHours: 8 },
        ];
        const result = report(weeks[1], records, { countTo: '2026-10-09' });
        assert.equal(result.workingDay.required, 5);
        assert.equal(result.workingDay.worked, 2);
        assert.equal(result.workingDay.balance, 3);
        assert.equal(result.workingHours.required, 40);
        assert.equal(result.workingHours.worked, 14);
        assert.equal(result.workingHours.balance, 26);
        assert.equal(result.workingDay.required - result.workingDay.worked, result.workingDay.balance);
    });

    it('starts required days on the join date inside a partial week', () => {
        const week = weeks[0];
        const result = report(week, [], { join: '2026-10-02', countTo: '2026-10-03' });
        assert.equal(result.workingDay.required, 2);
        assert.equal(result.workingHours.required, 16);
        assert.equal(result.workingDay.balance, 2);
    });

    it('pays a non-flexible weekly off as one day and weekday extra as hours', () => {
        const records = [
            { date: '2026-10-05', statusKey: 'on_office', timeIn: '08:00', timeOut: '18:00' },
            { date: '2026-10-10', statusKey: 'on_office', timeIn: '09:00', timeOut: '15:00' },
        ];
        const result = report(weeks[1], records, { flexible: false, offSaturday: true });
        assert.equal(result.overtime.approved, 8);
        assert.equal(result.overtime.adjusted, 6);
        assert.equal(result.overtime.balance, 2);
        assert.equal(result.total, 200 + DAILY);
        assert.match(result.overtime.title, /10-Oct-2026 worked on a weekly off and counts as one day/);
        assert.equal(result.workingDay.required, 5);
        assert.equal(result.workingHours.worked, 10);
        assert.match(result.workingHours.title, /worked on a weekly off/);
    });

    it('does not pay flexible extra hours until they are approved', () => {
        const records = [{
            date: '2026-10-05',
            statusKey: 'on_office',
            timeIn: '08:00',
            timeOut: '20:00',
            flexibleWorkedHours: 12,
            flexibleRequiredHours: 8,
        }];
        const result = report(weeks[1], records);
        assert.equal(result.overtime.approved, 0);
        assert.equal(result.overtime.balance, 0);
        assert.equal(result.total, 0);
        assert.equal(result.workingHours.required, 48);
        assert.equal(result.workingHours.worked, 12);
        assert.equal(result.workingHours.balance, 36);
    });

    it('ignores comp off charged to another month', () => {
        const records = [
            {
                date: '2026-10-05',
                statusKey: 'on_office',
                timeIn: '08:00',
                timeOut: '18:00',
                flexibleWorkedHours: 10,
                flexibleRequiredHours: 8,
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 10,
            },
            {
                date: '2026-10-06',
                statusKey: 'compoff_leave',
                compOff: { state: 'adjusted', chargeMonth: '2026-11', otHoursDeducted: 10 },
            },
        ];
        const result = report(weeks[1], records);
        assert.equal(result.overtime.balance, 10);
        assert.equal(result.compOff.approved, 0);
        assert.equal(result.total, DAILY);
    });

    it('shows a covered day when the overtime day is outside this month', () => {
        const records = [{
            date: '2026-10-06',
            statusKey: 'on_office',
            timeIn: 'OT',
            timeOut: 'OT',
            flexibleFromOtDate: '2026-09-30',
        }];
        const result = report(weeks[1], records);
        assert.equal(result.total, DAILY);
        assert.equal(result.compOff.approved, 1);
        assert.equal(result.compOff.adjusted, 1);
        assert.equal(result.compOff.balance, 0);
        assert.match(result.compOff.title, /06-Oct-2026 adjusted with 30-Sep-2026/);
        assert.equal(result.workingDay.worked, 0);
        assert.equal(result.workingDay.compOffDays, 1);
        assert.equal(result.details.find((row) => row.date === '2026-10-06').adjustedDays, 1);
        assert.equal(result.details.find((row) => row.date === '2026-10-06').adjustedHours, 0);
        assert.match(result.workingDay.compOffTitle, /06-Oct-2026 adjusted with 30-Sep-2026/);
    });

    it('keeps Sunday overtime with the Monday week that Sunday opens', () => {
        const records = [{
            date: '2026-10-04',
            statusKey: 'on_office',
            timeIn: '09:00',
            timeOut: '12:00',
            flexibleWorkedHours: 3,
            flexibleRequiredHours: 0,
            flexibleOtStatus: 'approved',
            flexibleOtApprovedHours: 3,
        }];
        const result = report(weeks[1], records);
        assert.equal(result.overtime.balance, 3);
        assert.equal(result.total, 300);
        assert.equal(result.details.some((row) => row.date === '2026-10-04'), true);
        assert.equal(result.workingDay.required, 6);
    });
});
