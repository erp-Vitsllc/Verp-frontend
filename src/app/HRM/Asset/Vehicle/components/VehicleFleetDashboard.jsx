'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { AlertCircle, ArrowLeftRight, Bell, Car, ChevronRight, ClipboardList, Clock, Gauge, MapPin, RefreshCw, Route, TrendingUp, Wrench } from 'lucide-react';
import {
    vehicleDashboardKpiHref,
    vehicleDashboardKpiTitle,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleFleetDashboardNavigation';

const YEAR_COLORS = ['#ef4444', '#f97316', '#a855f7', '#3b82f6', '#14b8a6', '#eab308', '#64748b'];

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
        rose: { wrap: 'bg-rose-50/90 border-rose-100', label: 'text-rose-600', value: 'text-rose-900' },
        amber: { wrap: 'bg-amber-50/90 border-amber-100', label: 'text-amber-700', value: 'text-amber-900' },
        emerald: { wrap: 'bg-emerald-50/90 border-emerald-100', label: 'text-emerald-700', value: 'text-emerald-900' },
        sky: { wrap: 'bg-sky-50/90 border-sky-100', label: 'text-sky-700', value: 'text-sky-900' },
        violet: { wrap: 'bg-violet-50/90 border-violet-100', label: 'text-violet-700', value: 'text-violet-900' },
        pink: { wrap: 'bg-pink-50/90 border-pink-100', label: 'text-pink-600', value: 'text-pink-900' },
        lime: { wrap: 'bg-lime-50/90 border-lime-100', label: 'text-lime-700', value: 'text-lime-900' },
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
            className={`w-full rounded-xl border text-center transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-md hover:z-10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 ${tilePad} ${t.wrap}`}
        >
            {inner}
        </button>
    );
}

function KpiGroup({ title, icon: Icon, children, delayMs = 0, className = '' }) {
    return (
        <ScrollReveal delayMs={delayMs} durationMs={600} className={className}>
            <div className="group h-full bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:shadow-xl hover:shadow-teal-900/8 hover:border-teal-200/60 hover:-translate-y-1">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-gradient-to-r from-white to-slate-50/80">
                    {Icon ? <Icon className="w-3.5 h-3.5 text-teal-600 shrink-0" strokeWidth={2.25} /> : null}
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</h3>
                </div>
                <div className="p-3">{children}</div>
            </div>
        </ScrollReveal>
    );
}

