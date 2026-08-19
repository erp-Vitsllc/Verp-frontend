'use client';

import { useState } from 'react';
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
import { Clock, HardHat, MoreVertical, User, Wallet } from 'lucide-react';
import RechartsBox from '@/components/charts/RechartsBox';
import {
    DEDUCTIONS_BY_CATEGORY,
    LEAVE_BY_CATEGORY,
    MONTH_WISE_SALARY,
    OFFICE_VS_SITE_MONTHLY,
    OVERTIME_MONTHLY,
    PAYROLL_COLORS,
    PAYROLL_SUMMARY,
    PAYROLL_YEARS,
    SALARY_RATIO,
} from '../utils/payrollDashboardSampleData';

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

function formatK(value) {
    return `${value}K`;
}

function ChartCard({ title, children, legend }) {
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
            {legend || null}
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

export default function PayrollDashboard() {
    const [year, setYear] = useState(2026);
    const [employeeId, setEmployeeId] = useState('all');

    return (
        <div className="w-full max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-[28px] md:text-[32px] font-bold text-[#0F172A] tracking-tight">
                        Payroll Dashboard
                    </h1>
                    <p className="text-sm text-[#94A3B8] mt-1">Sample Data • Jan-Dec {year}</p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium text-[#94A3B8]">Year</span>
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="h-10 min-w-[108px] rounded-xl border border-[#E8EDF3] bg-white px-3 text-sm font-semibold text-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none focus:ring-2 focus:ring-[#4C8EF5]/20"
                        >
                            {PAYROLL_YEARS.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium text-transparent select-none">Employee</span>
                        <select
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            className="h-10 min-w-[168px] rounded-xl border border-[#E8EDF3] bg-white px-3 text-sm font-semibold text-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none focus:ring-2 focus:ring-[#4C8EF5]/20"
                        >
                            <option value="all">All Employees</option>
                        </select>
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                <SummaryCard
                    title="Annual Payroll"
                    value={PAYROLL_SUMMARY.annualPayroll}
                    icon={Wallet}
                    iconBg="#E8F1FE"
                    iconColor={PAYROLL_COLORS.blue}
                />
                <SummaryCard
                    title="Office Staff"
                    value={PAYROLL_SUMMARY.officeStaff}
                    icon={User}
                    iconBg="#E6F9F6"
                    iconColor={PAYROLL_COLORS.teal}
                />
                <SummaryCard
                    title="Site Staff"
                    value={PAYROLL_SUMMARY.siteStaff}
                    icon={HardHat}
                    iconBg="#E8F1FE"
                    iconColor={PAYROLL_COLORS.blue}
                />
                <SummaryCard
                    title="Overtime Paid"
                    value={PAYROLL_SUMMARY.overtimePaid}
                    icon={Clock}
                    iconBg="#FEF6E4"
                    iconColor={PAYROLL_COLORS.orange}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                <ChartCard title="1) Month-wise Salary">
                    <RechartsBox height={260} minHeight={240}>
                        <BarChart data={MONTH_WISE_SALARY} margin={{ top: 22, right: 8, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={PAYROLL_COLORS.grid} vertical={false} />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[0, 300]}
                                ticks={[0, 100, 200, 300]}
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
                                        data={SALARY_RATIO}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={68}
                                        outerRadius={96}
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="#fff"
                                        strokeWidth={3}
                                    >
                                        <Cell fill={PAYROLL_COLORS.teal} />
                                        <Cell fill={PAYROLL_COLORS.blue} />
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={tooltipStyle}
                                        formatter={(value, name) => [`${value}%`, name]}
                                    />
                                </PieChart>
                            </RechartsBox>
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <p className="text-[15px] font-bold text-[#0F172A] tabular-nums">
                                    {PAYROLL_SUMMARY.annualPayrollShort}
                                </p>
                            </div>
                        </div>
                        <div className="shrink-0 pr-1 space-y-3">
                            <div className="flex items-center gap-2 text-[13px] text-[#334155]">
                                <span
                                    className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                                    style={{ backgroundColor: PAYROLL_COLORS.teal }}
                                />
                                <span>Office Staff {PAYROLL_SUMMARY.officePct}%</span>
                            </div>
                            <div className="flex items-center gap-2 text-[13px] text-[#334155]">
                                <span
                                    className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                                    style={{ backgroundColor: PAYROLL_COLORS.blue }}
                                />
                                <span>Site Staff {PAYROLL_SUMMARY.sitePct}%</span>
                            </div>
                        </div>
                    </div>
                </ChartCard>

                <ChartCard title="3) Office vs Site Salary — Monthly">
                    <RechartsBox height={260} minHeight={240}>
                        <BarChart
                            data={OFFICE_VS_SITE_MONTHLY}
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
                                domain={[0, 200]}
                                ticks={[0, 50, 100, 150, 200]}
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
                            data={LEAVE_BY_CATEGORY}
                            margin={{ top: 8, right: 36, left: 8, bottom: 18 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={PAYROLL_COLORS.grid} horizontal={false} />
                            <XAxis
                                type="number"
                                domain={[0, 80]}
                                ticks={[0, 20, 40, 60, 80]}
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
                                {LEAVE_BY_CATEGORY.map((row) => (
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
                        <AreaChart data={OVERTIME_MONTHLY} margin={{ top: 22, right: 12, left: 4, bottom: 4 }}>
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
                                domain={[0, 25]}
                                ticks={[0, 5, 10, 15, 20, 25]}
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
                        <BarChart data={DEDUCTIONS_BY_CATEGORY} margin={{ top: 22, right: 8, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={PAYROLL_COLORS.grid} vertical={false} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                                interval={0}
                            />
                            <YAxis
                                domain={[0, 60]}
                                ticks={[0, 15, 30, 45, 60]}
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
                                {DEDUCTIONS_BY_CATEGORY.map((row) => (
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
        </div>
    );
}
