'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ScrollReveal from '@/components/ScrollReveal';
import RechartsBox from '@/components/charts/RechartsBox';
import {
    Area,
    AreaChart,
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
import { AlertCircle, ArrowLeftRight, Bell, Car, ClipboardList, Clock, Gauge, MapPin, RefreshCw, Route, TrendingUp, Wrench } from 'lucide-react';
import {
    vehicleDashboardKpiHref,
    vehicleDashboardKpiTitle,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleFleetDashboardNavigation';
import {
    FLORAL_CLASS_COLORS,
    floralPanelClass,
    floralPanelStyle,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleFleetAnalyticsTheme';

const YEAR_COLORS = FLORAL_CLASS_COLORS;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildCalendarYearMonthSeries(rows) {
    const map = new Map((rows || []).map((r) => [String(r.label), Number(r.total) || 0]));
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
        return {
            name: MONTH_SHORT[i],
            total: Math.round(map.get(key) ?? 0),
        };
    });
}

function formatCostAxisTick(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return String(n);
}

function AnimatedCount({ value, className = '' }) {
    const target = Number(value) || 0;
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        let frame;
        const start = performance.now();
        const from = 0;
        const duration = 900;

        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - (1 - t) ** 3;
            setDisplay(Math.round(from + (target - from) * eased));
            if (t < 1) frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target]);

    return <span className={`fleet-kpi-value tabular-nums ${className}`}>{display}</span>;
}

