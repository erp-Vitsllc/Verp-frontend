'use client';

import { useMemo } from 'react';
import { Wallet } from 'lucide-react';
import { isLossDamageFineType } from './LossDamageFineDetailsSection';
import { FineFormCard, formatMoney } from './FineFormCardShared';
import {
    categorizeEmployeeFine,
    filterApprovedEmployeeFines,
    resolveEmployeeFinePaidAmount,
} from '../utils/employeeFineFinancials';
import { resolveEmployeeFinePayableAmount } from '@/utils/finePayableAmount';

const FINE_ROWS = [
    { key: 'Vehicle', label: 'Vehicle Fine' },
    { key: 'Safety', label: 'Safety Fine' },
    { key: 'Project', label: 'Project Fine' },
    { key: 'Loss', label: 'Loss and damage' },
    { key: 'Other', label: 'Other fine' },
];

function sumCategoryBySource(matching, employeeOwnerId, sourceFilter) {
    const filtered = matching.filter((f) => {
        const src = f.sourceOfIncome || 'Salary';
        return sourceFilter === 'eos' ? src === 'End of Service' : src !== 'End of Service';
    });
    let amount = 0;
    let paid = 0;
    let count = 0;
    filtered.forEach((fine) => {
        const share = resolveEmployeeFinePayableAmount(fine, employeeOwnerId);
        if (share <= 0) return;
        amount += share;
        paid += resolveEmployeeFinePaidAmount(fine, employeeOwnerId, share);
        count += 1;
    });
    return { amount, paid, count, outstanding: Math.max(0, amount - paid) };
}

function SourceBreakdown({ salary, eos }) {
    const hasSalary = salary.amount > 0 || salary.paid > 0;
    const hasEos = eos.amount > 0 || eos.paid > 0;

    if (hasSalary && hasEos) {
        return (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>Salary ({formatMoney(salary.amount)})</span>
                <span className="text-amber-700 font-medium">
                    End of Service ({formatMoney(eos.amount)})
                </span>
            </span>
        );
    }
    if (hasEos) {
        return <span className="text-amber-700 font-medium">End of Service</span>;
    }
    return <span>Salary</span>;
}

function FooterSourceBreakdown({ salary, eos }) {
    const hasSalary = salary.amount > 0 || salary.paid > 0;
    const hasEos = eos.amount > 0 || eos.paid > 0;

    if (hasSalary && hasEos) {
        return (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 font-bold">
                <span>Salary ({formatMoney(salary.amount)})</span>
                <span className="text-amber-700">
                    End of Service ({formatMoney(eos.amount)})
                </span>
            </span>
        );
    }
    return <span>Sum</span>;
}

