'use client';

import { useId, useMemo, useState } from 'react';
import { Calendar, ChevronDown, RotateCcw } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buildLeaveEntitlementCalculation } from '../utils/leaveEntitlementAllocation';

const LEAVE_COLORS = ['#3B82F6', '#14B8A6', '#6366F1', '#0284C7', '#7C3AED', '#D97706'];
const UNUSED_COLOR = '#E2E8F0';
const EXPIRED_COLOR = '#CBD5E1';
const LEAVE_ORDINALS = [
    'First',
    'Second',
    'Third',
    'Fourth',
    'Fifth',
    'Sixth',
    'Seventh',
    'Eighth',
    'Ninth',
    'Tenth',
];

const RANGE_CLASS =
    'h-2 w-full cursor-pointer appearance-none rounded-full bg-[#E5E7EB] ' +
    '[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[#E5E7EB] ' +
    '[&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none ' +
    '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#E2E8F0] [&::-webkit-slider-thumb]:bg-white ' +
    '[&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(15,23,42,0.28)] ' +
    '[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[#E5E7EB] ' +
    '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border ' +
    '[&::-moz-range-thumb]:border-[#E2E8F0] [&::-moz-range-thumb]:bg-white';

function leaveColor(index) {
    return LEAVE_COLORS[index % LEAVE_COLORS.length];
}

function leaveSliderLabel(index) {
    const name = LEAVE_ORDINALS[index - 1];
    return name ? `${name} leave (days)` : `Leave ${index} (days)`;
}

function amountClass(value, excess = false) {
    if (excess && Number(value) > 0) return 'font-semibold text-[#EF4444]';
    return 'text-[#0F172A]';
}

function prettyDate(value) {
    const parsed = parseISO(String(value || ''));
    if (!isValid(parsed)) return '';
    return format(parsed, 'd MMM yyyy');
}

function daysWord(count, capital = false) {
    const total = Math.max(0, Math.round(Number(count) || 0));
    const word = total === 1 ? 'day' : 'days';
    const label = capital ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word;
    return `${total} ${label}`;
}

function leaveDateRange(startDate, endDate) {
    const from = prettyDate(startDate);
    const to = prettyDate(endDate);
    if (from && to) return from === to ? from : `${from} – ${to}`;
    return '';
}

function LeaveRangeTip({ label, range, note, children }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent
                side="top"
                className="border-[#0F172A] bg-[#0F172A] px-2.5 py-1.5 text-left text-white shadow-md"
            >
                <p className="text-[12px] font-semibold leading-4">{label}</p>
                {range ? <p className="mt-0.5 text-[11px] font-medium leading-4">{range}</p> : null}
                {note ? <p className="text-[11px] leading-4 text-white/75">{note}</p> : null}
            </TooltipContent>
        </Tooltip>
    );
}

function SummaryStat({ label, value, valueClassName }) {
    return (
        <div className="min-w-0 px-1 text-center">
            <p className="text-[12px] text-[#94A3B8]">{label}</p>
            <p className={`mt-1 text-[18px] font-semibold leading-6 tabular-nums sm:text-[20px] ${valueClassName}`}>
                {value}
            </p>
        </div>
    );
}

