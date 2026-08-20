'use client';

import { ChevronDown } from 'lucide-react';
import { formatAed } from '../utils/utilityBillStats';
import { ALL_MONTHS, MONTH_OPTIONS } from '../utils/utilityOverviewStats';
import { hexToRgba, utilityTypeColor, utilityTypeIcon } from '../utils/utilityTypeVisuals';
import UtilityTypeMonthChart from './UtilityTypeMonthChart';

const SELECT_WRAP = 'relative shrink-0';
const SELECT_CLASS =
    'h-9 appearance-none rounded-lg border border-[#E5EAF0] bg-white pl-3 pr-8 text-[13px] font-medium text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400';

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
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
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
            <div className="relative z-20 mb-4 flex shrink-0 items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1A2B48]">
                        Utility Overview
                    </h3>
                    <p className="mt-1 text-[12px] font-medium text-[#94A3B8]">
                        Monthly amount and bill quantity
                        {periodLabel(month, year) ? ` • ${periodLabel(month, year)}` : ''}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <TypeSelect
                        value={month}
                        onChange={(e) => onMonthChange?.(e.target.value)}
                        ariaLabel="Filter by month"
                        className="min-w-[8.25rem]"
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
                        className="min-w-[5.25rem]"
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
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-3">
                    <p className="text-center text-sm text-[#94A3B8]">No utility types yet.</p>
                </div>
            ) : (
                <>
                    <div
                        className={`mb-4 grid shrink-0 gap-2.5 sm:gap-3 ${
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
                                    className="rounded-2xl border px-3 py-3 text-left transition-shadow hover:shadow-sm"
                                    style={{
                                        borderColor: isActive ? color : hexToRgba(color, 0.38),
                                        background: hexToRgba(color, isActive ? 0.12 : 0.07),
                                        boxShadow: isActive ? `0 0 0 1px ${hexToRgba(color, 0.28)}` : undefined,
                                    }}
                                    title={`${item.label}: ${count} bill${count === 1 ? '' : 's'} · ${periodLabel(month, year)}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                                            style={{ backgroundColor: color }}
                                        >
                                            <Icon size={18} strokeWidth={2.2} />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
                                                {item.label}
                                            </p>
                                            <p
                                                className="mt-0.5 truncate text-[16px] font-extrabold tabular-nums leading-tight sm:text-[17px]"
                                                style={{ color }}
                                            >
                                                {formatAed(typeAmount(item))}
                                            </p>
                                            <p className="mt-0.5 text-[12px] font-medium text-[#64748B]">
                                                {count} {count === 1 ? 'Bill' : 'Bills'}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="min-h-0 flex-1">
                        <UtilityTypeMonthChart rows={chartRows} types={chartTypes} minHeight={220} />
                    </div>
                </>
            )}
        </div>
    );
}
