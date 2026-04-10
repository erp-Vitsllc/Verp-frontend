'use client';

import { useMemo, useState } from 'react';
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
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4 text-teal-600 shrink-0" />}
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</h3>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function SplitCounts({ leftLabel, leftValue, rightLabel, rightValue }) {
    return (
        <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-1">{leftLabel}</p>
                <p className="text-2xl font-black text-rose-800">{leftValue}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">{rightLabel}</p>
                <p className="text-2xl font-black text-amber-900">{rightValue}</p>
            </div>
        </div>
    );
}

function TripleCounts({ aLabel, aVal, bLabel, bVal, cLabel, cVal }) {
    return (
        <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 mb-1">{aLabel}</p>
                <p className="text-xl font-black text-emerald-900">{aVal}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600 mb-1">{bLabel}</p>
                <p className="text-xl font-black text-slate-800">{bVal}</p>
            </div>
            <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-violet-700 mb-1">{cLabel}</p>
                <p className="text-xl font-black text-violet-900">{cVal}</p>
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
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-3">
            {opts.map((o) => (
                <button
                    key={o.id}
                    type="button"
                    onClick={() => onChange(o.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        value === o.id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
    }, [data?.vehicles]);

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
    }, [data?.vehicles]);

    const serviceCostMonthData = useMemo(() => {
        return (data?.serviceCostByMonth || []).map((row) => ({
            name: row.label,
            total: Math.round(row.total),
        }));
    }, [data?.serviceCostByMonth]);

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
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
                <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-semibold">Loading fleet dashboard…</p>
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
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50"
                    >
                        <RefreshCw size={16} /> Retry
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

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                    Service / registration reminders use next service & gear-oil dates and registration expiry (including registration
                    documents). Usage & idle charts count service records per period (fleet activity proxy).
                </p>
                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                )}
            </div>

            {/* Row 1: three summary cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <StatCard title="Service reminder" icon={Wrench}>
                    <SplitCounts
                        leftLabel="Due"
                        leftValue={r.service?.due ?? 0}
                        rightLabel="Due soon (30d)"
                        rightValue={r.service?.dueSoon ?? 0}
                    />
                </StatCard>
                <StatCard title="Registration reminder" icon={Bell}>
                    <SplitCounts
                        leftLabel="Due"
                        leftValue={r.registration?.due ?? 0}
                        rightLabel="Due soon (30d)"
                        rightValue={r.registration?.dueSoon ?? 0}
                    />
                </StatCard>
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
            </div>

            {/* Service cost over time */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Service cost (by month)</h3>
                <div className="h-[280px] w-full">
                    {serviceCostMonthData.length === 0 ? (
                        <p className="text-sm text-slate-400 py-12 text-center">No service spend recorded yet.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={serviceCostMonthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                <RechartsTooltip formatter={(v) => [`AED ${Number(v).toLocaleString()}`, 'Total']} />
                                <Bar dataKey="total" fill="#0d9488" radius={[6, 6, 0, 0]} name="Service cost" />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Requests row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard title="Service / asset requests" icon={ClipboardList}>
                    <SplitCounts
                        leftLabel="Pending"
                        leftValue={sr.pending ?? 0}
                        rightLabel="Approved"
                        rightValue={sr.confirmed ?? 0}
                    />
                    <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                        Pending / approved counts from dashboard notifications linked to vehicle assets.
                    </p>
                </StatCard>
                <StatCard title="Handover (assignment)" icon={ClipboardList}>
                    <SplitCounts
                        leftLabel="Pending accept"
                        leftValue={hr.pending ?? 0}
                        rightLabel="Accepted"
                        rightValue={hr.confirmed ?? 0}
                    />
                    <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                        Vehicles assigned to an employee awaiting acceptance vs accepted.
                    </p>
                </StatCard>
            </div>

            {/* Per-vehicle bars + pie */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
                        Service cost by vehicle (top spenders)
                    </h3>
                    <div className="h-[320px] w-full">
                        {serviceCostByVehicle.length === 0 ? (
                            <p className="text-sm text-slate-400 py-12 text-center">No per-vehicle service costs yet.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={serviceCostByVehicle} layout="vertical" margin={{ left: 8, right: 16 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal />
                                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                    <RechartsTooltip formatter={(v) => [`AED ${Number(v).toLocaleString()}`, 'Total']} />
                                    <Bar dataKey="total" fill="#0891b2" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Vehicle model year</h3>
                    <div className="h-[320px] w-full">
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
                                        outerRadius={100}
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        {pieData.map((_, i) => (
                                            <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Legend />
                                    <RechartsTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-2">Vehicle value by asset</h3>
                <p className="text-xs text-slate-400 mb-4">Total recorded asset value (top by value).</p>
                <div className="h-[300px] w-full">
                    {vehicleValueBars.length === 0 ? (
                        <p className="text-sm text-slate-400 py-12 text-center">No asset values set.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={vehicleValueBars} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-25} textAnchor="end" height={60} />
                                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                <RechartsTooltip formatter={(v) => [`AED ${Number(v).toLocaleString()}`, 'Value']} />
                                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Usage + Idle */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-1">Vehicle usage (service events)</h3>
                    <PeriodTabs value={usagePeriod} onChange={setUsagePeriod} />
                    <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={usageChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" allowDecimals={false} />
                                <RechartsTooltip />
                                <Bar dataKey="count" fill="#14b8a6" radius={[6, 6, 0, 0]} name="Service records" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-1">Vehicle idle (no service in period)</h3>
                    <PeriodTabs value={idlePeriod} onChange={setIdlePeriod} />
                    <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={idleChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" allowDecimals={false} />
                                <RechartsTooltip />
                                <Bar dataKey="vehicles" fill="#94a3b8" radius={[6, 6, 0, 0]} name="Vehicles" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
