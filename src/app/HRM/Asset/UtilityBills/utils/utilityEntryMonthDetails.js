/**
 * Which SIM / utility details a summary month should show.
 * Past months use the revision saved when details were edited.
 * The open bill month keeps the live record.
 */

const MONTH_KEY = /^\d{4}-\d{2}$/;

export function revisionForPastMonth(entry, ym, currentMonth) {
    const month = String(ym || '');
    const open = String(currentMonth || '');
    if (!MONTH_KEY.test(month)) return null;
    if (MONTH_KEY.test(open) && month >= open) return null;

    const revisions = Array.isArray(entry?.detailRevisions) ? entry.detailRevisions : [];
    let match = null;
    revisions.forEach((rev) => {
        const from = String(rev?.fromMonth || '');
        if (!MONTH_KEY.test(from)) return;
        if (from <= month && (!match || from > String(match.fromMonth || ''))) match = rev;
    });
    return match;
}

export function entryForSummaryMonth(entry, ym, currentMonth) {
    const rev = revisionForPastMonth(entry, ym, currentMonth);
    if (!rev) return entry;
    return {
        ...entry,
        values: rev.values && typeof rev.values === 'object' ? rev.values : {},
        assignedTo: rev.assignedTo || '',
        assignedToType: rev.assignedToType || '',
        assignedToId: rev.assignedToId || '',
    };
}

export function entryAccountCandidates(entry) {
    const accounts = new Set();
    const add = (value) => {
        const text = String(value || '').trim();
        if (text) accounts.add(text);
    };
    add(entry?.values?.accountNumber);
    add(entry?.values?.accountNo);
    add(entry?.accountNo);
    (Array.isArray(entry?.detailRevisions) ? entry.detailRevisions : []).forEach((rev) => {
        add(rev?.values?.accountNumber);
        add(rev?.values?.accountNo);
    });
    return accounts;
}

function rentalOf(entry) {
    const n = Number(entry?.values?.monthlyRental);
    return Number.isFinite(n) ? n : 0;
}

export function readBillContract(bill) {
    if (!bill || bill.monthlyRental == null || bill.monthlyRental === '') return null;
    const n = Number(bill.monthlyRental);
    return Number.isFinite(n) ? n : null;
}

export function summaryIdentityForMonth(entry, ym, bill, currentMonth) {
    const source = entryForSummaryMonth(entry, ym, currentMonth);
    const isCurrent =
        MONTH_KEY.test(String(currentMonth || '')) && String(ym || '') >= String(currentMonth);
    const billedContract = readBillContract(bill);
    const liveAccount = String(
        source?.values?.accountNumber || source?.values?.accountNo || source?.accountNo || '',
    ).trim();
    const billAccount = String(bill?.accountNo || '').trim();

    return {
        source,
        isCurrent,
        accountNo: isCurrent ? liveAccount : billAccount || liveAccount,
        assigneeName: String(source?.assignedTo || source?.assignedToName || '').trim(),
        assignedToType: String(source?.assignedToType || ''),
        assignedToId: String(source?.assignedToId || ''),
        contractAmount: !isCurrent && billedContract > 0 ? billedContract : rentalOf(source),
    };
}
