'use client';

import { useMemo, useState } from 'react';
import RechartsBox from '@/components/charts/RechartsBox';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    LabelList,
    Line,
    LineChart,
    Pie,
    PieChart,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    ChevronDown,
    Globe,
    Loader2,
    Phone,
    Zap,
} from 'lucide-react';
import { getToolsAssetTotalValue } from '@/app/HRM/Asset/utils/getToolsAssetTotalValue';
import {
    countDisplayableAssetPendingInbox,
    dedupeAssetPendingInboxItems,
} from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { isPendingInboxRowVisible } from '@/app/HRM/Asset/utils/assetRequestLabels';
import { filterToolsAssetInboxRows } from '@/utils/assetInboxScope';
import { formatAed, isUnpaidUtilityBill } from '@/app/HRM/Asset/UtilityBills/utils/utilityBillStats';
import {
    MONTH_OPTIONS,
    buildMonthWiseAmountQty,
    typeChartKey,
} from '@/app/HRM/Asset/UtilityBills/utils/utilityOverviewStats';
import { utilityTypeIcon } from '@/app/HRM/Asset/UtilityBills/utils/utilityTypeVisuals';
import { isVehicleAccessFineVisible } from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';
import './AssetManagementDashboard.css';

const AXIS_TICK = { fontSize: 9, fill: '#697386', fontWeight: 400 };
const VALUE_LABEL = { fontSize: 11, fill: '#28303d', fontWeight: 600 };
const GRID_STROKE = '#E9EDF2';
const TOOL_COLORS = ['#12A99D', '#FF5050', '#F59E0B', '#8B5CF6', '#0877F9', '#10B3A3', '#FF9900'];
const ASSIGN_COLORS = { assigned: '#12A99D', unassigned: '#F59E0B' };
const APPROVAL_BAR = '#8EB8F5';
const UTILITY_COLORS = ['#12A99D', '#0877F9', '#F59E0B', '#8B5CF6', '#10B3A3', '#6366F1'];
const CHART_TOP_N = 4;

const tooltipStyle = {
    borderRadius: '7px',
    border: '1px solid #DFE5EA',
    background: '#ffffff',
    boxShadow: '0 4px 12px rgba(16, 24, 40, 0.08)',
    fontSize: '11px',
    color: '#36465D',
};

const TOOL_APPROVAL_GROUPS = [
    { label: 'Disposal', types: ['Asset End of Life'] },
    { label: 'Service Request', types: ['Asset Overdue'] },
    { label: 'Employee Asset Request', types: ['Employee Asset Request'] },
];

function SimCardIcon({ size = 20, strokeWidth = 1.85, ...props }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
            <path d="M14 3v4h4" />
            <rect x="8" y="11" width="8" height="6" rx="0.8" />
            <path d="M8 13.5h8M8 15h8" />
        </svg>
    );
}

function pendingBillIcon(name) {
    const n = String(name || '').toLowerCase();
    if (/internet|wifi|broadband|fiber/.test(n)) return Globe;
    if (/electric|power|volt/.test(n)) return Zap;
    if (/telephon|landline|phone/.test(n)) return Phone;
    if (/sim\s*card|simcard|\bsim\b/.test(n)) return SimCardIcon;
    return utilityTypeIcon(name);
}

function formatCompactAed(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1_000_000) {
        return `AED ${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
    }
    if (Math.abs(n) >= 10_000) {
        return `AED ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
    }
    return formatAed(n);
}