export default function FineFormCard3({
    fine,
    isCompanyFine = false,
    fineSummaries,
    allEmployeeFines = [],
    employeeOwnerId,
    showFinancialCards = false,
}) {
    const tableData = useMemo(() => {
        const advance = fineSummaries?.salaryAdvance || { amount: 0, paid: 0, count: 0 };
        const loan = fineSummaries?.personalLoan || { amount: 0, paid: 0, count: 0 };

        const approved = filterApprovedEmployeeFines(allEmployeeFines, employeeOwnerId);

        const fineRows = FINE_ROWS.map(({ key, label }) => {
            const matching = approved.filter((f) => categorizeEmployeeFine(f) === key);
            const salary = sumCategoryBySource(matching, employeeOwnerId, 'salary');
            const eos = sumCategoryBySource(matching, employeeOwnerId, 'eos');
            const count = salary.count + eos.count;
            const amount = salary.amount + eos.amount;
            const paid = salary.paid + eos.paid;
            return {
                key,
                label: `${label} (${count || 0})`,
                amount,
                paid,
                outstanding: Math.max(0, amount - paid),
                salary,
                eos,
            };
        });

        const advanceRow = {
            key: 'advance',
            label: `Advance (${advance.count || 0})`,
            amount: parseFloat(advance.amount) || 0,
            paid: parseFloat(advance.paid) || 0,
            outstanding: Math.max(0, (parseFloat(advance.amount) || 0) - (parseFloat(advance.paid) || 0)),
            salary: {
                amount: parseFloat(advance.amount) || 0,
                paid: parseFloat(advance.paid) || 0,
                count: advance.count || 0,
                outstanding: Math.max(0, (parseFloat(advance.amount) || 0) - (parseFloat(advance.paid) || 0)),
            },
            eos: { amount: 0, paid: 0, count: 0, outstanding: 0 },
        };

        const loanRow = {
            key: 'loan',
            label: `Loan (${loan.count || 0})`,
            amount: parseFloat(loan.amount) || 0,
            paid: parseFloat(loan.paid) || 0,
            outstanding: Math.max(0, (parseFloat(loan.amount) || 0) - (parseFloat(loan.paid) || 0)),
            salary: {
                amount: parseFloat(loan.amount) || 0,
                paid: parseFloat(loan.paid) || 0,
                count: loan.count || 0,
                outstanding: Math.max(0, (parseFloat(loan.amount) || 0) - (parseFloat(loan.paid) || 0)),
            },
            eos: { amount: 0, paid: 0, count: 0, outstanding: 0 },
        };

        const rows = [...fineRows, advanceRow, loanRow];
        const totals = rows.reduce(
            (acc, row) => ({
                amount: acc.amount + row.amount,
                paid: acc.paid + row.paid,
                outstanding: acc.outstanding + row.outstanding,
                salary: {
                    amount: acc.salary.amount + row.salary.amount,
                    paid: acc.salary.paid + row.salary.paid,
                    outstanding: acc.salary.outstanding + row.salary.outstanding,
                },
                eos: {
                    amount: acc.eos.amount + row.eos.amount,
                    paid: acc.eos.paid + row.eos.paid,
                    outstanding: acc.eos.outstanding + row.eos.outstanding,
                },
            }),
            {
                amount: 0,
                paid: 0,
                outstanding: 0,
                salary: { amount: 0, paid: 0, outstanding: 0 },
                eos: { amount: 0, paid: 0, outstanding: 0 },
            },
        );

        return { rows, totals };
    }, [fineSummaries, allEmployeeFines, employeeOwnerId]);

    if (!showFinancialCards && (!fine || !isLossDamageFineType(fine) || isCompanyFine)) return null;

    const { rows, totals } = tableData;

    return (
        <FineFormCard
            icon={Wallet}
            iconBg="bg-purple-50"
            iconColor="text-purple-600"
            title="Payment Summary"
            subtitle="Approved fines, advances and loans for this employee"
        >
            <div className="overflow-x-auto -mx-1">
                <table className="w-full min-w-[640px] text-sm">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left py-3 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                Payment type
                            </th>
                            <th className="text-right py-3 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                Amount
                            </th>
                            <th className="text-right py-3 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                Paid
                            </th>
                            <th className="text-left py-3 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                Source
                            </th>
                            <th className="text-right py-3 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                Outstanding
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.key} className="border-b border-gray-50 hover:bg-gray-50/50">
                                <td className="py-3 px-2 font-medium text-gray-800">{row.label}</td>
                                <td
                                    className={`py-3 px-2 text-right font-semibold ${
                                        row.amount > 0 ? 'text-red-600' : 'text-gray-700'
                                    }`}
                                >
                                    {formatMoney(row.amount)}
                                </td>
                                <td className="py-3 px-2 text-right text-gray-700">
                                    {row.paid > 0 ? formatMoney(row.paid) : '0'}
                                </td>
                                <td className="py-3 px-2 text-gray-600">
                                    <SourceBreakdown salary={row.salary} eos={row.eos} />
                                </td>
                                <td
                                    className={`py-3 px-2 text-right font-semibold ${
                                        row.outstanding > 0 ? 'text-red-600' : 'text-gray-700'
                                    }`}
                                >
                                    {formatMoney(row.outstanding)}
                                </td>
                            </tr>
                        ))}
                        <tr className="bg-gray-50/80">
                            <td className="py-3 px-2 font-bold text-gray-800">Total</td>
                            <td className="py-3 px-2 text-right font-bold text-red-600">
                                {formatMoney(totals.amount)}
                            </td>
                            <td className="py-3 px-2 text-right font-bold text-red-600">
                                {formatMoney(totals.paid)}
                            </td>
                            <td className="py-3 px-2 font-bold text-gray-600">
                                <FooterSourceBreakdown salary={totals.salary} eos={totals.eos} />
                            </td>
                            <td className="py-3 px-2 text-right font-bold text-red-600">
                                {formatMoney(totals.outstanding)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </FineFormCard>
    );
}
