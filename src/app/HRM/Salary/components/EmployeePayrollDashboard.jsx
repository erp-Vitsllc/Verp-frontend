'use client';

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
import { CalendarDays, MoreVertical, TrendingDown, Wallet } from 'lucide-react';
import RechartsBox from '@/components/charts/RechartsBox';
import { PAYROLL_COLORS, PAYROLL_MONTHS, formatK, niceAxis } from '../utils/payrollDashboardChartUtils';

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

const YEAR_COLORS = [PAYROLL_COLORS.slate, PAYROLL_COLORS.teal, PAYROLL_COLORS.blue];

const LEAVE_COLORS = {
    Authorized: PAYROLL_COLORS.teal,
    Unauthorized: PAYROLL_COLORS.coral,
    Sick: PAYROLL_COLORS.blue,
    'Work from Home': PAYROLL_COLORS.orange,
};

function formatAedTick(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10}K`;
    return `${Math.round(n)}`;
}

function ChartCard({ title, total, totalColor, children }) {
    return (
        <div className={chartCardClass}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-[#1E293B] leading-snug">{title}</h3>
                    {total ? (
                        <p className="text-[13px] font-bold mt-0.5" style={{ color: totalColor || PAYROLL_COLORS.blue }}>
                            Total: {total}
                        </p>
                    ) : null}
                </div>
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

function MonthlyBarChart({ data, color, axis }) {
    return (
        <RechartsBox height={240} minHeight={220}>
            <BarChart data={data} margin={{ top: 22, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={PAYROLL_COLORS.grid} vertical={false} />
                <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    domain={axis.domain}
                    ticks={axis.ticks}
                    tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    tickFormatter={formatAedTick}
                />
                <RechartsTooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [`AED ${Math.round(Number(value) || 0).toLocaleString('en-US')}`, 'Amount']}
                    cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                />
                <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={22}>
                    <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(value) => (Number(value) > 0 ? formatAedTick(value) : '')}
                        style={{ fontSize: 9, fill: '#64748B', fontWeight: 600 }}
                    />
                </Bar>
            </BarChart>
        </RechartsBox>
    );
}

export default function EmployeePayrollDashboard({ data }) {
    const summary = data?.summary || {
        currentSalary: 'AED 0',
        totalDeductions: 'AED 0',
        netPaidYtd: 'AED 0',
        leaveUsed: '0 Days',
        leaveUsedDays: 0,
    };
    const comparisonYears = data?.comparisonYears?.length ? data.comparisonYears : [new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear()];
    const salaryYearComparison = data?.salaryYearComparison?.length
        ? data.salaryYearComparison
        : PAYROLL_MONTHS.map((month) => {
              const row = { month };
              comparisonYears.forEach((y) => {
                  row[String(y)] = 0;
              });
              return row;
          });
    const lossOfPayMonthly = data?.lossOfPayMonthly || PAYROLL_MONTHS.map((month) => ({ month, value: 0 }));
    const loanMonthly = data?.loanMonthly || PAYROLL_MONTHS.map((month) => ({ month, value: 0 }));
    const advanceMonthly = data?.advanceMonthly || PAYROLL_MONTHS.map((month) => ({ month, value: 0 }));
    const fineMonthly = data?.fineMonthly || PAYROLL_MONTHS.map((month) => ({ month, value: 0 }));
    const leaveByType = (data?.leaveByType || []).map((row) => ({
        ...row,
        color: LEAVE_COLORS[row.name] || PAYROLL_COLORS.slate,
    }));

    const salaryAxis = niceAxis(
        salaryYearComparison.flatMap((row) => comparisonYears.map((y) => Number(row[String(y)]) || 0)),
        4,
        4,
    );
    const lopAxis = niceAxis(lossOfPayMonthly.map((row) => row.value), 4, 100);
    const loanAxis = niceAxis(loanMonthly.map((row) => row.value), 4, 100);
    const advanceAxis = niceAxis(advanceMonthly.map((row) => row.value), 4, 100);
    const fineAxis = niceAxis(fineMonthly.map((row) => row.value), 4, 100);

    const pieHasData = leaveByType.some((row) => Number(row.value) > 0);
    const pieData = pieHasData ? leaveByType.filter((row) => Number(row.value) > 0) : [{ name: 'No data', value: 1, empty: true }];

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                <SummaryCard
                    title="Current Salary"
                    value={summary.currentSalary}
                    icon={Wallet}
                    iconBg="#E8F1FE"
                    iconColor={PAYROLL_COLORS.blue}
                />
                <SummaryCard
                    title="Total Deductions"
                    value={summary.totalDeductions}
                    icon={TrendingDown}
                    iconBg="#FEF3E8"
                    iconColor={PAYROLL_COLORS.orange}
                />
                <SummaryCard
                    title="Net Paid YTD"
                    value={summary.netPaidYtd}
                    icon={Wallet}
                    iconBg="#E8F8EF"
                    iconColor="#16A34A"
                />
                <SummaryCard
                    title="Leave Used"
                    value={summary.leaveUsed}
                    icon={CalendarDays}
                    iconBg="#FEF6E4"
                    iconColor={PAYROLL_COLORS.orange}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                <ChartCard title="1) Employee Monthly Salary — Year Comparison">
                    <RechartsBox height={240} minHeight={220}>
                        <BarChart data={salaryYearComparison} margin={{ top: 28, right: 8, left: 4, bottom: 4 }} barGap={1} barCategoryGap="18%">
                            <CartesianGrid strokeDasharray="3 3" stroke={PAYROLL_COLORS.grid} vertical={false} />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={salaryAxis.domain}
                                ticks={salaryAxis.ticks}
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                                width={44}
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
                            {comparisonYears.map((y, idx) => (
                                <Bar
                                    key={y}
                                    dataKey={String(y)}
                                    name={String(y)}
                                    fill={YEAR_COLORS[idx] || PAYROLL_COLORS.blue}
                                    radius={[3, 3, 0, 0]}
                                    maxBarSize={12}
                                />
                            ))}
                        </BarChart>
                    </RechartsBox>
                </ChartCard>

                <ChartCard title="2) Loss of Pay — Non-Attendance" total={data?.lossOfPayTotal || 'AED 0'} totalColor={PAYROLL_COLORS.coral}>
                    <MonthlyBarChart data={lossOfPayMonthly} color={PAYROLL_COLORS.coral} axis={lopAxis} />
                </ChartCard>

                <ChartCard title="3) Loan Deduction" total={data?.loanTotal || 'AED 0'} totalColor={PAYROLL_COLORS.blue}>
                    <RechartsBox height={240} minHeight={220}>
                        <AreaChart data={loanMonthly} margin={{ top: 22, right: 12, left: 4, bottom: 4 }}>
                            <defs>
                                <linearGradient id="empLoanFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={PAYROLL_COLORS.blue} stopOpacity={0.28} />
                                    <stop offset="100%" stopColor={PAYROLL_COLORS.blue} stopOpacity={0.04} />
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
                                domain={loanAxis.domain}
                                ticks={loanAxis.ticks}
                                tick={{ fontSize: 11, fill: PAYROLL_COLORS.axis }}
                                axisLine={false}
                                tickLine={false}
                                width={44}
                                tickFormatter={formatAedTick}
                            />
                            <RechartsTooltip
                                contentStyle={tooltipStyle}
                                formatter={(value) => [`AED ${Math.round(Number(value) || 0).toLocaleString('en-US')}`, 'Loan']}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={PAYROLL_COLORS.blue}
                                strokeWidth={2.5}
                                fill="url(#empLoanFill)"
                                dot={{ r: 3.5, fill: PAYROLL_COLORS.blue, stroke: '#fff', strokeWidth: 2 }}
                            />
                        </AreaChart>
                    </RechartsBox>
                </ChartCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <ChartCard title="4) Advance Deduction" total={data?.advanceTotal || 'AED 0'} totalColor={PAYROLL_COLORS.orange}>
                    <MonthlyBarChart data={advanceMonthly} color={PAYROLL_COLORS.orange} axis={advanceAxis} />
                </ChartCard>

                <ChartCard title="5) Fine Deduction" total={data?.fineTotal || 'AED 0'} totalColor={PAYROLL_COLORS.slate}>
                    <MonthlyBarChart data={fineMonthly} color={PAYROLL_COLORS.slate} axis={fineAxis} />
                </ChartCard>

                <ChartCard title="6) Employee Leave by Type">
                    <div className="h-full flex items-center gap-2 min-h-[220px]">
                        <div className="relative flex-1 min-w-0 h-[220px]">
                            <RechartsBox height={220} minHeight={220}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={48}
                                        outerRadius={92}
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="#fff"
                                        strokeWidth={3}
                                    >
                                        {pieData.map((row) => (
                                            <Cell key={row.name} fill={row.empty ? '#CBD5E1' : row.color || LEAVE_COLORS[row.name]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={tooltipStyle}
                                        formatter={(value, name) => [`${pieHasData ? value : 0} Days`, name]}
                                    />
                                </PieChart>
                            </RechartsBox>
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <p className="text-[13px] font-bold text-[#0F172A] text-center leading-tight">
                                    Total
                                    <br />
                                    {summary.leaveUsedDays || 0} Days
                                </p>
                            </div>
                        </div>
                        <div className="shrink-0 pr-1 space-y-2">
                            {leaveByType.map((row) => (
                                <div key={row.name} className="flex items-center gap-2 text-[12px] text-[#334155]">
                                    <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: row.color }} />
                                    <span>
                                        {row.name} {row.value} Days
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </ChartCard>
            </div>
        </>
    );
}
