'use client';

import { MinusCircle, Table2, Wallet } from 'lucide-react';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import {
    buildSalarySlipBalanceRows,
    formatAed,
    mapComponent,
    money,
    pickComponent,
} from './salarySlipEdit';

const FIELD =
    'h-9 w-full min-w-0 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-sm text-[#0F172A] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
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

function BalanceScheduleTable({ rows }) {
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
                            <td className={`whitespace-nowrap px-3 py-3 tabular-nums ${amountToneClass('deduct')}`}>
                                {formatAed(row.thisMonthDeduction)}
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

function sumThisMonth(rows, read) {
    return money((Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + money(read(row)), 0));
}

function liveDeductionAmount(slip, name) {
    const row = pickComponent(slip?.deductions, name);
    const fromRow = money(row?.amount);
    if (fromRow > 0) return fromRow;
    const recon = slip?.reconciliation || {};
    if (name === 'Fine') {
        return money(recon.fine) || sumThisMonth(slip?.fines, (item) => item.thisMonthAmount ?? item.thisMonth);
    }
    if (name === 'Loan') {
        return (
            money(recon.loan) ||
            sumThisMonth(
                (slip?.loanSchedule || []).filter((item) => !/advance/i.test(String(item.type || ''))),
                (item) => item.thisMonthAmount ?? item.thisMonth,
            )
        );
    }
    if (name === 'Salary Advance') {
        return (
            money(recon.salaryAdvance) ||
            sumThisMonth(
                (slip?.loanSchedule || []).filter((item) => /advance/i.test(String(item.type || ''))),
                (item) => item.thisMonthAmount ?? item.thisMonth,
            )
        );
    }
    if (name === 'Utility Excess') {
        return (
            money(recon.utilityExcess) ||
            sumThisMonth(slip?.utilities, (item) => item.total ?? item.thisMonthAmount ?? item.amount)
        );
    }
    return fromRow;
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

function AmountCell({ label, amount, tone, onChange }) {
    const editable = typeof onChange === 'function';
    return (
        <div className="flex items-center gap-2">
            <input
                type="number"
                step="0.01"
                readOnly={!editable}
                value={moneyInputValue(amount)}
                onChange={(e) => onChange?.(e.target.value)}
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
    const leaveCount = Number(leaveBenefit.count) || (leaveSalaryAmount > 0 ? 1 : 0);
    const ticketCount = Number(ticketBenefit.count) || (airTicketAmount > 0 ? 1 : 0);
    const annualEarningRows = [
        {
            key: 'leave-salary',
            sl: 1,
            name: 'Leave Salary',
            section: 'yearlyEarnings',
            label: 'Annual leave salary',
            period: unitLabel(leaveCount, 'leave'),
            amount: leaveSalaryAmount,
        },
        {
            key: 'air-ticket',
            sl: 2,
            name: 'Travel Allowance',
            altName: 'Ticket',
            section: 'yearlyEarnings',
            label: 'Annual leave air ticket',
            period: unitLabel(ticketCount, 'ticket'),
            amount: airTicketAmount,
        },
    ].map((row) => ({
        ...row,
        amountCell: (
            <AmountCell
                label={row.label}
                amount={row.amount}
                onChange={(value) => {
                    patchNamedComponent(onPatch, 'yearlyEarnings', row.name, {
                        amount: value,
                        basis: 'Yearly',
                    });
                    if (row.altName) {
                        patchNamedComponent(onPatch, 'earnings', row.altName, { amount: value });
                    }
                }}
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

    const otherDeductionRows = OTHER_DEDUCTION_ROWS.map((item, index) => {
        const amount = liveDeductionAmount(slip, item.name);
        const times = Number(otherTimes[item.timesKey]) || (amount > 0 ? 1 : 0);
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
                    onChange={(value) =>
                        patchNamedComponent(onPatch, 'deductions', item.name, { amount: value })
                    }
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
    const balanceRows = buildSalarySlipBalanceRows(slip);

    return (
        <div className="flex w-full min-w-0 flex-col gap-3">
            <div className="grid w-full min-w-0 grid-cols-1 items-start gap-3 xl:grid-cols-2">
                <FineFormCard
                    icon={Wallet}
                    iconBg="bg-teal-50"
                    iconColor="text-teal-600"
                    title="Earnings"
                    subtitle="Monthly earnings and annual leave benefits"
                >
                    <SlipTable
                        headers={['SL', 'Basic salary', 'Period', 'Amount']}
                        rows={monthlyEarningRows}
                        totalLabel="Total"
                        total={monthlyEarningTotal}
                    />
                    <div className="mt-3">
                        <SlipTable
                            headers={['SL', 'Earning', 'Period', 'Amount']}
                            rows={annualEarningRows}
                            totalLabel="Total"
                            total={annualEarningTotal}
                        />
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
                subtitle="This employee only. Approved loan, fine, utility and salary advance. Balance = total − employee pay − this month salary deduction."
            >
                <BalanceScheduleTable rows={balanceRows} />
            </FineFormCard>
        </div>
    );
}
