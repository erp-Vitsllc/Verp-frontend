import {
    entryRequiresMonthlyBill,
    getMonthlyRentalAmount,
    isEntryActive,
} from './utilityBillsStorage';
import { entryAvailableFromMonth, formatBillMoney, normalizeBillMonthKey, openUtilityBillMonthKey } from './utilityBillStats';
import { ALL_MONTHS, MONTH_OPTIONS } from './utilityOverviewStats';

export const SUMMARY_STATUS = {
    NOT_UPDATED: 'not updated',
    NOT_PAID: 'not paid',
    PAID: 'paid',
};

function sameType(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function calendarYm(refDate = new Date()) {
    return openUtilityBillMonthKey(refDate);
}

function nextYm(ym) {
    const year = Number(String(ym).slice(0, 4));
    const month = Number(String(ym).slice(5, 7));
    if (month >= 12) return `${year + 1}-01`;
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function monthKeysFromTo(fromYm, toYm) {
    if (!fromYm || !toYm || fromYm > toYm) return [];
    const keys = [];
    let cursor = fromYm;
    while (cursor <= toYm) {
        keys.push(cursor);
        cursor = nextYm(cursor);
    }
    return keys;
}

export function formatSummaryMonth(ym) {
    const key = normalizeBillMonthKey(ym);
    if (!key) return '—';
    const month = MONTH_OPTIONS.find((opt) => opt.value === key.slice(5, 7));
    return `${month?.label || key.slice(5, 7)} ${key.slice(0, 4)}`;
}

export function formatSummaryMoney(value) {
    if (value == null || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${formatBillMoney(n)} AED`;
}

export function entryAccountNumber(entry, bill = null) {
    return (
        String(bill?.accountNo || '').trim() ||
        String(entry?.values?.accountNumber || entry?.values?.accountNo || entry?.accountNo || '').trim()
    );
}

export function entryAssigneeName(entry) {
    return String(entry?.assignedTo || entry?.assignedToName || '').trim();
}

/** True when the ERP bill was created in Zoho Books. */
export function utilityBillEnteredInZoho(bill) {
    if (!bill) return false;
    if (String(bill.zohoBillId || '').trim()) return true;
    if (Array.isArray(bill.zohoBillIds) && bill.zohoBillIds.some((id) => String(id || '').trim())) {
        return true;
    }
    const lines = Array.isArray(bill.zohoLineItems) ? bill.zohoLineItems : [];
    return lines.some((line) => String(line?.zohoBillId || '').trim());
}

/**
 * Summary status:
 * - no bill created → not updated
 * - bill created but not entered in Zoho → not paid
 * - bill entered in Zoho and paid → paid
 * - bill entered in Zoho but not paid yet → not paid
 */
export function summaryBillStatus(bill) {
    if (!bill) return SUMMARY_STATUS.NOT_UPDATED;
    // Created in ERP but not entered in Zoho → not paid
    if (!utilityBillEnteredInZoho(bill)) return SUMMARY_STATUS.NOT_PAID;
    if (String(bill.status || '') === 'Paid') return SUMMARY_STATUS.PAID;
    return SUMMARY_STATUS.NOT_PAID;
}

export function summaryStatusBadgeClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === SUMMARY_STATUS.PAID) return 'bg-teal-50 text-teal-800 border-teal-200';
    if (s === SUMMARY_STATUS.NOT_PAID) return 'bg-orange-50 text-orange-700 border-orange-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
}

function billDisplayAmount(bill) {
    if (!bill) return null;
    const amount = Number(bill.amount) || 0;
    const paySum = (Number(bill.companyPayAmount) || 0) + (Number(bill.employeePayAmount) || 0);
    return Math.max(amount, paySum);
}

function billRank(bill) {
    if (!bill) return 0;
    if (String(bill.status || '') === 'Paid') return 4;
    if (utilityBillEnteredInZoho(bill)) return 3;
    if (String(bill.status || '') === 'Approved') return 2;
    return 1;
}

function pickPreferredBill(current, next) {
    if (!current) return next;
    if (!next) return current;
    if (billRank(next) !== billRank(current)) {
        return billRank(next) > billRank(current) ? next : current;
    }
    const nextTime = next.createdAt ? new Date(next.createdAt).getTime() : 0;
    const currentTime = current.createdAt ? new Date(current.createdAt).getTime() : 0;
    return nextTime >= currentTime ? next : current;
}

function monthsForEntryInPeriod(entry, { year, month, capYm }) {
    const fromYm = entryAvailableFromMonth(entry) || capYm;
    const rawYear = year == null ? '' : String(year).trim();
    const periodYear =
        !rawYear || rawYear.toLowerCase() === 'all' ? null : rawYear;
    const periodMonth = String(month || ALL_MONTHS);
    return monthKeysFromTo(fromYm, capYm).filter((ym) => {
        if (periodYear && ym.slice(0, 4) !== periodYear) return false;
        if (periodMonth && periodMonth !== ALL_MONTHS && ym.slice(5, 7) !== periodMonth) {
            return false;
        }
        return true;
    });
}

function buildSummaryRow(entry, ym, bill) {
    const contractAmount = bill
        ? Number(bill.monthlyRental) || getMonthlyRentalAmount(entry)
        : getMonthlyRentalAmount(entry);
    const billAmount = billDisplayAmount(bill);
    const difference =
        bill && billAmount != null && Number.isFinite(Number(contractAmount))
            ? Number(contractAmount) - Number(billAmount)
            : null;
    const status = summaryBillStatus(bill);
    const assigneeName = entryAssigneeName(entry);

    return {
        key: `${entry.id}::${ym}`,
        entryId: String(entry.id || ''),
        billId: bill?._id ? String(bill._id) : '',
        batchId: bill?.batchId ? String(bill.batchId) : '',
        monthKey: ym,
        monthLabel: formatSummaryMonth(ym),
        accountNo: entryAccountNumber(entry, bill),
        assigneeName,
        assignedToType: String(entry?.assignedToType || ''),
        assignedToId: String(entry?.assignedToId || ''),
        contractAmount,
        billAmount,
        difference,
        status,
        bill,
        href: `/HRM/Asset/UtilityBills/details/${encodeURIComponent(String(entry.id || ''))}${
            bill?._id ? `?billId=${encodeURIComponent(String(bill._id))}` : ''
        }`,
        searchText: [
            formatSummaryMonth(ym),
            ym,
            entryAccountNumber(entry, bill),
            assigneeName,
            entry?.values?.provider,
            status,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
    };
}

/**
 * One row per account × month for the selected utility type.
 * Pass year/month to limit the period; omit year (or use "all") and month=ALL_MONTHS for full history.
 * Missing months on active accounts are included as “not updated”.
 */
export function buildUtilityTypeSummaryRows({
    entries = [],
    bills = [],
    utilityType = '',
    year,
    month,
    refDate = new Date(),
} = {}) {
    const typeEntries = (Array.isArray(entries) ? entries : []).filter((entry) =>
        sameType(entry?.type, utilityType),
    );
    const typeBills = (Array.isArray(bills) ? bills : []).filter((bill) =>
        sameType(bill?.utilityType, utilityType),
    );

    const billsByEntryMonth = new Map();
    typeBills.forEach((bill) => {
        const entryId = String(bill?.entryId || '').trim();
        const ym = normalizeBillMonthKey(bill?.billMonth);
        if (!entryId || !ym) return;
        const key = `${entryId}::${ym}`;
        billsByEntryMonth.set(key, pickPreferredBill(billsByEntryMonth.get(key), bill));
    });

    const capYm = calendarYm(refDate);
    const period = { year, month, capYm };
    const rows = [];

    typeEntries.forEach((entry) => {
        const entryId = String(entry?.id || '').trim();
        if (!entryId) return;
        const active = isEntryActive(entry);
        const billable = entryRequiresMonthlyBill(entry);

        monthsForEntryInPeriod(entry, period).forEach((ym) => {
            const bill = billsByEntryMonth.get(`${entryId}::${ym}`) || null;
            if (!bill && (!active || !billable)) return;
            rows.push(buildSummaryRow(entry, ym, bill));
        });
    });

    rows.sort((a, b) => {
        const monthCmp = String(b.monthKey).localeCompare(String(a.monthKey));
        if (monthCmp !== 0) return monthCmp;
        return String(a.accountNo || '').localeCompare(String(b.accountNo || ''), undefined, {
            numeric: true,
            sensitivity: 'base',
        });
    });

    return rows;
}

function monthAggregateStatus(billRows = []) {
    const list = Array.isArray(billRows) ? billRows : [];
    if (!list.length) return SUMMARY_STATUS.NOT_UPDATED;
    if (list.every((row) => row.status === SUMMARY_STATUS.PAID)) return SUMMARY_STATUS.PAID;
    if (list.some((row) => row.status === SUMMARY_STATUS.NOT_PAID)) return SUMMARY_STATUS.NOT_PAID;
    return SUMMARY_STATUS.NOT_UPDATED;
}

/**
 * Month-level summary: one parent row per month, with nested billed account rows.
 */
export function buildUtilityTypeMonthSummaryRows(args = {}) {
    const detailRows = buildUtilityTypeSummaryRows(args);
    const byMonth = new Map();

    detailRows.forEach((row) => {
        const ym = String(row.monthKey || '');
        if (!ym) return;
        if (!byMonth.has(ym)) {
            byMonth.set(ym, {
                key: `month::${ym}`,
                monthKey: ym,
                monthLabel: row.monthLabel || formatSummaryMonth(ym),
                bills: [],
            });
        }
        byMonth.get(ym).bills.push(row);
    });

    const months = [...byMonth.values()].map((group) => {
        const allRows = group.bills;
        const contractAmount = allRows.reduce((sum, row) => sum + (Number(row.contractAmount) || 0), 0);
        const billAmount = allRows.reduce((sum, row) => sum + (Number(row.billAmount) || 0), 0);
        const difference = contractAmount - billAmount;
        const status = monthAggregateStatus(allRows);
        const billRows = allRows;

        return {
            key: group.key,
            monthKey: group.monthKey,
            monthLabel: group.monthLabel,
            billCount: allRows.length,
            assignedCount: allRows.filter((row) => String(row.assigneeName || '').trim()).length,
            contractAmount,
            billAmount,
            difference,
            status,
            bills: billRows,
            searchText: [
                group.monthLabel,
                group.monthKey,
                status,
                ...billRows.flatMap((row) => [
                    row.accountNo,
                    row.assigneeName,
                    row.status,
                ]),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase(),
        };
    });

    months.sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)));
    return months;
}

export function filterSummaryRows(rows = [], searchQuery = '') {
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return Array.isArray(rows) ? rows : [];
    return (rows || []).filter((row) => String(row?.searchText || '').includes(q));
}
