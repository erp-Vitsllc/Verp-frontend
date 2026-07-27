/** Period filtering + aggregation for the Utility Bills overview header cards. */

import { getMonthlyRentalAmount, isEntryActive } from './utilityBillsStorage';

export const ALL_MONTHS = 'all';

export const MONTH_OPTIONS = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

const sameName = (a, b) =>
    String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

function parseBillMonth(billMonth) {
    const value = String(billMonth || '').trim();
    if (!/^\d{4}-\d{2}$/.test(value)) return null;
    return { year: value.slice(0, 4), month: value.slice(5, 7) };
}

export function currentPeriod() {
    const now = new Date();
    return {
        year: String(now.getFullYear()),
        month: String(now.getMonth() + 1).padStart(2, '0'),
    };
}

export function billMatchesPeriod(billMonth, year, month) {
    const parsed = parseBillMonth(billMonth);
    if (!parsed) return false;
    if (year && parsed.year !== String(year)) return false;
    if (month && month !== ALL_MONTHS && parsed.month !== String(month)) return false;
    return true;
}

/** Years that have bills, plus the current year so the filter is never empty. */
export function utilityBillYears(bills = []) {
    const years = new Set([currentPeriod().year]);
    (Array.isArray(bills) ? bills : []).forEach((bill) => {
        const parsed = parseBillMonth(bill?.billMonth);
        if (parsed) years.add(parsed.year);
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

/**
 * Contract vs actual billed amount for one utility type in the selected period.
 * With no bills in the period, the standing contract of active entries is used.
 */
export function summarizeTypePeriodAmount({ typeName, entries = [], bills = [], year, month }) {
    const typeEntries = entries.filter((entry) => sameName(entry?.type, typeName));
    const periodBills = bills.filter(
        (bill) =>
            sameName(bill?.utilityType, typeName) && billMatchesPeriod(bill?.billMonth, year, month),
    );

    const standingContract = typeEntries
        .filter(isEntryActive)
        .reduce((sum, entry) => sum + getMonthlyRentalAmount(entry), 0);
    const contractAmount = periodBills.length
        ? periodBills.reduce((sum, bill) => sum + (Number(bill.monthlyRental) || 0), 0)
        : standingContract;
    const actualAmount = periodBills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);

    return {
        count: periodBills.length,
        recordCount: typeEntries.length,
        contractAmount,
        actualAmount,
        difference: periodBills.length ? Math.abs(contractAmount - actualAmount) : 0,
        payments: periodBills
            .map((bill) => ({
                id: String(bill?._id || bill?.id || ''),
                entryId: String(bill?.entryId || ''),
                label: String(
                    bill?.provider ||
                        bill?.payByCompanyName ||
                        bill?.payByEmployeeName ||
                        typeName,
                ).trim(),
                accountNo: String(bill?.accountNo || '').trim(),
                billMonth: String(bill?.billMonth || '').trim(),
                amount: Number(bill?.amount) || 0,
                status: String(bill?.status || '').trim(),
            }))
            .sort((a, b) => b.billMonth.localeCompare(a.billMonth)),
    };
}

/**
 * Overview boxes for the selected month / year.
 * Always includes every utility type that has records; bill count / amounts
 * follow the selected month (or the full year when month = All months).
 */
export function buildTypeOverviewCards({ typeTabs = [], entries = [], bills = [], year, month }) {
    return typeTabs
        .map((tab) => {
            const typeName = String(tab?.type || '');
            return {
                type: typeName,
                label: typeName,
                ...summarizeTypePeriodAmount({ typeName, entries, bills, year, month }),
            };
        })
        .filter((item) => item.recordCount > 0);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function formatExpiryDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '');
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Entries with a contract end date, soonest expiry first. */
export function buildContractExpiryRows(entries = []) {
    const today = startOfToday();

    return (Array.isArray(entries) ? entries : [])
        .map((entry) => {
            const end = String(entry?.values?.contractEnd || '').trim();
            if (!end) return null;
            const time = new Date(end).getTime();
            if (Number.isNaN(time)) return null;
            return {
                id: String(entry.id || ''),
                type: String(entry.type || ''),
                title: String(entry?.values?.provider || entry.type || 'Utility'),
                subtitle: String(entry?.values?.accountNumber || entry?.values?.location || ''),
                endDate: end,
                endLabel: formatExpiryDate(end),
                daysLeft: Math.ceil((time - today) / MS_PER_DAY),
                time,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);
}

/** Entry counts per utility type for the overview pie chart. */
export function buildTypeDistribution(entries = []) {
    const counts = new Map();
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
        const name = String(entry?.type || '').trim();
        if (!name) return;
        counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
}

export const UTILITY_TYPE_COLORS = [
    '#0ea5e9',
    '#14b8a6',
    '#f97316',
    '#8b5cf6',
    '#22c55e',
    '#ec4899',
    '#eab308',
    '#6366f1',
];
