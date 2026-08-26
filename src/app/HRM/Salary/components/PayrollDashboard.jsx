'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import {
    CalendarDays,
    ChevronDown,
    Clock,
    Gift,
    HardHat,
    Loader2,
    MoreVertical,
    User,
    Wallet,
} from 'lucide-react';
import RechartsBox from '@/components/charts/RechartsBox';
import axiosInstance from '@/utils/axios';
import EmployeePayrollDashboard from './EmployeePayrollDashboard';
import {
    EMPTY_PAYROLL_SUMMARY,
    PAYROLL_COLORS,
    emptyMonthSeries,
    emptyOfficeVsSiteMonthly,
    formatK,
    niceAxis,
    withDeductionColors,
    withLeaveColors,
} from '../utils/payrollDashboardChartUtils';
import './PayrollDashboard.css';

const tooltipStyle = {
    background: '#fff',
    border: '1px solid #E4E7EC',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,.08)',
    padding: '8px 10px',
    fontSize: '12px',
    color: '#334155',
};

const AXIS_TICK = { fontSize: 10, fill: '#4D535D', fontWeight: 400 };
const VALUE_LABEL = { fontSize: 9, fill: '#111', fontWeight: 600 };
const CHART_MARGIN = { top: 16, right: 10, left: 0, bottom: 4 };
const PLOT_HEIGHT = 175;

const PENDING_BAR_COLORS = {
    'Leave Requests': '#FF4949',
    'Attendance Corrections': '#18B7A7',
    'Expense Claims': '#FFA20B',
    'Advance Requests': '#778292',
};

const EMPTY_PENDING_REQUESTS = {
    total: 0,
    categories: [
        { name: 'Leave Requests', count: 0 },
        { name: 'Attendance Corrections', count: 0 },
        { name: 'Expense Claims', count: 0 },
        { name: 'Advance Requests', count: 0 },
    ],
    priority: { high: 0, medium: 0, low: 0 },
};

function currentYear() {
    return new Date().getFullYear();
}

function splitAed(label) {
    const text = String(label || 'AED 0').trim();
    const idx = text.indexOf(' ');
    if (idx < 0) return { prefix: 'AED', value: text };
    return { prefix: text.slice(0, idx), value: text.slice(idx + 1) };
}

const BDAY_AVATAR_TONES = [
    { bg: '#EDE9FE', fg: '#6D28D9' },
    { bg: '#DBEAFE', fg: '#1D4ED8' },
    { bg: '#FCE7F3', fg: '#BE185D' },
    { bg: '#D1FAE5', fg: '#047857' },
    { bg: '#FFEDD5', fg: '#C2410C' },
    { bg: '#E0E7FF', fg: '#4338CA' },
];

function birthdayAvatarTone(row) {
    if (row?.avatarBg && row?.avatarFg) {
        return { bg: row.avatarBg, fg: row.avatarFg };
    }
    const seed = String(row?.employeeId || row?.name || '');
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return BDAY_AVATAR_TONES[hash % BDAY_AVATAR_TONES.length];
}

function ChartCard({ title, caption, children }) {
    return (
        <div className="pd-chart-card">
            <h3 className="pd-card-title">{title}</h3>
            <button type="button" className="pd-more" aria-label={`${title} options`}>
                <MoreVertical size={16} />
            </button>
            {caption ? <div className="pd-chart-caption">{caption}</div> : null}
            <div className="pd-chart-plot">{children}</div>
        </div>
    );
}

function SummaryCard({ title, value, icon: Icon, iconBg, iconColor }) {
    return (
        <div className="pd-kpi-card">
            <div className="pd-kpi-icon" style={{ backgroundColor: iconBg }}>
                <Icon size={25} style={{ color: iconColor }} strokeWidth={2} />
            </div>
            <div className="min-w-0">
                <p className="pd-kpi-label">{title}</p>
                <p className="pd-kpi-value">{value}</p>
            </div>
        </div>
    );
}

