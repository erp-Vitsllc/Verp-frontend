'use client';

import { MinusCircle, Table2, Wallet } from 'lucide-react';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import {
    applyCategoryThisMonthOnDraft,
    buildSalarySlipBalanceRows,
    clampThisMonthDeduction,
    formatAed,
    mapComponent,
    money,
    pickComponent,
} from './salarySlipEdit';

const FIELD =
    'h-9 w-full min-w-0 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-sm text-[#0F172A] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]';
const FIELD_RO =
    'h-10 w-full min-w-0 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] outline-none';
const TH =
    'whitespace-nowrap border-b border-[#EEF2F6] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]';
const TD = 'px-3 py-2 text-sm text-[#0F172A]';

const MONTHLY_EARNING_ROWS = [
    { name: 'Basic Salary', period: 'monthly' },
    { name: 'Other Allowance', period: 'monthly' },
    { name: 'House Rental Allowance', period: 'monthly' },
    { name: 'Vehicle Allowance', period: 'monthly' },
    { name: 'Fuel Allowance', period: 'monthly' },
    { name: 'Phone Allowance', period: 'monthly' },
    { name: 'Overtime Hours', period: 'otHours' },
    { name: 'Overtime Days', period: 'otDays' },
    { name: 'Reward', period: 'reward' },
];

const THIS_MONTH_EARNING = new Set(['Phone Allowance', 'Overtime Hours', 'Overtime Days', 'Reward']);
const CONTRACT_SALARY_NAMES = [
    'Basic Salary',
    'Other Allowance',
    'House Rental Allowance',
    'Vehicle Allowance',
    'Fuel Allowance',
];
const FORMULA_EARNINGS = new Set(['Overtime Hours', 'Overtime Days']);
const FORMULA_DEDUCTIONS = new Set(['Authorized Leave', 'Unauthorized Leave', 'Late Arrival']);

const LOSS_OF_PAY_ROWS = [
    { name: 'Authorized Leave', dayKey: 'authorized', multiplierKey: 'authorized' },
    { name: 'Unauthorized Leave', dayKey: 'unauthorized', multiplierKey: 'unauthorized' },
    { name: 'Late Arrival', dayKey: 'late', multiplierKey: 'late' },
    { name: 'Annual Leave', dayKey: 'annual', multiplierKey: 'annual' },
    { name: 'Comp off leave', dayKey: 'compOff', daysOnly: true },
];

const OTHER_DEDUCTION_ROWS = [
    { name: 'Loan', timesKey: 'loan' },
    { name: 'Fine', timesKey: 'fine' },
    { name: 'Utility Excess', timesKey: 'utilityExcess' },
    { name: 'Salary Advance', timesKey: 'salaryAdvance' },
];

function parseLeadingNumber(value) {
    const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
}

function monthDaysOf(slip) {
    const key = String(slip?.monthKey || '').trim();
    const match = key.match(/^(\d{4})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]), 0).getDate();
    const fromSummary = Number(slip?.summary?.monthDays);
    return Number.isFinite(fromSummary) && fromSummary > 0 ? fromSummary : 0;
}

function contractedMonthlySalary(slip) {
    const fromSummary = money(slip?.summary?.monthlySalary);
    if (fromSummary > 0) return fromSummary;
    return money(CONTRACT_SALARY_NAMES.reduce((sum, name) => sum + liveSalaryAmount(slip, name), 0));
}

function daySalaryOf(slip) {
    const days = monthDaysOf(slip);
    const monthly = contractedMonthlySalary(slip);
    if (days > 0 && monthly > 0) return money(monthly / days);
    return money(slip?.summary?.daySalary);
}

function overtimeHoursCount(slip) {
    const summary = slip?.summary || {};
    return (
        Number(summary.overtimeHoursCount) ||
        parseLeadingNumber(slip?.attendance?.overtimeHours) ||
        parseLeadingNumber(pickComponent(slip?.earnings, 'Overtime Hours').basis) ||
        0
    );
}

function overtimeDaysCount(slip) {
    const summary = slip?.summary || {};
    return (
        Number(summary.overtimeDaysCount) ||
        parseLeadingNumber(pickComponent(slip?.earnings, 'Overtime Days').basis) ||
        0
    );
}

