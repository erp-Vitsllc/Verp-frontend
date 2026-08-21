'use client';

import { ChevronDown } from 'lucide-react';
import { formatAed } from '../utils/utilityBillStats';
import { ALL_MONTHS, MONTH_OPTIONS } from '../utils/utilityOverviewStats';
import { hexToRgba, utilityTypeColor, utilityTypeIcon } from '../utils/utilityTypeVisuals';
import UtilityTypeMonthChart from './UtilityTypeMonthChart';

const SELECT_WRAP = 'relative shrink-0';
const SELECT_CLASS =
    'h-8 appearance-none rounded-lg border border-[#E5EAF0] bg-white pl-2.5 pr-7 text-[12px] font-medium text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400';

function periodLabel(month, year) {
    if (month === ALL_MONTHS) return String(year || '');
    const opt = MONTH_OPTIONS.find((m) => m.value === String(month));
    return `${opt?.label || month} ${year || ''}`.trim();
}

function typeAmount(item) {
    const billed = Number(item.actualAmount) || 0;
    if ((Number(item.count) || 0) > 0) return billed;
    return Number(item.contractAmount) || 0;
}

function TypeSelect({ value, onChange, ariaLabel, className, children }) {
    return (
        <div className={SELECT_WRAP}>
            <select value={value} onChange={onChange} className={`${SELECT_CLASS} ${className || ''}`} aria-label={ariaLabel}>
                {children}
            </select>
            <ChevronDown
                size={13}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8]"
            />
        </div>
    );
}

export default function UtilityTypeOverviewCard({
    cards = [],
    activeType = '',
    onSelectType,
    month = ALL_MONTHS,
    year = '',
    yearOptions = [],
    onMonthChange,
    onYearChange,
    chartRows = [],
    chartTypes = [],
}) {
    const years =
        Array.isArray(yearOptions) && yearOptions.length
            ? yearOptions
            : [year || String(new Date().getFullYear())].filter(Boolean);

    return (
        <div className="flex h-full min-h-0 flex-col overflow-visible">
            <div className="relative z-20 mb-1 flex shrink-0 items-center justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] leading-tight text-[#1A2B48] sm:text-[13px]">
                        Utility Overview
                    </h3>
                    <p className="mt-0 text-[10px] font-medium leading-tight text-[#94A3B8] sm:text-[11px]">
                        Monthly amount and bill quantity
                        {periodLabel(month, year) ? ` • ${periodLabel(month, year)}` : ''}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <TypeSelect
                        value={month}
                        onChange={(e) => onMonthChange?.(e.target.value)}
                        ariaLabel="Filter by month"
                        className="min-w-[7.5rem]"
                    >
                        <option value={ALL_MONTHS}>All months</option>
                        {MONTH_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </TypeSelect>
                    <TypeSelect
                        value={year}
                        onChange={(e) => onYearChange?.(e.target.value)}
                        ariaLabel="Filter by year"
                        className="min-w-[4.75rem]"
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </TypeSelect>
                </div>
            </div>

            {cards.length === 0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-3">
                    <p className="text-center text-xs text-[#94A3B8]">No utility types yet.</p>
                </div>
            ) : (
                <>
                    <div
                        className={`mb-1 grid shrink-0 gap-1.5 ${
                            cards.length === 1
                                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                                : 'grid-cols-2 lg:grid-cols-4'
                        }`}
                    >
                        {cards.map((item, index) => {
                            const color = utilityTypeColor(index);
                            const Icon = utilityTypeIcon(item.type, index);
                            const isActive =
                                String(activeType || '').toLowerCase() ===
                                String(item.type || '').toLowerCase();
                            const count = Number(item.count) || 0;
                            return (
                                <button
                                    key={item.type}
                                    type="button"
                                    onClick={() => onSelectType?.(item.type)}
                                    className="flex h-[46px] items-center rounded-lg border px-2 py-1 text-left transition-shadow hover:shadow-sm"
                                    style={{
                                        borderColor: isActive ? color : hexToRgba(color, 0.38),
                                        background: hexToRgba(color, isActive ? 0.12 : 0.07),
                                        boxShadow: isActive ? `0 0 0 1px ${hexToRgba(color, 0.28)}` : undefined,
                                    }}
                                    title={`${item.label}: ${count} bill${count === 1 ? '' : 's'} · ${periodLabel(month, year)}`}
                                >
                                    <div className="flex min-w-0 w-full items-center gap-2">
                                        <span
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                                            style={{ backgroundColor: color }}
                                        >
                                            <Icon size={13} strokeWidth={2.2} />
                                        </span>
                                        <div className="min-w-0 flex-1 leading-none">
                                            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                                {item.label}
                                            </p>
                                            <div className="mt-0.5 flex items-baseline justify-between gap-2">
                                                <p
                                                    className="truncate text-[13px] font-extrabold tabular-nums leading-tight"
                                                    style={{ color }}
                                                >
                                                    {formatAed(typeAmount(item))}
                                                </p>
                                                <p className="shrink-0 text-[9px] font-medium leading-tight text-[#64748B]">
                                                    {count} {count === 1 ? 'Bill' : 'Bills'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="min-h-0 flex-1">
                        <UtilityTypeMonthChart rows={chartRows} types={chartTypes} minHeight={168} />
                    </div>
                </>
            )}
        </div>
    );
}
