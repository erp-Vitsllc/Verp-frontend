import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    approvalPlacedAsNextDay,
    buildAmountToPayStatement,
    buildMonthAdditionChoices,
    buildMonthWorkWeeks,
    buildWeeklySalaryAddition,
    defaultWorkWeekIndex,
    formatHourMeasure,
    compOffReferenceLinks,
    leaveDatesTakenByOvertime,
} from './weeklySalaryAddition.js';

const DAILY = 1000;

function dayInfoFor(countTo, { offSaturday = false, holidays = [], join = '2026-10-01', scheduledHours = 8 } = {}) {
    const holidaySet = new Set(holidays);
    return (date) => {
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        const holiday = holidaySet.has(date);
        const weeklyOff = !holiday && (weekday === 0 || (offSaturday && weekday === 6));
        const required = date >= join && date <= countTo && date.startsWith('2026-10') && !holiday && !weeklyOff;
        return {
            required,
            scheduledHours: required ? scheduledHours : 0,
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

describe('amount to pay statement', () => {
    it('pays worked days, comp off, overtime, and week offs, and skips cancelled loss hours', () => {
        const statement = buildAmountToPayStatement({
            monthlySalary: 2250,
            calendarDays: 31,
            workedDays: 16,
            compOffDays: 5,
            otHours: 10,
            offDays: 3,
            cancelledLossHours: 7.33,
            authorizedHours: 4,
            unauthorizedHours: 3.33,
            unauthorizedTimes: 2,
        });
        assert.equal(statement.perDay, 72.58);
        assert.equal(statement.earnings.find((row) => row.description === 'Worked Days').amount, 1161.28);
        assert.equal(statement.earnings.find((row) => row.description === 'Comp Off').amount, 362.9);
        assert.equal(statement.earnings.find((row) => row.description === 'Overtime (OT)').amount, 72.58);
        assert.equal(statement.earnings.find((row) => row.description === 'Holiday / Weekly Off').amount, 217.74);
        assert.equal(statement.totalSalary, 1814.5);
        assert.equal(statement.totalDeduction, 77.37);
        assert.equal(statement.actual, 1737.13);
        assert.equal(statement.deductions.find((row) => row.description === 'Loss Hours (Cancelled)').amount, 53.2);
    });
});

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
        assert.deepEqual(result.overtime.views.map((row) => row.date), ['2026-10-05']);
        assert.equal(result.overtime.approved - result.overtime.adjusted, result.overtime.balance);
        assert.equal(result.total, 400);
        assert.equal(result.details.find((row) => row.date === '2026-10-05').amount, 400);
        assert.equal(result.details.reduce((sum, row) => sum + row.amount, 0), result.total);
    });

    it('records a next day on an authorized leave without paying that day', () => {
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
        assert.equal(result.overtime.approved, 0);
        assert.equal(result.overtime.adjusted, 0);
        assert.equal(result.overtime.balance, 0);
        assert.equal(result.total, 0);
        assert.equal(result.overtime.title, '');
        assert.deepEqual(result.overtime.views, []);
        assert.equal(result.compOff.approved, 1);
        assert.equal(result.compOff.adjusted, 1);
        assert.equal(result.compOff.balance, 0);
        assert.deepEqual(result.compOff.views.map((row) => row.date), ['2026-10-06']);
        assert.match(result.compOff.title, /06-Oct-2026 adjusted with 05-Oct-2026/);
        assert.equal(result.workingDay.worked, 1);
        assert.equal(result.workingDay.compOffDays, 1);
        assert.match(result.workingDay.compOffTitle, /06-Oct-2026 adjusted with 05-Oct-2026/);
        assert.match(result.workingHours.title, /06-Oct-2026 adjusted with 05-Oct-2026/);
        assert.equal(result.details.find((row) => row.date === '2026-10-06').amount, 0);
        assert.equal(result.details.find((row) => row.date === '2026-10-06').adjustedDays, 1);
        assert.equal(result.details.find((row) => row.date === '2026-10-06').calculation, '');
        assert.equal(result.details.find((row) => row.date === '2026-10-05').amount, 0);
    });

    it('pays leftover hours only after HR approves that day', () => {
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
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 2,
                _id: 'ot-06',
            },
        ];
        const result = report(weeks[1], records);
        assert.equal(result.overtime.approved, 2);
        assert.equal(result.overtime.adjusted, 0);
        assert.equal(result.overtime.balance, 2);
        assert.deepEqual(result.overtime.views, [{ date: '2026-10-06', attendanceId: 'ot-06' }]);
        assert.equal(result.compOff.approved, 1);
        assert.equal(result.total, 200);
        assert.equal(result.details.find((row) => row.date === '2026-10-06').amount, 200);
    });

    it('keeps the next day on the covered week without paying it again', () => {
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
        assert.equal(sourceWeek.overtime.approved, 0);
        assert.equal(sourceWeek.overtime.adjusted, 0);
        assert.equal(sourceWeek.overtime.balance, 0);
        assert.equal(sourceWeek.compOff.approved, 1);
        assert.equal(sourceWeek.compOff.adjusted, 1);
        assert.equal(sourceWeek.compOff.balance, 0);
        assert.deepEqual(sourceWeek.compOff.views.map((row) => row.date), ['2026-10-12']);
        assert.equal(coveredWeek.compOff.approved, 0);
        assert.equal(sourceWeek.total, 0);
        assert.equal(coveredWeek.total, 0);
        assert.equal(coveredWeek.workingDay.worked, 0);
        assert.equal(coveredWeek.workingDay.compOffDays, 1);
        assert.match(coveredWeek.workingDay.compOffTitle, /12-Oct-2026 adjusted with 10-Oct-2026/);
        assert.equal(sourceWeek.total + coveredWeek.total, 0);
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
        assert.equal(result.workingDay.adjusted, 2);
        assert.equal(result.workingDay.balance, 1);
        assert.equal(result.workingDay.compOffDays, 2);
        assert.equal(result.workingHours.adjusted, 16);
        assert.equal(result.workingDay.title, '');
        assert.match(result.workingDay.compOffTitle, /08-Oct-2026/);
        assert.match(result.workingDay.compOffTitle, /09-Oct-2026 is comp off/);
    });

    it('leaves both leave days in the balance when one of them is comp off', () => {
        const all = buildMonthAdditionChoices('2026-10', '2026-10-10')[0];
        const records = [
            { date: '2026-10-01', statusKey: 'on_office', timeIn: '15:00', timeOut: '01:10' },
            { date: '2026-10-02', statusKey: 'on_office', timeIn: '08:00', timeOut: '18:00' },
            { date: '2026-10-03', statusKey: 'on_office', timeIn: '08:00', timeOut: '18:00' },
            {
                date: '2026-10-05',
                statusKey: 'late_arrived',
                timeIn: '09:00',
                timeOut: '21:00',
                flexibleWorkedHours: 12,
                flexibleRequiredHours: 10,
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 12,
                flexibleOtNextDayDate: '2026-10-06',
            },
            { date: '2026-10-06', statusKey: 'on_office', timeIn: '08:00', timeOut: '18:00' },
            { date: '2026-10-07', statusKey: 'authorized_leave' },
            { date: '2026-10-08', statusKey: 'on_office', timeIn: '10:05', timeOut: '20:18' },
            { date: '2026-10-09', statusKey: 'on_office', timeIn: '08:00', timeOut: '18:00' },
        ];
        const result = report(all, records, { countTo: '2026-10-09' });
        assert.equal(result.workingDay.required, 8);
        assert.equal(result.workingDay.worked, 6);
        assert.equal(result.workingDay.adjusted, 1);
        assert.equal(result.workingDay.balance, 1);
        assert.equal(result.workingDay.compOffDays, 1);
        assert.match(result.workingDay.compOffTitle, /06-Oct-2026 adjusted with 05-Oct-2026/);
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
        assert.equal(result.workingDay.adjusted, 0);
        assert.equal(result.workingDay.balance, 3);
        assert.equal(result.workingHours.required, 40);
        assert.equal(result.workingHours.worked, 14);
        assert.equal(result.workingHours.adjusted, 0);
        assert.equal(result.workingHours.balance, 26);
        assert.equal(result.workingDay.required - result.workingDay.worked - result.workingDay.adjusted, result.workingDay.balance);
    });

    it('starts required days on the join date inside a partial week', () => {
        const week = weeks[0];
        const result = report(week, [], { join: '2026-10-02', countTo: '2026-10-03' });
        assert.equal(result.workingDay.required, 2);
        assert.equal(result.workingHours.required, 16);
        assert.equal(result.workingDay.balance, 2);
    });

    it('pays work on a weekly off as overtime up to 10 hours', () => {
        const records = [
            { date: '2026-10-05', statusKey: 'on_office', timeIn: '08:00', timeOut: '18:00' },
            { date: '2026-10-10', statusKey: 'on_office', timeIn: '09:00', timeOut: '15:00' },
        ];
        const result = report(weeks[1], records, { flexible: false, offSaturday: true });
        assert.equal(result.overtime.approved, 6);
        assert.equal(result.overtime.balance, 6);
        assert.equal(result.total, 600);
        assert.match(result.overtime.title, /10-Oct-2026 worked on a weekly off and counts as overtime/);
        assert.equal(result.workingDay.required, 5);
        assert.equal(result.workingHours.worked, 8);
    });

    it('turns more than 10 hours on a holiday into comp off instead of overtime pay', () => {
        const records = [
            { date: '2026-10-11', statusKey: 'on_office', timeIn: '08:00', timeOut: '20:00' },
        ];
        const result = report(weeks[2], records, { flexible: false, holidays: ['2026-10-11'] });
        assert.equal(result.overtime.balance, 0);
        assert.equal(result.total, 0);
        assert.equal(result.compOff.approved, 1);
        assert.match(result.compOff.title, /11-Oct-2026 worked on a holiday for more than 10 hours and counts as comp off/);
    });

    it('keeps approved overtime on a weekly off as the overtime payment', () => {
        const records = [
            {
                date: '2026-10-04',
                statusKey: 'on_office',
                timeIn: '09:00',
                timeOut: '13:00',
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 4,
            },
        ];
        const result = report(weeks[1], records, { flexible: false });
        assert.equal(result.overtime.balance, 4);
        assert.equal(result.total, 400);
        assert.equal(result.compOff.approved, 0);
    });

    it('does not show overtime hours until HR approves them', () => {
        const records = [
            {
                date: '2026-10-05',
                statusKey: 'on_office',
                timeIn: '08:00',
                timeOut: '19:00',
                flexibleOtHours: 1,
                flexibleOtStatus: '',
                flexibleOtApprovedHours: 1,
            },
            {
                date: '2026-10-06',
                statusKey: 'on_office',
                timeIn: '08:00',
                timeOut: '19:00',
                flexibleOtHours: 1,
                flexibleOtStatus: 'pending',
                flexibleOtApprovedHours: 1,
            },
        ];
        const result = report(weeks[1], records, { flexible: false });
        assert.equal(result.overtime.approved, 0);
        assert.equal(result.overtime.balance, 0);
        assert.equal(result.total, 0);
        assert.deepEqual(result.overtime.views, []);
    });

    it('does not pay weekday extra hours until HR approves them', () => {
        const records = [{
            date: '2026-10-05',
            statusKey: 'on_office',
            timeIn: '08:00',
            timeOut: '21:04',
            flexibleWorkedHours: 13.07,
            flexibleRequiredHours: 0,
        }];
        const result = report(weeks[1], records, { flexible: false });
        assert.equal(result.overtime.approved, 0);
        assert.equal(result.overtime.balance, 0);
        assert.equal(result.total, 0);
        assert.deepEqual(result.overtime.views, []);
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
        assert.equal(result.workingHours.worked, 8);
        assert.equal(result.workingHours.balance, 40);
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
        assert.equal(result.total, 0);
        assert.equal(result.compOff.approved, 1);
        assert.equal(result.compOff.adjusted, 1);
        assert.equal(result.compOff.balance, 0);
        assert.deepEqual(result.compOff.views.map((row) => row.date), ['2026-10-06']);
        assert.match(result.compOff.title, /06-Oct-2026 adjusted with 30-Sep-2026/);
        assert.equal(result.workingDay.worked, 0);
        assert.equal(result.workingDay.compOffDays, 1);
        assert.equal(result.details.find((row) => row.date === '2026-10-06').adjustedDays, 1);
        assert.equal(result.details.find((row) => row.date === '2026-10-06').adjustedHours, 0);
        assert.match(result.workingDay.compOffTitle, /06-Oct-2026 adjusted with 30-Sep-2026/);
    });

    it('keeps a short day at the hours worked and stops a long day at 10 hours', () => {
        const records = [
            { date: '2026-10-05', statusKey: 'on_office', timeIn: '08:00', timeOut: '22:00' },
            { date: '2026-10-06', statusKey: 'on_office', timeIn: '08:00', timeOut: '15:00' },
        ];
        const result = report(weeks[1], records, { scheduledHours: 12, countTo: '2026-10-10' });
        assert.equal(result.workingHours.required, 60);
        assert.equal(result.workingHours.worked, 17);
        assert.equal(result.workingHours.adjusted, 0);
        assert.equal(result.workingHours.balance, 43);
    });

    it('counts an unapproved late arrival as a worked day, not unauthorized leave', () => {
        const records = [
            {
                date: '2026-10-09',
                statusKey: 'unauthorized_leave',
                statusLabel: 'Unauthorized Leave',
                reason: 'No punch-in or punch-out (auto at midnight)',
            },
            {
                date: '2026-10-10',
                statusKey: 'unauthorized_leave',
                statusLabel: 'Unauthorized Quarter Day (AM)',
                leaveRequestSession: 'am',
                leaveRequestDayPart: 'quarter',
                timeIn: '11:30',
                timeOut: '21:19',
                reason: 'Unauthorized Quarter Day taken without an approved request',
            },
        ];
        const result = report(weeks[1], records, { flexible: false, countTo: '2026-10-10' });
        assert.equal(result.workingDay.worked, 1);
    });

    it('lists only approved overtime and approved comp off', () => {
        const records = [
            { date: '2026-10-05', statusKey: 'on_office', timeIn: '08:00', timeOut: '16:00', flexibleWorkedHours: 8 },
            {
                date: '2026-10-06',
                statusKey: 'on_office',
                timeIn: '08:00',
                timeOut: '18:00',
                flexibleWorkedHours: 10,
                flexibleRequiredHours: 8,
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 2,
            },
            {
                date: '2026-10-07',
                statusKey: 'on_office',
                timeIn: '08:00',
                timeOut: '19:00',
                flexibleOtStatus: 'pending',
                flexibleOtApprovedHours: 1,
            },
            {
                date: '2026-10-08',
                statusKey: 'compoff_leave',
                compOff: { state: 'open', chargeMonth: '2026-10' },
            },
        ];
        const result = report(weeks[1], records, { countTo: '2026-10-10' });
        assert.deepEqual(result.details.map((row) => row.date), ['2026-10-06', '2026-10-08']);
        assert.equal(result.details.reduce((sum, row) => sum + row.amount, 0), result.total);
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

    it('pays the hour gap after approved overtime and next-day comp off', () => {
        const dates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13'];
        const present = (date, extra = {}) => ({
            date,
            statusKey: 'on_office',
            timeIn: '08:00',
            timeOut: '18:00',
            ...extra,
        });
        const result = buildWeeklySalaryAddition({
            monthKey: '2026-10',
            countTo: '2026-10-13',
            joinKey: '2026-10-01',
            records: [
                present('2026-10-05', { flexibleOtStatus: 'approved', flexibleOtApprovedHours: 4 }),
                present('2026-10-06'),
                present('2026-10-07'),
                {
                    date: '2026-10-08',
                    statusKey: 'on_office',
                    timeIn: 'OT',
                    timeOut: 'OT',
                    flexibleFromOtDate: '2026-09-28',
                },
                {
                    date: '2026-10-09',
                    statusKey: 'on_office',
                    timeIn: 'OT',
                    timeOut: 'OT',
                    flexibleFromOtDate: '2026-09-29',
                },
            ],
            daily: 200,
            flexible: true,
            weekDates: dates,
            extraDates: [],
            dayInfo: dayInfoFor('2026-10-13', { scheduledHours: 10 }),
            monthlySalary: 4000,
            monthWorkingDays: 20,
        });
        const pay = result.balancePay;
        assert.equal(pay.requiredDays, 7);
        assert.equal(pay.requiredHours, 70);
        assert.equal(pay.workedDays, 3);
        assert.equal(pay.workedHours, 30);
        assert.equal(pay.otHours, 4);
        assert.equal(pay.compOffDays, 2);
        assert.equal(pay.compOffHours, 20);
        assert.equal(pay.creditedHours, 54);
        assert.equal(pay.gapHours, 16);
        assert.equal(pay.amount, -320);
        assert.equal(result.calendar['2026-10-05'].otHours, 4);
        assert.equal(result.calendar['2026-10-08'].takenFrom, '2026-09-28');
        assert.match(pay.compOffRows.find((row) => row.date === '2026-10-08').text, /taken from 28-Sep-2026/);
        assert.match(pay.compOffRows.find((row) => row.date === '2026-09-28').text, /given to 08-Oct-2026/);
    });
});

