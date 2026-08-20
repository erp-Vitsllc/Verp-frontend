'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Banknote, Clock, HardHat, Loader2, MoreVertical, Settings, User, Wallet } from 'lucide-react';
import RechartsBox from '@/components/charts/RechartsBox';
import axiosInstance from '@/utils/axios';
import EmployeePayrollDashboard from './EmployeePayrollDashboard';
import PayrollSettingsPanel from './PayrollSettingsPanel';
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

const tooltipStyle = {
    borderRadius: '10px',
    border: '1px solid #E8EDF3',
    background: '#ffffff',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
    fontSize: '12px',
    color: '#334155',
};

const chartCardClass =
    'bg-white rounded-2xl border border-[#EEF0F4] shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 flex flex-col min-h-[340px]';

const headerIconBtnClass =
    'inline-flex items-center justify-center w-10 h-10 rounded-xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:scale-105 active:scale-95';

function ChartCard({ title, children }) {
    return (
        <div className={chartCardClass}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-[15px] font-bold text-[#1E293B] leading-snug">{title}</h3>
                <button
                    type="button"
                    className="p-1 rounded-md text-[#94A3B8] hover:bg-slate-50 hover:text-slate-600 shrink-0"
                    aria-label={`${title} options`}
                >
                    <MoreVertical size={16} />
                </button>
            </div>
            <div className="flex-1 min-h-0 min-w-0">{children}</div>
        </div>
    );
}

function SummaryCard({ title, value, icon: Icon, iconBg, iconColor }) {
    return (
        <div className="bg-white rounded-2xl border border-[#EEF0F4] shadow-[0_1px_3px_rgba(15,23,42,0.04)] px-5 py-4 flex items-center gap-4">
            <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: iconBg }}
            >
                <Icon size={22} style={{ color: iconColor }} strokeWidth={2} />
            </div>
            <div className="min-w-0">
                <p className="text-[13px] text-[#64748B] font-medium">{title}</p>
                <p className="text-[22px] leading-tight font-bold text-[#0F172A] tabular-nums mt-0.5">{value}</p>
            </div>
        </div>
    );
}

function currentYear() {
    return new Date().getFullYear();
}

