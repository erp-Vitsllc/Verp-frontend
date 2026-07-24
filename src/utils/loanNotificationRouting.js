/**
 * Loan / Advance pending-inbox → detail route helpers
 * (same pattern as rewardNotificationRouting / fineNotificationRouting).
 */

export function normalizeLoanNotificationItem(item = {}) {
    const raw = item?.raw && typeof item.raw === 'object' ? item.raw : item;
    return {
        id:
            raw?.loan?._id ||
            raw?.requestObjectId ||
            raw?.requestId ||
            raw?.id ||
            item?.id ||
            '',
        type: String(raw?.type || raw?.requestType || item?.type || item?.requestType || '').trim(),
        extra1: raw?.extra1 || '',
        extra2: raw?.extra2 || '',
        extra3: raw?.extra3 || '',
        loan: raw?.loan || item?.loan || null,
        requestObjectId: raw?.requestObjectId || raw?.requestId || '',
    };
}

export function resolveLoanDetailRouteId(rawItem) {
    const item = normalizeLoanNotificationItem(rawItem);
    if (item.loan?._id) return String(item.loan._id);
    if (item.requestObjectId) return String(item.requestObjectId);
    if (item.loan?.loanId) return String(item.loan.loanId);
    return item.id ? String(item.id) : '';
}

/** Loan/Advance notifications open the loan detail page for the current stage. */
export function buildLoanNotificationPath(rawItem) {
    const item = normalizeLoanNotificationItem(rawItem);
    const type = item.type.toLowerCase();
    if (
        !type.includes('loan') &&
        type !== 'advance' &&
        !type.includes('loan/advance') &&
        !type.includes('loan and advance')
    ) {
        return '';
    }
    const routeId = resolveLoanDetailRouteId(item);
    return routeId ? `/HRM/LoanAndAdvance/${encodeURIComponent(routeId)}` : '';
}