function KpiTile({ label, value, tone = 'rose', routeKey, wide = false }) {
    const router = useRouter();
    const tones = {
        rose: { wrap: 'bg-[#fff0f3] border-[#f4d4dc]', label: 'text-[#c45c7a]', value: 'text-[#5c4f55]' },
        amber: { wrap: 'bg-[#fff9e6] border-[#f5e8c4]', label: 'text-[#b8860b]', value: 'text-[#5c4f55]' },
        emerald: { wrap: 'bg-[#f0fff4] border-[#c8e6c9]', label: 'text-[#4a8a5a]', value: 'text-[#5c4f55]' },
        sky: { wrap: 'bg-[#e6f7ff] border-[#b8d4e8]', label: 'text-[#4a7a9a]', value: 'text-[#5c4f55]' },
        violet: { wrap: 'bg-[#f9f0ff] border-[#d4c4e8]', label: 'text-[#7a5a9a]', value: 'text-[#5c4f55]' },
        pink: { wrap: 'bg-[#fff0f3] border-[#f4d4dc]', label: 'text-[#c45c7a]', value: 'text-[#5c4f55]' },
        lime: { wrap: 'bg-[#f0fff4] border-[#c8e6c9]', label: 'text-[#4a8a5a]', value: 'text-[#5c4f55]' },
    };
    const t = tones[tone] || tones.rose;
    const href = routeKey ? vehicleDashboardKpiHref(routeKey) : null;
    const title = routeKey ? vehicleDashboardKpiTitle(routeKey) : undefined;
    const tilePad = wide ? 'px-4 py-5' : 'px-3 py-3';
    const valueSize = wide ? 'text-3xl' : 'text-2xl';

    const inner = (
        <>
            <p className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${t.label}`}>{label}</p>
            <p className={`${valueSize} font-black leading-none ${t.value}`}>
                <AnimatedCount value={value} />
            </p>
        </>
    );

    if (!href) {
        return (
            <div className={`rounded-xl border text-center ${tilePad} ${t.wrap}`}>
                {inner}
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={() => router.push(href)}
            title={title}
            className={`w-full rounded-xl border text-center transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-md hover:z-10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b4bc]/60 ${tilePad} ${t.wrap}`}
        >
            {inner}
        </button>
    );
}

function KpiSubSection({ title, icon: Icon, children, className = '' }) {
    return (
        <div className={`rounded-xl border border-gray-200 bg-white overflow-hidden h-full ${className}`}>
            <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2 bg-white">
                {Icon ? (
                    <Icon className="w-3.5 h-3.5 text-[#9a8a90] shrink-0" strokeWidth={2.25} />
                ) : null}
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#9a8a90]">{title}</h3>
            </div>
            <div className="p-3">{children}</div>
        </div>
    );
}

function GroupedKpiCard({ children, delayMs = 0, className = '' }) {
    return (
        <ScrollReveal delayMs={delayMs} durationMs={600} className={className}>
            <div className={`${floralPanelClass} overflow-hidden p-3 md:p-4`} style={floralPanelStyle}>
                {children}
            </div>
        </ScrollReveal>
    );
}

function LocatorPeriodTabBar({ options, value, onChange }) {
    return (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            {options.map((o) => (
                <button
                    key={o.id}
                    type="button"
                    onClick={() => onChange(o.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                        value === o.id
                            ? 'bg-white text-teal-700 shadow-sm ring-1 ring-teal-200/50 scale-[1.02]'
                            : 'text-slate-500 hover:text-teal-700 hover:bg-white/80'
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

const RUNNING_PERIOD_TABS = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
];

const IDLE_PERIOD_TABS = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
];

const SALIK_PERIOD_TABS = [
    { id: 'day', label: 'Yesterday' },
    { id: 'week', label: 'Mon–Sun' },
    { id: 'month', label: 'Month' },
];

function LocatorBucketControls({
    tabs,
    period,
    onPeriodChange,
    bucket,
    selectedKey,
    onSelectKey,
    selectAriaLabel,
}) {
    const options = bucket?.options || [];
    const value = selectedKey || bucket?.defaultKey || '';

    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <LocatorPeriodTabBar options={tabs} value={period} onChange={onPeriodChange} />
            {options.length > 1 ? (
                <select
                    value={value}
                    onChange={(e) => onSelectKey(e.target.value)}
                    className="w-full sm:min-w-[13rem] sm:w-auto px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                    aria-label={selectAriaLabel}
                >
                    {options.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                            {opt.sublabel ? `${opt.label} · ${opt.sublabel}` : opt.label}
                        </option>
                    ))}
                </select>
            ) : null}
        </div>
    );
}

function readLocatorBucketSeries(bucket, selectedKey) {
    if (!bucket?.byKey) return [];
    const key = selectedKey || bucket.defaultKey;
    return bucket.byKey[key] || [];
}

function formatLocatorBucketSubtitle(bucket, selectedKey, fallback) {
    const key = selectedKey || bucket?.defaultKey;
    const option = bucket?.options?.find((row) => row.key === key);
    if (!option) return fallback;
    return option.sublabel ? `${option.label} · ${option.sublabel}` : option.label;
}

function PeriodTabs({ value, onChange }) {
    return (
        <LocatorPeriodTabBar options={RUNNING_PERIOD_TABS} value={value} onChange={onChange} />
    );
}

function RunningKmControls({ period, onPeriodChange, bucket, selectedKey, onSelectKey }) {
    return (
        <LocatorBucketControls
            tabs={RUNNING_PERIOD_TABS}
            period={period}
            onPeriodChange={onPeriodChange}
            bucket={bucket}
            selectedKey={selectedKey}
            onSelectKey={onSelectKey}
            selectAriaLabel="Select running km period"
        />
    );
}

function IdleTimeControls({ period, onPeriodChange, bucket, selectedKey, onSelectKey }) {
    return (
        <LocatorBucketControls
            tabs={IDLE_PERIOD_TABS}
            period={period}
            onPeriodChange={onPeriodChange}
            bucket={bucket}
            selectedKey={selectedKey}
            onSelectKey={onSelectKey}
            selectAriaLabel="Select idle time period"
        />
    );
}

function SalikControls({ period, onPeriodChange, bucket, selectedKey, onSelectKey }) {
    return (
        <LocatorBucketControls
            tabs={SALIK_PERIOD_TABS}
            period={period}
            onPeriodChange={onPeriodChange}
            bucket={bucket}
            selectedKey={selectedKey}
            onSelectKey={onSelectKey}
            selectAriaLabel="Select salik distance period"
        />
    );
}

function mapLocatorSeries(rows, valueKey = 'value') {
    return (rows || []).map((row) => ({
        name: row.name || row.label,
        value: Number(row[valueKey]) || 0,
    }));
}

function formatKmAxisTick(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return String(Math.round(n));
}

function shortVehicleChartName(name, max = 14) {
    const text = String(name || '').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
}

function locatorVehicleLabel(name) {
    const text = String(name || '').trim();
    if (!text) return '—';
    const plateMatch = text.match(/\b([A-Z]{1,3}\s?\d{1,6}|\d{4,6})\b/i);
    if (plateMatch?.[1]) return plateMatch[1].replace(/\s+/g, ' ');
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length > 1) return parts[parts.length - 1];
    return shortVehicleChartName(text, 10);
}

function formatLocatorBarValue(value, unit) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${unit}`;
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k ${unit}`;
    return `${Math.round(n).toLocaleString()} ${unit}`;
}

function withShortNames(rows) {
    return (rows || []).map((row) => {
        const fullName = String(row.name || row.label || '—').trim() || '—';
        return {
            ...row,
            name: fullName,
            shortName: locatorVehicleLabel(fullName),
            chartName: shortVehicleChartName(fullName, 14),
        };
    });
}

const LOCATOR_CHART_HEIGHT = 300;
const LOCATOR_STATIC_CHART_HEIGHT = 300;

const LOCATOR_GRID_ORDER = ['running', 'odometer', 'idle', 'salik'];

const LOCATOR_CHARTS = [
    {
        id: 'odometer',
        title: 'Current km',
        subtitle: 'Live odometer per Locator vehicle',
        accent: 'border-t-teal-500',
        icon: Gauge,
        iconClass: 'text-teal-600',
        linkClass: 'text-teal-700',
        valueLabel: 'km',
        barFill: '#0d9488',
    },
    {
        id: 'running',
        title: 'Running km',
        subtitle: 'Distance travelled in the selected period',
        subtitleDay: 'Distance travelled in the last 8 days',
        accent: 'border-t-violet-500',
        icon: TrendingUp,
        iconClass: 'text-violet-600',
        linkClass: 'text-violet-700',
        valueLabel: 'km',
        barFill: '#7c3aed',
    },
    {
        id: 'idle',
        title: 'Idle time',
        subtitle: 'Idle / parked time per vehicle',
        subtitleDay: 'Engine-on but stationary hours per vehicle',
        accent: 'border-t-orange-500',
        icon: Clock,
        iconClass: 'text-orange-500',
        linkClass: 'text-orange-600',
        valueLabel: 'min',
        barFill: '#f97316',
    },
    {
        id: 'salik',
        title: 'Salik-wise distance',
        subtitle: 'Vehicles ranked by distance (highest first)',
        accent: 'border-t-fuchsia-500',
        icon: Route,
        iconClass: 'text-fuchsia-600',
        linkClass: 'text-fuchsia-700',
        valueLabel: 'km',
        barFill: '#0284c7',
    },
].sort((a, b) => LOCATOR_GRID_ORDER.indexOf(a.id) - LOCATOR_GRID_ORDER.indexOf(b.id));

function LocatorVerticalBarChart({
    data,
    valueLabel,
    barFill = '#0d9488',
    chartAnim = 0,
    animateBars = false,
    chartHeight = LOCATOR_CHART_HEIGHT,
}) {
    if (!data?.length) {
        return (
            <p className="text-slate-400 text-center text-xs py-16">
                No data yet
            </p>
        );
    }

    const barAnimationDuration = animateBars ? chartAnim : 0;
    const barCount = data.length;
    const barSize = Math.min(48, Math.max(20, Math.floor(520 / Math.max(barCount, 1))));
    const xLabelAngle = barCount > 6 ? -38 : barCount > 3 ? -28 : 0;
    const xLabelAnchor = xLabelAngle ? 'end' : 'middle';
    const bottomMargin = barCount > 6 ? 56 : barCount > 3 ? 48 : 36;

    return (
        <div className="w-full" style={{ minHeight: chartHeight }}>
            <RechartsBox height={chartHeight} minHeight={chartHeight}>
                <BarChart
                    data={data}
                    margin={{ top: 24, right: 8, left: 2, bottom: bottomMargin }}
                    barCategoryGap="18%"
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                        dataKey="chartName"
                        tick={{ fontSize: 9, fill: '#64748b' }}
                        interval={0}
                        angle={xLabelAngle}
                        textAnchor={xLabelAnchor}
                        height={bottomMargin - 4}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                        tickFormatter={formatKmAxisTick}
                    />
                    <RechartsTooltip
                        formatter={(v) => [formatLocatorBarValue(v, valueLabel), valueLabel]}
                        labelFormatter={(_label, payload) => payload?.[0]?.payload?.name || _label}
                        contentStyle={tooltipStyle}
                    />
                    <Bar
                        dataKey="value"
                        fill={barFill}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={barSize}
                        isAnimationActive={animateBars}
                        animationDuration={barAnimationDuration}
                        animationEasing="ease-out"
                    >
                        <LabelList
                            dataKey="value"
                            position="top"
                            formatter={(v) => formatLocatorBarValue(v, valueLabel)}
                            style={{ fontSize: 9, fill: '#475569', fontWeight: 600 }}
                        />
                    </Bar>
                </BarChart>
            </RechartsBox>
        </div>
    );
}

function resolveLocatorSubtitle(chart, runningPeriod, idlePeriod) {
    let subtitle = chart.subtitle;
    if (chart.id === 'running' && runningPeriod === 'day' && chart.subtitleDay) {
        subtitle = chart.subtitleDay;
    }
    if (chart.id === 'idle' && idlePeriod === 'day' && chart.subtitleDay) {
        subtitle = chart.subtitleDay;
    }
    return subtitle;
}

const chartPanelClass =
    'group/chart bg-white rounded-2xl border border-gray-200 shadow-sm p-5 md:p-6 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200/80 hover:border-gray-300';

const compactChartPanelClass =
    'group/chart bg-white rounded-2xl border border-gray-200 shadow-sm p-3 md:p-4 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/80 hover:border-gray-300';

const COMPACT_ROW_CHART_HEIGHT = 200;
const COMPACT_ROW_CHART_MIN = 200;
const COMPACT_ROW_CARD_HEIGHT = 268;

function CompactChartCard({ title, subtitle, children }) {
    return (
        <div
            className={`${compactChartPanelClass} h-full flex flex-col`}
            style={{ minHeight: COMPACT_ROW_CARD_HEIGHT, height: COMPACT_ROW_CARD_HEIGHT }}
        >
            <div className="shrink-0">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5 group-hover/chart:text-teal-800 transition-colors">
                    {title}
                </h3>
                <p
                    className={`text-[11px] mb-2 min-h-[16px] ${
                        subtitle ? 'text-slate-400' : 'text-transparent select-none'
                    }`}
                    aria-hidden={!subtitle}
                >
                    {subtitle || '\u00A0'}
                </p>
            </div>
            <div className="flex-1 min-h-0">{children}</div>
        </div>
    );
}

function LocatorStaticChartCard({
    chart,
    data,
    chartAnim,
    chartsReady,
    runningPeriod,
    idlePeriod,
    periodControls = null,
    subtitleOverride = null,
}) {
    const Icon = chart.icon;
    const subtitle =
        subtitleOverride || resolveLocatorSubtitle(chart, runningPeriod, idlePeriod);

    return (
        <div className={chartPanelClass}>
            <div className="flex items-center gap-2 mb-1">
                {Icon ? (
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${chart.iconClass}`} strokeWidth={2.25} />
                ) : null}
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover/chart:text-teal-800 transition-colors">
                    {chart.title}
                </h3>
            </div>
            {periodControls ? periodControls : null}
            <p className="text-xs text-slate-400 mb-3">{subtitle}</p>
            <LocatorVerticalBarChart
                data={withShortNames(data)}
                valueLabel={chart.valueLabel}
                barFill={chart.barFill}
                chartAnim={chartAnim}
                animateBars={chartsReady}
                chartHeight={LOCATOR_STATIC_CHART_HEIGHT}
            />
        </div>
    );
}

