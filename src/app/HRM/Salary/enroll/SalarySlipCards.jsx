'use client';

import { CalendarDays, CalendarRange, CircleDollarSign, MinusCircle, Table2 } from 'lucide-react';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import {
    LOSS_OF_PAY_CATALOG,
    OTHER_DEDUCTION_CATALOG,
    OTHER_EARNING_CATALOG,
    SALARY_EARNING_CATALOG,
    YEARLY_OTHER_EARNING_CATALOG,
    YEARLY_SALARY_EARNING_CATALOG,
    actualSalaryAfterDeduction,
    amountInWordsAed,
    buildSalarySlipBalanceRows,
    extraComponents,
    formatAed,
    mapComponent,
    money,
    pickComponent,
    salaryPayableZoho,
} from './salarySlipEdit';

const ATTENDANCE_FIELDS = [
    ['holidays', 'Holidays', 'days'],
    ['workingDayLeaves', 'Working day leaves', 'days'],
    ['presentDays', 'Present days', 'days'],
    ['holidaysWorked', 'Holidays worked', 'days'],
    ['calendarDays', 'Calendar days', 'days'],
    ['overtimeHours', 'Overtime hours', 'hours'],
    ['compOffLeave', 'Comp off leave', 'days'],
];

const LABEL = 'mb-1 block text-[12px] font-medium text-[#64748B]';
const FIELD =
    'h-10 w-full min-w-0 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
const FIELD_RO =
    'h-10 w-full min-w-0 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] outline-none';
const FIELD_COUNT =
    'h-10 w-[4.75rem] shrink-0 rounded-lg border border-[#E2E8F0] bg-white px-2 text-center text-sm text-[#0F172A] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
const FORM_BOX = 'rounded-xl border border-[#EEF2F6] bg-white px-3 py-2.5';
const KEEP_PERIOD_COMPONENTS = new Set(['Overtime Hours', 'Overtime Days']);

function displayText(value) {
    if (value == null || value === '') return '';
    return String(value);
}

function isQuantityBasis(basis) {
    const text = String(basis || '').trim();
    if (!text) return false;
    return /\d/.test(text) || /\b(days?|hours?|h|events?)\b/i.test(text);
}

function isCalendarPeriod(basis) {
    return /^(yearly|annual|annually|monthly|month)$/i.test(String(basis || '').trim());
}

function cleanComponentName(name) {
    return String(name || '').replace(/\s*\(\s*yearly\s*\)/gi, '').trim();
}

function shouldShowPeriodInput(name, basis, kind) {
    if (KEEP_PERIOD_COMPONENTS.has(name)) return true;
    const text = String(basis || '').trim();
    if (isQuantityBasis(text)) return true;
    if (kind === 'earn' || isCalendarPeriod(text)) return false;
    if (/^mobile$/i.test(text)) return false;
    const isUtility = String(name || '').toLowerCase() === 'utility excess';
    if (isUtility && text && !/^(schedule|installment|monthly)$/i.test(text)) return false;
    return false;
}

/** Put Approved / Mobile in the name; never append Yearly or Monthly. */
function inlinePeriodLabel(name, basis, kind) {
    if (KEEP_PERIOD_COMPONENTS.has(name)) return '';
    const text = String(basis || '').trim();
    if (isCalendarPeriod(text) || isQuantityBasis(text)) return '';
    if (kind === 'earn') return text;
    if (/^mobile$/i.test(text)) return text;
    const isUtility = String(name || '').toLowerCase() === 'utility excess';
    if (isUtility && text && !/^(schedule|installment|monthly)$/i.test(text)) return text;
    return '';
}

function fieldLabel(name, basis, kind) {
    const cleaned = cleanComponentName(name);
    const suffix = inlinePeriodLabel(cleaned, basis, kind);
    return suffix ? `${cleaned} (${suffix})` : cleaned;
}

function moneyInputValue(value) {
    const n = money(value);
    return Number.isFinite(n) ? String(n) : '';
}