describe('approvalPlacedAsNextDay', () => {
    it('treats a next-day present approval as comp off, not overtime', () => {
        const row = {
            date: '2026-10-09',
            statusKey: 'on_office',
            timeIn: '08:03',
            timeOut: '07:18',
            flexibleOtStatus: 'approved',
            flexibleOtApprovedHours: 10,
            flexibleOtNextDayDate: '2026-10-10',
        };
        const taken = leaveDatesTakenByOvertime([
            row,
            {
                date: '2026-10-10',
                statusKey: 'on_office',
                timeIn: 'OT',
                timeOut: 'OT',
                flexibleFromOtDate: '2026-10-09',
            },
        ], '2026-10');
        assert.equal(approvalPlacedAsNextDay(row, taken.get('2026-10-09')), true);
    });

    it('keeps overtime that was partly used to settle a comp off', () => {
        const row = {
            date: '2026-10-05',
            flexibleOtApprovedHours: 16,
        };
        const taken = leaveDatesTakenByOvertime([
            {
                ...row,
                statusKey: 'on_office',
                timeIn: '08:00',
                timeOut: '20:00',
                flexibleOtStatus: 'approved',
            },
            {
                date: '2026-10-08',
                statusKey: 'compoff_leave',
                compOff: { state: 'adjusted', chargeMonth: '2026-10', otHoursDeducted: 10 },
            },
        ], '2026-10');
        assert.equal(approvalPlacedAsNextDay(row, taken.get('2026-10-05')), false);
    });
});

