'use client';

import { useMemo, useState } from 'react';
import ScrollReveal from '@/components/ScrollReveal';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';
import { AlertCircle, Bell, Car, ClipboardList, RefreshCw, Wrench } from 'lucide-react';

const COLORS = ['#0d9488', '#0284c7', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#64748b'];

function StatCard({ title, icon: Icon, children, className = '' }) {
    return (
        <div
            className={`group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:shadow-xl hover:shadow-teal-900/10 hover:border-teal-200/70 hover:-translate-y-1.5 hover:ring-2 hover:ring-teal-400/20 active:translate-y-0 active:scale-[0.995] active:shadow-md ${className}`}
        >
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 bg-gradient-to-r from-white to-slate-50/80 transition-colors group-hover:to-teal-50/30">
                {Icon && (
                    <Icon className="w-4 h-4 text-teal-600 shrink-0 transition-transform duration-300 group-hover:scale-110" />
                )}
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</h3>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function SplitCounts({ leftLabel, leftValue, rightLabel, rightValue }) {
    return (
        <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-center transition-all duration-300 ease-out hover:scale-105 hover:shadow-md hover:border-rose-200 hover:z-10 relative group-hover:scale-[1.02]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-1">{leftLabel}</p>
                <p className="text-2xl font-black text-rose-800 tabular-nums">{leftValue}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-center transition-all duration-300 ease-out hover:scale-105 hover:shadow-md hover:border-amber-200 hover:z-10 relative group-hover:scale-[1.02]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">{rightLabel}</p>
                <p className="text-2xl font-black text-amber-900 tabular-nums">{rightValue}</p>
            </div>
        </div>
    );
}

function TripleCounts({ aLabel, aVal, bLabel, bVal, cLabel, cVal }) {
    return (
        <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-3 text-center transition-all duration-300 ease-out hover:scale-105 hover:shadow-md hover:border-emerald-200 hover:z-10 relative group-hover:scale-[1.02]">
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 mb-1">{aLabel}</p>
                <p className="text-xl font-black text-emerald-900 tabular-nums">{aVal}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-center transition-all duration-300 ease-out hover:scale-105 hover:shadow-md hover:border-slate-300 hover:z-10 relative group-hover:scale-[1.02]">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600 mb-1">{bLabel}</p>
                <p className="text-xl font-black text-slate-800 tabular-nums">{bVal}</p>
            </div>
            <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-3 text-center transition-all duration-300 ease-out hover:scale-105 hover:shadow-md hover:border-violet-200 hover:z-10 relative group-hover:scale-[1.02]">
                <p className="text-[9px] font-bold uppercase tracking-wider text-violet-700 mb-1">{cLabel}</p>
                <p className="text-xl font-black text-violet-900 tabular-nums">{cVal}</p>
            </div>
        </div>
    );
}

function PeriodTabs({ value, onChange }) {
    const opts = [
        { id: 'day', label: 'Day' },
        { id: 'week', label: 'Week' },
        { id: 'month', label: 'Month' },
    ];
    return (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-3 shadow-inner transition-shadow duration-300 hover:shadow-md hover:bg-slate-100/90">
            {opts.map((o) => (
                <button
                    key={o.id}
                    type="button"
                    onClick={() => onChange(o.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ease-out ${
                        value === o.id
                            ? 'bg-white text-teal-700 shadow-md scale-[1.02] ring-1 ring-teal-200/50'
                            : 'text-slate-500 hover:text-teal-700 hover:bg-white/80 hover:scale-105 hover:shadow-sm active:scale-95'
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export default function VehicleFleetDashboard({ data, loading, error, onRefresh }) {
    const [usagePeriod, setUsagePeriod] = useState('month');
    const [idlePeriod, setIdlePeriod] = useState('month');

    const serviceCostByVehicle = useMemo(() => {
        if (!data?.vehicles?.length) return [];
        return [...data.vehicles]
            .filter((v) => v.totalServiceCost > 0)
            .sort((a, b) => b.totalServiceCost - a.totalServiceCost)
            .slice(0, 18)
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
            .slice(0, 18)
            .map((v) => ({
                name: v.label,
                value: Math.round(v.assetValue),
            }));
    }, [data]);

    const serviceCostMonthData = useMemo(() => {
        return (data?.serviceCostByMonth || []).map((row) => ({
            name: row.label,
            total: Math.round(row.total),
        }));
    }, [data?.serviceCostByMonth]);
    const isSingleServiceCostMonthBar = serviceCostMonthData.length <= 1;
    const isSingleServiceCostVehicleBar = serviceCostByVehicle.length <= 1;

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
                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="group/retry inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-semibold transition-all duration-300 hover:bg-red-50 hover:scale-105 hover:shadow-md hover:border-red-300 active:scale-95"
                    >
                        <RefreshCw size={16} className="transition-transform duration-500 group-hover/retry:rotate-180" /> Retry
                    </button>
                )}
            </div>
        );
    }

    if (!data) return null;

    const r = data.reminders || {};
    const vs = data.vehicleStatus || {};
    const sr = data.serviceRequest || {};
    const hr = data.handoverRequest || {};

    const chartPanel =
        'group/chart bg-white rounded-2xl border border-slate-100 shadow-sm p-6 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-900/10 hover:border-teal-200/70 hover:ring-2 hover:ring-teal-400/15 active:translate-y-0 active:scale-[0.995]';

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ScrollReveal delayMs={0} durationMs={650}>
                    <StatCard title="Service reminder" icon={Wrench}>
                        <SplitCounts
                            leftLabel="Due"
                            leftValue={r.service?.due ?? 0}
                            rightLabel="Due soon (30d)"
                            rightValue={r.service?.dueSoon ?? 0}
                        />
                    </StatCard>
                </ScrollReveal>
                <ScrollReveal delayMs={90} durationMs={650}>
                    <StatCard title="Registration reminder" icon={Bell}>
                        <SplitCounts
                            leftLabel="Due"
                            leftValue={r.registration?.due ?? 0}
                            rightLabel="Due soon (30d)"
                            rightValue={r.registration?.dueSoon ?? 0}
                        />
                    </StatCard>
                </ScrollReveal>
                <ScrollReveal delayMs={180} durationMs={650}>
                    <StatCard title="Vehicle assets" icon={Car}>
                        <TripleCounts
                            aLabel="Assigned"
                            aVal={vs.assigned ?? 0}
                            bLabel="Unassigned"
                            bVal={vs.unassigned ?? 0}
                            cLabel="In service"
                            cVal={vs.inService ?? 0}
                        />
                    </StatCard>
                </ScrollReveal>
            </div>

            {/* Row 2: service / asset requests + handover */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ScrollReveal delayMs={0} durationMs={700}>
                    <StatCard title="Service / asset requests" icon={ClipboardList}>
                        <SplitCounts
                            leftLabel="Pending"
                            leftValue={sr.pending ?? 0}
                            rightLabel="Approved"
                            rightValue={sr.confirmed ?? 0}
                        />
                        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed transition-colors duration-300 group-hover:text-slate-600">
                            Pending / approved counts from dashboard notifications linked to vehicle assets.
                        </p>
                    </StatCard>
                </ScrollReveal>
                <ScrollReveal delayMs={100} durationMs={700}>
                    <StatCard title="Handover (assignment)" icon={ClipboardList}>
                        <SplitCounts
                            leftLabel="Pending accept"
                            leftValue={hr.pending ?? 0}
                            rightLabel="Accepted"
                            rightValue={hr.confirmed ?? 0}
                        />
                        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed transition-colors duration-300 group-hover:text-slate-600">
                            Vehicles assigned to an employee awaiting acceptance vs accepted.
                        </p>
                    </StatCard>
                </ScrollReveal>
            </div>

            {/* Service cost: by month + by vehicle (same row, two columns) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ScrollReveal delayMs={0} durationMs={750}>
                    <div className={chartPanel}>
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 transition-colors duration-300 group-hover/chart:text-teal-800">Service cost (by month)</h3>
                        <div className="h-[280px] w-full min-h-[240px]">
                            {serviceCostMonthData.length === 0 ? (
                                <p className="text-sm text-slate-400 py-12 text-center">No service spend recorded yet.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={serviceCostMonthData}
                                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                                        barCategoryGap={isSingleServiceCostMonthBar ? '70%' : '35%'}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                        <RechartsTooltip formatter={(v) => [`AED ${Number(v).toLocaleString()}`, 'Total']} />
                                        <Bar
                                            dataKey="total"
                                            fill="#0d9488"
                                            radius={[6, 6, 0, 0]}
                                            name="Service cost"
                                            maxBarSize={isSingleServiceCostMonthBar ? 64 : 120}
                                            animationDuration={1200}
                                            animationEasing="ease-out"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </ScrollReveal>
                <ScrollReveal delayMs={120} durationMs={750}>
                    <div className={chartPanel}>
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 transition-colors duration-300 group-hover/chart:text-teal-800">
                            Service cost by vehicle (top spenders)
                        </h3>
                        <div className="h-[280px] w-full min-h-[240px]">
                            {serviceCostByVehicle.length === 0 ? (
                                <p className="text-sm text-slate-400 py-12 text-center">No per-vehicle service costs yet.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={serviceCostByVehicle}
                                        layout="vertical"
                                        margin={{ left: 8, right: 16 }}
                                        barCategoryGap={isSingleServiceCostVehicleBar ? '70%' : '28%'}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal />
                                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                        <RechartsTooltip formatter={(v) => [`AED ${Number(v).toLocaleString()}`, 'Total']} />
                                        <Bar
                                            dataKey="total"
                                            fill="#0891b2"
                                            radius={[0, 4, 4, 0]}
                                            maxBarSize={isSingleServiceCostVehicleBar ? 48 : 26}
                                            animationDuration={1200}
                                            animationEasing="ease-out"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </ScrollReveal>
            </div>

            {/* Vehicle model year + value by asset (one row, two columns) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ScrollReveal delayMs={0} durationMs={800}>
                    <div className={chartPanel}>
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 transition-colors duration-300 group-hover/chart:text-teal-800">Vehicle model year</h3>
                        <div className="h-[300px] w-full min-h-[240px]">
                            {pieData.length === 0 ? (
                                <p className="text-sm text-slate-400 py-12 text-center">No model years on record.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={95}
                                            label={false}
                                            labelLine={false}
                                            animationDuration={1100}
                                            animationEasing="ease-out"
                                        >
                                            {pieData.map((_, i) => (
                                                <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Legend />
                                        <RechartsTooltip
                                            formatter={(value, _name, ctx) => {
                                                const label = ctx?.payload?.name || 'Year';
                                                return [`${Number(value)}`, `${label}`];
                                            }}
                                            contentStyle={{
                                                borderRadius: '10px',
                                                border: '1px solid #e2e8f0',
                                                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
                                            }}
                                            cursor={{ fill: 'rgba(15, 23, 42, 0.06)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </ScrollReveal>
                <ScrollReveal delayMs={120} durationMs={750}>
                    <div className={chartPanel}>
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-2 transition-colors duration-300 group-hover/chart:text-teal-800">Vehicle value by asset</h3>
                        <p className="text-xs text-slate-400 mb-4 transition-colors duration-300 group-hover/chart:text-slate-500">Total recorded asset value (top by value).</p>
                        <div className="h-[300px] w-full min-h-[240px]">
                            {vehicleValueBars.length === 0 ? (
                                <p className="text-sm text-slate-400 py-12 text-center">No asset values set.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={vehicleValueBars} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-25} textAnchor="end" height={60} />
                                        <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                        <RechartsTooltip formatter={(v) => [`AED ${Number(v).toLocaleString()}`, 'Value']} />
                                        <Bar
                                            dataKey="value"
                                            fill="#6366f1"
                                            radius={[6, 6, 0, 0]}
                                            animationDuration={1200}
                                            animationEasing="ease-out"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </ScrollReveal>
            </div>

            {/* Usage + Idle */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ScrollReveal delayMs={0} durationMs={750}>
                    <div className={chartPanel}>
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-1 transition-colors duration-300 group-hover/chart:text-teal-800">Vehicle usage (service events)</h3>
                        <PeriodTabs value={usagePeriod} onChange={setUsagePeriod} />
                        <div className="h-[260px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={usageChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                    <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" allowDecimals={false} />
                                    <RechartsTooltip />
                                    <Bar
                                        dataKey="count"
                                        fill="#14b8a6"
                                        radius={[6, 6, 0, 0]}
                                        name="Service records"
                                        animationDuration={1200}
                                        animationEasing="ease-out"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </ScrollReveal>
                <ScrollReveal delayMs={110} durationMs={750}>
                    <div className={chartPanel}>
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-1 transition-colors duration-300 group-hover/chart:text-teal-800">Vehicle idle (no service in period)</h3>
                        <PeriodTabs value={idlePeriod} onChange={setIdlePeriod} />
                        <div className="h-[260px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={idleChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                    <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" allowDecimals={false} />
                                    <RechartsTooltip />
                                    <Bar
                                        dataKey="vehicles"
                                        fill="#94a3b8"
                                        radius={[6, 6, 0, 0]}
                                        name="Vehicles"
                                        animationDuration={1200}
                                        animationEasing="ease-out"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </ScrollReveal>
            </div>
        </div>
    );
}
