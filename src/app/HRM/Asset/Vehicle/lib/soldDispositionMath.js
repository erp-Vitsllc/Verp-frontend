/** Parse numeric AED fields from form strings (digits only). */
export function parseMoneyInt(v) {
    const n = Number(String(v ?? '').replace(/\D/g, '') || 0);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Balance in hand for Sold: |(loan + registration expense + other expense) − sold value|.
 * Always a non-negative difference (no minus sign).
 */
export function computeSoldBalanceInHand(soldValue, currentLoanAmount, registrationExpense, otherExpense) {
    const raw =
        parseMoneyInt(currentLoanAmount) +
        parseMoneyInt(registrationExpense) +
        parseMoneyInt(otherExpense) -
        parseMoneyInt(soldValue);
    return Math.abs(Math.round(raw));
}
