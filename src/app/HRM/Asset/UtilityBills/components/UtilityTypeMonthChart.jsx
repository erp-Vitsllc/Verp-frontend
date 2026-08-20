'use client';

import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import RechartsBox from '@/components/charts/RechartsBox';
import { formatAed } from '../utils/utilityBillStats';
import { CHART_QTY_KEY, typeChartKey } from '../utils/utilityOverviewStats';
import { utilityTypeColor } from '../utils/utilityTypeVisuals';

const tooltipStyle = {
    borderRadius: '10px',
    border: '1px solid #E8EDF3',
    background: '#ffffff',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
    fontSize: '12px',
    color: '#334155',
};

const axisTick = { fontSize: 11, fill: '#94A3B8', fontWeight: 500 };
const axisLabel = { fill: '#94A3B8', fontSize: 11, fontWeight: 500 };

function formatAxisAed(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1000) {
        const k = n / 1000;
        return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
    }
    return String(Math.round(n));
}

function ChartLegend({ types = [] }) {
    return (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-1">
            {types.map((type, index) => (
                <span key={type} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
                    <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ backgroundColor: utilityTypeColor(index) }}
                    />
                    {type}
                </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
                <span className="relative h-2.5 w-5">
                    <span className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[#1A2B48]" />
                    <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1A2B48]" />
                </span>
                Qty
            </span>
        </div>
    );
}

export default function UtilityTypeMonthChart({
    rows = [],
    types = [],
    minHeight = 220,
}) {
    if (!types.length) {
        return (
            <div className="flex h-full min-h-[10rem] items-center justify-center rounded-2xl border border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-3">
                <p className="text-center text-sm text-[#94A3B8]">No utility types to chart yet.</p>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <p className="mb-2 shrink-0 text-[13px] font-semibold text-[#1A2B48]">
                Amount vs Quantity — Month-wise
            </p>
            <div className="min-h-0 flex-1">
                <RechartsBox fillParent minHeight={minHeight}>
                    <ComposedChart
                        data={rows}
                        margin={{ top: 10, right: 12, left: 4, bottom: 0 }}
                        barCategoryGap="22%"
                        barGap={2}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" vertical={false} />
                        <XAxis
                            dataKey="month"
                            tick={axisTick}
                            axisLine={false}
                            tickLine={false}
                            dy={4}
                        />
                        <YAxis
                            yAxisId="amount"
                            tickFormatter={formatAxisAed}
                            tick={axisTick}
                            axisLine={false}
                            tickLine={false}
                            width={52}
                            label={{
                                value: 'Amount (AED)',
                                angle: -90,
                                position: 'insideLeft',
                                offset: 2,
                                style: axisLabel,
                            }}
                        />
                        <YAxis
                            yAxisId="qty"
                            orientation="right"
                            allowDecimals={false}
                            tick={axisTick}
                            axisLine={false}
                            tickLine={false}
                            width={36}
                            label={{
                                value: 'Qty',
                                angle: 90,
                                position: 'insideRight',
                                offset: 8,
                                style: axisLabel,
                            }}
                        />
                        <RechartsTooltip
                            contentStyle={tooltipStyle}
                            formatter={(value, name) => {
                                if (name === 'Qty') return [Number(value) || 0, 'Qty'];
                                return [formatAed(value), name];
                            }}
                            cursor={{ fill: 'rgba(26, 43, 72, 0.04)' }}
                        />
                        {types.map((type, index) => (
                            <Bar
                                key={type}
                                yAxisId="amount"
                                dataKey={typeChartKey(type)}
                                name={type}
                                fill={utilityTypeColor(index)}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={16}
                            />
                        ))}
                        <Line
                            yAxisId="qty"
                            type="monotone"
                            dataKey={CHART_QTY_KEY}
                            name="Qty"
                            stroke="#1A2B48"
                            strokeWidth={2.25}
                            dot={{ r: 3.5, fill: '#1A2B48', strokeWidth: 0 }}
                            activeDot={{ r: 5 }}
                        />
                    </ComposedChart>
                </RechartsBox>
            </div>
            <ChartLegend types={types} />
        </div>
    );
}