function formulaEarningAmount(slip, name) {
    const daily = daySalaryOf(slip);
    if (name === 'Overtime Hours') return money((daily / 10) * overtimeHoursCount(slip));
    if (name === 'Overtime Days') return money(daily * overtimeDaysCount(slip));
    return null;
}

function formulaLeaveAmount(daily, days, multiplier) {
    const times = Number(multiplier);
    const count = Number(days) || 0;
    const rate = Number.isFinite(times) ? times : 0;
    return money((Number(daily) || 0) * rate * count);
}

function formatQty(value) {
    const n = Number(value) || 0;
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 100) / 100);
}

function unitLabel(count, unit) {
    const n = Number(count) || 0;
    return `${formatQty(n)} ${unit}`;
}

function timesLabel(count) {
    const n = Number(count) || 0;
    return `${formatQty(n)} time${n === 1 ? '' : 's'}`;
}

function daysTimesLabel(days, multiplier) {
    const d = Number(days) || 0;
    const m = Number(multiplier);
    const times = Number.isFinite(m) ? m : 1;
    return `${unitLabel(d, d === 1 ? 'day' : 'days')} × ${formatQty(times)}`;
}

function moneyInputValue(value) {
    const n = money(value);
    return Number.isFinite(n) ? String(n) : '';
}

function amountToneClass(tone) {
    if (tone === 'deduct') return 'font-semibold text-red-600';
    if (tone === 'net') return 'font-semibold text-blue-600';
    return 'font-semibold text-emerald-700';
}

function GroupTotal({ label, value, tone = 'earn' }) {
    const wrap =
        tone === 'deduct'
            ? 'border-rose-100 bg-rose-50 text-rose-700'
            : tone === 'net'
                ? 'border-indigo-100 bg-indigo-50 text-indigo-700'
                : 'border-emerald-100 bg-emerald-50 text-emerald-700';
    return (
        <div className={`mt-3 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${wrap}`}>
            <span className="text-xs font-medium">{label}</span>
            <span className="text-lg font-bold tabular-nums">{formatAed(value)}</span>
        </div>
    );
}

function PayableMiniCard({ title, hint, value, tone = 'net' }) {
    const wrap =
        tone === 'earn'
            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
            : 'border-indigo-100 bg-indigo-50 text-indigo-700';
    return (
        <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[13px] font-semibold text-gray-800">{title}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-gray-500">{hint}</p>
            <p className={`mt-1.5 rounded-lg border px-2.5 py-1.5 text-base font-bold tabular-nums ${wrap}`}>
                {formatAed(value)}
            </p>
        </div>
    );
}

const BALANCE_HEADERS = [
    'Type',
    'Total',
    'Pending',
    'Balance',
    'This month deduction',
    'Remaining after deduction',
];

