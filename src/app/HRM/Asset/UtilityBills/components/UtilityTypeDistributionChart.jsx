'use client';

import { Cell, Pie, PieChart, Tooltip as RechartsTooltip } from 'recharts';
import RechartsBox from '@/components/charts/RechartsBox';
import { UTILITY_TYPE_COLORS } from '../utils/utilityOverviewStats';
import { formatBillMoney } from '../utils/utilityBillStats';

export default function UtilityTypeDistributionChart({
    slices = [],
    centerTotal = 0,
    centerLabel = 'Deduction',
    emptyLabel = 'No utility records yet.',
    minHeight = 110,
}) {
    if (!slices.length) {
        return (
            <div className="flex h-full min-h-[7rem] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3">
                <p className="text-xs text-gray-500 text-center">{emptyLabel}</p>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="relative min-h-0 flex-1">
                <RechartsBox fillParent minHeight={minHeight}>
                    <PieChart>
                        <Pie
                            data={slices}
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
                            {slices.map((slice, index) => (
                                <Cell
                                    key={slice.name}
                                    fill={UTILITY_TYPE_COLORS[index % UTILITY_TYPE_COLORS.length]}
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
                    <div className="px-1 text-center">
                        <p className="text-[7px] font-bold uppercase leading-none tracking-wider text-rose-400 sm:text-[8px]">
                            {centerLabel}
                        </p>
                        <p className="mt-0.5 text-[10px] font-black tabular-nums leading-tight text-rose-700 sm:text-[11px]">
                            {formatBillMoney(centerTotal)}
                        </p>
                    </div>
                </div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-center gap-x-2 gap-y-1 pt-1">
                {slices.map((slice, index) => (
                    <span
                        key={slice.name}
                        className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-gray-500 sm:text-[9px]"
                    >
                        <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                                backgroundColor:
                                    UTILITY_TYPE_COLORS[index % UTILITY_TYPE_COLORS.length],
                            }}
                        />
                        <span className="max-w-[5.5rem] truncate">{slice.name}</span>
                        <span className="tabular-nums">{formatBillMoney(slice.deduction || 0)}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}