describe('leaveDatesTakenByOvertime', () => {
    it('uses the leave day that was taken, not the overtime day', () => {
        const taken = leaveDatesTakenByOvertime([
            {
                date: '2026-10-10',
                statusKey: 'on_office',
                timeIn: '08:03',
                timeOut: '07:18',
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 10,
                flexibleOtNextDayDate: '2026-10-12',
            },
            {
                date: '2026-10-12',
                statusKey: 'on_office',
                timeIn: 'OT',
                timeOut: 'OT',
                flexibleFromOtDate: '2026-10-10',
            },
        ], '2026-10');
        assert.deepEqual(taken.get('2026-10-10'), [{ date: '2026-10-12', hours: 0 }]);
    });

    it('gives settled comp off the earliest overtime, and leaves the rest on the overtime day', () => {
        const taken = leaveDatesTakenByOvertime([
            {
                date: '2026-10-05',
                statusKey: 'on_office',
                timeIn: '08:00',
                timeOut: '20:00',
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 16,
            },
            {
                date: '2026-10-08',
                statusKey: 'compoff_leave',
                compOff: { state: 'adjusted', chargeMonth: '2026-10', otHoursDeducted: 10 },
            },
            {
                date: '2026-10-09',
                statusKey: 'compoff_leave',
                compOff: { state: 'adjusted', chargeMonth: '2026-10', otHoursDeducted: 6 },
            },
        ], '2026-10');
        assert.deepEqual(taken.get('2026-10-05'), [
            { date: '2026-10-08', hours: 10 },
            { date: '2026-10-09', hours: 6 },
        ]);
    });
});

