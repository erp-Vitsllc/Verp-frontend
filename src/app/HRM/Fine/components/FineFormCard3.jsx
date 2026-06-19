'use client';

import { useMemo } from 'react';
import { Wallet } from 'lucide-react';
import { isLossDamageFineType } from './LossDamageFineDetailsSection';
import { FineFormCard, formatMoney } from './FineFormCardShared';

const FINE_ROWS = [
    { key: 'Vehicle', label: 'Vehicle Fine' },
    { key: 'Safety', label: 'Safety Fine' },
    { key: 'Project', label: 'Project Fine' },
    { key: 'Loss', label: 'Loss and damage' },
    { key: 'Other', label: 'Other fine' },
];

function categorizeFine(f) {
    const fType = (f.fineType || f.category || f.subCategory || '').toLowerCase();
    if (fType.includes('vehicle')) return 'Vehicle';
    if (fType.includes('safety')) return 'Safety';
    if (fType.includes('project')) return 'Project';
    if (fType.includes('loss and damage')) return 'Loss';
    if (fType.includes('loss') || (fType.includes('damage') && !fType.includes('other'))) return 'Loss';
    if (fType.includes('property')) return 'Loss';
    return 'Other';
}

function resolveSourceForCategory(catKey, fines, fallback = 'Salary') {
    const matching = (fines || []).filter((f) => categorizeFine(f) === catKey);
    const withSource = matching.find((f) => f.sourceOfIncome);
    return withSource?.sourceOfIncome || fallback;
}

export default function FineFormCard3({
    fine,
    isCompanyFine = false,
    fineSummaries,
    allEmployeeFines = [],
}) {
    const tableData = useMemo(() => {
        const aggregates = fineSummaries?.aggregates || {};
        const advance = fineSummaries?.salaryAdvance || { amount: 0, paid: 0, count: 0 };
        const loan = fineSummaries?.personalLoan || { amount: 0, paid: 0, count: 0 };

        const fineRows = FINE_ROWS.map(({ key, label }) => {
            const agg = aggregates[key] || { amount: 0, paid: 0, count: 0 };
            const amount = parseFloat(agg.amount) || 0;
            const paid = parseFloat(agg.paid) || 0;
            return {
                key,
                label: `${label} (${agg.count || 0})`,
                amount,
                paid,
                source: resolveSourceForCategory(key, allEmployeeFines),
                outstanding: Math.max(0, amount - paid),
            };
        });

        const advanceRow = {
            key: 'advance',
            label: `Advance (${advance.count || 0})`,
            amount: parseFloat(advance.amount) || 0,
            paid: parseFloat(advance.paid) || 0,
            source: 'Salary',
            outstanding: Math.max(0, (parseFloat(advance.amount) || 0) - (parseFloat(advance.paid) || 0)),
        };

        const loanRow = {
            key: 'loan',
            label: `Loan (${loan.count || 0})`,
            amount: parseFloat(loan.amount) || 0,
            paid: parseFloat(loan.paid) || 0,
            source: 'Salary',
            outstanding: Math.max(0, (parseFloat(loan.amount) || 0) - (parseFloat(loan.paid) || 0)),
        };

        const rows = [...fineRows, advanceRow, loanRow];
        const totals = rows.reduce(
            (acc, row) => ({
                amount: acc.amount + row.amount,
                paid: acc.paid + row.paid,
                outstanding: acc.outstanding + row.outstanding,
            }),
            { amount: 0, paid: 0, outstanding: 0 },
        );

        return { rows, totals };
    }, [fineSummaries, allEmployeeFines]);

    if (!fine || !isLossDamageFineType(fine) || isCompanyFine) return null;

    const { rows, totals } = tableData;

    return (
        <FineFormCard
            icon={Wallet}
            iconBg="bg-purple-50"
            iconColor="text-purple-600"
            title="Payment Summary"
            subtitle="Outstanding fines, advances and loans"
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
                                <td className="py-3 px-2 text-gray-600">{row.source}</td>
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
                            <td className="py-3 px-2 font-bold text-gray-600">Sum</td>
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