function countInputValue(value) {
    const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? String(n) : '';
}

function formatCountLabel(count, unit) {
    const n = Number(count);
    const num = Number.isFinite(n) ? n : 0;
    return `${num} ${unit}`;
}

function amountToneClass(tone) {
    if (tone === 'deduct') return 'font-semibold text-red-600';
    if (tone === 'net') return 'font-semibold text-blue-600';
    return 'font-semibold text-emerald-700';
}

function AmountTableRow({
    label,
    basis,
    amount,
    kind = 'earn',
    onBasisChange,
    onAmountChange,
    tone = 'earn',
    showPeriodCol = true,
}) {
    const showPeriod = shouldShowPeriodInput(label, basis, kind);
    const title = fieldLabel(label, basis, kind);
    return (
        <tr className="border-b border-[#F1F5F9] last:border-b-0">
            <td className="px-3 py-2.5 text-sm font-semibold text-[#0F172A]">{title}</td>
            {showPeriodCol ? (
                <td className="w-[7.5rem] px-3 py-2.5">
                    {showPeriod ? (
                        <input
                            type="text"
                            value={displayText(basis)}
                            onChange={(e) => onBasisChange?.(e.target.value)}
                            className={FIELD}
                            aria-label={`${label} period`}
                        />
                    ) : (
                        <span className="text-sm text-[#94A3B8]">—</span>
                    )}
                </td>
            ) : null}
            <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        step="0.01"
                        value={moneyInputValue(amount)}
                        onChange={(e) => onAmountChange?.(e.target.value)}
                        className={`${FIELD} ${amountToneClass(tone)}`}
                        aria-label={`${label} amount`}
                    />
                    <span className="shrink-0 text-xs font-semibold text-gray-400">AED</span>
                </div>
            </td>
        </tr>
    );
}

function CountRow({ label, value, unit, onChange }) {
    const count = countInputValue(value);
    function patchCount(next) {
        onChange?.(formatCountLabel(next, unit));
    }
    return (
        <div className={FORM_BOX}>
            <span className={`${LABEL} mb-1.5 text-[13px] font-semibold text-[#334155]`}>{label}</span>
            <div className="grid grid-cols-2 gap-2">
                <label className="block min-w-0">
                    <span className={LABEL}>Unit</span>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={count}
                            onChange={(e) => patchCount(e.target.value)}
                            className={FIELD_COUNT}
                            aria-label={`${label} count`}
                        />
                        <span className="text-sm font-medium text-gray-500">{unit}</span>
                    </div>
                </label>
                <label className="block min-w-0">
                    <span className={LABEL}>Value</span>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={count}
                        onChange={(e) => patchCount(e.target.value)}
                        className={FIELD}
                        aria-label={label}
                    />
                </label>
            </div>
        </div>
    );
}

function TotalsRow({ label, value, tone }) {
    return (
        <label className={`block ${FORM_BOX}`}>
            <span className={LABEL}>{label}</span>
            <input
                readOnly
                value={formatAed(value)}
                className={`${FIELD_RO} ${amountToneClass(tone)}`}
            />
        </label>
    );
}

