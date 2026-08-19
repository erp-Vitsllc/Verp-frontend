'use client';

import { AnimatedCounter } from '@/app/HRM/Asset/components/ListPageSummaryCards';
import { formatBillMoney } from '../utils/utilityBillStats';
import { ALL_MONTHS, MONTH_OPTIONS } from '../utils/utilityOverviewStats';
import UtilityTypeDistributionChart from './UtilityTypeDistributionChart';

const SELECT_CLASS =
    'h-8 min-w-[7.5rem] rounded-md border border-gray-200 bg-white px-2 text-[11px] font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400';

function periodLabel(month, year) {
    if (month === ALL_MONTHS) return `All months · ${year || '—'}`;
    const opt = MONTH_OPTIONS.find((m) => m.value === String(month));
    return `${opt?.label || month} ${year || ''}`.trim();
}

/**
 * Top row: every utility type + bill count for the selected period.
 * Bottom row: matching type amount cards (difference + actual) for that month,
 * or the full year when "All months" is selected.
 */
export default function UtilityTypeOverviewCard({
    cards = [],
    activeType = '',
    onSelectType,
    month = ALL_MONTHS,
    year = '',
    yearOptions = [],
    onMonthChange,
    onYearChange,
    typeDistribution = [],
    deductionTotal = 0,
}) {
    const years =
        Array.isArray(yearOptions) && yearOptions.length
            ? yearOptions
            : [year || String(new Date().getFullYear())].filter(Boolean);

    return (
        <div className="h-full flex flex-col min-h-0 overflow-visible">
            <div className="relative z-20 flex items-center justify-between gap-2 mb-2 sm:mb-3 shrink-0">
                <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                    Utility Overview
                </h3>
                <div className="flex items-center gap-1.5 shrink-0">
                    <select
                        value={month}
                        onChange={(e) => onMonthChange?.(e.target.value)}
                        className={SELECT_CLASS}
                        aria-label="Filter by month"
                    >
                        <option value={ALL_MONTHS}>All months</option>
                        {MONTH_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => onYearChange?.(e.target.value)}
                        className={`${SELECT_CLASS} min-w-[4.75rem]`}
                        aria-label="Filter by year"
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <p className="mb-2 text-[10px] font-semibold text-gray-400 shrink-0">
                Showing {month === ALL_MONTHS ? 'full year' : 'month'} totals for{' '}
                {periodLabel(month, year)}
            </p>

            {cards.length === 0 ? (
                <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3 min-h-0">
                    <p className="text-xs sm:text-sm text-gray-500 text-center">
                        No utility types yet.
                    </p>
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 gap-3">
                    <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
                        <div className="flex h-full min-h-0 gap-2.5 pb-0.5">
                            {cards.map((item) => {
                                const isActive =
                                    String(activeType || '').toLowerCase() ===
                                    String(item.type || '').toLowerCase();
                                const hasBills = (Number(item.count) || 0) > 0;
                                return (
                                    <div
                                        key={item.type}
                                        className="flex w-[7.75rem] shrink-0 flex-col gap-2 min-h-0 sm:w-[8.5rem]"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => onSelectType?.(item.type)}
                                            className={`flex shrink-0 flex-col items-center justify-center rounded-xl border px-1.5 py-2 text-center transition-all ${
                                                isActive
                                                    ? 'border-blue-300 bg-blue-50 shadow-sm ring-1 ring-blue-200'
                                                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                                            }`}
                                            title={`${item.label}: ${item.count} bill${item.count === 1 ? '' : 's'} · ${periodLabel(month, year)}`}
                                        >
                                            <span className="line-clamp-2 break-words text-[8px] font-bold uppercase leading-tight tracking-wider text-gray-400">
                                                {item.label}
                                            </span>
                                            <span className="mt-1 text-base font-black tabular-nums leading-none text-red-600">
                                                <AnimatedCounter value={item.count} />
                                            </span>
                                            <span className="mt-1 text-[9px] font-bold uppercase tracking-wide text-gray-400">
                                                {item.count === 1 ? 'Bill' : 'Bills'}
                                            </span>
                                        </button>

                                        <div
                                            className={`flex items-center justify-center rounded-xl border px-2 py-2.5 text-center ${
                                                isActive
                                                    ? 'border-blue-200 bg-blue-50/40'
                                                    : 'border-gray-100 bg-gray-50/50'
                                            }`}
                                            title={
                                                hasBills && Number(item.difference) > 0
                                                    ? `Difference ${formatBillMoney(item.difference)} / Contract ${formatBillMoney(item.contractAmount || 0)}`
                                                    : `Contract ${formatBillMoney(item.contractAmount || 0)}`
                                            }
                                        >
                                            {hasBills && Number(item.difference) > 0 ? (
                                                <span className="text-[11px] font-black tabular-nums leading-tight">
                                                    <span className="text-rose-600">
                                                        {formatBillMoney(item.difference || 0)}
                                                    </span>
                                                    <span className="font-bold text-gray-400"> / </span>
                                                    <span className="text-gray-700">
                                                        {formatBillMoney(item.contractAmount || 0)}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-black tabular-nums text-gray-700">
                                                    {formatBillMoney(item.contractAmount || 0)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex w-[9.5rem] shrink-0 flex-col min-h-0 sm:w-[10.5rem] lg:w-[11.5rem]">
                        <UtilityTypeDistributionChart
                            slices={typeDistribution}
                            centerTotal={deductionTotal}
                            minHeight={100}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
