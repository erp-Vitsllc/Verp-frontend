'use client';

import { useMemo } from 'react';
import RechartsBox from '@/components/charts/RechartsBox';
import ScrollReveal from '@/components/ScrollReveal';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    Legend,
    Pie,
    PieChart,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    FLORAL,
    FLORAL_CLASS_COLORS,
    FLORAL_DEPT_COLORS,
    floralPanelClass,
    floralPanelStyle,
    floralTooltipStyle,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleFleetAnalyticsTheme';

function formatCostM(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '$0';
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
    return `$${Math.round(n)}`;
}

function shortDept(name, max = 10) {
    const text = String(name || '').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
}

function AvailabilityGauge({ percent }) {
    const pct = Math.min(100, Math.max(0, Number(percent) || 0));
    const data = [
        { name: 'filled', value: pct },
        { name: 'empty', value: 100 - pct },
    ];
    const fillColor =
        pct >= 80 ? FLORAL.sageDeep : pct >= 50 ? FLORAL.peachDeep : FLORAL.roseDeep;

    return (
        <div className="flex flex-col items-center justify-center py-2">
            <RechartsBox height={140} minHeight={120}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="95%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius="58%"
                        outerRadius="82%"
                        dataKey="value"
                        stroke="none"
                    >
                        <Cell fill={fillColor} />
                        <Cell fill="#efe6e0" />
                    </Pie>
                    <text
                        x="50%"
                        y="78%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#5c4f55] text-3xl font-black"
                    >
                        {pct}%
                    </text>
                </PieChart>
            </RechartsBox>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9a8a90] mt-1">
                Asset availability
            </p>
        </div>
    );
}

const STATUS_ROWS = [
    { key: 'available', label: 'Available', tone: 'sage' },
    { key: 'availableNotNeeded', label: 'Available but not needed', tone: 'mint' },
    { key: 'underRepair', label: 'Under repair', tone: 'peach' },
    { key: 'waitingParts', label: 'Waiting for parts', tone: 'rose' },
];

const STATUS_TONE_CLASS = {
    sage: 'bg-[#d4ead4] text-[#4a6b4a] border-[#b8d4b8]',
    mint: 'bg-[#d8ebe6] text-[#4a6b62] border-[#b8ddd4]',
    peach: 'bg-[#fae8d8] text-[#8a6a4a] border-[#f5d0b8]',
    rose: 'bg-[#f4d4d8] text-[#8a4a55] border-[#e8b4bc]',
};