describe('compOffReferenceLinks', () => {
    it('lists each comp off day with the overtime date that was approved for it', () => {
        const rows = compOffReferenceLinks([
            {
                date: '2026-10-10',
                statusKey: 'on_office',
                timeIn: '08:03',
                timeOut: '07:18',
                flexibleOtStatus: 'approved',
                flexibleOtApprovedHours: 10,
                flexibleOtNextDayDate: '2026-10-12',
                flexibleOtReason: 'Cover the leave',
            },
            {
                date: '2026-10-12',
                statusKey: 'on_office',
                timeIn: 'OT',
                timeOut: 'OT',
                flexibleFromOtDate: '2026-10-10',
            },
            {
                date: '2026-10-08',
                statusKey: 'compoff_leave',
                reason: 'Family',
                compOff: { state: 'open', chargeMonth: '2026-10' },
            },
            {
                date: '2026-10-15',
                statusKey: 'compoff_leave',
                compOff: { state: 'adjusted', chargeMonth: '2026-11', otHoursDeducted: 10 },
            },
        ], '2026-10');
        assert.deepEqual(rows.map((row) => row.date), ['2026-10-12', '2026-10-08']);
        assert.deepEqual(rows[0].sourceDates, ['2026-10-10']);
        assert.equal(rows[0].description, 'Cover the leave');
        assert.deepEqual(rows[1].sourceDates, []);
    });
});
