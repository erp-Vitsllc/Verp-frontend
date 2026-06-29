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
import { AlertCircle, ArrowLeftRight, Bell, Car, ClipboardList, RefreshCw, Wrench } from 'lucide-react';
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

const chartPanelClass =
    'group/chart bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-900/8 hover:border-teal-200/60';

const tooltipStyle = {
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    fontSize: '12px',
};

export default function VehicleFleetDashboard({ data, loading, error, onRefresh }) {
    const [usagePeriod, setUsagePeriod] = useState('week');
    const [idlePeriod, setIdlePeriod] = useState('week');
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
        </div>
    );
}