export default function PayrollDashboard() {
    const [year, setYear] = useState(currentYear);
    const [employeeId, setEmployeeId] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [payload, setPayload] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [settingsOpen, setSettingsOpen] = useState(false);

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

    return (
        <div className="w-full max-w-[1600px] mx-auto relative">
            {loading ? (
                <div className="absolute inset-0 z-10 bg-[#F5F7FB]/60 rounded-2xl flex items-start justify-center pt-40">
                    <div className="flex items-center gap-2 bg-white border border-[#EEF0F4] rounded-full px-4 py-2 shadow-sm">
                        <Loader2 size={16} className="animate-spin text-[#1D5FDB]" />
                        <span className="text-sm font-medium text-[#475569]">Loading payroll…</span>
                    </div>
                </div>
            ) : null}

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-[28px] md:text-[32px] font-bold text-[#0F172A] tracking-tight">
                        {employeeId !== 'all' ? 'Employee Payroll Dashboard' : 'Payroll Dashboard'}
                    </h1>
                    <p className="text-sm text-[#94A3B8] mt-1">
                        {employeeId !== 'all'
                            ? `${payload?.employee?.name || employeeId} • Jan–${year === currentYear() ? new Date().toLocaleString('en-US', { month: 'short' }) : 'Dec'} ${year}`
                            : `Jan–${year === currentYear() ? new Date().toLocaleString('en-US', { month: 'short' }) : 'Dec'} ${year} • All employees`}
                    </p>
                    {error ? <p className="text-sm text-red-500 mt-1">{error}</p> : null}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex items-center gap-2 pb-[1px]">
                        <button
                            type="button"
                            onClick={() => setSettingsOpen(true)}
                            className={`${headerIconBtnClass} ${
                                settingsOpen
                                    ? 'border-[#1D5FDB]/30 text-[#1D5FDB] bg-[#E8F1FE]'
                                    : 'border-[#E8EDF3] text-[#64748B] hover:text-[#1E293B] hover:bg-slate-50'
                            }`}
                            title="Payroll settings"
                            aria-label="Payroll settings"
                        >
                            <Settings size={20} />
                        </button>
                        <button
                            type="button"
                            className={`${headerIconBtnClass} border-[#1D5FDB]/30 text-[#1D5FDB] bg-[#E8F1FE] hover:bg-[#dbeafe]`}
                            title="Payroll"
                            aria-label="Payroll"
                        >
                            <Banknote size={20} />
                        </button>
                    </div>
                    <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium text-[#94A3B8]">Year</span>
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="h-10 min-w-[108px] rounded-xl border border-[#E8EDF3] bg-white px-3 text-sm font-semibold text-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none focus:ring-2 focus:ring-[#4C8EF5]/20"
                        >
                            {years.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium text-[#94A3B8]">Employee</span>
                        <select
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            className="h-10 min-w-[168px] max-w-[260px] rounded-xl border border-[#E8EDF3] bg-white px-3 text-sm font-semibold text-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none focus:ring-2 focus:ring-[#4C8EF5]/20"
                        >
                            <option value="all">All Employees</option>
                            {employees.map((emp) => (
                                <option key={emp.employeeId} value={emp.employeeId}>
                                    {emp.name} ({emp.employeeId})
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            {employeeId !== 'all' ? (
                <EmployeePayrollDashboard data={payload?.view === 'employee' ? payload : null} />
            ) : (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                <SummaryCard
                    title={year === currentYear() ? 'YTD Payroll' : 'Annual Payroll'}
                    value={summary.annualPayroll}
                    icon={Wallet}
                    iconBg="#E8F1FE"
                    iconColor={PAYROLL_COLORS.blue}
                />
                <SummaryCard
                    title="Office Staff (Salary)"
                    value={summary.officeStaff}
                    icon={User}
                    iconBg="#E6F9F6"
                    iconColor={PAYROLL_COLORS.teal}
                />
                <SummaryCard
                    title="Site Staff (Salary)"
                    value={summary.siteStaff}
                    icon={HardHat}
                    iconBg="#E8F1FE"
                    iconColor={PAYROLL_COLORS.blue}
                />
                <SummaryCard
                    title="Overtime Paid"
                    value={summary.overtimePaid}
                    icon={Clock}
                    iconBg="#FEF6E4"
                    iconColor={PAYROLL_COLORS.orange}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                <ChartCard title="1) Month-wise Salary">
                    <RechartsBox height={260} minHeight={240}>
                        <BarChart data={monthWiseSalary} margin={{ top: 22, right: 8, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={PAYROLL_COLORS.grid} vertical={false} />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={monthAxis.domain}
                                ticks={monthAxis.ticks}
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                                width={52}
                                label={{
                                    value: 'AED (K)',
                                    angle: -90,
                                    position: 'insideLeft',
                                    style: { fill: PAYROLL_COLORS.axis, fontSize: 11 },
                                }}
                            />
                            <RechartsTooltip
                                contentStyle={tooltipStyle}
                                formatter={(value) => [`AED ${formatK(value)}`, 'Salary']}
                                cursor={{ fill: 'rgba(76, 142, 245, 0.08)' }}
                            />
                            <Bar dataKey="total" fill={PAYROLL_COLORS.blue} radius={[6, 6, 0, 0]} maxBarSize={28}>
                                <LabelList
                                    dataKey="total"
                                    position="top"
                                    formatter={formatK}
                                    style={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                                />
                            </Bar>
                        </BarChart>
                    </RechartsBox>
                </ChartCard>

                <ChartCard title="2) Salary Ratio">
                    <div className="h-full flex items-center gap-2 min-h-[240px]">
                        <div className="relative flex-1 min-w-0 h-[240px]">
                            <RechartsBox height={240} minHeight={240}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={48}
                                        outerRadius={102}
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="#fff"
                                        strokeWidth={3}
                                    >
                                        {pieData.map((row) => (
                                            <Cell
                                                key={row.name}
                                                fill={
                                                    row.empty
                                                        ? '#CBD5E1'
                                                        : row.name === 'Office Staff'
                                                          ? PAYROLL_COLORS.teal
                                                          : PAYROLL_COLORS.blue
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
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <p className="text-[15px] font-bold text-[#0F172A] tabular-nums">
                                    {summary.annualPayrollShort}
                                </p>
                            </div>
                        </div>
                        <div className="shrink-0 pr-1 space-y-3">
                            <div className="flex items-center gap-2 text-[13px] text-[#334155]">
                                <span
                                    className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                                    style={{ backgroundColor: PAYROLL_COLORS.teal }}
                                />
                                <span>Office Staff {summary.officePct}%</span>
                            </div>
                            <div className="flex items-center gap-2 text-[13px] text-[#334155]">
                                <span
                                    className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                                    style={{ backgroundColor: PAYROLL_COLORS.blue }}
                                />
                                <span>Site Staff {summary.sitePct}%</span>
                            </div>
                        </div>
                    </div>
                </ChartCard>

                <ChartCard title="3) Office vs Site Salary — Monthly">
                    <RechartsBox height={260} minHeight={240}>
                        <BarChart
                            data={officeVsSiteMonthly}
                            margin={{ top: 28, right: 8, left: 4, bottom: 4 }}
                            barGap={2}
                            barCategoryGap="22%"
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={PAYROLL_COLORS.grid} vertical={false} />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={officeSiteAxis.domain}
                                ticks={officeSiteAxis.ticks}
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                                width={52}
                                label={{
                                    value: 'AED (K)',
                                    angle: -90,
                                    position: 'insideLeft',
                                    style: { fill: PAYROLL_COLORS.axis, fontSize: 11 },
                                }}
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
                                wrapperStyle={{ fontSize: 12, color: '#64748B', paddingBottom: 4 }}
                            />
                            <Bar
                                dataKey="office"
                                name="Office Staff"
                                fill={PAYROLL_COLORS.teal}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={14}
                            >
                                <LabelList
                                    dataKey="office"
                                    position="top"
                                    formatter={formatK}
                                    style={{ fontSize: 8, fill: '#64748B', fontWeight: 600 }}
                                />
                            </Bar>
                            <Bar
                                dataKey="site"
                                name="Site Staff"
                                fill={PAYROLL_COLORS.blue}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={14}
                            >
                                <LabelList
                                    dataKey="site"
                                    position="top"
                                    formatter={formatK}
                                    style={{ fontSize: 8, fill: '#64748B', fontWeight: 600 }}
                                />
                            </Bar>
                        </BarChart>
                    </RechartsBox>
                </ChartCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <ChartCard title="4) Total Leave by Category">
                    <RechartsBox height={260} minHeight={240}>
                        <BarChart
                            layout="vertical"
                            data={leaveByCategory}
                            margin={{ top: 8, right: 36, left: 8, bottom: 18 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={PAYROLL_COLORS.grid} horizontal={false} />
                            <XAxis
                                type="number"
                                domain={leaveAxis.domain}
                                ticks={leaveAxis.ticks}
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                                label={{
                                    value: 'Number of Leaves',
                                    position: 'insideBottom',
                                    offset: -8,
                                    style: { fill: PAYROLL_COLORS.axis, fontSize: 11 },
                                }}
                            />
                            <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fontSize: 12, fill: '#475569' }}
                                axisLine={false}
                                tickLine={false}
                                width={96}
                            />
                            <RechartsTooltip
                                contentStyle={tooltipStyle}
                                formatter={(value) => [value, 'Leaves']}
                                cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                            />
                            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={22} background={{ fill: '#F8FAFC' }}>
                                {leaveByCategory.map((row) => (
                                    <Cell key={row.name} fill={row.color} />
                                ))}
                                <LabelList
                                    dataKey="value"
                                    position="right"
                                    style={{ fontSize: 12, fill: '#475569', fontWeight: 700 }}
                                />
                            </Bar>
                        </BarChart>
                    </RechartsBox>
                </ChartCard>

                <ChartCard title="5) Overtime Paid — Monthly">
                    <RechartsBox height={260} minHeight={240}>
                        <AreaChart data={overtimeMonthly} margin={{ top: 22, right: 12, left: 4, bottom: 4 }}>
                            <defs>
                                <linearGradient id="payrollOtFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={PAYROLL_COLORS.orange} stopOpacity={0.28} />
                                    <stop offset="100%" stopColor={PAYROLL_COLORS.orange} stopOpacity={0.04} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={PAYROLL_COLORS.grid} vertical={false} />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={overtimeAxis.domain}
                                ticks={overtimeAxis.ticks}
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                                width={52}
                                label={{
                                    value: 'AED (K)',
                                    angle: -90,
                                    position: 'insideLeft',
                                    style: { fill: PAYROLL_COLORS.axis, fontSize: 11 },
                                }}
                            />
                            <RechartsTooltip
                                contentStyle={tooltipStyle}
                                formatter={(value) => [`AED ${formatK(value)}`, 'Overtime']}
                            />
                            <Area
                                type="monotone"
                                dataKey="ot"
                                stroke={PAYROLL_COLORS.orange}
                                strokeWidth={2.5}
                                fill="url(#payrollOtFill)"
                                dot={{
                                    r: 4.5,
                                    fill: PAYROLL_COLORS.orange,
                                    stroke: '#fff',
                                    strokeWidth: 2,
                                }}
                                activeDot={{ r: 6 }}
                            >
                                <LabelList
                                    dataKey="ot"
                                    position="top"
                                    formatter={formatK}
                                    style={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                                />
                            </Area>
                        </AreaChart>
                    </RechartsBox>
                </ChartCard>

                <ChartCard title="6) Total Deductions by Category">
                    <RechartsBox height={260} minHeight={240}>
                        <BarChart data={deductionsByCategory} margin={{ top: 22, right: 8, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={PAYROLL_COLORS.grid} vertical={false} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                                interval={0}
                            />
                            <YAxis
                                domain={deductionAxis.domain}
                                ticks={deductionAxis.ticks}
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                                width={52}
                                label={{
                                    value: 'AED (K)',
                                    angle: -90,
                                    position: 'insideLeft',
                                    style: { fill: PAYROLL_COLORS.axis, fontSize: 11 },
                                }}
                            />
                            <RechartsTooltip
                                contentStyle={tooltipStyle}
                                formatter={(value) => [`AED ${formatK(value)}`, 'Deduction']}
                                cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                            />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                                {deductionsByCategory.map((row) => (
                                    <Cell key={row.name} fill={row.color} />
                                ))}
                                <LabelList
                                    dataKey="value"
                                    position="top"
                                    formatter={formatK}
                                    style={{ fontSize: 11, fill: '#64748B', fontWeight: 700 }}
                                />
                            </Bar>
                        </BarChart>
                    </RechartsBox>
                </ChartCard>
            </div>
            </>
            )}
            <PayrollSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
    );
}
