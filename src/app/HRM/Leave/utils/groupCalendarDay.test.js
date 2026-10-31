import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attendanceCellTag, groupCalendarDayKind } from './groupCalendarDay.js';

describe('groupCalendarDayKind', () => {
    it('uses the attendance status before the weekday', () => {
        assert.equal(groupCalendarDayKind('on_office'), 'present');
        assert.equal(groupCalendarDayKind('late_arrived'), 'attention');
        assert.equal(groupCalendarDayKind('sick_leave', { isHoliday: true }), 'sick');
        assert.equal(groupCalendarDayKind('on_leave'), 'annual');
        assert.equal(groupCalendarDayKind('authorized_leave'), 'authorized');
        assert.equal(groupCalendarDayKind('compoff_leave'), 'compoff');
        assert.equal(groupCalendarDayKind('unauthorized_leave'), 'absent');
        assert.equal(groupCalendarDayKind('not_marked'), 'absent');
    });

    it('keeps an approved future leave and hides unauthorized or pending future days', () => {
        assert.equal(groupCalendarDayKind('authorized_leave', { isFuture: true }), 'authorized');
        assert.equal(groupCalendarDayKind('sick_leave', { isFuture: true }), 'sick');
        assert.equal(groupCalendarDayKind('on_leave', { isFuture: true }), 'annual');
        assert.equal(groupCalendarDayKind('unauthorized_leave', { isFuture: true }), 'future');
        assert.equal(groupCalendarDayKind('not_marked', { isFuture: true }), 'future');
        assert.equal(groupCalendarDayKind('unauthorized_leave', { isToday: true }), 'absent');
    });

    it('keeps days before the employee starts blank', () => {
        assert.equal(groupCalendarDayKind('', { beforeStart: true, isHoliday: true }), 'empty');
    });

    it('marks a past empty day absent and today or a holiday on their own', () => {
        assert.equal(groupCalendarDayKind('', { isHoliday: true }), 'holiday');
        assert.equal(groupCalendarDayKind('', { isWeeklyOff: true }), 'weekend');
        assert.equal(groupCalendarDayKind('', { isToday: true }), 'future');
        assert.equal(groupCalendarDayKind('', { isFuture: true }), 'future');
        assert.equal(groupCalendarDayKind(''), 'absent');
    });
});

describe('attendanceCellTag', () => {
    it('shows OT for approved overtime that stays overtime', () => {
        assert.equal(attendanceCellTag({
            statusKey: 'on_office',
            timeIn: '08:00',
            timeOut: '19:00',
            flexibleOtStatus: 'approved',
            flexibleOtApprovedHours: 2,
        }), 'OT');
        assert.equal(attendanceCellTag(
            { statusKey: 'on_office', timeIn: '08:00', timeOut: '18:00' },
            { otHours: 1.5, givenTo: '', takenFrom: '' },
        ), 'OT');
    });

    it('shows COMPOFF when that overtime was marked on the next day', () => {
        assert.equal(attendanceCellTag({
            statusKey: 'on_office',
            timeIn: '08:00',
            timeOut: '19:00',
            flexibleOtStatus: 'approved',
            flexibleOtApprovedHours: 2,
            flexibleOtNextDayDate: '2026-10-10',
        }), 'COMPOFF');
        assert.equal(attendanceCellTag(
            { statusKey: 'on_office', timeIn: '08:00', timeOut: '19:00', flexibleOtStatus: 'approved', flexibleOtApprovedHours: 2 },
            { otHours: 0, givenTo: '2026-10-10', takenFrom: '' },
        ), 'COMPOFF');
    });

    it('shows COMPOFF on a comp-off day or the next-day attendance mark', () => {
        assert.equal(attendanceCellTag({
            statusKey: 'on_office',
            timeIn: 'OT',
            timeOut: 'OT',
            flexibleFromOtDate: '2026-10-09',
        }), 'COMPOFF');
        assert.equal(attendanceCellTag({ statusKey: 'compoff_leave' }), 'COMPOFF');
        assert.equal(attendanceCellTag(
            { statusKey: 'on_office', timeIn: '09:00', timeOut: '18:00' },
            { otHours: 0, givenTo: '', takenFrom: '2026-10-09' },
        ), 'COMPOFF');
    });

    it('leaves a normal day blank', () => {
        assert.equal(attendanceCellTag({ statusKey: 'on_office', timeIn: '08:00', timeOut: '17:00' }), '');
        assert.equal(attendanceCellTag(null), '');
    });
});
