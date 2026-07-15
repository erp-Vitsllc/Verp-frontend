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
