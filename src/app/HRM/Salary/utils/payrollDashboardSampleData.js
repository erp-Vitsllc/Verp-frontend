/** Sample payroll dashboard figures matching the 2026 design mockup. */

export const PAYROLL_COLORS = {
    blue: '#4C8EF5',
    teal: '#2FCFC2',
    orange: '#F2B429',
    coral: '#F07A72',
    slate: '#8BA3B8',
    grid: '#EEF2F6',
    axis: '#94A3B8',
    title: '#1E293B',
    muted: '#94A3B8',
};

export const PAYROLL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MONTHLY_TOTAL_K = [220, 228, 218, 232, 238, 242, 248, 236, 240, 248, 252, 238];
const OFFICE_K = [88, 92, 86, 94, 96, 98, 100, 90, 92, 96, 100, 88];
const SITE_K = [132, 136, 132, 138, 142, 144, 148, 146, 148, 152, 152, 150];
const OVERTIME_K = [8, 9, 8, 9, 10, 11, 13, 10, 11, 12, 14, 11];

export const PAYROLL_SUMMARY = {
    annualPayroll: 'AED 2.84M',
    officeStaff: 'AED 1.12M',
    siteStaff: 'AED 1.72M',
    overtimePaid: 'AED 126K',
    annualPayrollShort: 'AED 2.84M',
    officePct: 39,
    sitePct: 61,
};

export const MONTH_WISE_SALARY = PAYROLL_MONTHS.map((month, i) => ({
    month,
    total: MONTHLY_TOTAL_K[i],
}));

export const OFFICE_VS_SITE_MONTHLY = PAYROLL_MONTHS.map((month, i) => ({
    month,
    office: OFFICE_K[i],
    site: SITE_K[i],
}));

export const OVERTIME_MONTHLY = PAYROLL_MONTHS.map((month, i) => ({
    month,
    ot: OVERTIME_K[i],
}));

export const SALARY_RATIO = [
    { name: 'Office Staff', value: 39, amount: 1.12 },
    { name: 'Site Staff', value: 61, amount: 1.72 },
];

export const LEAVE_BY_CATEGORY = [
    { name: 'Sick', value: 42, color: PAYROLL_COLORS.coral },
    { name: 'Authorized', value: 67, color: PAYROLL_COLORS.teal },
    { name: 'Unauthorized', value: 18, color: PAYROLL_COLORS.orange },
];

export const DEDUCTIONS_BY_CATEGORY = [
    { name: 'Loss of Pay', value: 38, color: PAYROLL_COLORS.coral },
    { name: 'Loan', value: 52, color: PAYROLL_COLORS.teal },
    { name: 'Advance', value: 29, color: PAYROLL_COLORS.orange },
    { name: 'Fine', value: 8, color: PAYROLL_COLORS.slate },
];

export const PAYROLL_YEARS = [2024, 2025, 2026];