const tooltipStyle = {
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#ffffff',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
    fontSize: '12px',
    color: '#5c4f55',
};

export default function VehicleFleetDashboard({
    data,
    loading,
    error,
    onRefresh,
    locatorData,
    locatorLoading,
    locatorError,
    onLocatorRefresh,
}) {
    const [usagePeriod, setUsagePeriod] = useState('week');
    const [locatorRunningPeriod, setLocatorRunningPeriod] = useState('day');
    const [locatorRunningDayKey, setLocatorRunningDayKey] = useState('');
    const [locatorRunningWeekKey, setLocatorRunningWeekKey] = useState('');
    const [locatorRunningMonthKey, setLocatorRunningMonthKey] = useState('');
    const [locatorIdlePeriod, setLocatorIdlePeriod] = useState('day');
    const [locatorIdleDayKey, setLocatorIdleDayKey] = useState('');
    const [locatorIdleWeekKey, setLocatorIdleWeekKey] = useState('');
    const [locatorIdleMonthKey, setLocatorIdleMonthKey] = useState('');
    const [salikPeriod, setSalikPeriod] = useState('month');
    const [salikWeekKey, setSalikWeekKey] = useState('');
    const [salikMonthKey, setSalikMonthKey] = useState('');
    const [chartsReady, setChartsReady] = useState(false);

    useEffect(() => {
        if (!loading && data) {
            const t = setTimeout(() => setChartsReady(true), 80);
            return () => clearTimeout(t);
        }
        setChartsReady(false);
        return undefined;
    }, [loading, data]);

    useEffect(() => {
        const running = locatorData?.runningKmByVehicle;
        if (!running) return;
        if (running.day?.defaultKey) setLocatorRunningDayKey(running.day.defaultKey);
        if (running.week?.defaultKey) setLocatorRunningWeekKey(running.week.defaultKey);
        if (running.month?.defaultKey) setLocatorRunningMonthKey(running.month.defaultKey);
    }, [locatorData?.runningKmByVehicle]);

    useEffect(() => {
        const idle = locatorData?.idleTimeByVehicle;
        if (!idle) return;
        if (idle.day?.defaultKey) setLocatorIdleDayKey(idle.day.defaultKey);
        if (idle.week?.defaultKey) setLocatorIdleWeekKey(idle.week.defaultKey);
        if (idle.month?.defaultKey) setLocatorIdleMonthKey(idle.month.defaultKey);
    }, [locatorData?.idleTimeByVehicle]);

    useEffect(() => {
        const salik = locatorData?.salikWise;
        if (!salik) return;
        if (salik.week?.defaultKey) setSalikWeekKey(salik.week.defaultKey);
        if (salik.month?.defaultKey) setSalikMonthKey(salik.month.defaultKey);
    }, [locatorData?.salikWise]);

    const serviceCostByVehicle = useMemo(() => {
        if (!data?.vehicles?.length) return [];
        return [...data.vehicles]
            .filter((v) => v.totalServiceCost > 0)
            .sort((a, b) => b.totalServiceCost - a.totalServiceCost)
            .slice(0, 8)
            .map((v) => ({
                name: v.label,
                total: Math.round(v.totalServiceCost),
            }));
    }, [data]);

    const vehicleValueBars = useMemo(() => {
        if (!data?.vehicles?.length) return [];
        return [...data.vehicles]
            .filter((v) => v.assetValue > 0)
            .sort((a, b) => b.assetValue - a.assetValue)
            .slice(0, 5)
            .map((v) => ({
                name: v.label,
                value: Math.round(v.assetValue),
            }));
    }, [data]);

    const serviceCostMonthData = useMemo(() => {
        return buildCalendarYearMonthSeries(data?.serviceCostByMonth);
    }, [data?.serviceCostByMonth]);

    const hasServiceCostData = useMemo(
        () => serviceCostMonthData.some((row) => row.total > 0),
        [serviceCostMonthData],
    );

    const pieData = useMemo(() => {
        return (data?.modelYearDistribution || []).map((row) => ({
            name: row.year,
            value: row.count,
        }));
    }, [data?.modelYearDistribution]);

    const usageChartData = useMemo(() => {
        const block = data?.usageByPeriod?.[usagePeriod];
        if (!block?.labels?.length) return [];
        return block.labels.map((label, i) => ({
            name: label,
            count: block.usage[i] ?? 0,
        }));
    }, [data?.usageByPeriod, usagePeriod]);

    const odometerChartData = useMemo(
        () => withShortNames(mapLocatorSeries(locatorData?.odometerByVehicle)),
        [locatorData?.odometerByVehicle],
    );

    const runningKmSelectionKey =
        locatorRunningPeriod === 'week'
            ? locatorRunningWeekKey
            : locatorRunningPeriod === 'month'
              ? locatorRunningMonthKey
              : locatorRunningDayKey;

    const runningKmChartData = useMemo(() => {
        const bucket = locatorData?.runningKmByVehicle?.[locatorRunningPeriod];
        let rows = [];
        if (bucket) {
            const key = runningKmSelectionKey || bucket.defaultKey;
            rows = bucket.byKey?.[key] || [];
        } else {
            const legacy = locatorData?.runningKm?.[locatorRunningPeriod];
            if (legacy?.length) {
                rows = legacy.map((row) => ({
                    name: row.label,
                    value: Number(row.value) || 0,
                }));
            }
        }
        return withShortNames(rows);
    }, [locatorData?.runningKmByVehicle, locatorData?.runningKm, locatorRunningPeriod, runningKmSelectionKey]);

    const runningKmSubtitle = useMemo(() => {
        const bucket = locatorData?.runningKmByVehicle?.[locatorRunningPeriod];
        if (!bucket) return 'Running km per vehicle';
        const key = runningKmSelectionKey || bucket.defaultKey;
        const option = bucket.options?.find((row) => row.key === key);
        if (!option) return 'Running km per vehicle';
        if (locatorRunningPeriod === 'day') {
            return `Running km on ${option.label} · ${option.sublabel}`;
        }
        if (locatorRunningPeriod === 'week') {
            return `Running km for ${option.sublabel || option.label}`;
        }
        return `Running km in ${option.label} ${option.sublabel}`;
    }, [locatorData?.runningKmByVehicle, locatorRunningPeriod, runningKmSelectionKey]);

    const handleRunningPeriodChange = (period) => {
        setLocatorRunningPeriod(period);
        const bucket = locatorData?.runningKmByVehicle?.[period];
        if (!bucket?.defaultKey) return;
        if (period === 'day') setLocatorRunningDayKey(bucket.defaultKey);
        else if (period === 'week') setLocatorRunningWeekKey(bucket.defaultKey);
        else setLocatorRunningMonthKey(bucket.defaultKey);
    };

    const handleRunningSelectionChange = (key) => {
        if (locatorRunningPeriod === 'week') setLocatorRunningWeekKey(key);
        else if (locatorRunningPeriod === 'month') setLocatorRunningMonthKey(key);
        else setLocatorRunningDayKey(key);
    };

    const idleSelectionKey =
        locatorIdlePeriod === 'week'
            ? locatorIdleWeekKey
            : locatorIdlePeriod === 'month'
              ? locatorIdleMonthKey
              : locatorIdleDayKey;

    const salikSelectionKey =
        salikPeriod === 'week' ? salikWeekKey : salikPeriod === 'month' ? salikMonthKey : '';

    const locatorIdleChartData = useMemo(() => {
        const bucket = locatorData?.idleTimeByVehicle?.[locatorIdlePeriod];
        return withShortNames(readLocatorBucketSeries(bucket, idleSelectionKey));
    }, [locatorData?.idleTimeByVehicle, locatorIdlePeriod, idleSelectionKey]);

    const salikChartData = useMemo(() => {
        const bucket = locatorData?.salikWise?.[salikPeriod];
        return withShortNames(readLocatorBucketSeries(bucket, salikSelectionKey));
    }, [locatorData?.salikWise, salikPeriod, salikSelectionKey]);

    const idleSubtitle = useMemo(() => {
        const bucket = locatorData?.idleTimeByVehicle?.[locatorIdlePeriod];
        const selected = formatLocatorBucketSubtitle(
            bucket,
            idleSelectionKey,
            'Idle / parked time per vehicle',
        );
        if (locatorIdlePeriod === 'day') {
            return `Idle time on ${selected}`;
        }
        if (locatorIdlePeriod === 'week') {
            return `Idle time for ${selected}`;
        }
        if (locatorIdlePeriod === 'month') {
            return `Idle time in ${selected}`;
        }
        return `Idle time for ${selected}`;
    }, [locatorData?.idleTimeByVehicle, locatorIdlePeriod, idleSelectionKey]);

    const salikSubtitle = useMemo(() => {
        const bucket = locatorData?.salikWise?.[salikPeriod];
        const selected = formatLocatorBucketSubtitle(
            bucket,
            salikSelectionKey,
            'Vehicles ranked by distance (highest first)',
        );
        if (salikPeriod === 'day') {
            return `Distance on ${selected}`;
        }
        if (salikPeriod === 'week') {
            return `Distance for ${selected}`;
        }
        return `Distance in ${selected}`;
    }, [locatorData?.salikWise, salikPeriod, salikSelectionKey]);

    const handleIdlePeriodChange = (period) => {
        setLocatorIdlePeriod(period);
        const bucket = locatorData?.idleTimeByVehicle?.[period];
        if (!bucket?.defaultKey) return;
        if (period === 'week') setLocatorIdleWeekKey(bucket.defaultKey);
        else if (period === 'month') setLocatorIdleMonthKey(bucket.defaultKey);
        else setLocatorIdleDayKey(bucket.defaultKey);
    };

    const handleIdleSelectionChange = (key) => {
        if (locatorIdlePeriod === 'week') setLocatorIdleWeekKey(key);
        else if (locatorIdlePeriod === 'month') setLocatorIdleMonthKey(key);
        else setLocatorIdleDayKey(key);
    };

    const handleSalikPeriodChange = (period) => {
        setSalikPeriod(period);
        const bucket = locatorData?.salikWise?.[period];
        if (!bucket?.defaultKey) return;
        if (period === 'week') setSalikWeekKey(bucket.defaultKey);
        else if (period === 'month') setSalikMonthKey(bucket.defaultKey);
    };

    const handleSalikSelectionChange = (key) => {
        if (salikPeriod === 'week') setSalikWeekKey(key);
        else if (salikPeriod === 'month') setSalikMonthKey(key);
    };

    const locatorChartDataById = useMemo(
        () => ({
            odometer: odometerChartData,
            running: runningKmChartData,
            idle: locatorIdleChartData,
            salik: salikChartData,
        }),
        [odometerChartData, runningKmChartData, locatorIdleChartData, salikChartData],
    );

    const locatorChartsById = useMemo(
        () => Object.fromEntries(LOCATOR_CHARTS.map((chart) => [chart.id, chart])),
        [],
    );

    const locatorPeriodControls = (chartId) => {
        if (chartId === 'running') {
            return (
                <RunningKmControls
                    period={locatorRunningPeriod}
                    onPeriodChange={handleRunningPeriodChange}
                    bucket={locatorData?.runningKmByVehicle?.[locatorRunningPeriod]}
                    selectedKey={runningKmSelectionKey}
                    onSelectKey={handleRunningSelectionChange}
                />
            );
        }
        if (chartId === 'idle') {
            return (
                <IdleTimeControls
                    period={locatorIdlePeriod}
                    onPeriodChange={handleIdlePeriodChange}
                    bucket={locatorData?.idleTimeByVehicle?.[locatorIdlePeriod]}
                    selectedKey={idleSelectionKey}
                    onSelectKey={handleIdleSelectionChange}
                />
            );
        }
        if (chartId === 'salik') {
            return (
                <SalikControls
                    period={salikPeriod}
                    onPeriodChange={handleSalikPeriodChange}
                    bucket={locatorData?.salikWise?.[salikPeriod]}
                    selectedKey={salikSelectionKey}
                    onSelectKey={handleSalikSelectionChange}
                />
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-teal-200 rounded-full animate-pulse" />
                    <div className="absolute inset-0 w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-sm font-semibold animate-pulse">Loading fleet dashboard…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-red-100 bg-red-50/80 p-8 flex flex-col items-center gap-3 text-center">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-sm font-bold text-red-800">{error}</p>
                {onRefresh ? (
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="group/retry inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-semibold transition-all duration-300 hover:bg-red-50 hover:scale-105"
                    >
                        <RefreshCw size={16} className="transition-transform duration-500 group-hover/retry:rotate-180" />
                        Retry
                    </button>
                ) : null}
            </div>
        );
    }

    if (!data) return null;

    const r = data.reminders || {};
    const vs = data.vehicleStatus || {};
    const sr = data.serviceRequest || {};
    const hr = data.handoverRequest || {};

    const chartAnim = chartsReady ? 1400 : 0;

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <GroupedKpiCard delayMs={0}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <KpiSubSection title="Service reminder" icon={Wrench}>
                                <div className="grid grid-cols-2 gap-2">
                                    <KpiTile
                                        label="Due"
                                        value={r.service?.due ?? 0}
                                        tone="rose"
                                        routeKey="serviceDue"
                                    />
                                    <KpiTile
                                        label="Days down"
                                        value={r.service?.dueSoon ?? 0}
                                        tone="amber"
                                        routeKey="serviceDueSoon"
                                    />
                                </div>
                            </KpiSubSection>
                            <KpiSubSection title="Registration reminder" icon={Bell}>
                                <div className="grid grid-cols-2 gap-2">
                                    <KpiTile
                                        label="Due"
                                        value={r.registration?.due ?? 0}
                                        tone="rose"
                                        routeKey="registrationDue"
                                    />
                                    <KpiTile
                                        label="Days down"
                                        value={r.registration?.dueSoon ?? 0}
                                        tone="amber"
                                        routeKey="registrationDueSoon"
                                    />
                                </div>
                            </KpiSubSection>
                        </div>
                        <KpiSubSection title="Service / asset requests" icon={ClipboardList}>
                            <div className="grid grid-cols-2 gap-2">
                                <KpiTile
                                    label="Pending"
                                    value={sr.pending ?? 0}
                                    tone="pink"
                                    routeKey="requestPending"
                                />
                                <KpiTile
                                    label="Approved"
                                    value={sr.confirmed ?? 0}
                                    tone="amber"
                                    routeKey="requestApproved"
                                />
                            </div>
                        </KpiSubSection>
                    </GroupedKpiCard>

                    <GroupedKpiCard delayMs={80}>
                        <KpiSubSection title="Vehicle assets" icon={Car} className="mb-3">
                            <div className="grid grid-cols-3 gap-2">
                                <KpiTile
                                    label="Assigned"
                                    value={vs.assigned ?? 0}
                                    tone="emerald"
                                    routeKey="assigned"
                                />
                                <KpiTile
                                    label="Unassigned"
                                    value={vs.unassigned ?? 0}
                                    tone="sky"
                                    routeKey="unassigned"
                                />
                                <KpiTile
                                    label="In service"
                                    value={vs.inService ?? 0}
                                    tone="violet"
                                    routeKey="inService"
                                />
                            </div>
                        </KpiSubSection>
                        <KpiSubSection title="Handover (assignment)" icon={ArrowLeftRight}>
                            <div className="grid grid-cols-2 gap-2">
                                <KpiTile
                                    label="Pending asset"
                                    value={hr.pending ?? 0}
                                    tone="pink"
                                    routeKey="handoverPending"
                                />
                                <KpiTile
                                    label="Accepted"
                                    value={hr.confirmed ?? 0}
                                    tone="lime"
                                    routeKey="handoverAccepted"
                                />
                            </div>
                        </KpiSubSection>
                    </GroupedKpiCard>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                <ScrollReveal delayMs={0} durationMs={700} className="h-full">
                    <CompactChartCard
                        title="Service cost by month"
                        subtitle="Total maintenance spend across the year."
                    >
                        {!hasServiceCostData ? (
                            <p className="text-sm text-slate-400 h-full flex items-center justify-center text-center">
                                No service spend recorded yet.
                            </p>
                        ) : (
                            <RechartsBox
                                height={COMPACT_ROW_CHART_HEIGHT}
                                minHeight={COMPACT_ROW_CHART_MIN}
                                className="h-full"
                                fillParent
                            >
                                <AreaChart data={serviceCostMonthData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="fleetServiceCostGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#0d9488" stopOpacity={0.03} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        interval={0}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={40}
                                        tickFormatter={formatCostAxisTick}
                                        domain={[0, 'auto']}
                                    />
                                    <RechartsTooltip
                                        formatter={(v) => [`AED ${Number(v).toLocaleString()}`, 'Total']}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        stroke="#0d9488"
                                        strokeWidth={2.5}
                                        fill="url(#fleetServiceCostGrad)"
                                        fillOpacity={1}
                                        baseValue={0}
                                        connectNulls
                                        dot={false}
                                        activeDot={{ r: 5, fill: '#0f766e', stroke: '#fff', strokeWidth: 2 }}
                                        isAnimationActive={chartsReady}
                                        animationDuration={chartAnim}
                                        animationEasing="ease-out"
                                    />
                                </AreaChart>
                            </RechartsBox>
                        )}
                    </CompactChartCard>
                </ScrollReveal>

                <ScrollReveal delayMs={80} durationMs={700} className="h-full">
                    <CompactChartCard title="Service cost by vehicle">
                        {serviceCostByVehicle.length === 0 ? (
                            <p className="text-sm text-slate-400 h-full flex items-center justify-center text-center">
                                No per-vehicle service costs yet.
                            </p>
                        ) : (
                            <RechartsBox
                                height={COMPACT_ROW_CHART_HEIGHT}
                                minHeight={COMPACT_ROW_CHART_MIN}
                                className="h-full"
                                fillParent
                            >
                                <BarChart
                                    data={serviceCostByVehicle}
                                    layout="vertical"
                                    margin={{ left: 4, right: 64, top: 2, bottom: 2 }}
                                    barCategoryGap="18%"
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={72}
                                        tick={{ fontSize: 9, fill: '#64748b' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <RechartsTooltip
                                        formatter={(v) => [`AED ${Number(v).toLocaleString()}`, 'Total']}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Bar
                                        dataKey="total"
                                        fill="#0284c7"
                                        radius={[0, 6, 6, 0]}
                                        maxBarSize={16}
                                        animationDuration={chartAnim}
                                        animationEasing="ease-out"
                                    >
                                        <LabelList
                                            dataKey="total"
                                            position="right"
                                            formatter={(v) => `AED ${Number(v).toLocaleString()}`}
                                            style={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                                        />
                                    </Bar>
                                </BarChart>
                            </RechartsBox>
                        )}
                    </CompactChartCard>
                </ScrollReveal>

                <ScrollReveal delayMs={160} durationMs={750} className="h-full">
                    <CompactChartCard title="Vehicle model year">
                        {pieData.length === 0 ? (
                            <p className="text-sm text-slate-400 h-full flex items-center justify-center text-center">
                                No model years on record.
                            </p>
                        ) : (
                            <RechartsBox
                                height={COMPACT_ROW_CHART_HEIGHT}
                                minHeight={COMPACT_ROW_CHART_MIN}
                                className="h-full"
                                fillParent
                            >
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="42%"
                                        innerRadius={38}
                                        outerRadius={58}
                                        paddingAngle={2}
                                        animationDuration={chartAnim}
                                        animationEasing="ease-out"
                                    >
                                        {pieData.map((_, i) => (
                                            <Cell key={`year-${i}`} fill={YEAR_COLORS[i % YEAR_COLORS.length]} stroke="#fff" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        wrapperStyle={{ fontSize: 8, paddingTop: 0, lineHeight: '12px' }}
                                    />
                                    <RechartsTooltip
                                        formatter={(value, _name, ctx) => [`${Number(value)} vehicle(s)`, `Year ${ctx?.payload?.name || ''}`]}
                                        contentStyle={tooltipStyle}
                                    />
                                </PieChart>
                            </RechartsBox>
                        )}
                    </CompactChartCard>
                </ScrollReveal>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <ScrollReveal delayMs={100} durationMs={750}>
                    <div className={chartPanelClass}>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 group-hover/chart:text-teal-800 transition-colors">
                            Vehicle value by asset
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">Top vehicles by recorded asset value.</p>
                        {vehicleValueBars.length === 0 ? (
                            <p className="text-sm text-slate-400 py-12 text-center">No asset values set.</p>
                        ) : (
                            <RechartsBox height={300} minHeight={240}>
                                <BarChart data={vehicleValueBars} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        interval={0}
                                        angle={-22}
                                        textAnchor="end"
                                        height={52}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                                    <RechartsTooltip
                                        formatter={(v) => [`AED ${Number(v).toLocaleString()}`, 'Value']}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Bar
                                        dataKey="value"
                                        fill="#7c3aed"
                                        radius={[8, 8, 0, 0]}
                                        maxBarSize={48}
                                        animationDuration={chartAnim}
                                        animationEasing="ease-out"
                                    />
                                </BarChart>
                            </RechartsBox>
                        )}
                    </div>
                </ScrollReveal>

                <ScrollReveal delayMs={180} durationMs={750}>
                    <div className={chartPanelClass}>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 group-hover/chart:text-teal-800 transition-colors">
                            Vehicle usage (service events)
                        </h3>
                        <PeriodTabs value={usagePeriod} onChange={setUsagePeriod} />
                        <RechartsBox height={260} minHeight={200}>
                            <BarChart data={usageChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
                                <RechartsTooltip contentStyle={tooltipStyle} />
                                <Bar
                                    dataKey="count"
                                    fill="#14b8a6"
                                    radius={[6, 6, 0, 0]}
                                    name="Service records"
                                    maxBarSize={40}
                                    animationDuration={chartAnim}
                                    animationEasing="ease-out"
                                />
                            </BarChart>
                        </RechartsBox>
                    </div>
                </ScrollReveal>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-teal-600" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-600">
                            Locator GPS
                        </h2>
                    </div>
                    {onLocatorRefresh ? (
                        <button
                            type="button"
                            onClick={onLocatorRefresh}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-teal-700 hover:border-teal-200 transition-colors"
                        >
                            <RefreshCw size={14} />
                            Refresh GPS
                        </button>
                    ) : null}
                </div>

                {locatorLoading ? (
                    <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-500">
                        Loading Locator GPS data…
                    </div>
                ) : locatorError ? (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-6 text-center">
                        <p className="text-sm font-semibold text-amber-800">{locatorError}</p>
                    </div>
                ) : !locatorData?.configured ? (
                    <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500">
                        Locator GPS is not configured on the server.
                    </div>
                ) : locatorData?.connected === false ? (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-6 text-center">
                        <p className="text-sm font-semibold text-amber-800">
                            {locatorData?.message || 'Could not load Locator GPS positions.'}
                        </p>
                        {onLocatorRefresh ? (
                            <button
                                type="button"
                                onClick={onLocatorRefresh}
                                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-200 bg-white text-xs font-semibold text-amber-800 hover:bg-amber-50"
                            >
                                <RefreshCw size={14} />
                                Try again
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <div className="space-y-5">
                        {locatorData?.snapshotWarning ? (
                            <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
                                GPS live data loaded, but history snapshots could not be saved. Charts may show limited running km until snapshots are captured.
                            </div>
                        ) : null}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
                            <ScrollReveal delayMs={0} durationMs={750} className="h-full">
                                <LocatorStaticChartCard
                                    chart={locatorChartsById.odometer}
                                    data={locatorChartDataById.odometer}
                                    chartAnim={chartAnim}
                                    chartsReady={chartsReady}
                                    runningPeriod={locatorRunningPeriod}
                                    idlePeriod={locatorIdlePeriod}
                                />
                            </ScrollReveal>
                            <ScrollReveal delayMs={80} durationMs={750} className="h-full">
                                <LocatorStaticChartCard
                                    chart={locatorChartsById.running}
                                    data={runningKmChartData}
                                    chartAnim={chartAnim}
                                    chartsReady={chartsReady}
                                    runningPeriod={locatorRunningPeriod}
                                    idlePeriod={locatorIdlePeriod}
                                    periodControls={locatorPeriodControls('running')}
                                    subtitleOverride={runningKmSubtitle}
                                />
                            </ScrollReveal>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
                            <ScrollReveal delayMs={160} durationMs={750} className="h-full">
                                <LocatorStaticChartCard
                                    chart={locatorChartsById.idle}
                                    data={locatorChartDataById.idle}
                                    chartAnim={chartAnim}
                                    chartsReady={chartsReady}
                                    runningPeriod={locatorRunningPeriod}
                                    idlePeriod={locatorIdlePeriod}
                                    periodControls={locatorPeriodControls('idle')}
                                    subtitleOverride={idleSubtitle}
                                />
                            </ScrollReveal>
                            <ScrollReveal delayMs={240} durationMs={750} className="h-full">
                                <LocatorStaticChartCard
                                    chart={locatorChartsById.salik}
                                    data={locatorChartDataById.salik}
                                    chartAnim={chartAnim}
                                    chartsReady={chartsReady}
                                    runningPeriod={locatorRunningPeriod}
                                    idlePeriod={locatorIdlePeriod}
                                    periodControls={locatorPeriodControls('salik')}
                                    subtitleOverride={salikSubtitle}
                                />
                            </ScrollReveal>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
