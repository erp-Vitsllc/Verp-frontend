/** Aggregate bill stats for overview / amount summary cards. */

export function formatBillMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

/**
 * Statuses that occupy an entry for a bill month (Approved displays as Not Paid).
 * Pending / Rejected do not occupy — those rows still appear in Add Bills.
 */
export const OCCUPIED_BILL_STATUSES = new Set(['Approved', 'Paid']);

export function isOccupiedBillStatus(status) {
    return OCCUPIED_BILL_STATUSES.has(String(status || ''));
}

/** Entry ids that already have Approved / Paid for the given YYYY-MM. */
export function entryIdsWithOccupiedBillForMonth(
    bills = [],
    billMonth = '',
    { excludeBillIds = [] } = {},
) {
    const ym = String(billMonth || '').trim();
    const exclude = new Set((excludeBillIds || []).map(String));
    const set = new Set();
    (bills || []).forEach((b) => {
        if (String(b?.billMonth || '').trim() !== ym) return;
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

/** Active accounts for a month that still need billing (available + not occupied). */
export function filterBillableEntriesForMonth(entries = [], bills = [], billMonth = '') {
    const available = filterEntriesAvailableForBillMonth(entries, billMonth);
    return filterEntriesWithoutOccupiedBill(available, bills, billMonth);
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