function formatAxisAed(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}K`;
    return String(Math.round(n));
}

function formatCount(value) {
    return (Number(value) || 0).toLocaleString('en-US');
}

function vehiclePlate(v) {
    const number = String(v?.plateNumber || '').trim();
    const emirate = String(v?.plateEmirate || '').trim();
    if (number && emirate) return `${emirate} ${number}`;
    if (number) return number;
    return String(v?.label || v?.assetId || '').trim() || '—';
}

function vehicleChartLabel(v) {
    const id = String(v?.assetId || '').trim();
    if (id) return shortLabel(id, 8);
    return shortLabel(vehiclePlate(v), 8);
}

function shortLabel(value, max = 10) {
    const text = String(value || '—').trim() || '—';
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function inYear(dateLike, year) {
    if (!year) return true;
    if (!dateLike) return false;
    const d = new Date(dateLike);
    return Number.isFinite(d.getTime()) && d.getFullYear() === Number(year);
}

function billInYear(billMonth, year) {
    return String(billMonth || '').startsWith(String(year));
}

function isLiveToolsRow(row) {
    if (!String(row?.assetId || '').startsWith('VEGA-ASSET-')) return false;
    const status = String(row?.status || '').trim().toLowerCase().replace(/\s+/g, '');
    if (['lost', 'rejected', 'endoflife'].includes(status)) return false;
    const typeLower = String(row?.type || '').toLowerCase();
    const catLower = String(row?.category || '').toLowerCase();
    if (typeLower.includes('vehicle') || typeLower.includes('fleet') || typeLower.includes('truck')) return false;
    if (catLower.includes('vehicle') || catLower.includes('fleet')) return false;
    if (String(row?.plateNumber || '').trim()) return false;
    return true;
}

function topRows(map, limit = CHART_TOP_N) {
    return [...map.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
}

function renderDonutPct({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
    if (!percent || percent < 0.08) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.52;
    const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
    const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);
    return (
        <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
            {`${Math.round(percent * 100)}%`}
        </text>
    );
}

function ChartValueTooltip({ active, payload, label, valueLabel }) {
    if (!active || !payload?.length) return null;
    const item = payload.find((row) => row?.value != null) || payload[0];
    const title = item?.payload?.fullName || item?.payload?.name || label || '';
    return (
        <div style={{ ...tooltipStyle, padding: '7px 9px' }}>
            <div style={{ fontWeight: 600, marginBottom: 2, color: '#181D27' }}>{title}</div>
            <div>{valueLabel ? `${valueLabel}: ${formatAed(item?.value)}` : formatAed(item?.value)}</div>
        </div>
    );
}

function DashCard({ title, extra, children }) {
    return (
        <div className="tad-card">
            <div className="tad-card-head">
                <h3 className="tad-card-title">{title}</h3>
                {extra || null}
            </div>
            {children}
        </div>
    );
}

function EmptyChart({ message = 'No data for this view.' }) {
    return <div className="tad-empty">{message}</div>;
}

export default function AssetManagementDashboard({
    fleet,
    tools = [],
    utilityTypes = [],
    utilityEntries = [],
    utilityBills = [],
    inbox = [],
    loading,
    error,
    periodYear,
    periodYears = [],
    onPeriodYearChange,
    onOpenInbox,
}) {
    const [finesTab, setFinesTab] = useState('vehicle');
    const [customerId, setCustomerId] = useState('all');
    const [usageMonth, setUsageMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
    const selectedYear = Number(periodYear) || new Date().getFullYear();

    const customers = useMemo(
        () => (Array.isArray(fleet?.customers) ? fleet.customers : []),
        [fleet?.customers],
    );

    const vehiclesAll = useMemo(
        () => (Array.isArray(fleet?.vehicles) ? fleet.vehicles : []),
        [fleet?.vehicles],
    );

    const vehicles = useMemo(() => {
        if (customerId === 'all') return vehiclesAll;
        return vehiclesAll.filter((v) => String(v.customerId || '') === String(customerId));
    }, [vehiclesAll, customerId]);

    const vehicleIdSet = useMemo(() => new Set(vehicles.map((v) => String(v._id))), [vehicles]);

    const toolsRows = useMemo(
        () => (Array.isArray(tools) ? tools : []).filter(isLiveToolsRow),
        [tools],
    );

    const yearBills = useMemo(
        () => (Array.isArray(utilityBills) ? utilityBills : []).filter((bill) => billInYear(bill?.billMonth, selectedYear)),
        [utilityBills, selectedYear],
    );

    const visibleInbox = useMemo(
        () => dedupeAssetPendingInboxItems(inbox).filter(isPendingInboxRowVisible),
        [inbox],
    );

    const toolsInbox = useMemo(
        () => filterToolsAssetInboxRows(visibleInbox),
        [visibleInbox],
    );

    const vehicleValueTotal = useMemo(
        () => vehicles.reduce((sum, v) => sum + (Number(v.assetValue) || 0), 0),
        [vehicles],
    );
    const toolsValueTotal = useMemo(
        () => toolsRows.reduce((sum, row) => sum + (Number(getToolsAssetTotalValue(row)) || 0), 0),
        [toolsRows],
    );

    const assignedVehicles = vehicles.filter((v) => String(v.status || '').toLowerCase() === 'assigned').length;
    const unassignedVehicles = vehicles.filter((v) => String(v.status || '').toLowerCase() !== 'assigned').length;
    const assignedTools = toolsRows.filter((row) => String(row.status || '').toLowerCase() === 'assigned').length;
    const unassignedTools = toolsRows.length - assignedTools;

    const kpi = {
        totalAssets: vehicles.length + toolsRows.length,
        assigned: assignedVehicles + assignedTools,
        unassigned: unassignedVehicles + unassignedTools,
        pending: countDisplayableAssetPendingInbox(inbox),
        value: vehicleValueTotal + toolsValueTotal,
    };

    const vehicleValueChart = useMemo(
        () =>
            [...vehicles]
                .map((v) => ({
                    name: vehiclePlate(v),
                    chartName: vehicleChartLabel(v),
                    value: Number(v.assetValue) || 0,
                }))
                .filter((row) => row.value > 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, CHART_TOP_N),
        [vehicles],
    );

    const finesFlat = useMemo(() => {
        const rows = [];
        for (const group of fleet?.finesByVehicle || []) {
            if (customerId !== 'all') {
                const matchesCustomer = String(group.customerId || '') === String(customerId);
                const matchesVehicle = group.vehicleId && vehicleIdSet.has(String(group.vehicleId));
                if (!matchesCustomer && !matchesVehicle) continue;
            }
            for (const fine of group.fines || []) {
                if (!isVehicleAccessFineVisible(fine)) continue;
                if (!inYear(fine.awardedDate, selectedYear)) continue;
                rows.push({
                    ...fine,
                    amount: Number(fine.amount || fine.totalFineAmount || fine.fineAmount || 0) || 0,
                    plate: fine.plate || group.plate || group.label || '—',
                    assetId: group.assetId || fine.assetId || '',
                    offender: fine.offender || '—',
                });
            }
        }
        return rows;
    }, [fleet?.finesByVehicle, selectedYear, customerId, vehicleIdSet]);

    const finesTotal = useMemo(
        () => finesFlat.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
        [finesFlat],
    );

    const finesChart = useMemo(() => {
        const map = new Map();
        for (const fine of finesFlat) {
            const key =
                finesTab === 'person'
                    ? String(fine.offender || 'Unknown').trim() || 'Unknown'
                    : shortLabel(fine.assetId || fine.plate || '—', 8);
            map.set(key, (map.get(key) || 0) + (Number(fine.amount) || 0));
        }
        return topRows(map, CHART_TOP_N).map((row) => ({ ...row, chartName: shortLabel(row.name, 8) }));
    }, [finesFlat, finesTab]);

    const serviceTotal = useMemo(
        () =>
            vehicles.reduce((sum, v) => {
                const events = Array.isArray(v.serviceCosts) ? v.serviceCosts : [];
                return (
                    sum +
                    events.reduce((inner, s) => {
                        if (!inYear(s.date, selectedYear)) return inner;
                        return inner + (Number(s.value) || 0);
                    }, 0)
                );
            }, 0),
        [vehicles, selectedYear],
    );

    const serviceChart = useMemo(
        () =>
            [...vehicles]
                .map((v) => {
                    const events = Array.isArray(v.serviceCosts) ? v.serviceCosts : [];
                    const value = events.reduce((sum, s) => {
                        if (!inYear(s.date, selectedYear)) return sum;
                        return sum + (Number(s.value) || 0);
                    }, 0);
                    return {
                        name: vehiclePlate(v),
                        chartName: vehicleChartLabel(v),
                        value,
                    };
                })
                .filter((row) => row.value > 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, CHART_TOP_N),
        [vehicles, selectedYear],
    );

    const fuelRows = useMemo(
        () =>
            (fleet?.costBreakdown?.fuel || []).filter((row) => {
                if (!String(row.monthKey || '').startsWith(String(selectedYear))) return false;
                if (customerId === 'all') return true;
                return vehicleIdSet.has(String(row.vehicleId || ''));
            }),
        [fleet?.costBreakdown?.fuel, selectedYear, customerId, vehicleIdSet],
    );

    const fuelTotal = useMemo(
        () => fuelRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
        [fuelRows],
    );

    const fuelChart = useMemo(() => {
        const byVehicle = new Map();
        for (const row of fuelRows) {
            const vehicle = vehicles.find((v) => String(v._id) === String(row.vehicleId));
            const key = vehicle ? vehicleChartLabel(vehicle) : String(row.vehicleId || '—');
            const prev = byVehicle.get(key) || { usage: 0, cost: 0 };
            const amount = Number(row.amount) || 0;
            byVehicle.set(key, { usage: prev.usage + amount, cost: prev.cost + amount });
        }
        return [...byVehicle.entries()]
            .map(([name, values]) => ({ name, chartName: shortLabel(name, 8), ...values }))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, CHART_TOP_N);
    }, [fuelRows, vehicles]);

    const toolsByType = useMemo(() => {
        const map = new Map();
        for (const row of toolsRows) {
            const name = String(row.type || row.category || 'Other').trim() || 'Other';
            if (!map.has(name)) map.set(name, { name, count: 0, value: 0 });
            const entry = map.get(name);
            entry.count += 1;
            entry.value += Number(getToolsAssetTotalValue(row)) || 0;
        }
        return [...map.values()].sort((a, b) => b.count - a.count);
    }, [toolsRows]);

    const toolsDonut = toolsByType.map((row) => ({ name: row.name, value: row.count }));
    const toolsTotalCount = toolsRows.length;
    const assignedDonut = [
        { name: 'Assigned', value: kpi.assigned, color: ASSIGN_COLORS.assigned },
        { name: 'Unassigned', value: kpi.unassigned, color: ASSIGN_COLORS.unassigned },
    ];
    const assignedTotal = kpi.totalAssets;
    const assignedPct = assignedTotal ? Math.round((kpi.assigned / assignedTotal) * 100) : 0;
    const unassignedPct = assignedTotal ? Math.max(0, 100 - assignedPct) : 0;

    const approvalBars = useMemo(
        () =>
            TOOL_APPROVAL_GROUPS.map((group) => ({
                name: group.label,
                value: toolsInbox.filter((row) =>
                    group.types.includes(String(row.requestType || row.type || '').trim()),
                ).length,
            })),
        [toolsInbox],
    );

    const typeNames = useMemo(() => {
        const fromTabs = (utilityTypes || []).map((name) => String(name || '').trim()).filter(Boolean);
        if (fromTabs.length) return fromTabs;
        const set = new Set();
        for (const entry of utilityEntries || []) {
            if (entry?.type) set.add(String(entry.type).trim());
        }
        for (const bill of yearBills) {
            if (bill?.utilityType) set.add(String(bill.utilityType).trim());
        }
        return [...set];
    }, [utilityTypes, utilityEntries, yearBills]);

    const monthlyUtility = useMemo(
        () => buildMonthWiseAmountQty({ bills: yearBills, typeNames, year: selectedYear }),
        [yearBills, typeNames, selectedYear],
    );

    const pendingByType = useMemo(() => {
        const unpaid = yearBills.filter(isUnpaidUtilityBill);
        return typeNames.map((name, index) => {
            const rows = unpaid.filter(
                (bill) => String(bill.utilityType || '').trim().toLowerCase() === name.toLowerCase(),
            );
            return {
                name,
                amount: rows.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0),
                count: rows.length,
                color: UTILITY_COLORS[index % UTILITY_COLORS.length],
            };
        }).filter((row) => row.amount > 0 || row.count > 0);
    }, [yearBills, typeNames]);

    const pendingTotal = pendingByType.reduce((sum, row) => sum + row.amount, 0);
    const pendingMax = Math.max(...pendingByType.map((row) => row.amount), 1);

    const usageChart = useMemo(() => {
        const monthKey = `${selectedYear}-${usageMonth}`;
        return typeNames.map((name, index) => {
            const bills = yearBills.filter(
                (bill) =>
                    String(bill.utilityType || '').trim().toLowerCase() === name.toLowerCase() &&
                    String(bill.billMonth || '') === monthKey,
            );
            const budget = bills.reduce((sum, bill) => sum + (Number(bill.monthlyRental) || 0), 0);
            const actual = bills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);
            return {
                name: shortLabel(name, 10),
                fullName: name,
                budget,
                overage: Math.max(0, actual - budget),
                fill: UTILITY_COLORS[index % UTILITY_COLORS.length],
            };
        });
    }, [yearBills, typeNames, selectedYear, usageMonth]);

    const selectedCustomer = customers.find((row) => String(row.id) === String(customerId));
    const customerLabel = customerId === 'all' ? 'All Customers' : selectedCustomer?.name || 'Customer';
    const usageMonthLabel = MONTH_OPTIONS.find((month) => month.value === usageMonth)?.label.slice(0, 3) || usageMonth;

    return (
        <div className="tad-dash">
            {loading && !fleet && !toolsRows.length ? (
                <div className="tad-loading">
                    <div className="tad-loading-chip">
                        <Loader2 size={16} className="animate-spin" style={{ color: '#0877F9' }} />
                        Loading asset dashboard…
                    </div>
                </div>
            ) : null}

            <div className="tad-header">
                    <div>
                        <h1 className="tad-title">Tool & Asset Dashboard</h1>
                        <p className="tad-subtitle">Asset, Vehicle & Utility Overview • Live Data</p>
                        {error ? <p className="tad-error">{error}</p> : null}
                    </div>
                    <div className="tad-filters">
                        <div className="tad-filter tad-filter-customer">
                            <span className="tad-filter-label">Customer: {customerLabel}</span>
                            <ChevronDown className="tad-filter-chevron" size={14} />
                            <select
                                value={customerId}
                                onChange={(e) => setCustomerId(e.target.value)}
                                aria-label="Customer"
                            >
                                <option value="all">All Customers</option>
                                {customers.map((row) => (
                                    <option key={row.id} value={row.id}>
                                        {row.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="tad-filter tad-filter-period">
                            <span className="tad-filter-label">Period: {selectedYear}</span>
                            <ChevronDown className="tad-filter-chevron" size={14} />
                            <select
                                value={String(periodYear)}
                                onChange={(e) => onPeriodYearChange?.(e.target.value)}
                                aria-label="Period"
                            >
                                {(periodYears.length ? periodYears : [selectedYear]).map((year) => (
                                    <option key={year} value={String(year)}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="tad-grid">
                    <div className="tad-row-1">
                        <DashCard title="Total Vehicle List & Value">
                            <div className="tad-metric-row">
                                <div>
                                    <span className="tad-metric-blue">{formatCount(vehicles.length)}</span>
                                    <span className="tad-metric-unit">Vehicles</span>
                                </div>
                                <span className="tad-metric-dark">{formatCompactAed(vehicleValueTotal)}</span>
                            </div>
                            <div className="tad-caption">Vehicle Value (AED)</div>
                            {!vehicleValueChart.length ? (
                                <EmptyChart message="No vehicle values in this view." />
                            ) : (
                                <div className="tad-plot">
                                    <RechartsBox fillParent minHeight={120} className="h-full">
                                        <BarChart data={vehicleValueChart} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                                            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                            <XAxis dataKey="chartName" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                                            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} tickFormatter={formatAxisAed} />
                                            <RechartsTooltip content={<ChartValueTooltip valueLabel="Value" />} />
                                            <Bar dataKey="value" fill="#0877F9" radius={[3, 3, 0, 0]} maxBarSize={30} />
                                        </BarChart>
                                    </RechartsBox>
                                </div>
                            )}
                        </DashCard>

                        <DashCard title="Total Vehicle Fines">
                            <div className="tad-metric-red">
                                <span className="tad-metric-prefix">AED</span>
                                {formatCount(Math.round(finesTotal))}
                            </div>
                            <div className="tad-tabs">
                                <button
                                    type="button"
                                    className={`tad-tab${finesTab === 'vehicle' ? ' active' : ''}`}
                                    onClick={() => setFinesTab('vehicle')}
                                >
                                    By Vehicle
                                </button>
                                <button
                                    type="button"
                                    className={`tad-tab${finesTab === 'person' ? ' active' : ''}`}
                                    onClick={() => setFinesTab('person')}
                                >
                                    By User
                                </button>
                            </div>
                            <div className="tad-caption">Fines (AED)</div>
                            {!finesChart.length ? (
                                <EmptyChart message="No fines in this period." />
                            ) : (
                                <div className="tad-plot">
                                    <RechartsBox fillParent minHeight={110} className="h-full">
                                        <BarChart data={finesChart} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                                            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                            <XAxis dataKey="chartName" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                                            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} tickFormatter={formatAxisAed} />
                                            <RechartsTooltip content={<ChartValueTooltip valueLabel="Fines" />} />
                                            <Bar dataKey="value" fill="#FF5050" radius={[3, 3, 0, 0]} maxBarSize={30} />
                                        </BarChart>
                                    </RechartsBox>
                                </div>
                            )}
                        </DashCard>

                        <DashCard title="Total Service Cost">
                            <div className="tad-metric-teal">
                                <span className="tad-metric-prefix">AED</span>
                                {formatCount(Math.round(serviceTotal))}
                            </div>
                            <div className="tad-caption">Service Cost by Vehicle (AED)</div>
                            {!serviceChart.length ? (
                                <EmptyChart message="No service cost in this period." />
                            ) : (
                                <div className="tad-plot">
                                    <RechartsBox fillParent minHeight={130} className="h-full">
                                        <ComposedChart data={serviceChart} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                                            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                            <XAxis dataKey="chartName" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                                            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} tickFormatter={formatAxisAed} />
                                            <RechartsTooltip content={<ChartValueTooltip valueLabel="Service" />} />
                                            <Bar dataKey="value" fill="#18B7A8" radius={[3, 3, 0, 0]} maxBarSize={28} />
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#159F98"
                                                strokeWidth={2}
                                                dot={{ r: 4, fill: '#159F98', stroke: '#159F98', strokeWidth: 0 }}
                                                legendType="none"
                                                tooltipType="none"
                                            />
                                        </ComposedChart>
                                    </RechartsBox>
                                </div>
                            )}
                        </DashCard>

                        <DashCard title="Total Fuel Usage">
                            <div className="tad-metric-row">
                                <div>
                                    <span className="tad-metric-fuel">{formatCount(Math.round(fuelTotal))}</span>
                                    <span className="tad-metric-fuel-unit">AED</span>
                                </div>
                                <span className="tad-metric-fuel-cost">
                                    <span className="tad-metric-fuel-cost-prefix">AED</span>
                                    {formatCount(Math.round(fuelTotal))}
                                </span>
                            </div>
                            <div className="tad-caption-row">
                                <span className="tad-caption" style={{ marginTop: 0 }}>Fuel Usage (AED)</span>
                                <span className="tad-legend">
                                    <span>
                                        <span className="tad-legend-swatch" style={{ background: '#0877F9' }} />
                                        Usage
                                    </span>
                                    <span>
                                        <span className="tad-legend-line" />
                                        Cost (AED)
                                    </span>
                                </span>
                            </div>
                            {!fuelChart.length ? (
                                <EmptyChart message="No fuel usage in this period." />
                            ) : (
                                <div className="tad-plot">
                                    <RechartsBox fillParent minHeight={120} className="h-full">
                                        <ComposedChart data={fuelChart} margin={{ top: 8, right: 28, left: 0, bottom: 0 }}>
                                            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                            <XAxis dataKey="chartName" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                                            <YAxis
                                                yAxisId="left"
                                                tick={AXIS_TICK}
                                                axisLine={false}
                                                tickLine={false}
                                                width={32}
                                                tickFormatter={formatAxisAed}
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                tick={AXIS_TICK}
                                                axisLine={false}
                                                tickLine={false}
                                                width={32}
                                                tickFormatter={formatAxisAed}
                                            />
                                            <RechartsTooltip
                                                formatter={(v, name) => [formatAed(v), name]}
                                                contentStyle={tooltipStyle}
                                            />
                                            <Bar yAxisId="left" dataKey="usage" name="Usage" fill="#0877F9" radius={[3, 3, 0, 0]} maxBarSize={28} />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                dataKey="cost"
                                                name="Cost (AED)"
                                                stroke="#0877F9"
                                                strokeWidth={2}
                                                dot={{ r: 4, fill: '#0877F9', stroke: '#0877F9', strokeWidth: 0 }}
                                            />
                                        </ComposedChart>
                                    </RechartsBox>
                                </div>
                            )}
                        </DashCard>
                    </div>

                    <div className="tad-row-2">
                        <DashCard title="Tool Assets by Type & Category">
                            {!toolsDonut.length ? (
                                <EmptyChart message="No tool assets in this view." />
                            ) : (
                                <div className="tad-tools">
                                    <div className="tad-tools-donut">
                                        <RechartsBox fillParent minHeight={150} className="h-full">
                                            <PieChart>
                                                <Pie
                                                    data={toolsDonut}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={46}
                                                    outerRadius={74}
                                                    paddingAngle={1.5}
                                                    stroke="#fff"
                                                    strokeWidth={2}
                                                    label={renderDonutPct}
                                                    labelLine={false}
                                                    isAnimationActive={false}
                                                >
                                                    {toolsDonut.map((row, i) => (
                                                        <Cell key={row.name} fill={TOOL_COLORS[i % TOOL_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip formatter={(v, name) => [v, name]} contentStyle={tooltipStyle} />
                                            </PieChart>
                                        </RechartsBox>
                                        <div className="tad-donut-center">
                                            <div className="tad-donut-kicker">Total</div>
                                            <div className="tad-donut-count">{formatCount(toolsTotalCount)}</div>
                                            <div className="tad-donut-sub">Assets</div>
                                            <div className="tad-donut-value">{formatCompactAed(toolsValueTotal)}</div>
                                        </div>
                                    </div>
                                    <div className="tad-cat-list">
                                        {toolsByType.slice(0, 5).map((row, i) => {
                                            const max = Math.max(...toolsByType.map((item) => item.count), 1);
                                            return (
                                                <div key={row.name} className="tad-cat-row">
                                                    <span className="tad-cat-dot" style={{ background: TOOL_COLORS[i % TOOL_COLORS.length] }} />
                                                    <span className="tad-cat-name" title={row.name}>{row.name}</span>
                                                    <span className="tad-cat-track">
                                                        <span
                                                            className="tad-cat-fill"
                                                            style={{
                                                                width: `${Math.max(8, (row.count / max) * 100)}%`,
                                                                background: TOOL_COLORS[i % TOOL_COLORS.length],
                                                            }}
                                                        />
                                                    </span>
                                                    <span className="tad-cat-qty">{row.count}</span>
                                                    <span className="tad-cat-val">{formatCompactAed(row.value)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </DashCard>

                        <DashCard title="Assigned vs Unassigned">
                            {!assignedTotal ? (
                                <EmptyChart message="No assignment data." />
                            ) : (
                                <div className="tad-assign">
                                    <div className="tad-assign-side tad-assign-teal">
                                        <div className="tad-assign-label">Assigned</div>
                                        <div className="tad-assign-count">{formatCount(kpi.assigned)}</div>
                                        <div className="tad-assign-pct">{assignedPct}%</div>
                                    </div>
                                    <div className="tad-assign-donut">
                                        <RechartsBox fillParent minHeight={140} className="h-full">
                                            <PieChart>
                                                <Pie
                                                    data={assignedDonut}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={42}
                                                    outerRadius={70}
                                                    paddingAngle={2}
                                                    stroke="#fff"
                                                    strokeWidth={3}
                                                    isAnimationActive={false}
                                                >
                                                    {assignedDonut.map((row) => (
                                                        <Cell key={row.name} fill={row.color} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip formatter={(v, name) => [v, name]} contentStyle={tooltipStyle} />
                                            </PieChart>
                                        </RechartsBox>
                                        <div className="tad-donut-center">
                                            <div className="tad-donut-count">{formatCount(assignedTotal)}</div>
                                            <div className="tad-donut-sub">Total Assets</div>
                                        </div>
                                    </div>
                                    <div className="tad-assign-side tad-assign-orange">
                                        <div className="tad-assign-label">Unassigned</div>
                                        <div className="tad-assign-count">{formatCount(kpi.unassigned)}</div>
                                        <div className="tad-assign-pct">{unassignedPct}%</div>
                                    </div>
                                </div>
                            )}
                        </DashCard>

                        <DashCard title="Waiting for Approval">
                            <div
                                className="tad-approve-metric"
                                onClick={onOpenInbox}
                                style={onOpenInbox ? { cursor: 'pointer' } : undefined}
                            >
                                <span className="tad-metric-red" style={{ marginTop: 0 }}>{formatCount(toolsInbox.length)}</span>
                                <span className="tad-metric-unit">Assets</span>
                            </div>
                            <div className="tad-approve-list">
                                {approvalBars.map((row) => {
                                    const max = Math.max(...approvalBars.map((item) => item.value), 1);
                                    return (
                                        <div key={row.name} className="tad-approve-row">
                                            <span className="tad-approve-label" title={row.name}>{row.name}</span>
                                            <span className="tad-approve-track">
                                                <span
                                                    className="tad-approve-fill"
                                                    style={{
                                                        width: `${row.value ? Math.max(12, (row.value / max) * 100) : 0}%`,
                                                        background: APPROVAL_BAR,
                                                    }}
                                                />
                                            </span>
                                            <span className="tad-approve-count">{row.value}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </DashCard>
                    </div>

                    <div className="tad-row-3">
                        <DashCard title="Utility Payments — Monthly">
                            <div className="tad-caption-row">
                                <span className="tad-caption" style={{ marginTop: 0 }}>AED</span>
                                {monthlyUtility.types.length ? (
                                    <div className="tad-util-legend">
                                        {monthlyUtility.types.map((type, index) => (
                                            <span key={type} className="tad-util-legend-item">
                                                <i style={{ borderTopColor: UTILITY_COLORS[index % UTILITY_COLORS.length] }} />
                                                {type}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                            {!monthlyUtility.types.length ? (
                                <EmptyChart message="No utility payments in this period." />
                            ) : (
                                <div className="tad-plot">
                                    <RechartsBox fillParent minHeight={160} className="h-full">
                                        <LineChart data={monthlyUtility.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                            <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                                            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} tickFormatter={formatAxisAed} />
                                            <RechartsTooltip formatter={(v, name) => [formatAed(v), name]} contentStyle={tooltipStyle} />
                                            {monthlyUtility.types.map((type, index) => (
                                                <Line
                                                    key={type}
                                                    type="monotone"
                                                    dataKey={typeChartKey(type)}
                                                    name={type}
                                                    stroke={UTILITY_COLORS[index % UTILITY_COLORS.length]}
                                                    strokeWidth={2}
                                                    dot={{
                                                        r: 3.5,
                                                        fill: UTILITY_COLORS[index % UTILITY_COLORS.length],
                                                        stroke: UTILITY_COLORS[index % UTILITY_COLORS.length],
                                                        strokeWidth: 0,
                                                    }}
                                                />
                                            ))}
                                        </LineChart>
                                    </RechartsBox>
                                </div>
                            )}
                        </DashCard>

                        <DashCard title="Pending Utility Bills">
                            {!pendingByType.length ? (
                                <EmptyChart message="No pending utility bills." />
                            ) : (
                                <>
                                    <div className="tad-pending-list">
                                        {pendingByType.slice(0, 4).map((row) => {
                                            const Icon = pendingBillIcon(row.name);
                                            return (
                                                <div key={row.name} className="tad-pending-row">
                                                    <span className="tad-pending-icon" style={{ color: row.color }}>
                                                        <Icon size={20} strokeWidth={1.85} color={row.color} />
                                                    </span>
                                                    <span className="tad-pending-name">{row.name}</span>
                                                    <span className="tad-pending-track">
                                                        <span
                                                            className="tad-pending-fill"
                                                            style={{
                                                                width: `${Math.max(8, (row.amount / pendingMax) * 100)}%`,
                                                                background: row.color,
                                                            }}
                                                        />
                                                    </span>
                                                    <span className="tad-pending-amt">{formatAed(row.amount)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="tad-pending-total">
                                        <span className="tad-pending-total-label">Total</span>
                                        <span className="tad-pending-total-value">{formatAed(pendingTotal)}</span>
                                    </div>
                                </>
                            )}
                        </DashCard>

                        <DashCard
                            title="Additional Usage"
                            extra={
                                <div className="tad-month-filter">
                                    <span>Month: {usageMonthLabel} {selectedYear}</span>
                                    <ChevronDown className="tad-filter-chevron" size={13} />
                                    <select
                                        value={usageMonth}
                                        onChange={(e) => setUsageMonth(e.target.value)}
                                        aria-label="Usage month"
                                    >
                                        {MONTH_OPTIONS.map((month) => (
                                            <option key={month.value} value={month.value}>
                                                {month.label.slice(0, 3)} {selectedYear}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            }
                        >
                            <div className="tad-caption-row">
                                <span className="tad-caption" style={{ marginTop: 0 }}>Overage Amount (AED)</span>
                                <span className="tad-legend">
                                    <span>
                                        <span className="tad-legend-swatch" style={{ background: '#D0D5DD' }} />
                                        Budget
                                    </span>
                                    <span>
                                        <span className="tad-legend-swatch" style={{ background: '#FF5050' }} />
                                        Overage
                                    </span>
                                </span>
                            </div>
                            {!usageChart.some((row) => row.budget || row.overage) ? (
                                <EmptyChart message="No usage for this month." />
                            ) : (
                                <div className="tad-plot">
                                    <RechartsBox fillParent minHeight={150} className="h-full">
                                        <BarChart data={usageChart} margin={{ top: 18, right: 6, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                                            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                            <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                                            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} tickFormatter={formatAxisAed} />
                                            <RechartsTooltip
                                                formatter={(v, name) => [formatAed(v), name]}
                                                contentStyle={tooltipStyle}
                                            />
                                            <Bar dataKey="budget" name="Budget" fill="#D0D5DD" radius={[2, 2, 0, 0]} maxBarSize={18} />
                                            <Bar dataKey="overage" name="Overage" radius={[2, 2, 0, 0]} maxBarSize={18}>
                                                {usageChart.map((row) => (
                                                    <Cell key={row.fullName} fill={row.fill} />
                                                ))}
                                                <LabelList
                                                    dataKey="overage"
                                                    position="top"
                                                    style={VALUE_LABEL}
                                                    formatter={(v) => (Number(v) > 0 ? Number(v).toLocaleString('en-US') : '')}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </RechartsBox>
                                </div>
                            )}
                        </DashCard>
                    </div>
                </div>
        </div>
    );
}