function GroupTotal({ label, value, tone = 'earn' }) {
    const wrap =
        tone === 'deduct'
            ? 'border-rose-100 bg-rose-50 text-rose-700'
            : tone === 'net'
                ? 'border-indigo-100 bg-indigo-50 text-indigo-700'
                : 'border-emerald-100 bg-emerald-50 text-emerald-700';
    return (
        <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${wrap}`}>
            <span className="text-xs font-medium">{label}</span>
            <span className="text-lg font-bold tabular-nums">{formatAed(value)}</span>
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
                            <th
                                key={title}
                                className="whitespace-nowrap border-b border-[#EEF2F6] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]"
                            >
                                {title}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.type} className="border-b border-[#F1F5F9] last:border-b-0">
                            <td className="whitespace-nowrap px-3 py-3 font-semibold text-[#0F172A]">{row.type}</td>
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

function patchAttendance(onPatch, key, value) {
    onPatch('attendance', (draft) => ({
        ...draft,
        attendance: { ...(draft.attendance || {}), [key]: value },
    }));
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

function liveDeductionAmount(slip, name, row) {
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

function sumEarningGroup(rows, names, extras) {
    const catalogSum = names.reduce(
        (sum, name) => sum + money(pickComponent(rows, name).amount),
        0,
    );
    const extraSum = extras.reduce((sum, row) => sum + money(row.amount), 0);
    return money(catalogSum + extraSum);
}

function sumDeductionGroup(slip, names, extras) {
    const catalogSum = names.reduce(
        (sum, name) => sum + liveDeductionAmount(slip, name, pickComponent(slip?.deductions, name)),
        0,
    );
    const extraSum = extras.reduce(
        (sum, row) => sum + liveDeductionAmount(slip, row.component, row),
        0,
    );
    return money(catalogSum + extraSum);
}

function EarningGroupCard({
    title,
    names,
    extras = [],
    rows,
    section,
    onPatch,
    totalLabel,
    total,
    defaultBasis = '',
    tone = 'earn',
    kind = 'earn',
    amountFor,
    showTitle = true,
}) {
    const isDeduct = tone === 'deduct';
    const footClass = isDeduct
        ? 'bg-rose-50 text-rose-700'
        : 'bg-emerald-50 text-emerald-700';
    const items = [
        ...names.map((name) => {
            const row = pickComponent(rows, name);
            return {
                key: name,
                label: name,
                basis: row.basis || defaultBasis,
                amount: amountFor ? amountFor(name, row) : row.amount,
            };
        }),
        ...extras.map((row) => ({
            key: row.component,
            label: row.component,
            basis: row.basis || defaultBasis,
            amount: amountFor ? amountFor(row.component, row) : row.amount,
        })),
    ];
    const showPeriodCol = items.some((item) => shouldShowPeriodInput(item.label, item.basis, kind));
    const headers = showPeriodCol ? ['Component', 'Period', 'Amount'] : ['Component', 'Amount'];
    return (
        <div className="flex h-full min-w-0 flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            {showTitle ? <h4 className="mb-3 text-sm font-bold text-gray-800">{title}</h4> : null}
            <div className="flex-1 overflow-x-auto rounded-xl border border-[#EEF2F6]">
                <table className="w-full table-fixed border-collapse text-left text-sm">
                    <thead>
                        <tr className="bg-[#F8FAFC]">
                            {headers.map((heading) => (
                                <th
                                    key={heading}
                                    className={`border-b border-[#EEF2F6] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8] ${
                                        heading === 'Amount' ? 'w-[42%]' : heading === 'Period' ? 'w-[7.5rem]' : ''
                                    }`}
                                >
                                    {heading}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <AmountTableRow
                                key={item.key}
                                label={item.label}
                                basis={item.basis}
                                amount={item.amount}
                                kind={kind}
                                tone={tone}
                                showPeriodCol={showPeriodCol}
                                onBasisChange={(value) =>
                                    patchNamedComponent(onPatch, section, item.label, { basis: value })
                                }
                                onAmountChange={(value) =>
                                    patchNamedComponent(onPatch, section, item.label, {
                                        amount: value,
                                        basis: item.basis,
                                    })
                                }
                            />
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className={footClass}>
                            <td
                                colSpan={showPeriodCol ? 2 : 1}
                                className="px-3 py-2.5 text-xs font-medium"
                            >
                                {totalLabel}
                            </td>
                            <td className="px-3 py-2.5 text-sm font-bold tabular-nums">{formatAed(total)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

export default function SalarySlipCards({ slip, onPatch }) {
    const att = slip?.attendance || {};
    const extraEarnings = extraComponents(slip?.earnings, [
        ...SALARY_EARNING_CATALOG,
        ...OTHER_EARNING_CATALOG,
    ]).filter((row) => money(row.amount) > 0);
    const extraYearlyEarnings = extraComponents(slip?.yearlyEarnings, [
        ...YEARLY_SALARY_EARNING_CATALOG,
        ...YEARLY_OTHER_EARNING_CATALOG,
    ]).filter((row) => money(row.amount) > 0);
    const leftoverDeductions = extraComponents(slip?.deductions, [
        ...LOSS_OF_PAY_CATALOG,
        ...OTHER_DEDUCTION_CATALOG,
    ]).filter((row) => money(liveDeductionAmount(slip, row.component, row)) > 0);
    const extraLossOfPay = leftoverDeductions.filter((row) =>
        /leave|late|sick|absence|lop/i.test(String(row.component || '')),
    );
    const extraOtherDeductions = leftoverDeductions.filter(
        (row) => !/leave|late|sick|absence|lop/i.test(String(row.component || '')),
    );
    const salaryEarningsTotal = sumEarningGroup(slip?.earnings, SALARY_EARNING_CATALOG, []);
    const otherEarningsTotal = sumEarningGroup(slip?.earnings, OTHER_EARNING_CATALOG, extraEarnings);
    const yearlySalaryTotal = sumEarningGroup(slip?.yearlyEarnings, YEARLY_SALARY_EARNING_CATALOG, []);
    const yearlyOtherTotal = sumEarningGroup(
        slip?.yearlyEarnings,
        YEARLY_OTHER_EARNING_CATALOG,
        extraYearlyEarnings,
    );
    const lossOfPayTotal = sumDeductionGroup(slip, LOSS_OF_PAY_CATALOG, extraLossOfPay);
    const otherDeductionsTotal = sumDeductionGroup(slip, OTHER_DEDUCTION_CATALOG, extraOtherDeductions);
    const payableZoho = salaryPayableZoho(salaryEarningsTotal, otherEarningsTotal, lossOfPayTotal);
    const actualAfterDeduction = actualSalaryAfterDeduction(payableZoho, otherDeductionsTotal);
    const balanceRows = buildSalarySlipBalanceRows(slip);

    return (
        <div className="flex w-full min-w-0 flex-col gap-6">
            <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4 text-center shadow-sm">
                {slip?.employeeName ? (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {slip.employeeName}
                        {slip?.employeeId ? ` · ${slip.employeeId}` : ''}
                    </p>
                ) : null}
                <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-800 sm:text-2xl">
                    Salary calculation
                </h2>
                {slip?.monthLabel ? (
                    <p className="mt-1 text-sm text-slate-500">{slip.monthLabel}</p>
                ) : null}
            </div>

            <FineFormCard
                icon={CalendarRange}
                iconBg="bg-teal-50"
                iconColor="text-teal-600"
                title="Earnings"
                subtitle="Salary earnings and other earnings"
            >
                <div className="rounded-2xl bg-[#F8FAFC] p-3 sm:p-4">
                    <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                        <EarningGroupCard
                            title="Salary earnings"
                            names={YEARLY_SALARY_EARNING_CATALOG}
                            extras={[]}
                            rows={slip?.yearlyEarnings}
                            section="yearlyEarnings"
                            onPatch={onPatch}
                            totalLabel="Salary earnings total"
                            total={yearlySalaryTotal}
                            defaultBasis="Yearly"
                        />
                        <EarningGroupCard
                            title="Other earnings"
                            names={YEARLY_OTHER_EARNING_CATALOG}
                            extras={extraYearlyEarnings}
                            rows={slip?.yearlyEarnings}
                            section="yearlyEarnings"
                            onPatch={onPatch}
                            totalLabel="Other earnings total"
                            total={yearlyOtherTotal}
                            defaultBasis="Yearly"
                        />
                    </div>
                </div>
                <GroupTotal label="Total earnings" value={slip?.yearlyGrossEarnings} />
            </FineFormCard>

            <FineFormCard
                icon={MinusCircle}
                iconBg="bg-rose-50"
                iconColor="text-rose-600"
                title="Deductions"
                subtitle="Loss of pay and other deductions this month"
            >
                <div className="rounded-2xl bg-[#F8FAFC] p-3 sm:p-4">
                    <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                        <EarningGroupCard
                            title="Loss of pay"
                            names={LOSS_OF_PAY_CATALOG}
                            extras={extraLossOfPay}
                            rows={slip?.deductions}
                            section="deductions"
                            onPatch={onPatch}
                            totalLabel="Loss of pay total"
                            total={lossOfPayTotal}
                            tone="deduct"
                            kind="deduct"
                            amountFor={(name, row) => liveDeductionAmount(slip, name, row)}
                        />
                        <EarningGroupCard
                            title="Other deductions"
                            names={OTHER_DEDUCTION_CATALOG}
                            extras={extraOtherDeductions}
                            rows={slip?.deductions}
                            section="deductions"
                            onPatch={onPatch}
                            totalLabel="Other deductions total"
                            total={otherDeductionsTotal}
                            tone="deduct"
                            kind="deduct"
                            amountFor={(name, row) => liveDeductionAmount(slip, name, row)}
                        />
                    </div>
                </div>
                <GroupTotal label="Deductions total" value={slip?.totalDeductions} tone="deduct" />
            </FineFormCard>

            <FineFormCard
                icon={CalendarRange}
                iconBg="bg-teal-50"
                iconColor="text-teal-600"
                title="This month"
                subtitle="Overtime and extra earnings this salary month"
            >
                <div className="rounded-2xl bg-[#F8FAFC] p-3 sm:p-4">
                    <EarningGroupCard
                        title="This month"
                        names={OTHER_EARNING_CATALOG}
                        extras={extraEarnings}
                        rows={slip?.earnings}
                        section="earnings"
                        onPatch={onPatch}
                        totalLabel="This month extras total"
                        total={otherEarningsTotal}
                        defaultBasis="Monthly"
                        showTitle={false}
                    />
                </div>
            </FineFormCard>

            <div className="grid w-full min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-2">
                <FineFormCard
                    icon={CalendarDays}
                    iconBg="bg-sky-50"
                    iconColor="text-sky-600"
                    title="Employee & Attendance Summary"
                    subtitle="Days, hours, and leave for this salary month"
                >
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {ATTENDANCE_FIELDS.map(([key, label, unit]) => (
                            <CountRow
                                key={key}
                                label={label}
                                value={att[key]}
                                unit={unit}
                                onChange={(value) => patchAttendance(onPatch, key, value)}
                            />
                        ))}
                    </div>
                </FineFormCard>

                <FineFormCard
                    icon={CircleDollarSign}
                    iconBg="bg-indigo-50"
                    iconColor="text-indigo-600"
                    title="Other information"
                    subtitle="Salary payable for Zoho, then this month's other deductions"
                >
                    <div className="flex flex-col gap-2.5">
                        <TotalsRow label="Salary payable (Zoho)" value={payableZoho} tone="earn" />
                        <TotalsRow
                            label="Actual salary after deduction"
                            value={actualAfterDeduction}
                            tone="net"
                        />
                        <TotalsRow label="Net salary" value={actualAfterDeduction} tone="net" />
                    </div>
                    <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-indigo-500">
                            Amount in words
                        </span>
                        <p className="mt-1 text-sm font-semibold leading-relaxed text-indigo-800">
                            {amountInWordsAed(actualAfterDeduction)}
                        </p>
                    </div>
                </FineFormCard>
            </div>

            <FineFormCard
                icon={Table2}
                iconBg="bg-slate-50"
                iconColor="text-slate-600"
                title="Loan, advance, fine, utilities and leave benefits"
                subtitle="This employee only. Loan, advance, fine and utilities use this salary month's installment — not the full outstanding."
            >
                <BalanceScheduleTable rows={balanceRows} />
            </FineFormCard>
        </div>
    );
}
