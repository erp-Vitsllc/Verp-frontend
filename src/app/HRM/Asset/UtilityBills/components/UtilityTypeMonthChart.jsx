'use client';

import { useState } from 'react';
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from 'recharts';
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

const axisTick = { fontSize: 10, fill: '#94A3B8', fontWeight: 500 };
const axisLabel = { fill: '#94A3B8', fontSize: 10, fontWeight: 500 };

function formatAxisAed(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1000) {
        const k = n / 1000;
        return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
    }
    return String(Math.round(n));
}

function hoverFromBar(data, type, color) {
    const payload = data?.payload || {};
    const key = typeChartKey(type);
    const raw = Array.isArray(data?.value) ? data.value[data.value.length - 1] : data?.value;
    const value = raw != null && raw !== '' ? Number(raw) : Number(payload[key]) || 0;
    const x =
        data?.tooltipPosition?.x ??
        ((Number(data?.x) || 0) + (Number(data?.width) || 0) / 2);
    const y = (data?.tooltipPosition?.y ?? Number(data?.y)) || 0;
    return {
        month: String(payload.month || ''),
        name: type,
        value,
        color,
        x,
        y,
        isQty: false,
    };
}

function hoverFromLine(data) {
    const payload = data?.payload || {};
    return {
        month: String(payload.month || ''),
        name: 'Qty',
        value: Number(payload[CHART_QTY_KEY] ?? data?.value) || 0,
        color: '#1A2B48',
        x: (data?.tooltipPosition?.x ?? Number(data?.cx ?? data?.x)) || 0,
        y: (data?.tooltipPosition?.y ?? Number(data?.cy ?? data?.y)) || 0,
        isQty: true,
    };
}

function HoverTip({ hover }) {
    if (!hover) return null;
    const text = hover.isQty ? String(hover.value) : formatAed(hover.value);
    return (
        <div
            className="pointer-events-none absolute z-20"
            style={{
                left: hover.x,
                top: hover.y,
                transform: 'translate(-50%, calc(-100% - 8px))',
            }}
        >
            <div style={tooltipStyle} className="whitespace-nowrap px-2.5 py-1.5">
                <p className="mb-0.5 text-[10px] font-semibold text-[#94A3B8]">{hover.month}</p>
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#334155]">
                    <span
                        className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: hover.color }}
                    />
                    <span>
                        {hover.name}: {text}
                    </span>
                </p>
            </div>
        </div>
    );
}

function ChartLegend({ types = [] }) {
    return (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-0.5">
            {types.map((type, index) => (
                <span key={type} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#64748B]">
                    <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ backgroundColor: utilityTypeColor(index) }}
                    />
                    {type}
                </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#64748B]">
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
    minHeight = 176,
}) {
    const [hover, setHover] = useState(null);

    if (!types.length) {
        return (
            <div className="flex h-full min-h-[8rem] items-center justify-center rounded-xl border border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-3">
                <p className="text-center text-sm text-[#94A3B8]">No utility types to chart yet.</p>
            </div>
        );
    }

    const hasValues = rows.some((row) => {
        if (Number(row?.[CHART_QTY_KEY]) > 0) return true;
        return types.some((type) => Number(row?.[typeChartKey(type)]) > 0);
    });

    return (
        <div className="flex h-full min-h-0 flex-col">
            <p className="mb-1 shrink-0 text-[11px] font-semibold leading-tight text-[#1A2B48]">
                Amount vs Quantity — Month-wise
            </p>
            <div className="relative w-full min-w-0 shrink-0" style={{ height: minHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        key={hasValues ? 'loaded' : 'empty'}
                        data={rows}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                        barCategoryGap="22%"
                        barGap={2}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" vertical={false} />
                        <XAxis
                            dataKey="month"
                            tick={axisTick}
                            axisLine={false}
                            tickLine={false}
                            dy={2}
                        />
                        <YAxis
                            yAxisId="amount"
                            tickFormatter={formatAxisAed}
                            tick={axisTick}
                            axisLine={false}
                            tickLine={false}
                            width={44}
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
                            width={28}
                            label={{
                                value: 'Qty',
                                angle: 90,
                                position: 'insideRight',
                                offset: 8,
                                style: axisLabel,
                            }}
                        />
                        {types.map((type, index) => {
                            const color = utilityTypeColor(index);
                            return (
                                <Bar
                                    key={type}
                                    yAxisId="amount"
                                    dataKey={typeChartKey(type)}
                                    name={type}
                                    fill={color}
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={14}
                                    minPointSize={5}
                                    isAnimationActive
                                    animationBegin={index * 70}
                                    animationDuration={900}
                                    animationEasing="ease-out"
                                    onMouseEnter={(data) => setHover(hoverFromBar(data, type, color))}
                                    onMouseMove={(data) => setHover(hoverFromBar(data, type, color))}
                                    onMouseLeave={() => setHover(null)}
                                />
                            );
                        })}
                        <Line
                            yAxisId="qty"
                            type="monotone"
                            dataKey={CHART_QTY_KEY}
                            name="Qty"
                            stroke="#1A2B48"
                            strokeWidth={2}
                            dot={{ r: 2.75, fill: '#1A2B48', strokeWidth: 0 }}
                            activeDot={{ r: 4 }}
                            isAnimationActive
                            animationBegin={180}
                            animationDuration={1100}
                            animationEasing="ease-out"
                            onMouseEnter={(data) => setHover(hoverFromLine(data))}
                            onMouseMove={(data) => setHover(hoverFromLine(data))}
                            onMouseLeave={() => setHover(null)}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
                <HoverTip hover={hover} />
            </div>
            <ChartLegend types={types} />
        </div>
    );
}
