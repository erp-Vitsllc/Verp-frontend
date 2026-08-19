/** Period filtering + aggregation for the Utility Bills overview header cards. */

import { getMonthlyRentalAmount, isEntryActive, normalizePaymentDay, entryRequiresMonthlyBill } from './utilityBillsStorage';
import {
    billDisplayStatus,
    entryAvailableFromMonth,
    normalizeBillMonthKey,
} from './utilityBillStats';

export const ALL_MONTHS = 'all';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Bill month YYYY-MM + payment day (1–31) → due date at start of that calendar day. */
export function payableDueDateForBillMonth(billMonth, paymentDay = 16) {
    const month = String(billMonth || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return null;

    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;

    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    let day = Number(paymentDay);
    if (!Number.isInteger(day) || day < 1) day = 16;
    day = Math.min(day, lastDay);

    return new Date(year, monthIndex, day);
}

/** True once today is after the account's payable day for that bill month. */
export function isPayableDatePassed(billMonth, paymentDay, refDate = new Date()) {
    const due = payableDueDateForBillMonth(billMonth, paymentDay);
    if (!due) return false;
    const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    return today.getTime() > due.getTime();
}

function resolvePaymentDay(bill, entry) {
    if (entry && !entryRequiresMonthlyBill(entry)) return null;
    const fromBill = Number(bill?.paymentDay);
    if (Number.isInteger(fromBill) && fromBill >= 1 && fromBill <= 31) return fromBill;
    const values = normalizePaymentDay(entry?.values || {});
    const fromEntry = Number(values.paymentDay);
    if (Number.isInteger(fromEntry) && fromEntry >= 1 && fromEntry <= 31) return fromEntry;
    return null;
}

function calendarCurrentMonthKey(refDate = new Date()) {
    return `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
}

function calendarPreviousMonthKey(refDate = new Date()) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Paid-bills window: this month and last month only. */
function paidOverviewMonthKeys(refDate = new Date()) {
    return new Set([calendarCurrentMonthKey(refDate), calendarPreviousMonthKey(refDate)]);
}

function isPaidOverviewMonth(billMonth, refDate = new Date()) {
    const ym = normalizeBillMonthKey(billMonth);
    return ym ? paidOverviewMonthKeys(refDate).has(ym) : false;
}

/** Unpaid window: current month and every earlier month (no future months). */
function isCurrentOrEarlierBillMonth(billMonth, refDate = new Date()) {
    const ym = normalizeBillMonthKey(billMonth);
    if (!ym) return false;
    return ym <= calendarCurrentMonthKey(refDate);
}

/** Every YYYY-MM from entry availability through the current calendar month. */
function billMonthsThroughCurrentForEntry(entry, refDate = new Date()) {
    const currentYm = calendarCurrentMonthKey(refDate);
    const fromYm = entryAvailableFromMonth(entry);
    if (!fromYm || fromYm > currentYm) return [];

    const months = [];
    let year = Number(fromYm.slice(0, 4));
    let month = Number(fromYm.slice(5, 7));
    const [endYear, endMonth] = currentYm.split('-').map(Number);

    while (year < endYear || (year === endYear && month <= endMonth)) {
        months.push(`${year}-${String(month).padStart(2, '0')}`);
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    return months;
}

function entriesById(entries = []) {
    return new Map(
        (Array.isArray(entries) ? entries : [])
            .map((entry) => [String(entry?.id || '').trim(), entry])
            .filter(([id]) => id),
    );
}

function formatExpiryDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '');
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function mapBillToOverviewRow(bill, entry = null) {
    const id = String(bill?._id || bill?.id || '');
    const entryId = String(bill?.entryId || bill?.entry?._id || bill?.entry || '').trim();
    const href = entryId
        ? `/HRM/Asset/UtilityBills/details/${encodeURIComponent(entryId)}${
              id ? `?billId=${encodeURIComponent(id)}` : ''
          }`
        : '';
    const rawStatus = String(bill?.status || '').trim();
    const billMonth = String(bill?.billMonth || '').trim();
    const paymentDay = resolvePaymentDay(bill, entry);
    const overdue = isPayableDatePassed(billMonth, paymentDay);
    let statusLabel =
        rawStatus === 'Approved'
            ? 'Not Paid'
            : rawStatus === 'Paid'
              ? 'Paid'
              : billDisplayStatus(bill) || rawStatus;
    if (overdue && rawStatus !== 'Paid') {
        statusLabel = `Overdue · ${statusLabel}`;
    }
    return {
        id,
        entryId,
        batchId: String(bill?.batchId || ''),
        type: String(bill?.utilityType || ''),
        title: String(bill?.provider || bill?.utilityType || 'Utility').trim(),
        subtitle: [bill?.accountNo, billMonth].filter(Boolean).join(' · '),
        amount: Number(bill?.amount) || 0,
        status: statusLabel,
        rawStatus,
        billMonth,
        paymentDay,
        isOverdue: overdue,
        href,
        isMissingBill: false,
    };
}

function sortOverviewBillRows(a, b) {
    const monthCmp = String(b.billMonth || '').localeCompare(String(a.billMonth || ''));
    if (monthCmp !== 0) return monthCmp;
    const typeCmp = String(a.type).localeCompare(String(b.type));
    if (typeCmp !== 0) return typeCmp;
    if (Boolean(a.isMissingBill) !== Boolean(b.isMissingBill)) {
        return a.isMissingBill ? 1 : -1;
    }
    return Number(b.amount) - Number(a.amount);
}

/** Paid bills for the current calendar month and the previous month. */
export function buildPaidBillRows({ bills = [], refDate = new Date() } = {}) {
    return (Array.isArray(bills) ? bills : [])
        .filter((bill) => isPaidOverviewMonth(bill?.billMonth, refDate))
        .filter((bill) => String(bill?.status || '').trim() === 'Paid')
        .map((bill) => mapBillToOverviewRow(bill))
        .sort(sortOverviewBillRows);
}

/**
 * Pending unpaid bills and missing bills for the current month and all earlier months.
 */
export function buildUnpaidBillRows({ bills = [], entries = [], refDate = new Date() } = {}) {
    const list = Array.isArray(bills) ? bills : [];
    const entryMap = entriesById(entries);

    const billRows = list
        .filter((bill) => isCurrentOrEarlierBillMonth(bill?.billMonth, refDate))
        .filter((bill) => {
            const status = String(bill?.status || '').trim();
            return status && status !== 'Paid';
        })
        .filter((bill) => {
            const entry = entryMap.get(String(bill?.entryId || '').trim()) || null;
            return !entry || entryRequiresMonthlyBill(entry);
        })
        .map((bill) => mapBillToOverviewRow(bill, entryMap.get(String(bill?.entryId || '').trim()) || null));

    const billsByEntryMonth = new Map();
    for (const bill of list) {
        const entryId = String(bill?.entryId || '').trim();
        const ym = normalizeBillMonthKey(bill?.billMonth);
        if (!entryId || !ym) continue;
        billsByEntryMonth.set(`${entryId}::${ym}`, bill);
    }

    const missingBillRows = [];
    for (const entry of Array.isArray(entries) ? entries : []) {
        if (!isEntryActive(entry)) continue;
        if (!entryRequiresMonthlyBill(entry)) continue;
        const entryId = String(entry?.id || '').trim();
        if (!entryId) continue;
        const paymentDay = resolvePaymentDay(null, entry);
        if (!paymentDay) continue;

        for (const ym of billMonthsThroughCurrentForEntry(entry, refDate)) {
            if (billsByEntryMonth.has(`${entryId}::${ym}`)) continue;
            const overdue = isPayableDatePassed(ym, paymentDay, refDate);
            missingBillRows.push({
                id: `missing-${entryId}-${ym}`,
                entryId,
                batchId: '',
                type: String(entry?.type || ''),
                title: String(entry?.values?.provider || entry?.type || 'Utility').trim(),
                subtitle: [entry?.values?.accountNumber, ym].filter(Boolean).join(' · '),
                amount: getMonthlyRentalAmount(entry),
                status: overdue ? 'Overdue · Bill not created' : 'Bill not created',
                rawStatus: 'missing',
                billMonth: ym,
                paymentDay,
                isOverdue: overdue,
                href: `/HRM/Asset/UtilityBills/details/${encodeURIComponent(entryId)}`,
                isMissingBill: true,
            });
        }
    }

    return [...billRows, ...missingBillRows].sort(sortOverviewBillRows);
}

/** Active (not expired) contracts with an end date, soonest end first. */
export function buildContractExpiryRows(entries = []) {
    const today = startOfToday();

    return (Array.isArray(entries) ? entries : [])
        .map((entry) => {
            const end = String(entry?.values?.contractEnd || '').trim();
            if (!end) return null;
            const endDate = new Date(end);
            if (Number.isNaN(endDate.getTime())) return null;
            const endDay = new Date(
                endDate.getFullYear(),
                endDate.getMonth(),
                endDate.getDate(),
            ).getTime();
            const daysLeft = Math.ceil((endDay - today.getTime()) / MS_PER_DAY);
            // Only list contracts that are still active (not expired).
            if (daysLeft < 0) return null;
            return {
                id: String(entry.id || ''),
                type: String(entry.type || ''),
                title: String(entry?.values?.provider || entry.type || 'Utility'),
                subtitle: String(entry?.values?.accountNumber || entry?.values?.location || ''),
                endDate: end,
                endLabel: formatExpiryDate(end),
                daysLeft,
                time: endDay,
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