function AssetStatusList({ assetStatus }) {
    const st = assetStatus || {};
    return (
        <div className="space-y-2.5 py-1">
            {STATUS_ROWS.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-2">
                    <span
                        className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${STATUS_TONE_CLASS[row.tone]}`}
                    >
                        {row.label}
                    </span>
                    <span className="text-lg font-black tabular-nums text-[#5c4f55]">
                        {st[row.key] ?? 0}
                    </span>
                </div>
            ))}
        </div>
    );
}

function PanelTitle({ children, subtitle }) {
    return (
        <div className="mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#9a8a90]">
                {children}
            </h3>
            {subtitle ? <p className="text-[11px] text-[#b0a0a6] mt-0.5">{subtitle}</p> : null}
        </div>
    );
}

function GroupedAnalyticsCard({ children }) {
    return (
        <div className={`${floralPanelClass} overflow-hidden`} style={floralPanelStyle}>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#efe6e0]">
                {children}
            </div>
        </div>
    );
}

function GroupedAnalyticsCell({ children }) {
    return <div className="p-4 md:p-5 min-h-[220px] flex flex-col">{children}</div>;
}

function ClassPieLegend({ items }) {
    if (!items?.length) {
        return <p className="text-sm text-[#b0a0a6] py-10 text-center">No class data yet.</p>;
    }
    return (
        <ul className="mt-2 space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
            {items.map((row, i) => (
                <li key={row.name} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-2 min-w-0">
                        <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: FLORAL_CLASS_COLORS[i % FLORAL_CLASS_COLORS.length] }}
                        />
                        <span className="truncate font-semibold text-[#5c4f55] uppercase">
                            {row.name}
                        </span>
                    </span>
                    <span className="tabular-nums font-bold text-[#9a8a90] shrink-0">
                        {row.percent}%
                    </span>
                </li>
            ))}
        </ul>
    );
}

export default function VehicleFleetAnalyticsPanel({ fleetAnalytics, chartAnim = 1200 }) {
    const analytics = fleetAnalytics || {};

    const classPieData = useMemo(
        () =>
            (analytics.assetsByClass || []).map((row) => ({
                name: row.name,
                value: row.count,
                percent: row.percent,
            })),
        [analytics.assetsByClass],
    );

    const deptDonutData = useMemo(
        () =>
            (analytics.assetsByDepartment || []).map((row) => ({
                name: row.name,
                value: row.count,
            })),
        [analytics.assetsByDepartment],
    );

    const replacementData = analytics.replacementByYear || [];
    const replacementCostData = analytics.replacementCostByYear || [];
    const ageData = analytics.averageAgeByDepartment || [];

    return (
        <section className="space-y-4" aria-label="Fleet analytics overview">
            <ScrollReveal delayMs={0} durationMs={650}>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <GroupedAnalyticsCard>
                        <GroupedAnalyticsCell>
                            <PanelTitle subtitle="Ready fleet assets">Availability</PanelTitle>
                            <div className="flex-1 flex items-center justify-center">
                                <AvailabilityGauge percent={analytics.availabilityPercent} />
                            </div>
                        </GroupedAnalyticsCell>
                        <GroupedAnalyticsCell>
                            <PanelTitle subtitle="Live operational status">Asset status</PanelTitle>
                            <AssetStatusList assetStatus={analytics.assetStatus} />
                        </GroupedAnalyticsCell>
                    </GroupedAnalyticsCard>

                    <GroupedAnalyticsCard>
                        <GroupedAnalyticsCell>
                            <PanelTitle subtitle="By brand / type">Assets by class</PanelTitle>
                            {classPieData.length ? (
                                <>
                                    <RechartsBox height={160} minHeight={140}>
                                        <PieChart>
                                            <Pie
                                                data={classPieData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius="72%"
                                                innerRadius={0}
                                                stroke="#ffffff"
                                                strokeWidth={2}
                                                animationDuration={chartAnim}
                                            >
                                                {classPieData.map((_, i) => (
                                                    <Cell
                                                        key={`class-${i}`}
                                                        fill={
                                                            FLORAL_CLASS_COLORS[
                                                                i % FLORAL_CLASS_COLORS.length
                                                            ]
                                                        }
                                                    />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip
                                                contentStyle={floralTooltipStyle}
                                                formatter={(value, name) => [value, name]}
                                            />
                                        </PieChart>
                                    </RechartsBox>
                                    <ClassPieLegend items={analytics.assetsByClass} />
                                </>
                            ) : (
                                <p className="text-sm text-[#b0a0a6] py-10 text-center flex-1">
                                    No vehicles yet.
                                </p>
                            )}
                        </GroupedAnalyticsCell>
                        <GroupedAnalyticsCell>
                            <PanelTitle subtitle="Emirate / company">Assets by department</PanelTitle>
                            {deptDonutData.length ? (
                                <div className="flex-1 flex items-center">
                                    <RechartsBox height={220} minHeight={200} className="w-full">
                                        <PieChart>
                                            <Pie
                                                data={deptDonutData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius="48%"
                                                outerRadius="72%"
                                                stroke="#ffffff"
                                                strokeWidth={2}
                                                animationDuration={chartAnim}
                                                label={({ name, value }) =>
                                                    `${shortDept(name, 8)} (${value})`
                                                }
                                                labelLine={{ stroke: FLORAL.textMuted }}
                                            >
                                                {deptDonutData.map((_, i) => (
                                                    <Cell
                                                        key={`dept-${i}`}
                                                        fill={
                                                            FLORAL_DEPT_COLORS[
                                                                i % FLORAL_DEPT_COLORS.length
                                                            ]
                                                        }
                                                    />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip contentStyle={floralTooltipStyle} />
                                        </PieChart>
                                    </RechartsBox>
                                </div>
                            ) : (
                                <p className="text-sm text-[#b0a0a6] py-10 text-center flex-1">
                                    No vehicles yet.
                                </p>
                            )}
                        </GroupedAnalyticsCell>
                    </GroupedAnalyticsCard>
                </div>
            </ScrollReveal>

            <ScrollReveal delayMs={80} durationMs={700}>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className={floralPanelClass} style={floralPanelStyle}>
                        <PanelTitle subtitle="10-year replacement horizon">
                            Assets due for replacement
                        </PanelTitle>
                        <RechartsBox height={280} minHeight={240}>
                            <BarChart
                                data={replacementData}
                                margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#efe6e0" vertical={false} />
                                <XAxis
                                    dataKey="year"
                                    tick={{ fontSize: 11, fill: FLORAL.textMuted }}
                                    axisLine={{ stroke: FLORAL.border }}
                                    tickLine={false}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 11, fill: FLORAL.textMuted }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <RechartsTooltip contentStyle={floralTooltipStyle} />
                                <Legend
                                    wrapperStyle={{ fontSize: 11, color: FLORAL.text }}
                                    formatter={(v) => (
                                        <span className="text-[#5c4f55] font-semibold">{v}</span>
                                    )}
                                />
                                <Bar
                                    dataKey="overdue"
                                    name="Overdue"
                                    stackId="rep"
                                    fill={FLORAL.overdue}
                                    radius={[0, 0, 0, 0]}
                                    animationDuration={chartAnim}
                                />
                                <Bar
                                    dataKey="onTime"
                                    name="On-time"
                                    stackId="rep"
                                    fill={FLORAL.onTime}
                                    radius={[6, 6, 0, 0]}
                                    animationDuration={chartAnim}
                                />
                            </BarChart>
                        </RechartsBox>
                    </div>

                    <div className={floralPanelClass} style={floralPanelStyle}>
                        <PanelTitle subtitle="Estimated asset value at replacement">
                            Cost of assets due for replacement
                        </PanelTitle>
                        <RechartsBox height={280} minHeight={240}>
                            <BarChart
                                data={replacementCostData}
                                margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#efe6e0" vertical={false} />
                                <XAxis
                                    dataKey="year"
                                    tick={{ fontSize: 11, fill: FLORAL.textMuted }}
                                    axisLine={{ stroke: FLORAL.border }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tickFormatter={formatCostM}
                                    tick={{ fontSize: 11, fill: FLORAL.textMuted }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <RechartsTooltip
                                    contentStyle={floralTooltipStyle}
                                    formatter={(v) => formatCostM(v)}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: 11 }}
                                    formatter={(v) => (
                                        <span className="text-[#5c4f55] font-semibold">{v}</span>
                                    )}
                                />
                                <Bar
                                    dataKey="overdue"
                                    name="Overdue"
                                    stackId="cost"
                                    fill={FLORAL.overdue}
                                    animationDuration={chartAnim}
                                />
                                <Bar
                                    dataKey="onTime"
                                    name="On-time"
                                    stackId="cost"
                                    fill={FLORAL.onTime}
                                    radius={[6, 6, 0, 0]}
                                    animationDuration={chartAnim}
                                />
                            </BarChart>
                        </RechartsBox>
                    </div>
                </div>
            </ScrollReveal>

            <ScrollReveal delayMs={140} durationMs={750}>
                <div className={floralPanelClass} style={floralPanelStyle}>
                    <PanelTitle subtitle="Years since model year, by emirate / company">
                        Average age of assets by department
                    </PanelTitle>
                    {ageData.length ? (
                        <RechartsBox height={300} minHeight={260}>
                            <BarChart
                                data={ageData}
                                margin={{ top: 20, right: 12, left: 0, bottom: 4 }}
                                barGap={4}
                                barCategoryGap="18%"
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#efe6e0" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tickFormatter={(v) => shortDept(v, 12)}
                                    tick={{ fontSize: 10, fill: FLORAL.textMuted }}
                                    axisLine={{ stroke: FLORAL.border }}
                                    tickLine={false}
                                    interval={0}
                                    angle={-18}
                                    textAnchor="end"
                                    height={52}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: FLORAL.textMuted }}
                                    axisLine={false}
                                    tickLine={false}
                                    label={{
                                        value: 'Years',
                                        angle: -90,
                                        position: 'insideLeft',
                                        fill: FLORAL.textMuted,
                                        fontSize: 11,
                                    }}
                                />
                                <RechartsTooltip contentStyle={floralTooltipStyle} />
                                <Legend
                                    wrapperStyle={{ fontSize: 11 }}
                                    formatter={(v) => (
                                        <span className="text-[#5c4f55] font-semibold">{v}</span>
                                    )}
                                />
                                <Bar
                                    dataKey="meanAge"
                                    name="Mean age"
                                    fill={FLORAL.lavenderDeep}
                                    radius={[6, 6, 0, 0]}
                                    animationDuration={chartAnim}
                                >
                                    <LabelList
                                        dataKey="meanAge"
                                        position="top"
                                        fill={FLORAL.text}
                                        fontSize={10}
                                        fontWeight={700}
                                    />
                                </Bar>
                                <Bar
                                    dataKey="medianAge"
                                    name="Median age"
                                    fill={FLORAL.peachDeep}
                                    radius={[6, 6, 0, 0]}
                                    animationDuration={chartAnim}
                                >
                                    <LabelList
                                        dataKey="medianAge"
                                        position="top"
                                        fill={FLORAL.text}
                                        fontSize={10}
                                        fontWeight={700}
                                    />
                                </Bar>
                            </BarChart>
                        </RechartsBox>
                    ) : (
                        <p className="text-sm text-[#b0a0a6] py-12 text-center">
                            Model year data needed to compute fleet age.
                        </p>
                    )}
                </div>
            </ScrollReveal>
        </section>
    );
}