export default function PayrollDashboard() {
    const [year, setYear] = useState(currentYear);
    const [employeeId, setEmployeeId] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [payload, setPayload] = useState(null);
    const [employees, setEmployees] = useState([]);

    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;

        async function loadDashboard() {
            setLoading(true);
            setError(null);
            try {
                const res = await axiosInstance.get('/Employee/payroll-dashboard', {
                    params: {
                        year,
                        employeeId: employeeId || 'all',
                    },
                    skipToast: true,
                    signal: controller.signal,
                });
                if (!cancelled) {
                    setPayload(res.data || null);
                    if (Array.isArray(res.data?.employees)) setEmployees(res.data.employees);
                }
            } catch (err) {
                if (cancelled || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
                if (!cancelled) {
                    setError(err?.response?.data?.message || 'Failed to load payroll dashboard.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadDashboard();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [year, employeeId]);

    const years = payload?.years?.length ? payload.years : [year - 2, year - 1, year];
    const orgPayload = payload?.view === 'employee' ? null : payload;
    const summary = orgPayload?.summary || EMPTY_PAYROLL_SUMMARY;
    const monthWiseSalary = orgPayload?.monthWiseSalary || emptyMonthSeries('total');
    const officeVsSiteMonthly = orgPayload?.officeVsSiteMonthly || emptyOfficeVsSiteMonthly();
    const overtimeMonthly = orgPayload?.overtimeMonthly || emptyMonthSeries('ot');
    const salaryRatio = orgPayload?.salaryRatio || [
        { name: 'Office Staff', value: 0 },
        { name: 'Site Staff', value: 0 },
    ];
    const leaveByCategory = withLeaveColors(orgPayload?.leaveByCategory || [
        { name: 'Sick', value: 0 },
        { name: 'Authorized', value: 0 },
        { name: 'Unauthorized', value: 0 },
    ]);
    const deductionsByCategory = withDeductionColors(orgPayload?.deductionsByCategory || [
        { name: 'Loss of Pay', value: 0 },
        { name: 'Loan', value: 0 },
        { name: 'Advance', value: 0 },
        { name: 'Fine', value: 0 },
    ]);
    const upcomingBirthdays = orgPayload?.upcomingBirthdays || [];
    const upcomingLeave = orgPayload?.upcomingLeave || [];
    const pendingRequests = orgPayload?.pendingRequests || EMPTY_PENDING_REQUESTS;
    const pendingCategories = pendingRequests.categories?.length
        ? pendingRequests.categories
        : EMPTY_PENDING_REQUESTS.categories;
    const pendingMax = Math.max(1, ...pendingCategories.map((row) => Number(row.count) || 0));

    const monthAxis = useMemo(
        () => niceAxis(monthWiseSalary.map((row) => row.total), 3, 10),
        [monthWiseSalary],
    );
    const officeSiteAxis = useMemo(
        () => niceAxis(officeVsSiteMonthly.flatMap((row) => [row.office, row.site]), 4, 10),
        [officeVsSiteMonthly],
    );
    const leaveAxis = useMemo(
        () => niceAxis(leaveByCategory.map((row) => row.value), 4, 10),
        [leaveByCategory],
    );
    const overtimeAxis = useMemo(
        () => niceAxis(overtimeMonthly.map((row) => row.ot), 5, 5),
        [overtimeMonthly],
    );
    const deductionAxis = useMemo(
        () => niceAxis(deductionsByCategory.map((row) => row.value), 4, 10),
        [deductionsByCategory],
    );

    const pieHasData = salaryRatio.some((row) => Number(row.value) > 0);
    const pieData = pieHasData ? salaryRatio : [{ name: 'No data', value: 1, empty: true }];
    const payrollSplit = splitAed(summary.annualPayrollShort);
    const selectedEmployee = employees.find((emp) => emp.employeeId === employeeId);
    const employeeFilterLabel =
        employeeId === 'all'
            ? 'All Employees'
            : selectedEmployee
              ? selectedEmployee.name
              : employeeId;
    const subtitlePrefix = payload?.isSample ? 'Sample Data' : 'Live Data';

    return (
        <div className="payroll-dash">
            <main className="pd-main">
                {loading ? (
                    <div className="pd-loading">
                        <div className="pd-loading-chip">
                            <Loader2 size={16} className="animate-spin" style={{ color: '#0877EF' }} />
                            Loading payroll…
                        </div>
                    </div>
                ) : null}

                <div className="pd-header">
                    <div>
                        <h1 className="pd-title">
                            {employeeId !== 'all' ? 'Employee Payroll Dashboard' : 'Payroll Dashboard'}
                        </h1>
                        <p className="pd-subtitle">
                            {employeeId !== 'all'
                                ? `${payload?.employee?.name || employeeId} • Jan–Dec ${year}`
                                : `${subtitlePrefix} • Jan–Dec ${year}`}
                        </p>
                        {error ? <p className="pd-error">{error}</p> : null}
                    </div>
                    <div className="pd-filters">
                        <div className="pd-year-filter">
                            <span className="pd-year-label">Year</span>
                            <span className="pd-year-value">{year}</span>
                            <ChevronDown className="pd-filter-chevron" size={16} />
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                aria-label="Year"
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="pd-emp-filter">
                            <span className="pd-emp-value">{employeeFilterLabel}</span>
                            <ChevronDown className="pd-filter-chevron" size={16} />
                            <select
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                aria-label="Employee"
                            >
                                <option value="all">All Employees</option>
                                {employees.map((emp) => (
                                    <option key={emp.employeeId} value={emp.employeeId}>
                                        {emp.name} ({emp.employeeId})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {employeeId !== 'all' ? (
                    <EmployeePayrollDashboard data={payload?.view === 'employee' ? payload : null} />
                ) : (
                    <>
                        <div className="pd-kpi-grid">
                            <SummaryCard
                                title="Annual Payroll"
                                value={summary.annualPayroll}
                                icon={Wallet}
                                iconBg="#EAF2FF"
                                iconColor="#0878F9"
                            />
                            <SummaryCard
                                title="Office Staff"
                                value={summary.officeStaff}
                                icon={User}
                                iconBg="#E1F8F4"
                                iconColor="#11B6A5"
                            />
                            <SummaryCard
                                title="Site Staff"
                                value={summary.siteStaff}
                                icon={HardHat}
                                iconBg="#E7F0FF"
                                iconColor="#1877F2"
                            />
                            <SummaryCard
                                title="Overtime Paid"
                                value={summary.overtimePaid}
                                icon={Clock}
                                iconBg="#FFF2DF"
                                iconColor="#F5A000"
                            />
                        </div>

                        <div className="pd-chart-grid">
                            <ChartCard title="1) Month-wise Salary" caption="AED (K)">
                                <RechartsBox height={PLOT_HEIGHT} minHeight={PLOT_HEIGHT}>
                                    <BarChart data={monthWiseSalary} margin={CHART_MARGIN} barCategoryGap="28%">
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke={PAYROLL_COLORS.grid}
                                            strokeWidth={1}
                                            vertical={false}
                                        />
                                        <XAxis
                                            dataKey="month"
                                            tick={AXIS_TICK}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            domain={monthAxis.domain}
                                            ticks={monthAxis.ticks}
                                            tick={AXIS_TICK}
                                            axisLine={false}
                                            tickLine={false}
                                            width={32}
                                        />
                                        <RechartsTooltip
                                            contentStyle={tooltipStyle}
                                            formatter={(value) => [`AED ${formatK(value)}`, 'Salary']}
                                            cursor={{ fill: 'rgba(8, 119, 239, 0.08)' }}
                                        />
                                        <Bar
                                            dataKey="total"
                                            fill="#0877EF"
                                            radius={[2, 2, 0, 0]}
                                            maxBarSize={20}
                                        >
                                            <LabelList dataKey="total" position="top" formatter={formatK} style={VALUE_LABEL} />
                                        </Bar>
                                    </BarChart>
                                </RechartsBox>
                            </ChartCard>

                            <ChartCard title="2) Salary Ratio">
                                <div className="pd-ratio">
                                    <div className="pd-ratio-chart">
                                        <RechartsBox height={PLOT_HEIGHT} minHeight={PLOT_HEIGHT}>
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={56}
                                                    outerRadius={82}
                                                    startAngle={90}
                                                    endAngle={-270}
                                                    stroke="#fff"
                                                    strokeWidth={2}
                                                >
                                                    {pieData.map((row) => (
                                                        <Cell
                                                            key={row.name}
                                                            fill={
                                                                row.empty
                                                                    ? '#CBD5E1'
                                                                    : row.name === 'Office Staff'
                                                                      ? '#16B8A5'
                                                                      : '#0877EF'
                                                            }
                                                        />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip
                                                    contentStyle={tooltipStyle}
                                                    formatter={(value, name) => [`${pieHasData ? value : 0}%`, name]}
                                                />
                                            </PieChart>
                                        </RechartsBox>
                                        <div className="pd-ratio-center">
                                            <span className="pd-ratio-aed">{payrollSplit.prefix}</span>
                                            <span className="pd-ratio-val">{payrollSplit.value}</span>
                                        </div>
                                    </div>
                                    <div className="pd-ratio-legend">
                                        <div className="pd-legend-item">
                                            <span className="pd-legend-swatch" style={{ backgroundColor: '#16B8A5' }} />
                                            <span className="pd-legend-label">Office Staff</span>
                                            <span className="pd-legend-pct">{summary.officePct}%</span>
                                        </div>
                                        <div className="pd-legend-item">
                                            <span className="pd-legend-swatch" style={{ backgroundColor: '#0877EF' }} />
                                            <span className="pd-legend-label">Site Staff</span>
                                            <span className="pd-legend-pct">{summary.sitePct}%</span>
                                        </div>
                                    </div>
                                </div>
                            </ChartCard>

                            <ChartCard title="3) Office vs Site Salary — Monthly" caption="AED (K)">
                                <RechartsBox height={PLOT_HEIGHT} minHeight={PLOT_HEIGHT}>
                                    <BarChart
                                        data={officeVsSiteMonthly}
                                        margin={{ top: 22, right: 10, left: 0, bottom: 4 }}
                                        barGap={2}
                                        barCategoryGap="18%"
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke={PAYROLL_COLORS.grid}
                                            strokeWidth={1}
                                            vertical={false}
                                        />
                                        <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                                        <YAxis
                                            domain={officeSiteAxis.domain}
                                            ticks={officeSiteAxis.ticks}
                                            tick={AXIS_TICK}
                                            axisLine={false}
                                            tickLine={false}
                                            width={32}
                                        />
                                        <RechartsTooltip
                                            contentStyle={tooltipStyle}
                                            formatter={(value, name) => [`AED ${formatK(value)}`, name]}
                                            cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                                        />
                                        <Legend
                                            verticalAlign="top"
                                            align="right"
                                            iconType="square"
                                            iconSize={10}
                                            wrapperStyle={{ fontSize: 11, color: '#676C75', paddingBottom: 0 }}
                                        />
                                        <Bar
                                            dataKey="office"
                                            name="Office Staff"
                                            fill="#16B8A5"
                                            radius={[2, 2, 0, 0]}
                                            maxBarSize={14}
                                        >
                                            <LabelList dataKey="office" position="top" formatter={formatK} style={VALUE_LABEL} />
                                        </Bar>
                                        <Bar
                                            dataKey="site"
                                            name="Site Staff"
                                            fill="#0877EF"
                                            radius={[2, 2, 0, 0]}
                                            maxBarSize={14}
                                        >
                                            <LabelList dataKey="site" position="top" formatter={formatK} style={VALUE_LABEL} />
                                        </Bar>
                                    </BarChart>
                                </RechartsBox>
                            </ChartCard>

                            <ChartCard title="4) Total Leave by Category">
                                <RechartsBox height={PLOT_HEIGHT} minHeight={PLOT_HEIGHT}>
                                    <BarChart
                                        layout="vertical"
                                        data={leaveByCategory}
                                        margin={{ top: 8, right: 28, left: 4, bottom: 16 }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke={PAYROLL_COLORS.grid}
                                            strokeWidth={1}
                                            horizontal={false}
                                        />
                                        <XAxis
                                            type="number"
                                            domain={leaveAxis.domain}
                                            ticks={leaveAxis.ticks}
                                            tick={AXIS_TICK}
                                            axisLine={false}
                                            tickLine={false}
                                            label={{
                                                value: 'Number of Leaves',
                                                position: 'insideBottom',
                                                offset: -6,
                                                style: { fill: '#4D535D', fontSize: 10 },
                                            }}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            tick={{ fontSize: 10, fill: '#40454D' }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={78}
                                        />
                                        <RechartsTooltip
                                            contentStyle={tooltipStyle}
                                            formatter={(value) => [value, 'Leaves']}
                                            cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                                        />
                                        <Bar dataKey="value" radius={[0, 2, 2, 0]} barSize={25}>
                                            {leaveByCategory.map((row) => (
                                                <Cell key={row.name} fill={row.color} />
                                            ))}
                                            <LabelList dataKey="value" position="right" style={VALUE_LABEL} />
                                        </Bar>
                                    </BarChart>
                                </RechartsBox>
                            </ChartCard>

                            <ChartCard title="5) Overtime Paid — Monthly" caption="AED (K)">
                                <RechartsBox height={PLOT_HEIGHT} minHeight={PLOT_HEIGHT}>
                                    <AreaChart data={overtimeMonthly} margin={CHART_MARGIN}>
                                        <defs>
                                            <linearGradient id="overtimeFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#F5A000" stopOpacity={0.18} />
                                                <stop offset="100%" stopColor="#F5A000" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke={PAYROLL_COLORS.grid}
                                            strokeWidth={1}
                                            vertical={false}
                                        />
                                        <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                                        <YAxis
                                            domain={overtimeAxis.domain}
                                            ticks={overtimeAxis.ticks}
                                            tick={AXIS_TICK}
                                            axisLine={false}
                                            tickLine={false}
                                            width={32}
                                        />
                                        <RechartsTooltip
                                            contentStyle={tooltipStyle}
                                            formatter={(value) => [`AED ${formatK(value)}`, 'Overtime']}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="ot"
                                            stroke="#F5A000"
                                            strokeWidth={2}
                                            fill="url(#overtimeFill)"
                                            dot={{
                                                r: 4,
                                                fill: '#fff',
                                                stroke: '#F5A000',
                                                strokeWidth: 2,
                                            }}
                                            activeDot={{ r: 5, fill: '#fff', stroke: '#F5A000', strokeWidth: 2 }}
                                        >
                                            <LabelList dataKey="ot" position="top" formatter={formatK} style={VALUE_LABEL} />
                                        </Area>
                                    </AreaChart>
                                </RechartsBox>
                            </ChartCard>

                            <ChartCard title="6) Total Deductions by Category" caption="AED (K)">
                                <RechartsBox height={PLOT_HEIGHT} minHeight={PLOT_HEIGHT}>
                                    <BarChart
                                        data={deductionsByCategory}
                                        margin={CHART_MARGIN}
                                        barCategoryGap="28%"
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke={PAYROLL_COLORS.grid}
                                            strokeWidth={1}
                                            vertical={false}
                                        />
                                        <XAxis
                                            dataKey="name"
                                            tick={AXIS_TICK}
                                            axisLine={false}
                                            tickLine={false}
                                            interval={0}
                                        />
                                        <YAxis
                                            domain={deductionAxis.domain}
                                            ticks={deductionAxis.ticks}
                                            tick={AXIS_TICK}
                                            axisLine={false}
                                            tickLine={false}
                                            width={32}
                                        />
                                        <RechartsTooltip
                                            contentStyle={tooltipStyle}
                                            formatter={(value) => [`AED ${formatK(value)}`, 'Deduction']}
                                            cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                                        />
                                        <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={50}>
                                            {deductionsByCategory.map((row) => (
                                                <Cell key={row.name} fill={row.color} />
                                            ))}
                                            <LabelList dataKey="value" position="top" formatter={formatK} style={VALUE_LABEL} />
                                        </Bar>
                                    </BarChart>
                                </RechartsBox>
                            </ChartCard>
                        </div>

                        <div className="pd-chart-grid">
                            <div className="pd-bottom-card">
                                <div className="pd-bottom-head">
                                    <div className="pd-bottom-head-left">
                                        <div className="pd-head-icon" style={{ backgroundColor: '#F3E8FF' }}>
                                            <Gift size={16} color="#7C3AED" strokeWidth={2} />
                                        </div>
                                        <h3 className="pd-card-title" style={{ paddingRight: 0 }}>
                                            7) Upcoming Birthdays
                                        </h3>
                                    </div>
                                </div>
                                {upcomingBirthdays.length ? (
                                    <ul className="pd-list">
                                        {upcomingBirthdays.map((row) => {
                                            const tone = birthdayAvatarTone(row);
                                            return (
                                                <li key={`${row.employeeId}-${row.date}`} className="pd-bday-row">
                                                    <div
                                                        className="pd-avatar"
                                                        style={{
                                                            backgroundColor: tone.bg,
                                                            color: tone.fg,
                                                        }}
                                                    >
                                                        {row.initials || '—'}
                                                    </div>
                                                    <div className="pd-bday-copy">
                                                        <span className="pd-bday-name">{row.name}</span>
                                                        <span className="pd-bday-dept">{row.department}</span>
                                                    </div>
                                                    <span className="pd-bday-date">{row.date}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className="pd-empty">No upcoming birthdays.</p>
                                )}
                                <Link href="/emp" className="pd-card-cta">
                                    View All Birthdays →
                                </Link>
                            </div>

                            <div className="pd-bottom-card">
                                <div className="pd-bottom-head">
                                    <div className="pd-bottom-head-left">
                                        <div className="pd-head-icon" style={{ backgroundColor: '#E6F8F4' }}>
                                            <CalendarDays size={16} color="#16B8A5" strokeWidth={2} />
                                        </div>
                                        <h3 className="pd-card-title" style={{ paddingRight: 0 }}>
                                            8) Upcoming Leave
                                        </h3>
                                    </div>
                                    <span className="pd-badge pd-badge-teal">Next 30 Days</span>
                                </div>
                                {upcomingLeave.length ? (
                                    <ul className="pd-list">
                                        {upcomingLeave.map((row, index) => (
                                            <li
                                                key={`${row.employeeId}-${row.dates}-${index}`}
                                                className="pd-leave-row"
                                            >
                                                <span className="pd-leave-name">{row.name}</span>
                                                <span className="pd-leave-type">{row.leaveType}</span>
                                                <span className="pd-leave-date">{row.dates}</span>
                                                <span
                                                    className={`pd-status ${
                                                        row.status === 'Approved'
                                                            ? 'pd-status-approved'
                                                            : 'pd-status-scheduled'
                                                    }`}
                                                >
                                                    {row.status}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="pd-empty">No leave in the next 30 days.</p>
                                )}
                                <Link href="/HRM/Leave" className="pd-card-cta">
                                    View Leave Calendar →
                                </Link>
                            </div>

                            <div className="pd-bottom-card">
                                <div className="pd-bottom-head">
                                    <h3 className="pd-card-title" style={{ paddingRight: 0 }}>
                                        9) Pending User Requests
                                    </h3>
                                    <span className="pd-badge pd-badge-orange">
                                        {pendingRequests.total || 0} Pending
                                    </span>
                                </div>
                                <ul className="pd-list">
                                    {pendingCategories.map((row) => {
                                        const count = Number(row.count) || 0;
                                        const width = `${Math.max(count > 0 ? 8 : 0, (count / pendingMax) * 100)}%`;
                                        return (
                                            <li key={row.name} className="pd-pending-row">
                                                <span className="pd-pending-label">{row.name}</span>
                                                <div className="pd-pending-track">
                                                    <div
                                                        className="pd-pending-fill"
                                                        style={{
                                                            width,
                                                            backgroundColor:
                                                                PENDING_BAR_COLORS[row.name] || PAYROLL_COLORS.slate,
                                                        }}
                                                    />
                                                </div>
                                                <span className="pd-pending-count">{count}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <div className="pd-priority">
                                    <span className="pd-pill pd-pill-high">
                                        {pendingRequests.priority?.high || 0} High
                                    </span>
                                    <span className="pd-pill pd-pill-medium">
                                        {pendingRequests.priority?.medium || 0} Medium
                                    </span>
                                    <span className="pd-pill pd-pill-low">
                                        {pendingRequests.priority?.low || 0} Low
                                    </span>
                                </div>
                                <Link href="/dashboard" className="pd-review-btn">
                                    Review Requests →
                                </Link>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
