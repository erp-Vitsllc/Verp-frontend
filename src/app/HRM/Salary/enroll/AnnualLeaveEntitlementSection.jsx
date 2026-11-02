'use client';

import { useId, useMemo, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { buildLeaveEntitlementCalculation } from '../utils/leaveEntitlementAllocation';

const LEAVE_COLORS = ['#3B82F6', '#14B8A6', '#6366F1', '#0284C7', '#7C3AED', '#D97706'];
const UNUSED_COLOR = '#E2E8F0';
const EXPIRED_COLOR = '#CBD5E1';

function leaveColor(index) {
    return LEAVE_COLORS[index % LEAVE_COLORS.length];
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
        <div className="mt-4">
            <h4 className="text-[14px] font-semibold text-[#0F172A]">Graphical View</h4>
            <div className="mt-2 space-y-2.5">
                {calculation.cycles.map((cycle) => {
                    const segments = [];
                    calculation.leaves.forEach((leave, index) => {
                        const days = cycle.allocations[index] || 0;
                        if (days > 0) {
                            segments.push({
                                key: leave.id,
                                days,
                                color: leaveColor(index),
                                label: `Leave ${leave.index}`,
                            });
                        }
                    });
                    if (cycle.remaining > 0) {
                        segments.push({
                            key: 'unused',
                            days: cycle.remaining,
                            color: UNUSED_COLOR,
                            label: 'Unused',
                            muted: true,
                        });
                    }
                    if (cycle.expired > 0) {
                        segments.push({
                            key: 'expired',
                            days: cycle.expired,
                            color: EXPIRED_COLOR,
                            label: 'Expired',
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
                                role="img"
                                aria-label={`Cycle ${cycle.index}, ${prettyDate(cycle.startDate)} to ${prettyDate(cycle.endDate)}, ${cycle.deducted} of ${cycle.entitlement} days used`}
                            >
                                {segments.map((segment) => {
                                    const percent = cycle.entitlement > 0 ? (segment.days / cycle.entitlement) * 100 : 0;
                                    return (
                                        <span
                                            key={segment.key}
                                            className="flex h-full items-center justify-center overflow-hidden text-[10px] font-semibold leading-none text-white"
                                            style={{ width: widthOf(segment.days), backgroundColor: segment.color }}
                                            title={`${segment.label}: ${segment.days} days`}
                                        >
                                            {!segment.muted && percent >= 18 ? segment.days : ''}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
            <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                {calculation.leaves.map((leave, index) => (
                    <li key={leave.id} className="inline-flex items-center gap-1.5 text-[11px] text-[#64748B]">
                        <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: leaveColor(index) }} />
                        Leave {leave.index}
                    </li>
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
    );
}

function CalculationTable({ calculation }) {
    const columns = calculation.cycles;
    return (
        <div className="mt-3">
            <h4 className="mb-2 text-[14px] font-semibold text-[#0F172A]">Combined Leave Calculation Table</h4>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left">
                    <thead>
                        <tr className="border-b border-[#EEF2F6] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94A3B8]">
                            <th className="sticky left-0 bg-white py-2 pr-3 font-semibold">Leave Details</th>
                            {columns.map((cycle) => (
                                <th key={cycle.index} className="px-2 py-2 text-right font-semibold">
                                    Cycle {cycle.index}
                                </th>
                            ))}
                            <th className="py-2 pl-2 text-right font-semibold">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-[#F1F5F9]">
                            <td className="sticky left-0 bg-white py-2 pr-3 text-[13px] text-[#334155]">Leave entitlement</td>
                            {columns.map((cycle) => (
                                <td key={cycle.index} className="px-2 py-2 text-right text-[13px] tabular-nums text-[#334155]">
                                    {cycle.entitlement}
                                </td>
                            ))}
                            <td className="py-2 pl-2 text-right text-[13px] font-semibold tabular-nums text-[#0F172A]">
                                {calculation.totalEntitlement}
                            </td>
                        </tr>
                        {calculation.leaves.map((leave) => (
                            <tr key={leave.id} className="border-b border-[#F1F5F9]">
                                <td className="sticky left-0 bg-white py-2 pr-3 text-[13px] text-[#334155]">
                                    Leave {leave.index} ({daysWord(leave.days)})
                                </td>
                                {leave.allocations.map((days, index) => (
                                    <td key={columns[index].index} className="px-2 py-2 text-right text-[13px] tabular-nums text-[#334155]">
                                        {days}
                                    </td>
                                ))}
                                <td
                                    className="py-2 pl-2 text-right text-[13px] font-semibold tabular-nums text-[#0F172A]"
                                    title={
                                        leave.excess > 0
                                            ? `${daysWord(leave.excess)} of this leave is not allocated`
                                            : undefined
                                    }
                                >
                                    {leave.allocated}
                                </td>
                            </tr>
                        ))}
                        <tr className="border-b border-[#F1F5F9]">
                            <td className="sticky left-0 bg-white py-2 pr-3 text-[13px] font-semibold text-[#0F172A]">Total deducted</td>
                            {columns.map((cycle) => (
                                <td key={cycle.index} className="px-2 py-2 text-right text-[13px] font-semibold tabular-nums text-[#0F172A]">
                                    {cycle.deducted}
                                </td>
                            ))}
                            <td className="py-2 pl-2 text-right text-[13px] font-semibold tabular-nums text-[#0F172A]">
                                {calculation.totalDeducted}
                            </td>
                        </tr>
                        {calculation.expiredLeave > 0 ? (
                            <tr className="border-b border-[#F1F5F9]">
                                <td className="sticky left-0 bg-white py-2 pr-3 text-[13px] text-[#64748B]">Expired unused</td>
                                {columns.map((cycle) => (
                                    <td key={cycle.index} className="px-2 py-2 text-right text-[13px] tabular-nums text-[#64748B]">
                                        {cycle.expired}
                                    </td>
                                ))}
                                <td className="py-2 pl-2 text-right text-[13px] tabular-nums text-[#64748B]">
                                    {calculation.expiredLeave}
                                </td>
                            </tr>
                        ) : null}
                        <tr>
                            <td className="sticky left-0 bg-white py-2 pr-3 text-[13px] font-semibold text-[#0F172A]">Remaining balance</td>
                            {columns.map((cycle) => (
                                <td key={cycle.index} className="px-2 py-2 text-right text-[13px] font-semibold tabular-nums text-[#0F172A]">
                                    {cycle.remaining}
                                </td>
                            ))}
                            <td className="py-2 pl-2 text-right text-[13px] font-semibold tabular-nums text-[#0F172A]">
                                {columns.reduce((total, cycle) => total + cycle.remaining, 0)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-[#64748B]">
                Leave taken {daysWord(calculation.totalLeaveTaken)}. Entitlement allocated {daysWord(calculation.totalDeducted)}.
                {calculation.excessLeave > 0 ? ` Unallocated excess ${daysWord(calculation.excessLeave)}.` : ''}
            </p>
            {calculation.excessLeave > 0 ? (
                <p className="mt-1 text-[12px] font-medium text-[#EF4444]">
                    Unallocated Excess Leave: {daysWord(calculation.excessLeave, true)} — Pending HR Adjustment
                </p>
            ) : null}
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
    const calculation = useMemo(
        () =>
            buildLeaveEntitlementCalculation({
                joiningDate,
                asOf: asOfDate,
                leaveRecords,
            }),
        [asOfDate, joiningDate, leaveRecords],
    );
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
                                    <CalculationTable calculation={calculation} />
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            ) : null}
        </section>
    );
}