function UtilizationChart({ calculation }) {
    const showUnused = calculation.cycles.some((cycle) => cycle.remaining > 0);
    const showExpired = calculation.expiredLeave > 0;
    return (
        <TooltipProvider delayDuration={120}>
        <div className="mt-4">
            <h4 className="text-[14px] font-semibold text-[#0F172A]">Graphical View</h4>
            <div className="mt-2 space-y-2.5">
                {calculation.cycles.map((cycle) => {
                    const segments = [];
                    calculation.leaves.forEach((leave, index) => {
                        const days = cycle.allocations[index] || 0;
                        if (days > 0) {
                            const range = leaveDateRange(leave.startDate, leave.endDate);
                            const portion = days === leave.days
                                ? `${daysWord(days)} in this cycle`
                                : `${days} of ${leave.days} days in this cycle`;
                            segments.push({
                                key: leave.id,
                                days,
                                color: leaveColor(index),
                                label: `Leave ${leave.index}`,
                                range,
                                note: portion,
                                muted: false,
                            });
                        }
                    });
                    if (cycle.remaining > 0) {
                        segments.push({
                            key: 'unused',
                            days: cycle.remaining,
                            color: UNUSED_COLOR,
                            label: 'Unused',
                            range: '',
                            note: `${daysWord(cycle.remaining)} still available in Cycle ${cycle.index}`,
                            muted: true,
                        });
                    }
                    if (cycle.expired > 0) {
                        segments.push({
                            key: 'expired',
                            days: cycle.expired,
                            color: EXPIRED_COLOR,
                            label: 'Expired',
                            range: '',
                            note: `${daysWord(cycle.expired)} expired after Cycle ${cycle.index + 1}`,
                            muted: true,
                        });
                    }
                    const widthOf = (days) =>
                        cycle.entitlement > 0 ? `${(days / cycle.entitlement) * 100}%` : '0%';
                    return (
                        <div key={cycle.index}>
                            <div className="mb-1 flex items-baseline justify-between gap-3">
                                <p className="min-w-0 truncate text-[13px] text-[#334155]">
                                    <span className="font-medium text-[#0F172A]">Cycle {cycle.index}</span>
                                    <span className="ml-2 text-[11px] text-[#94A3B8]">
                                        {prettyDate(cycle.startDate)} – {prettyDate(cycle.endDate)}
                                    </span>
                                </p>
                                <span className="shrink-0 text-[12px] tabular-nums text-[#64748B]">
                                    {cycle.deducted}/{cycle.entitlement}
                                </span>
                            </div>
                            <div
                                className="flex h-4 overflow-hidden rounded-full bg-[#E2E8F0]"
                                role="group"
                                aria-label={`Cycle ${cycle.index}, ${prettyDate(cycle.startDate)} to ${prettyDate(cycle.endDate)}, ${cycle.deducted} of ${cycle.entitlement} days used`}
                            >
                                {segments.map((segment) => {
                                    const percent = cycle.entitlement > 0 ? (segment.days / cycle.entitlement) * 100 : 0;
                                    const tipLabel = segment.range
                                        ? `${segment.label}, ${segment.range}, ${segment.note}`
                                        : `${segment.label}, ${segment.note}`;
                                    return (
                                        <LeaveRangeTip
                                            key={segment.key}
                                            label={segment.label}
                                            range={segment.range}
                                            note={segment.note}
                                        >
                                            <span
                                                className={`flex h-full cursor-pointer items-center justify-center overflow-hidden text-[10px] font-semibold leading-none outline-none ${
                                                    segment.muted ? 'text-[#64748B]' : 'text-white'
                                                }`}
                                                style={{ width: widthOf(segment.days), backgroundColor: segment.color }}
                                                aria-label={tipLabel}
                                            >
                                                {!segment.muted && percent >= 18 ? segment.days : ''}
                                            </span>
                                        </LeaveRangeTip>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
            <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                {calculation.leaves.map((leave, index) => (
                    <LeaveRangeTip
                        key={leave.id}
                        label={`Leave ${leave.index}`}
                        range={leaveDateRange(leave.startDate, leave.endDate)}
                        note={daysWord(leave.days)}
                    >
                        <li className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-[#64748B]">
                            <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: leaveColor(index) }} />
                            Leave {leave.index}
                        </li>
                    </LeaveRangeTip>
                ))}
                {showUnused ? (
                    <li className="inline-flex items-center gap-1.5 text-[11px] text-[#64748B]">
                        <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: UNUSED_COLOR }} />
                        Unused
                    </li>
                ) : null}
                {showExpired ? (
                    <li className="inline-flex items-center gap-1.5 text-[11px] text-[#64748B]">
                        <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: EXPIRED_COLOR }} />
                        Expired
                    </li>
                ) : null}
            </ul>
            {calculation.skippedPendingDays > 0 ? (
                <p className="mt-2 text-[11px] leading-4 text-[#64748B]">
                    Pending leave ({daysWord(calculation.skippedPendingDays)}) is not deducted until it is approved.
                </p>
            ) : null}
        </div>
        </TooltipProvider>
    );
}

function LeaveDaySlider({ label, value, max, onChange }) {
    const inputId = useId();
    return (
        <div className="min-w-0">
            <label htmlFor={inputId} className="block text-[13px] text-[#64748B]">
                {label}
            </label>
            <div className="mt-2 flex items-center gap-3">
                <input
                    id={inputId}
                    type="range"
                    min={0}
                    max={max}
                    step={1}
                    value={value}
                    onChange={(event) => onChange(Number(event.target.value))}
                    className={RANGE_CLASS}
                />
                <span className="w-12 shrink-0 text-right text-[22px] font-semibold leading-none tabular-nums text-[#0F172A]">
                    {value}
                </span>
            </div>
        </div>
    );
}

function CalculationTable({ calculation, recordedLeaves, dayOverrides, onDayChange, onReset }) {
    const columns = calculation.cycles;
    const sliderMax = Math.max(100, ...recordedLeaves.map((leave) => leave.days), 0);
    const excess = calculation.excessLeave;
    return (
        <div className="mt-3 rounded-[18px] border border-[#E6EAF0] bg-white px-4 py-4 sm:px-5 sm:py-5">
            {recordedLeaves.length > 0 ? (
                <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
                    {recordedLeaves.map((leave) => {
                        const current = Object.prototype.hasOwnProperty.call(dayOverrides, leave.id)
                            ? dayOverrides[leave.id]
                            : leave.days;
                        return (
                            <LeaveDaySlider
                                key={leave.id}
                                label={leaveSliderLabel(leave.index)}
                                value={current}
                                max={sliderMax}
                                onChange={(days) => onDayChange(leave.id, days)}
                            />
                        );
                    })}
                </div>
            ) : null}
            <div className={`overflow-x-auto ${recordedLeaves.length > 0 ? 'mt-5' : ''}`}>
                <table className="w-full min-w-[420px] text-left">
                    <thead>
                        <tr className="border-b border-[#EEF2F6] text-[12px] font-medium text-[#94A3B8]">
                            <th className="sticky left-0 bg-white py-2 pr-3 font-medium">Transaction</th>
                            {columns.map((cycle) => (
                                <th key={cycle.index} className="min-w-[48px] px-2 py-2 text-right font-medium">
                                    C{cycle.index}
                                </th>
                            ))}
                            <th className="min-w-[56px] py-2 pl-2 text-right font-medium">Excess</th>
                        </tr>
                    </thead>
                    <tbody>
                        {calculation.leaves.map((leave) => (
                            <tr key={leave.id} className="border-b border-[#F1F5F9]">
                                <td className="sticky left-0 bg-white py-2.5 pr-3 text-[13px] text-[#0F172A]">
                                    Leave {leave.index}
                                </td>
                                {leave.allocations.map((days, index) => (
                                    <td
                                        key={columns[index].index}
                                        className="px-2 py-2.5 text-right text-[13px] tabular-nums text-[#0F172A]"
                                    >
                                        {days}
                                    </td>
                                ))}
                                <td
                                    className={`py-2.5 pl-2 text-right text-[13px] tabular-nums ${amountClass(leave.excess, true)}`}
                                    title={
                                        leave.excess > 0
                                            ? `${daysWord(leave.excess)} of this leave is not allocated`
                                            : undefined
                                    }
                                >
                                    {leave.excess}
                                </td>
                            </tr>
                        ))}
                        <tr>
                            <td className="sticky left-0 bg-white py-2.5 pr-3 text-[13px] text-[#0F172A]">Balance</td>
                            {columns.map((cycle) => (
                                <td
                                    key={cycle.index}
                                    className="px-2 py-2.5 text-right text-[13px] tabular-nums text-[#0F172A]"
                                >
                                    {cycle.remaining}
                                </td>
                            ))}
                            <td className={`py-2.5 pl-2 text-right text-[13px] tabular-nums ${amountClass(excess, true)}`}>
                                {excess}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#0F172A]">
                        Total leave taken: {daysWord(calculation.totalLeaveTaken)}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[#64748B]">
                        Total entitlement: {daysWord(calculation.totalEntitlement)}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onReset}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E6EAF0] bg-white px-3 py-1.5 text-[13px] font-medium text-[#64748B] shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:bg-[#F8FAFC]"
                >
                    <RotateCcw size={14} />
                    Reset
                </button>
            </div>
            <div className="mt-6 flex items-center justify-between gap-4">
                <p className="text-[18px] font-semibold tracking-tight text-[#0F172A] sm:text-[20px]">
                    Excess pending HR adjustment
                </p>
                <p
                    className={`shrink-0 text-[28px] font-semibold leading-none tabular-nums sm:text-[32px] ${
                        excess > 0 ? 'text-[#EF4444]' : 'text-[#0F172A]'
                    }`}
                >
                    {daysWord(excess)}
                </p>
            </div>
        </div>
    );
}

export default function AnnualLeaveEntitlementSection({
    joiningDate = '',
    asOfDate = '',
    leaveRecords = [],
    loading = false,
    error = '',
}) {
    const panelId = useId();
    const tableId = useId();
    const [open, setOpen] = useState(false);
    const [excessOpen, setExcessOpen] = useState(false);
    const [dayOverrides, setDayOverrides] = useState({});
    const baseCalculation = useMemo(
        () =>
            buildLeaveEntitlementCalculation({
                joiningDate,
                asOf: asOfDate,
                leaveRecords,
            }),
        [asOfDate, joiningDate, leaveRecords],
    );
    const calculation = useMemo(() => {
        if (!Object.keys(dayOverrides).length) return baseCalculation;
        return buildLeaveEntitlementCalculation({
            joiningDate,
            asOf: asOfDate,
            leaveRecords,
            dayOverrides,
        });
    }, [asOfDate, baseCalculation, dayOverrides, joiningDate, leaveRecords]);
    const excess = calculation.excessLeave;

    return (
        <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5">
            <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((current) => !current)}
            >
                <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#E8F1FF] text-[#2563EB]">
                        <Calendar size={16} />
                    </span>
                    <span className="min-w-0">
                        <span className="block text-[15px] font-semibold text-[#0F172A]">Annual Leave</span>
                        <span className="mt-0.5 block text-[12px] text-[#64748B]">
                            Entitlement, utilization, and excess leave
                        </span>
                    </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                    {calculation.ok && excess > 0 ? (
                        <span className="rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-semibold text-[#EF4444]">
                            {daysWord(excess, true)} excess
                        </span>
                    ) : null}
                    <ChevronDown
                        size={16}
                        className={`text-[#64748B] transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                </span>
            </button>

            {open ? (
                <div id={panelId} className="mt-4 border-t border-[#EEF2F6] pt-4">
                    {!calculation.ok ? (
                        <p className="text-[13px] text-[#64748B]">
                            {loading ? 'Loading leave entitlement…' : error || calculation.message}
                        </p>
                    ) : (
                        <>
                            <h3 className="text-[15px] font-semibold text-[#0F172A]">
                                Employee Leave Entitlement & Calculation
                            </h3>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <SummaryStat
                                    label="Total Entitlement"
                                    value={daysWord(calculation.totalEntitlement, true)}
                                    valueClassName="text-[#2563EB]"
                                />
                                <SummaryStat
                                    label="Total Leave Taken"
                                    value={daysWord(calculation.totalLeaveTaken, true)}
                                    valueClassName="text-[#0F766E]"
                                />
                                <SummaryStat
                                    label="Excess Leave"
                                    value={daysWord(excess, true)}
                                    valueClassName={excess > 0 ? 'text-[#EF4444]' : 'text-[#0F172A]'}
                                />
                            </div>
                            <UtilizationChart calculation={calculation} />
                            <button
                                type="button"
                                className="mt-3 flex w-full items-center justify-between gap-3 border-t border-[#EEF2F6] pt-3 text-left"
                                aria-expanded={excessOpen}
                                aria-controls={tableId}
                                onClick={() => setExcessOpen((current) => !current)}
                            >
                                <span className="text-[13px] font-medium text-[#0F172A]">
                                    Excess Leave:{' '}
                                    <span className={excess > 0 ? 'font-semibold text-[#EF4444]' : 'font-semibold'}>
                                        {daysWord(excess, true)}
                                    </span>
                                </span>
                                <ChevronDown
                                    size={16}
                                    className={`shrink-0 text-[#64748B] transition-transform ${excessOpen ? 'rotate-180' : ''}`}
                                />
                            </button>
                            {excessOpen ? (
                                <div id={tableId}>
                                    <CalculationTable
                                        calculation={calculation}
                                        recordedLeaves={baseCalculation.leaves}
                                        dayOverrides={dayOverrides}
                                        onDayChange={(id, days) =>
                                            setDayOverrides((current) => ({ ...current, [id]: days }))
                                        }
                                        onReset={() => setDayOverrides({})}
                                    />
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            ) : null}
        </section>
    );
}