function PeriodTabs({ value, onChange }) {
    const opts = [
        { id: 'day', label: 'Day' },
        { id: 'week', label: 'Week' },
        { id: 'month', label: 'Month' },
    ];
    return (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-3">
            {opts.map((o) => (
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

function LocatorPeriodTabs({ value, onChange }) {
    const opts = [
        { id: 'day', label: 'Day' },
        { id: 'month', label: 'Month' },
        { id: 'year', label: 'Year' },
    ];
    return (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-3">
            {opts.map((o) => (
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

function SalikPeriodTabs({ value, onChange }) {
    const opts = [
        { id: 'day', label: 'Yesterday' },
        { id: 'week', label: 'Mon–Sun' },
        { id: 'month', label: 'Month' },
    ];
    return (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-3">
            {opts.map((o) => (
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

function withShortNames(rows, compact = false) {
    return (rows || []).map((row) => ({
        ...row,
        shortName: compact ? locatorVehicleLabel(row.name) : locatorVehicleLabel(row.name),
    }));
}

const LOCATOR_BAR_BG_CLASSES = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-teal-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-fuchsia-500',
    'bg-pink-500',
];

const LOCATOR_BAR_FILLS = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#84cc16',
    '#22c55e',
    '#14b8a6',
    '#0ea5e9',
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#d946ef',
    '#ec4899',
];

const LOCATOR_LAYOUT_MS = 900;
const LOCATOR_LAYOUT_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const LOCATOR_WIDTH_TRANSITION = `width ${LOCATOR_LAYOUT_MS}ms ${LOCATOR_LAYOUT_EASE}`;
const LOCATOR_CHART_HEIGHT = 320;
const LOCATOR_ROW_MIN_HEIGHT = 480;
const LOCATOR_COLLAPSED_CANVAS_WIDTH = 720;

const LOCATOR_GRID_ORDER = ['running', 'odometer', 'idle', 'salik'];

const LOCATOR_ROWS = [
    { rowKey: 'row1', cardIds: ['odometer', 'running'], defaultActive: 'running' },
    { rowKey: 'row2', cardIds: ['idle', 'salik'], defaultActive: 'idle' },
];

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
    },
].sort((a, b) => LOCATOR_GRID_ORDER.indexOf(a.id) - LOCATOR_GRID_ORDER.indexOf(b.id));

function locatorBarColor(index) {
    return LOCATOR_BAR_FILLS[index % LOCATOR_BAR_FILLS.length];
}

function LocatorVerticalBarChart({
    data,
    valueLabel,
    chartAnim = 0,
    barOpacity = 1,
    animateBars = false,
    showDetail = true,
}) {
    if (!data?.length) {
        return (
            <p className="text-slate-400 text-center text-xs py-16">
                No data yet
            </p>
        );
    }

    const chartHeight = LOCATOR_CHART_HEIGHT;
    const barAnimationDuration = animateBars ? chartAnim : 0;
    const barCount = data.length;
    const expandedBarSize = Math.min(56, Math.max(28, Math.floor(640 / Math.max(barCount, 1))));
    const collapsedBarSize = Math.min(24, Math.max(12, Math.floor(LOCATOR_COLLAPSED_CANVAS_WIDTH / Math.max(barCount, 1)) - 4));

    const tooltip = (
        <RechartsTooltip
            formatter={(v) => [`${Number(v).toLocaleString()} ${valueLabel}`, valueLabel]}
            labelFormatter={(_label, payload) => payload?.[0]?.payload?.name || _label}
            contentStyle={tooltipStyle}
        />
    );

    if (showDetail) {
        return (
            <div className="w-full h-full" style={{ minHeight: chartHeight }}>
                <RechartsBox height={chartHeight} minHeight={chartHeight}>
                    <BarChart
                        data={data}
                        margin={{ top: 18, right: 12, left: 2, bottom: 4 }}
                        barCategoryGap="16%"
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="shortName" hide />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            width={46}
                            tickFormatter={formatKmAxisTick}
                        />
                        {tooltip}
                        <Bar
                            dataKey="value"
                            radius={[8, 8, 0, 0]}
                            maxBarSize={expandedBarSize}
                            isAnimationActive={animateBars}
                            animationDuration={barAnimationDuration}
                            animationEasing="ease-out"
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`loc-bar-${entry.name || index}`}
                                    fill={locatorBarColor(index)}
                                    fillOpacity={barOpacity}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </RechartsBox>
            </div>
        );
    }

    const previewCanvasWidth = Math.max(LOCATOR_COLLAPSED_CANVAS_WIDTH, barCount * 34);

    return (
        <div
            className="w-full h-full overflow-hidden"
            style={{ minHeight: chartHeight, height: chartHeight }}
        >
            <div style={{ width: previewCanvasWidth, height: chartHeight }}>
                <RechartsBox
                    fixedSize={{ width: previewCanvasWidth, height: chartHeight }}
                    minHeight={chartHeight}
                >
                    <BarChart
                        data={data}
                        margin={{ top: 12, right: 4, left: 0, bottom: 4 }}
                        barCategoryGap="18%"
                    >
                        <XAxis dataKey="shortName" hide />
                        <YAxis hide />
                        {tooltip}
                        <Bar
                            dataKey="value"
                            radius={[5, 5, 0, 0]}
                            maxBarSize={collapsedBarSize}
                            isAnimationActive={false}
                            animationDuration={0}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`loc-bar-${entry.name || index}`}
                                    fill={locatorBarColor(index)}
                                    fillOpacity={barOpacity}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </RechartsBox>
            </div>
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

function LocatorChartHeader({ chart, runningPeriod, idlePeriod, expanded }) {
    const Icon = chart.icon;
    const subtitle = resolveLocatorSubtitle(chart, runningPeriod, idlePeriod);

    return (
        <div
            className={`relative flex items-start justify-between gap-2 ${
                expanded ? 'mb-3' : 'mb-2'
            }`}
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    {Icon ? (
                        <Icon className={`w-4 h-4 shrink-0 ${chart.iconClass}`} strokeWidth={2.25} />
                    ) : null}
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
                        {chart.title}
                    </h3>
                </div>
                <p
                    className={`text-xs text-slate-400 overflow-hidden transition-[max-height,opacity,margin] duration-[900ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
                        expanded ? 'max-h-12 opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'
                    }`}
                >
                    {subtitle}
                </p>
            </div>
            <ChevronRight
                className={`shrink-0 transition-transform duration-[900ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    expanded
                        ? 'w-4 h-4 text-slate-400 rotate-90 mt-0.5'
                        : 'w-3.5 h-3.5 text-slate-300 rotate-0'
                }`}
                aria-hidden
            />
        </div>
    );
}

function LocatorExpandableCard({
    chart,
    data,
    chartAnim,
    runningPeriod,
    idlePeriod,
    periodControls = null,
    contentExpanded,
    onActivate,
}) {
    const chartData = withShortNames(data, !contentExpanded);

    const handleShellKeyDown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.target.closest('button')) return;
        event.preventDefault();
        onActivate();
    };

    return (
        <div
            tabIndex={0}
            onClick={onActivate}
            onKeyDown={handleShellKeyDown}
            aria-expanded={contentExpanded}
            aria-label={`${chart.title}${contentExpanded ? '' : ', click to expand'}`}
            className={`w-full h-full min-h-0 flex flex-col text-left rounded-2xl border p-3 md:p-5 transition-[border-color,box-shadow,background-color] duration-[900ms] ease-[cubic-bezier(0.4,0,0.2,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:ring-offset-2 cursor-pointer ${
                contentExpanded
                    ? `border-t-4 ${chart.accent} border-slate-100 bg-white shadow-sm`
                    : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-md'
            }`}
        >
            <LocatorChartHeader
                chart={chart}
                runningPeriod={runningPeriod}
                idlePeriod={idlePeriod}
                expanded={contentExpanded}
            />
            {contentExpanded && periodControls ? (
                <div
                    role="presentation"
                    className="shrink-0 overflow-hidden transition-[max-height,opacity,margin] duration-[900ms] ease-[cubic-bezier(0.4,0,0.2,1)] max-h-16 opacity-100 mb-2"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    {periodControls}
                </div>
            ) : null}
            <div
                className={`flex-1 min-h-[320px] flex flex-col justify-end transition-opacity duration-[900ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    contentExpanded ? 'opacity-100' : 'opacity-70'
                }`}
            >
                <LocatorVerticalBarChart
                    data={chartData}
                    valueLabel={chart.valueLabel}
                    showDetail={contentExpanded}
                    chartAnim={chartAnim}
                    animateBars={false}
                    barOpacity={1}
                />
            </div>
            <p
                className={`shrink-0 text-[10px] font-semibold overflow-hidden transition-[max-height,opacity,margin] duration-[900ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    chart.linkClass
                } ${contentExpanded ? 'max-h-0 opacity-0 mt-0' : 'max-h-6 opacity-100 mt-2'}`}
            >
                Click to expand
            </p>
        </div>
    );
}

function LocatorCardRow({
    cardIds,
    activeId,
    onActiveChange,
    chartsById,
    dataById,
    chartAnim,
    runningPeriod,
    idlePeriod,
    periodControlsFor,
}) {
    const [contentActiveId, setContentActiveId] = useState(activeId);
    const pendingTransitionsRef = useRef(0);
    const activeIdRef = useRef(activeId);
    activeIdRef.current = activeId;

    const handleActiveChange = (cardId) => {
        if (cardId === activeId) return;
        pendingTransitionsRef.current = 0;
        onActiveChange(cardId);
    };

    const handleSlotTransitionEnd = (event) => {
        if (event.propertyName !== 'width') return;
        pendingTransitionsRef.current += 1;
        if (pendingTransitionsRef.current < cardIds.length) return;
        pendingTransitionsRef.current = 0;
        setContentActiveId(activeIdRef.current);
    };

    useEffect(() => {
        if (contentActiveId === activeId) return undefined;
        const timer = setTimeout(() => {
            setContentActiveId(activeIdRef.current);
        }, LOCATOR_LAYOUT_MS + 32);
        return () => clearTimeout(timer);
    }, [activeId, contentActiveId]);

    const renderCard = (cardId) => {
        const chart = chartsById[cardId];
        if (!chart) return null;

        return (
            <LocatorExpandableCard
                chart={chart}
                data={dataById[cardId]}
                chartAnim={chartAnim}
                runningPeriod={runningPeriod}
                idlePeriod={idlePeriod}
                periodControls={periodControlsFor(cardId)}
                contentExpanded={contentActiveId === cardId}
                onActivate={() => handleActiveChange(cardId)}
            />
        );
    };

    return (
        <>
            <div className="hidden sm:flex gap-4 items-stretch w-full" style={{ minHeight: LOCATOR_ROW_MIN_HEIGHT }}>
                {cardIds.map((cardId) => {
                    const isActive = activeId === cardId;
                    const widthShare = isActive ? 0.75 : 0.25;

                    return (
                        <div
                            key={cardId}
                            className="min-w-0 h-full shrink-0 flex flex-col overflow-hidden will-change-[width]"
                            style={{
                                width: `calc((100% - 1rem) * ${widthShare})`,
                                transition: LOCATOR_WIDTH_TRANSITION,
                            }}
                            onTransitionEnd={handleSlotTransitionEnd}
                        >
                            {renderCard(cardId)}
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-col gap-3 sm:hidden">
                {cardIds.map((cardId) => (
                    <div key={cardId} className="min-w-0 w-full">
                        <LocatorExpandableCard
                            chart={chartsById[cardId]}
                            data={dataById[cardId]}
                            chartAnim={chartAnim}
                            runningPeriod={runningPeriod}
                            idlePeriod={idlePeriod}
                            periodControls={periodControlsFor(cardId)}
                            contentExpanded={activeId === cardId}
                            onActivate={() => onActiveChange(cardId)}
                        />
                    </div>
                ))}
            </div>
        </>
    );
}

/* Tailwind safelist — keeps rainbow bar utility classes in the build */
function LocatorBarPaletteSafelist() {
    return (
        <div className="hidden" aria-hidden>
            {LOCATOR_BAR_BG_CLASSES.map((barClass) => (
                <span key={barClass} className={barClass} />
            ))}
        </div>
    );
}

const chartPanelClass =
    'group/chart bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-900/8 hover:border-teal-200/60';

const tooltipStyle = {
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    fontSize: '12px',
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
    const [idlePeriod, setIdlePeriod] = useState('week');
    const [locatorRunningPeriod, setLocatorRunningPeriod] = useState('day');
    const [locatorIdlePeriod, setLocatorIdlePeriod] = useState('day');
    const [salikPeriod, setSalikPeriod] = useState('month');
    const [locatorRowActive, setLocatorRowActive] = useState(() =>
        Object.fromEntries(LOCATOR_ROWS.map((row) => [row.rowKey, row.defaultActive])),
    );
    const [chartsReady, setChartsReady] = useState(false);

    useEffect(() => {
        if (!loading && data) {
            const t = setTimeout(() => setChartsReady(true), 80);
            return () => clearTimeout(t);
        }
        setChartsReady(false);
        return undefined;
    }, [loading, data]);

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

    const idleChartData = useMemo(() => {
        const block = data?.usageByPeriod?.[idlePeriod];
        if (!block?.labels?.length) return [];
        return block.labels.map((label, i) => ({
            name: label,
            vehicles: block.idle[i] ?? 0,
        }));
    }, [data?.usageByPeriod, idlePeriod]);

    const odometerChartData = useMemo(
        () => withShortNames(mapLocatorSeries(locatorData?.odometerByVehicle)),
        [locatorData?.odometerByVehicle],
    );

    const runningKmChartData = useMemo(() => {
        const block = locatorData?.runningKm?.[locatorRunningPeriod];
        if (!block?.length) return [];
        return withShortNames(
            block.map((row) => ({
                name: row.label,
                value: Number(row.value) || 0,
            })),
        );
    }, [locatorData?.runningKm, locatorRunningPeriod]);

    const locatorIdleChartData = useMemo(
        () => withShortNames(mapLocatorSeries(locatorData?.idleTimeByVehicle?.[locatorIdlePeriod])),
        [locatorData?.idleTimeByVehicle, locatorIdlePeriod],
    );

    const salikChartData = useMemo(
        () => withShortNames(mapLocatorSeries(locatorData?.salikWise?.[salikPeriod])),
        [locatorData?.salikWise, salikPeriod],
    );

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
                <LocatorPeriodTabs value={locatorRunningPeriod} onChange={setLocatorRunningPeriod} />
            );
        }
        if (chartId === 'idle') {
            return (
                <LocatorPeriodTabs value={locatorIdlePeriod} onChange={setLocatorIdlePeriod} />
            );
        }
        if (chartId === 'salik') {
            return <SalikPeriodTabs value={salikPeriod} onChange={setSalikPeriod} />;
        }
        return null;
    };

    const setLocatorRowActiveId = (rowKey, cardId) => {
        setLocatorRowActive((prev) => ({ ...prev, [rowKey]: cardId }));
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <KpiGroup title="Service reminder" icon={Wrench} delayMs={0}>
                        <div className="grid grid-cols-2 gap-2">
                            <KpiTile label="Due" value={r.service?.due ?? 0} tone="rose" routeKey="serviceDue" />
                            <KpiTile label="Days down" value={r.service?.dueSoon ?? 0} tone="amber" routeKey="serviceDueSoon" />
                        </div>
                    </KpiGroup>
                    <KpiGroup title="Registration reminder" icon={Bell} delayMs={60}>
                        <div className="grid grid-cols-2 gap-2">
                            <KpiTile label="Due" value={r.registration?.due ?? 0} tone="rose" routeKey="registrationDue" />
                            <KpiTile label="Days down" value={r.registration?.dueSoon ?? 0} tone="amber" routeKey="registrationDueSoon" />
                        </div>
                    </KpiGroup>
                    <KpiGroup title="Vehicle assets" icon={Car} delayMs={120} className="md:col-span-2 xl:col-span-1">
                        <div className="grid grid-cols-3 gap-2">
                            <KpiTile label="Assigned" value={vs.assigned ?? 0} tone="emerald" routeKey="assigned" />
                            <KpiTile label="Unassigned" value={vs.unassigned ?? 0} tone="sky" routeKey="unassigned" />
                            <KpiTile label="In service" value={vs.inService ?? 0} tone="violet" routeKey="inService" />
                        </div>
                    </KpiGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <KpiGroup title="Service / asset requests" icon={ClipboardList} delayMs={180}>
                        <div className="grid grid-cols-2 gap-2">
                            <KpiTile label="Pending" value={sr.pending ?? 0} tone="pink" routeKey="requestPending" />
                            <KpiTile label="Approved" value={sr.confirmed ?? 0} tone="amber" routeKey="requestApproved" />
                        </div>
                    </KpiGroup>
                    <KpiGroup
                        title="Handover (assignment)"
                        icon={ArrowLeftRight}
                        delayMs={240}
                        className="md:col-span-2 xl:col-span-2"
                    >
                        <div className="grid grid-cols-2 gap-3">
                            <KpiTile label="Pending asset" value={hr.pending ?? 0} tone="pink" routeKey="handoverPending" wide />
                            <KpiTile label="Accepted" value={hr.confirmed ?? 0} tone="lime" routeKey="handoverAccepted" wide />
                        </div>
                    </KpiGroup>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <ScrollReveal delayMs={0} durationMs={700}>
                    <div className={chartPanelClass}>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 group-hover/chart:text-teal-800 transition-colors">
                            Service cost by month
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">Total maintenance spend across the year.</p>
                        {!hasServiceCostData ? (
                            <p className="text-sm text-slate-400 py-12 text-center">No service spend recorded yet.</p>
                        ) : (
                            <RechartsBox height={280} minHeight={240}>
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
                                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        interval={0}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={48}
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
                    </div>
                </ScrollReveal>

                <ScrollReveal delayMs={100} durationMs={700}>
                    <div className={chartPanelClass}>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 group-hover/chart:text-teal-800 transition-colors">
                            Service cost by vehicle
                        </h3>
                        {serviceCostByVehicle.length === 0 ? (
                            <p className="text-sm text-slate-400 py-12 text-center">No per-vehicle service costs yet.</p>
                        ) : (
                            <RechartsBox height={280} minHeight={240}>
                                <BarChart
                                    data={serviceCostByVehicle}
                                    layout="vertical"
                                    margin={{ left: 4, right: 72, top: 4, bottom: 4 }}
                                    barCategoryGap="22%"
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={88}
                                        tick={{ fontSize: 10, fill: '#64748b' }}
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
                                        maxBarSize={22}
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
                    </div>
                </ScrollReveal>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <ScrollReveal delayMs={0} durationMs={750}>
                    <div className={chartPanelClass}>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 group-hover/chart:text-teal-800 transition-colors">
                            Vehicle model year
                        </h3>
                        {pieData.length === 0 ? (
                            <p className="text-sm text-slate-400 py-12 text-center">No model years on record.</p>
                        ) : (
                            <RechartsBox height={300} minHeight={240}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="46%"
                                        innerRadius={58}
                                        outerRadius={92}
                                        paddingAngle={2}
                                        animationDuration={chartAnim}
                                        animationEasing="ease-out"
                                    >
                                        {pieData.map((_, i) => (
                                            <Cell key={`year-${i}`} fill={YEAR_COLORS[i % YEAR_COLORS.length]} stroke="#fff" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                                    <RechartsTooltip
                                        formatter={(value, _name, ctx) => [`${Number(value)} vehicle(s)`, `Year ${ctx?.payload?.name || ''}`]}
                                        contentStyle={tooltipStyle}
                                    />
                                </PieChart>
                            </RechartsBox>
                        )}
                    </div>
                </ScrollReveal>

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
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <ScrollReveal delayMs={0} durationMs={750}>
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

                <ScrollReveal delayMs={110} durationMs={750}>
                    <div className={chartPanelClass}>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 group-hover/chart:text-teal-800 transition-colors">
                            Vehicle idle (no service in period)
                        </h3>
                        <PeriodTabs value={idlePeriod} onChange={setIdlePeriod} />
                        <RechartsBox height={260} minHeight={200}>
                            <BarChart data={idleChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
                                <RechartsTooltip contentStyle={tooltipStyle} />
                                <Bar
                                    dataKey="vehicles"
                                    fill="#f97316"
                                    radius={[6, 6, 0, 0]}
                                    name="Vehicles"
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
                ) : (
                    <div className="space-y-4">
                        <LocatorBarPaletteSafelist />
                        {LOCATOR_ROWS.map((row) => (
                            <LocatorCardRow
                                key={row.rowKey}
                                cardIds={row.cardIds}
                                activeId={locatorRowActive[row.rowKey]}
                                onActiveChange={(cardId) => setLocatorRowActiveId(row.rowKey, cardId)}
                                chartsById={locatorChartsById}
                                dataById={locatorChartDataById}
                                chartAnim={chartAnim}
                                runningPeriod={locatorRunningPeriod}
                                idlePeriod={locatorIdlePeriod}
                                periodControlsFor={locatorPeriodControls}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
