/** Aggregate bill stats for overview / amount summary cards. */

import { entryRequiresMonthlyBill } from './utilityBillsStorage';

/** Company calendar month for utility bills — rolls only on the 1st (Asia/Dubai). */
export const UTILITY_CALENDAR_TZ = 'Asia/Dubai';

export function utilityCalendarMonthKey(refDate = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: UTILITY_CALENDAR_TZ,
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(refDate);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    if (!year || !month) return '';
    return `${year}-${month}`;
}

export function shiftUtilityMonthKey(ym, deltaMonths = 0) {
    if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return '';
    const year = Number(String(ym).slice(0, 4));
    const month = Number(String(ym).slice(5, 7));
    const shifted = new Date(Date.UTC(year, month - 1 + (Number(deltaMonths) || 0), 1));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Newest bill month that may be opened.
 * A calendar month's bill only appears on the 1st of the next month (Asia/Dubai).
 * 11 Sep → Aug; 1 Oct → Sep.
 */
export function openUtilityBillMonthKey(refDate = new Date()) {
    return shiftUtilityMonthKey(utilityCalendarMonthKey(refDate), -1);
}

export function isUtilityBillMonthOpen(ym, refDate = new Date()) {
    const key = String(ym || '').trim();
    const open = openUtilityBillMonthKey(refDate);
    return Boolean(/^\d{4}-\d{2}$/.test(key) && open && key <= open);
}

/** Newest first: last closed calendar month, then previous months. */
export function recentUtilityMonthKeys(count = 6, refDate = new Date()) {
    const newest = openUtilityBillMonthKey(refDate);
    if (!newest) return [];
    const keys = [];
    for (let i = 0; i < count; i += 1) {
        const ym = shiftUtilityMonthKey(newest, -i);
        if (ym) keys.push(ym);
    }
    return keys;
}

export function formatBillMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Dashboard amounts with AED prefix (whole numbers when there are no fils). */
export function formatAed(n) {
    const num = Number(n);
    const safe = Number.isFinite(num) ? num : 0;
    return `AED ${Math.round(safe).toLocaleString('en-US')}`;
}

export function summarizeUtilityBills(bills = []) {
    const list = Array.isArray(bills) ? bills : [];
    const buckets = {
        pendingAccounts: { count: 0, amount: 0 },
        pendingHr: { count: 0, amount: 0 },
        notPaid: { count: 0, amount: 0 },
        paid: { count: 0, amount: 0 },
        rejected: { count: 0, amount: 0 },
    };

    list.forEach((b) => {
        const amt = Number(b.amount) || 0;
        const s = String(b.status || '');
        if (s === 'Pending Accounts') {
            buckets.pendingAccounts.count += 1;
            buckets.pendingAccounts.amount += amt;
        } else if (s === 'Pending HR') {
            buckets.pendingHr.count += 1;
            buckets.pendingHr.amount += amt;
        } else if (s === 'Approved') {
            buckets.notPaid.count += 1;
            buckets.notPaid.amount += amt;
        } else if (s === 'Paid') {
            buckets.paid.count += 1;
            buckets.paid.amount += amt;
        } else if (s === 'Rejected') {
            buckets.rejected.count += 1;
            buckets.rejected.amount += amt;
        }
    });

    const totalAmount = list.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const totalContract = list.reduce((s, b) => s + (Number(b.monthlyRental) || 0), 0);

    return {
        totalCount: list.length,
        totalAmount,
        totalContract,
        ...buckets,
    };
}

export function billDisplayStatus(bill) {
    if (!bill) return '';
    if (bill.statusLabel) return bill.statusLabel;
    if (bill.status === 'Approved') return 'not paid';
    if (bill.status === 'Paid') return 'paid';
    return String(bill.status || '');
}

/** True when this ERP bill already has a Zoho Books bill id / number. */
export function utilityBillIsInZoho(bill) {
    if (!bill) return false;
    if (bill.inZoho === true) return true;
    if (String(bill.zohoBillId || '').trim()) return true;
    if (String(bill.zohoBillNumber || '').trim()) return true;
    if (Array.isArray(bill.zohoBillIds) && bill.zohoBillIds.some((id) => String(id || '').trim())) {
        return true;
    }
    return (Array.isArray(bill.zohoLineItems) ? bill.zohoLineItems : []).some((line) =>
        Boolean(String(line?.zohoBillId || '').trim()),
    );
}

/** True when the bill still needs payment (not Paid / Rejected). */
export function isUnpaidUtilityBill(bill) {
    const s = String(bill?.status || '').trim();
    if (!s) return false;
    if (s === 'Paid' || s === 'Rejected') return false;
    return true;
}

/**
 * Statuses that occupy an entry for a bill month (Approved displays as Not Paid).
 * Pending / Rejected do not occupy — those rows still appear in Add Bills.
 */
export const OCCUPIED_BILL_STATUSES = new Set(['Approved', 'Paid']);

export function isOccupiedBillStatus(status) {
    return OCCUPIED_BILL_STATUSES.has(String(status || ''));
}

/** Normalize billMonth values to YYYY-MM for occupancy matching. */
export function normalizeBillMonthKey(value) {
    const s = String(value || '').trim();
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
    return '';
}

/** Entry ids that already have Approved / Paid for the given YYYY-MM. */
export function entryIdsWithOccupiedBillForMonth(
    bills = [],
    billMonth = '',
    { excludeBillIds = [] } = {},
) {
    const ym = normalizeBillMonthKey(billMonth);
    const exclude = new Set((excludeBillIds || []).map(String));
    const set = new Set();
    (bills || []).forEach((b) => {
        if (normalizeBillMonthKey(b?.billMonth) !== ym) return;
        if (!isOccupiedBillStatus(b?.status)) return;
        if (b?._id != null && exclude.has(String(b._id))) return;
        const id = String(b?.entryId || '');
        if (id) set.add(id);
    });
    return set;
}

export function filterEntriesWithoutOccupiedBill(entries = [], bills = [], billMonth = '') {
    const occupied = entryIdsWithOccupiedBillForMonth(bills, billMonth);
    return (entries || []).filter((e) => !occupied.has(String(e?.id || '')));
}

/**
 * YYYY-MM when the utility account became available for billing lists.
 * Use created month; fall back to contract start.
 */
export function entryAvailableFromMonth(entry) {
    const created = entry?.createdAt || entry?.created_at || null;
    if (created) {
        const d = new Date(created);
        if (!Number.isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
    }
    const contractStart = String(entry?.values?.contractStart || entry?.contractStart || '').trim();
    if (/^\d{4}-\d{2}/.test(contractStart)) {
        return contractStart.slice(0, 7);
    }
    return '';
}

/**
 * Only accounts that already existed in the selected bill month.
 * Created in Aug → shown for Aug and later; not shown for Jul / Jun / Mar, etc.
 */
export function filterEntriesAvailableForBillMonth(entries = [], billMonth = '') {
    const ym = String(billMonth || '').trim();
    if (!/^\d{4}-\d{2}$/.test(ym)) return Array.isArray(entries) ? [...entries] : [];
    return (entries || []).filter((entry) => {
        const from = entryAvailableFromMonth(entry);
        if (!from) return true;
        return from <= ym;
    });
}

/** Active accounts for a month that still need billing (available + not occupied + rental > 0). */
export function filterBillableEntriesForMonth(entries = [], bills = [], billMonth = '') {
    const available = filterEntriesAvailableForBillMonth(entries, billMonth);
    return filterEntriesWithoutOccupiedBill(available, bills, billMonth).filter((entry) =>
        entryRequiresMonthlyBill(entry),
    );
}

/** True when every entry already has Approved / Paid for that month. */
export function isMonthFullyOccupied(entries = [], bills = [], billMonth = '') {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) return false;
    const occupied = entryIdsWithOccupiedBillForMonth(bills, billMonth);
    return list.every((e) => occupied.has(String(e?.id || '')));
}

/**
 * Month can be selected when it has at least one account created on/before that month
 * that is still unbilled. Empty months (no eligible rows) and fully billed months are disabled.
 */
export function isBillMonthSelectable(entries = [], bills = [], billMonth = '') {
    const ym = String(billMonth || '').trim();
    if (!/^\d{4}-\d{2}$/.test(ym)) return false;
    const billable = filterBillableEntriesForMonth(entries, bills, ym);
    return billable.length > 0;
}
