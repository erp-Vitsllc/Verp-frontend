'use client';

import Link from 'next/link';
import { Cell, Pie, PieChart, Tooltip as RechartsTooltip } from 'recharts';
import RechartsBox from '@/components/charts/RechartsBox';
import { UTILITY_TYPE_COLORS } from '../utils/utilityOverviewStats';
import { formatBillMoney } from '../utils/utilityBillStats';

function unpaidTone(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('pending hr')) return 'bg-blue-50 border-blue-200 text-blue-800';
    if (s.includes('pending')) return 'bg-teal-50 border-teal-200 text-teal-800';
    return 'bg-amber-50 border-amber-200 text-amber-800';
}

/** Left: unpaid bills for the selected month. Right: deduction share per utility type. */
export default function UtilityContractExpiryCard({
    unpaidRows = [],
    typeDistribution = [],
    deductionTotal = 0,
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 flex-1 min-h-0">
            <div className="relative z-10 flex flex-col min-h-0">
                <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2 shrink-0">
                    Unpaid Bills
                </h3>
                {unpaidRows.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3 min-h-0">
                        <p className="text-xs text-gray-500 text-center">
                            No unpaid bills for this month.
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto min-h-0 pr-0.5 space-y-1.5">
                        {unpaidRows.map((row) => {
                            const href = String(row.href || '').trim();
                            const className = `block w-full text-left rounded-lg border px-2 py-1.5 flex items-center justify-between gap-2 ${unpaidTone(row.status)} ${
                                href ? 'hover:shadow-sm transition-shadow cursor-pointer' : ''
                            }`;
                            const body = (
                                <>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-bold truncate">{row.title}</p>
                                        <p className="text-[9px] font-semibold uppercase tracking-wider opacity-70 truncate">
                                            {row.type}
                                            {row.subtitle ? ` · ${row.subtitle}` : ''}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[11px] font-bold tabular-nums">
                                            {formatBillMoney(row.amount)}
                                        </p>
                                        <p className="text-[9px] font-semibold uppercase tracking-wider opacity-80">
                                            {row.status || 'unpaid'}
                                        </p>
                                    </div>
                                </>
                            );
                            if (href) {
                                return (
                                    <Link
                                        key={row.id || `${row.type}-${row.subtitle}`}
                                        href={href}
                                        className={className}
                                    >
                                        {body}
                                    </Link>
                                );
                            }
                            return (
                                <div
                                    key={row.id || `${row.type}-${row.subtitle}`}
                                    className={className}
                                >
                                    {body}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="flex flex-col min-h-0">
                <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2 shrink-0">
                    All Types
                </h3>
                {typeDistribution.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3 min-h-0">
                        <p className="text-xs text-gray-500 text-center">No utility records yet.</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="relative flex-1 min-h-0">
                            <RechartsBox fillParent minHeight={110}>
                                <PieChart>
                                    <Pie
                                        data={typeDistribution}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="45%"
                                        outerRadius="80%"
                                        paddingAngle={2}
                                        stroke="#fff"
                                        strokeWidth={2}
                                    >
                                        {typeDistribution.map((slice, index) => (
                                            <Cell
                                                key={slice.name}
                                                fill={
                                                    UTILITY_TYPE_COLORS[
                                                        index % UTILITY_TYPE_COLORS.length
                                                    ]
                                                }
                                            />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(_value, name, item) => {
                                            const amount =
                                                Number(item?.payload?.deduction) ||
                                                Number(item?.payload?.value) ||
                                                0;
                                            return [formatBillMoney(amount), name];
                                        }}
                                    />
                                </PieChart>
                            </RechartsBox>
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <div className="text-center px-1">
                                    <p className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider text-rose-400 leading-none">
                                        Deduction
                                    </p>
                                    <p className="mt-0.5 text-[10px] sm:text-[11px] font-black tabular-nums text-rose-700 leading-tight">
                                        {formatBillMoney(deductionTotal)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="shrink-0 flex flex-wrap gap-x-3 gap-y-1 justify-center pt-1">
                            {typeDistribution.map((slice, index) => (
                                <span
                                    key={slice.name}
                                    className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-500"
                                >
                                    <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{
                                            backgroundColor:
                                                UTILITY_TYPE_COLORS[index % UTILITY_TYPE_COLORS.length],
                                        }}
                                    />
                                    {slice.name} · {formatBillMoney(slice.deduction || 0)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
