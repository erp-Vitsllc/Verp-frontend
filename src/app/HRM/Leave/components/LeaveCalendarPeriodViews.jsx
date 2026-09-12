'use client';

import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { X } from 'lucide-react';
import {
    chunkWeeks,
    formatDateKey,
    isValidDateKey,
    leaveMetaForStatus,
    nextDateKey,
} from '../utils/leaveCalendarUtils';

export const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function buildCalendarDays(monthDate) {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function parseLocalDateKey(dateKey) {
    if (!isValidDateKey(dateKey)) return null;
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function formatDateDisplay(dateKey) {
    const date = parseLocalDateKey(dateKey);
    return date ? format(date, 'dd MMM yyyy') : '—';
}

export function leaveTypeLabel(statusKey, isPending = false) {
    const meta = leaveMetaForStatus(statusKey, false, Boolean(isPending));
    return meta.label || 'Leave';
}

export function spansTouchingDate(spans, dateKey) {
    if (!isValidDateKey(dateKey)) return [];
    return (spans || []).filter((span) => {
        if (span?.isDraft) return false;
        const start = String(span?.start || '').trim();
        const end = String(span?.end || span?.start || '').trim();
        return isValidDateKey(start) && isValidDateKey(end) && dateKey >= start && dateKey <= end;
    });
}

export function dateKeysFromSpans(spans) {
    const set = new Set();
    for (const span of spans || []) {
        const start = String(span?.start || '').trim();
        const end = String(span?.end || span?.start || '').trim();
        if (!isValidDateKey(start) || !isValidDateKey(end)) continue;
        for (let cursor = start; cursor <= end; cursor = nextDateKey(cursor)) {
            set.add(cursor);
        }
    }
    return set;
}

function LeaveRecordRow({ span }) {
    const meta = leaveMetaForStatus(span.statusKey, false, Boolean(span.isPending));
    return (
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 sm:grid-cols-4">
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Employee</p>
                <p className="mt-0.5 text-sm font-semibold text-[#111827]">{span.employeeName || 'Employee'}</p>
            </div>
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Leave type</p>
                <p className="mt-0.5 text-sm font-medium" style={{ color: meta.color }}>
                    {leaveTypeLabel(span.statusKey, span.isPending)}
                    {span.isPending ? ' (pending)' : ''}
                </p>
            </div>
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Start date</p>
                <p className="mt-0.5 text-sm text-[#374151]">{formatDateDisplay(span.start)}</p>
            </div>
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">End date</p>
                <p className="mt-0.5 text-sm text-[#374151]">{formatDateDisplay(span.end || span.start)}</p>
            </div>
        </div>
    );
}

export function DayLeavesModal({ dateKey, spans, onClose }) {
    if (!dateKey) return null;
    const rows = spansTouchingDate(spans, dateKey);

    return (
        <div
            className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-2xl border border-[#E7EBF1] bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-[#EEF2F6] px-5 py-4">
                    <div>
                        <h3 className="text-base font-bold text-[#111827]">Leaves on {formatDateDisplay(dateKey)}</h3>
                        <p className="mt-0.5 text-xs text-[#8792A6]">
                            {rows.length} record{rows.length === 1 ? '' : 's'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-[#8792A6] hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="max-h-[calc(80vh-4.5rem)] space-y-2 overflow-auto p-5">
                    {rows.length === 0 ? (
                        <p className="py-10 text-center text-sm text-[#8792A6]">No leave on this day.</p>
                    ) : (
                        rows.map((span) => <LeaveRecordRow key={span.id || `${span.employeeMongoId}-${span.start}`} span={span} />)
                    )}
                </div>
            </div>
        </div>
    );
}

export function LeaveCalendarDayView({ date, spans }) {
    const dateKey = formatDateKey(date);
    const rows = spansTouchingDate(spans, dateKey);

    return (
        <div className="min-h-[22rem] px-5 py-5">
            <p className="text-sm font-semibold text-[#111827]">{format(date, 'EEEE, d MMMM yyyy')}</p>
            <p className="mt-1 text-xs text-[#6B7280]">Taken leave on this day</p>
            <div className="mt-4 space-y-2">
                {rows.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[#E5E7EB] px-4 py-10 text-center text-sm text-[#9CA3AF]">
                        No leave taken on this day.
                    </p>
                ) : (
                    rows.map((span) => <LeaveRecordRow key={span.id || `${span.employeeMongoId}-${span.start}`} span={span} />)
                )}
            </div>
        </div>
    );
}

export function LeaveCalendarWeekView({ weekDays, spans }) {
    return (
        <div className="min-h-[22rem] space-y-3 px-5 py-5">
            {weekDays.map((day) => {
                const dateKey = formatDateKey(day);
                const rows = spansTouchingDate(spans, dateKey);
                return (
                    <section key={dateKey} className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-[#111827]">{format(day, 'EEEE, d MMM')}</h3>
                            <span className="text-[11px] font-medium text-[#6B7280]">
                                {rows.length} leave{rows.length === 1 ? '' : 's'}
                            </span>
                        </div>
                        {rows.length === 0 ? (
                            <p className="px-1 py-2 text-xs text-[#9CA3AF]">No leave taken</p>
                        ) : (
                            <div className="space-y-2">
                                {rows.map((span) => (
                                    <LeaveRecordRow
                                        key={`${dateKey}-${span.id || `${span.employeeMongoId}-${span.start}`}`}
                                        span={span}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );
}

function YearMiniMonth({ year, monthIndex, leaveDateSet, todayKey, onDayClick }) {
    const monthDate = startOfMonth(new Date(year, monthIndex, 1));
    const weeks = chunkWeeks(buildCalendarDays(monthDate));

    return (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
            <p className="mb-2 text-center text-[13px] font-semibold text-[#111827]">{format(monthDate, 'MMMM')}</p>
            <div className="grid grid-cols-7">
                {WEEKDAY_SHORT.map((label, index) => (
                    <div key={`${label}-${index}`} className="pb-1 text-center text-[10px] font-semibold text-[#9CA3AF]">
                        {label}
                    </div>
                ))}
            </div>
            {weeks.map((week) => (
                <div key={formatDateKey(week[0])} className="grid grid-cols-7">
                    {week.map((day) => {
                        const dateKey = formatDateKey(day);
                        const inMonth = isSameMonth(day, monthDate);
                        const hasLeave = inMonth && leaveDateSet.has(dateKey);
                        const isToday = dateKey === todayKey;
                        return (
                            <button
                                key={dateKey}
                                type="button"
                                disabled={!hasLeave}
                                onClick={() => hasLeave && onDayClick?.(dateKey)}
                                className={`mx-auto my-0.5 flex h-7 w-7 items-center justify-center text-[11px] ${
                                    !inMonth
                                        ? 'text-transparent'
                                        : hasLeave
                                          ? 'rounded-full bg-[#EF4444] font-semibold text-white hover:bg-[#DC2626]'
                                          : isToday
                                            ? 'rounded-full font-semibold text-[#2563EB] ring-1 ring-[#93C5FD]'
                                            : 'text-[#374151]'
                                } ${hasLeave ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                                {inMonth ? format(day, 'd') : ''}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

export function LeaveCalendarYearView({ year, spans, todayKey, onDayClick }) {
    const leaveDateSet = dateKeysFromSpans(spans);
    return (
        <div className="grid grid-cols-1 gap-3 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, monthIndex) => (
                <YearMiniMonth
                    key={monthIndex}
                    year={year}
                    monthIndex={monthIndex}
                    leaveDateSet={leaveDateSet}
                    todayKey={todayKey}
                    onDayClick={onDayClick}
                />
            ))}
        </div>
    );
}
