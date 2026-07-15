'use client';

import { formatBillMoney, summarizeUtilityBills } from '../utils/utilityBillStats';

/**
 * Compact bill status / amount boxes for header cards.
 */
export default function UtilityBillStatsCards({ bills = [], emptyLabel = 'No bills yet.' }) {
    const stats = summarizeUtilityBills(bills);
    const boxes = [
        {
            key: 'pendingAccounts',
            label: 'Pending Accounts',
            count: stats.pendingAccounts.count,
            amount: stats.pendingAccounts.amount,
        },
        {
            key: 'pendingHr',
            label: 'Pending HR',
            count: stats.pendingHr.count,
            amount: stats.pendingHr.amount,
        },
        {
            key: 'notPaid',
            label: 'Not Paid',
            count: stats.notPaid.count,
            amount: stats.notPaid.amount,
        },
        {
            key: 'paid',
            label: 'Paid',
            count: stats.paid.count,
            amount: stats.paid.amount,
        },
    ].filter((b) => b.count > 0);

    if (!stats.totalCount) {
        return (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3 min-h-0">
                <p className="text-xs sm:text-sm text-gray-500 text-center">{emptyLabel}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 flex-1 content-start min-h-0">
            {boxes.map((box) => (
                <div
                    key={box.key}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-2 sm:p-3 flex flex-col items-center justify-center text-center min-h-[56px] sm:min-h-[64px]"
                >
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 leading-tight">
                        {box.label}
                    </span>
                    <span className="text-xl sm:text-2xl font-black tabular-nums text-red-600 leading-none">
                        {box.count}
                    </span>
                    <span className="text-[10px] sm:text-xs font-semibold tabular-nums text-gray-600 mt-1">
                        {formatBillMoney(box.amount)} AED
                    </span>
                </div>
            ))}
            <div className="col-span-2 sm:col-span-4 rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-teal-700">
                    Bills total
                </span>
                <span className="text-xs sm:text-sm font-bold tabular-nums text-teal-900">
                    {stats.totalCount} · {formatBillMoney(stats.totalAmount)} AED
                </span>
            </div>
        </div>
    );
}