function BalanceScheduleTable({ rows, onThisMonthChange }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-[#EEF2F6]">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                    <tr className="bg-[#F8FAFC]">
                        {BALANCE_HEADERS.map((title) => (
                            <th key={title} className={TH}>
                                {title}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.type} className="border-b border-[#F1F5F9] last:border-b-0">
                            <td className="whitespace-nowrap px-3 py-3 font-semibold text-[#0F172A]">
                                {row.label || `${row.type} (${row.count || 0})`}
                            </td>
                            <td className={`whitespace-nowrap px-3 py-3 tabular-nums ${amountToneClass('earn')}`}>
                                {formatAed(row.total)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 tabular-nums text-[#64748B]">
                                {formatAed(row.pending)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 tabular-nums text-[#64748B]">
                                {formatAed(row.balance)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                                <AmountCell
                                    label={`${row.type} this month deduction`}
                                    amount={row.thisMonthDeduction}
                                    tone="deduct"
                                    max={row.total}
                                    disabled={money(row.total) <= 0}
                                    onChange={(value) => onThisMonthChange?.(row.type, value)}
                                />
                            </td>
                            <td className={`whitespace-nowrap px-3 py-3 tabular-nums ${amountToneClass('net')}`}>
                                {formatAed(row.remainingAfterDeduction)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function patchNamedComponent(onPatch, section, name, patch) {
    onPatch(section, (draft) => ({
        ...draft,
        [section]: mapComponent(draft[section], name, patch),
    }));
}

function AnnualBenefitTable({ rows, total }) {
    const afterTotal = money((rows || []).reduce((sum, row) => sum + money(row.afterUpdate), 0));
    return (
        <div className="overflow-x-auto rounded-xl border border-[#EEF2F6]">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead>
                    <tr className="bg-[#F8FAFC]">
                        {['SL', 'Earning', 'Total balance', 'Amount', 'After this update'].map((heading) => (
                            <th
                                key={heading}
                                className={`${TH} ${heading === 'SL' ? 'w-12' : heading === 'Amount' ? 'w-[22%]' : ''}`}
                            >
                                {heading}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.key} className="border-b border-[#F1F5F9]">
                            <td className={`${TD} tabular-nums text-[#94A3B8]`}>{row.sl}</td>
                            <td className={`${TD} font-semibold`}>{row.label}</td>
                            <td className={`${TD} tabular-nums text-[#0F172A]`}>{formatAed(row.totalBalance)}</td>
                            <td className={TD}>{row.amountCell}</td>
                            <td className={`${TD} tabular-nums font-semibold text-[#0F172A]`}>
                                {formatAed(row.afterUpdate)}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="bg-emerald-50 text-emerald-700">
                        <td colSpan={3} className="px-3 py-2.5 text-xs font-medium">
                            Total
                        </td>
                        <td className="px-3 py-2.5 text-sm font-bold tabular-nums">{formatAed(total)}</td>
                        <td className="px-3 py-2.5 text-sm font-bold tabular-nums">{formatAed(afterTotal)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function patchLeaveTicketOnSlip(onPatch, { yearlyName, monthName, overrideKey, summaryKey }, value) {
    const amount = money(value);
    onPatch('yearlyEarnings', (draft) => {
        const summary = { ...(draft.summary || {}) };
        const current = { ...(summary[summaryKey] || {}) };
        summary[summaryKey] = { ...current, amount };
        return {
            ...draft,
            yearlyEarnings: mapComponent(draft.yearlyEarnings, yearlyName, { amount, basis: 'Yearly' }),
            earnings: mapComponent(draft.earnings, monthName, { amount, basis: 'Annual' }),
            summary,
            thisMonthOverrides: { ...(draft.thisMonthOverrides || {}), [overrideKey]: true },
        };
    });
}

function sumThisMonth(rows, read) {
    return money((Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + money(read(row)), 0));
}

const CARD_TO_BALANCE_TYPE = {
    Loan: 'Loan',
    Fine: 'Fine',
    'Utility Excess': 'Utility',
    'Salary Advance': 'Salary Advance',
};

function liveDeductionAmount(slip, name) {
    if (name === 'Fine') {
        return sumThisMonth(slip?.fines, (item) => item.thisMonthAmount ?? item.thisMonth);
    }
    if (name === 'Loan') {
        return sumThisMonth(
            (slip?.loanSchedule || []).filter((item) => !/advance/i.test(String(item.type || ''))),
            (item) => item.thisMonthAmount ?? item.thisMonth,
        );
    }
    if (name === 'Salary Advance') {
        return sumThisMonth(
            (slip?.loanSchedule || []).filter((item) => /advance/i.test(String(item.type || ''))),
            (item) => item.thisMonthAmount ?? item.thisMonth,
        );
    }
    if (name === 'Utility Excess') {
        return sumThisMonth(slip?.utilities, (item) => item.thisMonthAmount ?? item.thisMonth);
    }
    return money(pickComponent(slip?.deductions, name).amount);
}

function patchThisMonthDeduction(onPatch, type, value) {
    onPatch('thisMonthDeduction', (draft) => applyCategoryThisMonthOnDraft(draft, type, value));
}

function liveSalaryAmount(slip, name) {
    const yearly = money(pickComponent(slip?.yearlyEarnings, name).amount);
    if (yearly > 0) return yearly;
    return money(pickComponent(slip?.earnings, name).amount);
}

function liveMonthlyEarningAmount(slip, name) {
    const formula = formulaEarningAmount(slip, name);
    if (formula != null) return formula;
    if (THIS_MONTH_EARNING.has(name)) {
        return money(pickComponent(slip?.earnings, name).amount);
    }
    return liveSalaryAmount(slip, name);
}

function liveBenefitAmount(slip, yearlyName, monthName, summaryAmount) {
    const fromSummary = money(summaryAmount);
    if (fromSummary > 0) return fromSummary;
    const yearly = money(pickComponent(slip?.yearlyEarnings, yearlyName).amount);
    if (yearly > 0) return yearly;
    return money(pickComponent(slip?.earnings, monthName).amount);
}

function monthlyPeriodLabel(name, slip) {
    if (name === 'Overtime Hours') {
        const hours = overtimeHoursCount(slip);
        return unitLabel(hours, hours === 1 ? 'hour' : 'hours');
    }
    if (name === 'Overtime Days') {
        const days = overtimeDaysCount(slip);
        return unitLabel(days, days === 1 ? 'day' : 'days');
    }
    if (name === 'Reward') {
        const count = Number(slip?.summary?.rewardCount) || 0;
        const amount = money(pickComponent(slip?.earnings, 'Reward').amount);
        return count > 0 || amount > 0 ? 'Reward scheduled' : '—';
    }
    return 'Monthly';
}

function AmountCell({ label, amount, tone, onChange, max, disabled }) {
    const cap = max == null ? null : money(max);
    const locked = disabled || (cap != null && cap <= 0);
    const editable = typeof onChange === 'function' && !locked;
    return (
        <div className="flex items-center gap-2">
            <input
                type="number"
                step="0.01"
                min={0}
                max={cap != null && cap > 0 ? cap : undefined}
                disabled={locked}
                readOnly={!editable}
                value={moneyInputValue(amount)}
                onChange={(e) => {
                    if (!editable) return;
                    const raw = e.target.value;
                    onChange(cap != null ? clampThisMonthDeduction(raw, cap) : raw);
                }}
                className={`${editable ? FIELD : FIELD_RO} ${amountToneClass(tone)}`}
                aria-label={`${label} amount`}
            />
            <span className="shrink-0 text-xs font-semibold text-gray-400">AED</span>
        </div>
    );
}

function SlipTable({
    headers,
    rows,
    totalLabel,
    total,
    tone = 'earn',
}) {
    const footClass =
        tone === 'deduct' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700';
    return (
        <div className="overflow-x-auto rounded-xl border border-[#EEF2F6]">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead>
                    <tr className="bg-[#F8FAFC]">
                        {headers.map((heading) => (
                            <th
                                key={heading}
                                className={`${TH} ${heading === 'SL' ? 'w-12' : heading === 'Amount' || heading === 'Total' ? 'w-[38%]' : ''}`}
                            >
                                {heading}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.key} className="border-b border-[#F1F5F9]">
                            <td className={`${TD} tabular-nums text-[#94A3B8]`}>{row.sl}</td>
                            <td className={`${TD} font-semibold`}>{row.label}</td>
                            <td className={`${TD} text-[#64748B]`}>{row.period}</td>
                            <td className={TD}>{row.amountCell}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className={footClass}>
                        <td colSpan={3} className="px-3 py-2.5 text-xs font-medium">
                            {totalLabel}
                        </td>
                        <td className="px-3 py-2.5 text-sm font-bold tabular-nums">{formatAed(total)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function patchEarningAmount(onPatch, name, value) {
    const amount = value;
    if (THIS_MONTH_EARNING.has(name)) {
        patchNamedComponent(onPatch, 'earnings', name, { amount });
        return;
    }
    patchNamedComponent(onPatch, 'yearlyEarnings', name, { amount, basis: 'Monthly' });
}

export default function SalarySlipCards({ slip, onPatch }) {
    const summary = slip?.summary || {};
    const multipliers = summary.leaveMultipliers || {};
    const lopDays = summary.lossOfPayDays || {};
    const otherTimes = summary.otherDeductionTimes || {};

    const monthlyEarningRows = MONTHLY_EARNING_ROWS.map((item, index) => {
        const amount = liveMonthlyEarningAmount(slip, item.name);
        const formulaRow = FORMULA_EARNINGS.has(item.name);
        return {
            key: item.name,
            sl: index + 1,
            label: item.name,
            period: monthlyPeriodLabel(item.name, slip),
            amount,
            amountCell: (
                <AmountCell
                    label={item.name}
                    amount={amount}
                    onChange={
                        formulaRow
                            ? undefined
                            : (value) => patchEarningAmount(onPatch, item.name, value)
                    }
                />
            ),
        };
    });
    const monthlyEarningTotal = money(
        monthlyEarningRows.reduce((sum, row) => sum + money(row.amount), 0),
    );

    const leaveBenefit = summary.leaveSalary || {};
    const ticketBenefit = summary.airTicket || {};
    const leaveSalaryAmount = liveBenefitAmount(
        slip,
        'Leave Salary',
        'Leave Salary',
        leaveBenefit.amount,
    );
    const airTicketAmount = liveBenefitAmount(
        slip,
        'Travel Allowance',
        'Ticket',
        ticketBenefit.amount,
    );
    const leaveRemaining = money(leaveBenefit.remaining);
    const ticketRemaining = money(ticketBenefit.remaining);
    const leaveTotalBalance = money(leaveBenefit.max) || money(leaveRemaining + leaveSalaryAmount);
    const ticketTotalBalance = money(ticketBenefit.max) || money(ticketRemaining + airTicketAmount);
    const annualEarningRows = [
        {
            key: 'leave-salary',
            sl: 1,
            name: 'Leave Salary',
            monthName: 'Leave Salary',
            overrideKey: 'leaveSalary',
            summaryKey: 'leaveSalary',
            label: 'Annual leave salary',
            amount: leaveSalaryAmount,
            totalBalance: leaveTotalBalance,
            afterUpdate: money(Math.max(0, leaveTotalBalance - leaveSalaryAmount)),
            max: leaveTotalBalance,
        },
        {
            key: 'air-ticket',
            sl: 2,
            name: 'Travel Allowance',
            monthName: 'Ticket',
            overrideKey: 'ticket',
            summaryKey: 'airTicket',
            label: 'Annual leave air ticket',
            amount: airTicketAmount,
            totalBalance: ticketTotalBalance,
            afterUpdate: money(Math.max(0, ticketTotalBalance - airTicketAmount)),
            max: ticketTotalBalance,
        },
    ].map((row) => ({
        ...row,
        amountCell: (
            <AmountCell
                label={row.label}
                amount={row.amount}
                max={row.max > 0 ? row.max : undefined}
                disabled={row.max <= 0 && money(row.amount) <= 0}
                onChange={(value) =>
                    patchLeaveTicketOnSlip(onPatch, {
                        yearlyName: row.name,
                        monthName: row.monthName,
                        overrideKey: row.overrideKey,
                        summaryKey: row.summaryKey,
                    }, value)
                }
            />
        ),
    }));
    const annualEarningTotal = money(leaveSalaryAmount + airTicketAmount);

    const lopRows = LOSS_OF_PAY_ROWS.map((item, index) => {
        const days =
            Number(lopDays[item.dayKey]) ||
            parseLeadingNumber(
                item.dayKey === 'compOff'
                    ? slip?.attendance?.compOffLeave
                    : pickComponent(slip?.deductions, item.name).basis,
            );
        const multiplier = multipliers[item.multiplierKey];
        const amount = FORMULA_DEDUCTIONS.has(item.name)
            ? formulaLeaveAmount(daySalaryOf(slip), days, multiplier)
            : liveDeductionAmount(slip, item.name);
        const period = item.daysOnly
            ? unitLabel(days, days === 1 ? 'day' : 'days')
            : daysTimesLabel(days, multiplier);
        return {
            key: item.name,
            sl: index + 1,
            label: item.name,
            period,
            amount,
            amountCell: (
                <AmountCell
                    label={item.name}
                    amount={amount}
                    tone="deduct"
                    onChange={
                        FORMULA_DEDUCTIONS.has(item.name)
                            ? undefined
                            : (value) =>
                                  patchNamedComponent(onPatch, 'deductions', item.name, { amount: value })
                    }
                />
            ),
        };
    });
    const lopTotal = money(lopRows.reduce((sum, row) => sum + money(row.amount), 0));
    const balanceRows = buildSalarySlipBalanceRows(slip);
    const deductionLimitByType = Object.fromEntries(
        balanceRows.map((row) => [row.type, money(row.total)]),
    );

    const otherDeductionRows = OTHER_DEDUCTION_ROWS.map((item, index) => {
        const amount = liveDeductionAmount(slip, item.name);
        const times = Number(otherTimes[item.timesKey]) || (amount > 0 ? 1 : 0);
        const type = CARD_TO_BALANCE_TYPE[item.name];
        const limit = type ? money(deductionLimitByType[type]) : null;
        return {
            key: item.name,
            sl: index + 1,
            label: item.name,
            period: timesLabel(times),
            amount,
            amountCell: (
                <AmountCell
                    label={item.name}
                    amount={amount}
                    tone="deduct"
                    max={limit}
                    disabled={limit != null && limit <= 0}
                    onChange={(value) => {
                        if (type) {
                            patchThisMonthDeduction(onPatch, type, value);
                            return;
                        }
                        patchNamedComponent(onPatch, 'deductions', item.name, { amount: value });
                    }}
                />
            ),
        };
    });
    const otherDeductionTotal = money(
        otherDeductionRows.reduce((sum, row) => sum + money(row.amount), 0),
    );

    const totalEarnings = money(monthlyEarningTotal + annualEarningTotal);
    const zohoSalary = money(totalEarnings - lopTotal);
    const netSalaryPayable = money(totalEarnings - lopTotal - otherDeductionTotal);

    return (
        <div className="flex w-full min-w-0 flex-col gap-3">
            <div className="grid w-full min-w-0 grid-cols-1 items-start gap-3 xl:grid-cols-2">
                <FineFormCard
                    icon={Wallet}
                    iconBg="bg-teal-50"
                    iconColor="text-teal-600"
                    title="Earnings"
                    subtitle="Enter how much leave salary or ticket to pay this month. Amount comes off Total balance; After this update is what remains."
                >
                    <SlipTable
                        headers={['SL', 'Basic salary', 'Period', 'Amount']}
                        rows={monthlyEarningRows}
                        totalLabel="Total"
                        total={monthlyEarningTotal}
                    />
                    <div className="mt-3">
                        <AnnualBenefitTable rows={annualEarningRows} total={annualEarningTotal} />
                    </div>
                    <GroupTotal
                        label="Total earnings"
                        value={money(monthlyEarningTotal + annualEarningTotal)}
                    />
                </FineFormCard>

                <div className="flex min-w-0 flex-col gap-2">
                    <FineFormCard
                        icon={MinusCircle}
                        iconBg="bg-rose-50"
                        iconColor="text-rose-600"
                        title="Deductions"
                        subtitle="Loss of pay and this month's other deductions"
                    >
                        <SlipTable
                            headers={['SL', 'Loss of pay', 'Period', 'Amount']}
                            rows={lopRows}
                            totalLabel="Total"
                            total={lopTotal}
                            tone="deduct"
                        />
                        <div className="mt-3">
                            <SlipTable
                                headers={['SL', 'Deduction', 'Times', 'Total']}
                                rows={otherDeductionRows}
                                totalLabel="Total"
                                total={otherDeductionTotal}
                                tone="deduct"
                            />
                        </div>
                        <GroupTotal
                            label="Total deductions"
                            value={money(lopTotal + otherDeductionTotal)}
                            tone="deduct"
                        />
                    </FineFormCard>
                    <div className="grid grid-cols-2 gap-2">
                        <PayableMiniCard
                            title="Net salary payable"
                            hint="(Monthly earnings + Annual leave) − (Loss of pay + Deduction)"
                            value={netSalaryPayable}
                        />
                        <PayableMiniCard
                            title="Zoho salary"
                            hint="(Monthly earnings + Annual leave) − Loss of pay"
                            value={zohoSalary}
                            tone="earn"
                        />
                    </div>
                </div>
            </div>

            <FineFormCard
                icon={Table2}
                iconBg="bg-slate-50"
                iconColor="text-slate-600"
                title="Deduction"
                subtitle="This employee only. Unpaid prior-month loan, fine, utility and advance parts carry into this month. This month deduction cannot exceed Total. Remaining = Total − this month deduction."
            >
                <BalanceScheduleTable
                    rows={balanceRows}
                    onThisMonthChange={(type, value) => patchThisMonthDeduction(onPatch, type, value)}
                />
            </FineFormCard>
        </div>
    );
}
